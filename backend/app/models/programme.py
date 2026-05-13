import uuid
from sqlalchemy import Boolean, Column, String, Text, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class SystemProgramme(Base):
    """
    Seeded by Tagnatek — GES standard SHS programmes.
    Schools see these as suggestions when setting up.
    Read-only reference data.
    """
    __tablename__ = "system_programmes"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(100), unique=True, nullable=False)
    short_name  = Column(String(20), nullable=True)   # e.g. "SC", "ART", "BUS"
    description = Column(Text)
    order       = Column(Integer, default=1)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class SchoolProgramme(Base):
    """
    School's own programme list.
    Created from SystemProgramme suggestions on registration
    or built from scratch by the school admin.

    Only applies to SHS and combined schools.
    Used when creating SHS classes.
    """
    __tablename__ = "school_programmes"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id   = Column(UUID(as_uuid=True),
                        ForeignKey("schools.id", ondelete="CASCADE"),
                        nullable=False)
    name        = Column(String(100), nullable=False)
    short_name  = Column(String(20), nullable=True)   # e.g. "SC", "ART", "BUS"
    description = Column(Text)
    order       = Column(Integer, default=1)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    school      = relationship("School", back_populates="programmes")
