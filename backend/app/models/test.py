"""Test model and its ordered association to questions."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, uuid_pk
from app.models.enums import TestStatus
from app.models.question import Question

if TYPE_CHECKING:
    from app.models.category import Category


class TestQuestion(Base):
    """Ordered, weighted membership of a question within a test."""

    __tablename__ = "test_questions"
    __table_args__ = (
        UniqueConstraint("test_id", "question_id", name="uq_test_question"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Optional per-test override of the question's base points.
    weight: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)

    question: Mapped[Question] = relationship(lazy="joined")


class TestBlueprint(Base):
    """A category × difficulty rule: draw `count` random questions at exam time."""

    __tablename__ = "test_blueprints"
    __table_args__ = (
        UniqueConstraint(
            "test_id", "category_id", "difficulty", name="uq_blueprint_cat_diff"
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
    )
    difficulty: Mapped[str] = mapped_column(String(10), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    category: Mapped["Category"] = relationship(lazy="joined")

    @property
    def category_name(self) -> str:
        return self.category.name if self.category else ""


class Test(Base, TimestampMixin):
    __tablename__ = "tests"

    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    duration_minutes: Mapped[int] = mapped_column(
        Integer, default=60, nullable=False
    )
    pass_mark: Mapped[float] = mapped_column(
        Numeric(5, 2), default=60, nullable=False
    )  # percent
    status: Mapped[str] = mapped_column(
        String(20), default=TestStatus.DRAFT, nullable=False, index=True
    )
    # Proctoring toggles and other per-test settings.
    settings: Mapped[dict] = mapped_column(
        JSONB, default=dict, nullable=False, server_default="{}"
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    questions: Mapped[list[TestQuestion]] = relationship(
        cascade="all, delete-orphan",
        order_by="TestQuestion.position",
        lazy="selectin",
    )
    blueprints: Mapped[list[TestBlueprint]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

    # Alias so the `blueprint` response field maps from `blueprints`.
    @property
    def blueprint(self) -> list[TestBlueprint]:
        return self.blueprints
