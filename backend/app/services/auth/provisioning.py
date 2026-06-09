"""Provision organisations and users from a verified Google profile."""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import DEFAULT_FIRST_USER_ROLE, DEFAULT_NEW_USER_ROLE
from app.models.organization import Organization
from app.models.user import Role, User
from app.services.auth.google import GoogleProfile, email_domain


async def _get_or_create_org(db: AsyncSession, domain: str) -> tuple[Organization, bool]:
    org = (
        await db.execute(
            select(Organization).where(Organization.primary_domain == domain)
        )
    ).scalar_one_or_none()
    if org:
        return org, False
    org = Organization(name=domain, primary_domain=domain)
    db.add(org)
    await db.flush()
    return org, True


async def _role(db: AsyncSession, name: str) -> Role | None:
    return (
        await db.execute(select(Role).where(Role.name == name))
    ).scalar_one_or_none()


async def _org_user_count(db: AsyncSession, org_id) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(User)
            .where(User.organization_id == org_id)
        )
    ).scalar_one()


async def upsert_user_from_google(
    db: AsyncSession, profile: GoogleProfile
) -> User:
    """Create or update a user from a verified Google profile.

    The caller must have already verified the email domain is allowed.
    """
    domain = email_domain(profile.email)
    org, _ = await _get_or_create_org(db, domain)

    user = (
        await db.execute(
            select(User).where(User.google_sub == profile.sub)
        )
    ).scalar_one_or_none()

    if user is None:
        # Fall back to email match (e.g. pre-provisioned without a google_sub).
        user = (
            await db.execute(select(User).where(User.email == profile.email))
        ).scalar_one_or_none()

    if user is None:
        is_first = (await _org_user_count(db, org.id)) == 0
        user = User(
            organization_id=org.id,
            email=profile.email,
            google_sub=profile.sub,
            full_name=profile.name,
            avatar_url=profile.picture,
        )
        db.add(user)
        await db.flush()
        role_name = (
            DEFAULT_FIRST_USER_ROLE if is_first else DEFAULT_NEW_USER_ROLE
        )
        role = await _role(db, role_name)
        if role:
            user.roles.append(role)
    else:
        # Keep profile fields fresh on every login.
        user.google_sub = profile.sub
        user.full_name = profile.name or user.full_name
        user.avatar_url = profile.picture or user.avatar_url

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return user
