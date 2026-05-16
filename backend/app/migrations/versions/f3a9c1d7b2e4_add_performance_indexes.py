"""add indexes on high-cardinality filter columns

Revision ID: f3a9c1d7b2e4
Revises: 508212573685
Create Date: 2026-05-16

These indexes cover the most common query patterns: fetching records by
session, filtering assessments/results by class+term, and attendance
lookups by class+date. Without them, full table scans occur at school scale.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "f3a9c1d7b2e4"
down_revision: Union[str, None] = "508212573685"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_attendance_records_session_id",
        "attendance_records", ["session_id"]
    )
    op.create_index(
        "ix_attendance_sessions_class_date",
        "attendance_sessions", ["class_id", "date"]
    )
    op.create_index(
        "ix_assessment_scores_assessment_id",
        "assessment_scores", ["assessment_id"]
    )
    op.create_index(
        "ix_assessment_scores_student_id",
        "assessment_scores", ["student_id"]
    )
    op.create_index(
        "ix_term_results_class_term",
        "term_results", ["class_id", "term_id"]
    )
    op.create_index(
        "ix_enrollments_class_year",
        "enrollments", ["class_id", "academic_year_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_enrollments_class_year", table_name="enrollments")
    op.drop_index("ix_term_results_class_term", table_name="term_results")
    op.drop_index("ix_assessment_scores_student_id", table_name="assessment_scores")
    op.drop_index("ix_assessment_scores_assessment_id", table_name="assessment_scores")
    op.drop_index("ix_attendance_sessions_class_date", table_name="attendance_sessions")
    op.drop_index("ix_attendance_records_session_id", table_name="attendance_records")
