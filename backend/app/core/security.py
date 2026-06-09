"""JWT issuance/verification, OAuth state signing, and cookie helpers."""

from datetime import UTC, datetime, timedelta

import jwt
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.core.config import settings

ALGORITHM = "HS256"

ACCESS_COOKIE = "sb_access"
REFRESH_COOKIE = "sb_refresh"

_state_serializer = URLSafeTimedSerializer(
    settings.secret_key, salt="oauth-state"
)


def _now() -> datetime:
    return datetime.now(UTC)


def create_token(subject: str, token_type: str, expires: timedelta, **claims) -> str:
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": _now(),
        "exp": _now() + expires,
        **claims,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_access_token(user_id: str, org_id: str) -> str:
    return create_token(
        user_id,
        "access",
        timedelta(minutes=settings.access_token_expire_minutes),
        org=org_id,
    )


def create_refresh_token(user_id: str) -> str:
    return create_token(
        user_id, "refresh", timedelta(days=settings.refresh_token_expire_days)
    )


def decode_token(token: str, expected_type: str | None = None) -> dict:
    """Decode and validate a JWT. Raises jwt exceptions on failure."""
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    if expected_type and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token")
    return payload


# ── OAuth state (CSRF protection for the Google round-trip) ──────────────────


def sign_state(data: dict) -> str:
    return _state_serializer.dumps(data)


def verify_state(token: str, max_age_seconds: int = 600) -> dict:
    """Returns the signed payload, or raises BadSignature if invalid/expired."""
    return _state_serializer.loads(token, max_age=max_age_seconds)


__all__ = [
    "ACCESS_COOKIE",
    "REFRESH_COOKIE",
    "BadSignature",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "sign_state",
    "verify_state",
]
