"""Question model. Type-specific data lives in the JSONB `payload`."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, uuid_pk
from app.models.enums import Difficulty, QuestionType


class Question(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # Type-specific structure: MCQ options + correct keys, coding test cases, …
    payload: Mapped[dict] = mapped_column(
        JSONB, default=dict, nullable=False, server_default="{}"
    )
    difficulty: Mapped[str] = mapped_column(
        String(10), default=Difficulty.MEDIUM, nullable=False, index=True
    )
    points: Mapped[float] = mapped_column(
        Numeric(6, 2), default=1, nullable=False
    )
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False, server_default="{}"
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Convenience: enum view of the stored string.
    @property
    def type_enum(self) -> QuestionType:
        return QuestionType(self.type)
