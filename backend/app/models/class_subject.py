import uuid
from sqlalchemy import (
    Column, Integer, ForeignKey, DateTime, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ClassSubject(Base):
    """
    Subjects offered in a specific class, with the staff member who teaches each.

    One row per (class, subject). teacher_id is nullable — admins can add a
    subject to the curriculum before assigning a teacher.
    """
    __tablename__ = "class_subjects"
    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),
    )

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id  = Column(UUID(as_uuid=True),
                       ForeignKey("schools.id", ondelete="CASCADE"),
                       nullable=False)
    class_id   = Column(UUID(as_uuid=True),
                       ForeignKey("classes.id", ondelete="CASCADE"),
                       nullable=False)
    subject_id = Column(UUID(as_uuid=True),
                       ForeignKey("subjects.id", ondelete="CASCADE"),
                       nullable=False)
    teacher_id = Column(UUID(as_uuid=True),
                       ForeignKey("staff.id", ondelete="SET NULL"),
                       nullable=True)
    order      = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                       onupdate=func.now())

    # Relationships
    class_  = relationship("Class", back_populates="class_subjects")
    subject = relationship("Subject")
    teacher = relationship("Staff")
