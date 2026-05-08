from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    role: str = "teacher"


class UserCreate(UserBase):
    email: EmailStr
    password: str
    role: str = "teacher"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: UUID
    school_id: Optional[UUID] = None
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Auth schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SchoolBrief(BaseModel):
    id: UUID
    name: str
    slug: str
    school_type: str
    accent_color: str
    logo_url: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    school: Optional[SchoolBrief] = None
