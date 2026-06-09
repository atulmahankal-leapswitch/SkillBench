"""Organization (tenant) model."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.user import User


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Primary email domain that grants membership (e.g. "leapswitch.com").
    primary_domain: Mapped[str] = mapped_column(
        CITEXT(), unique=True, nullable=False
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
