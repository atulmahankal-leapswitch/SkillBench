"""attempts + answers

Revision ID: 0004_attempt
Revises: 0003_sched
Create Date: 2026-06-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_attempt"
down_revision: Union[str, None] = "0003_sched"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB()
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")
EMPTY_JSON = sa.text("'{}'::jsonb")


def upgrade() -> None:
    op.create_table(
        "attempts",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("schedule_id", UUID, sa.ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_attempts_organization_id", "attempts", ["organization_id"])
    op.create_index("ix_attempts_status", "attempts", ["status"])

    op.create_table(
        "answers",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("attempt_id", UUID, sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", UUID, sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("response", JSONB, nullable=False, server_default=EMPTY_JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question"),
    )
    op.create_index("ix_answers_attempt_id", "answers", ["attempt_id"])


def downgrade() -> None:
    op.drop_index("ix_answers_attempt_id", table_name="answers")
    op.drop_table("answers")
    op.drop_index("ix_attempts_status", table_name="attempts")
    op.drop_index("ix_attempts_organization_id", table_name="attempts")
    op.drop_table("attempts")
