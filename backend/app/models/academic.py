import uuid
from sqlalchemy import (
    Boolean, Column, String, Integer,
    ForeignKey, DateTime, Date, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


# ── Ghana education level groups ──────────────────────────────────────────
# Used as choices when creating a class
LEVEL_GROUPS = {
    "creche":   {"label": "Creche",   "levels": []},       # no numbered levels
    "nursery":  {"label": "Nursery",  "levels": []},       # no numbered levels
    "kg":       {"label": "KG",       "levels": [1, 2]},
    "primary":  {"label": "Primary",  "levels": [1,2,3,4,5,6]},
    "jhs":      {"label": "JHS",      "levels": [1, 2, 3]},
    "shs":      {"label": "SHS",      "levels": [1, 2, 3]},
}

SHS_PROGRAMMES = [
    "General Science",
    "General Arts",
    "Business",
    "Home Economics",
    "Technical",
    "Visual Arts",
    "Agriculture",
]


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id  = Column(UUID(as_uuid=True),
                       ForeignKey("schools.id", ondelete="CASCADE"),
                       nullable=False)
    name       = Column(String(20), nullable=False)    # "2024/2025"
    start_date = Column(Date, nullable=False)
    end_date   = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school     = relationship("School", back_populates="academic_years")
    terms      = relationship("Term", back_populates="academic_year",
                             cascade="all, delete-orphan")


class Term(Base):
    __tablename__ = "terms"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id        = Column(UUID(as_uuid=True),
                             ForeignKey("schools.id", ondelete="CASCADE"),
                             nullable=False)
    academic_year_id = Column(UUID(as_uuid=True),
                             ForeignKey("academic_years.id", ondelete="CASCADE"),
                             nullable=False)
    name             = Column(String(20), nullable=False)
    # "Term 1" | "Term 2" | "Term 3"
    start_date       = Column(Date, nullable=False)
    end_date         = Column(Date, nullable=False)
    is_current       = Column(Boolean, default=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    academic_year    = relationship("AcademicYear", back_populates="terms")


class Class(Base):
    __tablename__ = "classes"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id        = Column(UUID(as_uuid=True),
                             ForeignKey("schools.id", ondelete="CASCADE"),
                             nullable=False)

    # ── The three choices when creating a class ───────────────────
    level_group      = Column(String(20), nullable=False)
    # "creche" | "nursery" | "kg" | "primary" | "jhs" | "shs"

    level_number     = Column(Integer, nullable=True)
    # kg → 1,2 | primary → 1-6 | jhs → 1-3 | shs → 1-3

    stream           = Column(String(5), nullable=True)
    # "A" | "B" | "C" | None

    programme        = Column(String(100), nullable=True)
    # SHS only: "General Science" | "Business" | "General Arts" etc.

    # Auto-generated: "JHS 2A", "Primary 4B", "SHS 1 Science A"
    name             = Column(String(100), nullable=False)

    # ── Permanent fixtures ────────────────────────────────────────
    class_teacher_id = Column(UUID(as_uuid=True),
                             ForeignKey("staff.id"),
                             nullable=True)
    # Note: class teacher can change each year but class itself remains

    capacity         = Column(Integer, default=45)
    is_active        = Column(Boolean, default=True)
    # False = class no longer in use (e.g. school lost a classroom)

    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    school           = relationship("School", back_populates="classes")
    class_teacher    = relationship("Staff")
    enrollments      = relationship("Enrollment", back_populates="class_")

    @staticmethod
    def generate_name(
        level_group: str,
        level_number: int | None,
        stream: str | None,
        programme: str | None
    ) -> str:
        group_labels = {
            "creche":  "Creche",
            "nursery": "Nursery",
            "kg":      "KG",
            "basic": "Basic",
            "jhs":     "JHS",
            "shs":     "SHS",
        }
        label = group_labels.get(level_group, level_group.upper())

        if level_group in ("creche", "nursery"):
            return f"{label} {stream}" if stream else label

        name = f"{label} {level_number}"

        if level_group == "shs" and programme:
            short = programme.replace("General ", "")
            name = f"{name} {short}"

        if stream:
            name = f"{name}{stream}"

        return name


class Subject(Base):
    __tablename__ = "subjects"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id   = Column(UUID(as_uuid=True),
                        ForeignKey("schools.id", ondelete="CASCADE"),
                        nullable=False)
    name        = Column(String(150), nullable=False)   # "Core Mathematics"
    code        = Column(String(20))                    # "MATH"
    category    = Column(String(20), default="core")
    # "core" | "elective" | "vocational"
    level_group = Column(String(20), default="all")
    # "all" | "primary" | "jhs" | "shs" — which level this subject belongs to
    created_at  = Column(DateTime(timezone=True), server_default=func.now())