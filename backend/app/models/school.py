import uuid
from sqlalchemy import Boolean, Column, String, Text, JSON, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class School(Base):
    __tablename__ = "schools"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name         = Column(String(200), nullable=False)
    slug         = Column(String(60), unique=True, nullable=False)
    school_type  = Column(String(20), nullable=False, default="basic")
    # "basic" | "shs" | "combined"

    region       = Column(String(100))
    district     = Column(String(100))
    address      = Column(Text)
    phone        = Column(String(20))
    email        = Column(String(200))

    # Branding — each school feels like it owns the app
    logo_url     = Column(Text)
    accent_color = Column(String(7), default="#1a6b3c")

    subscription = Column(String(20), default="trial")
    # "trial" | "basic" | "pro"
    is_active    = Column(Boolean, default=True)
    settings     = Column(JSON, default=dict)

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(),
                         onupdate=func.now())

    # Relationships
    users             = relationship("User", back_populates="school")
    students          = relationship("Student", back_populates="school")
    academic_years    = relationship("AcademicYear", back_populates="school")
    classes           = relationship("Class", back_populates="school")
    staff                = relationship("Staff", back_populates="school")
    grading_scales       = relationship("GradingScale", back_populates="school",
                                        foreign_keys="GradingScale.school_id")
    assessment_categories = relationship("AssessmentCategory", back_populates="school")
    student_contacts     = relationship("StudentContact", back_populates="school")