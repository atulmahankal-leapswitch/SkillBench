# Phase 03 — Scheduling & Invitations

**Status:** ⬜ pending

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
