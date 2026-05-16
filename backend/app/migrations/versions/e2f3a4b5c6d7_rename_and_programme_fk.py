"""Rename promoted_to_id → next_enrollment_id; add classes.school_programme_id FK

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-16

- Rename enrollments.promoted_to_id to next_enrollment_id (items 4)
- Add classes.school_programme_id FK → school_programmes.id SET NULL (item 8)
- Backfill school_programme_id from existing programme strings
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Item 4: rename promoted_to_id → next_enrollment_id ───────────────
    op.alter_column(
        "enrollments",
        "promoted_to_id",
        new_column_name="next_enrollment_id",
    )

    # ── Item 8: add school_programme_id FK to classes ─────────────────────
    op.add_column(
        "classes",
        sa.Column(
            "school_programme_id",
            sa.UUID(),
            sa.ForeignKey("school_programmes.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # Backfill from existing programme strings (match on name OR short_name)
    op.execute("""
        UPDATE classes c
        SET school_programme_id = sp.id
        FROM school_programmes sp
        WHERE c.school_id = sp.school_id
          AND c.programme IS NOT NULL
          AND (sp.name = c.programme OR sp.short_name = c.programme)
          AND sp.is_active = true
    """)


def downgrade() -> None:
    op.drop_column("classes", "school_programme_id")

    op.alter_column(
        "enrollments",
        "next_enrollment_id",
        new_column_name="promoted_to_id",
    )
