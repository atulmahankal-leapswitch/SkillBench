"""Top-level API router. Feature routers are mounted here as phases land."""

from fastapi import APIRouter

from app.api.routes import auth, candidates, health, questions, tests

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(candidates.router)
api_router.include_router(questions.router)
api_router.include_router(tests.router)
