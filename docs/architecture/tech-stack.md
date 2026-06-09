# Tech Stack & Decisions

## Choices

| Layer        | Choice                          | Why                                                   |
| ------------ | ------------------------------- | ----------------------------------------------------- |
| Frontend     | Next.js (App Router) + TS       | SSR/streaming, file routing, strong ecosystem.        |
| Backend      | FastAPI + Python 3.12 (`uv`)    | Async, typed, OpenAPI out of the box; AI libs in py.  |
| ORM / DB     | SQLAlchemy 2 async + Postgres   | Mature, async, JSONB for flexible question payloads.  |
| Migrations   | Alembic                         | Standard for SQLAlchemy.                              |
| Cache/queue  | Redis                           | Sessions, rate limits, job queue, Judge0 backing.     |
| Code runner  | Judge0 (self-hosted)            | 60+ languages, sandboxed, full control over infra.    |
| AI           | Multi-provider interface        | Avoid lock-in; see decision below.                    |
| Proxy        | Caddy                           | Automatic HTTPS, tiny config.                         |
| Orchestration| Docker Compose (+ overrides)    | One-command up; dev/prod parity.                      |

## Decisions (ADR-style)

### D1 — Code execution: Judge0, self-hosted
Self-hosted Judge0 gives sandboxing and broad language support without
per-execution SaaS cost or sending candidate code to a third party. It is added
in its own phase (extra services: judge0 server + workers + its own db/redis).

### D2 — AI: provider-agnostic interface
AI features (question generation, free-text scoring, plagiarism signals) sit
behind an `AIProvider` interface so the concrete backend is swappable via the
`AI_PROVIDER` env var. Planned providers:

- **`anthropic`** — Anthropic Claude API (default; model via `AI_MODEL`).
- **`claude_code_sdk`** — Claude Code SDK / Agent SDK, for agentic flows
  (multi-step generation, tool use) rather than single completions.
- **`openai`** and others — pluggable.

This keeps the rest of the app independent of any one vendor and lets us pick
the right tool (single-shot completion vs. agentic SDK) per feature.

### D3 — Auth: Google OAuth, org-domain restricted
The admin area is gated by Google OAuth and limited to configured email domains
(`ALLOWED_ADMIN_EMAIL_DOMAINS`). Candidates do **not** use Google sign-in — they
enter via tokened invitation links, so external candidates need no account.

### D4 — Ports from env
All host ports are `${VAR:-default}` so multiple projects coexist on one host.

## Local development

- Package managers run **inside containers** (no local `uv`/`npm` on this host).
- `compose.dev.yml` bind-mounts source and enables hot reload for both tiers.
- `./setup.sh dev` builds and starts everything.
