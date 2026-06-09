"""Authentication routes: Google OAuth sign-in, session, logout."""

from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from app.api.deps import get_current_user
from app.core.config import settings
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
from app.services.auth.provisioning import upsert_user_from_google
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

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


def _login_redirect(error: str | None = None) -> RedirectResponse:
    suffix = f"/login?{urlencode({'error': error})}" if error else "/admin"
    return RedirectResponse(
        f"{settings.app_base_url}{suffix}", status_code=status.HTTP_302_FOUND
    )


@router.get("/google/login")
async def google_login(next: str = "/admin") -> RedirectResponse:
    """Redirect the browser to Google's consent screen."""
    if not settings.google_client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth not configured"
        )
    state = sign_state({"next": next})
    return RedirectResponse(
        google.build_authorization_url(state), status_code=status.HTTP_302_FOUND
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
        verify_state(state)
    except BadSignature:
        return _login_redirect("bad_state")

    try:
        profile = await google.exchange_code_for_profile(code)
    except httpx.HTTPError:
        return _login_redirect("token_exchange_failed")

    if not profile.email_verified:
        return _login_redirect("email_unverified")
    if not google.is_allowed_domain(profile.email):
        return _login_redirect("domain_not_allowed")

    user = await upsert_user_from_google(db, profile)
    if not user.is_active:
        return _login_redirect("account_disabled")

    response = _login_redirect()
    _set_session_cookies(response, user)
    return response


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=_serialize_user(user))


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")
    return {"status": "logged_out"}
