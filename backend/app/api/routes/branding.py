"""Organisation branding endpoints (admin)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.core.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.branding import BrandingOut, BrandingUpdate

router = APIRouter(prefix="/branding", tags=["branding"])


async def _org(db: AsyncSession, user: User) -> Organization:
    return (
        await db.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
    ).scalar_one()


@router.get("", response_model=BrandingOut)
async def get_branding(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BrandingOut:
    return await _org(db, user)


@router.put("", response_model=BrandingOut)
async def update_branding(
    data: BrandingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("settings:manage")),
) -> BrandingOut:
    org = await _org(db, user)
    org.display_name = data.display_name
    org.logo_url = data.logo_url
    org.brand_color = data.brand_color
    await db.commit()
    await db.refresh(org)
    return org
