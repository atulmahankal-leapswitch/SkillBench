"""core entities: candidates, questions, tests

Revision ID: 0002_core
Revises: 0001_initial
Create Date: 2026-06-09

Adds candidates (+ user assignment link), questions, tests and the ordered
test↔question membership table.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_core"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
CITEXT = postgresql.CITEXT()
JSONB = postgresql.JSONB()
STR_ARRAY = postgresql.ARRAY(sa.String())
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")
EMPTY_ARRAY = sa.text("'{}'::text[]")
EMPTY_JSON = sa.text("'{}'::jsonb")


def upgrade() -> None:
    op.create_table(
        "candidates",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", CITEXT, nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="external"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("tags", STR_ARRAY, nullable=False, server_default=EMPTY_ARRAY),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_candidates_organization_id", "candidates", ["organization_id"])
    op.create_index("ix_candidates_email", "candidates", ["email"])

    op.create_table(
        "user_candidate_assignments",
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("candidate_id", UUID, sa.ForeignKey("candidates.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "questions",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("payload", JSONB, nullable=False, server_default=EMPTY_JSON),
        sa.Column("difficulty", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("points", sa.Numeric(6, 2), nullable=False, server_default="1"),
        sa.Column("tags", STR_ARRAY, nullable=False, server_default=EMPTY_ARRAY),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_questions_organization_id", "questions", ["organization_id"])
    op.create_index("ix_questions_type", "questions", ["type"])
    op.create_index("ix_questions_difficulty", "questions", ["difficulty"])

    op.create_table(
        "tests",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("pass_mark", sa.Numeric(5, 2), nullable=False, server_default="60"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("settings", JSONB, nullable=False, server_default=EMPTY_JSON),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_tests_organization_id", "tests", ["organization_id"])
    op.create_index("ix_tests_status", "tests", ["status"])

    op.create_table(
        "test_questions",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("test_id", UUID, sa.ForeignKey("tests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", UUID, sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("weight", sa.Numeric(6, 2), nullable=True),
        sa.UniqueConstraint("test_id", "question_id", name="uq_test_question"),
    )
    op.create_index("ix_test_questions_test_id", "test_questions", ["test_id"])


def downgrade() -> None:
    op.drop_index("ix_test_questions_test_id", table_name="test_questions")
    op.drop_table("test_questions")
    op.drop_index("ix_tests_status", table_name="tests")
    op.drop_index("ix_tests_organization_id", table_name="tests")
    op.drop_table("tests")
    op.drop_index("ix_questions_difficulty", table_name="questions")
    op.drop_index("ix_questions_type", table_name="questions")
    op.drop_index("ix_questions_organization_id", table_name="questions")
    op.drop_table("questions")
    op.drop_table("user_candidate_assignments")
    op.drop_index("ix_candidates_email", table_name="candidates")
    op.drop_index("ix_candidates_organization_id", table_name="candidates")
    op.drop_table("candidates")
