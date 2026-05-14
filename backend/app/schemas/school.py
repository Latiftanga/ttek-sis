from uuid import UUID
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr


SchoolType = Literal["basic", "shs"]


class SchoolBase(BaseModel):
    name: str
    school_type: SchoolType = "basic"
    region: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    accent_color: Optional[str] = "#1a6b3c"


class SchoolCreate(SchoolBase):
    name: str
    school_type: SchoolType


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    school_type: Optional[SchoolType] = None
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


class ProgrammeCreate(BaseModel):
    name: str
    short_name: str
    description: Optional[str] = None
    order: int = 1


class ProgrammeUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None


class HouseCreate(BaseModel):
    name: str
    color: Optional[str] = None
    order: int = 1


class HouseUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None