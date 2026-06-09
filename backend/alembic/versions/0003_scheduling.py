"""scheduling: schedules + invitations

Revision ID: 0003_sched
Revises: 0002_core
Create Date: 2026-06-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_sched"
down_revision: Union[str, None] = "0002_core"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")


def upgrade() -> None:
    op.create_table(
        "schedules",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_id", UUID, sa.ForeignKey("tests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", UUID, sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_schedules_organization_id", "schedules", ["organization_id"])
    op.create_index("ix_schedules_status", "schedules", ["status"])

    op.create_table(
        "invitations",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("schedule_id", UUID, sa.ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_invitations_token", "invitations", ["token"])


def downgrade() -> None:
    op.drop_index("ix_invitations_token", table_name="invitations")
    op.drop_table("invitations")
    op.drop_index("ix_schedules_status", table_name="schedules")
    op.drop_index("ix_schedules_organization_id", table_name="schedules")
    op.drop_table("schedules")
