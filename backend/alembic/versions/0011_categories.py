"""categories, test blueprints, attempt questions

Revision ID: 0011_cat
Revises: 0010_logo
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_cat"
down_revision: Union[str, None] = "0010_logo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.UniqueConstraint("organization_id", "name", name="uq_category_org_name"),
    )
    op.create_index("ix_categories_organization_id", "categories", ["organization_id"])

    op.create_table(
        "question_categories",
        sa.Column("question_id", UUID, sa.ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("category_id", UUID, sa.ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "test_blueprints",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("test_id", UUID, sa.ForeignKey("tests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", UUID, sa.ForeignKey("categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("difficulty", sa.String(10), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("test_id", "category_id", "difficulty", name="uq_blueprint_cat_diff"),
    )
    op.create_index("ix_test_blueprints_test_id", "test_blueprints", ["test_id"])

    op.create_table(
        "attempt_questions",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("attempt_id", UUID, sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", UUID, sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("points", sa.Numeric(6, 2), nullable=False, server_default="1"),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question_sel"),
    )
    op.create_index("ix_attempt_questions_attempt_id", "attempt_questions", ["attempt_id"])


def downgrade() -> None:
    op.drop_index("ix_attempt_questions_attempt_id", table_name="attempt_questions")
    op.drop_table("attempt_questions")
    op.drop_index("ix_test_blueprints_test_id", table_name="test_blueprints")
    op.drop_table("test_blueprints")
    op.drop_table("question_categories")
    op.drop_index("ix_categories_organization_id", table_name="categories")
    op.drop_table("categories")
