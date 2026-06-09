"""AI feature request/response schemas."""

from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import Difficulty, QuestionType


class GenerateQuestionsRequest(BaseModel):
    topic: str = Field(min_length=1)
    type: QuestionType = QuestionType.MCQ
    difficulty: Difficulty = Difficulty.MEDIUM
    count: int = Field(default=3, ge=1, le=20)


class GeneratedQuestion(BaseModel):
    type: str
    prompt: str
    difficulty: str = "medium"
    payload: dict[str, Any] = Field(default_factory=dict)


class GenerateQuestionsResponse(BaseModel):
    provider: str
    questions: list[GeneratedQuestion]


class ScoreTextRequest(BaseModel):
    prompt: str
    answer: str
    rubric: str = ""
    sample_answer: str = ""
    max_points: float = Field(default=1, ge=0)


class ScoreTextResponse(BaseModel):
    provider: str
    score: float
    rationale: str = ""
