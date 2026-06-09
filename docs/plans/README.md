# Plan Status Board

Authoritative list of build phases and their status. One phase is built at a
time; each is committed to GitHub when complete.

**Legend:** ✅ completed · 🚧 working · ⬜ pending

| #  | Phase                              | Status | Plan                                            |
| -- | ---------------------------------- | ------ | ----------------------------------------------- |
| 00 | Foundation & scaffolding           | ✅     | [plan](phase-00-foundation.md)                  |
| 01 | Auth & RBAC (Google OAuth, roles)  | ✅     | [plan](phase-01-auth-rbac.md)                   |
| 02 | Core CRUD (Candidates/Questions/Tests) | ✅ | [plan](phase-02-core-crud.md)                   |
| 03 | Scheduling & invitations           | ✅     | [plan](phase-03-scheduling-invites.md)          |
| 04 | Candidate exam-taking              | ⬜     | [plan](phase-04-exam-taking.md)                 |
| 05 | Grading & results                  | ⬜     | [plan](phase-05-grading-results.md)             |
| 06 | Code execution (Judge0)            | ⬜     | [plan](phase-06-code-execution.md)              |
| 07 | Proctoring                         | ⬜     | [plan](phase-07-proctoring.md)                  |
| 08 | AI-assisted features               | ⬜     | [plan](phase-08-ai-features.md)                 |
| 09 | Integrations (API + webhooks)      | ⬜     | [plan](phase-09-integrations.md)                |
| 10 | Benchmarking & analytics           | ⬜     | [plan](phase-10-analytics.md)                   |
| 11 | Anti-plagiarism / cheat detection  | ⬜     | [plan](phase-11-anti-plagiarism.md)             |
| 12 | Candidate experience (mobile/brand)| ⬜     | [plan](phase-12-candidate-experience.md)        |

## How to work a phase

1. `/compact` before starting (per global CLAUDE.md).
2. Read the phase plan; set its row to 🚧 here.
3. Build, test, update docs.
4. Set the row to ✅ and commit the phase to GitHub.

## Current state

- **Phase 00** complete: repo skeleton, Docker Compose stack (Postgres, Redis,
  FastAPI backend, Next.js frontend, Caddy), health endpoints, landing page,
  full docs/plan structure.
- **Phase 01** complete: Google OAuth (org-domain restricted) admin sign-in,
  JWT cookie sessions, RBAC (13 permissions, 4 system roles), org/user
  provisioning, Alembic + seeded migration, guarded `/admin` frontend.
  Verified end-to-end against a live stack.
- **Phase 02** complete: Candidate / Question / Test CRUD (org-scoped, RBAC-
  gated, paginated/searchable), per-type question payload validation, ordered
  test↔question membership, user↔candidate assignment + assignment-aware
  visibility, migration `0002`, and admin CRUD screens for all three. Verified
  end-to-end (live API flow + frontend build + stack smoke).
- **Phase 03** complete: schedules + tokened invitations, email send/resend/
  revoke, public invite-validation endpoint, admin schedules UI. Verified live.
- **Next:** Phase 04 — Candidate exam-taking.
