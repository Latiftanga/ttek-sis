import uuid
from sqlalchemy import Boolean, Column, String, Text, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id  = Column(UUID(as_uuid=True),
                       ForeignKey("schools.id", ondelete="CASCADE"),
                       nullable=True)
    # nullable=True → superadmin belongs to no school

    # ── Credentials ───────────────────────────────────────────────
    # Staff login: email + password
    email         = Column(String(200), unique=True, nullable=True)
    password_hash = Column(Text, nullable=True)

    # Student login: student_number + PIN
    # student_number stored on Student model, referenced here for fast lookup
    pin_hash      = Column(Text, nullable=True)

    # ── Role ──────────────────────────────────────────────────────
    role       = Column(String(30), nullable=False, default="teacher")
    # "superadmin" | "school_admin" | "headteacher"
    # "teacher"    | "accountant"   | "student"

    is_active  = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                       onupdate=func.now())

    # ── Profile links ─────────────────────────────────────────────
    # Only one of these will be set depending on role
    staff_id   = Column(UUID(as_uuid=True),
                       ForeignKey("staff.id", ondelete="CASCADE"),
                       nullable=True)
    student_id = Column(UUID(as_uuid=True),
                       ForeignKey("students.id", ondelete="CASCADE"),
                       nullable=True)

    # Relationships
    school  = relationship("School", back_populates="users")
    staff   = relationship("Staff", back_populates="user", uselist=False)
    student = relationship("Student", back_populates="user", uselist=False)