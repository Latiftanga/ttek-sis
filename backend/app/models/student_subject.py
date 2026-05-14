import uuid
from sqlalchemy import Column, ForeignKey, DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class StudentSubject(Base):
    """
    Tracks which elective subjects a student has chosen for a given enrollment.
    Core subjects apply to all students in the class and don't need a record here.
    """
    __tablename__ = "student_subjects"
    __table_args__ = (
        UniqueConstraint("enrollment_id", "subject_id", name="uq_student_subject"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id     = Column(UUID(as_uuid=True),
                          ForeignKey("schools.id", ondelete="CASCADE"),
                          nullable=False)
    enrollment_id = Column(UUID(as_uuid=True),
                          ForeignKey("enrollments.id", ondelete="CASCADE"),
                          nullable=False)
    subject_id    = Column(UUID(as_uuid=True),
                          ForeignKey("subjects.id", ondelete="CASCADE"),
                          nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    enrollment = relationship("Enrollment", back_populates="student_subjects")
    subject    = relationship("Subject")
