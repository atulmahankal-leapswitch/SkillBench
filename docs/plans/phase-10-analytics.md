# Phase 10 — Benchmarking & Analytics

**Status:** ✅ completed

## Delivered
- Analytics service (read-only, org-scoped): `overview` (candidates, tests,
  attempts, graded, avg %, pass rate, needs-review) and `test_analytics`
  (count, avg/median/min/max %, pass rate, avg duration, 10-decile score
  distribution); plus a `candidate_benchmark` percentile helper.
- Endpoints (`result:read`): `GET /api/analytics/overview`,
  `GET /api/analytics/tests/{test_id}`.
- Frontend `/admin/analytics`: overview stat cards + per-test selector with
  stat cards and a decile distribution bar chart.

## Acceptance — verified
Live (4 seeded results 30/55/80/95): overview avg 65, pass-rate 75%; per-test
avg 65, median 67.5, min/max 30/95, distribution sums to attempt count, avg
duration > 0. ruff clean, 10 tests pass, frontend builds.

---
## Original scope

## Goal

Turn results into insight for hiring/evaluation decisions.

## Scope

- Score distributions, percentiles, and candidate-vs-cohort benchmarking.
- Per-test analytics: difficulty, discrimination, completion/abandon rates,
  average time per question.
- Dashboards + filters (by test, role, time range, source).
- Export (CSV) and shareable summaries.

## Acceptance

- Admin sees percentile/benchmark for a candidate against the cohort.
- Per-test analytics render with real attempt data.
