"""Similarity + integrity scoring combining plagiarism and proctoring signals."""

import re
import uuid
from difflib import SequenceMatcher

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Answer, Attempt
from app.models.enums import QuestionType
from app.models.question import Question
from app.models.user import User
from app.services import proctoring

SIMILARITY_FLAG = 0.85
# Proctoring events weighted by how suspicious they are.
EVENT_WEIGHTS = {
    "paste": 15,
    "tab_blur": 8,
    "focus_loss": 6,
    "fullscreen_exit": 8,
    "webcam_denied": 20,
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _answer_text(response: dict) -> str:
    return (response or {}).get("text") or (response or {}).get("code") or ""


def similarity(a: str, b: str) -> float:
    a, b = _normalize(a), _normalize(b)
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


async def _admin_attempt(db: AsyncSession, user: User, attempt_id: uuid.UUID) -> Attempt:
    attempt = (
        await db.execute(
            select(Attempt).where(
                Attempt.id == attempt_id,
                Attempt.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if attempt is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Attempt not found")
    return attempt


async def find_similar(db: AsyncSession, user: User, attempt: Attempt) -> list[dict]:
    """For each free-text/coding answer, the most similar other submission."""
    matches: list[dict] = []
    for ans in attempt.answers:
        q = (
            await db.execute(select(Question).where(Question.id == ans.question_id))
        ).scalar_one_or_none()
        if q is None or QuestionType(q.type) not in (
            QuestionType.TEXT,
            QuestionType.CODING,
        ):
            continue
        mine = _answer_text(ans.response)
        if not mine:
            continue
        # Other candidates' answers to the same question, same org.
        others = (
            await db.execute(
                select(Answer, Attempt)
                .join(Attempt, Answer.attempt_id == Attempt.id)
                .where(
                    Answer.question_id == ans.question_id,
                    Answer.attempt_id != attempt.id,
                    Attempt.organization_id == user.organization_id,
                )
            )
        ).all()
        best = 0.0
        best_attempt = None
        for other_ans, other_att in others:
            ratio = similarity(mine, _answer_text(other_ans.response))
            if ratio > best:
                best, best_attempt = ratio, other_att
        if best_attempt is not None:
            matches.append(
                {
                    "question_id": str(ans.question_id),
                    "max_similarity": round(best, 3),
                    "similar_attempt_id": str(best_attempt.id),
                    "flagged": best >= SIMILARITY_FLAG,
                }
            )
    return matches


async def integrity(db: AsyncSession, user: User, attempt_id: uuid.UUID) -> dict:
    attempt = await _admin_attempt(db, user, attempt_id)
    counts = await proctoring.summary(db, user, attempt_id)
    matches = await find_similar(db, user, attempt)

    max_sim = max((m["max_similarity"] for m in matches), default=0.0)
    sim_score = min(60, int(max_sim * 60)) if max_sim >= 0.5 else 0
    proctor_score = min(
        40, sum(EVENT_WEIGHTS.get(t, 0) * n for t, n in counts.items())
    )
    risk = sim_score + proctor_score
    level = "high" if risk >= 60 else "medium" if risk >= 30 else "low"

    return {
        "attempt_id": str(attempt_id),
        "risk_score": risk,
        "level": level,
        "max_similarity": round(max_sim, 3),
        "proctoring": counts,
        "matches": matches,
    }
