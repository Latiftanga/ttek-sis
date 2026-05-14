from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, CurrentSchool, DB, require_roles
from app.models.user import User

# Convenience alias — write endpoints in this router are restricted to admins.
WriteRole = Annotated[User, Depends(require_roles("school_admin", "headteacher"))]
from app.models.academic import AcademicYear, Term, Class, Subject
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.models.programme import SchoolProgramme, SystemProgramme
from app.schemas.academic import (
    AcademicYearCreate, AcademicYearUpdate, AcademicYearResponse,
    TermCreate, TermUpdate, TermResponse,
    ClassCreate, ClassUpdate, ClassResponse,
    SubjectCreate, SubjectUpdate, SubjectResponse,
    EnrollmentCreate, EnrollmentResponse,
    PromoteRequest, RepeatRequest,
    TransferRequest, GraduateRequest,
    BulkPromoteRequest, BulkPromoteResponse,
    ClassStudentResponse,
)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════
# ACADEMIC YEARS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/academic-years", response_model=List[AcademicYearResponse])
async def list_academic_years(user: CurrentUser, school: CurrentSchool, db: DB):
    result = await db.execute(
        select(AcademicYear)
        .where(AcademicYear.school_id == school.id)
        .order_by(AcademicYear.start_date.desc())
    )
    return result.scalars().all()


@router.post("/academic-years", response_model=AcademicYearResponse, status_code=201)
async def create_academic_year(
    body: AcademicYearCreate,
    _: WriteRole,
    school: CurrentSchool,
    db: DB,
):
    exists = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == school.id,
            AcademicYear.name == body.name,
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(409, f"Academic year '{body.name}' already exists")

    if body.is_current:
        await _unset_current_year(school.id, db)

    year = AcademicYear(
        school_id=school.id,
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
    )
    db.add(year)
    await db.commit()
    await db.refresh(year)
    return year


@router.patch("/academic-years/{year_id}", response_model=AcademicYearResponse)
async def update_academic_year(
    year_id: UUID, body: AcademicYearUpdate,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    year = await _get_year(year_id, school.id, db)
    if body.is_current is True:
        await _unset_current_year(school.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(year, field, value)
    await db.commit()
    await db.refresh(year)
    return year


@router.post("/academic-years/{year_id}/set-current", response_model=AcademicYearResponse)
async def set_current_year(
    year_id: UUID, _: WriteRole, school: CurrentSchool, db: DB,
):
    year = await _get_year(year_id, school.id, db)
    await _unset_current_year(school.id, db)
    year.is_current = True
    await db.commit()
    await db.refresh(year)
    return year


# ══════════════════════════════════════════════════════════════════════════
# TERMS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/academic-years/{year_id}/terms", response_model=List[TermResponse])
async def list_terms(
    year_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    await _get_year(year_id, school.id, db)
    result = await db.execute(
        select(Term)
        .where(Term.school_id == school.id, Term.academic_year_id == year_id)
        .order_by(Term.start_date)
    )
    return result.scalars().all()


@router.post("/academic-years/{year_id}/terms", response_model=TermResponse, status_code=201)
async def create_term(
    year_id: UUID, body: TermCreate,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    year = await _get_year(year_id, school.id, db)

    if body.start_date < year.start_date or body.end_date > year.end_date:
        raise HTTPException(
            400,
            f"Term dates must be within academic year ({year.start_date} to {year.end_date})",
        )

    exists = await db.execute(
        select(Term).where(
            Term.school_id == school.id,
            Term.academic_year_id == year_id,
            Term.name == body.name,
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(409, f"'{body.name}' already exists for this academic year")

    if body.is_current:
        await _unset_current_term(school.id, db)

    term = Term(
        school_id=school.id,
        academic_year_id=year_id,
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
    )
    db.add(term)
    await db.commit()
    await db.refresh(term)
    return term


@router.patch("/terms/{term_id}", response_model=TermResponse)
async def update_term(
    term_id: UUID, body: TermUpdate,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    term = await _get_term(term_id, school.id, db)
    if body.is_current is True:
        await _unset_current_term(school.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(term, field, value)
    await db.commit()
    await db.refresh(term)
    return term


@router.post("/terms/{term_id}/set-current", response_model=TermResponse)
async def set_current_term(
    term_id: UUID, _: WriteRole, school: CurrentSchool, db: DB,
):
    term = await _get_term(term_id, school.id, db)
    await _unset_current_term(school.id, db)
    term.is_current = True
    await db.commit()
    await db.refresh(term)
    return term


# ══════════════════════════════════════════════════════════════════════════
# CLASSES
# ══════════════════════════════════════════════════════════════════════════

@router.get("/classes", response_model=List[ClassResponse])
async def list_classes(
    user: CurrentUser, school: CurrentSchool, db: DB,
    level_group: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    query = (
        select(Class)
        .options(selectinload(Class.class_teacher))
        .where(Class.school_id == school.id)
    )
    if level_group:
        query = query.where(Class.level_group == level_group)
    if is_active is not None:
        query = query.where(Class.is_active == is_active)
    query = query.order_by(Class.level_group, Class.level_number, Class.stream)
    result = await db.execute(query)
    classes = result.scalars().all()

    out = []
    for c in classes:
        data = ClassResponse.model_validate(c)
        if c.class_teacher:
            data.class_teacher_name = (
                f"{c.class_teacher.first_name} {c.class_teacher.last_name}"
            )
        out.append(data)
    return out


@router.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
):
    result = await db.execute(
        select(Class)
        .options(selectinload(Class.class_teacher))
        .where(Class.id == class_id, Class.school_id == school.id)
    )
    class_ = result.scalar_one_or_none()
    if not class_:
        raise HTTPException(404, "Class not found")
    data = ClassResponse.model_validate(class_)
    if class_.class_teacher:
        data.class_teacher_name = (
            f"{class_.class_teacher.first_name} {class_.class_teacher.last_name}"
        )
    return data


@router.post("/classes", response_model=ClassResponse, status_code=201)
async def create_class(
    body: ClassCreate, _: WriteRole, school: CurrentSchool, db: DB,
):
    if body.level_group not in school.available_level_groups:
        raise HTTPException(
            400,
            f"School type '{school.school_type}' cannot have '{body.level_group}' classes. "
            f"Allowed: {school.available_level_groups}",
        )

    if body.programme:
        # Frontend posts either the programme name ("Science") or its short
        # code ("SCI") — match against either column. Check school-specific
        # programmes first, then fall back to GES system programmes.
        prog_res = await db.execute(
            select(SchoolProgramme).where(
                SchoolProgramme.school_id == school.id,
                (SchoolProgramme.name == body.programme)
                | (SchoolProgramme.short_name == body.programme),
                SchoolProgramme.is_active.is_(True),
            )
        )
        if not prog_res.scalar_one_or_none():
            sys_res = await db.execute(
                select(SystemProgramme).where(
                    (SystemProgramme.name == body.programme)
                    | (SystemProgramme.short_name == body.programme),
                    SystemProgramme.is_active.is_(True),
                )
            )
            if not sys_res.scalar_one_or_none():
                raise HTTPException(
                    400,
                    f"Programme '{body.programme}' not found. "
                    "Use a GES standard programme or add it in school settings.",
                )

    name = Class.generate_name(
        body.level_group, body.level_number, body.stream, body.programme,
    )

    exists = await db.execute(
        select(Class).where(Class.school_id == school.id, Class.name == name)
    )
    if exists.scalar_one_or_none():
        raise HTTPException(409, f"Class '{name}' already exists in this school")

    class_ = Class(
        school_id=school.id,
        level_group=body.level_group,
        level_number=body.level_number,
        stream=body.stream,
        programme=body.programme,
        name=name,
        class_teacher_id=body.class_teacher_id,
        capacity=body.capacity,
    )
    db.add(class_)
    await db.commit()
    await db.refresh(class_)
    return class_


@router.patch("/classes/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: UUID, body: ClassUpdate,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    class_ = await _get_class(class_id, school.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(class_, field, value)
    await db.commit()
    await db.refresh(class_)
    return class_


@router.get("/classes/{class_id}/students", response_model=List[ClassStudentResponse])
async def get_class_students(
    class_id: UUID, user: CurrentUser, school: CurrentSchool, db: DB,
    academic_year_id: Optional[UUID] = Query(None),
):
    if not academic_year_id:
        year_res = await db.execute(
            select(AcademicYear).where(
                AcademicYear.school_id == school.id,
                AcademicYear.is_current.is_(True),
            )
        )
        year = year_res.scalar_one_or_none()
        if not year:
            raise HTTPException(404, "No current academic year set")
        academic_year_id = year.id

    result = await db.execute(
        select(Enrollment)
        .options(selectinload(Enrollment.student))
        .where(
            Enrollment.school_id == school.id,
            Enrollment.class_id == class_id,
            Enrollment.academic_year_id == academic_year_id,
            Enrollment.status == "active",
        )
    )
    enrollments = result.scalars().all()
    return [
        {
            "enrollment_id":  str(e.id),
            "student_id":     str(e.student.id),
            "student_number": e.student.student_number,
            "first_name":     e.student.first_name,
            "middle_name":    e.student.middle_name,
            "last_name":      e.student.last_name,
            "gender":         e.student.gender,
            "is_boarding":    e.is_boarding,
        }
        for e in enrollments
    ]


# ══════════════════════════════════════════════════════════════════════════
# SUBJECTS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/subjects", response_model=List[SubjectResponse])
async def list_subjects(
    user: CurrentUser, school: CurrentSchool, db: DB,
    level_group: Optional[str] = Query(None),
):
    query = select(Subject).where(Subject.school_id == school.id)
    if level_group:
        query = query.where(
            (Subject.level_group == level_group) | (Subject.level_group == "all")
        )
    result = await db.execute(query.order_by(Subject.name))
    return result.scalars().all()


@router.post("/subjects", response_model=SubjectResponse, status_code=201)
async def create_subject(
    body: SubjectCreate, _: WriteRole, school: CurrentSchool, db: DB,
):
    exists = await db.execute(
        select(Subject).where(
            Subject.school_id == school.id,
            Subject.name == body.name,
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(409, f"Subject '{body.name}' already exists")

    subject = Subject(
        school_id=school.id,
        name=body.name,
        code=body.code,
        category=body.category,
        level_group=body.level_group,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.patch("/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: UUID, body: SubjectUpdate,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    result = await db.execute(
        select(Subject).where(
            Subject.id == subject_id, Subject.school_id == school.id,
        )
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(404, "Subject not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: UUID,
    _: Annotated[User, Depends(require_roles("school_admin"))],
    school: CurrentSchool, db: DB,
):
    result = await db.execute(
        select(Subject).where(
            Subject.id == subject_id, Subject.school_id == school.id,
        )
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(404, "Subject not found")
    await db.delete(subject)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# ENROLLMENTS
# ══════════════════════════════════════════════════════════════════════════

@router.post("/enrollments", response_model=EnrollmentResponse, status_code=201)
async def enroll_student(
    body: EnrollmentCreate, _: WriteRole, school: CurrentSchool, db: DB,
):
    await _get_student(body.student_id, school.id, db)
    class_ = await _get_class(body.class_id, school.id, db)
    if not class_.is_active:
        raise HTTPException(400, "Class is inactive")
    await _get_year(body.academic_year_id, school.id, db)

    exists = await db.execute(
        select(Enrollment).where(
            Enrollment.school_id == school.id,
            Enrollment.student_id == body.student_id,
            Enrollment.academic_year_id == body.academic_year_id,
            Enrollment.status == "active",
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(409, "Student is already enrolled for this academic year")

    enrollment = Enrollment(
        school_id=school.id,
        student_id=body.student_id,
        class_id=body.class_id,
        academic_year_id=body.academic_year_id,
        start_date=body.start_date,
        is_boarding=body.is_boarding,
        notes=body.notes,
        status="active",
    )
    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)
    return enrollment


@router.patch("/enrollments/{enrollment_id}/promote", response_model=EnrollmentResponse)
async def promote_student(
    enrollment_id: UUID, body: PromoteRequest,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    enrollment = await _get_enrollment(enrollment_id, school.id, db)
    if enrollment.status != "active":
        raise HTTPException(400, f"Cannot promote — status is '{enrollment.status}'")

    await _get_class(body.to_class_id, school.id, db)
    await _get_year(body.academic_year_id, school.id, db)

    exists = await db.execute(
        select(Enrollment).where(
            Enrollment.school_id == school.id,
            Enrollment.student_id == enrollment.student_id,
            Enrollment.academic_year_id == body.academic_year_id,
            Enrollment.status == "active",
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(409, "Student already has an active enrollment for this year")

    enrollment.status = "promoted"
    enrollment.end_date = body.start_date

    new_enrollment = Enrollment(
        school_id=school.id,
        student_id=enrollment.student_id,
        class_id=body.to_class_id,
        academic_year_id=body.academic_year_id,
        start_date=body.start_date,
        notes=body.notes,
        status="active",
    )
    db.add(new_enrollment)
    await db.flush()
    enrollment.promoted_to_id = new_enrollment.id
    await db.commit()
    await db.refresh(new_enrollment)
    return new_enrollment


@router.patch("/enrollments/{enrollment_id}/repeat", response_model=EnrollmentResponse)
async def repeat_student(
    enrollment_id: UUID, body: RepeatRequest,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    enrollment = await _get_enrollment(enrollment_id, school.id, db)
    if enrollment.status != "active":
        raise HTTPException(400, f"Cannot repeat — status is '{enrollment.status}'")

    await _get_year(body.academic_year_id, school.id, db)

    enrollment.status = "repeated"
    enrollment.end_date = body.start_date

    new_enrollment = Enrollment(
        school_id=school.id,
        student_id=enrollment.student_id,
        class_id=enrollment.class_id,
        academic_year_id=body.academic_year_id,
        start_date=body.start_date,
        notes=body.notes,
        status="active",
    )
    db.add(new_enrollment)
    await db.commit()
    await db.refresh(new_enrollment)
    return new_enrollment


@router.patch("/enrollments/{enrollment_id}/transfer", status_code=200)
async def transfer_student(
    enrollment_id: UUID, body: TransferRequest,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    enrollment = await _get_enrollment(enrollment_id, school.id, db)
    if enrollment.status != "active":
        raise HTTPException(400, f"Cannot transfer — status is '{enrollment.status}'")

    enrollment.status = "transferred"
    enrollment.end_date = body.end_date
    enrollment.notes = body.notes

    student = await _get_student(enrollment.student_id, school.id, db)
    student.status = "transferred"
    await db.commit()
    return {"message": "Student marked as transferred"}


@router.patch("/enrollments/{enrollment_id}/graduate", status_code=200)
async def graduate_student(
    enrollment_id: UUID, body: GraduateRequest,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    enrollment = await _get_enrollment(enrollment_id, school.id, db)
    if enrollment.status != "active":
        raise HTTPException(400, f"Cannot graduate — status is '{enrollment.status}'")

    class_ = await _get_class(enrollment.class_id, school.id, db)
    is_final = (
        (class_.level_group == "basic" and class_.level_number == 9) or
        (class_.level_group == "shs" and class_.level_number == 3)
    )
    if not is_final:
        raise HTTPException(
            400,
            f"Student is in '{class_.name}' which is not a final year class. "
            f"Final years are Basic 9 and SHS 3.",
        )

    enrollment.status = "graduated"
    enrollment.end_date = body.end_date
    enrollment.notes = body.notes

    student = await _get_student(enrollment.student_id, school.id, db)
    student.status = "graduated"
    await db.commit()
    return {"message": "Student marked as graduated"}


@router.post("/enrollments/bulk-promote", response_model=BulkPromoteResponse)
async def bulk_promote(
    body: BulkPromoteRequest, _: WriteRole, school: CurrentSchool, db: DB,
):
    await _get_class(body.from_class_id, school.id, db)
    await _get_class(body.to_class_id, school.id, db)
    await _get_year(body.academic_year_id, school.id, db)

    current_year_res = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == school.id,
            AcademicYear.is_current.is_(True),
        )
    )
    current_year = current_year_res.scalar_one_or_none()
    if not current_year:
        raise HTTPException(400, "No current academic year set")

    result = await db.execute(
        select(Enrollment).where(
            Enrollment.school_id == school.id,
            Enrollment.class_id == body.from_class_id,
            Enrollment.academic_year_id == current_year.id,
            Enrollment.status == "active",
        )
    )
    enrollments = result.scalars().all()

    # Pre-fetch all students already enrolled in the target year — one query instead of N.
    already_res = await db.execute(
        select(Enrollment.student_id).where(
            Enrollment.school_id == school.id,
            Enrollment.academic_year_id == body.academic_year_id,
            Enrollment.status == "active",
        )
    )
    already_enrolled: set = set(already_res.scalars().all())

    promoted = 0
    skipped = 0
    errors = []

    for enrollment in enrollments:
        if enrollment.student_id in body.exclude_student_ids:
            skipped += 1
            continue

        if enrollment.student_id in already_enrolled:
            errors.append(f"Student {enrollment.student_id} already enrolled in new year")
            skipped += 1
            continue

        enrollment.status = "promoted"
        enrollment.end_date = body.start_date

        new_enrollment = Enrollment(
            school_id=school.id,
            student_id=enrollment.student_id,
            class_id=body.to_class_id,
            academic_year_id=body.academic_year_id,
            start_date=body.start_date,
            status="active",
        )
        db.add(new_enrollment)
        await db.flush()
        enrollment.promoted_to_id = new_enrollment.id
        promoted += 1

    await db.commit()
    return BulkPromoteResponse(promoted=promoted, skipped=skipped, errors=errors)


# ══════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════

async def _get_year(year_id: UUID, school_id: UUID, db: AsyncSession) -> AcademicYear:
    result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.id == year_id, AcademicYear.school_id == school_id,
        )
    )
    year = result.scalar_one_or_none()
    if not year:
        raise HTTPException(404, "Academic year not found")
    return year


async def _get_term(term_id: UUID, school_id: UUID, db: AsyncSession) -> Term:
    result = await db.execute(
        select(Term).where(Term.id == term_id, Term.school_id == school_id)
    )
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(404, "Term not found")
    return term


async def _get_class(class_id: UUID, school_id: UUID, db: AsyncSession) -> Class:
    result = await db.execute(
        select(Class).where(Class.id == class_id, Class.school_id == school_id)
    )
    class_ = result.scalar_one_or_none()
    if not class_:
        raise HTTPException(404, "Class not found")
    return class_


async def _get_student(student_id: UUID, school_id: UUID, db: AsyncSession) -> Student:
    result = await db.execute(
        select(Student).where(
            Student.id == student_id, Student.school_id == school_id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "Student not found")
    return student


async def _get_enrollment(
    enrollment_id: UUID, school_id: UUID, db: AsyncSession
) -> Enrollment:
    result = await db.execute(
        select(Enrollment).where(
            Enrollment.id == enrollment_id, Enrollment.school_id == school_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(404, "Enrollment not found")
    return enrollment


async def _unset_current_year(school_id: UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(AcademicYear).where(
            AcademicYear.school_id == school_id, AcademicYear.is_current.is_(True),
        )
    )
    for year in result.scalars().all():
        year.is_current = False


async def _unset_current_term(school_id: UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(Term).where(
            Term.school_id == school_id, Term.is_current.is_(True),
        )
    )
    for term in result.scalars().all():
        term.is_current = False

