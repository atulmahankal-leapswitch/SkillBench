"""Admin-facing result retrieval, listing, override, and CSV export."""

import csv
import io
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.attempt import Attempt
from app.models.category import Category, question_categories
from app.models.question import Question
from app.models.result import Result
from app.models.schedule import Schedule
from app.models.test import Test
from app.models.user import User
from app.schemas.result import (
    OverrideUpdate,
    QuestionResultOut,
    ResultDetail,
    ResultSummary,
)
from app.services.grading import recompute_aggregate
from app.services.pagination import paginate


def _attempt_query(user: User):
    return (
        select(Attempt)
        .where(Attempt.organization_id == user.organization_id)
        .options(
            joinedload(Attempt.schedule).joinedload(Schedule.candidate),
            joinedload(Attempt.schedule).joinedload(Schedule.test),
        )
    )


async def _result_for(db: AsyncSession, attempt: Attempt) -> Result | None:
    return (
        await db.execute(select(Result).where(Result.attempt_id == attempt.id))
    ).scalar_one_or_none()


async def list_results(
    db: AsyncSession, user: User, *, test_id, passed, limit: int, offset: int
):
    stmt = _attempt_query(user).where(Attempt.status.in_(["submitted", "expired"]))
    if test_id:
        stmt = stmt.join(Schedule, Attempt.schedule_id == Schedule.id).where(
            Schedule.test_id == test_id
        )
    stmt = stmt.order_by(Attempt.submitted_at.desc())
    attempts, total = await paginate(db, stmt, limit, offset)

    rows: list[ResultSummary] = []
    for a in attempts:
        r = await _result_for(db, a)
        if passed is not None and (r is None or r.passed != passed):
            continue
        rows.append(
            ResultSummary(
                attempt_id=a.id,
                candidate_name=a.schedule.candidate.full_name,
                candidate_email=a.schedule.candidate.email,
                test_title=a.schedule.test.title,
                attempt_status=a.status,
                total_points=float(r.total_points) if r else 0,
                max_points=float(r.max_points) if r else 0,
                percent=float(r.percent) if r else 0,
                passed=bool(r.passed) if r else False,
                needs_review=bool(r.needs_review) if r else False,
                submitted_at=a.submitted_at,
            )
        )
    return rows, total


async def _get_attempt(db: AsyncSession, user: User, attempt_id: uuid.UUID) -> Attempt:
    attempt = (
        await db.execute(_attempt_query(user).where(Attempt.id == attempt_id))
    ).unique().scalar_one_or_none()
    if attempt is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Attempt not found")
    return attempt


async def get_detail(db: AsyncSession, user: User, attempt_id: uuid.UUID) -> ResultDetail:
    attempt = await _get_attempt(db, user, attempt_id)
    result = await _result_for(db, attempt)
    if result is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Not graded yet")

    test = (
        await db.execute(select(Test).where(Test.id == attempt.schedule.test_id))
    ).unique().scalar_one()
    pass_mark = float(test.pass_mark)

    questions_by_id = {tq.question.id: tq.question for tq in test.questions}
    responses = {a.question_id: a.response for a in attempt.answers}

    # First category name per question (questions can have several) — used for
    # the Remarks breakdown. Queried directly to avoid async lazy-loads.
    cat_by_q: dict[uuid.UUID, str] = {}
    if questions_by_id:
        cat_rows = (
            await db.execute(
                select(question_categories.c.question_id, Category.name)
                .join(Category, Category.id == question_categories.c.category_id)
                .where(question_categories.c.question_id.in_(list(questions_by_id)))
            )
        ).all()
        for qid, cname in cat_rows:
            cat_by_q.setdefault(qid, cname)

    q_out: list[QuestionResultOut] = []
    for qr in result.questions:
        q: Question | None = questions_by_id.get(qr.question_id)
        item = QuestionResultOut.model_validate(qr)
        item.prompt = q.prompt if q else ""
        item.type = q.type if q else ""
        item.difficulty = q.difficulty if q else ""
        item.category = cat_by_q.get(qr.question_id, "Uncategorized")
        item.payload = (q.payload or {}) if q else {}
        item.response = responses.get(qr.question_id, {})
        q_out.append(item)

    return ResultDetail(
        attempt_id=attempt.id,
        candidate_name=attempt.schedule.candidate.full_name,
        candidate_email=attempt.schedule.candidate.email,
        test_title=attempt.schedule.test.title,
        pass_mark=pass_mark,
        attempt_status=attempt.status,
        total_points=float(result.total_points),
        max_points=float(result.max_points),
        percent=float(result.percent),
        passed=result.passed,
        needs_review=result.needs_review,
        submitted_at=attempt.submitted_at,
        graded_at=result.graded_at,
        questions=q_out,
    )


async def override_question(
    db: AsyncSession,
    user: User,
    attempt_id: uuid.UUID,
    question_result_id: uuid.UUID,
    data: OverrideUpdate,
) -> ResultDetail:
    attempt = await _get_attempt(db, user, attempt_id)
    result = await _result_for(db, attempt)
    if result is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Not graded yet")

    qr = next((x for x in result.questions if x.id == question_result_id), None)
    if qr is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Question result not found")
    if float(data.points_awarded) > float(qr.max_points):
        raise HTTPException(
            http.HTTP_400_BAD_REQUEST,
            f"points_awarded exceeds max ({qr.max_points})",
        )

    qr.points_awarded = data.points_awarded
    qr.feedback = data.feedback
    qr.needs_review = False
    qr.is_correct = float(data.points_awarded) >= float(qr.max_points)

    test = (
        await db.execute(select(Test).where(Test.id == attempt.schedule.test_id))
    ).unique().scalar_one()
    recompute_aggregate(result, test.pass_mark)
    result.graded_at = datetime.now(UTC)
    await db.commit()
    return await get_detail(db, user, attempt_id)


async def export_csv(db: AsyncSession, user: User) -> str:
    rows, _ = await list_results(
        db, user, test_id=None, passed=None, limit=10000, offset=0
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["candidate_name", "candidate_email", "test", "status", "score",
         "max", "percent", "passed", "needs_review", "submitted_at"]
    )
    for r in rows:
        writer.writerow([
            r.candidate_name, r.candidate_email, r.test_title, r.attempt_status,
            r.total_points, r.max_points, r.percent, r.passed, r.needs_review,
            r.submitted_at.isoformat() if r.submitted_at else "",
        ])
    return buf.getvalue()
