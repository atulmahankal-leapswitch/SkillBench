"""Question CRUD endpoints."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.common import Page
from app.schemas.question import QuestionCreate, QuestionOut, QuestionUpdate
from app.services import questions as svc

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("", response_model=Page[QuestionOut])
async def list_questions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:read")),
    q: str | None = None,
    type_: str | None = Query(default=None, alias="type"),
    difficulty: str | None = None,
    tag: str | None = None,
    category_id: uuid.UUID | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[QuestionOut]:
    items, total = await svc.list_questions(
        db, user, q=q, type_=type_, difficulty=difficulty, tag=tag,
        category_id=category_id, limit=limit, offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:write")),
) -> QuestionOut:
    return await svc.create_question(db, user, data)


@router.get("/{question_id}", response_model=QuestionOut)
async def get_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:read")),
) -> QuestionOut:
    return await svc.get_question(db, user, question_id)


@router.patch("/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: uuid.UUID,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:write")),
) -> QuestionOut:
    return await svc.update_question(db, user, question_id, data)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("question:write")),
) -> None:
    await svc.delete_question(db, user, question_id)
