from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, CurrentSchool, DB
from app.utils import (
    assert_class_in_school as _assert_class_in_school,
    assert_term_in_school as _assert_term_in_school,
    assert_subject_in_school as _assert_subject_in_school,
    assert_students_in_school as _assert_students_in_school,
    assert_student_in_school as _assert_student_in_school,
)
from app.models.assessment import (
    GradingScale, GradingBand,
    AssessmentCategory, Assessment,
    AssessmentScore, TermResult, ScoreEditLog,
)
from app.models.academic import AcademicYear, Class, Subject, Term
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.student_subject import StudentSubject
from app.schemas.grade import (
    AssessmentCategoryCreate, AssessmentCategoryUpdate, AssessmentCategoryResponse,
    AssessmentCreate, AssessmentUpdate, AssessmentResponse,
    BulkScoreSubmit, ScoreEditRequest,
    AssessmentScoreResponse, GradebookEntry, GradebookResponse,
    ScoreEditLogResponse,
    ComputeTermResultsRequest, LockTermResultsRequest, TermResultResponse, StudentTermReport,
    GradingScaleCreate, GradingBandCreate, GradingScaleResponse,
)

router = APIRouter()
UTC = timezone.utc


# ══════════════════════════════════════════════════════════════════════════
# GRADING SCALES
# ══════════════════════════════════════════════════════════════════════════

@router.get("/grading-scales", response_model=List[GradingScaleResponse])
async def list_grading_scales(
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Returns system defaults + school's own custom scales."""
    result = await db.execute(
        select(GradingScale)
        .options(selectinload(GradingScale.bands))
        .where(
            (GradingScale.school_id == school.id) |
            (GradingScale.school_id.is_(None))
        )
        .order_by(GradingScale.school_id.nulls_first(), GradingScale.name)
    )
    return result.scalars().all()


@router.post("/grading-scales", response_model=GradingScaleResponse, status_code=201)
async def create_grading_scale(
    body: GradingScaleCreate, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Create a custom grading scale for this school."""
    scale = GradingScale(
        school_id=school.id,
        name=body.name,
        description=body.description,
    )
    db.add(scale)
    await db.commit()
    await db.refresh(scale)
    return scale


@router.post("/grading-scales/{scale_id}/bands", status_code=201)
async def add_grading_band(
    scale_id: UUID, body: GradingBandCreate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Add a band to a school's custom grading scale."""
    scale = await _get_scale(scale_id, school.id, db)

    # Validate no overlap with existing bands
    existing = await db.execute(
        select(GradingBand).where(GradingBand.scale_id == scale_id)
    )
    for band in existing.scalars().all():
        if not (body.max_score <= band.min_score or body.min_score >= band.max_score):
            raise HTTPException(
                400,
                f"Score range {body.min_score}-{body.max_score} overlaps "
                f"with existing band {band.min_score}-{band.max_score} ({band.grade_label})"
            )

    band = GradingBand(
        scale_id=scale_id,
        min_score=body.min_score,
        max_score=body.max_score,
        grade_label=body.grade_label,
        remark=body.remark,
        order=body.order,
    )
    db.add(band)
    await db.commit()
    await db.refresh(band)
    return band


# ══════════════════════════════════════════════════════════════════════════
# ASSESSMENT CATEGORIES
# ══════════════════════════════════════════════════════════════════════════

@router.get("/categories", response_model=List[AssessmentCategoryResponse])
async def list_categories(user: CurrentUser, school: CurrentSchool, db: DB):
    result = await db.execute(
        select(AssessmentCategory)
        .where(
            AssessmentCategory.school_id == school.id,
            AssessmentCategory.is_active.is_(True),
        )
        .order_by(AssessmentCategory.order)
    )
    return result.scalars().all()


@router.post("/categories", response_model=AssessmentCategoryResponse, status_code=201)
async def create_category(
    body: AssessmentCategoryCreate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    # Check total weight won't exceed 100
    existing = await db.execute(
        select(func.sum(AssessmentCategory.weight)).where(
            AssessmentCategory.school_id == school.id,
            AssessmentCategory.is_active.is_(True),
        )
    )
    current_total = existing.scalar() or Decimal("0")
    if current_total + body.weight > 100:
        raise HTTPException(
            400,
            f"Total weight would exceed 100%. "
            f"Current total: {current_total}%. "
            f"Available: {100 - current_total}%"
        )

    category = AssessmentCategory(
        school_id=school.id,
        name=body.name,
        weight=body.weight,
        max_score=body.max_score,
        is_ca=body.is_ca,
        allows_multiple=body.allows_multiple,
        order=body.order,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=AssessmentCategoryResponse)
async def update_category(
    category_id: UUID, body: AssessmentCategoryUpdate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    category = await _get_category(category_id, school.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    category = await _get_category(category_id, school.id, db)
    # Check no assessments use this category
    used = await db.execute(
        select(func.count(Assessment.id)).where(
            Assessment.category_id == category_id
        )
    )
    if (used.scalar() or 0) > 0:
        raise HTTPException(
            400,
            "Cannot delete — assessments exist using this category. "
            "Deactivate it instead."
        )
    category.is_active = False
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# ASSESSMENTS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=List[AssessmentResponse])
async def list_assessments(
    user: CurrentUser, school: CurrentSchool, db: DB,
    class_id:   Optional[UUID] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    term_id:    Optional[UUID] = Query(None),
):
    query = select(Assessment).where(Assessment.school_id == school.id)
    if class_id:
        query = query.where(Assessment.class_id == class_id)
    if subject_id:
        query = query.where(Assessment.subject_id == subject_id)
    if term_id:
        query = query.where(Assessment.term_id == term_id)
    query = query.order_by(Assessment.date_administered.desc(), Assessment.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=AssessmentResponse, status_code=201)
async def create_assessment(
    body: AssessmentCreate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    # Validate category belongs to school
    category = await _get_category(body.category_id, school.id, db)

    # Tenant boundary — class/subject/term must belong to this school
    await _assert_class_in_school(body.class_id, school.id, db)
    await _assert_subject_in_school(body.subject_id, school.id, db)
    await _assert_term_in_school(body.term_id, school.id, db)

    # Validate max_score doesn't exceed category max
    if body.max_score > category.max_score:
        raise HTTPException(
            400,
            f"max_score {body.max_score} exceeds category maximum of {category.max_score}"
        )

    # If category doesn't allow multiple, check none exists for this
    # class + subject + term + category
    if not category.allows_multiple:
        exists = await db.execute(
            select(Assessment).where(
                Assessment.school_id   == school.id,
                Assessment.category_id == body.category_id,
                Assessment.class_id    == body.class_id,
                Assessment.subject_id  == body.subject_id,
                Assessment.term_id     == body.term_id,
            )
        )
        if exists.scalar_one_or_none():
            raise HTTPException(
                409,
                f"Category '{category.name}' only allows one assessment "
                f"per class per subject per term."
            )

    assessment = Assessment(
        school_id=school.id,
        category_id=body.category_id,
        class_id=body.class_id,
        subject_id=body.subject_id,
        term_id=body.term_id,
        title=body.title,
        date_administered=body.date_administered,
        max_score=body.max_score,
        created_by=user.id,
        is_published=False,
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return assessment


@router.patch("/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(
    assessment_id: UUID, body: AssessmentUpdate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    assessment = await _get_assessment(assessment_id, school.id, db)
    if assessment.is_published:
        raise HTTPException(
            400,
            "Cannot edit a published assessment. Unpublish first."
        )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(assessment, field, value)
    await db.commit()
    await db.refresh(assessment)
    return assessment


@router.post("/{assessment_id}/publish", response_model=AssessmentResponse)
async def publish_assessment(
    assessment_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Publish assessment — scores become visible to students in portal.
    After publishing, score edits require a reason.
    """
    assessment = await _get_assessment(assessment_id, school.id, db)

    # Check at least some scores have been entered
    score_count = await db.execute(
        select(func.count(AssessmentScore.id)).where(
            AssessmentScore.assessment_id == assessment_id
        )
    )
    if (score_count.scalar() or 0) == 0:
        raise HTTPException(
            400, "Cannot publish — no scores have been entered yet."
        )

    assessment.is_published = True
    await db.commit()
    await db.refresh(assessment)
    return assessment


@router.post("/{assessment_id}/unpublish", response_model=AssessmentResponse)
async def unpublish_assessment(
    assessment_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Headteacher only — unpublish to allow score corrections."""
    if user.role not in ("headteacher", "school_admin"):
        raise HTTPException(403, "Only headteacher or admin can unpublish")
    assessment = await _get_assessment(assessment_id, school.id, db)
    assessment.is_published = False
    await db.commit()
    await db.refresh(assessment)
    return assessment


# ══════════════════════════════════════════════════════════════════════════
# GRADEBOOK — VIEW + SCORE ENTRY
# ══════════════════════════════════════════════════════════════════════════

@router.get("/{assessment_id}/gradebook", response_model=GradebookResponse)
async def get_gradebook(
    assessment_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Returns class list with scores for this assessment.
    Students without scores show score=None — teacher fills these in.
    """
    assessment = await _get_assessment(assessment_id, school.id, db)
    term = await _get_term(assessment.term_id, school.id, db)

    # Get current year
    year_res = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == school.id,
            AcademicYear.is_current.is_(True),
        )
    )
    year = year_res.scalar_one_or_none()
    if not year:
        raise HTTPException(404, "No current academic year set")

    # Determine if this is an elective subject so we can filter to only
    # students who selected it.
    subject_res = await db.execute(
        select(Subject).where(Subject.id == assessment.subject_id)
    )
    subject = subject_res.scalar_one_or_none()
    is_elective = subject and subject.category == "elective"

    # Base enrollment query: only students present during this term.
    enrollment_q = (
        select(Enrollment)
        .options(selectinload(Enrollment.student))
        .where(
            Enrollment.school_id == school.id,
            Enrollment.class_id == assessment.class_id,
            Enrollment.academic_year_id == year.id,
            Enrollment.status == "active",
            Enrollment.start_date <= term.end_date,
        )
        .order_by(Enrollment.student_id)
    )
    if is_elective:
        enrollment_q = enrollment_q.join(
            StudentSubject,
            (StudentSubject.enrollment_id == Enrollment.id)
            & (StudentSubject.subject_id == assessment.subject_id),
        )

    enrollments_res = await db.execute(enrollment_q)
    enrollments = enrollments_res.scalars().all()

    # Get existing scores for this assessment
    scores_res = await db.execute(
        select(AssessmentScore).where(
            AssessmentScore.assessment_id == assessment_id,
            AssessmentScore.school_id == school.id,
        )
    )
    scores_by_student = {s.student_id: s for s in scores_res.scalars().all()}

    entries = []
    for enrollment in enrollments:
        student = enrollment.student
        score_record = scores_by_student.get(student.id)
        entries.append(GradebookEntry(
            student_id=student.id,
            student_number=student.student_number,
            first_name=student.first_name,
            middle_name=student.middle_name,
            last_name=student.last_name,
            score=score_record.score if score_record else None,
            is_absent=score_record.is_absent if score_record else False,
            remarks=score_record.remarks if score_record else None,
            is_edited=score_record.is_edited if score_record else False,
            score_id=score_record.id if score_record else None,
        ))

    scores_entered = sum(1 for e in entries if e.score_id is not None)

    return GradebookResponse(
        assessment=AssessmentResponse.model_validate(assessment),
        entries=entries,
        total_students=len(entries),
        scores_entered=scores_entered,
        scores_missing=len(entries) - scores_entered,
    )


@router.post("/{assessment_id}/scores", status_code=201)
async def submit_scores(
    assessment_id: UUID, body: BulkScoreSubmit,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Bulk submit scores for entire class.
    Works for both online and offline sync.
    Creates new scores or updates existing ones with full audit trail.
    """
    assessment = await _get_assessment(assessment_id, school.id, db)

    # Tenant boundary — every student must belong to this school
    await _assert_students_in_school(
        [r.student_id for r in body.records], school.id, db
    )

    now = datetime.now(UTC)
    saved = 0
    updated = 0
    errors = []

    # Batch-fetch all existing scores for the submitted students in one query
    existing_res = await db.execute(
        select(AssessmentScore).where(
            AssessmentScore.assessment_id == assessment_id,
            AssessmentScore.school_id == school.id,
            AssessmentScore.student_id.in_([r.student_id for r in body.records]),
        )
    )
    existing_map = {s.student_id: s for s in existing_res.scalars().all()}

    for record in body.records:
        # Validate score doesn't exceed max
        if record.score is not None and record.score > assessment.max_score:
            errors.append({
                "student_id": str(record.student_id),
                "error": f"Score {record.score} exceeds maximum {assessment.max_score}"
            })
            continue

        existing = existing_map.get(record.student_id)

        if existing:
            # Update existing score with audit trail
            old_score     = existing.score
            old_is_absent = existing.is_absent

            # Only log if something actually changed
            if existing.score != record.score or existing.is_absent != record.is_absent:
                # Preserve original on first edit
                if not existing.is_edited:
                    existing.original_score = existing.score

                # Require reason if already published
                if assessment.is_published and not record.remarks:
                    errors.append({
                        "student_id": str(record.student_id),
                        "error": "Reason required when editing a published assessment score"
                    })
                    continue

                existing.score       = record.score
                existing.is_absent   = record.is_absent
                existing.remarks     = record.remarks
                existing.is_edited   = True
                existing.edit_count  = (existing.edit_count or 0) + 1
                existing.last_edited_by = user.id
                existing.last_edited_at = now

                # Append to audit log
                db.add(ScoreEditLog(
                    school_id=school.id,
                    assessment_score_id=existing.id,
                    changed_by=user.id,
                    changed_at=now,
                    old_score=old_score,
                    new_score=record.score,
                    old_is_absent=old_is_absent,
                    new_is_absent=record.is_absent,
                    reason=record.remarks,
                    is_after_submission=assessment.is_published,
                    is_after_lock=False,
                    changed_at_hour=now.hour,
                ))
                updated += 1
        else:
            # New score entry
            score = AssessmentScore(
                school_id=school.id,
                assessment_id=assessment_id,
                student_id=record.student_id,
                score=record.score,
                is_absent=record.is_absent,
                remarks=record.remarks,
                recorded_by=user.id,
            )
            db.add(score)
            saved += 1

    await db.commit()
    return {
        "saved":   saved,
        "updated": updated,
        "errors":  errors,
        "message": f"{saved} scores saved, {updated} updated"
                   + (f", {len(errors)} errors" if errors else ""),
    }


@router.patch("/{assessment_id}/scores/{student_id}",
              response_model=AssessmentScoreResponse)
async def edit_score(
    assessment_id: UUID, student_id: UUID,
    body: ScoreEditRequest,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Correct a single student score.
    After publication: reason is required.
    After term lock: only headteacher can edit.
    Full audit trail always recorded.
    """
    assessment = await _get_assessment(assessment_id, school.id, db)
    await _assert_student_in_school(student_id, school.id, db)

    # Check term lock
    term_res = await db.execute(
        select(TermResult).where(
            TermResult.school_id  == school.id,
            TermResult.subject_id == assessment.subject_id,
            TermResult.class_id   == assessment.class_id,
            TermResult.term_id    == assessment.term_id,
            TermResult.is_submitted.is_(True),
        )
    )
    term_locked = term_res.scalar_one_or_none() is not None

    if term_locked and user.role not in ("headteacher", "school_admin", "superadmin"):
        raise HTTPException(
            403,
            "Term results are locked. Contact the headteacher for corrections."
        )

    if assessment.is_published and not body.reason:
        raise HTTPException(
            400,
            "Reason is required when editing a published assessment score."
        )

    # Get score record
    score_res = await db.execute(
        select(AssessmentScore).where(
            AssessmentScore.assessment_id == assessment_id,
            AssessmentScore.student_id    == student_id,
            AssessmentScore.school_id     == school.id,
        )
    )
    score = score_res.scalar_one_or_none()
    if not score:
        raise HTTPException(404, "Score not found for this student")

    # Validate new score
    if body.score is not None and body.score > assessment.max_score:
        raise HTTPException(
            400,
            f"Score {body.score} exceeds maximum {assessment.max_score}"
        )

    now = datetime.now(UTC)

    # Preserve original on first edit
    if not score.is_edited:
        score.original_score = score.score

    old_score     = score.score
    old_is_absent = score.is_absent

    score.score         = body.score
    score.is_absent     = body.is_absent
    score.remarks       = body.remarks
    score.is_edited     = True
    score.edit_count    = (score.edit_count or 0) + 1
    score.last_edited_by = user.id
    score.last_edited_at = now
    score.edit_reason   = body.reason

    # Audit log
    db.add(ScoreEditLog(
        school_id=school.id,
        assessment_score_id=score.id,
        changed_by=user.id,
        changed_at=now,
        old_score=old_score,
        new_score=body.score,
        old_is_absent=old_is_absent,
        new_is_absent=body.is_absent,
        reason=body.reason,
        is_after_submission=assessment.is_published,
        is_after_lock=term_locked,
        changed_at_hour=now.hour,
    ))

    await db.commit()
    await db.refresh(score)
    return score


@router.get("/{assessment_id}/scores/{student_id}/history",
            response_model=List[ScoreEditLogResponse])
async def score_history(
    assessment_id: UUID, student_id: UUID,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Full edit history for one student's score — for audit purposes."""
    score_res = await db.execute(
        select(AssessmentScore).where(
            AssessmentScore.assessment_id == assessment_id,
            AssessmentScore.student_id    == student_id,
            AssessmentScore.school_id     == school.id,
        )
    )
    score = score_res.scalar_one_or_none()
    if not score:
        raise HTTPException(404, "Score not found")

    logs_res = await db.execute(
        select(ScoreEditLog).where(
            ScoreEditLog.assessment_score_id == score.id
        ).order_by(ScoreEditLog.changed_at)
    )
    return logs_res.scalars().all()


# ══════════════════════════════════════════════════════════════════════════
# SUSPICIOUS ACTIVITY REPORT
# ══════════════════════════════════════════════════════════════════════════

@router.get("/audit/suspicious")
async def suspicious_edits(
    user: CurrentUser, school: CurrentSchool, db: DB,
    term_id: Optional[UUID] = Query(None),
):
    """
    Headteacher report — shows score edits that look suspicious:
    - Edited after publication
    - Edited at night (outside school hours)
    - Edited more than twice
    """
    if user.role not in ("headteacher", "school_admin", "superadmin"):
        raise HTTPException(403, "Only headteacher or admin can view audit report")

    # Scores edited after publication
    query = (
        select(ScoreEditLog, AssessmentScore, Assessment)
        .join(AssessmentScore,
              ScoreEditLog.assessment_score_id == AssessmentScore.id)
        .join(Assessment,
              AssessmentScore.assessment_id == Assessment.id)
        .where(
            ScoreEditLog.school_id == school.id,
            ScoreEditLog.is_after_submission.is_(True),
        )
        .order_by(ScoreEditLog.changed_at.desc())
    )

    if term_id:
        query = query.where(Assessment.term_id == term_id)

    result = await db.execute(query)
    rows = result.all()

    suspicious = []
    for log, score, assessment in rows:
        flags = []
        if log.is_after_submission:
            flags.append("edited_after_publication")
        if log.changed_at_hour is not None and (
            log.changed_at_hour < 6 or log.changed_at_hour >= 21
        ):
            flags.append("edited_outside_school_hours")
        if (score.edit_count or 0) > 2:
            flags.append("edited_more_than_twice")

        suspicious.append({
            "assessment_title": assessment.title,
            "student_id":       str(score.student_id),
            "changed_by":       str(log.changed_by),
            "changed_at":       log.changed_at.isoformat(),
            "old_score":        float(log.old_score) if log.old_score else None,
            "new_score":        float(log.new_score) if log.new_score else None,
            "reason":           log.reason,
            "flags":            flags,
        })

    return {
        "total_suspicious": len(suspicious),
        "edits":            suspicious,
    }


# ══════════════════════════════════════════════════════════════════════════
# TERM RESULTS — COMPUTATION
# ══════════════════════════════════════════════════════════════════════════

@router.post("/term-results/compute")
async def compute_term_results(
    body: ComputeTermResultsRequest,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Compute term results for a class + term.
    Calculates weighted average, applies grading scale, computes positions.
    Can be re-run — overwrites previous computation.
    """
    if user.role not in ("headteacher", "school_admin", "superadmin"):
        raise HTTPException(403, "Only headteacher or admin can compute results")

    # Tenant boundary — class/term/subject must belong to this school
    await _assert_class_in_school(body.class_id, school.id, db)
    term = await _get_term(body.term_id, school.id, db)
    if body.subject_id:
        await _assert_subject_in_school(body.subject_id, school.id, db)

    now = datetime.now(UTC)

    # Get subjects to compute
    if body.subject_id:
        subject_ids = [body.subject_id]
    else:
        subjects_res = await db.execute(
            select(Assessment.subject_id).distinct().where(
                Assessment.school_id == school.id,
                Assessment.class_id  == body.class_id,
                Assessment.term_id   == body.term_id,
            )
        )
        subject_ids = [row[0] for row in subjects_res.all()]

    if not subject_ids:
        raise HTTPException(404, "No assessments found for this class and term")

    # Get current year and all enrollments
    year_res = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == school.id,
            AcademicYear.is_current.is_(True),
        )
    )
    year = year_res.scalar_one_or_none()
    if not year:
        raise HTTPException(404, "No current academic year")

    enrollments_res = await db.execute(
        select(Enrollment).where(
            Enrollment.school_id == school.id,
            Enrollment.class_id  == body.class_id,
            Enrollment.academic_year_id == year.id,
            Enrollment.status    == "active",
            Enrollment.start_date <= term.end_date,
        )
    )
    all_enrollments = enrollments_res.scalars().all()
    all_student_ids = [e.student_id for e in all_enrollments]
    enrollment_by_student = {e.student_id: e.id for e in all_enrollments}

    # Assessment categories for weight lookup
    categories_res = await db.execute(
        select(AssessmentCategory).where(
            AssessmentCategory.school_id == school.id,
            AssessmentCategory.is_active.is_(True),
        )
    )
    categories = {c.id: c for c in categories_res.scalars().all()}

    # Pre-fetch all subjects in one query
    all_subjects_res = await db.execute(
        select(Subject).where(Subject.id.in_(subject_ids))
    )
    subjects_by_id = {s.id: s for s in all_subjects_res.scalars().all()}

    # Grading scale is class-level — fetch once outside the subject loop
    class_res = await db.execute(
        select(Class).where(Class.id == body.class_id)
    )
    class_ = class_res.scalar_one_or_none()
    scale_name = _get_scale_name(class_)

    scale_res = await db.execute(
        select(GradingScale)
        .options(selectinload(GradingScale.bands))
        .where(
            GradingScale.name == scale_name,
            GradingScale.school_id.is_(None),
        )
    )
    scale = scale_res.scalar_one_or_none()

    computed_count = 0

    for subject_id in subject_ids:
        subject = subjects_by_id.get(subject_id)

        # For electives, only students who explicitly selected the subject
        if subject and subject.category == "elective":
            elective_res = await db.execute(
                select(StudentSubject.enrollment_id).where(
                    StudentSubject.subject_id == subject_id,
                    StudentSubject.enrollment_id.in_(list(enrollment_by_student.values())),
                )
            )
            enrolled_enrollment_ids = {r[0] for r in elective_res.all()}
            student_ids = [
                sid for sid, eid in enrollment_by_student.items()
                if eid in enrolled_enrollment_ids
            ]
        else:
            student_ids = all_student_ids

        if not student_ids:
            continue

        # Get all assessments for this subject + class + term
        assessments_res = await db.execute(
            select(Assessment).where(
                Assessment.school_id  == school.id,
                Assessment.class_id   == body.class_id,
                Assessment.subject_id == subject_id,
                Assessment.term_id    == body.term_id,
            )
        )
        assessments = assessments_res.scalars().all()
        if not assessments:
            continue

        # Batch-fetch all scores for these assessments + students in one query
        all_scores_res = await db.execute(
            select(AssessmentScore).where(
                AssessmentScore.assessment_id.in_([a.id for a in assessments]),
                AssessmentScore.student_id.in_(student_ids),
            )
        )
        scores_map = {
            (s.student_id, s.assessment_id): s
            for s in all_scores_res.scalars().all()
        }

        # Batch-fetch existing term results for this subject
        existing_res = await db.execute(
            select(TermResult).where(
                TermResult.school_id  == school.id,
                TermResult.subject_id == subject_id,
                TermResult.term_id    == body.term_id,
                TermResult.class_id   == body.class_id,
            )
        )
        existing_map = {r.student_id: r for r in existing_res.scalars().all()}

        # Compute weighted score per student (no DB calls)
        student_scores = {
            sid: _compute_ca_score(sid, assessments, categories, scores_map)
            for sid in student_ids
        }

        # Rank by score descending
        ranked = sorted(
            [(sid, sc) for sid, sc in student_scores.items() if sc is not None],
            key=lambda x: x[1],
            reverse=True,
        )
        positions = {sid: pos for pos, (sid, _) in enumerate(ranked, 1)}

        # Persist TermResult per student
        for student_id in student_ids:
            raw_score = student_scores.get(student_id)
            grade_label, remark = _apply_grading_scale(raw_score, scale)

            ca_score = None
            if raw_score is not None:
                ca_score = round(raw_score / 2, 2) if scale_name in ("BECE", "WASSCE") else raw_score

            existing = existing_map.get(student_id)
            if existing:
                if existing.is_submitted:
                    continue  # locked — skip
                existing.raw_score   = raw_score
                existing.ca_score    = ca_score
                existing.grade_label = grade_label
                existing.remark      = remark
                existing.position    = positions.get(student_id)
                existing.is_computed = True
                existing.computed_at = now
                existing.computed_by = user.id
            else:
                db.add(TermResult(
                    school_id=school.id,
                    student_id=student_id,
                    subject_id=subject_id,
                    term_id=body.term_id,
                    class_id=body.class_id,
                    raw_score=raw_score,
                    ca_score=ca_score,
                    grade_label=grade_label,
                    remark=remark,
                    position=positions.get(student_id),
                    is_computed=True,
                    is_submitted=False,
                    computed_at=now,
                    computed_by=user.id,
                ))
            computed_count += 1

    await db.commit()
    return {
        "computed": computed_count,
        "subjects": len(subject_ids),
        "message":  f"Computed results for {len(subject_ids)} subject(s), "
                    f"{computed_count} student-subject results",
    }


@router.get("/term-results", response_model=List[TermResultResponse])
async def list_term_results(
    user: CurrentUser, school: CurrentSchool, db: DB,
    class_id:   Optional[UUID] = Query(None),
    term_id:    Optional[UUID] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    student_id: Optional[UUID] = Query(None),
):
    query = select(TermResult).where(TermResult.school_id == school.id)
    if class_id:
        query = query.where(TermResult.class_id == class_id)
    if term_id:
        query = query.where(TermResult.term_id == term_id)
    if subject_id:
        query = query.where(TermResult.subject_id == subject_id)
    if student_id:
        query = query.where(TermResult.student_id == student_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/term-results/student/{student_id}",
            response_model=StudentTermReport)
async def student_term_report(
    student_id: UUID,
    user: CurrentUser, school: CurrentSchool, db: DB,
    term_id: Optional[UUID] = Query(None),
):
    """Full term report for one student — feeds the report card."""
    # Get student
    student_res = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    student = student_res.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "Student not found")

    # Get current term if not specified
    if not term_id:
        term_res = await db.execute(
            select(Term).where(
                Term.school_id == school.id,
                Term.is_current.is_(True),
            )
        )
        term = term_res.scalar_one_or_none()
        if not term:
            raise HTTPException(404, "No current term set")
        term_id = term.id
    else:
        term_res = await db.execute(
            select(Term).where(
                Term.id == term_id,
                Term.school_id == school.id,
            )
        )
        term = term_res.scalar_one_or_none()
        if not term:
            raise HTTPException(404, "Term not found")

    # Get current enrollment
    year_res = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == school.id,
            AcademicYear.is_current.is_(True),
        )
    )
    year = year_res.scalar_one_or_none()

    enrollment_query = select(Enrollment).where(
        Enrollment.student_id == student_id,
        Enrollment.school_id  == school.id,
        Enrollment.status     == "active",
    )
    if year:
        enrollment_query = enrollment_query.where(
            Enrollment.academic_year_id == year.id
        )
    enrollment_res = await db.execute(enrollment_query)
    enrollment = enrollment_res.scalar_one_or_none()
    class_name = "Unknown"
    if enrollment:
        class_res = await db.execute(
            select(Class).where(Class.id == enrollment.class_id)
        )
        cls = class_res.scalar_one_or_none()
        if cls:
            class_name = cls.name

    # Get term results
    results_res = await db.execute(
        select(TermResult).where(
            TermResult.school_id  == school.id,
            TermResult.student_id == student_id,
            TermResult.term_id    == term_id,
        )
    )
    results = results_res.scalars().all()

    # Compute overall position (sum of subject positions)
    total_score = sum(
        r.raw_score for r in results if r.raw_score is not None
    ) if results else None

    return StudentTermReport(
        student_id=student_id,
        student_number=student.student_number,
        first_name=student.first_name,
        middle_name=student.middle_name,
        last_name=student.last_name,
        class_name=class_name,
        term_name=term.name if term else "",
        academic_year=year.name if year else "",
        results=[TermResultResponse.model_validate(r) for r in results],
        total_score=Decimal(str(total_score)) if total_score else None,
        overall_position=None,  # computed separately when all subjects locked
        attendance_pct=None,    # fetched from attendance summary
    )


@router.post("/term-results/lock")
async def lock_term_results(
    body: LockTermResultsRequest,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Lock term results — no more score edits after this.
    Only headteacher or admin can lock.
    Students can see results in portal after lock.
    """
    if user.role not in ("headteacher", "school_admin", "superadmin"):
        raise HTTPException(403, "Only headteacher or admin can lock results")

    await _assert_class_in_school(body.class_id, school.id, db)
    await _assert_term_in_school(body.term_id, school.id, db)

    result = await db.execute(
        select(TermResult).where(
            TermResult.school_id == school.id,
            TermResult.class_id  == body.class_id,
            TermResult.term_id   == body.term_id,
            TermResult.is_computed.is_(True),
        )
    )
    results = result.scalars().all()

    if not results:
        raise HTTPException(
            404,
            "No computed results found. Run compute first."
        )

    locked_count = 0
    for r in results:
        r.is_submitted = True
        locked_count += 1

    await db.commit()
    return {
        "locked":  locked_count,
        "message": f"Locked {locked_count} results. "
                   f"Students can now view results in portal.",
    }


# ══════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════

async def _get_assessment(
    assessment_id: UUID, school_id: UUID, db: AsyncSession
) -> Assessment:
    result = await db.execute(
        select(Assessment).where(
            Assessment.id == assessment_id,
            Assessment.school_id == school_id,
        )
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Assessment not found")
    return a


async def _get_category(
    category_id: UUID, school_id: UUID, db: AsyncSession
) -> AssessmentCategory:
    result = await db.execute(
        select(AssessmentCategory).where(
            AssessmentCategory.id == category_id,
            AssessmentCategory.school_id == school_id,
            AssessmentCategory.is_active.is_(True),
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Assessment category not found")
    return c


async def _get_term(term_id: UUID, school_id: UUID, db: AsyncSession) -> Term:
    result = await db.execute(
        select(Term).where(Term.id == term_id, Term.school_id == school_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Term not found")
    return t




async def _get_scale(
    scale_id: UUID, school_id: UUID, db: AsyncSession
) -> GradingScale:
    result = await db.execute(
        select(GradingScale).where(
            GradingScale.id == scale_id,
            GradingScale.school_id == school_id,
        )
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Grading scale not found")
    return s


def _get_scale_name(class_: Class) -> str:
    """Determine which grading scale to use based on class level."""
    if not class_:
        return "Primary GES"
    if class_.level_group == "shs":
        return "WASSCE"
    if class_.level_group == "basic" and class_.level_number in [7, 8, 9]:
        return "BECE"
    if class_.level_group in ("preschool", "kg"):
        return "KG / Nursery"
    return "Primary GES"


def _compute_ca_score(
    student_id: UUID,
    assessments: list,
    categories: dict,
    scores_map: dict,
) -> Optional[Decimal]:
    """
    Compute weighted CA score for one student.

    scores_map: pre-fetched {(student_id, assessment_id): AssessmentScore}

    BECE/WASSCE logic:
      Average all instances within each category, then apply that category's weight.
      Total = sum of weighted category averages (out of 100).
    """
    by_category: dict = {}
    for assessment in assessments:
        by_category.setdefault(assessment.category_id, []).append(assessment)

    total_weighted = Decimal("0")
    total_weight   = Decimal("0")

    for cat_id, cat_assessments in by_category.items():
        category = categories.get(cat_id)
        if not category:
            continue

        scores = []
        for assessment in cat_assessments:
            score_record = scores_map.get((student_id, assessment.id))
            if score_record and not score_record.is_absent and score_record.score is not None:
                pct = (score_record.score / assessment.max_score) * 100
                scores.append(pct)

        if not scores:
            continue

        avg = sum(scores) / len(scores)
        weighted = (avg / 100) * category.weight
        total_weighted += weighted  # already Decimal — no str round-trip needed
        total_weight   += category.weight

    if total_weight == 0:
        return None

    return round(total_weighted, 2)


def _apply_grading_scale(
    score: Optional[Decimal],
    scale: Optional[GradingScale],
) -> tuple:
    """Returns (grade_label, remark) for a given score."""
    if score is None:
        return None, None
    if not scale or not scale.bands:
        return None, None

    for band in scale.bands:
        if band.min_score <= score <= band.max_score:
            return band.grade_label, band.remark

    return None, None
