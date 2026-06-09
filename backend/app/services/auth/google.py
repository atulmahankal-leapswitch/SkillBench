"""Google OAuth 2.0 / OpenID Connect helpers (manual flow via httpx)."""

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import settings

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


def build_authorization_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
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


async def exchange_code_for_profile(code: str) -> GoogleProfile:
    """Exchange an authorization code for the user's verified profile."""
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
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


def email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


def is_allowed_domain(email: str) -> bool:
    return email_domain(email) in settings.admin_email_domains
