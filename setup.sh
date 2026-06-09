#!/usr/bin/env bash
# One-command up/deploy for SkillBench.
#
# Usage:
#   ./setup.sh dev          Build + start the development stack (hot reload)
#   ./setup.sh prod         Build + start the production stack (detached)
#   ./setup.sh down         Stop the stack
#   ./setup.sh logs [svc]   Tail logs (optionally one service)
#   ./setup.sh ps           Show running services
set -euo pipefail

cd "$(dirname "$0")"

BASE="-f compose.yml"
DEV="$BASE -f compose.dev.yml"
PROD="$BASE -f compose.prod.yml"

ensure_env() {
  if [[ ! -f .env ]]; then
    echo "→ .env not found; creating from .env.example"
    cp .env.example .env
    echo "  Edit .env to set secrets (Google OAuth, SECRET_KEY, DB password), then re-run."
  fi
}

cmd="${1:-dev}"
case "$cmd" in
  dev)
    ensure_env
    echo "→ Building and starting dev stack…"
    docker compose $DEV up --build
    ;;
  prod)
    ensure_env
    echo "→ Building and starting prod stack (detached)…"
    docker compose $PROD up --build -d
    docker compose $PROD ps
    ;;
  down)
    docker compose $BASE down
    ;;
  logs)
    shift || true
    docker compose $BASE logs -f "${@:-}"
    ;;
  ps)
    docker compose $BASE ps
    ;;
  *)
    echo "Unknown command: $cmd"
    echo "Usage: ./setup.sh [dev|prod|down|logs|ps]"
    exit 1
    ;;
esac
