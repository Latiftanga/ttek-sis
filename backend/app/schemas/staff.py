from uuid import UUID
from datetime import date, datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr

StaffStatus = Literal["active", "on_leave", "transferred", "retired"]
StaffGender = Literal["male", "female"]
StaffRole   = Literal["school_admin", "headteacher", "teacher", "accountant"]


# ── Embedded user ─────────────────────────────────────────────────────────
class UserBrief(BaseModel):
    id: UUID
    email: Optional[str] = None
    role: str
    is_active: bool
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Qualifications ────────────────────────────────────────────────────────
class QualificationCreate(BaseModel):
    title:         str
    institution:   Optional[str] = None
    year_obtained: Optional[int] = None
    cert_type:     Optional[Literal["degree", "diploma", "professional", "short_course"]] = None
    notes:         Optional[str] = None


class QualificationResponse(BaseModel):
    id:            UUID
    staff_id:      UUID
    title:         str
    institution:   Optional[str] = None
    year_obtained: Optional[int] = None
    cert_type:     Optional[str] = None
    notes:         Optional[str] = None
    created_at:    datetime

    model_config = {"from_attributes": True}


# ── Promotions ────────────────────────────────────────────────────────────
class PromotionCreate(BaseModel):
    from_rank:      Optional[str] = None
    to_rank:        str
    effective_date: date
    promotion_type: Literal["substantive", "acting"] = "substantive"
    reference_no:   Optional[str] = None
    notes:          Optional[str] = None


class PromotionResponse(BaseModel):
    id:             UUID
    staff_id:       UUID
    from_rank:      Optional[str] = None
    to_rank:        str
    effective_date: date
    promotion_type: str
    reference_no:   Optional[str] = None
    notes:          Optional[str] = None
    created_at:     datetime

    model_config = {"from_attributes": True}


# ── Staff CRUD ────────────────────────────────────────────────────────────
class StaffCreate(BaseModel):
    staff_number:   Optional[str]         = None
    first_name:     str
    middle_name:    Optional[str]         = None
    last_name:      str
    gender:         Optional[StaffGender] = None
    date_of_birth:  Optional[date]        = None
    phone:          Optional[str]         = None
    photo_url:      Optional[str]         = None
    title:          Optional[str]         = None   # Mr | Mrs | Ms | Dr | Prof
    license_number: Optional[str]         = None
    specialization: Optional[str]         = None
    date_joined:    Optional[date]        = None
    status:         StaffStatus           = "active"
    # Optional: create a login account at the same time
    email:    Optional[EmailStr] = None
    password: Optional[str]     = None
    role:     StaffRole         = "teacher"


class StaffUpdate(BaseModel):
    staff_number:   Optional[str]         = None
    first_name:     Optional[str]         = None
    middle_name:    Optional[str]         = None
    last_name:      Optional[str]         = None
    gender:         Optional[StaffGender] = None
    date_of_birth:  Optional[date]        = None
    phone:          Optional[str]         = None
    photo_url:      Optional[str]         = None
    title:          Optional[str]         = None
    license_number: Optional[str]         = None
    specialization: Optional[str]         = None
    date_joined:    Optional[date]        = None
    status:         Optional[StaffStatus] = None


class InviteStaff(BaseModel):
    email:    EmailStr
    role:     StaffRole      = "teacher"
    password: Optional[str] = None   # auto-generated when omitted


# ── Response schemas ──────────────────────────────────────────────────────

class StaffSummary(BaseModel):
    """Lightweight — used in list endpoints (no child records)."""
    id:             UUID
    school_id:      UUID
    staff_number:   Optional[str]  = None
    first_name:     str
    middle_name:    Optional[str]  = None
    last_name:      str
    gender:         Optional[str]  = None
    phone:          Optional[str]  = None
    photo_url:      Optional[str]  = None
    title:          Optional[str]  = None
    license_number: Optional[str]  = None
    specialization: Optional[str]  = None
    date_joined:    Optional[date] = None
    status:         str
    current_rank:   Optional[str]  = None   # resolved from latest promotion
    user:           Optional[UserBrief] = None
    created_at:     datetime
    updated_at:     datetime

    model_config = {"from_attributes": True}


class StaffResponse(StaffSummary):
    """Full detail — includes child records."""
    date_of_birth:  Optional[date]             = None
    qualifications: list[QualificationResponse] = []
    promotions:     list[PromotionResponse]     = []


class InviteResponse(StaffResponse):
    """Extends detail response with one-time generated password."""
    temp_password: Optional[str] = None


# ── GES rank catalogue ────────────────────────────────────────────────────
class GESRankItem(BaseModel):
    id:       UUID
    name:     str
    category: str
    order:    int

    model_config = {"from_attributes": True}
