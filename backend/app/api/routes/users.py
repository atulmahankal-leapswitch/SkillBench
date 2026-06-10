"""Organisation users & roles endpoints (admin)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import RoleDetail, UserListItem, UserUpdate
from app.services import users as svc

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserListItem])
async def list_users(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permission("user:manage")),
) -> list[UserListItem]:
    return await svc.list_users(db, actor)


@router.get("/roles", response_model=list[RoleDetail])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permission("user:manage")),
) -> list[RoleDetail]:
    return await svc.list_roles(db)


@router.patch("/{user_id}", response_model=UserListItem)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_permission("user:manage")),
) -> UserListItem:
    return await svc.update_user(db, actor, user_id, data.role_ids, data.is_active)
