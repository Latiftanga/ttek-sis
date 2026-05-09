"""attendance performance indices

Revision ID: a1b2c3d4e5f6
Revises: cbd1eced9c59
Create Date: 2026-05-09 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cbd1eced9c59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # School-wide daily snapshots
    op.create_index(
        'ix_attendance_sessions_school_date',
        'attendance_sessions',
        ['school_id', 'date'],
    )
    # Class today dashboard
    op.create_index(
        'ix_attendance_sessions_class_date_status',
        'attendance_sessions',
        ['class_id', 'date', 'status'],
    )
    # Flagged sessions review queue
    op.create_index(
        'ix_attendance_sessions_flagged',
        'attendance_sessions',
        ['school_id', 'is_flagged', 'review_outcome'],
    )
    # Student term summary queries
    op.create_index(
        'ix_attendance_records_student_school',
        'attendance_records',
        ['student_id', 'school_id'],
    )
    # Session records lookup
    op.create_index(
        'ix_attendance_records_session',
        'attendance_records',
        ['session_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_attendance_sessions_school_date', 'attendance_sessions')
    op.drop_index('ix_attendance_sessions_class_date_status', 'attendance_sessions')
    op.drop_index('ix_attendance_sessions_flagged', 'attendance_sessions')
    op.drop_index('ix_attendance_records_student_school', 'attendance_records')
    op.drop_index('ix_attendance_records_session', 'attendance_records')
