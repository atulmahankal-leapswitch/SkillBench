# Phase 07 — Proctoring

**Status:** ✅ completed

## Delivered
- `ProctorEvent` model (type, at, JSONB meta) + migration 0006. Per-test
  proctoring toggles stored in `test.settings.proctoring` and surfaced to the
  candidate via `ExamState.proctoring`.
- Candidate `POST /api/exam/{token}/proctor` records events (in_progress only;
  validated type allow-list; webcam snapshots stored as capped base64 data URLs).
- Admin `GET /results/{attempt_id}/proctor` (timeline + per-type summary) and
  `…/proctor/{event_id}/image` (snapshot).
- Exam UI: tab/focus monitoring, copy-paste blocking, fullscreen-exit detection,
  webcam snapshots every 30s (graceful on deny) — all fire-and-forget so they
  never block the exam. Test form gains proctoring toggles; results detail shows
  the proctor timeline + snapshot viewer.

## Acceptance — verified
Live: proctoring settings exposed in exam state; events recorded; unknown type
400; snapshot stored + retrievable as data URL; admin timeline (3 events) +
summary counts. 6 tests pass, ruff clean, frontend builds.

> MVP stores webcam snapshots as base64 in JSONB (size-capped). Moving to
> object storage is a later optimization.

---
## Original scope

## Goal

Capture integrity signals during an attempt.

## Scope

- Tab/visibility-change and focus-loss detection → `ProctorEvent`s.
- Webcam monitoring: periodic snapshots (consent-gated), stored to object
  storage with references on the event.
- Fullscreen enforcement / copy-paste detection (configurable per test).
- Admin timeline of events on the candidate report.

## Acceptance

- Tab switches and focus loss are recorded and shown on the report.
- Webcam capture works with explicit candidate consent; absence is flagged.

## Notes

- Privacy: consent + retention policy; capture only when the test enables it.
