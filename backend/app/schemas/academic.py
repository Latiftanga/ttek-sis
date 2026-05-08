from uuid import UUID
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class AcademicYearCreate(BaseModel):
    name: str           # "2024/2025"
    start_date: date
    end_date: date
    is_current: bool = False


class AcademicYearResponse(AcademicYearCreate):
    id: UUID
    school_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TermCreate(BaseModel):
    academic_year_id: UUID
    name: str           # "Term 1" | "Term 2" | "Term 3"
    start_date: date
    end_date: date
    is_current: bool = False


class TermResponse(TermCreate):
    id: UUID
    school_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ClassCreate(BaseModel):
    level_group: str
    level_number: Optional[int] = None
    stream: Optional[str] = None
    programme: Optional[str] = None
    class_teacher_id: Optional[UUID] = None
    capacity: int = 45


class ClassResponse(ClassCreate):
    id: UUID
    school_id: UUID
    name: str           # auto-generated: "JHS 2A"
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    category: str = "core"
    level_group: str = "all"


class SubjectResponse(SubjectCreate):
    id: UUID
    school_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}