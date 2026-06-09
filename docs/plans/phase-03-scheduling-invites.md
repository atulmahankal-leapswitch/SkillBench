# Phase 03 — Scheduling & Invitations

**Status:** ✅ completed

## Delivered

- **Models:** `Schedule` (test + candidate + `[start_at, end_at]` + status,
  with joined test/candidate) and one-to-one `Invitation` (random
  `secrets.token_urlsafe` token, `expires_at`, `sent_at`, `revoked_at`).
  Migration `0003`.
- **Email service** (`app/services/email.py`): stdlib SMTP in a worker thread;
  no-ops with a log line when SMTP is unconfigured (dev-friendly).
- **Admin APIs** (`schedule:read/write`): create (validates org-owned test +
  candidate, emails the invite), list (filterable, with effective/derived
  status), get, `cancel` (revokes invite), `resend`.
- **Public endpoint** `GET /api/invitations/{token}` (no auth) → candidate-facing
  info + `can_start` flag (validates window, revocation, terminal status).
- **Frontend** `/admin/schedules`: list with status, schedule modal (pick test
  + candidate + window), copy-invite-link, resend, cancel. Nav updated.

## Acceptance — verified

- Live stack: created an active-window schedule (invite token issued); invalid
  window → 422; public invite info `can_start: true`; unknown token → 404;
  list scoped to org; resend OK; cancel → invite revoked, `can_start: false`;
  resend after cancel → 400. ruff clean, tests pass, frontend builds.

---

## Original scope

## Goal

Assign a test to a candidate for a time window and invite them via a tokened
link (no candidate account required).

## Scope

- `Schedule`: test + candidate + `[start_at, end_at]` window + status.
- `Invitation`: signed token tied to a schedule, expiry, single-use entry.
- Email delivery (SMTP) of the invite; resend; revoke.
- Backend endpoints to create/list schedules and validate an invite token.
- Frontend: schedule creation UI; invite status tracking.

## Acceptance

- Scheduling a test emails a working invite link.
- Token validates only within the window; expired/used/invalid tokens rejected.
