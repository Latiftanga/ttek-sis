import uuid
from sqlalchemy import (
    Boolean, Column, String, Text,
    Numeric, Integer, ForeignKey, DateTime, Date, UniqueConstraint, Index, func, text
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
    grades      = relationship("Grade",
                               back_populates="scale",
                               cascade="all, delete-orphan",
                               order_by="Grade.order")


class Grade(Base):
    """One letter grade and its score range within a scale (e.g. A1, B2)."""
    __tablename__ = "grades"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scale_id    = Column(UUID(as_uuid=True),
                        ForeignKey("grading_scales.id", ondelete="CASCADE"),
                        nullable=False)
    min_score   = Column(Numeric(5, 2), nullable=False)
    max_score   = Column(Numeric(5, 2), nullable=False)
    label       = Column(String(20), nullable=False)
    remark      = Column(String(50))
    order       = Column(Integer, nullable=False)

    scale       = relationship("GradingScale", back_populates="grades")


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
    # True  → counts toward continuous assessment
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
    __table_args__ = (
        # Partial unique index — prevents the same category on the same date
        # for the same class/subject/term. NULLs (undated) are excluded so
        # that undated assessments don't collide at the DB level (the
        # allows_multiple application check covers that path instead).
        Index(
            "uix_assessment_category_date",
            "school_id", "class_id", "subject_id", "term_id", "category_id", "date_administered",
            unique=True,
            postgresql_where=text("date_administered IS NOT NULL"),
        ),
    )

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

    description       = Column(Text, nullable=True)
    # Optional teacher note: "Algebra I Week 1-4", "Climate Change project"
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
    __table_args__ = (
        UniqueConstraint("assessment_id", "student_id", name="uq_score_assessment_student"),
    )

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

    # Audit trail — critical for downstream trust
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
    """
    __tablename__ = "term_results"
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "term_id", name="uq_term_result"),
    )

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
    # ca_score + exam_score. Out of 100 when all categories scored.

    ca_score      = Column(Numeric(5, 2))
    # Weighted sum of CA category contributions for this term.
    # Out of (sum of CA category weights) — typically 50 for JHS/SHS, 100 for CA-only primary.

    exam_score    = Column(Numeric(5, 2))
    # Weighted sum of non-CA (exam) category contributions for this term.
    # Out of (sum of non-CA weights) — typically 50 for JHS/SHS, None for CA-only schools.

    grade         = Column(String(10))
    # "A1" ... "F9" for JHS/SHS | "1"..."5" for Primary

    remark        = Column(String(50))
    # "Excellent" | "Credit" | "Fail" etc.

    position      = Column(Integer)
    # Class position for this subject this term

    is_computed   = Column(Boolean, default=False)
    is_submitted  = Column(Boolean, default=False)
    # True → locked after external submission

    computed_at   = Column(DateTime(timezone=True))
    computed_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(),
                          onupdate=func.now())

class TermReportCard(Base):
    """
    The "soft" portions of a report card — skill ratings and the two
    free-text remarks that the class teacher and headteacher write at
    end of term. One row per student per term.

    Skill ratings are stored as small ints 1-5 where 1=Excellent and
    5=Poor (so larger = worse, matching the column order on the printed
    card). NULL = not yet rated.
    """
    __tablename__ = "term_report_cards"
    __table_args__ = (
        UniqueConstraint("student_id", "term_id", name="uq_term_report_card"),
    )

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id           = Column(UUID(as_uuid=True),
                                ForeignKey("schools.id", ondelete="CASCADE"),
                                nullable=False)
    student_id          = Column(UUID(as_uuid=True),
                                ForeignKey("students.id", ondelete="CASCADE"),
                                nullable=False)
    term_id             = Column(UUID(as_uuid=True),
                                ForeignKey("terms.id", ondelete="CASCADE"),
                                nullable=False)

    # Skill ratings: 1 (Excellent) … 5 (Poor). NULL = not rated yet.
    punctuality         = Column(Integer)
    neatness            = Column(Integer)
    conduct             = Column(Integer)
    cooperation         = Column(Integer)
    participation       = Column(Integer)

    # Free-text remarks — printed on the card, also returned to parents
    # via the public verify endpoint.
    class_teacher_remark = Column(Text)
    headteacher_remark   = Column(Text)

    # Audit
    updated_by          = Column(UUID(as_uuid=True),
                                ForeignKey("users.id"),
                                nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(),
                                onupdate=func.now())


class ScoreEditLog(Base):
    """
    Immutable audit log — one row per score change.
    Never deleted. Never updated. Append only.
    This is what makes the system auditable downstream.
    """
    __tablename__ = "score_edit_logs"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id           = Column(UUID(as_uuid=True),
                                ForeignKey("schools.id", ondelete="CASCADE"),
                                nullable=False)
    assessment_score_id = Column(UUID(as_uuid=True),
                                ForeignKey("assessment_scores.id"),
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
