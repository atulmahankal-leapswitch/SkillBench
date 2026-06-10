"""Claude Code SDK OAuth status.

The Claude Code SDK (claude-agent-sdk) authenticates with the OAuth tokens that
`claude login` writes to ~/.claude/.credentials.json. That directory is
bind-mounted into the backend container (see compose). This module reports the
login status without ever exposing the tokens.
"""

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import httpx

CRED_PATH = Path(os.environ.get("CLAUDE_HOME", "/root/.claude")) / ".credentials.json"
PROFILE_URL = "https://api.anthropic.com/api/oauth/profile"


async def _fetch_email(access_token: str) -> tuple[str | None, str | None]:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                PROFILE_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
            resp.raise_for_status()
            account = (resp.json() or {}).get("account") or {}
        return account.get("email"), account.get("display_name") or account.get("full_name")
    except Exception:  # noqa: BLE001 - best-effort enrichment
        return None, None


async def status() -> dict:
    if not CRED_PATH.exists():
        return {
            "authenticated": False,
            "reason": "Not logged in. Run `claude login` on the host "
            "(its ~/.claude is mounted into the backend).",
        }
    try:
        data = json.loads(CRED_PATH.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return {"authenticated": False, "reason": f"Could not read credentials: {exc}"}

    inner = data.get("claudeAiOauth") or {}
    access_token = inner.get("accessToken")
    expires_at_ms = inner.get("expiresAt")
    expires_at_iso, expired = None, False
    if isinstance(expires_at_ms, int | float):
        dt = datetime.fromtimestamp(expires_at_ms / 1000, tz=UTC)
        expires_at_iso = dt.isoformat()
        expired = dt < datetime.now(tz=UTC)

    email = name = None
    if access_token and not expired:
        email, name = await _fetch_email(access_token)

    return {
        "authenticated": bool(access_token) and not expired,
        "email": email,
        "display_name": name,
        "expires_at": expires_at_iso,
        "expired": expired,
        "subscription_type": inner.get("subscriptionType"),
    }


def logout() -> None:
    if CRED_PATH.exists():
        CRED_PATH.unlink()
