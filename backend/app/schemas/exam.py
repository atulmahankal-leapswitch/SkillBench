"""Candidate-facing exam schemas. Never expose correct answers here."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.enums import AttemptStatus, QuestionType
from app.models.question import Question
from app.models.test import TestQuestion


class PublicQuestion(BaseModel):
    id: uuid.UUID
    type: QuestionType
    prompt: str
    points: float
    # mcq / multi_select
    options: list[dict[str, str]] | None = None
    multiple: bool = False
    # text
    max_chars: int | None = None
    # coding
    starter_code: dict[str, str] | None = None
    language_ids: list[int] | None = None
    sample_test_cases: list[dict[str, str]] | None = None


def build_public_question(tq: TestQuestion) -> PublicQuestion:
    q: Question = tq.question
    points = float(tq.weight) if tq.weight is not None else float(q.points)
    payload = q.payload or {}
    pub = PublicQuestion(id=q.id, type=QuestionType(q.type), prompt=q.prompt, points=points)
    if q.type in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
        pub.options = [
            {"key": o["key"], "text": o["text"]} for o in payload.get("options", [])
        ]
        pub.multiple = q.type == QuestionType.MULTI_SELECT
    elif q.type == QuestionType.TEXT:
        pub.max_chars = payload.get("max_chars")
    elif q.type == QuestionType.CODING:
        pub.starter_code = payload.get("starter_code", {})
        pub.language_ids = payload.get("language_ids", [])
        # Only non-hidden sample cases are exposed.
        pub.sample_test_cases = [
            {"input": tc.get("input", ""), "expected": tc.get("expected", "")}
            for tc in payload.get("test_cases", [])
            if not tc.get("hidden", True)
        ]
    return pub


class ExamState(BaseModel):
    status: AttemptStatus
    test_title: str
    candidate_name: str
    duration_minutes: int
    started_at: datetime | None
    expires_at: datetime | None
    server_now: datetime
    remaining_seconds: int
    # Only populated once the attempt has started.
    questions: list[PublicQuestion]
    answers: dict[str, Any]
    # Per-test proctoring toggles (webcam, tab_switch, fullscreen, block_copy_paste).
    proctoring: dict[str, Any] = {}


class AnswerSubmit(BaseModel):
    question_id: uuid.UUID
    response: dict[str, Any]


class RunRequest(BaseModel):
    question_id: uuid.UUID
    language: str
    code: str


class RunCaseResult(BaseModel):
    passed: bool
    status: str
    stdout: str
    stderr: str


class RunResponse(BaseModel):
    results: list[RunCaseResult]
