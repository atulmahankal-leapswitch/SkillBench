"""Category CRUD + per-category question availability counts."""

import uuid

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, question_categories
from app.models.question import Question
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate

DIFFICULTIES = ["easy", "medium", "hard"]


async def availability(db: AsyncSession, org_id: uuid.UUID) -> dict[uuid.UUID, dict]:
    """Map category_id -> {easy, medium, hard, total} of live questions."""
    rows = (
        await db.execute(
            select(
                question_categories.c.category_id,
                Question.difficulty,
                func.count(),
            )
            .join(Question, Question.id == question_categories.c.question_id)
            .where(
                Question.organization_id == org_id,
                Question.deleted_at.is_(None),
            )
            .group_by(question_categories.c.category_id, Question.difficulty)
        )
    ).all()
    out: dict[uuid.UUID, dict] = {}
    for cat_id, difficulty, n in rows:
        bucket = out.setdefault(cat_id, {d: 0 for d in DIFFICULTIES} | {"total": 0})
        if difficulty in bucket:
            bucket[difficulty] = n
        bucket["total"] += n
    return out


async def list_categories(db: AsyncSession, user: User) -> list[dict]:
    cats = (
        (
            await db.execute(
                select(Category)
                .where(Category.organization_id == user.organization_id)
                .order_by(Category.name.asc())
            )
        ).scalars().all()
    )
    counts = await availability(db, user.organization_id)
    empty = {d: 0 for d in DIFFICULTIES} | {"total": 0}
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "counts": counts.get(c.id, empty),
        }
        for c in cats
    ]


async def _get(db: AsyncSession, user: User, category_id: uuid.UUID) -> Category:
    cat = (
        await db.execute(
            select(Category).where(
                Category.id == category_id,
                Category.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if cat is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Category not found")
    return cat


async def create_category(db: AsyncSession, user: User, data: CategoryCreate) -> Category:
    cat = Category(
        organization_id=user.organization_id,
        name=data.name.strip(),
        description=data.description,
    )
    db.add(cat)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(http.HTTP_409_CONFLICT, "Category name already exists") from exc
    await db.refresh(cat)
    return cat


async def update_category(
    db: AsyncSession, user: User, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    cat = await _get(db, user, category_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(http.HTTP_409_CONFLICT, "Category name already exists") from exc
    await db.refresh(cat)
    return cat


async def delete_category(db: AsyncSession, user: User, category_id: uuid.UUID) -> None:
    cat = await _get(db, user, category_id)
    await db.delete(cat)
    await db.commit()
