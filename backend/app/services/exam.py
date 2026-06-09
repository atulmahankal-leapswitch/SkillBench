"""Candidate exam-taking: attempt lifecycle with server-enforced timing."""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Answer, Attempt
from app.models.enums import AttemptStatus, QuestionType, ScheduleStatus
from app.models.schedule import Invitation, Schedule
from app.models.test import Test
from app.schemas.exam import (
    AnswerSubmit,
    ExamState,
    RunCaseResult,
    RunRequest,
    RunResponse,
    build_public_question,
)
from app.services import judge0, proctoring
from app.services.grading import grade_attempt
from app.services.schedules import effective_status, get_invitation_by_token


async def _load(db: AsyncSession, token: str) -> tuple[Invitation, Schedule]:
    invitation = await get_invitation_by_token(db, token)
    return invitation, invitation.schedule


async def _load_test(db: AsyncSession, schedule: Schedule) -> Test:
    # Test.questions (selectin) + TestQuestion.question (joined) load eagerly.
    return (
        await db.execute(select(Test).where(Test.id == schedule.test_id))
    ).unique().scalar_one()


async def _get_attempt(db: AsyncSession, schedule: Schedule) -> Attempt | None:
    return (
        await db.execute(select(Attempt).where(Attempt.schedule_id == schedule.id))
    ).scalar_one_or_none()


async def _enforce_expiry(db: AsyncSession, attempt: Attempt) -> None:
    now = datetime.now(UTC)
    if (
        attempt.status == AttemptStatus.IN_PROGRESS
        and attempt.expires_at
        and now > attempt.expires_at
    ):
        attempt.status = AttemptStatus.EXPIRED
        attempt.submitted_at = attempt.expires_at
        await db.commit()
        await db.refresh(attempt)
        await grade_attempt(db, attempt)


async def _build_state(
    db: AsyncSession, schedule: Schedule, attempt: Attempt | None
) -> ExamState:
    now = datetime.now(UTC)
    questions = []
    answers: dict = {}
    started = attempt is not None and attempt.started_at is not None
    if started:
        test = await _load_test(db, schedule)
        questions = [build_public_question(tq) for tq in test.questions]
        answers = {str(a.question_id): a.response for a in attempt.answers}

    remaining = 0
    if attempt and attempt.expires_at and attempt.status == AttemptStatus.IN_PROGRESS:
        remaining = max(0, int((attempt.expires_at - now).total_seconds()))

    return ExamState(
        status=AttemptStatus(attempt.status) if attempt else AttemptStatus.NOT_STARTED,
        test_title=schedule.test.title,
        candidate_name=schedule.candidate.full_name,
        duration_minutes=schedule.test.duration_minutes,
        started_at=attempt.started_at if attempt else None,
        expires_at=attempt.expires_at if attempt else None,
        server_now=now,
        remaining_seconds=remaining,
        questions=questions,
        answers=answers,
        proctoring=(schedule.test.settings or {}).get("proctoring", {}),
    )


def _ensure_window_open(invitation: Invitation, schedule: Schedule) -> None:
    now = datetime.now(UTC)
    eff = effective_status(schedule, now)
    if invitation.revoked_at or eff in (
        ScheduleStatus.CANCELLED,
        ScheduleStatus.EXPIRED,
    ):
        raise HTTPException(http.HTTP_403_FORBIDDEN, "Invitation is no longer active")
    if not (schedule.start_at <= now <= schedule.end_at):
        raise HTTPException(
            http.HTTP_403_FORBIDDEN, "Outside the scheduled window"
        )


async def get_state(db: AsyncSession, token: str) -> ExamState:
    invitation, schedule = await _load(db, token)
    attempt = await _get_attempt(db, schedule)
    if attempt:
        await _enforce_expiry(db, attempt)
    return await _build_state(db, schedule, attempt)


async def start_attempt(db: AsyncSession, token: str) -> ExamState:
    invitation, schedule = await _load(db, token)
    attempt = await _get_attempt(db, schedule)
    if attempt is None:
        _ensure_window_open(invitation, schedule)
        now = datetime.now(UTC)
        expires = min(
            now + timedelta(minutes=schedule.test.duration_minutes), schedule.end_at
        )
        attempt = Attempt(
            organization_id=schedule.organization_id,
            schedule_id=schedule.id,
            status=AttemptStatus.IN_PROGRESS,
            started_at=now,
            expires_at=expires,
        )
        db.add(attempt)
        if schedule.status == ScheduleStatus.SCHEDULED:
            schedule.status = ScheduleStatus.IN_PROGRESS
        await db.commit()
        await db.refresh(attempt)
    else:
        await _enforce_expiry(db, attempt)
    return await _build_state(db, schedule, attempt)


async def save_answer(db: AsyncSession, token: str, data: AnswerSubmit) -> dict:
    _, schedule = await _load(db, token)
    attempt = await _get_attempt(db, schedule)
    if attempt is None:
        raise HTTPException(http.HTTP_409_CONFLICT, "Attempt not started")
    await _enforce_expiry(db, attempt)
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(http.HTTP_409_CONFLICT, "Attempt is not in progress")

    test = await _load_test(db, schedule)
    valid_ids = {tq.question_id for tq in test.questions}
    if data.question_id not in valid_ids:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Question not in this test")

    existing = next(
        (a for a in attempt.answers if a.question_id == data.question_id), None
    )
    if existing:
        existing.response = data.response
    else:
        attempt.answers.append(
            Answer(question_id=data.question_id, response=data.response)
        )
    await db.commit()
    return {"saved": True}


async def run_code(db: AsyncSession, token: str, data: RunRequest) -> RunResponse:
    """Run candidate code against a coding question's sample (visible) cases."""
    if not judge0.is_enabled():
        raise HTTPException(
            http.HTTP_503_SERVICE_UNAVAILABLE, "Code execution is not enabled"
        )
    _, schedule = await _load(db, token)
    attempt = await _get_attempt(db, schedule)
    if attempt is None:
        raise HTTPException(http.HTTP_409_CONFLICT, "Attempt not started")
    await _enforce_expiry(db, attempt)
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(http.HTTP_409_CONFLICT, "Attempt is not in progress")

    test = await _load_test(db, schedule)
    tq = next((t for t in test.questions if t.question_id == data.question_id), None)
    if tq is None or QuestionType(tq.question.type) != QuestionType.CODING:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Not a coding question in this test")

    visible = [
        tc for tc in (tq.question.payload or {}).get("test_cases", [])
        if not tc.get("hidden", True)
    ]
    results = []
    for tc in visible:
        r = await judge0.run(
            language=data.language,
            source_code=data.code,
            stdin=tc.get("input", ""),
            expected_output=tc.get("expected", ""),
        )
        results.append(
            RunCaseResult(passed=r.passed, status=r.status, stdout=r.stdout, stderr=r.stderr)
        )
    return RunResponse(results=results)


async def report_proctor_event(
    db: AsyncSession, token: str, type_: str, meta: dict | None
) -> dict:
    _, schedule = await _load(db, token)
    attempt = await _get_attempt(db, schedule)
    if attempt is None:
        raise HTTPException(http.HTTP_409_CONFLICT, "Attempt not started")
    proctoring._require_in_progress(attempt)
    await proctoring.record_event(db, attempt, type_, meta)
    return {"recorded": True}


async def submit_attempt(db: AsyncSession, token: str) -> ExamState:
    _, schedule = await _load(db, token)
    attempt = await _get_attempt(db, schedule)
    if attempt is None:
        raise HTTPException(http.HTTP_409_CONFLICT, "Attempt not started")
    await _enforce_expiry(db, attempt)
    if attempt.status == AttemptStatus.IN_PROGRESS:
        attempt.status = AttemptStatus.SUBMITTED
        attempt.submitted_at = datetime.now(UTC)
        schedule.status = ScheduleStatus.COMPLETED
        await db.commit()
        await db.refresh(attempt)
        await grade_attempt(db, attempt)
    return await _build_state(db, schedule, attempt)
