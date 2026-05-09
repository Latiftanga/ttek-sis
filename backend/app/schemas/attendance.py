from uuid import UUID
from datetime import date, datetime, time
from typing import Optional, List
from pydantic import BaseModel, field_validator


# ══════════════════════════════════════════════════════
# SCHOOL PERIOD
# ══════════════════════════════════════════════════════

class SchoolPeriodCreate(BaseModel):
    name: str
    start_time: time
    end_time: time
    order: int
    is_break: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Period name cannot be empty")
        return v.strip()


class SchoolPeriodUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    order: Optional[int] = None
    is_break: Optional[bool] = None
    is_active: Optional[bool] = None


class SchoolPeriodResponse(BaseModel):
    id: UUID
    school_id: UUID
    name: str
    start_time: time
    end_time: time
    order: int
    is_break: bool
    is_active: bool

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# ATTENDANCE SESSION
# ══════════════════════════════════════════════════════

class SessionCreate(BaseModel):
    """
    Sent by teacher when opening an attendance session.
    client_opened_at is device time — used for fraud detection only.
    server_synced_at will be set by the server on receipt.
    """
    class_id:           UUID
    term_id:            UUID
    session_type:       str       # "daily" | "lesson"
    date:               date
    client_opened_at:   datetime  # device time

    # Per-lesson mode only
    subject_id:         Optional[UUID] = None
    period_id:          Optional[UUID] = None

    # Offline deduplication
    client_id:          Optional[str] = None

    @field_validator("session_type")
    @classmethod
    def validate_type(cls, v):
        if v not in ("daily", "lesson"):
            raise ValueError("session_type must be daily or lesson")
        return v


class AttendanceRecordInput(BaseModel):
    """One student mark inside a session submission."""
    student_id: UUID
    status:     str
    reason:     Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in ("present", "absent", "late", "excused"):
            raise ValueError("status must be present, absent, late or excused")
        return v


class SessionSubmit(BaseModel):
    """
    Sent by teacher when submitting attendance.
    Contains all student marks for this session.
    client_submitted_at is device time.
    """
    client_submitted_at: datetime
    records: List[AttendanceRecordInput]

    @field_validator("records")
    @classmethod
    def validate_records(cls, v):
        if not v:
            raise ValueError("At least one record is required")
        # Check for duplicate student_ids
        ids = [r.student_id for r in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate student records found")
        return v


class SessionResponse(BaseModel):
    id:                 UUID
    school_id:          UUID
    class_id:           UUID
    term_id:            UUID
    teacher_id:         UUID
    subject_id:         Optional[UUID] = None
    period_id:          Optional[UUID] = None
    session_type:       str
    date:               date
    status:             str
    client_opened_at:   datetime
    server_synced_at:   datetime
    submitted_at:       Optional[datetime] = None
    sync_mode:          str
    sync_gap_seconds:   Optional[int] = None
    is_flagged:         bool
    flag_reason:        Optional[str] = None
    review_outcome:     Optional[str] = None
    created_at:         datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# ATTENDANCE RECORD
# ══════════════════════════════════════════════════════

class RecordEditRequest(BaseModel):
    """Correct a submitted attendance record. edit_reason is required."""
    status:      str
    reason:      Optional[str] = None
    edit_reason: str   # mandatory — teacher must explain correction

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in ("present", "absent", "late", "excused"):
            raise ValueError("status must be present, absent, late or excused")
        return v

    @field_validator("edit_reason")
    @classmethod
    def validate_edit_reason(cls, v):
        if not v or not v.strip():
            raise ValueError("edit_reason is required when correcting attendance")
        return v.strip()


class AttendanceRecordResponse(BaseModel):
    id:              UUID
    school_id:       UUID
    session_id:      UUID
    student_id:      UUID
    status:          str
    reason:          Optional[str] = None
    recorded_by:     UUID
    recorded_at:     datetime
    is_edited:       bool
    original_status: Optional[str] = None
    last_edited_by:  Optional[UUID] = None
    last_edited_at:  Optional[datetime] = None
    edit_reason:     Optional[str] = None

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════
# OFFLINE SYNC
# ══════════════════════════════════════════════════════

class OfflineSession(BaseModel):
    """One session queued offline — contains session + all records."""
    session:    SessionCreate
    records:    List[AttendanceRecordInput]
    client_submitted_at: datetime


class SyncBatchRequest(BaseModel):
    """Batch of offline sessions sent when connectivity returns."""
    sessions: List[OfflineSession]


class SyncResult(BaseModel):
    client_id:  str
    success:    bool
    session_id: Optional[UUID] = None
    error:      Optional[str] = None


class SyncBatchResponse(BaseModel):
    processed:  int
    succeeded:  int
    failed:     int
    results:    List[SyncResult]


# ══════════════════════════════════════════════════════
# DASHBOARD / REPORTS
# ══════════════════════════════════════════════════════

class ClassAttendanceSummary(BaseModel):
    """Attendance summary for a class on a given date."""
    class_id:       UUID
    class_name:     str
    date:           date
    total_students: int
    present:        int
    absent:         int
    late:           int
    excused:        int
    not_marked:     int
    session_id:     Optional[UUID] = None
    session_status: Optional[str] = None   # open | submitted | None


class StudentAttendanceSummary(BaseModel):
    """Term attendance summary for one student."""
    student_id:          UUID
    student_number:      str
    first_name:          str
    last_name:           str
    total_sessions:      int
    present:             int
    absent:              int
    late:                int
    excused:             int
    attendance_pct:      float
    consecutive_absences: int
    is_at_risk:          bool   # below threshold


class SchoolAttendanceToday(BaseModel):
    """School-wide attendance snapshot for today."""
    date:                   date
    total_classes:          int
    sessions_submitted:     int
    sessions_open:          int
    sessions_not_started:   int
    # Classes with no session at all today
    flagged_sessions:       int
