"""Health and readiness endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """Liveness: the process is up."""
    return {"status": "ok", "version": __version__}


@router.get("/health/ready")
async def ready(db: AsyncSession = Depends(get_db)) -> dict:
    """Readiness: dependencies (database) are reachable."""
    db_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"status": "ready" if db_ok else "degraded", "database": db_ok}
