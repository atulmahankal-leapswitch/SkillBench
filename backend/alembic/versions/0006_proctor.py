"""proctor_events

Revision ID: 0006_proctor
Revises: 0005_results
Create Date: 2026-06-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_proctor"
down_revision: Union[str, None] = "0005_results"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB()
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")
EMPTY_JSON = sa.text("'{}'::jsonb")


def upgrade() -> None:
    op.create_table(
        "proctor_events",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_id", UUID, sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("meta", JSONB, nullable=False, server_default=EMPTY_JSON),
    )
    op.create_index("ix_proctor_events_organization_id", "proctor_events", ["organization_id"])
    op.create_index("ix_proctor_events_attempt_id", "proctor_events", ["attempt_id"])


def downgrade() -> None:
    op.drop_index("ix_proctor_events_attempt_id", table_name="proctor_events")
    op.drop_index("ix_proctor_events_organization_id", table_name="proctor_events")
    op.drop_table("proctor_events")
