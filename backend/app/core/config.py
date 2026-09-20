"""Application settings.

Everything is environment-driven (12-factor). The single most important
knob is ``DATABASE_URL``: the same code runs against SQLite (default) or
PostgreSQL with no other changes.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "LifeForge API"
    debug: bool = False

    # Database: sqlite:///./lifeforge.db  |  postgresql+psycopg://user:pass@host/db
    database_url: str = "sqlite:///./lifeforge.db"

    # Auth
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Dev convenience: create tables on startup instead of running Alembic.
    auto_create: bool = True


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
