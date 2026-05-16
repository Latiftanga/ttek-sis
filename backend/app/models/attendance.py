import uuid
from sqlalchemy import (
    Boolean, Column, String, Text,
    Date, DateTime, Integer, ForeignKey, UniqueConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class AttendanceSession(Base):
    """
    One attendance-taking event.

    daily mode    → one per class per day, taken by class teacher
    per_lesson    → one per lesson, taken by subject teacher

    Anti-fraud:
      server_synced_at is always set by server — cannot be faked
      client_opened_at is device time — used for context only
      sync_gap_seconds computed on receipt
      is_flagged set if anomalies detected
    """
    __tablename__ = "attendance_sessions"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id           = Column(UUID(as_uuid=True),
                                ForeignKey("schools.id", ondelete="CASCADE"),
                                nullable=False)
    class_id            = Column(UUID(as_uuid=True),
                                ForeignKey("classes.id"),
                                nullable=False)
    term_id             = Column(UUID(as_uuid=True),
                                ForeignKey("terms.id"),
                                nullable=False)
    teacher_id          = Column(UUID(as_uuid=True),
                                ForeignKey("users.id"),
                                nullable=False)

    # NULL for daily mode, set for per_lesson mode
    subject_id          = Column(UUID(as_uuid=True),
                                ForeignKey("subjects.id"),
                                nullable=True)
    period_id           = Column(UUID(as_uuid=True),
                                ForeignKey("school_periods.id"),
                                nullable=True)

    # ── Session type ──────────────────────────────────────────────
    session_type        = Column(String(20), nullable=False)
    # "daily"  → morning roll call (daily mode)
    # "lesson" → subject lesson (per_lesson mode)

    date                = Column(Date, nullable=False)

    # ── Status ────────────────────────────────────────────────────
    status              = Column(String(20), nullable=False, default="open")
    # "open"      → teacher started marking, not yet submitted
    # "submitted" → teacher submitted, records locked
    # "cancelled" → e.g. school holiday, sports day

    # ── Timestamps ────────────────────────────────────────────────
    client_opened_at    = Column(DateTime(timezone=True), nullable=False)
    # Device time when teacher opened the session
    # Not fully trusted — used for context and flag detection

    server_synced_at    = Column(DateTime(timezone=True),
                                server_default=func.now(),
                                nullable=False)
    # Server time when record arrived — always trusted

    submitted_at        = Column(DateTime(timezone=True), nullable=True)
    # Server time when session was submitted

    # ── Offline sync ──────────────────────────────────────────────
    sync_mode           = Column(String(10), nullable=False, default="online")
    # "online"  → submitted while connected
    # "offline" → submitted offline, synced later

    sync_gap_seconds    = Column(Integer, nullable=True)
    # Seconds between client_opened_at and server_synced_at
    # Computed on receipt. Large gap = offline submission.

    client_id           = Column(String(100), unique=True, nullable=True)
    # UUID generated on device for deduplication
    # Prevents same session being submitted twice

    # ── Anti-fraud flags ──────────────────────────────────────────
    is_flagged          = Column(Boolean, default=False)
    flag_reason         = Column(String(100), nullable=True)
    # "outside_time_window" → client time outside period hours
    # "large_sync_gap"      → synced > 12 hours after submission
    # "submitted_too_fast"  → < 3 seconds per student
    # "future_timestamp"    → device clock set to future

    reviewed_by         = Column(UUID(as_uuid=True),
                                ForeignKey("users.id"),
                                nullable=True)
    reviewed_at         = Column(DateTime(timezone=True), nullable=True)
    review_outcome      = Column(String(20), nullable=True)
    # "cleared" | "penalised"
    review_notes        = Column(Text, nullable=True)

    created_at          = Column(DateTime(timezone=True),
                                server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────
    records             = relationship("AttendanceRecord",
                                       back_populates="session",
                                       cascade="all, delete-orphan")
    period              = relationship("SchoolPeriod")


class AttendanceRecord(Base):
    """
    One student mark within one session.
    One row per student per session.

    Unique constraint: one record per student per session.
    Corrections go through PATCH with mandatory edit_reason.
    """
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_attendance_session_student"),
    )

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id       = Column(UUID(as_uuid=True),
                            ForeignKey("schools.id", ondelete="CASCADE"),
                            nullable=False)
    session_id      = Column(UUID(as_uuid=True),
                            ForeignKey("attendance_sessions.id", ondelete="CASCADE"),
                            nullable=False)
    student_id      = Column(UUID(as_uuid=True),
                            ForeignKey("students.id", ondelete="CASCADE"),
                            nullable=False)

    # ── The mark ──────────────────────────────────────────────────
    status          = Column(String(10), nullable=False)
    # "present" | "absent" | "late" | "excused"

    reason          = Column(Text, nullable=True)
    # Optional for late, required for excused
    # Encouraged for absent

    # ── Audit ─────────────────────────────────────────────────────
    recorded_by     = Column(UUID(as_uuid=True),
                            ForeignKey("users.id"),
                            nullable=False)
    recorded_at     = Column(DateTime(timezone=True),
                            server_default=func.now())
    # Set by server — cannot be manipulated

    # Edit tracking
    is_edited       = Column(Boolean, default=False)
    original_status = Column(String(10), nullable=True)
    # Preserved when record is edited

    last_edited_by  = Column(UUID(as_uuid=True),
                            ForeignKey("users.id"),
                            nullable=True)
    last_edited_at  = Column(DateTime(timezone=True), nullable=True)
    edit_reason     = Column(Text, nullable=True)
    # Required when editing — teacher must explain

    # ── Relationships ─────────────────────────────────────────────
    session         = relationship("AttendanceSession",
                                   back_populates="records")
    student         = relationship("Student")
