"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup/shutdown hooks land here as phases need them
    # (warm caches, AI provider init, etc.).
    yield


app = FastAPI(
    title="SkillBench API",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "name": "SkillBench API",
        "version": __version__,
        "environment": settings.environment,
        "docs": "/docs",
    }
