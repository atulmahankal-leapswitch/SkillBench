# Phase 00 — Foundation & Scaffolding

**Status:** ✅ completed

## Goal

Stand up a runnable, well-structured skeleton for the whole project so every
later phase has a clear home and a working dev loop.

## Delivered

- Repository layout per spec: `frontend/`, `backend/`, `docker/`, `docs/`,
  `references/`, root config files.
- **Docker Compose stack** (`name: skillbench`) with env-driven host ports:
  - `db` — Postgres 16 (+ `pgcrypto`, `citext` via `docker/postgres/init.sql`)
  - `redis` — Redis 7
  - `backend` — FastAPI (uv), multi-stage Dockerfile (dev/prod)
  - `frontend` — Next.js App Router, multi-stage Dockerfile (dev/prod)
  - `caddy` — reverse proxy (routes `/api`, `/docs` to backend; rest to frontend)
  - `compose.dev.yml` (hot reload, bind mounts) / `compose.prod.yml` (built
    images, no public app ports).
- **Backend skeleton**: `app/main.py` (CORS, lifespan, router mount), `core/`
  (settings via pydantic-settings, async SQLAlchemy engine/session/Base),
  `api/` with `/api/health` + `/api/health/ready`, empty `models/` & `schemas/`
  packages, a smoke test.
- **Frontend skeleton**: App Router layout + landing page showing the core
  workflow, global styles, TS config, standalone output.
- **Config**: `.env.example` covering every setting (DB, Redis, OAuth, AI
  providers, Judge0, SMTP, ports).
- **Tooling**: `setup.sh` (dev/prod/down/logs/ps), root `.gitignore`.
- **Docs**: index, architecture (overview, tech stack/decisions, data model),
  features matrix, this plan board, and per-phase plan stubs.
- **Project `CLAUDE.md`** with stack, rules, and the phase workflow.

## Acceptance

- `./setup.sh dev` builds and starts the stack.
- `GET /api/health` → `{"status":"ok"}`; frontend landing page renders.
- Repo initialized and Phase 00 committed/pushed to GitHub.

## Notes / deferred

- Judge0 services are documented but added in Phase 06 (heavy: extra server +
  workers + own db/redis).
- Alembic is a dependency now; migration env wiring lands with the first models
  in Phase 01/02.
