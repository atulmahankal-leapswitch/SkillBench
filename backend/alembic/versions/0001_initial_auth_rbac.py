"""initial auth & rbac schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-09

Creates organizations, users, roles, permissions and their associations, then
seeds the permission catalog and default system roles from app.core.rbac.
"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.core.rbac import PERMISSIONS, SYSTEM_ROLES

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
CITEXT = postgresql.CITEXT()
NOW = sa.text("now()")
GEN_UUID = sa.text("gen_random_uuid()")


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("primary_domain", CITEXT, nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )

    op.create_table(
        "permissions",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("code", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.String(255), nullable=False, server_default=""),
    )

    op.create_table(
        "roles",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.String(255), nullable=False, server_default=""),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )

    op.create_table(
        "users",
        sa.Column("id", UUID, primary_key=True, server_default=GEN_UUID),
        sa.Column(
            "organization_id",
            UUID,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", CITEXT, nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(512), nullable=False, server_default=""),
        sa.Column("google_sub", sa.String(255), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=NOW),
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"])

    op.create_table(
        "role_permissions",
        sa.Column("role_id", UUID, sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", UUID, sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", UUID, sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    )

    _seed()


def _seed() -> None:
    perms_tbl = sa.table(
        "permissions",
        sa.column("id", UUID),
        sa.column("code", sa.String),
        sa.column("description", sa.String),
    )
    roles_tbl = sa.table(
        "roles",
        sa.column("id", UUID),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
        sa.column("is_system", sa.Boolean),
    )
    role_perms_tbl = sa.table(
        "role_permissions",
        sa.column("role_id", UUID),
        sa.column("permission_id", UUID),
    )

    perm_ids = {code: uuid.uuid4() for code in PERMISSIONS}
    op.bulk_insert(
        perms_tbl,
        [
            {"id": perm_ids[code], "code": code, "description": desc}
            for code, desc in PERMISSIONS.items()
        ],
    )

    role_rows = []
    link_rows = []
    for name, (desc, codes) in SYSTEM_ROLES.items():
        rid = uuid.uuid4()
        role_rows.append(
            {"id": rid, "name": name, "description": desc, "is_system": True}
        )
        for code in codes:
            link_rows.append({"role_id": rid, "permission_id": perm_ids[code]})

    op.bulk_insert(roles_tbl, role_rows)
    op.bulk_insert(role_perms_tbl, link_rows)


def downgrade() -> None:
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_table("users")
    op.drop_table("roles")
    op.drop_table("permissions")
    op.drop_table("organizations")
