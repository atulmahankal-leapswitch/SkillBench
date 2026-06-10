"""Shared API dependencies: authentication and authorization."""

import uuid

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import ACCESS_COOKIE, decode_token
from app.models.user import Role, User


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get(ACCESS_COOKIE)


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(token, expected_type="access")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired token"
        ) from exc

    user = (
        await db.execute(
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.organization),
                selectinload(User.roles).selectinload(Role.permissions),
            )
        )
    ).scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "User not found or inactive"
        )
    return user


async def require_api_key(
    request: Request, db: AsyncSession = Depends(get_db)
):
    """Authenticate a public-API caller via the X-API-Key header."""
    from app.services.integrations import resolve_api_key

    raw = request.headers.get("X-API-Key")
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-API-Key header")
    return await resolve_api_key(db, raw)


def require_scope(scope: str):
    """Dependency factory: require an API key carrying the given scope."""

    async def checker(key=Depends(require_api_key)):
        if scope not in key.scopes:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"API key missing scope: {scope}"
            )
        return key

    return checker


def require_permission(*codes: str):
    """Dependency factory: require all given permission codes."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        missing = set(codes) - user.permission_codes
        if missing:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Missing permission(s): {', '.join(sorted(missing))}",
            )
        return user

    return checker
