"""organization screen-recording storage config

Revision ID: 0014_rec
Revises: 0013_pause
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_rec"
down_revision: Union[str, None] = "0013_pause"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLS = [
    ("recording_provider", sa.String(20)),
    ("recording_s3_bucket", sa.String(255)),
    ("recording_s3_region", sa.String(64)),
    ("recording_s3_endpoint", sa.String(512)),
    ("recording_s3_access_key", sa.String(255)),
    ("recording_s3_secret", sa.String(255)),
]


def upgrade() -> None:
    for name, type_ in _COLS:
        op.add_column(
            "organizations",
            sa.Column(name, type_, nullable=False, server_default=""),
        )


def downgrade() -> None:
    for name, _ in reversed(_COLS):
        op.drop_column("organizations", name)
