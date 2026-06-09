# Phase 01 — Auth & RBAC

**Status:** ⬜ pending

## Goal

Admins sign in with Google (organisation domain only); a role/permission system
governs what each admin can do and which candidates they manage.

## Scope

- Google OAuth 2.0 login flow (`/api/auth/google/login` → callback → session).
- Restrict sign-in to `ALLOWED_ADMIN_EMAIL_DOMAINS`; reject others clearly.
- Session/JWT issuance (access + refresh), `get_current_user` dependency.
- Models: `Organization`, `User`, `Role`, `Permission`, `user_roles`,
  candidate-assignment link.
- Alembic migration env + first migration.
- Frontend: sign-in page, auth guard for the admin area, session handling.
- Seed: default roles (Owner/Admin/Recruiter/Viewer) + permission matrix.

## Acceptance

- Org-domain Google account logs in; non-org email is rejected.
- Protected API routes require a valid session and enforce role permissions.
- Migrations run cleanly from empty DB.

## Open questions

- Exact role set and permission granularity (per-resource vs. coarse).
- Candidate-assignment model: direct user↔candidate vs. team-based.
