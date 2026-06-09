"""Schedule + invitation lifecycle, org-scoped."""

import secrets
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from fastapi import status as http
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.enums import ScheduleStatus
from app.models.schedule import Invitation, Schedule
from app.models.test import Test
from app.models.user import User
from app.schemas.schedule import InvitationInfo, ScheduleCreate
from app.services.email import send_email
from app.services.pagination import paginate


def invite_url(token: str) -> str:
    return f"{settings.app_base_url}/exam/{token}"


def effective_status(schedule: Schedule, now: datetime | None = None) -> ScheduleStatus:
    """Display status: derive expiry from the window unless terminal."""
    now = now or datetime.now(UTC)
    if schedule.status in (ScheduleStatus.CANCELLED, ScheduleStatus.COMPLETED):
        return ScheduleStatus(schedule.status)
    if now > schedule.end_at:
        return ScheduleStatus.EXPIRED
    return ScheduleStatus(schedule.status)


def _base_query(user: User):
    return select(Schedule).where(Schedule.organization_id == user.organization_id)


async def _email_invitation(schedule: Schedule) -> bool:
    link = invite_url(schedule.invitation.token)
    body = (
        f"Hello {schedule.candidate.full_name},\n\n"
        f"You have been invited to take \"{schedule.test.title}\".\n\n"
        f"Start here: {link}\n\n"
        f"Window: {schedule.start_at:%Y-%m-%d %H:%M UTC} – "
        f"{schedule.end_at:%Y-%m-%d %H:%M UTC}\n"
        f"Duration: {schedule.test.duration_minutes} minutes.\n"
    )
    return await send_email(
        schedule.candidate.email, f"Your assessment: {schedule.test.title}", body
    )


async def list_schedules(
    db: AsyncSession,
    user: User,
    *,
    status_: str | None,
    candidate_id: uuid.UUID | None,
    test_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> tuple[list[Schedule], int]:
    stmt = _base_query(user)
    if status_:
        stmt = stmt.where(Schedule.status == status_)
    if candidate_id:
        stmt = stmt.where(Schedule.candidate_id == candidate_id)
    if test_id:
        stmt = stmt.where(Schedule.test_id == test_id)
    stmt = stmt.order_by(Schedule.start_at.desc())
    items, total = await paginate(db, stmt, limit, offset)
    for s in items:
        s.status = effective_status(s)
    return items, total


async def get_schedule(db: AsyncSession, user: User, schedule_id: uuid.UUID) -> Schedule:
    stmt = _base_query(user).where(Schedule.id == schedule_id)
    schedule = (await db.execute(stmt)).unique().scalar_one_or_none()
    if schedule is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Schedule not found")
    return schedule


async def create_schedule(db: AsyncSession, user: User, data: ScheduleCreate) -> Schedule:
    test = (
        await db.execute(
            select(Test).where(
                Test.id == data.test_id,
                Test.organization_id == user.organization_id,
                Test.deleted_at.is_(None),
            )
        )
    ).unique().scalar_one_or_none()
    if test is None:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Unknown test")

    candidate = (
        await db.execute(
            select(Candidate).where(
                Candidate.id == data.candidate_id,
                Candidate.organization_id == user.organization_id,
                Candidate.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if candidate is None:
        raise HTTPException(http.HTTP_400_BAD_REQUEST, "Unknown candidate")

    schedule = Schedule(
        organization_id=user.organization_id,
        test_id=test.id,
        candidate_id=candidate.id,
        start_at=data.start_at,
        end_at=data.end_at,
        created_by=user.id,
        invitation=Invitation(
            token=secrets.token_urlsafe(32),
            expires_at=data.end_at,
        ),
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    if await _email_invitation(schedule):
        schedule.invitation.sent_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(schedule)
    return schedule


async def cancel_schedule(db: AsyncSession, user: User, schedule_id: uuid.UUID) -> Schedule:
    schedule = await get_schedule(db, user, schedule_id)
    schedule.status = ScheduleStatus.CANCELLED
    if schedule.invitation and not schedule.invitation.revoked_at:
        schedule.invitation.revoked_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def resend_invitation(db: AsyncSession, user: User, schedule_id: uuid.UUID) -> Schedule:
    schedule = await get_schedule(db, user, schedule_id)
    if effective_status(schedule) in (ScheduleStatus.CANCELLED, ScheduleStatus.EXPIRED):
        raise HTTPException(
            http.HTTP_400_BAD_REQUEST, "Cannot resend a cancelled/expired invitation"
        )
    if await _email_invitation(schedule):
        schedule.invitation.sent_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(schedule)
    return schedule


async def get_invitation_by_token(db: AsyncSession, token: str) -> Invitation:
    invitation = (
        await db.execute(
            select(Invitation)
            .where(Invitation.token == token)
            .options(
                joinedload(Invitation.schedule).joinedload(Schedule.candidate),
                joinedload(Invitation.schedule).joinedload(Schedule.test),
            )
        )
    ).unique().scalar_one_or_none()
    if invitation is None:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "Invalid invitation")
    return invitation


async def invitation_info(db: AsyncSession, token: str) -> InvitationInfo:
    invitation = await get_invitation_by_token(db, token)
    schedule = invitation.schedule
    now = datetime.now(UTC)
    eff = effective_status(schedule, now)
    can_start = (
        invitation.revoked_at is None
        and eff not in (ScheduleStatus.CANCELLED, ScheduleStatus.EXPIRED, ScheduleStatus.COMPLETED)
        and schedule.start_at <= now <= schedule.end_at
    )
    return InvitationInfo(
        candidate_name=schedule.candidate.full_name,
        test_title=schedule.test.title,
        duration_minutes=schedule.test.duration_minutes,
        start_at=schedule.start_at,
        end_at=schedule.end_at,
        status=eff,
        can_start=can_start,
    )
