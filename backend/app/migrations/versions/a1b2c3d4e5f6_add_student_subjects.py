"""add student_subjects table

Revision ID: a1b2c3d4e5f6
Revises: 670d981cd433
Create Date: 2026-05-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '670d981cd433'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'student_subjects',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('enrollment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'],
                                ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('enrollment_id', 'subject_id',
                            name='uq_student_subject'),
    )
    op.create_index('ix_student_subjects_enrollment_id', 'student_subjects',
                    ['enrollment_id'])
    op.create_index('ix_student_subjects_subject_id', 'student_subjects',
                    ['subject_id'])


def downgrade() -> None:
    op.drop_index('ix_student_subjects_subject_id',
                  table_name='student_subjects')
    op.drop_index('ix_student_subjects_enrollment_id',
                  table_name='student_subjects')
    op.drop_table('student_subjects')
