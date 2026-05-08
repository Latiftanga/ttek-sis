import uuid
from sqlalchemy import Column, String, Text, Date, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id    = Column(UUID(as_uuid=True),
                         ForeignKey("schools.id", ondelete="CASCADE"),
                         nullable=False)
    student_id   = Column(UUID(as_uuid=True),
                         ForeignKey("students.id", ondelete="CASCADE"),
                         nullable=False)
    class_id     = Column(UUID(as_uuid=True),
                         ForeignKey("classes.id"),
                         nullable=False)
    term_id      = Column(UUID(as_uuid=True),
                         ForeignKey("terms.id"),
                         nullable=False)
    date         = Column(Date, nullable=False)
    status       = Column(String(10), nullable=False, default="present")
    # "present" | "absent" | "late" | "excused"
    reason       = Column(Text)                 # for absent/excused
    recorded_by  = Column(UUID(as_uuid=True),
                         ForeignKey("users.id"))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    # No updated_at — attendance records should not be silently edited
    # Any correction creates a new record with a note