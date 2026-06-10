"""organization AI provider settings

Revision ID: 0009_ai
Revises: 0008_brand
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_ai"
down_revision: Union[str, None] = "0008_brand"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("ai_provider", sa.String(40), nullable=False, server_default=""))
    op.add_column("organizations", sa.Column("ai_model", sa.String(80), nullable=False, server_default=""))
    op.add_column("organizations", sa.Column("ai_api_key", sa.String(255), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("organizations", "ai_api_key")
    op.drop_column("organizations", "ai_model")
    op.drop_column("organizations", "ai_provider")
