"""organization Google OAuth (admin sign-in) config

Revision ID: 0015_goauth
Revises: 0014_rec
Create Date: 2026-06-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_goauth"
down_revision: Union[str, None] = "0014_rec"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLS = [
    "google_oauth_client_id",
    "google_oauth_client_secret",
]


def upgrade() -> None:
    for name in _COLS:
        op.add_column(
            "organizations",
            sa.Column(name, sa.String(255), nullable=False, server_default=""),
        )


def downgrade() -> None:
    for name in _COLS:
        op.drop_column("organizations", name)
