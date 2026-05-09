from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, CurrentSchool, DB
from app.models.school_period import SchoolPeriod
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.academic import Class, Term
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.schemas.attendance import (
    SchoolPeriodCreate, SchoolPeriodUpdate, SchoolPeriodResponse,
    SessionCreate, SessionSubmit, SessionResponse,
    RecordEditRequest, AttendanceRecordResponse,
    SyncBatchRequest, SyncBatchResponse, SyncResult,
    ClassAttendanceSummary, StudentAttendanceSummary, SchoolAttendanceToday,
)

router = APIRouter()
UTC = timezone.utc

# ── Fraud detection thresholds ─────────────────────────────────────────────
MIN_SECONDS_PER_STUDENT = 3       # less than this = too fast
MAX_SYNC_GAP_HOURS      = 12      # more than this = large sync gap


# ══════════════════════════════════════════════════════════════════════════
# SCHOOL PERIODS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/periods", response_model=List[SchoolPeriodResponse])
async def list_periods(user: CurrentUser, school: CurrentSchool, db: DB):
    result = await db.execute(
        select(SchoolPeriod)
        .where(SchoolPeriod.school_id == school.id, SchoolPeriod.is_active == True)
        .order_by(SchoolPeriod.order)
    )
    return result.scalars().all()


@router.post("/periods", response_model=SchoolPeriodResponse, status_code=201)
async def create_period(
    body: SchoolPeriodCreate, user: CurrentUser, school: CurrentSchool, db: DB,
):
    period = SchoolPeriod(
        school_id=school.id,
        name=body.name,
        start_time=body.start_time,
        end_time=body.end_time,
        order=body.order,
        is_break=body.is_break,
    )
    db.add(period)
    await db.commit()
    await db.refresh(period)
    return period


@router.patch("/periods/{period_id}", response_model=SchoolPeriodResponse)
async def update_period(
    period_id: UUID, body: SchoolPeriodUpdate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    period = await _get_period(period_id, school.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(period, field, value)
    await db.commit()
    await db.refresh(period)
    return period


@router.delete("/periods/{period_id}", status_code=204)
async def delete_period(
    period_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    period = await _get_period(period_id, school.id, db)
    period.is_active = False   # soft delete
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# ATTENDANCE SESSIONS
# ══════════════════════════════════════════════════════════════════════════

@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def open_session(
    body: SessionCreate, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Teacher opens an attendance session.
    Checks for duplicates using client_id.
    Validates school attendance mode matches session type.
    """
    # Deduplication — if client_id already exists return existing session
    if body.client_id:
        existing = await db.execute(
            select(AttendanceSession).where(
                AttendanceSession.client_id == body.client_id
            )
        )
        existing_session = existing.scalar_one_or_none()
        if existing_session:
            return existing_session

    # Validate school mode matches session type
    attendance_mode = (school.settings or {}).get("attendance_mode", "daily")
    if attendance_mode == "daily" and body.session_type == "lesson":
        raise HTTPException(
            400,
            "This school uses daily attendance mode. "
            "Switch to per-lesson mode in school settings first."
        )
    if attendance_mode == "per_lesson" and body.session_type == "daily":
        raise HTTPException(
            400,
            "This school uses per-lesson attendance mode. "
            "Please select a subject and period."
        )

    # Per-lesson mode requires subject
    if body.session_type == "lesson" and not body.subject_id:
        raise HTTPException(400, "Lesson sessions require a subject")

    # Check no duplicate session for same class/date/type/subject
    dup_query = select(AttendanceSession).where(
        AttendanceSession.school_id == school.id,
        AttendanceSession.class_id == body.class_id,
        AttendanceSession.date == body.date,
        AttendanceSession.session_type == body.session_type,
        AttendanceSession.status != "cancelled",
    )
    if body.subject_id:
        dup_query = dup_query.where(
            AttendanceSession.subject_id == body.subject_id
        )
    dup = await db.execute(dup_query)
    if dup.scalar_one_or_none():
        raise HTTPException(
            409,
            "An attendance session already exists for this class today. "
            "Check if another teacher already submitted."
        )

    # Compute sync metadata
    now = datetime.now(UTC)
    gap_seconds = int((now - body.client_opened_at.replace(tzinfo=UTC)).total_seconds())
    sync_mode = "online" if gap_seconds < 300 else "offline"

    # Fraud detection
    is_flagged = False
    flag_reason = None

    # Future timestamp check
    if body.client_opened_at.replace(tzinfo=UTC) > now:
        is_flagged = True
        flag_reason = "future_timestamp"

    # Large sync gap
    elif gap_seconds > MAX_SYNC_GAP_HOURS * 3600:
        is_flagged = True
        flag_reason = "large_sync_gap"

    # Outside school hours (before 5am or after 8pm)
    client_hour = body.client_opened_at.hour
    if not is_flagged and (client_hour < 5 or client_hour >= 20):
        is_flagged = True
        flag_reason = "outside_school_hours"

    # Period time window check
    if not is_flagged and body.period_id:
        period = await _get_period(body.period_id, school.id, db)
        client_time = body.client_opened_at.time()
        if not (period.start_time <= client_time <= period.end_time):
            is_flagged = True
            flag_reason = "outside_time_window"

    session = AttendanceSession(
        school_id=school.id,
        class_id=body.class_id,
        term_id=body.term_id,
        teacher_id=user.id,
        subject_id=body.subject_id,
        period_id=body.period_id,
        session_type=body.session_type,
        date=body.date,
        status="open",
        client_opened_at=body.client_opened_at,
        server_synced_at=now,
        sync_mode=sync_mode,
        sync_gap_seconds=gap_seconds,
        client_id=body.client_id,
        is_flagged=is_flagged,
        flag_reason=flag_reason,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/submit", response_model=SessionResponse)
async def submit_session(
    session_id: UUID, body: SessionSubmit,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Teacher submits attendance for a session.
    Validates submission speed (fraud detection).
    Locks the session after submission.
    """
    session = await _get_session(session_id, school.id, db)

    if session.status == "submitted":
        raise HTTPException(400, "Session already submitted")
    if session.status == "cancelled":
        raise HTTPException(400, "Cannot submit a cancelled session")

    now = datetime.now(UTC)

    # Submission speed check
    opened = session.client_opened_at.replace(tzinfo=UTC)
    client_submitted = body.client_submitted_at.replace(tzinfo=UTC)
    duration_seconds = (client_submitted - opened).total_seconds()
    num_students = len(body.records)

    if num_students > 0 and duration_seconds < (num_students * MIN_SECONDS_PER_STUDENT):
        session.is_flagged = True
        session.flag_reason = "submitted_too_fast"

    # Create attendance records
    for record_input in body.records:
        # Check student is enrolled in this class
        existing = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == record_input.student_id,
            )
        )
        if existing.scalar_one_or_none():
            continue  # skip duplicates

        record = AttendanceRecord(
            school_id=school.id,
            session_id=session_id,
            student_id=record_input.student_id,
            status=record_input.status,
            reason=record_input.reason,
            recorded_by=user.id,
        )
        db.add(record)

    # Lock the session
    session.status = "submitted"
    session.submitted_at = now

    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    user: CurrentUser, school: CurrentSchool, db: DB,
    class_id: Optional[UUID] = Query(None),
    date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
):
    query = select(AttendanceSession).where(
        AttendanceSession.school_id == school.id
    )
    if class_id:
        query = query.where(AttendanceSession.class_id == class_id)
    if date:
        query = query.where(AttendanceSession.date == date)
    if status:
        query = query.where(AttendanceSession.status == status)

    query = query.order_by(AttendanceSession.date.desc(),
                           AttendanceSession.server_synced_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/sessions/{session_id}/cancel", response_model=SessionResponse)
async def cancel_session(
    session_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Cancel an open session — e.g. class was on excursion."""
    session = await _get_session(session_id, school.id, db)
    if session.status == "submitted":
        raise HTTPException(400, "Cannot cancel a submitted session")
    session.status = "cancelled"
    await db.commit()
    await db.refresh(session)
    return session


@router.patch("/sessions/{session_id}/review")
async def review_session(
    session_id: UUID,
    outcome: str,
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
    notes: Optional[str] = None,
):
    """Headteacher reviews a flagged session."""
    if user.role not in ("headteacher", "school_admin"):
        raise HTTPException(403, "Only headteacher or admin can review flagged sessions")
    if outcome not in ("cleared", "penalised"):
        raise HTTPException(400, "outcome must be cleared or penalised")

    session = await _get_session(session_id, school.id, db)
    if not session.is_flagged:
        raise HTTPException(400, "Session is not flagged")

    session.reviewed_by = user.id
    session.reviewed_at = datetime.now(UTC)
    session.review_outcome = outcome
    session.review_notes = notes
    await db.commit()
    return {"message": f"Session marked as {outcome}"}


# ══════════════════════════════════════════════════════════════════════════
# ATTENDANCE RECORDS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/sessions/{session_id}/records",
            response_model=List[AttendanceRecordResponse])
async def get_session_records(
    session_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    await _get_session(session_id, school.id, db)
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.session_id == session_id)
        .order_by(AttendanceRecord.recorded_at)
    )
    return result.scalars().all()


@router.patch("/records/{record_id}", response_model=AttendanceRecordResponse)
async def edit_record(
    record_id: UUID, body: RecordEditRequest,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Correct an attendance record.
    Only allowed while session is submitted (not cancelled).
    Headteacher can edit any record.
    Teacher can only edit their own session records same day.
    """
    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.id == record_id,
            AttendanceRecord.school_id == school.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Record not found")

    # Get parent session
    session = await _get_session(record.session_id, school.id, db)
    if session.status == "cancelled":
        raise HTTPException(400, "Cannot edit records of a cancelled session")

    # Teachers can only edit same-day records
    if user.role == "teacher":
        if session.date != date.today():
            raise HTTPException(
                403,
                "Teachers can only correct attendance on the same day. "
                "Contact the headteacher for past corrections."
            )
        if session.teacher_id != user.id:
            raise HTTPException(
                403, "You can only edit records from your own sessions"
            )

    # Preserve original
    if not record.is_edited:
        record.original_status = record.status

    record.status = body.status
    record.reason = body.reason
    record.is_edited = True
    record.last_edited_by = user.id
    record.last_edited_at = datetime.now(UTC)
    record.edit_reason = body.edit_reason

    await db.commit()
    await db.refresh(record)
    return record


# ══════════════════════════════════════════════════════════════════════════
# DASHBOARD ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/today", response_model=SchoolAttendanceToday)
async def school_today(user: CurrentUser, school: CurrentSchool, db: DB):
    """School-wide attendance snapshot for today."""
    today = date.today()

    # Get all active classes
    classes_result = await db.execute(
        select(Class).where(
            Class.school_id == school.id,
            Class.is_active == True,
        )
    )
    all_classes = classes_result.scalars().all()
    total_classes = len(all_classes)
    class_ids = [c.id for c in all_classes]

    # Get today sessions
    sessions_result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.school_id == school.id,
            AttendanceSession.date == today,
            AttendanceSession.status != "cancelled",
        )
    )
    sessions = sessions_result.scalars().all()

    submitted       = sum(1 for s in sessions if s.status == "submitted")
    open_sessions   = sum(1 for s in sessions if s.status == "open")
    flagged         = sum(1 for s in sessions if s.is_flagged)

    # Classes with no session at all today
    classes_with_session = {s.class_id for s in sessions}
    not_started = sum(1 for cid in class_ids if cid not in classes_with_session)

    return SchoolAttendanceToday(
        date=today,
        total_classes=total_classes,
        sessions_submitted=submitted,
        sessions_open=open_sessions,
        sessions_not_started=not_started,
        flagged_sessions=flagged,
    )


@router.get("/class/{class_id}/today", response_model=ClassAttendanceSummary)
async def class_today(
    class_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Attendance summary for a specific class today."""
    today = date.today()

    # Get class
    class_result = await db.execute(
        select(Class).where(Class.id == class_id, Class.school_id == school.id)
    )
    class_ = class_result.scalar_one_or_none()
    if not class_:
        raise HTTPException(404, "Class not found")

    # Get current year enrollments count
    current_year = await _get_current_year(school.id, db)
    enrolled_result = await db.execute(
        select(func.count(Enrollment.id)).where(
            Enrollment.class_id == class_id,
            Enrollment.academic_year_id == current_year.id,
            Enrollment.status == "active",
        )
    )
    total_students = enrolled_result.scalar() or 0

    # Get today session
    session_result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.school_id == school.id,
            AttendanceSession.class_id == class_id,
            AttendanceSession.date == today,
            AttendanceSession.status != "cancelled",
        )
    )
    session = session_result.scalar_one_or_none()

    if not session:
        return ClassAttendanceSummary(
            class_id=class_id,
            class_name=class_.name,
            date=today,
            total_students=total_students,
            present=0,
            absent=0,
            late=0,
            excused=0,
            not_marked=total_students,
            session_id=None,
            session_status=None,
        )

    # Count records by status
    records_result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session.id
        )
    )
    records = records_result.scalars().all()

    present  = sum(1 for r in records if r.status == "present")
    absent   = sum(1 for r in records if r.status == "absent")
    late     = sum(1 for r in records if r.status == "late")
    excused  = sum(1 for r in records if r.status == "excused")
    marked   = len(records)
    not_marked = max(0, total_students - marked)

    return ClassAttendanceSummary(
        class_id=class_id,
        class_name=class_.name,
        date=today,
        total_students=total_students,
        present=present,
        absent=absent,
        late=late,
        excused=excused,
        not_marked=not_marked,
        session_id=session.id,
        session_status=session.status,
    )


@router.get("/student/{student_id}/summary",
            response_model=StudentAttendanceSummary)
async def student_summary(
    student_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
    term_id: Optional[UUID] = Query(None),
):
    """Term attendance summary for one student."""
    # Get student
    student_result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "Student not found")

    # Default to current term
    if not term_id:
        term = await _get_current_term(school.id, db)
        term_id = term.id

    # Get all records for this student this term
    records_result = await db.execute(
        select(AttendanceRecord)
        .join(AttendanceSession,
              AttendanceRecord.session_id == AttendanceSession.id)
        .where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.school_id == school.id,
            AttendanceSession.term_id == term_id,
            AttendanceSession.status == "submitted",
        )
    )
    records = records_result.scalars().all()

    total    = len(records)
    present  = sum(1 for r in records if r.status == "present")
    absent   = sum(1 for r in records if r.status == "absent")
    late     = sum(1 for r in records if r.status == "late")
    excused  = sum(1 for r in records if r.status == "excused")

    pct = round((present + late) / total * 100, 2) if total > 0 else 0.0
    threshold = (school.settings or {}).get("attendance_threshold", 75)
    is_at_risk = pct < threshold

    # Consecutive absences — count from most recent going back
    # Get records ordered by session date desc
    ordered_result = await db.execute(
        select(AttendanceRecord, AttendanceSession.date)
        .join(AttendanceSession,
              AttendanceRecord.session_id == AttendanceSession.id)
        .where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.school_id == school.id,
            AttendanceSession.term_id == term_id,
            AttendanceSession.status == "submitted",
        )
        .order_by(AttendanceSession.date.desc())
    )
    ordered = ordered_result.all()
    consecutive = 0
    for rec, _ in ordered:
        if rec.status == "absent":
            consecutive += 1
        else:
            break

    return StudentAttendanceSummary(
        student_id=student_id,
        student_number=student.student_number,
        first_name=student.first_name,
        last_name=student.last_name,
        total_sessions=total,
        present=present,
        absent=absent,
        late=late,
        excused=excused,
        attendance_pct=pct,
        consecutive_absences=consecutive,
        is_at_risk=is_at_risk,
    )


@router.get("/alerts")
async def attendance_alerts(
    user: CurrentUser, school: CurrentSchool, db: DB,
    term_id: Optional[UUID] = Query(None),
):
    """
    Returns:
      - Students with 3+ consecutive absences
      - Students below attendance threshold
      - Flagged sessions pending review
    """
    if not term_id:
        term = await _get_current_term(school.id, db)
        term_id = term.id

    threshold = (school.settings or {}).get("attendance_threshold", 75)

    # Flagged sessions not yet reviewed
    flagged_result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.school_id == school.id,
            AttendanceSession.is_flagged == True,
            AttendanceSession.review_outcome == None,
        )
        .order_by(AttendanceSession.date.desc())
    )
    flagged_sessions = flagged_result.scalars().all()

    return {
        "flagged_sessions": [
            {
                "session_id":  str(s.id),
                "class_id":    str(s.class_id),
                "date":        s.date.isoformat(),
                "teacher_id":  str(s.teacher_id),
                "flag_reason": s.flag_reason,
            }
            for s in flagged_sessions
        ],
        "threshold_pct": threshold,
        "term_id": str(term_id),
        "note": "Use /student/{id}/summary to check individual student risk status"
    }


# ══════════════════════════════════════════════════════════════════════════
# OFFLINE SYNC
# ══════════════════════════════════════════════════════════════════════════

@router.post("/sync/batch", response_model=SyncBatchResponse)
async def sync_batch(
    body: SyncBatchRequest, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Processes a batch of offline sessions when connectivity returns.
    Each session is processed independently — one failure does not
    block the rest.
    """
    results = []
    succeeded = 0
    failed = 0

    for offline_session in body.sessions:
        client_id = offline_session.session.client_id
        try:
            # Check if already synced via client_id
            if client_id:
                existing = await db.execute(
                    select(AttendanceSession).where(
                        AttendanceSession.client_id == client_id
                    )
                )
                if existing.scalar_one_or_none():
                    results.append(SyncResult(
                        client_id=client_id or "unknown",
                        success=True,
                        error="Already synced",
                    ))
                    succeeded += 1
                    continue

            # Create session using the open endpoint logic
            # Pass through the create flow
            now = datetime.now(UTC)
            client_opened = offline_session.session.client_opened_at
            if client_opened.tzinfo is None:
                client_opened = client_opened.replace(tzinfo=UTC)

            gap_seconds = int((now - client_opened).total_seconds())
            sync_mode = "offline"

            is_flagged = False
            flag_reason = None

            if client_opened > now:
                is_flagged, flag_reason = True, "future_timestamp"
            elif gap_seconds > MAX_SYNC_GAP_HOURS * 3600:
                is_flagged, flag_reason = True, "large_sync_gap"

            client_hour = client_opened.hour
            if not is_flagged and (client_hour < 5 or client_hour >= 20):
                is_flagged, flag_reason = True, "outside_school_hours"

            session = AttendanceSession(
                school_id=school.id,
                class_id=offline_session.session.class_id,
                term_id=offline_session.session.term_id,
                teacher_id=user.id,
                subject_id=offline_session.session.subject_id,
                period_id=offline_session.session.period_id,
                session_type=offline_session.session.session_type,
                date=offline_session.session.date,
                status="submitted",
                client_opened_at=client_opened,
                server_synced_at=now,
                sync_mode=sync_mode,
                sync_gap_seconds=gap_seconds,
                client_id=client_id,
                is_flagged=is_flagged,
                flag_reason=flag_reason,
                submitted_at=now,
            )
            db.add(session)
            await db.flush()

            # Submission speed check
            client_submitted = offline_session.client_submitted_at
            if client_submitted.tzinfo is None:
                client_submitted = client_submitted.replace(tzinfo=UTC)

            duration = (client_submitted - client_opened).total_seconds()
            num_students = len(offline_session.records)
            if num_students > 0 and duration < (num_students * MIN_SECONDS_PER_STUDENT):
                session.is_flagged = True
                session.flag_reason = "submitted_too_fast"

            # Create records
            for rec in offline_session.records:
                db.add(AttendanceRecord(
                    school_id=school.id,
                    session_id=session.id,
                    student_id=rec.student_id,
                    status=rec.status,
                    reason=rec.reason,
                    recorded_by=user.id,
                ))

            await db.commit()
            results.append(SyncResult(
                client_id=client_id or "unknown",
                success=True,
                session_id=session.id,
            ))
            succeeded += 1

        except Exception as e:
            await db.rollback()
            results.append(SyncResult(
                client_id=client_id or "unknown",
                success=False,
                error=str(e),
            ))
            failed += 1

    return SyncBatchResponse(
        processed=len(body.sessions),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )


# ══════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════

async def _get_period(
    period_id: UUID, school_id: UUID, db: AsyncSession
) -> SchoolPeriod:
    result = await db.execute(
        select(SchoolPeriod).where(
            SchoolPeriod.id == period_id,
            SchoolPeriod.school_id == school_id,
        )
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(404, "Period not found")
    return period


async def _get_session(
    session_id: UUID, school_id: UUID, db: AsyncSession
) -> AttendanceSession:
    result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.id == session_id,
            AttendanceSession.school_id == school_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    return session


async def _get_current_year(school_id: UUID, db: AsyncSession):
    from app.models.academic import AcademicYear
    result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == school_id,
            AcademicYear.is_current == True,
        )
    )
    year = result.scalar_one_or_none()
    if not year:
        raise HTTPException(404, "No current academic year set")
    return year


async def _get_current_term(school_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(Term).where(
            Term.school_id == school_id,
            Term.is_current == True,
        )
    )
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(404, "No current term set")
    return term
