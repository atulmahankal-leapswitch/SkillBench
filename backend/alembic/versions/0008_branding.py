"""organization branding fields

Revision ID: 0008_brand
Revises: 0007_integ
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_brand"
down_revision: Union[str, None] = "0007_integ"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("display_name", sa.String(255), nullable=False, server_default=""))
    op.add_column("organizations", sa.Column("logo_url", sa.String(1024), nullable=False, server_default=""))
    op.add_column("organizations", sa.Column("brand_color", sa.String(20), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("organizations", "brand_color")
    op.drop_column("organizations", "logo_url")
    op.drop_column("organizations", "display_name")
