"""Public, API-key-authenticated v1 surface for external integrations."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_scope
from app.core.database import get_db
from app.models.attempt import Attempt
from app.models.candidate import Candidate
from app.models.integration import ApiKey
from app.models.result import Result
from app.models.schedule import Schedule

router = APIRouter(prefix="/v1", tags=["public-api"])


@router.get("/candidates")
async def list_candidates(
    db: AsyncSession = Depends(get_db),
    key: ApiKey = Depends(require_scope("candidate:read")),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    rows = (
        await db.execute(
            select(Candidate)
            .where(
                Candidate.organization_id == key.organization_id,
                Candidate.deleted_at.is_(None),
            )
            .order_by(Candidate.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": str(c.id),
                "full_name": c.full_name,
                "email": c.email,
                "source": c.source,
                "status": c.status,
                "tags": c.tags,
            }
            for c in rows
        ]
    }


@router.get("/results")
async def list_results(
    db: AsyncSession = Depends(get_db),
    key: ApiKey = Depends(require_scope("result:read")),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    stmt = (
        select(Result, Attempt, Schedule, Candidate)
        .join(Attempt, Result.attempt_id == Attempt.id)
        .join(Schedule, Attempt.schedule_id == Schedule.id)
        .join(Candidate, Schedule.candidate_id == Candidate.id)
        .where(Result.organization_id == key.organization_id)
        .order_by(Attempt.submitted_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    return {
        "items": [
            {
                "attempt_id": str(a.id),
                "candidate": {"full_name": c.full_name, "email": c.email},
                "percent": float(r.percent),
                "passed": r.passed,
                "needs_review": r.needs_review,
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
            }
            for (r, a, s, c) in rows
        ]
    }
