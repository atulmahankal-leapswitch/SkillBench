# CLAUDE.md — SkillBench

Project-specific guidance for Claude Code. Read this together with the global
`~/.claude/CLAUDE.md`.

## What this is

SkillBench is an assessment platform (hiring + internal evaluation). See
`README.md` for the feature list and `docs/README.md` for the full
documentation index.

## Stack & conventions

- **Backend:** FastAPI, Python 3.12, dependency + venv management via `uv`.
  Lives in `backend/`. App package is `app/`.
- **Frontend:** Next.js App Router + TypeScript. Lives in `frontend/`.
- **DB:** PostgreSQL, accessed async (SQLAlchemy 2.x + asyncpg). Migrations via
  Alembic.
- **Runtime:** Docker Compose. `name: skillbench`. Host ports come from `.env`
  with safe defaults so the stack never collides with other local projects.
- **Proxy:** Caddy.
- **Code execution:** Judge0 (self-hosted) — added in its own phase.
- **AI:** a provider-agnostic interface; providers include the Anthropic Claude
  API and the Claude Code SDK (Agent SDK), plus room for others. Added in its
  own phase.

## Hard rules (this machine)

- **No local package managers when Docker is used.** Run `uv`, `npm`, `pip`,
  etc. inside the relevant container: `docker compose exec backend uv ...`,
  `docker compose exec frontend npm ...`.
- **No PHP** here — irrelevant to this project, listed only for completeness.
- Ports are never hardcoded in compose files — always `${VAR:-default}`.

## Build process

Work proceeds in phases (see `docs/plans/`). Each phase:

1. `/compact` before starting (per global CLAUDE.md).
2. Implement against the phase plan in `docs/plans/phase-NN-*.md`.
3. Update `docs/plans/README.md` status (pending → working → completed).
4. Commit the phase to the `SkillBench` GitHub repo.

## Git

- Remote: `https://github.com/atulmahankal-leapswitch/SkillBench.git`
- No Claude attribution / co-author footer in commits (per global rules).
- One commit per phase (or per logical unit within a phase), with a clear
  `phase NN: …` subject.

## Docs

- `docs/README.md` is the index.
- `docs/architecture/` — system design, data model, decisions.
- `docs/features/` — per-feature specs.
- `docs/plans/` — phase plans; `docs/plans/README.md` is the live status board.

## Formatting

- 2-space indent for JS/TS, JSON, YAML.
- 4-space indent for Python (PEP 8); format with `ruff`.
- LF endings, UTF-8, final newline.

## Code quality (DRY + best practices)

Strictly follow **DRY** — never duplicate data, logic, or structure; extract
into a shared helper, base, or component.

- **Single source of truth.** Catalogs/enums/config live in one place and are
  imported (e.g. `app/core/rbac.py` seeds the DB *and* drives runtime; question
  payload validation is defined once and reused on create/update).
- **Backend layering.** Routes stay thin (validate → call a service → return a
  schema); business logic lives in `app/services/`; reuse shared helpers
  (`paginate()`, the org-scoped `_base_query` pattern, `recompute_aggregate`).
  When a third entity repeats a pattern, factor a generic base before adding it.
- **Frontend.** Reuse `components/ui.tsx` primitives and the shared API client
  (`lib/client.ts`); don't re-style tables/modals per page. Extract a shared
  list-page/table component when the pattern recurs.
- **Org scoping + RBAC always.** Every data query is filtered by
  `organization_id`; every admin route is gated by `require_permission(...)`.
- **Never leak answers.** Candidate-facing responses must use the sanitized
  public schemas (no correct keys / hidden test outputs).
- **Migrations.** Schema changes ship as a numbered Alembic migration; model
  column types must match the migration (esp. `DateTime(timezone=True)`).
- **Quality gate per phase.** `ruff` clean, tests pass, frontend `next build`
  succeeds, and the feature is verified against a live stack before commit.
