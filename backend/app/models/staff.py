import uuid
from sqlalchemy import Column, String, Text, Date, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class StaffQualification(Base):
    __tablename__ = "staff_qualifications"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    staff_id      = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)

    title         = Column(String(200), nullable=False)   # "B.Ed Mathematics"
    institution   = Column(String(200))                    # "University of Ghana"
    year_obtained = Column(Integer)
    cert_type     = Column(String(50))                    # degree|diploma|professional|short_course
    notes         = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    staff = relationship("Staff", back_populates="qualifications")


class StaffPromotion(Base):
    __tablename__ = "staff_promotions"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    staff_id       = Column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)

    from_rank      = Column(String(150))                   # null on first entry
    to_rank        = Column(String(150), nullable=False)
    effective_date = Column(Date, nullable=False)
    promotion_type = Column(String(30), default="substantive")  # substantive | acting
    reference_no   = Column(String(100))                   # GES/district letter reference
    notes          = Column(Text)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    staff = relationship("Staff", back_populates="promotions")


class Staff(Base):
    __tablename__ = "staff"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id      = Column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    # Identity
    staff_number   = Column(String(30))
    first_name     = Column(String(100), nullable=False)
    middle_name    = Column(String(100))
    last_name      = Column(String(100), nullable=False)
    date_of_birth  = Column(Date)
    gender         = Column(String(10))
    phone          = Column(String(20))
    photo_url      = Column(Text)

    # Employment
    title          = Column(String(50))    # honorific: Mr | Mrs | Ms | Dr | Prof
    license_number = Column(String(50))    # teaching licence number
    specialization = Column(String(200))   # "Mathematics, Physics"
    date_joined    = Column(Date)
    status         = Column(String(20), default="active")
    # active | on_leave | transferred | retired

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    school         = relationship("School", back_populates="staff")
    user           = relationship("User", back_populates="staff", uselist=False)
    qualifications = relationship(
        "StaffQualification", back_populates="staff",
        order_by="desc(StaffQualification.year_obtained)",
        cascade="all, delete-orphan",
    )
    promotions = relationship(
        "StaffPromotion", back_populates="staff",
        order_by="desc(StaffPromotion.effective_date)",
        cascade="all, delete-orphan",
    )

    @property
    def current_rank(self) -> str | None:
        """Derived from the most recent promotion — no stored column needed."""
        if self.promotions:
            return self.promotions[0].to_rank
        return None
