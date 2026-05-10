import uuid
from sqlalchemy import (
    Boolean, Column, String, Text,
    Numeric, Integer, ForeignKey, DateTime, Date, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


# ══════════════════════════════════════════════════════════════════════════
# GRADING SCALES
# ══════════════════════════════════════════════════════════════════════════

class GradingScale(Base):
    __tablename__ = "grading_scales"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id   = Column(UUID(as_uuid=True),
                        ForeignKey("schools.id", ondelete="CASCADE"),
                        nullable=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    school      = relationship("School", back_populates="grading_scales",
                               foreign_keys=[school_id])   # ← add this
    bands       = relationship("GradingBand",
                               back_populates="scale",
                               cascade="all, delete-orphan",
                               order_by="GradingBand.order")


class GradingBand(Base):
    """One grade label and its score range within a scale."""
    __tablename__ = "grading_bands"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scale_id    = Column(UUID(as_uuid=True),
                        ForeignKey("grading_scales.id", ondelete="CASCADE"),
                        nullable=False)
    min_score   = Column(Numeric(5, 2), nullable=False)
    max_score   = Column(Numeric(5, 2), nullable=False)
    grade_label = Column(String(20), nullable=False)
    remark      = Column(String(50))
    order       = Column(Integer, nullable=False)

    scale       = relationship("GradingScale", back_populates="bands")


# ══════════════════════════════════════════════════════════════════════════
# ASSESSMENT CATEGORIES
# ══════════════════════════════════════════════════════════════════════════

class AssessmentCategory(Base):
    """
    School-defined assessment types and their weights toward the term score.
    e.g. Class Test 60%, Group Exercise 20%, Project Work 20%
    """
    __tablename__ = "assessment_categories"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id       = Column(UUID(as_uuid=True),
                            ForeignKey("schools.id", ondelete="CASCADE"),
                            nullable=False)
    name            = Column(String(100), nullable=False)
    weight          = Column(Numeric(5, 2), nullable=False)
    max_score       = Column(Numeric(5, 2), nullable=False, default=100)
    is_ca           = Column(Boolean, default=True)
    # True  → counts toward WAEC CA submission
    # False → school internal only (e.g. End of Term Exam)
    allows_multiple = Column(Boolean, default=True)
    # True  → many instances allowed (Class Test 1, 2, 3 ...)
    # False → one per term only (End of Term Exam)
    order           = Column(Integer, default=1)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    school          = relationship("School", back_populates="assessment_categories")
    assessments     = relationship("Assessment", back_populates="category")


# ══════════════════════════════════════════════════════════════════════════
# ASSESSMENTS
# ══════════════════════════════════════════════════════════════════════════

class Assessment(Base):
    """
    One specific assessment event.
    e.g. "Class Test 1, Core Maths, JHS 2A, Term 1, 20 Sept 2024"
    """
    __tablename__ = "assessments"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id         = Column(UUID(as_uuid=True),
                              ForeignKey("schools.id", ondelete="CASCADE"),
                              nullable=False)
    category_id       = Column(UUID(as_uuid=True),
                              ForeignKey("assessment_categories.id"),
                              nullable=False)
    class_id          = Column(UUID(as_uuid=True),
                              ForeignKey("classes.id"),
                              nullable=False)
    subject_id        = Column(UUID(as_uuid=True),
                              ForeignKey("subjects.id"),
                              nullable=False)
    term_id           = Column(UUID(as_uuid=True),
                              ForeignKey("terms.id"),
                              nullable=False)

    title             = Column(String(150), nullable=False)
    # "Class Test 1" | "Group Exercise — Climate Change"
    date_administered = Column(Date, nullable=True)
    max_score         = Column(Numeric(5, 2), nullable=False)

    created_by        = Column(UUID(as_uuid=True),
                              ForeignKey("users.id"),
                              nullable=False)
    is_published      = Column(Boolean, default=False)
    # False → scores not visible to students yet
    # True  → students can see their score in portal

    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(),
                              onupdate=func.now())

    category          = relationship("AssessmentCategory", back_populates="assessments")
    scores            = relationship("AssessmentScore",
                                    back_populates="assessment",
                                    cascade="all, delete-orphan")


class AssessmentScore(Base):
    """
    One student's score on one assessment.
    Atomic unit — one row per student per assessment.
    """
    __tablename__ = "assessment_scores"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id      = Column(UUID(as_uuid=True),
                           ForeignKey("schools.id", ondelete="CASCADE"),
                           nullable=False)
    assessment_id  = Column(UUID(as_uuid=True),
                           ForeignKey("assessments.id", ondelete="CASCADE"),
                           nullable=False)
    student_id     = Column(UUID(as_uuid=True),
                           ForeignKey("students.id", ondelete="CASCADE"),
                           nullable=False)

    score          = Column(Numeric(5, 2), nullable=True)
    # NULL = not yet recorded
    is_absent      = Column(Boolean, default=False)
    remarks        = Column(Text)

    # Audit trail — critical for WAEC trust later
    recorded_by    = Column(UUID(as_uuid=True),
                           ForeignKey("users.id"),
                           nullable=False)
    recorded_at    = Column(DateTime(timezone=True), server_default=func.now())
    is_edited      = Column(Boolean, default=False)
    original_score = Column(Numeric(5, 2), nullable=True)
    edit_count     = Column(Integer, default=0)

    last_edited_by = Column(UUID(as_uuid=True),
                           ForeignKey("users.id"),
                           nullable=True)
    last_edited_at = Column(DateTime(timezone=True), nullable=True)
    edit_reason    = Column(Text, nullable=True)
    # Required when changing a score after first save

    assessment     = relationship("Assessment", back_populates="scores")


# ══════════════════════════════════════════════════════════════════════════
# TERM RESULT
# ══════════════════════════════════════════════════════════════════════════

class TermResult(Base):
    """
    Computed at end of term per student per subject.
    Never entered manually — always computed from AssessmentScores.
    This is what appears on the report card.
    This is what WAEC will receive as CA in Phase 3.
    """
    __tablename__ = "term_results"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id     = Column(UUID(as_uuid=True),
                          ForeignKey("schools.id", ondelete="CASCADE"),
                          nullable=False)
    student_id    = Column(UUID(as_uuid=True),
                          ForeignKey("students.id", ondelete="CASCADE"),
                          nullable=False)
    subject_id    = Column(UUID(as_uuid=True),
                          ForeignKey("subjects.id"),
                          nullable=False)
    term_id       = Column(UUID(as_uuid=True),
                          ForeignKey("terms.id"),
                          nullable=False)
    class_id      = Column(UUID(as_uuid=True),
                          ForeignKey("classes.id"),
                          nullable=False)

    raw_score     = Column(Numeric(5, 2))
    # Weighted average across all AssessmentScores this term

    ca_score      = Column(Numeric(5, 2))
    # Scaled to 50 for JHS/SHS — same as raw_score for primary

    grade_label   = Column(String(10))
    # "A1" ... "F9" for JHS/SHS | "1"..."5" for Primary

    remark        = Column(String(50))
    # "Excellent" | "Credit" | "Fail" etc.

    position      = Column(Integer)
    # Class position for this subject this term

    is_computed   = Column(Boolean, default=False)
    is_submitted  = Column(Boolean, default=False)
    # True → locked, submitted to WAEC (Phase 3)

    computed_at   = Column(DateTime(timezone=True))
    computed_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(),
                          onupdate=func.now())

class ScoreEditLog(Base):
    """
    Immutable audit log — one row per score change.
    Never deleted. Never updated. Append only.
    This is what makes the system trustworthy for WAEC later.
    """
    __tablename__ = "score_edit_logs"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id           = Column(UUID(as_uuid=True),
                                ForeignKey("schools.id", ondelete="CASCADE"),
                                nullable=False)
    assessment_score_id = Column(UUID(as_uuid=True),
                                ForeignKey("assessment_scores.id", ondelete="CASCADE"),
                                nullable=False)
    changed_by          = Column(UUID(as_uuid=True),
                                ForeignKey("users.id"),
                                nullable=False)
    changed_at          = Column(DateTime(timezone=True),
                                server_default=func.now(),
                                nullable=False)
    # Server timestamp — cannot be faked

    old_score           = Column(Numeric(5, 2), nullable=True)
    new_score           = Column(Numeric(5, 2), nullable=True)
    old_is_absent       = Column(Boolean, default=False)
    new_is_absent       = Column(Boolean, default=False)
    reason              = Column(Text, nullable=True)

    # Context flags — for suspicious activity report
    is_after_submission = Column(Boolean, default=False)
    # True if assessment was already published when edit happened

    is_after_lock       = Column(Boolean, default=False)
    # True if term results were locked when edit happened

    # Extra accountability
    changed_at_hour     = Column(Integer, nullable=True)
    # Hour of day (0-23) stored for anomaly detection
    # e.g. edits at 23:00 are suspicious
