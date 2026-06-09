"""Auto-grading of attempts and aggregate (re)computation."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.models.enums import QuestionType
from app.models.result import QuestionResult, Result
from app.models.test import Test


def _effective_points(tq) -> float:
    return float(tq.weight) if tq.weight is not None else float(tq.question.points)


def _grade_objective(qtype: QuestionType, payload: dict, response: dict) -> bool:
    """Return correctness for objective question types."""
    correct = set(payload.get("correct_keys", []))
    selected = set(response.get("selected_keys", []))
    return bool(correct) and selected == correct


def recompute_aggregate(result: Result, pass_mark: float) -> None:
    total = sum(float(qr.points_awarded) for qr in result.questions)
    mx = sum(float(qr.max_points) for qr in result.questions)
    result.total_points = total
    result.max_points = mx
    result.percent = round((total / mx * 100), 2) if mx else 0
    result.needs_review = any(qr.needs_review for qr in result.questions)
    result.passed = (not result.needs_review) and result.percent >= float(pass_mark)


async def grade_attempt(db: AsyncSession, attempt: Attempt) -> Result:
    """Create or refresh the Result for a (submitted) attempt."""
    test = (
        await db.execute(select(Test).where(Test.id == attempt.schedule.test_id))
    ).unique().scalar_one()

    responses = {a.question_id: a.response for a in attempt.answers}

    result = (
        await db.execute(select(Result).where(Result.attempt_id == attempt.id))
    ).scalar_one_or_none()
    if result is None:
        result = Result(
            organization_id=attempt.organization_id, attempt_id=attempt.id
        )
        db.add(result)
    else:
        result.questions.clear()

    for tq in test.questions:
        q = tq.question
        qtype = QuestionType(q.type)
        max_pts = _effective_points(tq)
        resp = responses.get(q.id, {})
        if qtype in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
            correct = _grade_objective(qtype, q.payload or {}, resp)
            result.questions.append(
                QuestionResult(
                    question_id=q.id,
                    points_awarded=max_pts if correct else 0,
                    max_points=max_pts,
                    is_correct=correct,
                    needs_review=False,
                )
            )
        else:
            # text / coding: await human (or AI/Judge0 in later phases)
            result.questions.append(
                QuestionResult(
                    question_id=q.id,
                    points_awarded=0,
                    max_points=max_pts,
                    is_correct=None,
                    needs_review=True,
                )
            )

    recompute_aggregate(result, test.pass_mark)
    result.graded_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(result)
    return result
