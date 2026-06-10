"""attempt time_credit_seconds (connection-drop pause credit)

Revision ID: 0013_pause
Revises: 0012_cand
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_pause"
down_revision: Union[str, None] = "0012_cand"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attempts",
        sa.Column("time_credit_seconds", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("attempts", "time_credit_seconds")
