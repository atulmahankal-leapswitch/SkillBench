"""Authentication routes: Google OAuth sign-in, session, logout."""

import hmac
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    BadSignature,
    create_access_token,
    create_refresh_token,
    sign_state,
    verify_state,
)
from app.models.user import User
from app.schemas.auth import MeResponse, UserOut
from app.services.auth import google
from app.services.auth.provisioning import (
    upsert_bootstrap_admin,
    upsert_user_from_google,
)


class PasswordLogin(BaseModel):
    email: EmailStr
    password: str

router = APIRouter(prefix="/auth", tags=["auth"])


def _serialize_user(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        organization=user.organization,
        roles=user.roles,
        permissions=sorted(user.permission_codes),
    )


def _set_session_cookies(response: Response, user: User) -> None:
    access = create_access_token(str(user.id), str(user.organization_id))
    refresh = create_refresh_token(str(user.id))
    common = {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.is_production,
        "path": "/",
    }
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.access_token_expire_minutes * 60,
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.refresh_token_expire_days * 86400,
        **common,
    )


def _safe_next(next_path: str | None) -> str:
    """Only allow internal absolute paths — guards against open redirects."""
    if next_path and next_path.startswith("/") and not next_path.startswith("//"):
        return next_path
    return "/admin"


def _login_redirect(
    error: str | None = None, next_path: str = "/admin"
) -> RedirectResponse:
    suffix = f"/login?{urlencode({'error': error})}" if error else _safe_next(next_path)
    return RedirectResponse(
        f"{settings.app_base_url}{suffix}", status_code=status.HTTP_302_FOUND
    )


@router.get("/google/login")
async def google_login(
    next: str = "/admin", db: AsyncSession = Depends(get_db)
) -> RedirectResponse:
    """Redirect the browser to Google's consent screen."""
    client_id, _ = await google.resolve_credentials(db)
    if not client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth not configured"
        )
    state = sign_state({"next": next})
    return RedirectResponse(
        google.build_authorization_url(state, client_id),
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    """Handle Google's redirect: verify, provision, set session cookies."""
    if error or not code or not state:
        return _login_redirect(error or "oauth_failed")

    try:
        state_data = verify_state(state)
    except BadSignature:
        return _login_redirect("bad_state")
    next_path = state_data.get("next", "/admin")

    client_id, client_secret = await google.resolve_credentials(db)
    try:
        profile = await google.exchange_code_for_profile(
            code, client_id, client_secret
        )
    except httpx.HTTPError:
        return _login_redirect("token_exchange_failed")

    if not profile.email_verified:
        return _login_redirect("email_unverified")
    allowed_domains = await google.resolve_allowed_domains(db)
    if not google.is_allowed_domain(profile.email, allowed_domains):
        return _login_redirect("domain_not_allowed")

    user = await upsert_user_from_google(db, profile)
    if not user.is_active:
        return _login_redirect("account_disabled")

    response = _login_redirect(next_path=next_path)
    _set_session_cookies(response, user)
    return response


@router.post("/password-login", response_model=MeResponse)
async def password_login(
    data: PasswordLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    """Test-mode/bootstrap login. Gated by ALLOW_PASSWORD_LOGIN; never for prod."""
    if not settings.allow_password_login:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Password login is disabled"
        )
    if not (settings.bootstrap_admin_email and settings.bootstrap_admin_password):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Bootstrap admin credentials are not configured",
        )
    email_ok = hmac.compare_digest(
        data.email.strip().lower(), settings.bootstrap_admin_email.strip().lower()
    )
    pw_ok = hmac.compare_digest(data.password, settings.bootstrap_admin_password)
    if not (email_ok and pw_ok):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    user = await upsert_bootstrap_admin(db, data.email, "Bootstrap Admin")
    _set_session_cookies(response, user)

    # Re-load with relationships for serialization.
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models.user import Role as _Role

    full = (
        await db.execute(
            select(User)
            .where(User.id == user.id)
            .options(
                selectinload(User.organization),
                selectinload(User.roles).selectinload(_Role.permissions),
            )
        )
    ).scalar_one()
    return MeResponse(user=_serialize_user(full))


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=_serialize_user(user))


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")
    return {"status": "logged_out"}


@router.get("/config")
async def auth_config(db: AsyncSession = Depends(get_db)) -> dict:
    """Public: which sign-in methods the login page should offer."""
    return {
        "google": await google.is_configured(db),
        "password_login": settings.allow_password_login,
    }
