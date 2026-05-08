from uuid import UUID
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


class StudentContactBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    relation: str
    phone: Optional[str] = None
    phone2: Optional[str] = None
    email: Optional[str] = None
    occupation: Optional[str] = None
    home_address: Optional[str] = None
    is_parent: bool = True
    is_primary_contact: bool = False
    can_pickup: bool = True
    receives_sms: bool = True
    is_alive: bool = True
    notes: Optional[str] = None


class StudentContactCreate(StudentContactBase):
    pass


class StudentContactResponse(StudentContactBase):
    id: UUID
    student_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentBase(BaseModel):
    student_number: str
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    photo_url: Optional[str] = None
    home_address: Optional[str] = None
    admission_date: Optional[date] = None
    house: Optional[str] = None
    programme: Optional[str] = None


class StudentCreate(StudentBase):
    contacts: Optional[List[StudentContactCreate]] = []


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    photo_url: Optional[str] = None
    home_address: Optional[str] = None
    house: Optional[str] = None
    programme: Optional[str] = None
    status: Optional[str] = None


class StudentResponse(StudentBase):
    id: UUID
    school_id: UUID
    status: str
    contacts: List[StudentContactResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}