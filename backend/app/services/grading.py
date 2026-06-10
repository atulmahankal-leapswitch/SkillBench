"""Auto-grading of attempts and aggregate (re)computation."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.models.enums import QuestionType
from app.models.organization import Organization
from app.models.question import Question
from app.models.result import QuestionResult, Result
from app.models.test import Test
from app.services import ai, judge0


def _effective_points(tq) -> float:
    return float(tq.weight) if tq.weight is not None else float(tq.question.points)


def _grade_objective(qtype: QuestionType, payload: dict, response: dict) -> bool:
    """Return correctness for objective question types."""
    correct = set(payload.get("correct_keys", []))
    selected = set(response.get("selected_keys", []))
    return bool(correct) and selected == correct


async def grade_coding(
    q: Question, response: dict, max_pts: float
) -> QuestionResult:
    """Auto-grade a coding answer via Judge0, or flag for review if disabled."""
    code = response.get("code", "")
    language = response.get("language", "python")
    test_cases = (q.payload or {}).get("test_cases", [])

    if not judge0.is_enabled() or not test_cases or not code:
        return QuestionResult(
            question_id=q.id, points_awarded=0, max_points=max_pts,
            is_correct=None, needs_review=True,
        )
    try:
        passed = 0
        for tc in test_cases:
            res = await judge0.run(
                language=language,
                source_code=code,
                stdin=tc.get("input", ""),
                expected_output=tc.get("expected", ""),
            )
            if res.passed:
                passed += 1
        total = len(test_cases)
        awarded = round(max_pts * passed / total, 2) if total else 0
        return QuestionResult(
            question_id=q.id, points_awarded=awarded, max_points=max_pts,
            is_correct=(passed == total), needs_review=False,
            feedback=f"{passed}/{total} test cases passed",
        )
    except Exception:  # noqa: BLE001 - any execution error -> manual review
        return QuestionResult(
            question_id=q.id, points_awarded=0, max_points=max_pts,
            is_correct=None, needs_review=True,
            feedback="Auto-execution failed; needs manual review",
        )


async def grade_text(
    q: Question, response: dict, max_pts: float, cfg: ai.AIConfig
) -> QuestionResult:
    """AI-score a free-text answer when a provider is enabled, else flag review."""
    answer = (response or {}).get("text", "")
    if not ai.is_enabled(cfg) or not answer:
        return QuestionResult(
            question_id=q.id, points_awarded=0, max_points=max_pts,
            is_correct=None, needs_review=True,
        )
    try:
        payload = q.payload or {}
        result = await ai.get_provider(cfg).score_text({
            "prompt": q.prompt,
            "answer": answer,
            "rubric": payload.get("rubric", ""),
            "sample_answer": payload.get("sample_answer", ""),
            "max_points": max_pts,
        })
        score = max(0.0, min(float(result.get("score", 0)), max_pts))
        return QuestionResult(
            question_id=q.id, points_awarded=round(score, 2), max_points=max_pts,
            is_correct=None, needs_review=True,  # AI suggestion; human confirms
            feedback=str(result.get("rationale", "")),
        )
    except Exception:  # noqa: BLE001 - AI failure -> manual review
        return QuestionResult(
            question_id=q.id, points_awarded=0, max_points=max_pts,
            is_correct=None, needs_review=True,
        )


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
    org = (
        await db.execute(
            select(Organization).where(Organization.id == attempt.organization_id)
        )
    ).scalar_one()
    ai_cfg = ai.resolve(org)

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
        elif qtype == QuestionType.CODING:
            result.questions.append(await grade_coding(q, resp, max_pts))
        else:
            # text: AI-suggested score when enabled, else manual review.
            result.questions.append(await grade_text(q, resp, max_pts, ai_cfg))

    recompute_aggregate(result, test.pass_mark)
    result.graded_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(result)
    return result
