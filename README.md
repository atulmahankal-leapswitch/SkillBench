# SkillBench

An assessment platform for hiring (external candidates) and internal evaluation
(promotions, skill checks) — in the spirit of TestGorilla, Testlify, HackerRank,
Codility, Equip, Harver, Vervoe, and Moodle, but lightweight and
minimal-configuration.

## What it does

- Simple admin & candidate UIs with minimal configuration
- Invite candidates and schedule tests for a fixed window
- Question / Test / Candidate management (CRUD)
- Candidate takes the exam during the scheduled period; results are recorded
- Programming questions executed in a sandbox (Judge0, self-hosted)
- Proctoring (webcam monitoring, tab-switch alerts)
- AI-assisted features (question generation, scoring, plagiarism signals) behind
  a pluggable multi-provider interface (Claude API, Claude Code SDK, others)
- Integrations: API access + webhooks
- Benchmarking & analytics
- Anti-plagiarism / cheat detection
- Candidate experience: mobile-friendly, brandable

## Core workflow

1. **Candidate CRUD** — manage the people being assessed
2. **Questions CRUD** — build a question bank (MCQ, text, coding, …)
3. **Tests CRUD** — assemble questions into tests
4. **Schedule** — assign a test to a candidate for a time window
5. **Take exam** — candidate completes the test during the window
6. **Results** — automatic + AI-assisted grading, dashboards, exports

## Access & roles

- **Google OAuth** for the admin area, restricted to the organisation's email
  domain.
- **Roles** with candidate assignment (who can see/manage which candidates).

## Repository layout

```
/
├── frontend/        Next.js (App Router) — recruiter & candidate UI
├── backend/         FastAPI (Python 3.12, uv) — API, AI services, workers
├── docker/          Dockerfiles, Caddyfile, postgres init
├── docs/            documentation (see docs/README.md for the index)
│   ├── architecture/
│   ├── features/
│   └── plans/       phase plans; docs/plans/README.md tracks status
├── references/      reference screenshots + notification samples (read-only)
├── compose.yml      base Compose (+ compose.dev.yml / compose.prod.yml)
├── .env.example     all configuration
├── setup.sh         one-command up/deploy
├── README.md
└── CLAUDE.md
```

## Tech stack

| Layer       | Choice                                                       |
| ----------- | ------------------------------------------------------------ |
| Frontend    | Next.js (App Router), TypeScript                             |
| Backend     | FastAPI, Python 3.12, managed with `uv`                      |
| Database    | PostgreSQL                                                   |
| Cache/queue | Redis (workers, rate limiting, Judge0)                       |
| Code runner | Judge0 (self-hosted)                                         |
| Proxy       | Caddy (automatic HTTPS in prod)                              |
| AI          | Multi-provider (Claude API / Claude Code SDK / pluggable)    |
| Orchestration | Docker Compose (base + dev/prod overrides)                 |

## Quick start

```bash
cp .env.example .env        # then edit secrets
./setup.sh dev              # bring up the dev stack
```

- Frontend: http://localhost:3000
- Backend API + docs: http://localhost:8000/docs
- Postgres: localhost:5433 (host port, configurable)

See [`docs/README.md`](docs/README.md) for architecture, features, and the
phase-by-phase build plan.

## Status

**All 13 phases (00–12) complete** — foundation, Google-OAuth + RBAC, core CRUD,
scheduling/invitations, candidate exam-taking, grading/results, Judge0 code
execution, proctoring, multi-provider AI, API + webhooks, analytics,
anti-plagiarism, and white-label branding. Each phase was verified against a
live stack. Progress detail is in
[`docs/plans/README.md`](docs/plans/README.md).

To run real Google sign-in / AI / code execution, fill the matching keys in
`.env` (`GOOGLE_*`, `ANTHROPIC_API_KEY`/`AI_PROVIDER`, `JUDGE0_ENABLED` +
`compose.judge0.yml`).
