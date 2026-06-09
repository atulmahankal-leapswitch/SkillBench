"""User, Role, Permission models and their associations (RBAC)."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.organization import Organization

# ── Association tables ───────────────────────────────────────────────────────

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


# ── Entities ─────────────────────────────────────────────────────────────────


class Permission(Base):
    """A discrete capability, named "<resource>:<action>" (e.g. test:write)."""

    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="")

    roles: Mapped[list["Role"]] = relationship(
        secondary=role_permissions, back_populates="permissions"
    )


class Role(Base, TimestampMixin):
    """A named set of permissions. System roles ship seeded."""

    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions, back_populates="roles"
    )
    users: Mapped[list["User"]] = relationship(
        secondary=user_roles, back_populates="roles"
    )

    @property
    def permission_codes(self) -> set[str]:
        return {p.code for p in self.permissions}


class User(Base, TimestampMixin):
    """An admin/recruiter, authenticated via Google within their org domain."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(CITEXT(), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    google_sub: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    organization: Mapped["Organization"] = relationship(back_populates="users")
    roles: Mapped[list[Role]] = relationship(
        secondary=user_roles, back_populates="users", lazy="selectin"
    )

    @property
    def permission_codes(self) -> set[str]:
        codes: set[str] = set()
        for role in self.roles:
            codes |= role.permission_codes
        return codes
