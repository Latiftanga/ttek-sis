"""
End-of-year roll-over: move an entire class to the next academic year.

The system shows the headteacher year aggregates + attendance and
executes their decisions per student (Promote / Repeat / Graduate /
Transferred / Withdrawn). No automatic verdict — humans decide.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func

from app.dependencies import CurrentUser, CurrentSchool, DB
from app.utils import (
    assert_class_in_school as _assert_class_in_school,
)
from app.models.academic import AcademicYear, Class, Term
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.models.assessment import TermResult
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.schemas.rollover import (
    ClassBrief,
    RolloverCommitRequest,
    RolloverCommitResponse,
    RolloverPreviewResponse,
    RolloverPreviewRow,
)


router = APIRouter()
UTC = timezone.utc

# Only headteacher-level roles can run roll-over — it permanently changes
# every student's enrollment.
_ROLES = ("headteacher", "school_admin", "superadmin")


# ── Helpers ────────────────────────────────────────────────────────────────

def _is_terminal(cls: Optional[Class]) -> bool:
    """JHS 3 (BECE) and SHS 3 (WASSCE) are terminal years — those students
    graduate rather than promote within the same school."""
    if cls is None:
        return False
    return bool(cls.is_bece_level or cls.is_wassce_level)


async def _get_class(class_id: UUID, school_id: UUID, db) -> Class:
    res = await db.execute(
        select(Class).where(Class.id == class_id, Class.school_id == school_id)
    )
    cls = res.scalar_one_or_none()
    if not cls:
        raise HTTPException(404, "Class not found")
    return cls


async def _get_year(year_id: UUID, school_id: UUID, db) -> AcademicYear:
    res = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == year_id,
            AcademicYear.school_id == school_id,
        )
    )
    yr = res.scalar_one_or_none()
    if not yr:
        raise HTTPException(404, "Academic year not found")
    return yr


# ── Preview ────────────────────────────────────────────────────────────────

@router.get("/preview", response_model=RolloverPreviewResponse)
async def rollover_preview(
    user: CurrentUser, school: CurrentSchool, db: DB,
    source_class_id:         UUID = Query(...),
    source_academic_year_id: UUID = Query(...),
    target_academic_year_id: UUID = Query(...),
):
    """
    Decision-support data for one source class. Returns every active
    student in the class with their year aggregate (mean raw_score across
    all terms × subjects this year) and attendance percentage, plus the
    list of classes the headteacher can promote into.
    """
    if user.role not in _ROLES:
        raise HTTPException(
            403, "Only headteacher or admin can run end-of-year roll-over",
        )

    cls = await _get_class(source_class_id, school.id, db)
    src_year = await _get_year(source_academic_year_id, school.id, db)
    tgt_year = await _get_year(target_academic_year_id, school.id, db)
    if tgt_year.id == src_year.id:
        raise HTTPException(
            400, "Target academic year must be different from the source year",
        )

    # Active students currently enrolled in this class for the source year.
    enr_res = await db.execute(
        select(Enrollment)
        .where(
            Enrollment.school_id == school.id,
            Enrollment.class_id == source_class_id,
            Enrollment.academic_year_id == source_academic_year_id,
            Enrollment.status == "active",
        )
        .order_by(Enrollment.student_id)
    )
    enrollments = enr_res.scalars().all()

    if not enrollments:
        return RolloverPreviewResponse(
            source_class_id=source_class_id,
            source_class_name=cls.name,
            source_academic_year_id=source_academic_year_id,
            source_academic_year_name=src_year.name,
            target_academic_year_id=target_academic_year_id,
            target_academic_year_name=tgt_year.name,
            is_terminal_class=_is_terminal(cls),
            rows=[],
            target_classes=[],
        )

    student_ids = [e.student_id for e in enrollments]

    # Hydrate student profiles (name, photo, number) in one query.
    students_res = await db.execute(
        select(Student).where(Student.id.in_(student_ids))
    )
    students = {s.id: s for s in students_res.scalars().all()}

    # Year aggregate per student — mean of all (term × subject) raw_scores
    # in this academic year. One query for the whole class.
    term_ids_res = await db.execute(
        select(Term.id).where(Term.academic_year_id == source_academic_year_id)
    )
    term_ids = [t[0] for t in term_ids_res.all()]
    year_avg_by_student: dict[UUID, Decimal] = {}
    if term_ids:
        agg_res = await db.execute(
            select(TermResult.student_id, func.avg(TermResult.raw_score))
            .where(
                TermResult.school_id == school.id,
                TermResult.student_id.in_(student_ids),
                TermResult.term_id.in_(term_ids),
                TermResult.raw_score.isnot(None),
            )
            .group_by(TermResult.student_id)
        )
        year_avg_by_student = {
            sid: Decimal(str(round(float(avg), 2)))
            for sid, avg in agg_res.all()
            if avg is not None
        }

    # Attendance per student across the whole academic year.
    attendance_by_student: dict[UUID, list[str]] = {}
    if term_ids:
        att_res = await db.execute(
            select(AttendanceRecord.student_id, AttendanceRecord.status)
            .join(AttendanceSession,
                  AttendanceRecord.session_id == AttendanceSession.id)
            .where(
                AttendanceRecord.school_id == school.id,
                AttendanceRecord.student_id.in_(student_ids),
                AttendanceSession.term_id.in_(term_ids),
                AttendanceSession.status == "submitted",
            )
        )
        for sid, status in att_res.all():
            attendance_by_student.setdefault(sid, []).append(status)

    def _att_pct(sid: UUID) -> Optional[Decimal]:
        rows = attendance_by_student.get(sid, [])
        if not rows:
            return None
        attended = sum(1 for s in rows if s in ("present", "late"))
        return Decimal(str(round(attended / len(rows) * 100, 2)))

    rows = []
    for e in enrollments:
        student = students.get(e.student_id)
        if student is None:
            continue
        rows.append(RolloverPreviewRow(
            student_id=student.id,
            enrollment_id=e.id,
            student_number=student.student_number,
            first_name=student.first_name,
            middle_name=student.middle_name,
            last_name=student.last_name,
            photo_url=student.photo_url,
            year_aggregate=year_avg_by_student.get(student.id),
            attendance_pct=_att_pct(student.id),
        ))
    rows.sort(key=lambda r: (r.last_name.lower(), r.first_name.lower()))

    # Target classes — every active class in the school. Headteacher
    # picks which one each student promotes to. We could pre-filter to
    # "next level up" but schools sometimes promote across streams
    # (JHS 2A → JHS 3B) so we keep the dropdown open.
    classes_res = await db.execute(
        select(Class).where(
            Class.school_id == school.id,
            Class.is_active.is_(True),
        )
        .order_by(Class.level_group, Class.level_number, Class.stream)
    )
    target_classes = [
        ClassBrief.model_validate(c) for c in classes_res.scalars().all()
    ]

    return RolloverPreviewResponse(
        source_class_id=source_class_id,
        source_class_name=cls.name,
        source_academic_year_id=source_academic_year_id,
        source_academic_year_name=src_year.name,
        target_academic_year_id=target_academic_year_id,
        target_academic_year_name=tgt_year.name,
        is_terminal_class=_is_terminal(cls),
        rows=rows,
        target_classes=target_classes,
    )


# ── Commit ─────────────────────────────────────────────────────────────────

@router.post("/commit", response_model=RolloverCommitResponse)
async def rollover_commit(
    body: RolloverCommitRequest,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Apply the headteacher's decisions atomically. For each row:
      - close the source enrollment (set status, end_date, closed_by)
      - if promoted/repeated: open a new enrollment in the target class
        for the target year, and link via next_enrollment_id
      - if graduated/transferred/withdrawn: no new enrollment
    Everything runs in a single transaction — partial failure rolls back.
    """
    if user.role not in _ROLES:
        raise HTTPException(
            403, "Only headteacher or admin can run end-of-year roll-over",
        )

    await _assert_class_in_school(body.source_class_id, school.id, db)
    src_year = await _get_year(body.source_academic_year_id, school.id, db)
    tgt_year = await _get_year(body.target_academic_year_id, school.id, db)
    if tgt_year.id == src_year.id:
        raise HTTPException(
            400, "Target academic year must be different from the source year",
        )

    if not body.decisions:
        raise HTTPException(400, "No decisions provided")

    # Parse dates (or fall back to sensible defaults).
    try:
        end_d = (
            date.fromisoformat(body.end_date)
            if body.end_date
            else datetime.now(UTC).date()
        )
    except ValueError:
        raise HTTPException(400, "Invalid end_date — must be YYYY-MM-DD")
    try:
        new_start_d = (
            date.fromisoformat(body.new_start_date)
            if body.new_start_date
            else tgt_year.start_date
        )
    except ValueError:
        raise HTTPException(400, "Invalid new_start_date — must be YYYY-MM-DD")

    # Batch-fetch the source enrollments so we can verify them all before
    # mutating anything.
    enrollment_ids = [d.enrollment_id for d in body.decisions]
    enr_res = await db.execute(
        select(Enrollment).where(
            Enrollment.id.in_(enrollment_ids),
            Enrollment.school_id == school.id,
            Enrollment.class_id == body.source_class_id,
            Enrollment.academic_year_id == body.source_academic_year_id,
        )
    )
    enrollments_by_id = {e.id: e for e in enr_res.scalars().all()}

    # Validate every decision before touching anything.
    target_class_ids = {
        d.target_class_id for d in body.decisions if d.target_class_id
    }
    if target_class_ids:
        tgt_res = await db.execute(
            select(Class.id).where(
                Class.id.in_(target_class_ids),
                Class.school_id == school.id,
            )
        )
        valid_target_class_ids = {row[0] for row in tgt_res.all()}
    else:
        valid_target_class_ids = set()

    for d in body.decisions:
        e = enrollments_by_id.get(d.enrollment_id)
        if e is None:
            raise HTTPException(
                400,
                f"Enrollment {d.enrollment_id} is not active in this class+year",
            )
        if e.student_id != d.student_id:
            raise HTTPException(
                400, "Decision student_id doesn't match the enrollment",
            )
        if e.status != "active":
            raise HTTPException(
                400, f"Enrollment {d.enrollment_id} is already {e.status}",
            )
        if d.target_class_id and d.target_class_id not in valid_target_class_ids:
            raise HTTPException(
                400, f"Target class {d.target_class_id} not found in this school",
            )

    closed = opened = grad = wd = 0
    now = datetime.now(UTC)

    for d in body.decisions:
        src = enrollments_by_id[d.enrollment_id]

        # Close the source enrollment.
        src.status     = d.outcome
        src.end_date   = end_d
        src.closed_by  = user.id
        if d.reason:
            # Append reason to notes rather than overwrite — preserves
            # whatever was already there (e.g. demotion history).
            src.notes = (
                f"{src.notes}\n[{now.date().isoformat()}] {d.reason}"
                if src.notes else d.reason
            )

        if d.outcome in ("promoted", "repeated") and d.target_class_id:
            new_enr = Enrollment(
                school_id=school.id,
                student_id=d.student_id,
                class_id=d.target_class_id,
                academic_year_id=body.target_academic_year_id,
                status="active",
                start_date=new_start_d,
                end_date=None,
            )
            db.add(new_enr)
            await db.flush()  # need new_enr.id for the back-link
            src.next_enrollment_id = new_enr.id
            opened += 1
        elif d.outcome == "graduated":
            grad += 1
        elif d.outcome in ("transferred", "withdrawn"):
            wd += 1
        closed += 1

    await db.commit()

    return RolloverCommitResponse(
        closed_count=closed,
        opened_count=opened,
        graduated_count=grad,
        withdrawn_count=wd,
        message=(
            f"{closed} enrolment{'s' if closed != 1 else ''} closed · "
            f"{opened} new in {tgt_year.name} · "
            f"{grad} graduated · {wd} left"
        ),
    )
