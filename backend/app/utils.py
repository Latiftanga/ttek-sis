"""Shared guard helpers — tenant boundary checks used across multiple routers."""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.models.academic import Class, Subject, Term
from app.models.student import Student


async def assert_class_in_school(
    class_id: UUID, school_id: UUID, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Class.id).where(Class.id == class_id, Class.school_id == school_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Class not found")


async def assert_term_in_school(
    term_id: UUID, school_id: UUID, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Term.id).where(Term.id == term_id, Term.school_id == school_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Term not found")


async def assert_subject_in_school(
    subject_id: UUID, school_id: UUID, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Subject.id).where(
            Subject.id == subject_id,
            Subject.school_id == school_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Subject not found")


async def assert_students_in_school(
    student_ids: list[UUID], school_id: UUID, db: AsyncSession
) -> None:
    if not student_ids:
        return
    unique_ids = list(set(student_ids))
    result = await db.execute(
        select(func.count(Student.id)).where(
            Student.id.in_(unique_ids),
            Student.school_id == school_id,
        )
    )
    if (result.scalar() or 0) != len(unique_ids):
        raise HTTPException(400, "One or more student IDs do not belong to this school")


async def assert_student_in_school(
    student_id: UUID, school_id: UUID, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Student.id).where(
            Student.id == student_id, Student.school_id == school_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Student not found")
