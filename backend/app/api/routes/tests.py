"""Test CRUD endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.common import Page
from app.schemas.test import TestCreate, TestOut, TestSummaryOut, TestUpdate
from app.services import tests as svc

router = APIRouter(prefix="/tests", tags=["tests"])


def _to_summary(test) -> TestSummaryOut:
    summary = TestSummaryOut.model_validate(test)
    # Blueprint tests draw N per rule; otherwise it's the fixed question count.
    summary.question_count = (
        sum(b.count for b in test.blueprints)
        if test.blueprints
        else len(test.questions)
    )
    return summary


@router.get("", response_model=Page[TestSummaryOut])
async def list_tests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("test:read")),
    q: str | None = None,
    status_: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[TestSummaryOut]:
    items, total = await svc.list_tests(
        db, user, q=q, status_=status_, limit=limit, offset=offset
    )
    return Page(
        items=[_to_summary(t) for t in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=TestOut, status_code=status.HTTP_201_CREATED)
async def create_test(
    data: TestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("test:write")),
) -> TestOut:
    return await svc.create_test(db, user, data)


@router.get("/{test_id}", response_model=TestOut)
async def get_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("test:read")),
) -> TestOut:
    return await svc.get_test(db, user, test_id)


@router.patch("/{test_id}", response_model=TestOut)
async def update_test(
    test_id: uuid.UUID,
    data: TestUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("test:write")),
) -> TestOut:
    return await svc.update_test(db, user, test_id, data)


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("test:write")),
) -> None:
    await svc.delete_test(db, user, test_id)
