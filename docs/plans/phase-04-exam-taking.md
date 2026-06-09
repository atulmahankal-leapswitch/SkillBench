# Phase 04 — Candidate Exam-Taking

**Status:** ✅ completed

## Delivered
- `Attempt` (one per schedule; status, started_at, server-computed `expires_at`
  = min(start+duration, window end), submitted_at) + `Answer` (JSONB response,
  unique per attempt+question). Migration `0004`.
- Token-authenticated public exam API: `GET /api/exam/{token}` (resume),
  `POST /start`, `PUT /answer` (autosave), `POST /submit`. Server enforces the
  window on start and auto-expires/auto-submits past `expires_at`.
- **Candidate-safe question view**: correct keys / hidden test-case expected
  outputs are stripped before reaching the candidate.
- Frontend `/exam/[token]`: intro → timed runner (countdown synced to server,
  per-type inputs, autosave, resume) → submit → thank-you / time-up screens.

## Acceptance — verified
Live: not_started leaks 0 questions; start → in_progress with sanitized
questions (no `correct_keys`); answers autosave and persist across resume;
unknown question → 400; submit → submitted; answer after submit → 409. ruff
clean, tests pass, frontend builds (`/exam/[token]`).

---
## Original scope

## Goal

Candidate opens an invite during the window and completes the test.

## Scope

- `Attempt` state machine: not_started → in_progress → submitted/expired.
- Candidate exam UI: instructions, timed runner, per-question navigation,
  autosave of `Answer`s, resume within window, explicit submit + auto-submit on
  expiry.
- Server-enforced timing (don't trust the client clock).
- Hooks for proctoring events (wired fully in Phase 07).

## Acceptance

- Candidate can start, answer, autosave, and submit within the window.
- Timer enforced server-side; expiry auto-submits.
