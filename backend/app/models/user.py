import uuid
from sqlalchemy import Boolean, Column, String, Text, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id     = Column(UUID(as_uuid=True),
                          ForeignKey("schools.id", ondelete="CASCADE"),
                          nullable=True)
    # nullable=True → superadmin belongs to no school

    # Staff login
    email         = Column(String(200), unique=True, nullable=True)
    password_hash = Column(Text, nullable=True)

    # Role
    role          = Column(String(30), nullable=False, default="teacher")
    # "superadmin" | "school_admin" | "headteacher"
    # "teacher"    | "accountant"

    is_active     = Column(Boolean, default=True)
    last_login    = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(),
                          onupdate=func.now())

    # Profile links — only one will be set
    staff_id      = Column(UUID(as_uuid=True),
                          ForeignKey("staff.id", ondelete="CASCADE"),
                          nullable=True)

    # Relationships
    school        = relationship("School", back_populates="users")
    staff         = relationship("Staff", back_populates="user", uselist=False)
