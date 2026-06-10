"""Category CRUD endpoints."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import categories as svc

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:read")),
) -> list[CategoryOut]:
    return await svc.list_categories(db, user)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:write")),
) -> CategoryOut:
    cat = await svc.create_category(db, user, data)
    return CategoryOut(id=cat.id, name=cat.name, description=cat.description, counts={})


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:write")),
) -> CategoryOut:
    cat = await svc.update_category(db, user, category_id, data)
    return CategoryOut(id=cat.id, name=cat.name, description=cat.description, counts={})


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:write")),
) -> None:
    await svc.delete_category(db, user, category_id)
