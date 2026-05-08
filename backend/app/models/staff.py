import uuid
from sqlalchemy import Column, String, Text, Date, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Staff(Base):
    __tablename__ = "staff"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id    = Column(UUID(as_uuid=True),
                         ForeignKey("schools.id", ondelete="CASCADE"),
                         nullable=False)

    # Identity
    staff_number = Column(String(30))          # school-assigned staff ID
    first_name   = Column(String(100), nullable=False)
    middle_name  = Column(String(100))
    last_name    = Column(String(100), nullable=False)
    date_of_birth = Column(Date)
    gender       = Column(String(10))
    phone        = Column(String(20))
    photo_url    = Column(Text)

    # Employment
    title        = Column(String(50))          # "Mr" | "Mrs" | "Dr" etc.
    qualification = Column(String(200))        # "B.Ed Mathematics"
    specialization = Column(String(200))       # "Mathematics, Physics"
    date_joined  = Column(Date)
    status       = Column(String(20), default="active")
    # "active" | "on_leave" | "transferred" | "retired"

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(),
                         onupdate=func.now())

    # Relationships
    school       = relationship("School", back_populates="staff")
    user         = relationship("User", back_populates="staff", uselist=False)