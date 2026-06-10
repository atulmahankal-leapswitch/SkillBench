"""Top-level API router. Feature routers are mounted here as phases land."""

from fastapi import APIRouter

from app.api.routes import (
    ai,
    analytics,
    apply,
    auth,
    branding,
    candidates,
    categories,
    exam,
    health,
    integrations,
    public_api,
    questions,
    results,
    schedules,
    settings,
    tests,
    users,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(candidates.router)
api_router.include_router(apply.router)
api_router.include_router(categories.router)
api_router.include_router(questions.router)
api_router.include_router(tests.router)
api_router.include_router(schedules.router)
api_router.include_router(schedules.public_router)
api_router.include_router(exam.router)
api_router.include_router(results.router)
api_router.include_router(ai.router)
api_router.include_router(integrations.router)
api_router.include_router(public_api.router)
api_router.include_router(analytics.router)
api_router.include_router(branding.router)
api_router.include_router(users.router)
api_router.include_router(settings.router)
