from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.dependencies import CurrentUser, CurrentSchool, DB, require_roles
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.schemas.student import (
    StudentCreate, StudentUpdate,
    StudentResponse, StudentContactCreate, StudentContactResponse
)

router = APIRouter()


# ── GET /api/students ──────────────────────────────────────────────────────

@router.get("/", response_model=List[StudentResponse])
async def list_students(
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
):
    query = select(Student).options(selectinload(Student.contacts)).where(Student.school_id == school.id)

    if search:
        query = query.where(
            Student.first_name.ilike(f"%{search}%") |
            Student.last_name.ilike(f"%{search}%") |
            Student.student_number.ilike(f"%{search}%")
        )
    if status:
        query = query.where(Student.status == status)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ── GET /api/students/{id} ─────────────────────────────────────────────────

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
):
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.contacts))
        .where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )

    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


# ── POST /api/students ─────────────────────────────────────────────────────

@router.post("/", response_model=StudentResponse, status_code=201)
async def create_student(
    body: StudentCreate,
    user: Annotated[CurrentUser, Depends(require_roles(
        "school_admin", "headteacher"
    ))],
    school: CurrentSchool,
    db: DB,
):
    # Check student number not already used in this school
    exists = await db.execute(
        select(Student).where(
            Student.school_id == school.id,
            Student.student_number == body.student_number,
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Student number '{body.student_number}' already exists",
        )

    student = Student(
        school_id=school.id,
        student_number=body.student_number,
        first_name=body.first_name,
        middle_name=body.middle_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        photo_url=body.photo_url,
        home_address=body.home_address,
        admission_date=body.admission_date,
        house=body.house,
        programme=body.programme,
    )
    db.add(student)
    await db.flush()   # get student.id before adding contacts

    # Add contacts if provided
    for c in body.contacts:
        contact = StudentContact(
            school_id=school.id,
            student_id=student.id,
            **c.model_dump(),
        )
        db.add(contact)

    await db.commit()
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.contacts))
        .where(Student.id == student.id)
    )
    return result.scalar_one()





# ── PATCH /api/students/{id} ───────────────────────────────────────────────

@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
):
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Only update fields that were actually sent
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    await db.commit()
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.contacts))
        .where(Student.id == student.id)
    )
    return result.scalar_one()


# ── DELETE /api/students/{id} ──────────────────────────────────────────────

@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: UUID,
    user: Annotated[CurrentUser, Depends(require_roles("school_admin"))],
    school: CurrentSchool,
    db: DB,
):
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    await db.delete(student)
    await db.commit()


# ── POST /api/students/{id}/contacts ──────────────────────────────────────

@router.post("/{student_id}/contacts",
             response_model=StudentContactResponse,
             status_code=201)
async def add_contact(
    student_id: UUID,
    body: StudentContactCreate,
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
):
    # Verify student belongs to this school
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == school.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    # If this is primary contact, unset any existing primary
    if body.is_primary_contact:
        existing = await db.execute(
            select(StudentContact).where(
                StudentContact.student_id == student_id,
                StudentContact.is_primary_contact == True,
            )
        )
        for c in existing.scalars().all():
            c.is_primary_contact = False

    contact = StudentContact(
        school_id=school.id,
        student_id=student_id,
        **body.model_dump(),
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact
