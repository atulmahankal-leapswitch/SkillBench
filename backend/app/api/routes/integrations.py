"""Admin endpoints to manage API keys and webhooks (settings:manage)."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.integration import (
    ApiKeyCreate,
    ApiKeyCreated,
    ApiKeyOut,
    WebhookCreate,
    WebhookOut,
)
from app.services import integrations as svc

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/api-keys", response_model=list[ApiKeyOut])
async def list_keys(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> list[ApiKeyOut]:
    return await svc.list_api_keys(db, user)


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_key(
    data: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> ApiKeyCreated:
    key, raw = await svc.create_api_key(db, user, data.name, data.scopes)
    base = ApiKeyOut.model_validate(key)
    return ApiKeyCreated(**base.model_dump(), key=raw)


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> None:
    await svc.revoke_api_key(db, user, key_id)


@router.get("/webhooks", response_model=list[WebhookOut])
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> list[WebhookOut]:
    return await svc.list_webhooks(db, user)


@router.post("/webhooks", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    data: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> WebhookOut:
    return await svc.create_webhook(db, user, data.url, data.events)


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> None:
    await svc.delete_webhook(db, user, webhook_id)
