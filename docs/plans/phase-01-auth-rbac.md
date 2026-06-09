# Phase 01 — Auth & RBAC

**Status:** ✅ completed

## Goal

Admins sign in with Google (organisation domain only); a role/permission system
governs what each admin can do.

## Delivered

- **Google OAuth 2.0 / OIDC flow** (manual via httpx):
  `/api/auth/google/login` → Google consent (signed, time-limited `state`) →
  `/api/auth/google/callback`. Domain-restricted via
  `ALLOWED_ADMIN_EMAIL_DOMAINS`; verified-email required; clear error redirects
  (`/login?error=…`).
- **Sessions:** JWT access + refresh issued as httpOnly, SameSite=Lax cookies
  (`secure` in production). `/api/auth/me` and `/api/auth/logout`.
- **Provisioning:** organisation auto-created per email domain; first user of an
  org gets **Owner**, subsequent users get **Viewer**; profile refreshed on
  each login.
- **RBAC catalog** (`app/core/rbac.py`): 13 permissions, 4 system roles
  (Owner/Admin = all, Recruiter = manage content, Viewer = read-only).
  `require_permission(...)` dependency factory + `get_current_user`.
- **Models:** `Organization`, `User`, `Role`, `Permission`, `user_roles`,
  `role_permissions` (async SQLAlchemy 2, UUID PKs, citext emails).
- **Alembic:** async `env.py`, initial migration `0001_initial` that creates
  all tables and seeds the catalog from `app.core.rbac` (DRY). Migrations run
  automatically on backend start (dev & prod).
- **Frontend:** `/login` (Continue with Google + error display), guarded
  `/admin` area (server-side `me` check, redirect to `/login`), dashboard
  showing org/roles/permissions, sign-out.

## Acceptance — verified

- Stack brought up (Postgres + backend); migration applied; `/api/health/ready`
  reports `database: true`.
- `/api/auth/me` → 401 unauthenticated; `/api/auth/google/login` → 503 when
  OAuth unconfigured (graceful).
- Seed verified in DB: 13 permissions, 4 roles, 41 role↔permission links
  (Owner/Admin 13, Recruiter 10, Viewer 5).
- Backend test suite passes in-container.

## Deferred

- **Candidate-assignment link** (user ↔ candidate scoping) moves to **Phase 02**,
  where the `Candidate` model is introduced — avoids a forward dependency.
- Refresh-token rotation endpoint (access token currently re-obtained via
  re-login) — revisit if session length becomes an issue.
