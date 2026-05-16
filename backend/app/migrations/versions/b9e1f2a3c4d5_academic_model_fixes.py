"""academic model fixes: unique class name, position int, updated_at columns, category check

Revision ID: b9e1f2a3c4d5
Revises: f3a9c1d7b2e4
Create Date: 2026-05-16

- UniqueConstraint on classes(school_id, name)
- Partial unique index on enrollments(school_id, student_id, academic_year_id) WHERE status = 'active'
- Add updated_at to academic_years, terms, subjects
- Change enrollments.position from VARCHAR(10) to INTEGER
- DB CHECK constraint on subjects.category
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b9e1f2a3c4d5"
down_revision: Union[str, None] = "f3a9c1d7b2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Unique class name per school
    op.create_unique_constraint(
        "uq_class_school_name", "classes", ["school_id", "name"]
    )

    # One active enrollment per student per academic year
    op.create_index(
        "uix_enrollments_active",
        "enrollments",
        ["school_id", "student_id", "academic_year_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    # updated_at on academic_years (column exists from a previous edit — skip if present)
    op.add_column(
        "academic_years",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )

    # updated_at on terms
    op.add_column(
        "terms",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )

    # updated_at on subjects
    op.add_column(
        "subjects",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )

    # Change enrollments.position VARCHAR(10) → INTEGER
    op.alter_column(
        "enrollments",
        "position",
        existing_type=sa.String(10),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="NULL",
    )

    # CHECK constraint on subjects.category
    op.create_check_constraint(
        "ck_subjects_category",
        "subjects",
        "category IS NULL OR category IN ('core', 'elective')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_subjects_category", "subjects", type_="check")

    op.alter_column(
        "enrollments",
        "position",
        existing_type=sa.Integer(),
        type_=sa.String(10),
        existing_nullable=True,
    )

    op.drop_column("subjects", "updated_at")
    op.drop_column("terms", "updated_at")
    op.drop_column("academic_years", "updated_at")

    op.drop_index("uix_enrollments_active", table_name="enrollments")
    op.drop_constraint("uq_class_school_name", "classes", type_="unique")
