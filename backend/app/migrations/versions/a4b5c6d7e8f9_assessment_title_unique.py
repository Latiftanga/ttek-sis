"""Enforce unique assessment title per class/subject/term

Revision ID: a4b5c6d7e8f9
Revises: f3b4c5d6e7a8
Create Date: 2026-05-16

Adds UniqueConstraint on assessments(school_id, class_id, subject_id, term_id, title).
"""
from typing import Sequence, Union
from alembic import op

revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, None] = "f3b4c5d6e7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_assessment_title",
        "assessments",
        ["school_id", "class_id", "subject_id", "term_id", "title"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_assessment_title", "assessments", type_="unique")
