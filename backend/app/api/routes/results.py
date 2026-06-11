"""Results endpoints (admin)."""

import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.common import Page
from app.schemas.result import OverrideUpdate, ResultDetail, ResultSummary
from app.services import plagiarism, proctoring
from app.services import results as svc

router = APIRouter(prefix="/results", tags=["results"])


@router.get("", response_model=Page[ResultSummary])
async def list_results(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
    test_id: list[uuid.UUID] | None = Query(default=None),
    result: str | None = Query(default=None, pattern="^(passed|failed|needs_review)$"),
    min_percent: float | None = Query(default=None, ge=0, le=100),
    q: str | None = None,
    sort: str = Query(default="finished", pattern="^(finished|candidate|test|score)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[ResultSummary]:
    items, total = await svc.list_results(
        db,
        user,
        test_ids=test_id,
        result=result,
        min_percent=min_percent,
        q=q,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/export.csv", response_class=PlainTextResponse)
async def export_csv(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> PlainTextResponse:
    csv_text = await svc.export_csv(db, user)
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=results.csv"},
    )


@router.get("/{attempt_id}", response_model=ResultDetail)
async def get_detail(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> ResultDetail:
    return await svc.get_detail(db, user, attempt_id)


@router.patch("/{attempt_id}/questions/{question_result_id}", response_model=ResultDetail)
async def override_question(
    attempt_id: uuid.UUID,
    question_result_id: uuid.UUID,
    data: OverrideUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:write")),
) -> ResultDetail:
    return await svc.override_question(
        db, user, attempt_id, question_result_id, data
    )


@router.get("/{attempt_id}/proctor")
async def proctor_timeline(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> dict:
    events = await proctoring.list_events(db, user, attempt_id)
    counts = await proctoring.summary(db, user, attempt_id)
    return {"events": events, "summary": counts}


@router.get("/{attempt_id}/integrity")
async def integrity(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> dict:
    return await plagiarism.integrity(db, user, attempt_id)


@router.get("/{attempt_id}/recording")
async def recording_playback(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
):
    from fastapi import HTTPException
    from fastapi import status as http
    from fastapi.responses import StreamingResponse
    from sqlalchemy import select

    from app.models.organization import Organization
    from app.services import proctoring, recording

    # Reuse proctoring's org-scoped attempt lookup for the 404 + tenancy check.
    attempt = await proctoring._admin_attempt(db, user, attempt_id)
    org = (
        await db.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
    ).scalar_one()
    if not recording.exists(org, attempt.id):
        raise HTTPException(http.HTTP_404_NOT_FOUND, "No recording")
    return StreamingResponse(recording.stream(org, attempt.id), media_type="video/webm")


@router.get("/{attempt_id}/proctor/{event_id}/image")
async def proctor_snapshot(
    attempt_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> dict:
    return {"image": await proctoring.get_snapshot(db, user, attempt_id, event_id)}
