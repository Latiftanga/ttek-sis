"""remove cascade from score_edit_logs to preserve audit trail

Revision ID: 508212573685
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16

ScoreEditLog is intentionally append-only. The previous CASCADE meant deleting
an AssessmentScore silently destroyed its audit trail, defeating the purpose.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "508212573685"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "score_edit_logs_assessment_score_id_fkey",
        "score_edit_logs",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "score_edit_logs_assessment_score_id_fkey",
        "score_edit_logs",
        "assessment_scores",
        ["assessment_score_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "score_edit_logs_assessment_score_id_fkey",
        "score_edit_logs",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "score_edit_logs_assessment_score_id_fkey",
        "score_edit_logs",
        "assessment_scores",
        ["assessment_score_id"],
        ["id"],
        ondelete="CASCADE",
    )
