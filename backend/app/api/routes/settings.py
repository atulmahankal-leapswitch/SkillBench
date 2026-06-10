"""Organisation settings: AI provider configuration (settings:manage)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.ai_settings import AISettingsOut, AISettingsUpdate
from app.services import ai

router = APIRouter(prefix="/settings", tags=["settings"])

CLEAR = "__clear__"


async def _org(db: AsyncSession, user: User) -> Organization:
    return (
        await db.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
    ).scalar_one()


def _out(org: Organization) -> AISettingsOut:
    return AISettingsOut(
        provider=org.ai_provider,
        model=org.ai_model,
        api_key_set=bool(org.ai_api_key),
        available_providers=ai.AVAILABLE_PROVIDERS,
    )


@router.get("/ai", response_model=AISettingsOut)
async def get_ai_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> AISettingsOut:
    return _out(await _org(db, user))


@router.put("/ai", response_model=AISettingsOut)
async def update_ai_settings(
    data: AISettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> AISettingsOut:
    org = await _org(db, user)
    org.ai_provider = data.provider.strip()
    org.ai_model = data.model.strip()
    if data.api_key == CLEAR:
        org.ai_api_key = ""
    elif data.api_key:
        org.ai_api_key = data.api_key.strip()
    await db.commit()
    await db.refresh(org)
    return _out(org)
