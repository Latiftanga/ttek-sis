"""Add unique constraints to assessment_scores, term_results, attendance_records

Revision ID: d1e2f3a4b5c6
Revises: b9e1f2a3c4d5
Create Date: 2026-05-16

- UniqueConstraint on assessment_scores(assessment_id, student_id)
- UniqueConstraint on term_results(student_id, subject_id, term_id)
- UniqueConstraint on attendance_records(session_id, student_id)
"""
from typing import Sequence, Union
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "b9e1f2a3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_score_assessment_student",
        "assessment_scores",
        ["assessment_id", "student_id"],
    )
    op.create_unique_constraint(
        "uq_term_result",
        "term_results",
        ["student_id", "subject_id", "term_id"],
    )
    op.create_unique_constraint(
        "uq_attendance_session_student",
        "attendance_records",
        ["session_id", "student_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_attendance_session_student", "attendance_records", type_="unique")
    op.drop_constraint("uq_term_result", "term_results", type_="unique")
    op.drop_constraint("uq_score_assessment_student", "assessment_scores", type_="unique")
