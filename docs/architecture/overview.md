# Architecture Overview

SkillBench is a two-tier web application behind a single reverse proxy.

```
                         ┌─────────────┐
        browser  ───────▶│    Caddy    │  (TLS, routing)
                         └──────┬──────┘
                    /api, /docs │ everything else
                  ┌─────────────┴─────────────┐
                  ▼                            ▼
          ┌───────────────┐            ┌───────────────┐
          │   Backend     │            │   Frontend    │
          │   FastAPI     │            │   Next.js     │
          └───┬───────┬───┘            └───────────────┘
              │       │
        ┌─────▼──┐ ┌──▼─────┐        ┌──────────────────┐
        │Postgres│ │ Redis  │        │ Judge0 (later)   │
        └────────┘ └────────┘        │ AI providers     │
                                     └──────────────────┘
```

## Components

| Component   | Responsibility                                                       |
| ----------- | -------------------------------------------------------------------- |
| **Frontend** | Recruiter/admin console and candidate exam UI (Next.js App Router). |
| **Backend**  | REST API, auth, business logic, AI orchestration, background jobs.  |
| **Postgres** | System of record for all entities.                                  |
| **Redis**    | Sessions/cache, background-job queue, rate limiting; Judge0 backing.|
| **Judge0**   | Sandboxed execution of candidate code (added in its phase).         |
| **Caddy**    | Single public entrypoint; automatic HTTPS in production.            |

## Request flow (core workflow)

1. Admin signs in via **Google OAuth** (org-domain restricted) → backend issues
   a session/JWT.
2. Admin manages **Candidates**, **Questions**, and **Tests** via the API.
3. Admin **schedules** a test to a candidate for a time window; an invitation
   (tokened link) is emailed.
4. Candidate opens the link during the window and **takes the exam**.
   Proctoring signals (tab switches, webcam) are captured client-side and
   reported to the backend.
5. On submission, answers are **graded** (auto for MCQ/coding, AI-assisted for
   free text) and surfaced in **results / analytics**.

## Backend layering

```
app/
  main.py            app assembly, middleware, lifespan
  core/              config, database, security primitives
  api/               routers (versioned under /api)
    routes/          one module per resource
  models/            SQLAlchemy ORM models
  schemas/           Pydantic request/response models
  services/          business logic (added per phase): ai/, grading/, …
  workers/           background jobs (added per phase)
```

Routers stay thin: validate → call a service → return a schema. Business logic
lives in `services/`.
