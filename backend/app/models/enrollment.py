import uuid
from sqlalchemy import (
    Column, String, Integer, Date, ForeignKey,
    DateTime, Boolean, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Enrollment(Base):
    __tablename__ = "enrollments"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id        = Column(UUID(as_uuid=True),
                             ForeignKey("schools.id", ondelete="CASCADE"),
                             nullable=False)

    # The three core links
    student_id       = Column(UUID(as_uuid=True),
                             ForeignKey("students.id", ondelete="CASCADE"),
                             nullable=False)
    class_id         = Column(UUID(as_uuid=True),
                             ForeignKey("classes.id"),
                             nullable=False)
    academic_year_id = Column(UUID(as_uuid=True),
                             ForeignKey("academic_years.id"),
                             nullable=False)

    # ── Status ────────────────────────────────────────────────────
    status           = Column(String(20), nullable=False, default="active")
    # "active"       → currently in this class this year
    # "promoted"     → moved up to next class
    # "repeated"     → staying in same class next year
    # "demoted"      → moved down a class
    # "transferred"  → left to another school
    # "graduated"    → completed final year (JHS 3 or SHS 3)
    # "withdrawn"    → dropped out

    # ── Dates ─────────────────────────────────────────────────────
    start_date       = Column(Date, nullable=False)   # when they joined this class
    end_date         = Column(Date, nullable=True)    # when they left (NULL = current)

    # ── Transition tracking ───────────────────────────────────────
    next_enrollment_id = Column(UUID(as_uuid=True),
                               ForeignKey("enrollments.id"),
                               nullable=True)
    # Points to the NEXT enrollment regardless of transition type
    # (promote, demote, repeat). Traces: JHS1A → JHS2A → JHS3A

    # ── Position in class ─────────────────────────────────────────
    # Computed at end of term from grades
    position         = Column(Integer, nullable=True)

    is_boarding      = Column(Boolean, default=False)
    notes            = Column(Text)   # reason for demotion, special circumstances

    # Who closed this enrollment (set to a non-active status). NULL while
    # the enrollment is active. Combined with updated_at this answers
    # "who promoted Yaw to JHS 3A and when?"
    closed_by        = Column(UUID(as_uuid=True),
                             ForeignKey("users.id"),
                             nullable=True)

    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(),
                             onupdate=func.now())

    # Relationships
    student         = relationship("Student", back_populates="enrollments")
    class_          = relationship("Class", back_populates="enrollments")
    academic_year   = relationship("AcademicYear")
    next_enrollment  = relationship("Enrollment", remote_side="Enrollment.id",
                                   foreign_keys=[next_enrollment_id])
    student_subjects = relationship("StudentSubject", back_populates="enrollment",
                                   cascade="all, delete-orphan")