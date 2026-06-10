"""Candidate model and the user↔candidate assignment link."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.dialects.postgresql import ARRAY, CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, uuid_pk
from app.models.enums import CandidateSource, CandidateStage, CandidateStatus

if TYPE_CHECKING:
    from app.models.user import User

# Which users (recruiters) are assigned to manage which candidates.
user_candidate_assignments = Table(
    "user_candidate_assignments",
    Base.metadata,
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "candidate_id",
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Candidate(Base, TimestampMixin):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(CITEXT(), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    job_title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    source: Mapped[str] = mapped_column(
        String(20), default=CandidateSource.EXTERNAL, nullable=False
    )
    stage: Mapped[str] = mapped_column(
        String(20), default=CandidateStage.APPLIED, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default=CandidateStatus.ACTIVE, nullable=False
    )
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False, server_default="{}"
    )
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    assignees: Mapped[list["User"]] = relationship(
        secondary=user_candidate_assignments, lazy="selectin"
    )
