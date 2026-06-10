"""Proctoring: record integrity events (candidate) and read them (admin)."""

import uuid

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.models.enums import AttemptStatus
from app.models.proctor import ProctorEvent
from app.models.user import User

# Cap stored webcam snapshot size (base64 data URL chars) ~ 350 KB.
MAX_IMAGE_CHARS = 350_000

ALLOWED_TYPES = {
    "tab_blur",
    "tab_focus",
    "focus_loss",
    "fullscreen_exit",
    "fullscreen_enter",
    "copy",
    "paste",
    "webcam_snapshot",
    "webcam_denied",
    "screen_snapshot",
    "screen_denied",
}


async def record_event(
    db: AsyncSession, attempt: Attempt, type_: str, meta: dict | None
) -> None:
    if type_ not in ALLOWED_TYPES:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, f"Unknown event type: {type_}")
    meta = meta or {}
    image = meta.get("image")
    if image and len(image) > MAX_IMAGE_CHARS:
        raise HTTPException(http.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Snapshot too large")
    db.add(
        ProctorEvent(
            organization_id=attempt.organization_id,
            attempt_id=attempt.id,
            type=type_,
            meta=meta,
        )
    )
    await db.commit()


def _require_in_progress(attempt: Attempt) -> None:
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(http.HTTP_409_CONFLICT, "Attempt is not in progress")


# ── Admin reads ──────────────────────────────────────────────────────────────
async def _admin_attempt(db: AsyncSession, user: User, attempt_id: uuid.UUID) -> Attempt:
    attempt = (
        await db.execute(
            select(Attempt).where(
                Attempt.id == attempt_id,
                Attempt.organization_id == user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if attempt is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Attempt not found")
    return attempt


async def list_events(db: AsyncSession, user: User, attempt_id: uuid.UUID) -> list[dict]:
    await _admin_attempt(db, user, attempt_id)
    events = (
        (
            await db.execute(
                select(ProctorEvent)
                .where(ProctorEvent.attempt_id == attempt_id)
                .order_by(ProctorEvent.at.asc())
            )
        )
        .scalars()
        .all()
    )
    out = []
    for e in events:
        meta = dict(e.meta or {})
        has_image = "image" in meta
        meta.pop("image", None)  # keep the timeline light
        out.append(
            {
                "id": str(e.id),
                "type": e.type,
                "at": e.at.isoformat(),
                "has_image": has_image,
                "meta": meta,
            }
        )
    return out


async def get_snapshot(
    db: AsyncSession, user: User, attempt_id: uuid.UUID, event_id: uuid.UUID
) -> str:
    await _admin_attempt(db, user, attempt_id)
    event = (
        await db.execute(
            select(ProctorEvent).where(
                ProctorEvent.id == event_id,
                ProctorEvent.attempt_id == attempt_id,
            )
        )
    ).scalar_one_or_none()
    image = (event.meta or {}).get("image") if event else None
    if not image:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Snapshot not found")
    return image


async def summary(db: AsyncSession, user: User, attempt_id: uuid.UUID) -> dict:
    """Counts per event type (used by integrity scoring later)."""
    await _admin_attempt(db, user, attempt_id)
    events = (
        (await db.execute(select(ProctorEvent).where(ProctorEvent.attempt_id == attempt_id)))
        .scalars()
        .all()
    )
    counts: dict[str, int] = {}
    for e in events:
        counts[e.type] = counts.get(e.type, 0) + 1
    return counts
