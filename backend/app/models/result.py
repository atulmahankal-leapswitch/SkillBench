"""Grading results: per-attempt aggregate + per-question breakdown."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, uuid_pk

if TYPE_CHECKING:
    pass


class Result(Base, TimestampMixin):
    __tablename__ = "results"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    total_points: Mapped[float] = mapped_column(Numeric(8, 2), default=0, nullable=False)
    max_points: Mapped[float] = mapped_column(Numeric(8, 2), default=0, nullable=False)
    percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # True until all needs_review questions have been graded by a human.
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    graded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    questions: Mapped[list["QuestionResult"]] = relationship(
        back_populates="result", cascade="all, delete-orphan", lazy="selectin"
    )


class QuestionResult(Base, TimestampMixin):
    __tablename__ = "question_results"

    id: Mapped[uuid.UUID] = uuid_pk()
    result_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    points_awarded: Mapped[float] = mapped_column(Numeric(8, 2), default=0, nullable=False)
    max_points: Mapped[float] = mapped_column(Numeric(8, 2), default=0, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, default="", nullable=False)

    result: Mapped[Result] = relationship(back_populates="questions")
