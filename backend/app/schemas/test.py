"""Test schemas, including the ordered question list."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import TestStatus
from app.schemas.question import QuestionOut


class TestQuestionRef(BaseModel):
    """A question to include in a test, with order and optional weight."""

    question_id: uuid.UUID
    position: int = 0
    weight: float | None = Field(default=None, ge=0)


class TestBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    duration_minutes: int = Field(default=60, ge=1)
    pass_mark: float = Field(default=60, ge=0, le=100)
    settings: dict[str, Any] = Field(default_factory=dict)


class TestCreate(TestBase):
    questions: list[TestQuestionRef] = Field(default_factory=list)


class TestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    pass_mark: float | None = Field(default=None, ge=0, le=100)
    status: TestStatus | None = None
    settings: dict[str, Any] | None = None
    # When provided, replaces the entire question set.
    questions: list[TestQuestionRef] | None = None


class TestQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    weight: float | None
    question: QuestionOut

    @field_validator("weight", mode="before")
    @classmethod
    def _decimal_to_float(cls, v: Any) -> Any:
        return float(v) if v is not None else v


class TestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    duration_minutes: int
    pass_mark: float
    status: TestStatus
    settings: dict[str, Any]
    questions: list[TestQuestionOut]
    created_at: datetime
    updated_at: datetime

    @field_validator("pass_mark", mode="before")
    @classmethod
    def _decimal_to_float(cls, v: Any) -> Any:
        return float(v) if v is not None else v


class TestSummaryOut(BaseModel):
    """Lighter test representation for list views (no full question payloads)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    duration_minutes: int
    pass_mark: float
    status: TestStatus
    question_count: int = 0
    created_at: datetime
    updated_at: datetime

    @field_validator("pass_mark", mode="before")
    @classmethod
    def _decimal_to_float(cls, v: Any) -> Any:
        return float(v) if v is not None else v
