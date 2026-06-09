"""Helpers for paginated list queries."""

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def paginate(
    db: AsyncSession, stmt: Select, limit: int, offset: int
) -> tuple[list, int]:
    """Return (items, total) for a SELECT, applying limit/offset to items."""
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return list(rows), total
