"""results + question_results

Revision ID: 0005_results
Revises: 0004_attempt
Create Date: 2026-06-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_results"
down_revision: Union[str, None] = "0004_attempt"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")


def upgrade() -> None:
    op.create_table(
        "results",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_id", UUID, sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("total_points", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("max_points", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("passed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_results_organization_id", "results", ["organization_id"])

    op.create_table(
        "question_results",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("result_id", UUID, sa.ForeignKey("results.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", UUID, sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("points_awarded", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("max_points", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("feedback", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_question_results_result_id", "question_results", ["result_id"])


def downgrade() -> None:
    op.drop_index("ix_question_results_result_id", table_name="question_results")
    op.drop_table("question_results")
    op.drop_index("ix_results_organization_id", table_name="results")
    op.drop_table("results")
