"""End-of-year roll-over schemas — the request/response shapes for
moving an entire class to the next academic year."""
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, model_validator


OutcomeLiteral = Literal[
    "promoted", "repeated", "graduated", "transferred", "withdrawn",
]


class ClassBrief(BaseModel):
    """Just enough to populate the target-class dropdown."""
    id:           UUID
    name:         str
    level_group:  str
    level_number: Optional[int] = None
    stream:       Optional[str] = None

    model_config = {"from_attributes": True}


class RolloverPreviewRow(BaseModel):
    """One student in the source class — decision support data only."""
    student_id:        UUID
    enrollment_id:     UUID
    student_number:    str
    first_name:        str
    middle_name:       Optional[str] = None
    last_name:         str
    photo_url:         Optional[str] = None
    year_aggregate:    Optional[Decimal] = None
    attendance_pct:    Optional[Decimal] = None


class RolloverPreviewResponse(BaseModel):
    source_class_id:           UUID
    source_class_name:         str
    source_academic_year_id:   UUID
    source_academic_year_name: str
    target_academic_year_id:   UUID
    target_academic_year_name: str
    # Terminal classes (JHS 3 / SHS 3) default to Graduate; everyone else
    # defaults to Promote.
    is_terminal_class:         bool
    rows:                      List[RolloverPreviewRow]
    target_classes:            List[ClassBrief]


class RolloverDecision(BaseModel):
    """One headteacher decision per student."""
    enrollment_id:   UUID
    student_id:      UUID
    outcome:         OutcomeLiteral
    target_class_id: Optional[UUID] = None
    reason:          Optional[str]  = None

    @model_validator(mode="after")
    def validate_target(self):
        # Promote/repeat must specify where; the rest must not.
        if self.outcome in ("promoted", "repeated") and not self.target_class_id:
            raise ValueError(
                f"target_class_id is required for outcome={self.outcome}",
            )
        if self.outcome in ("graduated", "transferred", "withdrawn") and self.target_class_id:
            raise ValueError(
                f"target_class_id must be null for outcome={self.outcome}",
            )
        return self


class RolloverCommitRequest(BaseModel):
    source_class_id:         UUID
    source_academic_year_id: UUID
    target_academic_year_id: UUID
    decisions:               List[RolloverDecision]
    end_date:                Optional[str] = None
    # ISO date string used as `end_date` on every closed enrollment.
    # Defaults to today if not provided.
    new_start_date:          Optional[str] = None
    # ISO date string for the new enrollments' start_date. Defaults to
    # the target year's start_date.


class RolloverCommitResponse(BaseModel):
    closed_count:   int
    opened_count:   int
    graduated_count: int
    withdrawn_count: int
    message:         str
