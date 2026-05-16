"""Drop assessment title; add category+date partial unique index

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-05-16

- Drops the free-text `title` column (display is now derived from
  category name + date_administered at render time).
- Drops the old uq_assessment_title constraint.
- Adds `description` (optional teacher note, e.g. "Algebra I Week 1-4").
- Adds a partial unique index on
  (school_id, class_id, subject_id, term_id, category_id, date_administered)
  WHERE date_administered IS NOT NULL — preventing the same category from
  being administered twice on the same day for the same class/subject/term.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old title-based unique constraint
    op.drop_constraint("uq_assessment_title", "assessments", type_="unique")

    # Drop title column
    op.drop_column("assessments", "title")

    # Add optional description column
    op.add_column(
        "assessments",
        sa.Column("description", sa.Text(), nullable=True),
    )

    # Add partial unique index: one category per date per class/subject/term
    op.create_index(
        "uix_assessment_category_date",
        "assessments",
        ["school_id", "class_id", "subject_id", "term_id", "category_id", "date_administered"],
        unique=True,
        postgresql_where=sa.text("date_administered IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uix_assessment_category_date", table_name="assessments")
    op.drop_column("assessments", "description")
    op.add_column(
        "assessments",
        sa.Column("title", sa.String(150), nullable=False, server_default="restored"),
    )
    op.create_unique_constraint(
        "uq_assessment_title",
        "assessments",
        ["school_id", "class_id", "subject_id", "term_id", "title"],
    )
