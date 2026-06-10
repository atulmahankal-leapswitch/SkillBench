# Backend image (FastAPI + uv). Multi-stage: dev (reload) and prod.
# Build context is ./backend (see compose.yml).
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# uv: fast Python package/venv manager.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Node + the Claude Code CLI: the claude-agent-sdk provider drives this CLI
# (authenticates via the mounted ~/.claude OAuth or ANTHROPIC_API_KEY).
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm ca-certificates \
    && npm install -g @anthropic-ai/claude-code \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching.
COPY pyproject.toml ./
COPY uv.lock* ./
RUN uv sync --no-install-project --no-dev 2>/dev/null || uv sync --no-install-project || true

# ── Development: source is bind-mounted by compose, run with --reload ────────
FROM base AS dev
ENV ENVIRONMENT=development
# Dev deps included.
RUN uv sync --no-install-project || true
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Production: copy source, no reload ───────────────────────────────────────
FROM base AS prod
ENV ENVIRONMENT=production
COPY . /app
RUN uv sync --no-dev || true
EXPOSE 8000
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
