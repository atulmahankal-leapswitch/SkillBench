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
from app.services import proctoring
from app.services import results as svc

router = APIRouter(prefix="/results", tags=["results"])


@router.get("", response_model=Page[ResultSummary])
async def list_results(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
    test_id: uuid.UUID | None = None,
    passed: bool | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[ResultSummary]:
    items, total = await svc.list_results(
        db, user, test_id=test_id, passed=passed, limit=limit, offset=offset
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


@router.get("/{attempt_id}/proctor/{event_id}/image")
async def proctor_snapshot(
    attempt_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> dict:
    return {"image": await proctoring.get_snapshot(db, user, attempt_id, event_id)}
