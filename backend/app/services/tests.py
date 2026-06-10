"""Test CRUD with ordered question membership, org-scoped."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.question import Question
from app.models.test import Test, TestBlueprint, TestQuestion
from app.models.user import User
from app.schemas.test import BlueprintItem, TestCreate, TestQuestionRef, TestUpdate
from app.services.pagination import paginate


async def _validate_blueprint(
    db: AsyncSession, user: User, items: list[BlueprintItem]
) -> None:
    ids = {i.category_id for i in items}
    if not ids:
        return
    found = set(
        (
            await db.execute(
                select(Category.id).where(
                    Category.id.in_(ids),
                    Category.organization_id == user.organization_id,
                )
            )
        ).scalars().all()
    )
    missing = ids - found
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown category/categories: {sorted(map(str, missing))}",
        )


def _blueprint_rows(items: list[BlueprintItem]) -> list[TestBlueprint]:
    return [
        TestBlueprint(
            category_id=i.category_id, difficulty=i.difficulty, count=i.count
        )
        for i in items
    ]


def _base_query(user: User):
    return select(Test).where(
        Test.organization_id == user.organization_id,
        Test.deleted_at.is_(None),
    )


async def _validate_question_ids(
    db: AsyncSession, user: User, refs: list[TestQuestionRef]
) -> None:
    ids = {r.question_id for r in refs}
    if not ids:
        return
    found = set(
        (
            await db.execute(
                select(Question.id).where(
                    Question.id.in_(ids),
                    Question.organization_id == user.organization_id,
                    Question.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    missing = ids - found
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown question(s): {sorted(map(str, missing))}",
        )


def _membership_rows(refs: list[TestQuestionRef]) -> list[TestQuestion]:
    # Honour explicit positions but normalise to a stable 0..n ordering.
    ordered = sorted(enumerate(refs), key=lambda p: (p[1].position, p[0]))
    return [
        TestQuestion(question_id=r.question_id, position=i, weight=r.weight)
        for i, (_, r) in enumerate(ordered)
    ]


async def list_tests(
    db: AsyncSession,
    user: User,
    *,
    q: str | None,
    status_: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Test], int]:
    stmt = _base_query(user)
    if q:
        stmt = stmt.where(Test.title.ilike(f"%{q}%"))
    if status_:
        stmt = stmt.where(Test.status == status_)
    stmt = stmt.order_by(Test.created_at.desc())
    return await paginate(db, stmt, limit, offset)


async def get_test(db: AsyncSession, user: User, test_id: uuid.UUID) -> Test:
    stmt = _base_query(user).where(Test.id == test_id)
    test = (await db.execute(stmt)).scalar_one_or_none()
    if test is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    return test


async def create_test(db: AsyncSession, user: User, data: TestCreate) -> Test:
    await _validate_question_ids(db, user, data.questions)
    await _validate_blueprint(db, user, data.blueprint)
    test = Test(
        organization_id=user.organization_id,
        title=data.title,
        description=data.description,
        duration_minutes=data.duration_minutes,
        pass_mark=data.pass_mark,
        settings=data.settings,
        created_by=user.id,
        questions=_membership_rows(data.questions),
        blueprints=_blueprint_rows(data.blueprint),
    )
    db.add(test)
    await db.commit()
    # Re-fetch so selectin relationships load eagerly (async-safe serialization).
    return await get_test(db, user, test.id)


async def update_test(
    db: AsyncSession, user: User, test_id: uuid.UUID, data: TestUpdate
) -> Test:
    test = await get_test(db, user, test_id)
    fields = data.model_dump(exclude_unset=True)
    new_questions = fields.pop("questions", None)
    new_blueprint = fields.pop("blueprint", None)
    for field, value in fields.items():
        setattr(test, field, value)
    if new_questions is not None:
        refs = [TestQuestionRef(**r) for r in new_questions]
        await _validate_question_ids(db, user, refs)
        # Delete old rows first so re-adding the same (test, question) doesn't
        # collide with the unique constraint during flush.
        test.questions.clear()
        await db.flush()
        test.questions = _membership_rows(refs)
    if new_blueprint is not None:
        items = [BlueprintItem(**b) for b in new_blueprint]
        await _validate_blueprint(db, user, items)
        # Same: clear old blueprint rows before inserting the replacements
        # (avoids uq_blueprint_cat_diff violation).
        test.blueprints.clear()
        await db.flush()
        test.blueprints = _blueprint_rows(items)
    await db.commit()
    return await get_test(db, user, test.id)


async def delete_test(db: AsyncSession, user: User, test_id: uuid.UUID) -> None:
    test = await get_test(db, user, test_id)
    test.deleted_at = datetime.now(UTC)
    await db.commit()
