"""widen organizations.logo_url to TEXT (store uploaded logo as data URL)

Revision ID: 0010_logo
Revises: 0009_ai
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_logo"
down_revision: Union[str, None] = "0009_ai"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "organizations", "logo_url", type_=sa.Text(), existing_nullable=False
    )


def downgrade() -> None:
    op.alter_column(
        "organizations", "logo_url", type_=sa.String(1024), existing_nullable=False
    )
