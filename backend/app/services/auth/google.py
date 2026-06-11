"""Google OAuth 2.0 / OpenID Connect helpers (manual flow via httpx)."""

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.organization import Organization

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"

SCOPES = ["openid", "email", "profile"]


@dataclass
class GoogleProfile:
    sub: str
    email: str
    email_verified: bool
    name: str
    picture: str
    hosted_domain: str | None


def build_authorization_url(state: str, client_id: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
        # Hint Google to the org domain when a single domain is configured.
        **(
            {"hd": settings.admin_email_domains[0]}
            if len(settings.admin_email_domains) == 1
            else {}
        ),
    }
    return f"{AUTH_ENDPOINT}?{urlencode(params)}"


async def exchange_code_for_profile(
    code: str, client_id: str, client_secret: str
) -> GoogleProfile:
    """Exchange an authorization code for the user's verified profile."""
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": settings.google_oauth_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        access_token = token_resp.json()["access_token"]

        info_resp = await client.get(
            USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        info_resp.raise_for_status()
        info = info_resp.json()

    return GoogleProfile(
        sub=info["sub"],
        email=info["email"],
        email_verified=bool(info.get("email_verified", False)),
        name=info.get("name", ""),
        picture=info.get("picture", ""),
        hosted_domain=info.get("hd"),
    )


async def _configured_org(db: AsyncSession):
    """The org whose Google OAuth client id is set (app-global Google project)."""
    return (
        await db.execute(
            select(
                Organization.google_oauth_client_id,
                Organization.google_oauth_client_secret,
                Organization.google_oauth_domain,
            ).where(Organization.google_oauth_client_id != "")
        )
    ).first()


async def resolve_credentials(db: AsyncSession) -> tuple[str, str]:
    """Google OAuth client id/secret: prefer an org-configured pair (set in
    Settings), else fall back to the env-configured values."""
    row = await _configured_org(db)
    if row and row[0]:
        return row[0], row[1]
    return settings.google_client_id, settings.google_client_secret


async def resolve_allowed_domains(db: AsyncSession) -> list[str]:
    """Allowed sign-in email domains: the org-configured 'Organization domain'
    if set, else the env-configured admin domains."""
    row = await _configured_org(db)
    if row and row[2]:
        return [row[2].lower()]
    return settings.admin_email_domains


async def is_configured(db: AsyncSession) -> bool:
    client_id, _ = await resolve_credentials(db)
    return bool(client_id)


def email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


def is_allowed_domain(email: str, domains: list[str] | None = None) -> bool:
    allowed = domains if domains is not None else settings.admin_email_domains
    return email_domain(email) in allowed
