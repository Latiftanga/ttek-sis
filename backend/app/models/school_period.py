import uuid
from sqlalchemy import Boolean, Column, String, Integer, ForeignKey, DateTime, Time, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class SchoolPeriod(Base):
    """
    School-defined periods — same every day.
    Only used when school attendance_mode = per_lesson.
    School admin configures these once and edits as needed.
    """
    __tablename__ = "school_periods"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id  = Column(UUID(as_uuid=True),
                       ForeignKey("schools.id", ondelete="CASCADE"),
                       nullable=False)
    name       = Column(String(50), nullable=False)
    # "Assembly" | "Period 1" | "Period 2" | "Break" | "Period 3"
    start_time = Column(Time, nullable=False)
    end_time   = Column(Time, nullable=False)
    order      = Column(Integer, nullable=False)
    is_break   = Column(Boolean, default=False)
    # Break periods cannot have attendance sessions
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school     = relationship("School", back_populates="periods")
