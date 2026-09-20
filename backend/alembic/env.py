"""Alembic environment.

Reads the database URL from the app settings (same ``DATABASE_URL`` the API
uses), so ``uv run alembic upgrade head`` migrates whichever backend
(SQLite or PostgreSQL) is currently configured.

``render_as_batch=True`` wraps ALTERs in batch mode so schema changes work
on SQLite, which cannot alter columns natively.
"""

from __future__ import annotations

import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Engine

import app.models  # noqa: F401  -- registers every table on Base.metadata
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import create_engine_for_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

target_metadata = Base.metadata


def _database_url() -> str:
    # Allow `alembic -x url=postgresql+psycopg://...` overrides for CI.
    x_args = context.get_x_argument(as_dictionary=True)
    return x_args.get("url") or get_settings().database_url


def _configure(connection, **extra) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # SQLite cannot ALTER; batch mode rebuilds tables
        compare_type=True,
        compare_server_default=True,
        **extra,
    )


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine: Engine = create_engine_for_url(_database_url())
    try:
        with engine.connect() as connection:
            if connection.dialect.name == "sqlite":
                logger.info("Migrating SQLite database (%s)", _database_url())
            _configure(connection)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
