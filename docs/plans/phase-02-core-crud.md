# Phase 02 — Core CRUD (Candidates, Questions, Tests)

**Status:** ✅ completed

## Goal

Full management of the three core entities behind the workflow.

## Delivered

- **Models** (async SQLAlchemy 2, UUID PKs, soft-delete via `deleted_at`):
  - `Candidate` (name, email, source external/internal, status, tags[], notes)
    + `user_candidate_assignments` — the link deferred from Phase 01.
  - `Question` (`type`, `prompt`, JSONB `payload`, difficulty, points, tags[],
    `created_by`).
  - `Test` (title, description, duration, pass_mark, status, JSONB settings) +
    `TestQuestion` ordered/weighted membership (unique per test+question).
- **Payload validation** per question type (`app/schemas/question.py`): MCQ /
  multi-select (options + correct keys, single-answer enforced for MCQ), text
  (sample answer + rubric), coding (starter code + test cases + limits).
- **CRUD APIs**, all org-scoped + RBAC-gated, with pagination, search and
  filters:
  - `/api/candidates` (+ `/{id}` + `/{id}/assignees`) — `candidate:read/write`.
  - `/api/questions` (+ `/{id}`) — `question:read/write`.
  - `/api/tests` (+ `/{id}`) — `test:read/write`; list returns light summaries
    with `question_count`, detail returns full ordered questions.
- **Assignment-aware visibility:** users with `user:manage` see all org
  candidates; others see only candidates assigned to them.
- **Migration** `0002_core` for all tables + indexes.
- **Frontend admin screens** (`/admin/candidates`, `/admin/questions`,
  `/admin/tests`) with list tables, search/filter, and create/edit modals —
  including a type-aware question payload editor and a test question picker
  (add / reorder / weight). Shared UI primitives in `components/ui.tsx`; nav
  added to the admin layout.

## Acceptance — verified

- End-to-end against a live stack: created MCQ question, candidate, and a test
  referencing the question; assigned a user; listed/filtered each; updated and
  soft-deleted a candidate (204 → subsequent GET 404).
- Validation enforced: invalid MCQ payload → 422; test with unknown question →
  400.
- Org-scoping confirmed (per-org list totals).
- `ruff` clean; backend tests pass; frontend `next build` type-checks and
  compiles; full-stack smoke: `/login` renders, `/admin` guards to `/login`.

## Notes

- Coding questions are stored but not executed yet — execution lands in
  Phase 06 (Judge0).
