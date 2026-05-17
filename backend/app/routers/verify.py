"""
Public report-card verification.

Anyone with a QR-coded URL from a printed report card can hit
`GET /api/verify/report/{token}` and see the same report card data —
without logging in. The token is an HMAC-signed payload of
(student_id, term_id) so it cannot be forged.

Read-only. Returns the sanitised StudentTermReport plus a SchoolBrief
so the public verify page can render with the school's brand.
"""
import base64
import hmac
import hashlib
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.academic import AcademicYear, Class, Subject, Term
from app.models.assessment import (
    Assessment, AssessmentCategory, AssessmentScore, TermResult,
)
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.enrollment import Enrollment
from app.models.school import School
from app.models.student import Student
from app.schemas.grade import (
    StudentTermReport, TermResultResponse,
    StudentTermBreakdown, SubjectBreakdown, CategoryBreakdown,
    AssessmentBreakdown,
)


router = APIRouter()

# ── Token signing ──────────────────────────────────────────────────────────
# Format: base64url(payload).hex(sig16)
# payload = "<student_uuid>:<term_uuid>"
# sig     = first 16 bytes of HMAC-SHA256(payload, SECRET_KEY)
#
# Short (~80 chars) → scans reliably from a QR code at small print size.

_SIG_BYTES = 16


def make_verification_token(student_id: UUID, term_id: UUID) -> str:
    payload = f"{student_id}:{term_id}".encode()
    sig = hmac.new(
        settings.SECRET_KEY.encode(), payload, hashlib.sha256,
    ).digest()[:_SIG_BYTES]
    blob = payload + b"." + sig
    return base64.urlsafe_b64encode(blob).decode().rstrip("=")


def _parse_token(token: str) -> tuple[UUID, UUID]:
    try:
        padded = token + "=" * ((4 - len(token) % 4) % 4)
        blob = base64.urlsafe_b64decode(padded.encode())
        payload, sig = blob.rsplit(b".", 1)
        expected = hmac.new(
            settings.SECRET_KEY.encode(), payload, hashlib.sha256,
        ).digest()[:_SIG_BYTES]
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")
        s_id, t_id = payload.decode().split(":")
        return UUID(s_id), UUID(t_id)
    except Exception as exc:
        # Don't leak which step failed.
        raise HTTPException(404, "Report card not found or token invalid") from exc


# ── Response shape ─────────────────────────────────────────────────────────

class VerifiedSchool(BaseModel):
    name:         str
    district:     Optional[str] = None
    region:       Optional[str] = None
    phone:        Optional[str] = None
    email:        Optional[str] = None
    logo_url:     Optional[str] = None
    accent_color: str


class VerifyReportResponse(BaseModel):
    report:    StudentTermReport
    breakdown: StudentTermBreakdown
    school:    VerifiedSchool


# ── Endpoint ───────────────────────────────────────────────────────────────

@router.get("/report/{token}", response_model=VerifyReportResponse)
async def verify_report(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public report-card lookup. Token comes from the QR code on the
    printed card. Returns the same report card data plus the issuing
    school so the public page can render with the school's brand.
    """
    student_id, term_id = _parse_token(token)

    # Student → resolves school context.
    student = (await db.execute(
        select(Student).where(Student.id == student_id),
    )).scalar_one_or_none()
    if not student:
        raise HTTPException(404, "Report card not found")

    term = (await db.execute(
        select(Term).where(
            Term.id == term_id,
            Term.school_id == student.school_id,
        ),
    )).scalar_one_or_none()
    if not term:
        raise HTTPException(404, "Report card not found")

    school = (await db.execute(
        select(School).where(School.id == student.school_id),
    )).scalar_one_or_none()
    if not school:
        raise HTTPException(404, "Report card not found")

    year = (await db.execute(
        select(AcademicYear).where(AcademicYear.id == term.academic_year_id),
    )).scalar_one_or_none()

    enrollment = (await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == student_id,
            Enrollment.school_id == school.id,
            Enrollment.academic_year_id == term.academic_year_id,
            Enrollment.status == "active",
        ),
    )).scalar_one_or_none()

    class_name = "Unknown"
    class_id = None
    if enrollment:
        class_id = enrollment.class_id
        cls = (await db.execute(
            select(Class).where(Class.id == enrollment.class_id),
        )).scalar_one_or_none()
        if cls:
            class_name = cls.name

    # Per-subject TermResults.
    results = (await db.execute(
        select(TermResult).where(
            TermResult.school_id == school.id,
            TermResult.student_id == student_id,
            TermResult.term_id == term_id,
        ),
    )).scalars().all()

    total_score: Optional[Decimal] = None
    if any(r.raw_score is not None for r in results):
        total_score = sum(
            (r.raw_score for r in results if r.raw_score is not None),
            Decimal("0"),
        )

    # Overall position — rank within the class+term.
    overall_position = None
    if class_id is not None:
        peer = (await db.execute(
            select(TermResult.student_id, func.sum(TermResult.raw_score))
            .where(
                TermResult.school_id == school.id,
                TermResult.class_id == class_id,
                TermResult.term_id == term_id,
                TermResult.is_computed.is_(True),
            )
            .group_by(TermResult.student_id),
        )).all()
        peer_totals = [(sid, total) for sid, total in peer if total is not None]
        ranked = sorted(peer_totals, key=lambda x: x[1], reverse=True)
        for pos, (sid, _) in enumerate(ranked, 1):
            if sid == student_id:
                overall_position = pos
                break

    # Attendance.
    statuses = [row[0] for row in (await db.execute(
        select(AttendanceRecord.status)
        .join(AttendanceSession,
              AttendanceRecord.session_id == AttendanceSession.id)
        .where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.school_id == school.id,
            AttendanceSession.term_id == term_id,
            AttendanceSession.status == "submitted",
        ),
    )).all()]
    attendance_pct: Optional[Decimal] = None
    if statuses:
        attended = sum(1 for s in statuses if s in ("present", "late"))
        attendance_pct = Decimal(str(round(attended / len(statuses) * 100, 2)))

    # Class average per subject (for the "compare to class" tick marks).
    # Inlined rather than imported from routers.grades to avoid a circular
    # import — verify.py is already imported by grades.py.
    subject_averages: dict = {}
    if class_id is not None:
        avg_res = await db.execute(
            select(TermResult.subject_id, func.avg(TermResult.raw_score))
            .where(
                TermResult.school_id == school.id,
                TermResult.class_id == class_id,
                TermResult.term_id == term_id,
                TermResult.is_computed.is_(True),
                TermResult.raw_score.isnot(None),
            )
            .group_by(TermResult.subject_id)
        )
        subject_averages = {
            sid: Decimal(str(round(float(avg), 2)))
            for sid, avg in avg_res.all()
            if avg is not None
        }

    report = StudentTermReport(
        student_id=student_id,
        student_number=student.student_number,
        first_name=student.first_name,
        middle_name=student.middle_name,
        last_name=student.last_name,
        photo_url=student.photo_url,
        class_name=class_name,
        term_name=term.name,
        academic_year=year.name if year else "",
        results=[TermResultResponse.model_validate(r) for r in results],
        total_score=total_score,
        overall_position=overall_position,
        attendance_pct=attendance_pct,
        subject_averages=subject_averages,
    )

    # ── Per-subject breakdown ──────────────────────────────────────────────
    subject_ids = [r.subject_id for r in results]
    breakdown_subjects: list[SubjectBreakdown] = []

    if subject_ids and class_id is not None:
        cats = {c.id: c for c in (await db.execute(
            select(AssessmentCategory).where(
                AssessmentCategory.school_id == school.id,
            ),
        )).scalars().all()}

        assessments = (await db.execute(
            select(Assessment).where(
                Assessment.school_id == school.id,
                Assessment.class_id == class_id,
                Assessment.subject_id.in_(subject_ids),
                Assessment.term_id == term_id,
                Assessment.is_published.is_(True),
            ),
        )).scalars().all()

        scores_by_assessment = {}
        if assessments:
            scores_by_assessment = {
                s.assessment_id: s
                for s in (await db.execute(
                    select(AssessmentScore).where(
                        AssessmentScore.school_id == school.id,
                        AssessmentScore.student_id == student_id,
                        AssessmentScore.assessment_id.in_(
                            [a.id for a in assessments],
                        ),
                    ),
                )).scalars().all()
            }

        subj_names = {
            s.id: s.name for s in (await db.execute(
                select(Subject).where(Subject.id.in_(subject_ids)),
            )).scalars().all()
        }

        by_subject_cat: dict = {}
        for a in assessments:
            by_subject_cat.setdefault((a.subject_id, a.category_id), []).append(a)

        for r in results:
            cat_blocks: list[CategoryBreakdown] = []
            active_cat_ids = {
                cid for (sid, cid) in by_subject_cat if sid == r.subject_id
            }
            ordered = sorted(
                (cats[cid] for cid in active_cat_ids if cid in cats),
                key=lambda c: (0 if c.is_ca else 1, c.order or 0, c.name),
            )
            for cat in ordered:
                cat_assessments = by_subject_cat.get((r.subject_id, cat.id), [])
                ass_breakdown: list[AssessmentBreakdown] = []
                valid_pcts: list[Decimal] = []
                for a in sorted(
                    cat_assessments,
                    key=lambda x: (
                        x.date_administered or x.created_at.date(),
                        x.created_at,
                    ),
                ):
                    s = scores_by_assessment.get(a.id)
                    pct: Optional[Decimal] = None
                    if s and not s.is_absent and s.score is not None:
                        pct = round((s.score / a.max_score) * 100, 2)
                        valid_pcts.append(pct)
                    ass_breakdown.append(AssessmentBreakdown(
                        assessment_id=a.id,
                        date_administered=a.date_administered,
                        description=a.description,
                        score=s.score if s else None,
                        max_score=a.max_score,
                        is_absent=s.is_absent if s else False,
                        pct=pct,
                    ))
                cat_pct = (
                    round(sum(valid_pcts) / len(valid_pcts), 2)
                    if valid_pcts else None
                )
                contribution = (
                    round((cat_pct / 100) * cat.weight, 2)
                    if cat_pct is not None else None
                )
                cat_blocks.append(CategoryBreakdown(
                    category_id=cat.id,
                    name=cat.name,
                    is_ca=cat.is_ca,
                    weight=cat.weight,
                    category_pct=cat_pct,
                    contribution=contribution,
                    assessments=ass_breakdown,
                ))
            breakdown_subjects.append(SubjectBreakdown(
                subject_id=r.subject_id,
                subject_name=subj_names.get(r.subject_id, "Unknown"),
                raw_score=r.raw_score,
                ca_score=r.ca_score,
                exam_score=r.exam_score,
                grade=r.grade,
                remark=r.remark,
                position=r.position,
                categories=cat_blocks,
            ))
        breakdown_subjects.sort(key=lambda s: s.subject_name.lower())

    breakdown = StudentTermBreakdown(
        student_id=student_id, term_id=term_id, subjects=breakdown_subjects,
    )

    return VerifyReportResponse(
        report=report,
        breakdown=breakdown,
        school=VerifiedSchool(
            name=school.name,
            district=school.district,
            region=school.region,
            phone=school.phone,
            email=school.email,
            logo_url=school.logo_url,
            accent_color=school.accent_color or "#1a6b3c",
        ),
    )
