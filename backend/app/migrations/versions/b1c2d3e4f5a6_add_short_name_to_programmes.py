"""add short_name to programmes

Revision ID: b1c2d3e4f5a6
Revises: 6aae545caf6d
Create Date: 2026-05-13 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = '6aae545caf6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('system_programmes', sa.Column('short_name', sa.String(length=20), nullable=True))
    op.add_column('school_programmes', sa.Column('short_name', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('school_programmes', 'short_name')
    op.drop_column('system_programmes', 'short_name')
