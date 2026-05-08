import uuid
from sqlalchemy import Boolean, Column, String, Text, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class StudentContact(Base):
    __tablename__ = "student_contacts"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id    = Column(UUID(as_uuid=True),
                         ForeignKey("schools.id", ondelete="CASCADE"),
                         nullable=False)
    student_id   = Column(UUID(as_uuid=True),
                         ForeignKey("students.id", ondelete="CASCADE"),
                         nullable=False)

    # ── Who they are ──────────────────────────────────────────────
    first_name   = Column(String(100), nullable=False)
    last_name    = Column(String(100))
    relation     = Column(String(50), nullable=False)
    # "father" | "mother" | "grandfather" | "grandmother"
    # "uncle"  | "aunt"   | "brother"     | "sister"
    # "guardian" | "other"

    # ── Contact details ───────────────────────────────────────────
    phone        = Column(String(20))       # primary phone
    phone2       = Column(String(20))       # backup phone
    email        = Column(String(200))
    occupation   = Column(String(150))
    workplace    = Column(String(200))
    home_address = Column(Text)

    # ── Flags ─────────────────────────────────────────────────────
    is_parent          = Column(Boolean, default=True)
    # True  → biological parent (father/mother)
    # False → guardian, relative, or emergency contact

    is_primary_contact = Column(Boolean, default=False)
    # The one school calls first — only ONE per student should be True

    can_pickup         = Column(Boolean, default=True)
    # Whether this person is allowed to collect the child from school

    receives_sms       = Column(Boolean, default=True)
    # Whether to include in SMS broadcast (results, fees, notices)

    is_alive           = Column(Boolean, default=True)
    # Respectfully track if parent is deceased

    notes              = Column(Text)
    # Any special notes — e.g. "Call only after 5pm"

    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(),
                               onupdate=func.now())

    # Relationships
    student  = relationship("Student", back_populates="contacts")
    school   = relationship("School", back_populates="student_contacts")