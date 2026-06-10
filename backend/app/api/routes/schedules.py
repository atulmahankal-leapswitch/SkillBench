"""Schedule (admin) + public invitation endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.common import Page
from app.schemas.schedule import InvitationInfo, ScheduleCreate, ScheduleOut
from app.services import schedules as svc

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("", response_model=Page[ScheduleOut])
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("schedule:read")),
    status_: str | None = Query(default=None, alias="status"),
    candidate_id: uuid.UUID | None = None,
    test_id: uuid.UUID | None = None,
    q: str | None = None,
    limit: int = Query(default=25, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> Page[ScheduleOut]:
    items, total = await svc.list_schedules(
        db, user, status_=status_, candidate_id=candidate_id, test_id=test_id,
        q=q, limit=limit, offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=ScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("schedule:write")),
) -> ScheduleOut:
    return await svc.create_schedule(db, user, data)


@router.get("/{schedule_id}", response_model=ScheduleOut)
async def get_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("schedule:read")),
) -> ScheduleOut:
    return await svc.get_schedule(db, user, schedule_id)


@router.post("/{schedule_id}/cancel", response_model=ScheduleOut)
async def cancel_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("schedule:write")),
) -> ScheduleOut:
    return await svc.cancel_schedule(db, user, schedule_id)


@router.post("/{schedule_id}/resend", response_model=ScheduleOut)
async def resend_invitation(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("schedule:write")),
) -> ScheduleOut:
    return await svc.resend_invitation(db, user, schedule_id)


# ── Public (candidate-facing), no auth ───────────────────────────────────────
public_router = APIRouter(prefix="/invitations", tags=["invitations"])


@public_router.get("/{token}", response_model=InvitationInfo)
async def invitation_info(
    token: str, db: AsyncSession = Depends(get_db)
) -> InvitationInfo:
    return await svc.invitation_info(db, token)
