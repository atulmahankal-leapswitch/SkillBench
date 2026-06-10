"""Public job-application endpoints (candidate self-apply, no auth)."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.apply import ApplyCreate, ApplyInfo
from app.services import candidates as svc

router = APIRouter(prefix="/apply", tags=["apply"])


@router.get("/{org_id}", response_model=ApplyInfo)
async def apply_info(
    org_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> ApplyInfo:
    org = await svc.apply_info(db, org_id)
    return ApplyInfo(
        organization_name=org.name,
        display_name=org.display_name,
        logo_url=org.logo_url,
        brand_color=org.brand_color,
    )


@router.post("/{org_id}", status_code=status.HTTP_201_CREATED)
async def apply(
    org_id: uuid.UUID, data: ApplyCreate, db: AsyncSession = Depends(get_db)
) -> dict:
    await svc.public_apply(db, org_id, data.full_name, data.email, data.job_title)
    return {"submitted": True}
