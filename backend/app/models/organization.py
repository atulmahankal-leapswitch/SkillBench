"""Organization (tenant) model."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Text
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
    # White-label branding for the candidate experience.
    display_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    # Holds either a URL or an uploaded image as a data URL (hence Text).
    logo_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    brand_color: Mapped[str] = mapped_column(String(20), default="", nullable=False)

    # AI provider configuration (overrides env defaults when set).
    ai_provider: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    ai_model: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    ai_api_key: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    # Screen-recording storage. provider: "" (disabled) | "local" | "s3".
    recording_provider: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    recording_s3_bucket: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    recording_s3_region: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    recording_s3_endpoint: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    recording_s3_access_key: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    recording_s3_secret: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    # Screen-recording storage. provider: "" (disabled) | "local" | "s3".
    recording_provider: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    recording_s3_bucket: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    recording_s3_region: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    recording_s3_endpoint: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    recording_s3_access_key: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    recording_s3_secret: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    users: Mapped[list["User"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
