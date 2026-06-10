"""Question schemas with per-type payload validation."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import Difficulty, QuestionType
from app.schemas.category import CategoryRef


# ── Type-specific payload shapes ─────────────────────────────────────────────
class McqOption(BaseModel):
    key: str = Field(min_length=1, max_length=10)
    text: str = Field(min_length=1)


class McqPayload(BaseModel):
    options: list[McqOption] = Field(min_length=2)
    correct_keys: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _correct_keys_exist(self) -> "McqPayload":
        keys = {o.key for o in self.options}
        unknown = set(self.correct_keys) - keys
        if unknown:
            raise ValueError(f"correct_keys not in options: {sorted(unknown)}")
        return self


class TextPayload(BaseModel):
    sample_answer: str = ""
    rubric: str = ""
    max_chars: int | None = None


class CodingTestCase(BaseModel):
    input: str = ""
    expected: str = ""
    hidden: bool = True


class CodingPayload(BaseModel):
    language_ids: list[int] = Field(default_factory=list)
    starter_code: dict[str, str] = Field(default_factory=dict)
    test_cases: list[CodingTestCase] = Field(default_factory=list)
    time_limit_ms: int = 5000
    memory_limit_kb: int = 256000


_PAYLOAD_MODELS: dict[QuestionType, type[BaseModel]] = {
    QuestionType.MCQ: McqPayload,
    QuestionType.MULTI_SELECT: McqPayload,
    QuestionType.TEXT: TextPayload,
    QuestionType.CODING: CodingPayload,
}


def validate_payload(qtype: QuestionType, payload: dict[str, Any]) -> dict:
    """Validate/normalise a payload for the given question type."""
    model = _PAYLOAD_MODELS[qtype]
    parsed = model.model_validate(payload or {})
    # For single-answer MCQ, enforce exactly one correct key.
    if qtype == QuestionType.MCQ and len(parsed.correct_keys) != 1:  # type: ignore[attr-defined]
        raise ValueError("mcq requires exactly one correct key")
    return parsed.model_dump()


# ── Request / response ───────────────────────────────────────────────────────
class QuestionBase(BaseModel):
    type: QuestionType
    prompt: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    difficulty: Difficulty = Difficulty.MEDIUM
    points: float = Field(default=1, ge=0)
    tags: list[str] = Field(default_factory=list)


class QuestionCreate(QuestionBase):
    category_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_payload(self) -> "QuestionCreate":
        self.payload = validate_payload(self.type, self.payload)
        return self


class QuestionUpdate(BaseModel):
    # Type is immutable after creation; payload validated against existing type
    # in the service layer when provided.
    prompt: str | None = Field(default=None, min_length=1)
    payload: dict[str, Any] | None = None
    difficulty: Difficulty | None = None
    points: float | None = Field(default=None, ge=0)
    tags: list[str] | None = None
    category_ids: list[uuid.UUID] | None = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: QuestionType
    prompt: str
    payload: dict[str, Any]
    difficulty: Difficulty
    points: float
    tags: list[str]
    categories: list[CategoryRef] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @field_validator("points", mode="before")
    @classmethod
    def _decimal_to_float(cls, v: Any) -> Any:
        return float(v) if v is not None else v
