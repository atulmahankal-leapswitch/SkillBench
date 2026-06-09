"""Top-level API router. Feature routers are mounted here as phases land."""

from fastapi import APIRouter

from app.api.routes import (
    auth,
    candidates,
    exam,
    health,
    questions,
    results,
    schedules,
    tests,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(candidates.router)
api_router.include_router(questions.router)
api_router.include_router(tests.router)
api_router.include_router(schedules.router)
api_router.include_router(schedules.public_router)
api_router.include_router(exam.router)
api_router.include_router(results.router)
