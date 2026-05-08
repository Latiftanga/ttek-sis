from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class SchoolBase(BaseModel):
    name: str
    school_type: str = "basic"
    # "basic" | "shs" | "combined"
    region: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    accent_color: Optional[str] = "#1a6b3c"


class SchoolCreate(SchoolBase):
    name: str
    school_type: str


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    school_type: Optional[str] = None
    region: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    accent_color: Optional[str] = None


class SchoolResponse(SchoolBase):
    id: UUID
    slug: str
    subscription: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}