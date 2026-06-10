"""Analytics endpoints (admin)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.services import analytics as svc

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> dict:
    return await svc.overview(db, user)


@router.get("/tests/{test_id}")
async def test_analytics(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("result:read")),
) -> dict:
    return await svc.test_analytics(db, user, test_id)
