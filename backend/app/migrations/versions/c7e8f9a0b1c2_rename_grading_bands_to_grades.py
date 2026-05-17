"""rename grading_bands to grades; rename grade_label fields

Revision ID: c7e8f9a0b1c2
Revises: b5c6d7e8f9a0
Create Date: 2026-05-17

User-facing terminology cleanup. "Grading band" was internal jargon — a
single row in the lookup table is a Grade (e.g. A1, B2). The TermResult
column `grade_label` similarly stores the resolved letter and is renamed
to `grade` so report-card code reads `result.grade`.

- grading_bands table → grades
- grading_bands.grade_label column → label
- term_results.grade_label column → grade
- FK constraint grading_bands_scale_id_fkey → grades_scale_id_fkey
  (PostgreSQL auto-renames PKs when the table renames, but not FKs.)
"""
from typing import Sequence, Union
from alembic import op

revision: str = "c7e8f9a0b1c2"
down_revision: Union[str, None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE grading_bands "
        "RENAME CONSTRAINT grading_bands_scale_id_fkey TO grades_scale_id_fkey"
    )
    op.rename_table("grading_bands", "grades")
    op.alter_column("grades", "grade_label", new_column_name="label")
    op.alter_column("term_results", "grade_label", new_column_name="grade")


def downgrade() -> None:
    op.alter_column("term_results", "grade", new_column_name="grade_label")
    op.alter_column("grades", "label", new_column_name="grade_label")
    op.rename_table("grades", "grading_bands")
    op.execute(
        "ALTER TABLE grading_bands "
        "RENAME CONSTRAINT grades_scale_id_fkey TO grading_bands_scale_id_fkey"
    )
