"""add term_report_cards table

Revision ID: e9a0b1c2d3e4
Revises: d8f9a0b1c2d3
Create Date: 2026-05-17

Holds the "soft" portions of a report card: 5 skill ratings (Punctuality,
Neatness, Conduct, Cooperation, Class Participation, each 1-5 where
1=Excellent) plus class-teacher and headteacher free-text remarks.
One row per (student, term).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e9a0b1c2d3e4"
down_revision: Union[str, None] = "d8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "term_report_cards",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("term_id", sa.UUID(), nullable=False),
        sa.Column("punctuality", sa.Integer(), nullable=True),
        sa.Column("neatness", sa.Integer(), nullable=True),
        sa.Column("conduct", sa.Integer(), nullable=True),
        sa.Column("cooperation", sa.Integer(), nullable=True),
        sa.Column("participation", sa.Integer(), nullable=True),
        sa.Column("class_teacher_remark", sa.Text(), nullable=True),
        sa.Column("headteacher_remark", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["term_id"], ["terms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "term_id", name="uq_term_report_card"),
    )


def downgrade() -> None:
    op.drop_table("term_report_cards")
