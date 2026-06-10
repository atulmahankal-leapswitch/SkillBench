"""candidate job_title + stage

Revision ID: 0012_cand
Revises: 0011_cat
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_cand"
down_revision: Union[str, None] = "0011_cat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("job_title", sa.String(255), nullable=False, server_default=""))
    op.add_column("candidates", sa.Column("stage", sa.String(20), nullable=False, server_default="applied"))
    op.create_index("ix_candidates_stage", "candidates", ["stage"])


def downgrade() -> None:
    op.drop_index("ix_candidates_stage", table_name="candidates")
    op.drop_column("candidates", "stage")
    op.drop_column("candidates", "job_title")
