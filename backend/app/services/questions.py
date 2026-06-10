"""Question CRUD, org-scoped, with payload validation."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, question_categories
from app.models.question import Question
from app.models.user import User
from app.schemas.question import QuestionCreate, QuestionUpdate, validate_payload
from app.services.pagination import paginate


def _base_query(user: User):
    return select(Question).where(
        Question.organization_id == user.organization_id,
        Question.deleted_at.is_(None),
    )


async def _resolve_categories(
    db: AsyncSession, user: User, category_ids: list[uuid.UUID]
) -> list[Category]:
    if not category_ids:
        return []
    cats = list(
        (
            await db.execute(
                select(Category).where(
                    Category.id.in_(category_ids),
                    Category.organization_id == user.organization_id,
                )
            )
        ).scalars().all()
    )
    if len(cats) != len(set(category_ids)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown category id(s)")
    return cats


async def list_questions(
    db: AsyncSession,
    user: User,
    *,
    q: str | None,
    type_: str | None,
    difficulty: str | None,
    tag: str | None,
    category_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> tuple[list[Question], int]:
    stmt = _base_query(user)
    if q:
        stmt = stmt.where(Question.prompt.ilike(f"%{q}%"))
    if type_:
        stmt = stmt.where(Question.type == type_)
    if difficulty:
        stmt = stmt.where(Question.difficulty == difficulty)
    if tag:
        stmt = stmt.where(Question.tags.any(tag))
    if category_id:
        stmt = stmt.where(
            Question.id.in_(
                select(question_categories.c.question_id).where(
                    question_categories.c.category_id == category_id
                )
            )
        )
    stmt = stmt.order_by(Question.created_at.desc())
    return await paginate(db, stmt, limit, offset)


async def get_question(
    db: AsyncSession, user: User, question_id: uuid.UUID
) -> Question:
    stmt = _base_query(user).where(Question.id == question_id)
    question = (await db.execute(stmt)).scalar_one_or_none()
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    return question


async def create_question(
    db: AsyncSession, user: User, data: QuestionCreate
) -> Question:
    question = Question(
        organization_id=user.organization_id,
        type=data.type,
        prompt=data.prompt,
        payload=data.payload,
        difficulty=data.difficulty,
        points=data.points,
        tags=data.tags,
        created_by=user.id,
    )
    question.categories = await _resolve_categories(db, user, data.category_ids)
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


async def update_question(
    db: AsyncSession, user: User, question_id: uuid.UUID, data: QuestionUpdate
) -> Question:
    question = await get_question(db, user, question_id)
    fields = data.model_dump(exclude_unset=True)
    if "payload" in fields and fields["payload"] is not None:
        # Validate the new payload against the question's (immutable) type.
        fields["payload"] = validate_payload(question.type_enum, fields["payload"])
    if "category_ids" in fields:
        question.categories = await _resolve_categories(
            db, user, fields.pop("category_ids") or []
        )
    for field, value in fields.items():
        setattr(question, field, value)
    await db.commit()
    await db.refresh(question)
    return question


async def delete_question(
    db: AsyncSession, user: User, question_id: uuid.UUID
) -> None:
    question = await get_question(db, user, question_id)
    question.deleted_at = datetime.now(UTC)
    await db.commit()
