"""Benchmarking & analytics aggregations (read-only, org-scoped)."""

import statistics
import uuid

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.models.candidate import Candidate
from app.models.result import Result
from app.models.schedule import Schedule
from app.models.test import Test
from app.models.user import User


async def overview(db: AsyncSession, user: User) -> dict:
    org = user.organization_id

    async def _count(model, *where) -> int:
        return (
            await db.execute(
                select(func.count()).select_from(model).where(*where)
            )
        ).scalar_one()

    candidates = await _count(
        Candidate, Candidate.organization_id == org, Candidate.deleted_at.is_(None)
    )
    tests = await _count(
        Test, Test.organization_id == org, Test.deleted_at.is_(None)
    )
    attempts = await _count(
        Attempt,
        Attempt.organization_id == org,
        Attempt.status.in_(["submitted", "expired"]),
    )

    results = (
        await db.execute(select(Result).where(Result.organization_id == org))
    ).scalars().all()
    percents = [float(r.percent) for r in results]
    passed = sum(1 for r in results if r.passed)
    needs_review = sum(1 for r in results if r.needs_review)

    return {
        "candidates": candidates,
        "tests": tests,
        "attempts": attempts,
        "graded": len(results),
        "avg_percent": round(statistics.mean(percents), 2) if percents else 0,
        "pass_rate": round(passed / len(results) * 100, 2) if results else 0,
        "needs_review": needs_review,
    }


def _distribution(percents: list[float]) -> list[int]:
    """10 decile buckets [0,10),[10,20)…[90,100]."""
    buckets = [0] * 10
    for p in percents:
        idx = min(int(p // 10), 9)
        buckets[idx] += 1
    return buckets


async def test_analytics(db: AsyncSession, user: User, test_id: uuid.UUID) -> dict:
    test = (
        await db.execute(
            select(Test).where(
                Test.id == test_id, Test.organization_id == user.organization_id
            )
        )
    ).unique().scalar_one_or_none()
    if test is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Test not found")

    rows = (
        await db.execute(
            select(Result, Attempt)
            .join(Attempt, Result.attempt_id == Attempt.id)
            .join(Schedule, Attempt.schedule_id == Schedule.id)
            .where(
                Schedule.test_id == test_id,
                Result.organization_id == user.organization_id,
            )
        )
    ).all()

    percents = [float(r.percent) for (r, _a) in rows]
    durations = [
        (a.submitted_at - a.started_at).total_seconds()
        for (_r, a) in rows
        if a.submitted_at and a.started_at
    ]
    passed = sum(1 for (r, _a) in rows if r.passed)

    return {
        "test_id": str(test_id),
        "title": test.title,
        "pass_mark": float(test.pass_mark),
        "attempts": len(rows),
        "avg_percent": round(statistics.mean(percents), 2) if percents else 0,
        "median_percent": round(statistics.median(percents), 2) if percents else 0,
        "min_percent": round(min(percents), 2) if percents else 0,
        "max_percent": round(max(percents), 2) if percents else 0,
        "pass_rate": round(passed / len(rows) * 100, 2) if rows else 0,
        "avg_duration_seconds": round(statistics.mean(durations)) if durations else 0,
        "distribution": _distribution(percents),
    }


async def candidate_benchmark(
    db: AsyncSession, user: User, test_id: uuid.UUID, percent: float
) -> dict:
    """Percentile of `percent` within all results for a test (cohort)."""
    rows = (
        await db.execute(
            select(Result.percent)
            .join(Attempt, Result.attempt_id == Attempt.id)
            .join(Schedule, Attempt.schedule_id == Schedule.id)
            .where(
                Schedule.test_id == test_id,
                Result.organization_id == user.organization_id,
            )
        )
    ).scalars().all()
    cohort = [float(p) for p in rows]
    if not cohort:
        return {"percentile": 0, "cohort_size": 0}
    below = sum(1 for p in cohort if p < percent)
    return {
        "percentile": round(below / len(cohort) * 100, 1),
        "cohort_size": len(cohort),
    }
