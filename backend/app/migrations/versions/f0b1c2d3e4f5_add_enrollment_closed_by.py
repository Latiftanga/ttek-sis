"""add enrollments.closed_by

Revision ID: f0b1c2d3e4f5
Revises: e9a0b1c2d3e4
Create Date: 2026-05-17

End-of-year roll-over needs to know which user closed each enrollment.
The chain of (status, end_date, next_enrollment_id) already records
*what* happened; this adds *who* did it.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f0b1c2d3e4f5"
down_revision: Union[str, None] = "e9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enrollments",
        sa.Column("closed_by", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "enrollments_closed_by_fkey",
        "enrollments",
        "users",
        ["closed_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "enrollments_closed_by_fkey", "enrollments", type_="foreignkey",
    )
    op.drop_column("enrollments", "closed_by")
