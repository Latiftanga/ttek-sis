from uuid import UUID
from datetime import date, datetime
from typing import Literal, Optional, List
from pydantic import BaseModel, field_validator, model_validator
import re


# ══════════════════════════════════════════════════════
# ACADEMIC YEAR
# ══════════════════════════════════════════════════════

class AcademicYearCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_current: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not re.match(r"^\d{4}/\d{4}$", v):
            raise ValueError("Name must be in format YYYY/YYYY e.g. 2024/2025")
        years = v.split("/")
        if int(years[1]) != int(years[0]) + 1:
            raise ValueError("Second year must follow first e.g. 2024/2025")
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class AcademicYearUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class AcademicYearResponse(BaseModel):
    id: UUID
    school_id: UUID
    name: str
    start_date: date
    end_date: date
    is_current: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# TERM
# ══════════════════════════════════════════════════════

VALID_TERM_NAMES = {"Term 1", "Term 2", "Term 3"}


class TermCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_current: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v not in VALID_TERM_NAMES:
            raise ValueError("Term name must be Term 1, Term 2, or Term 3")
        return v

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class TermUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None


class TermResponse(BaseModel):
    id: UUID
    school_id: UUID
    academic_year_id: UUID
    name: str
    start_date: date
    end_date: date
    is_current: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# CLASS
# ══════════════════════════════════════════════════════

VALID_STREAMS = {"A", "B", "C", "D", "E"}

VALID_LEVELS = {
    "preschool": [0, 1, 2],   # 0 = Creche, 1 = Nursery 1, 2 = Nursery 2
    "kg":        [1, 2],
    "basic":     [1, 2, 3, 4, 5, 6, 7, 8, 9],
    "shs":       [1, 2, 3],
}


class ClassCreate(BaseModel):
    level_group: str
    level_number: Optional[int] = None
    stream: Optional[str] = None
    programme: Optional[str] = None
    class_teacher_id: Optional[UUID] = None
    capacity: int = 45

    @field_validator("level_group")
    @classmethod
    def validate_level_group(cls, v):
        if v not in VALID_LEVELS:
            raise ValueError(
                f"Invalid level_group. Must be one of: {list(VALID_LEVELS.keys())}"
            )
        return v

    @field_validator("stream")
    @classmethod
    def validate_stream(cls, v):
        if v and v.upper() not in VALID_STREAMS:
            raise ValueError(f"Stream must be one of: {VALID_STREAMS}")
        return v.upper() if v else v

    @model_validator(mode="after")
    def validate_level_rules(self):
        lg = self.level_group
        ln = self.level_number
        prog = self.programme

        if ln is None:
            raise ValueError(f"{lg.upper()} must have a level number")
        valid = VALID_LEVELS[lg]
        if ln not in valid:
            raise ValueError(
                f"Invalid level number {ln} for {lg.upper()}. Must be one of: {valid}"
            )

        if lg == "shs" and not prog:
            raise ValueError("SHS classes must have a programme")

        if lg != "shs" and prog:
            raise ValueError("Only SHS classes can have a programme")

        return self


class ClassUpdate(BaseModel):
    class_teacher_id: Optional[UUID] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class ClassResponse(BaseModel):
    id: UUID
    school_id: UUID
    name: str
    level_group: str
    level_number: Optional[int] = None
    stream: Optional[str] = None
    programme: Optional[str] = None
    capacity: int
    is_active: bool
    class_teacher_id: Optional[UUID] = None
    class_teacher_name: Optional[str] = None  # populated by the router via eager-load
    is_bece_level: bool
    is_wassce_level: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# SUBJECT
# ══════════════════════════════════════════════════════

SubjectCategory = Literal["core", "elective"]


class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    category: Optional[SubjectCategory] = None
    # category only meaningful for SHS schools (core / elective).
    # Basic schools leave it null.


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[SubjectCategory] = None


class SubjectResponse(BaseModel):
    id: UUID
    school_id: UUID
    name: str
    code: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# ENROLLMENT
# ══════════════════════════════════════════════════════

class EnrollmentCreate(BaseModel):
    student_id: UUID
    class_id: UUID
    academic_year_id: UUID
    start_date: date
    is_boarding: bool = False
    notes: Optional[str] = None


class PromoteRequest(BaseModel):
    to_class_id: UUID
    academic_year_id: UUID
    start_date: date
    notes: Optional[str] = None


class DemoteRequest(BaseModel):
    to_class_id: UUID
    academic_year_id: UUID
    start_date: date
    notes: Optional[str] = None


class RepeatRequest(BaseModel):
    academic_year_id: UUID
    start_date: date
    notes: Optional[str] = None


class TransferRequest(BaseModel):
    notes: Optional[str] = None
    end_date: Optional[date] = None


class GraduateRequest(BaseModel):
    notes: Optional[str] = None
    end_date: Optional[date] = None


class ClassSubjectCreate(BaseModel):
    subject_id: UUID
    teacher_id: Optional[UUID] = None
    order: int = 0


class ClassSubjectUpdate(BaseModel):
    teacher_id: Optional[UUID] = None
    order: Optional[int] = None


class ClassSubjectResponse(BaseModel):
    id: UUID
    class_id: UUID
    subject_id: UUID
    subject_name: str
    subject_code: Optional[str] = None
    subject_category: str
    teacher_id: Optional[UUID] = None
    teacher_name: Optional[str] = None
    order: int

    model_config = {"from_attributes": True}


class BulkPromoteRequest(BaseModel):
    from_class_id: UUID
    to_class_id: UUID
    academic_year_id: UUID
    start_date: date
    exclude_student_ids: List[UUID] = []


class EnrollmentResponse(BaseModel):
    id: UUID
    school_id: UUID
    student_id: UUID
    class_id: UUID
    academic_year_id: UUID
    status: str
    start_date: date
    end_date: Optional[date] = None
    position: Optional[str] = None
    is_boarding: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkPromoteResponse(BaseModel):
    promoted: int
    skipped: int
    errors: List[str] = []


class ClassStudentResponse(BaseModel):
    enrollment_id: UUID
    student_id: UUID
    student_number: str
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    gender: Optional[str] = None
    is_boarding: bool


class StudentSubjectResponse(BaseModel):
    id: UUID
    enrollment_id: UUID
    subject_id: UUID
    subject_name: str
    subject_code: Optional[str] = None

    model_config = {"from_attributes": True}


class StudentSubjectBulkSet(BaseModel):
    subject_ids: List[UUID]

