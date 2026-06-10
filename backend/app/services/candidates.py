"""Candidate CRUD + assignment, org-scoped and assignment-aware."""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate, user_candidate_assignments
from app.models.enums import CandidateSource, CandidateStage
from app.models.organization import Organization
from app.models.user import User
from app.schemas.candidate import CandidateCreate, CandidateUpdate
from app.services.pagination import paginate

# Users with this permission see/manage all candidates in the org; others are
# restricted to the candidates assigned to them.
MANAGE_ALL = "user:manage"


def _can_see_all(user: User) -> bool:
    return MANAGE_ALL in user.permission_codes


def _base_query(user: User):
    stmt = select(Candidate).where(
        Candidate.organization_id == user.organization_id,
        Candidate.deleted_at.is_(None),
    )
    if not _can_see_all(user):
        stmt = stmt.where(
            Candidate.id.in_(
                select(user_candidate_assignments.c.candidate_id).where(
                    user_candidate_assignments.c.user_id == user.id
                )
            )
        )
    return stmt


async def list_candidates(
    db: AsyncSession,
    user: User,
    *,
    q: str | None,
    tag: str | None,
    source: str | None,
    status_: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Candidate], int]:
    stmt = _base_query(user)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(Candidate.full_name.ilike(like), Candidate.email.ilike(like))
        )
    if tag:
        stmt = stmt.where(Candidate.tags.any(tag))
    if source:
        stmt = stmt.where(Candidate.source == source)
    if status_:
        stmt = stmt.where(Candidate.status == status_)
    stmt = stmt.order_by(Candidate.created_at.desc())
    return await paginate(db, stmt, limit, offset)


async def get_candidate(
    db: AsyncSession, user: User, candidate_id: uuid.UUID
) -> Candidate:
    stmt = _base_query(user).where(Candidate.id == candidate_id)
    candidate = (await db.execute(stmt)).scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidate not found")
    return candidate


async def create_candidate(
    db: AsyncSession, user: User, data: CandidateCreate
) -> Candidate:
    candidate = Candidate(
        organization_id=user.organization_id,
        full_name=data.full_name,
        email=data.email,
        job_title=data.job_title,
        source=data.source,
        stage=data.stage,
        tags=data.tags,
        notes=data.notes,
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


async def update_candidate(
    db: AsyncSession, user: User, candidate_id: uuid.UUID, data: CandidateUpdate
) -> Candidate:
    candidate = await get_candidate(db, user, candidate_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    await db.commit()
    await db.refresh(candidate)
    return candidate


async def delete_candidate(
    db: AsyncSession, user: User, candidate_id: uuid.UUID
) -> None:
    candidate = await get_candidate(db, user, candidate_id)
    candidate.deleted_at = datetime.now(UTC)
    await db.commit()


async def set_assignees(
    db: AsyncSession, user: User, candidate_id: uuid.UUID, user_ids: list[uuid.UUID]
) -> Candidate:
    candidate = await get_candidate(db, user, candidate_id)
    # Only users within the same organisation may be assigned.
    assignees = (
        (
            await db.execute(
                select(User).where(
                    User.id.in_(user_ids),
                    User.organization_id == user.organization_id,
                )
            )
        )
        .scalars()
        .all()
    )
    found = {u.id for u in assignees}
    missing = set(user_ids) - found
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown user(s) in this organisation: {sorted(map(str, missing))}",
        )
    candidate.assignees = list(assignees)
    await db.commit()
    await db.refresh(candidate)
    return candidate


# ── Public self-apply (no auth) ──────────────────────────────────────────────
async def _public_org(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    org = (
        await db.execute(select(Organization).where(Organization.id == org_id))
    ).scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organisation not found")
    return org


async def apply_info(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    return await _public_org(db, org_id)


async def public_apply(
    db: AsyncSession, org_id: uuid.UUID, full_name: str, email: str, job_title: str
) -> None:
    org = await _public_org(db, org_id)
    db.add(
        Candidate(
            organization_id=org.id,
            full_name=full_name,
            email=email,
            job_title=job_title,
            source=CandidateSource.EXTERNAL,
            stage=CandidateStage.APPLIED,
        )
    )
    await db.commit()
