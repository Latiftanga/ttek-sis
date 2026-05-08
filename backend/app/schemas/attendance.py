from uuid import UUID
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


class AttendanceRecord(BaseModel):
    student_id: UUID
    status: str = "present"
    # "present" | "absent" | "late" | "excused"
    reason: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
    """
    Teacher submits attendance for a whole class in one request.
    Works offline — synced later via POST /sync/batch
    """
    class_id: UUID
    term_id: UUID
    date: date
    records: List[AttendanceRecord]


class AttendanceResponse(BaseModel):
    id: UUID
    student_id: UUID
    class_id: UUID
    date: date
    status: str
    reason: Optional[str] = None
    recorded_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}