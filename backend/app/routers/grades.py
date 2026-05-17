from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sql_delete
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
    GradingScale, Grade,
    AssessmentCategory, Assessment,
    AssessmentScore, TermResult, ScoreEditLog,
)
from app.models.academic import AcademicYear, Class, Subject, Term
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.student_subject import StudentSubject
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.schemas.grade import (
    AssessmentCategoryCreate, AssessmentCategoryUpdate, AssessmentCategoryResponse,
    AssessmentCreate, AssessmentUpdate, AssessmentResponse,
    BulkScoreSubmit, ScoreEditRequest,
    AssessmentScoreResponse, GradebookEntry, GradebookResponse,
    ScoreEditLogResponse,
    ComputeTermResultsRequest, LockTermResultsRequest, TermResultResponse, StudentTermReport,
    GradingScaleCreate, GradingScaleUpdate,
    GradeCreate, GradeUpdate, GradingScaleResponse,
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
        .options(selectinload(GradingScale.grades))
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


@router.post("/grading-scales/{scale_id}/grades", status_code=201)
async def add_grade(
    scale_id: UUID, body: GradeCreate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Add a grade to a school's custom grading scale."""
    scale = await _get_scale(scale_id, school.id, db)

    # Validate no overlap with existing grades
    existing = await db.execute(
        select(Grade).where(Grade.scale_id == scale_id)
    )
    for grade in existing.scalars().all():
        if not (body.max_score <= grade.min_score or body.min_score >= grade.max_score):
            raise HTTPException(
                400,
                f"Score range {body.min_score}-{body.max_score} overlaps "
                f"with existing grade {grade.min_score}-{grade.max_score} ({grade.label})"
            )

    grade = Grade(
        scale_id=scale_id,
        min_score=body.min_score,
        max_score=body.max_score,
        label=body.label,
        remark=body.remark,
        order=body.order,
    )
    db.add(grade)
    await db.commit()
    await db.refresh(grade)
    return grade


@router.patch("/grading-scales/{scale_id}", response_model=GradingScaleResponse)
async def update_grading_scale(
    scale_id: UUID, body: GradingScaleUpdate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Edit a school's own scale. System defaults are read-only."""
    scale = await _get_scale(scale_id, school.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(scale, field, value)
    await db.commit()
    await db.refresh(scale)
    # Reload grades for the response
    await db.refresh(scale, attribute_names=["grades"])
    return scale


@router.delete("/grading-scales/{scale_id}", status_code=204)
async def delete_grading_scale(
    scale_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Delete a school's own scale. Grades cascade-delete."""
    scale = await _get_scale(scale_id, school.id, db)
    await db.delete(scale)
    await db.commit()


@router.patch("/grading-scales/{scale_id}/grades/{grade_id}")
async def update_grade(
    scale_id: UUID, grade_id: UUID, body: GradeUpdate,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Edit a grade within a school's own scale."""
    scale = await _get_scale(scale_id, school.id, db)
    grade_res = await db.execute(
        select(Grade).where(Grade.id == grade_id, Grade.scale_id == scale.id)
    )
    grade = grade_res.scalar_one_or_none()
    if not grade:
        raise HTTPException(404, "Grade not found in this scale")

    # If the range is being changed, re-check overlap against sibling grades
    new_min = body.min_score if body.min_score is not None else grade.min_score
    new_max = body.max_score if body.max_score is not None else grade.max_score
    if new_min != grade.min_score or new_max != grade.max_score:
        siblings = await db.execute(
            select(Grade).where(
                Grade.scale_id == scale.id,
                Grade.id != grade.id,
            )
        )
        for other in siblings.scalars().all():
            if not (new_max <= other.min_score or new_min >= other.max_score):
                raise HTTPException(
                    400,
                    f"Score range {new_min}-{new_max} overlaps with "
                    f"existing grade {other.min_score}-{other.max_score} ({other.label})",
                )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(grade, field, value)
    await db.commit()
    await db.refresh(grade)
    return grade


@router.delete("/grading-scales/{scale_id}/grades/{grade_id}", status_code=204)
async def delete_grade(
    scale_id: UUID, grade_id: UUID,
    user: CurrentUser, school: CurrentSchool, db: DB,
):
    """Delete one grade from a school's own scale."""
    scale = await _get_scale(scale_id, school.id, db)
    grade_res = await db.execute(
        select(Grade).where(Grade.id == grade_id, Grade.scale_id == scale.id)
    )
    grade = grade_res.scalar_one_or_none()
    if not grade:
        raise HTTPException(404, "Grade not found in this scale")
    await db.delete(grade)
    await db.commit()


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
    """
    Hard-delete a category when nothing references it. Schools that want to
    retire a category they've used should PATCH `is_active=False` instead.
    """
    category = await _get_category(category_id, school.id, db)
    used = await db.execute(
        select(func.count(Assessment.id)).where(
            Assessment.category_id == category_id
        )
    )
    if (used.scalar() or 0) > 0:
        raise HTTPException(
            400,
            "Cannot delete — assessments exist using this category. "
            "Deactivate it instead.",
        )
    await db.delete(category)
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
    term = await _get_term(body.term_id, school.id, db)

    # Assessment date must fall within the chosen term — otherwise the
    # gradebook roster (which filters by term.end_date) becomes inconsistent.
    if body.date_administered is not None and not (
        term.start_date <= body.date_administered <= term.end_date
    ):
        raise HTTPException(
            400,
            f"Assessment date {body.date_administered} is outside the term "
            f"'{term.name}' ({term.start_date} to {term.end_date}). "
            f"Pick a date within the term, or choose a different term."
        )

    # Validate max_score doesn't exceed category max
    if body.max_score > category.max_score:
        raise HTTPException(
            400,
            f"max_score {body.max_score} exceeds category maximum of {category.max_score}"
        )

    # For categories allowing multiple instances: prevent same category on the same date.
    if category.allows_multiple and body.date_administered is not None:
        dup = await db.execute(
            select(Assessment.id).where(
                Assessment.school_id      == school.id,
                Assessment.class_id       == body.class_id,
                Assessment.subject_id     == body.subject_id,
                Assessment.term_id        == body.term_id,
                Assessment.category_id    == body.category_id,
                Assessment.date_administered == body.date_administered,
            ).limit(1)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                409,
                f"A '{category.name}' assessment on "
                f"{body.date_administered.strftime('%d/%m/%Y')} already exists "
                f"for this class and subject.",
            )

    # For categories that only allow one per term: prevent any second one.
    if not category.allows_multiple:
        exists = await db.execute(
            select(Assessment.id).where(
                Assessment.school_id   == school.id,
                Assessment.category_id == body.category_id,
                Assessment.class_id    == body.class_id,
                Assessment.subject_id  == body.subject_id,
                Assessment.term_id     == body.term_id,
            ).limit(1)
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
        description=body.description,
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

    # If the date is being changed, re-validate it falls within the term and
    # doesn't collide with another assessment of the same category on that date.
    if body.date_administered is not None and body.date_administered != assessment.date_administered:
        term = await _get_term(assessment.term_id, school.id, db)
        if not (term.start_date <= body.date_administered <= term.end_date):
            raise HTTPException(
                400,
                f"Assessment date {body.date_administered} is outside the term "
                f"'{term.name}' ({term.start_date} to {term.end_date}). "
                f"Pick a date within the term."
            )
        dup = await db.execute(
            select(Assessment.id).where(
                Assessment.school_id      == school.id,
                Assessment.class_id       == assessment.class_id,
                Assessment.subject_id     == assessment.subject_id,
                Assessment.term_id        == assessment.term_id,
                Assessment.category_id    == assessment.category_id,
                Assessment.date_administered == body.date_administered,
                Assessment.id             != assessment.id,
            ).limit(1)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                409,
                f"Another assessment of the same type already exists on "
                f"{body.date_administered.strftime('%d/%m/%Y')} for this class and subject.",
            )

    # Reject max_score reductions that would drop below an existing score
    new_max = body.model_dump(exclude_unset=True).get("max_score")
    if new_max is not None and new_max < assessment.max_score:
        highest_res = await db.execute(
            select(func.max(AssessmentScore.score)).where(
                AssessmentScore.assessment_id == assessment_id,
                AssessmentScore.score.isnot(None),
            )
        )
        highest = highest_res.scalar_one_or_none()
        if highest is not None and highest > new_max:
            raise HTTPException(
                409,
                f"Cannot reduce max score to {new_max}: a student already has a score of {highest}. "
                "Edit or clear that score first.",
            )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(assessment, field, value)
    await db.commit()
    await db.refresh(assessment)
    return assessment


@router.delete("/{assessment_id}", status_code=204)
async def delete_assessment(
    assessment_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    """
    Delete a draft assessment along with its scores and any draft edit logs.
    Published assessments must be unpublished first — this protects the
    audit trail from accidental wipes.
    """
    assessment = await _get_assessment(assessment_id, school.id, db)
    if assessment.is_published:
        raise HTTPException(
            400,
            "Cannot delete a published assessment. Unpublish it first.",
        )

    # Wipe edit logs for this assessment's scores before the cascade fires —
    # ScoreEditLog has no ondelete cascade so an orphan FK would block us.
    # Safe because the assessment was never published, so nothing of audit
    # value lives in these logs yet.
    score_ids_subq = select(AssessmentScore.id).where(
        AssessmentScore.assessment_id == assessment_id,
    )
    await db.execute(
        sql_delete(ScoreEditLog).where(
            ScoreEditLog.assessment_score_id.in_(score_ids_subq),
        )
    )

    # Scores cascade-delete via the Assessment.scores relationship.
    await db.delete(assessment)
    await db.commit()


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

    # Determine if this is an elective subject so we can filter to only
    # students who selected it. Electives are an SHS-only concept; for any
    # other school type, every enrolled student takes every subject.
    subject_res = await db.execute(
        select(Subject).where(Subject.id == assessment.subject_id)
    )
    subject = subject_res.scalar_one_or_none()
    is_elective = (
        subject is not None
        and subject.category == "elective"
        and school.school_type == "shs"
    )

    # Base enrollment query: all active students in this class for the year
    # the assessment's term belongs to.
    # We intentionally omit the start_date filter — schools often enrol
    # students retroactively when first setting up the SIS, so a student
    # enrolled today must still appear in a term that ended last month.
    enrollment_q = (
        select(Enrollment)
        .options(selectinload(Enrollment.student))
        .where(
            Enrollment.school_id == school.id,
            Enrollment.class_id == assessment.class_id,
            Enrollment.academic_year_id == term.academic_year_id,
            Enrollment.status == "active",
        )
        .order_by(Enrollment.student_id)
    )
    if is_elective:
        # Only inner-join StudentSubject when elective assignments already
        # exist for this class+subject. If none exist yet, fall back to all
        # enrolled students so teachers aren't blocked from entering scores.
        has_assignments_res = await db.execute(
            select(StudentSubject.id).where(
                StudentSubject.subject_id == assessment.subject_id,
                StudentSubject.enrollment_id.in_(
                    select(Enrollment.id).where(
                        Enrollment.school_id == school.id,
                        Enrollment.class_id == assessment.class_id,
                        Enrollment.academic_year_id == term.academic_year_id,
                        Enrollment.status == "active",
                    )
                ),
            ).limit(1)
        )
        if has_assignments_res.scalar_one_or_none():
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
    assessment_id: UUID, body: BulkScoreSubmit, response: Response,
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

    # Once term results are locked, only headteacher/admin may push score changes
    # through any path — including bulk submit. Otherwise a teacher could bypass
    # the single-edit lock check by using the bulk endpoint.
    term_res = await db.execute(
        select(TermResult).where(
            TermResult.school_id  == school.id,
            TermResult.subject_id == assessment.subject_id,
            TermResult.class_id   == assessment.class_id,
            TermResult.term_id    == assessment.term_id,
            TermResult.is_submitted.is_(True),
        ).limit(1)
    )
    term_locked = term_res.scalar_one_or_none() is not None

    if term_locked and user.role not in ("headteacher", "school_admin", "superadmin"):
        raise HTTPException(
            403,
            "Term results are locked. Contact the headteacher for corrections.",
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
                if assessment.is_published and not record.reason:
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
                existing.edit_reason = record.reason

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
                    reason=record.reason,
                    is_after_submission=assessment.is_published,
                    is_after_lock=term_locked,
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

    # If some records succeeded and others failed, signal that with 207
    # Multi-Status so clients can branch on status rather than parsing the
    # body. Full success keeps the standard 201.
    if errors and (saved or updated):
        response.status_code = 207
    elif errors and not (saved or updated):
        # Everything failed validation → 400 is more appropriate than 201
        response.status_code = 400

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

    # Pull all edit logs for this school (optionally narrowed to one term),
    # then compute flags in Python. Filtering by is_after_submission in SQL
    # hides edits whose suspicious signal is "outside hours" or ">2 edits"
    # but happened pre-publication.
    query = (
        select(ScoreEditLog, AssessmentScore, Assessment)
        .join(AssessmentScore,
              ScoreEditLog.assessment_score_id == AssessmentScore.id)
        .join(Assessment,
              AssessmentScore.assessment_id == Assessment.id)
        .where(ScoreEditLog.school_id == school.id)
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
        if log.is_after_lock:
            flags.append("edited_after_term_lock")
        if log.changed_at_hour is not None and (
            log.changed_at_hour < 6 or log.changed_at_hour >= 21
        ):
            flags.append("edited_outside_school_hours")
        if (score.edit_count or 0) > 2:
            flags.append("edited_more_than_twice")

        if not flags:
            continue  # routine edit — skip

        suspicious.append({
            "assessment_id":  str(assessment.id),
            "student_id":     str(score.student_id),
            "changed_by":     str(log.changed_by),
            "changed_at":     log.changed_at.isoformat(),
            "old_score":      float(log.old_score) if log.old_score is not None else None,
            "new_score":      float(log.new_score) if log.new_score is not None else None,
            "reason":         log.reason,
            "flags":          flags,
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

    # Get subjects to compute. Only published assessments count toward term
    # results — drafts represent in-progress score entry and shouldn't
    # silently affect totals.
    if body.subject_id:
        subject_ids = [body.subject_id]
    else:
        subjects_res = await db.execute(
            select(Assessment.subject_id).distinct().where(
                Assessment.school_id   == school.id,
                Assessment.class_id    == body.class_id,
                Assessment.term_id     == body.term_id,
                Assessment.is_published.is_(True),
            )
        )
        subject_ids = [row[0] for row in subjects_res.all()]

    if not subject_ids:
        raise HTTPException(
            404,
            "No published assessments found for this class and term. "
            "Publish at least one assessment before computing results.",
        )

    # All active enrollments for this class and year (no start_date filter —
    # retroactively enrolled students must be included in computed results).
    enrollments_res = await db.execute(
        select(Enrollment).where(
            Enrollment.school_id == school.id,
            Enrollment.class_id  == body.class_id,
            Enrollment.academic_year_id == term.academic_year_id,
            Enrollment.status    == "active",
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

    # Weights must total 100 for raw_score to be out of 100. Anything else
    # silently under-scores every student (e.g. weights summing to 80 cap a
    # perfect student at 80 → graded B2 on WASSCE). Fail loudly so the school
    # fixes the setup rather than discovering wrong grades on report cards.
    total_weight = sum((c.weight for c in categories.values()), Decimal("0"))
    if total_weight != 100:
        raise HTTPException(
            400,
            f"Assessment category weights must total 100% (currently {total_weight}%). "
            "Adjust weights in Settings → Assessment modes before computing results.",
        )

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

    # School's own scale wins over the system default of the same name.
    # nulls_last puts school_id = school.id first, then the system row as fallback.
    scale_res = await db.execute(
        select(GradingScale)
        .options(selectinload(GradingScale.grades))
        .where(
            GradingScale.name == scale_name,
            (GradingScale.school_id == school.id) | (GradingScale.school_id.is_(None)),
        )
        .order_by(GradingScale.school_id.nulls_last())
    )
    scale = scale_res.scalars().first()

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

        # Get all published assessments for this subject + class + term
        assessments_res = await db.execute(
            select(Assessment).where(
                Assessment.school_id   == school.id,
                Assessment.class_id    == body.class_id,
                Assessment.subject_id  == subject_id,
                Assessment.term_id     == body.term_id,
                Assessment.is_published.is_(True),
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

        # Compute CA and Exam contributions per student (no DB calls).
        student_totals = {
            sid: _compute_term_totals(sid, assessments, categories, scores_map)
            for sid in student_ids
        }

        def _raw(totals: tuple[Optional[Decimal], Optional[Decimal]]) -> Optional[Decimal]:
            ca, ex = totals
            if ca is None and ex is None:
                return None
            return (ca or Decimal("0")) + (ex or Decimal("0"))

        # Rank by raw_score descending
        ranked = sorted(
            [(sid, _raw(t)) for sid, t in student_totals.items() if _raw(t) is not None],
            key=lambda x: x[1],
            reverse=True,
        )
        positions = {sid: pos for pos, (sid, _) in enumerate(ranked, 1)}

        # Persist TermResult per student
        for student_id in student_ids:
            ca_score, exam_score = student_totals[student_id]
            raw_score = _raw((ca_score, exam_score))
            grade, remark = _apply_grading_scale(raw_score, scale)

            existing = existing_map.get(student_id)
            if existing:
                if existing.is_submitted:
                    continue  # locked — skip
                existing.raw_score   = raw_score
                existing.ca_score    = ca_score
                existing.exam_score  = exam_score
                existing.grade       = grade
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
                    exam_score=exam_score,
                    grade=grade,
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
    student_res = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    student = student_res.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "Student not found")

    # Resolve term — given term_id wins, else fall back to the current term.
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

    # Academic year comes from the term, not the school's current year. A
    # report card for last year's Term 1 should display *that* year's class,
    # not whichever class the student is enrolled in today.
    year_res = await db.execute(
        select(AcademicYear).where(AcademicYear.id == term.academic_year_id)
    )
    year = year_res.scalar_one_or_none()

    enrollment_res = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == student_id,
            Enrollment.school_id  == school.id,
            Enrollment.academic_year_id == term.academic_year_id,
            Enrollment.status     == "active",
        )
    )
    enrollment = enrollment_res.scalar_one_or_none()
    class_name = "Unknown"
    class_id = None
    if enrollment:
        class_id = enrollment.class_id
        class_res = await db.execute(
            select(Class).where(Class.id == enrollment.class_id)
        )
        cls = class_res.scalar_one_or_none()
        if cls:
            class_name = cls.name

    # This student's per-subject TermResults
    results_res = await db.execute(
        select(TermResult).where(
            TermResult.school_id  == school.id,
            TermResult.student_id == student_id,
            TermResult.term_id    == term_id,
        )
    )
    results = results_res.scalars().all()

    total_score = sum(
        (r.raw_score for r in results if r.raw_score is not None),
        Decimal("0"),
    )
    if not any(r.raw_score is not None for r in results):
        total_score = None

    # Overall position — rank every student in the same class+term by their
    # sum of raw_scores across subjects, then find this student's spot.
    overall_position = None
    if class_id is not None:
        peer_res = await db.execute(
            select(TermResult.student_id, func.sum(TermResult.raw_score))
            .where(
                TermResult.school_id == school.id,
                TermResult.class_id  == class_id,
                TermResult.term_id   == term_id,
                TermResult.is_computed.is_(True),
            )
            .group_by(TermResult.student_id)
        )
        peer_totals = [
            (sid, total) for sid, total in peer_res.all() if total is not None
        ]
        ranked = sorted(peer_totals, key=lambda x: x[1], reverse=True)
        for pos, (sid, _) in enumerate(ranked, 1):
            if sid == student_id:
                overall_position = pos
                break

    # Attendance percentage — same definition as /attendance/student/{id}/summary:
    # (present + late) / submitted-session records this term. None when no
    # attendance was taken (signals "no data", not 0%).
    att_res = await db.execute(
        select(AttendanceRecord.status)
        .join(AttendanceSession,
              AttendanceRecord.session_id == AttendanceSession.id)
        .where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.school_id  == school.id,
            AttendanceSession.term_id   == term_id,
            AttendanceSession.status    == "submitted",
        )
    )
    statuses = [row[0] for row in att_res.all()]
    total_sessions = len(statuses)
    attendance_pct: Optional[Decimal] = None
    if total_sessions > 0:
        attended = sum(1 for s in statuses if s in ("present", "late"))
        attendance_pct = Decimal(str(round(attended / total_sessions * 100, 2)))

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
        total_score=total_score,
        overall_position=overall_position,
        attendance_pct=attendance_pct,
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


def _compute_term_totals(
    student_id: UUID,
    assessments: list,
    categories: dict,
    scores_map: dict,
) -> tuple[Optional[Decimal], Optional[Decimal]]:
    """
    Compute (ca_total, exam_total) for one student in one subject.

    Buckets contributions by `AssessmentCategory.is_ca` so the report card can
    show CA and Exam separately (the standard Ghanaian convention).

    For each category:
      - average all assessment instances in that category as percentages
      - multiply by category.weight (already a fraction of the whole 100)
      - add to the matching bucket

    The buckets are independent — if CA categories sum to 50 weight, a perfect
    CA student scores 50 in ca_total. Same for exam_total. raw_score is left
    to the caller (typically ca_total + exam_total).

    Returns None for a bucket that has no scored assessments at all.
    """
    by_category: dict = {}
    for assessment in assessments:
        by_category.setdefault(assessment.category_id, []).append(assessment)

    ca_total       = Decimal("0")
    exam_total     = Decimal("0")
    ca_has_scores  = False
    exam_has_scores = False

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
        contribution = (avg / 100) * category.weight

        if category.is_ca:
            ca_total += contribution
            ca_has_scores = True
        else:
            exam_total += contribution
            exam_has_scores = True

    return (
        round(ca_total, 2) if ca_has_scores else None,
        round(exam_total, 2) if exam_has_scores else None,
    )


def _apply_grading_scale(
    score: Optional[Decimal],
    scale: Optional[GradingScale],
) -> tuple:
    """Returns (label, remark) for a given score.

    Walks grades by descending min_score so the first grade whose floor the
    score clears wins. This protects against gappy seeds like 70-74, 75-100:
    a score of 74.5 (>= 70) still resolves to the 70-74 band.
    """
    if score is None:
        return None, None
    if not scale or not scale.grades:
        return None, None

    for g in sorted(scale.grades, key=lambda x: x.min_score, reverse=True):
        if score >= g.min_score:
            return g.label, g.remark

    return None, None
