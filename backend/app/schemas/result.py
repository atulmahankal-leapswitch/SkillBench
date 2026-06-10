"""Result schemas (admin-facing)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import AttemptStatus


def _f(v: Any) -> Any:
    return float(v) if v is not None else v


class ResultSummary(BaseModel):
    """Row in the results list."""

    attempt_id: uuid.UUID
    candidate_name: str
    candidate_email: str
    test_title: str
    attempt_status: AttemptStatus
    total_points: float
    max_points: float
    percent: float
    passed: bool
    needs_review: bool
    submitted_at: datetime | None


class QuestionResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    points_awarded: float
    max_points: float
    is_correct: bool | None
    needs_review: bool
    feedback: str
    # Enriched in the route:
    prompt: str = ""
    type: str = ""
    response: dict[str, Any] = Field(default_factory=dict)
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("points_awarded", "max_points", mode="before")
    @classmethod
    def _dec(cls, v: Any) -> Any:
        return _f(v)


class ResultDetail(BaseModel):
    attempt_id: uuid.UUID
    candidate_name: str
    candidate_email: str
    test_title: str
    pass_mark: float
    attempt_status: AttemptStatus
    total_points: float
    max_points: float
    percent: float
    passed: bool
    needs_review: bool
    submitted_at: datetime | None
    graded_at: datetime | None
    questions: list[QuestionResultOut]


class OverrideUpdate(BaseModel):
    points_awarded: float = Field(ge=0)
    feedback: str = ""
