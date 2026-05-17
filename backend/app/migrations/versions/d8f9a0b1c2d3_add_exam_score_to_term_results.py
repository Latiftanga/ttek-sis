"""add exam_score to term_results

Revision ID: d8f9a0b1c2d3
Revises: c7e8f9a0b1c2
Create Date: 2026-05-17

Term-result computation now separates CA contribution from Exam contribution.
Previously `ca_score` was just `raw_score / 2` for JHS/SHS, which lost the
real CA vs Exam split. New behavior:
  ca_score   = weighted sum of CA category contributions (out of CA-weight total)
  exam_score = weighted sum of non-CA category contributions
  raw_score  = ca_score + exam_score (out of 100 when all categories scored)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "d8f9a0b1c2d3"
down_revision: Union[str, None] = "c7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "term_results",
        sa.Column("exam_score", sa.Numeric(precision=5, scale=2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("term_results", "exam_score")
