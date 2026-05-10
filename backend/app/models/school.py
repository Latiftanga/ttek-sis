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

    logo_url     = Column(Text)
    accent_color = Column(String(7), default="#1a6b3c")

    subscription = Column(String(20), default="trial")
    is_active    = Column(Boolean, default=True)
    settings     = Column(JSON, default=dict)
    # {
    #   "student_portal": {
    #     "basic_7_9": true,
    #     "shs": true,
    #     "basic_1_6": false,
    #     "kg": false
    #   }
    # }

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(),
                         onupdate=func.now())

    # ── Relationships ──────────────────────────────────────────────
    users                 = relationship("User", back_populates="school")
    students              = relationship("Student", back_populates="school")
    staff                 = relationship("Staff", back_populates="school")
    academic_years        = relationship("AcademicYear", back_populates="school")
    classes               = relationship("Class", back_populates="school")
    grading_scales        = relationship("GradingScale", back_populates="school",
                                         foreign_keys="GradingScale.school_id")
    assessment_categories = relationship("AssessmentCategory", back_populates="school")
    student_contacts      = relationship("StudentContact", back_populates="school")
    programmes            = relationship("SchoolProgramme", back_populates="school",
                                         order_by="SchoolProgramme.order")
    houses                = relationship("SchoolHouse", back_populates="school",
                                         order_by="SchoolHouse.order")
    periods               = relationship("SchoolPeriod", back_populates="school",
                                         order_by="SchoolPeriod.order")

    # ── School type helpers ────────────────────────────────────────
    @property
    def available_level_groups(self) -> list[str]:
        mapping = {
            "basic":    ["creche", "nursery", "kg", "basic"],
            "shs":      ["shs"],
            "combined": ["creche", "nursery", "kg", "basic", "shs"],
        }
        return mapping.get(self.school_type, ["basic"])

    @property
    def is_basic(self) -> bool:
        return self.school_type in ("basic", "combined")

    @property
    def is_shs(self) -> bool:
        return self.school_type in ("shs", "combined")

    @property
    def student_portal_config(self) -> dict:
        """
        Default portal access:
          basic school    → B7-B9 on, everything else off
          shs school      → SHS on
          combined        → B7-B9 + SHS on
        """
        defaults = {
            "basic_7_9": self.is_basic,
            "shs":       self.is_shs,
            "basic_1_6": False,
            "kg":        False,
        }
        stored = (self.settings or {}).get("student_portal", {})
        return {**defaults, **stored}

    def portal_enabled_for_level(
        self,
        level_group: str,
        level_number: int | None = None,
    ) -> bool:
        """
        Check if student portal is enabled for a class level.

          basic + level 7-9 → checks basic_7_9
          basic + level 1-6 → checks basic_1_6
          shs               → checks shs
          kg/nursery/creche → always False
        """
        config = self.student_portal_config
        if level_group == "basic":
            if level_number and level_number >= 7:
                return config.get("basic_7_9", False)
            return config.get("basic_1_6", False)
        if level_group == "shs":
            return config.get("shs", False)
        return False
