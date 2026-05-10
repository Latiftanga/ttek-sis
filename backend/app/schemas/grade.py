from uuid import UUID
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator, model_validator
from decimal import Decimal


# ══════════════════════════════════════════════════════
# ASSESSMENT CATEGORY
# ══════════════════════════════════════════════════════

class AssessmentCategoryCreate(BaseModel):
    name:            str
    weight:          Decimal
    max_score:       Decimal = Decimal("100")
    is_ca:           bool    = True
    allows_multiple: bool    = True
    order:           int     = 1

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v):
        if v <= 0 or v > 100:
            raise ValueError("weight must be between 1 and 100")
        return v

    @field_validator("max_score")
    @classmethod
    def validate_max_score(cls, v):
        if v <= 0:
            raise ValueError("max_score must be greater than 0")
        return v


class AssessmentCategoryUpdate(BaseModel):
    name:            Optional[str]     = None
    weight:          Optional[Decimal] = None
    max_score:       Optional[Decimal] = None
    is_ca:           Optional[bool]    = None
    allows_multiple: Optional[bool]    = None
    order:           Optional[int]     = None
    is_active:       Optional[bool]    = None


class AssessmentCategoryResponse(BaseModel):
    id:              UUID
    school_id:       UUID
    name:            str
    weight:          Decimal
    max_score:       Decimal
    is_ca:           bool
    allows_multiple: bool
    order:           int
    is_active:       bool
    created_at:      datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# ASSESSMENT
# ══════════════════════════════════════════════════════

class AssessmentCreate(BaseModel):
    category_id:       UUID
    class_id:          UUID
    subject_id:        UUID
    term_id:           UUID
    title:             str
    date_administered: Optional[date]    = None
    max_score:         Decimal

    @field_validator("max_score")
    @classmethod
    def validate_max_score(cls, v):
        if v <= 0:
            raise ValueError("max_score must be greater than 0")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        if not v.strip():
            raise ValueError("title cannot be empty")
        return v.strip()


class AssessmentUpdate(BaseModel):
    title:             Optional[str]     = None
    date_administered: Optional[date]    = None
    max_score:         Optional[Decimal] = None


class AssessmentResponse(BaseModel):
    id:                UUID
    school_id:         UUID
    category_id:       UUID
    class_id:          UUID
    subject_id:        UUID
    term_id:           UUID
    title:             str
    date_administered: Optional[date]     = None
    max_score:         Decimal
    is_published:      bool
    created_by:        UUID
    created_at:        datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# SCORES
# ══════════════════════════════════════════════════════

class ScoreInput(BaseModel):
    """One student score within a bulk submission."""
    student_id: UUID
    score:      Optional[Decimal] = None
    is_absent:  bool              = False
    remarks:    Optional[str]     = None

    @model_validator(mode="after")
    def validate_score_or_absent(self):
        if not self.is_absent and self.score is None:
            raise ValueError("score is required unless is_absent is True")
        if self.is_absent and self.score is not None:
            raise ValueError("score must be empty when is_absent is True")
        if self.score is not None and self.score < 0:
            raise ValueError("score cannot be negative")
        return self


class BulkScoreSubmit(BaseModel):
    """
    Teacher submits scores for entire class in one request.
    Works for both online and offline sync.
    """
    records:   List[ScoreInput]
    client_id: Optional[str] = None  # for offline deduplication

    @field_validator("records")
    @classmethod
    def validate_records(cls, v):
        if not v:
            raise ValueError("At least one record is required")
        ids = [r.student_id for r in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate student records found")
        return v


class ScoreEditRequest(BaseModel):
    """Correct a single student score. Reason required after submission."""
    score:      Optional[Decimal] = None
    is_absent:  bool              = False
    remarks:    Optional[str]     = None
    reason:     Optional[str]     = None
    # Required after assessment is published
    # Required always after term is locked (only headteacher)

    @model_validator(mode="after")
    def validate_score_or_absent(self):
        if not self.is_absent and self.score is None:
            raise ValueError("score is required unless is_absent is True")
        if self.is_absent and self.score is not None:
            raise ValueError("score must be empty when is_absent is True")
        if self.score is not None and self.score < 0:
            raise ValueError("score cannot be negative")
        return self


class AssessmentScoreResponse(BaseModel):
    id:              UUID
    school_id:       UUID
    assessment_id:   UUID
    student_id:      UUID
    score:           Optional[Decimal] = None
    is_absent:       bool
    remarks:         Optional[str]     = None
    recorded_by:     UUID
    recorded_at:     datetime
    is_edited:       bool
    original_score:  Optional[Decimal] = None
    edit_count:      int               = 0
    last_edited_by:  Optional[UUID]    = None
    last_edited_at:  Optional[datetime]= None

    model_config = {"from_attributes": True}


class GradebookEntry(BaseModel):
    """One row in the gradebook view — student + their score."""
    student_id:     UUID
    student_number: str
    first_name:     str
    middle_name:    Optional[str] = None
    last_name:      str
    score:          Optional[Decimal] = None
    is_absent:      bool              = False
    remarks:        Optional[str]     = None
    is_edited:      bool              = False
    score_id:       Optional[UUID]    = None  # None if not yet entered


class GradebookResponse(BaseModel):
    """Full gradebook for one assessment."""
    assessment:     AssessmentResponse
    entries:        List[GradebookEntry]
    total_students: int
    scores_entered: int
    scores_missing: int


# ══════════════════════════════════════════════════════
# SCORE EDIT LOG
# ══════════════════════════════════════════════════════

class ScoreEditLogResponse(BaseModel):
    id:                   UUID
    assessment_score_id:  UUID
    changed_by:           UUID
    changed_at:           datetime
    old_score:            Optional[Decimal] = None
    new_score:            Optional[Decimal] = None
    reason:               Optional[str]     = None
    is_after_submission:  bool
    is_after_lock:        bool

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# TERM RESULTS
# ══════════════════════════════════════════════════════

class ComputeTermResultsRequest(BaseModel):
    """Trigger computation for a class + term."""
    class_id:   UUID
    term_id:    UUID
    subject_id: Optional[UUID] = None
    # None = compute all subjects for this class + term


class TermResultResponse(BaseModel):
    id:          UUID
    school_id:   UUID
    student_id:  UUID
    subject_id:  UUID
    term_id:     UUID
    class_id:    UUID
    raw_score:   Optional[Decimal] = None
    ca_score:    Optional[Decimal] = None
    grade_label: Optional[str]     = None
    remark:      Optional[str]     = None
    position:    Optional[int]     = None
    is_computed: bool
    is_submitted: bool
    computed_at: Optional[datetime]= None

    model_config = {"from_attributes": True}


class StudentTermReport(BaseModel):
    """
    All term results for one student — for report card.
    """
    student_id:      UUID
    student_number:  str
    first_name:      str
    middle_name:     Optional[str] = None
    last_name:       str
    class_name:      str
    term_name:       str
    academic_year:   str
    results:         List[TermResultResponse]
    total_score:     Optional[Decimal] = None
    overall_position: Optional[int]    = None
    attendance_pct:  Optional[Decimal] = None


# ══════════════════════════════════════════════════════
# GRADING SCALE
# ══════════════════════════════════════════════════════

class GradingScaleCreate(BaseModel):
    name:        str
    description: Optional[str] = None


class GradingBandCreate(BaseModel):
    min_score:   Decimal
    max_score:   Decimal
    grade_label: str
    remark:      Optional[str] = None
    order:       int

    @model_validator(mode="after")
    def validate_range(self):
        if self.min_score >= self.max_score:
            raise ValueError("min_score must be less than max_score")
        if self.min_score < 0 or self.max_score > 100:
            raise ValueError("scores must be between 0 and 100")
        return self


class GradingScaleResponse(BaseModel):
    id:          UUID
    school_id:   Optional[UUID] = None
    name:        str
    description: Optional[str] = None
    is_active:   bool
    bands:       List["GradingBandResponse"] = []

    model_config = {"from_attributes": True}


class GradingBandResponse(BaseModel):
    id:          UUID
    min_score:   Decimal
    max_score:   Decimal
    grade_label: str
    remark:      Optional[str] = None
    order:       int

    model_config = {"from_attributes": True}
