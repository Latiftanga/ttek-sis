"""Add name uniqueness and is_current race-safety constraints to academic_years and terms

Revision ID: f3b4c5d6e7a8
Revises: e2f3a4b5c6d7
Create Date: 2026-05-16

- UniqueConstraint on academic_years(school_id, name)           — item 10
- UniqueConstraint on terms(school_id, academic_year_id, name)  — item 10
- Partial unique index on academic_years(school_id) WHERE is_current IS TRUE  — item 9
- Partial unique index on terms(school_id)          WHERE is_current IS TRUE  — item 9
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f3b4c5d6e7a8"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Item 10: name uniqueness ──────────────────────────────────────────
    op.create_unique_constraint(
        "uq_academic_year_school_name",
        "academic_years",
        ["school_id", "name"],
    )
    op.create_unique_constraint(
        "uq_term_school_year_name",
        "terms",
        ["school_id", "academic_year_id", "name"],
    )

    # ── Item 9: one is_current row per school ─────────────────────────────
    op.create_index(
        "uix_current_academic_year",
        "academic_years",
        ["school_id"],
        unique=True,
        postgresql_where=sa.text("is_current IS TRUE"),
    )
    op.create_index(
        "uix_current_term",
        "terms",
        ["school_id"],
        unique=True,
        postgresql_where=sa.text("is_current IS TRUE"),
    )


def downgrade() -> None:
    op.drop_index("uix_current_term", table_name="terms")
    op.drop_index("uix_current_academic_year", table_name="academic_years")
    op.drop_constraint("uq_term_school_year_name", "terms", type_="unique")
    op.drop_constraint("uq_academic_year_school_name", "academic_years", type_="unique")
