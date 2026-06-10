"""Organisation user + role management (user:manage)."""

import uuid

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import Role, User


async def list_users(db: AsyncSession, actor: User) -> list[User]:
    return list(
        (
            await db.execute(
                select(User)
                .where(User.organization_id == actor.organization_id)
                .options(selectinload(User.roles))
                .order_by(User.created_at.asc())
            )
        ).scalars().all()
    )


async def list_roles(db: AsyncSession) -> list[Role]:
    return list(
        (
            await db.execute(select(Role).order_by(Role.name.asc()))
        ).scalars().all()
    )


async def _get_org_user(db: AsyncSession, actor: User, user_id: uuid.UUID) -> User:
    user = (
        await db.execute(
            select(User)
            .where(
                User.id == user_id,
                User.organization_id == actor.organization_id,
            )
            .options(selectinload(User.roles))
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "User not found")
    return user


async def update_user(
    db: AsyncSession,
    actor: User,
    user_id: uuid.UUID,
    role_ids: list[uuid.UUID] | None,
    is_active: bool | None,
) -> User:
    user = await _get_org_user(db, actor, user_id)

    if role_ids is not None:
        roles = list(
            (
                await db.execute(select(Role).where(Role.id.in_(role_ids)))
            ).scalars().all()
        )
        if len(roles) != len(set(role_ids)):
            raise HTTPException(http.HTTP_400_BAD_REQUEST, "Unknown role id(s)")
        user.roles = roles

    if is_active is not None:
        if not is_active and user.id == actor.id:
            raise HTTPException(
                http.HTTP_400_BAD_REQUEST, "You cannot deactivate yourself"
            )
        user.is_active = is_active

    await db.commit()
    await db.refresh(user)
    return user
