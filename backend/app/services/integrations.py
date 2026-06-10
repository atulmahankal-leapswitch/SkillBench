"""API key + webhook management and signed webhook dispatch."""

import asyncio
import hashlib
import hmac
import json
import logging
import secrets
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.models.integration import ApiKey, Webhook, WebhookDelivery
from app.models.user import User

logger = logging.getLogger("skillbench.integrations")

MAX_WEBHOOK_ATTEMPTS = 3


# ── API keys ─────────────────────────────────────────────────────────────────
def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_key() -> tuple[str, str]:
    """Return (plaintext_key, prefix). Plaintext is shown to the user once."""
    body = secrets.token_urlsafe(32)
    prefix = secrets.token_hex(4)
    return f"sb_{prefix}_{body}", f"sb_{prefix}"


async def create_api_key(
    db: AsyncSession, user: User, name: str, scopes: list[str]
) -> tuple[ApiKey, str]:
    raw, prefix = generate_key()
    key = ApiKey(
        organization_id=user.organization_id,
        name=name,
        key_hash=hash_key(raw),
        prefix=prefix,
        scopes=scopes,
        created_by=user.id,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key, raw


async def list_api_keys(db: AsyncSession, user: User) -> list[ApiKey]:
    return list(
        (
            await db.execute(
                select(ApiKey)
                .where(ApiKey.organization_id == user.organization_id)
                .order_by(ApiKey.created_at.desc())
            )
        ).scalars().all()
    )


async def revoke_api_key(db: AsyncSession, user: User, key_id: uuid.UUID) -> None:
    key = (
        await db.execute(
            select(ApiKey).where(
                ApiKey.id == key_id, ApiKey.organization_id == user.organization_id
            )
        )
    ).scalar_one_or_none()
    if key is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "API key not found")
    key.revoked_at = datetime.now(UTC)
    await db.commit()


async def resolve_api_key(db: AsyncSession, raw: str) -> ApiKey:
    """Resolve a plaintext key to an active ApiKey (updates last_used_at)."""
    key = (
        await db.execute(select(ApiKey).where(ApiKey.key_hash == hash_key(raw)))
    ).scalar_one_or_none()
    if key is None or key.revoked_at is not None:
        raise HTTPException(http.HTTP_401_UNAUTHORIZED, "Invalid or revoked API key")
    key.last_used_at = datetime.now(UTC)
    await db.commit()
    return key


# ── Webhooks ─────────────────────────────────────────────────────────────────
def sign_payload(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


async def create_webhook(
    db: AsyncSession, user: User, url: str, events: list[str]
) -> Webhook:
    wh = Webhook(
        organization_id=user.organization_id,
        url=url,
        secret=secrets.token_urlsafe(24),
        events=events,
        created_by=user.id,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


async def list_webhooks(db: AsyncSession, user: User) -> list[Webhook]:
    return list(
        (
            await db.execute(
                select(Webhook)
                .where(Webhook.organization_id == user.organization_id)
                .order_by(Webhook.created_at.desc())
            )
        ).scalars().all()
    )


async def delete_webhook(db: AsyncSession, user: User, webhook_id: uuid.UUID) -> None:
    wh = (
        await db.execute(
            select(Webhook).where(
                Webhook.id == webhook_id,
                Webhook.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if wh is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Webhook not found")
    await db.delete(wh)
    await db.commit()


async def _deliver(wh: Webhook, event: str, payload: dict) -> WebhookDelivery:
    body = json.dumps({"event": event, "data": payload}, default=str).encode()
    signature = sign_payload(wh.secret, body)
    delivery = WebhookDelivery(
        webhook_id=wh.id, event=event, payload=payload, created_at=datetime.now(UTC)
    )
    last_err = ""
    status_code = None
    for attempt in range(1, MAX_WEBHOOK_ATTEMPTS + 1):
        delivery.attempts = attempt
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    wh.url,
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                        "X-SkillBench-Event": event,
                        "X-SkillBench-Signature": f"sha256={signature}",
                    },
                )
            status_code = resp.status_code
            if 200 <= resp.status_code < 300:
                delivery.success = True
                break
            last_err = f"HTTP {resp.status_code}"
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
        await asyncio.sleep(0)  # yield between retries
    delivery.status_code = status_code
    delivery.error = "" if delivery.success else last_err
    return delivery


async def dispatch_event(organization_id: uuid.UUID, event: str, payload: dict) -> None:
    """Deliver an event to all subscribed, active webhooks (own DB session)."""
    async with SessionLocal() as db:
        hooks = (
            await db.execute(
                select(Webhook).where(
                    Webhook.organization_id == organization_id,
                    Webhook.active.is_(True),
                    Webhook.events.any(event),
                )
            )
        ).scalars().all()
        for wh in hooks:
            delivery = await _deliver(wh, event, payload)
            db.add(delivery)
        await db.commit()


def dispatch_in_background(organization_id: uuid.UUID, event: str, payload: dict) -> None:
    """Fire-and-forget dispatch; never blocks the caller."""
    async def _run():
        try:
            await dispatch_event(organization_id, event, payload)
        except Exception:  # noqa: BLE001
            logger.exception("Webhook dispatch failed for %s", event)

    asyncio.create_task(_run())
