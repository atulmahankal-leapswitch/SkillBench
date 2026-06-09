# Phase 05 — Grading & Results

**Status:** ✅ completed

## Delivered
- Auto-grading on submit/auto-expiry: objective questions (mcq exact-key,
  multi_select exact-set) scored against weighted points; text/coding flagged
  `needs_review`. `Result` (aggregate: total/max/percent/passed/needs_review) +
  `QuestionResult` (per-question awarded/max/is_correct/feedback). Migration 0005.
- Admin results API (`result:read/write`): list (org-scoped, filter by test/
  passed), detail (per-question with candidate response + correct answer),
  manual override (recomputes aggregate + pass/fail), CSV export.
- Frontend `/admin/results`: list with pass/fail/needs-review, detail modal with
  per-question override inputs, CSV export button.

## Acceptance — verified
Live: submit auto-grades (mcq 2/2 correct, text 0/3 needs-review, aggregate 40%
not-passed); override text→3 recomputes to 100% passed, needs_review cleared;
over-max override 400; CSV export 200 with header. ruff clean, tests pass,
frontend builds.

---
## Original scope

## Goal

Score attempts and present results to admins.

## Scope

- Auto-grading for objective types (MCQ/multi-select) with per-question weights.
- `Result` records: per-question score + aggregate, pass/fail vs. test pass mark.
- Manual override UI for subjective answers (AI-assisted grading in Phase 08).
- Results dashboard: per-candidate report, per-test summary, CSV export.

## Acceptance

- Submitting an attempt produces a scored result.
- Admin can view, override, and export results.
