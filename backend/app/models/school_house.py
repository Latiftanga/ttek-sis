import uuid
from sqlalchemy import Boolean, Column, String, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class SchoolHouse(Base):
    """
    School houses — e.g. Unity, Victory, Faith, Hope.
    Optional — only schools that use the house system add these.
    If no houses defined, house column is free text in upload template.
    """
    __tablename__ = "school_houses"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id  = Column(UUID(as_uuid=True),
                       ForeignKey("schools.id", ondelete="CASCADE"),
                       nullable=False)
    name       = Column(String(100), nullable=False)
    color      = Column(String(7), nullable=True)   # optional house color
    order      = Column(Integer, default=1)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school     = relationship("School", back_populates="houses")
