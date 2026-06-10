"""api keys + webhooks

Revision ID: 0007_integ
Revises: 0006_proctor
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_integ"
down_revision: Union[str, None] = "0006_proctor"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
STR_ARRAY = postgresql.ARRAY(sa.String())
JSONB = postgresql.JSONB()
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")
EMPTY_ARRAY = sa.text("'{}'::text[]")
EMPTY_JSON = sa.text("'{}'::jsonb")


def upgrade() -> None:
    op.create_table(
        "api_keys",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("prefix", sa.String(16), nullable=False),
        sa.Column("scopes", STR_ARRAY, nullable=False, server_default=EMPTY_ARRAY),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_api_keys_organization_id", "api_keys", ["organization_id"])
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"])

    op.create_table(
        "webhooks",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("secret", sa.String(64), nullable=False),
        sa.Column("events", STR_ARRAY, nullable=False, server_default=EMPTY_ARRAY),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_webhooks_organization_id", "webhooks", ["organization_id"])

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("webhook_id", UUID, sa.ForeignKey("webhooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event", sa.String(60), nullable=False),
        sa.Column("payload", JSONB, nullable=False, server_default=EMPTY_JSON),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_webhook_deliveries_webhook_id", "webhook_deliveries", ["webhook_id"])


def downgrade() -> None:
    op.drop_index("ix_webhook_deliveries_webhook_id", table_name="webhook_deliveries")
    op.drop_table("webhook_deliveries")
    op.drop_index("ix_webhooks_organization_id", table_name="webhooks")
    op.drop_table("webhooks")
    op.drop_index("ix_api_keys_key_hash", table_name="api_keys")
    op.drop_index("ix_api_keys_organization_id", table_name="api_keys")
    op.drop_table("api_keys")
