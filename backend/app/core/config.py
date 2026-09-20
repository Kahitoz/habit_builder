"""Application settings.

Everything is environment-driven (12-factor). The single most important
knob is ``DATABASE_URL``: the same code runs against SQLite (default) or
PostgreSQL with no other changes.
"""

from __future__ import annotations

import os
import subprocess

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


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


def _vault_field(path: str, field: str, environment: dict[str, str]) -> str:
    """Read one Vault KV field without exposing it in logs or exceptions."""
    try:
        result = subprocess.run(
            ["vault", "kv", "get", f"-field={field}", path],
            env=environment,
            check=True,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("Vault CLI is required when Vault credentials are configured.") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Timed out reading Vault field {field!r} from {path!r}.") from exc
    except subprocess.CalledProcessError as exc:
        # Do not include stderr: it may contain sensitive operational context.
        raise RuntimeError(f"Unable to read Vault field {field!r} from {path!r}.") from exc

    value = result.stdout.strip()
    if not value:
        raise RuntimeError(f"Vault field {field!r} from {path!r} is empty.")
    return value


def load_vault_settings() -> Settings:
    """Load database credentials once at startup when Vault access is configured."""
    vault_addr = os.environ.get("VAULT_ADDR", "").strip()
    vault_token = os.environ.get("VAULT_TOKEN", "").strip()
    if not vault_addr and not vault_token:
        return get_settings()
    if not vault_addr or not vault_token:
        raise RuntimeError("Both VAULT_ADDR and VAULT_TOKEN are required.")

    environment = os.environ.copy()
    environment["VAULT_ADDR"] = vault_addr
    environment["VAULT_TOKEN"] = vault_token
    path = "secret/home-infra/postgres"
    postgres = {
        field: _vault_field(path, field, environment)
        for field in ("host", "port", "database", "username", "password", "sslmode")
    }
    try:
        port = int(postgres["port"])
    except ValueError as exc:
        raise RuntimeError("Vault PostgreSQL port must be a valid integer.") from exc

    url = URL.create(
        "postgresql+psycopg",
        username=postgres["username"],
        password=postgres["password"],
        host=postgres["host"],
        port=port,
        database=postgres["database"],
        query={"sslmode": postgres["sslmode"]},
    ).render_as_string(hide_password=False)
    os.environ["DATABASE_URL"] = url

    # Settings may have been initialized while FastAPI assembled the app.
    # Clear the cached object after setting DATABASE_URL so all runtime users
    # (including the database engine) see the Vault-backed configuration.
    global _settings
    _settings = None
    return get_settings()
