import uuid
from sqlalchemy import Column, String, Text, Date, ForeignKey, DateTime, JSON, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("school_id", "student_number", name="uq_student_school_number"),
    )

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id      = Column(UUID(as_uuid=True),
                           ForeignKey("schools.id", ondelete="CASCADE"),
                           nullable=False)

    # ── Identity ──────────────────────────────────────────────────
    student_number = Column(String(30), nullable=False)
    first_name     = Column(String(100), nullable=False)
    middle_name    = Column(String(100))
    last_name      = Column(String(100), nullable=False)
    date_of_birth  = Column(Date)
    gender         = Column(String(10))
    photo_url      = Column(Text)
    home_address   = Column(Text)

    # ── Enrollment ────────────────────────────────────────────────
    admission_date = Column(Date)
    status         = Column(String(20), default="active")
    # "active" | "graduated" | "transferred" | "withdrawn"

    # ── School specific ───────────────────────────────────────────
    house          = Column(String(100))
    programme      = Column(String(100))    # SHS only

    # ── Student portal login ──────────────────────────────────────
    pin_hash       = Column(Text)

    extra          = Column(JSON, default=dict)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(),
                           onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────
    school         = relationship("School", back_populates="students")
    contacts       = relationship("StudentContact",
                                 back_populates="student",
                                 cascade="all, delete-orphan",
                                 order_by="StudentContact.is_primary_contact.desc()")
    enrollments    = relationship("Enrollment",
                                 back_populates="student",
                                 cascade="all, delete-orphan",
                                 order_by="Enrollment.start_date.desc()")

    @property
    def current_enrollment(self):
        """Returns the active enrollment — current class this year."""
        return next(
            (e for e in self.enrollments if e.status == "active"),
            None
        )

    @property
    def current_class(self):
        """Convenience — returns the Class object directly."""
        enrollment = self.current_enrollment
        return enrollment.class_ if enrollment else None