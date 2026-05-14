import uuid
from sqlalchemy import (
    Boolean, Column, String, Integer,
    ForeignKey, DateTime, Date, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


# ── Ghana education structure (official GES naming) ───────────────────────
# Aligned to the CCP curriculum reform (Basic = unified B1–B9).
# Pre-School: 0 = Creche, 1 = Nursery 1, 2 = Nursery 2
LEVEL_GROUPS = {
    "preschool": {"label": "Pre-School", "short_name": "PRE", "levels": [0, 1, 2]},
    "kg":        {"label": "Kindergarten", "short_name": "KG", "levels": [1, 2]},
    "basic":     {"label": "Basic School", "short_name": "BS", "levels": list(range(1, 10))},
    "shs":       {"label": "Senior High School", "short_name": "SHS", "levels": [1, 2, 3]},
}

# Basic 7-9 → BECE grading (CA submitted to WAEC)
BASIC_BECE_LEVELS = [7, 8, 9]


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

    level_group      = Column(String(20), nullable=False)
    # "preschool" | "kg" | "basic" | "shs"

    level_number     = Column(Integer, nullable=True)
    # preschool → 0 (Creche), 1 (Nursery 1), 2 (Nursery 2)
    # kg        → 1, 2
    # basic     → 1-9
    # shs       → 1, 2, 3

    stream           = Column(String(30), nullable=True)

    programme        = Column(String(100), nullable=True)
    # SHS only: "General Science" | "Business" | "General Arts" etc.

    # Auto-generated display name — stored for fast queries
    name             = Column(String(100), nullable=False)

    class_teacher_id = Column(UUID(as_uuid=True),
                             ForeignKey("staff.id"),
                             nullable=True)
    capacity         = Column(Integer, default=45)
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    school           = relationship("School", back_populates="classes")
    class_teacher    = relationship("Staff")
    enrollments      = relationship("Enrollment", back_populates="class_")
    class_subjects   = relationship(
        "ClassSubject", back_populates="class_",
        cascade="all, delete-orphan",
        order_by="ClassSubject.order",
    )

    @staticmethod
    def generate_name(
        level_group: str,
        level_number: int | None,
        stream: str | None,
        programme: str | None,
    ) -> str:
        """
        Generates official GES display name.

        Examples:
          preschool, 0, None, None   → "Creche"
          preschool, 0, "A",  None   → "Creche A"
          preschool, 1, None, None   → "Nursery 1"
          preschool, 2, "B",  None   → "Nursery 2B"
          kg,        2, "A",  None   → "KG 2A"
          basic,     4, "B",  None   → "Basic 4B"
          shs,       1, "A",  "SC"   → "1SC A"
          shs,       2, "B",  "ART"  → "2ART B"
          shs,       1, None, "BUS"  → "1BUS"
        """
        # Pre-School: 0 = Creche, 1+ = Nursery N
        if level_group == "preschool":
            if level_number == 0:
                return f"Creche {stream}" if stream else "Creche"
            name = f"Nursery {level_number}"
            if stream:
                name = f"{name}{stream}"
            return name

        # SHS — format is "{level_number}{programme} {stream}", e.g. "1SC A"
        if level_group == "shs":
            name = f"{level_number}"
            if programme:
                name = f"{name}{programme}"
            if stream:
                name = f"{name} {stream}"
            return name

        # KG / Basic — "{Label} {level_number}{stream}"
        labels = {"kg": "KG", "basic": "Basic"}
        label = labels.get(level_group, level_group.upper())
        name = f"{label} {level_number}"
        if stream:
            name = f"{name}{stream}"
        return name

    @property
    def is_bece_level(self) -> bool:
        """Basic 7, 8, 9 — BECE CA applies."""
        return (
            self.level_group == "basic"
            and self.level_number in BASIC_BECE_LEVELS
        )

    @property
    def is_wassce_level(self) -> bool:
        """SHS 1, 2, 3 — WASSCE SBA applies."""
        return self.level_group == "shs"

    @property
    def applicable_grading_scale_hint(self) -> str:
        """Hints which system grading scale applies to this class."""
        if self.level_group in ("preschool", "kg"):
            return "KG / Nursery"
        if self.level_group == "basic":
            if self.level_number and self.level_number in BASIC_BECE_LEVELS:
                return "BECE / WASSCE"
            return "Primary GES"
        if self.level_group == "shs":
            return "BECE / WASSCE"
        return "Primary GES"


class Subject(Base):
    __tablename__ = "subjects"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id   = Column(UUID(as_uuid=True),
                        ForeignKey("schools.id", ondelete="CASCADE"),
                        nullable=True)
    name        = Column(String(150), nullable=False)
    code        = Column(String(20))
    category    = Column(String(20), default="core")
    # "core" | "elective" | "vocational"
    level_group = Column(String(20), default="all")
    # "all" | "basic" | "shs"
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
