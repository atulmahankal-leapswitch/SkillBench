"""Candidate CRUD + assignment endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.candidate import (
    AssignmentUpdate,
    CandidateCreate,
    CandidateOut,
    CandidateUpdate,
)
from app.schemas.common import Page
from app.services import candidates as svc

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("", response_model=Page[CandidateOut])
async def list_candidates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("candidate:read")),
    q: str | None = None,
    tag: str | None = None,
    source: str | None = None,
    status_: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[CandidateOut]:
    items, total = await svc.list_candidates(
        db, user, q=q, tag=tag, source=source, status_=status_,
        limit=limit, offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("candidate:write")),
) -> CandidateOut:
    return await svc.create_candidate(db, user, data)


@router.get("/{candidate_id}", response_model=CandidateOut)
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("candidate:read")),
) -> CandidateOut:
    return await svc.get_candidate(db, user, candidate_id)


@router.patch("/{candidate_id}", response_model=CandidateOut)
async def update_candidate(
    candidate_id: uuid.UUID,
    data: CandidateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("candidate:write")),
) -> CandidateOut:
    return await svc.update_candidate(db, user, candidate_id, data)


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("candidate:write")),
) -> None:
    await svc.delete_candidate(db, user, candidate_id)


@router.put("/{candidate_id}/assignees", response_model=CandidateOut)
async def set_assignees(
    candidate_id: uuid.UUID,
    data: AssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("candidate:write")),
) -> CandidateOut:
    return await svc.set_assignees(db, user, candidate_id, data.user_ids)
