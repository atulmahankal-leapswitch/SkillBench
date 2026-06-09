# Phase 07 — Proctoring

**Status:** ⬜ pending

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
