# Phase 04 — Candidate Exam-Taking

**Status:** ⬜ pending

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
