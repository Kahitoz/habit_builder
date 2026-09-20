"""LifeForge API application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings, load_vault_settings
from app.core.errors import register_exception_handlers
from app.db.base import Base
from app.db.session import get_engine
from app.db.uuid_migration import normalize_user_ids_to_uuid
import app.models  # noqa: F401  (registers every model on Base.metadata)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_vault_settings()
    if settings.auto_create:
        engine = get_engine()
        with engine.begin() as connection:
            normalize_user_ids_to_uuid(connection)
        Base.metadata.create_all(engine)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
