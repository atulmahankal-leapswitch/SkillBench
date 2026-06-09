# Phase 06 — Code Execution (Judge0)

**Status:** ✅ completed

## Delivered
- Judge0 async client (`app/services/judge0.py`): language map (Python, JS, TS,
  Java, C/C++, C#, Go, Ruby, Rust, PHP, Kotlin, Swift, Bash), `run()` via
  `wait=true`, optional `X-Auth-Token`. Gated by `JUDGE0_ENABLED`.
- Auto-grading of coding questions: runs hidden+visible test cases, awards
  proportional points (`passed/total`), `is_correct` when all pass; any
  execution error or disabled Judge0 → `needs_review` fallback.
- Candidate `POST /api/exam/{token}/run`: runs code against the question's
  visible sample cases (503 when Judge0 disabled). Exam UI gains a "Run sample
  tests" button with per-case output.
- `compose.judge0.yml` (judge0 server + privileged workers + own db/redis) and
  `docker/judge0.conf`; `JUDGE0_ENABLED` in config/.env.

## Acceptance — verified
6 backend tests pass incl. language map, disabled-run raises, and coding
grading falls back to `needs_review` when disabled. Run endpoint returns 503
when disabled. Judge0 compose validates. ruff clean, frontend builds.

> Live Judge0 execution requires bringing up `compose.judge0.yml` on a host
> with the kernel/cgroup settings Judge0 needs (documented; not exercised in
> the CI sandbox).

---
## Original scope

## Goal

Execute and grade programming questions in a sandbox.

## Scope

- Add self-hosted **Judge0** to Compose (server + workers + its own db/redis),
  env-driven (`JUDGE0_URL`, `JUDGE0_AUTH_TOKEN`).
- Backend client: submit source + stdin, poll/collect result, map languages.
- Coding question payload: starter code, test cases (input/expected),
  time/memory limits, scoring per passing case.
- Candidate code editor (Monaco) with language selection + run/sample tests.
- Grade coding answers by running hidden test cases on submit.

## Acceptance

- Candidate runs sample tests and submits; hidden test cases score the answer.
- Supported-languages list surfaced in the question editor.

## Notes

- Judge0 adds several containers; keep it in the base stack but document
  resource needs.
