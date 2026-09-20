"""Engine + session management.

The engine is created once from ``DATABASE_URL``. SQLite gets the
connection arguments it needs (thread-safety off for FastAPI's threadpool,
StaticPool for in-memory URLs used by tests). PostgreSQL uses psycopg3.

Switching databases is a single environment variable:

    DATABASE_URL=sqlite:///./lifeforge.db
    DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/lifeforge
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def is_sqlite_url(url: str) -> bool:
    return url.startswith("sqlite")


def create_engine_for_url(url: str) -> Engine:
    kwargs: dict = {"pool_pre_ping": True, "future": True}
    if is_sqlite_url(url):
        kwargs["connect_args"] = {"check_same_thread": False}
        # Shared in-memory DB (tests) needs a single reusable connection.
        if ":memory:" in url or url in {"sqlite://", "sqlite:///"}:
            kwargs["poolclass"] = StaticPool
    elif url.startswith("postgresql"):
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 10
    return create_engine(url, **kwargs)


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine_for_url(get_settings().database_url)
    return _engine


def get_sessionmaker() -> sessionmaker[Session]:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    return _SessionLocal


def reset_engine() -> None:
    """Dispose and forget the cached engine (used by tests / reconfiguration)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a transactional session."""
    session = get_sessionmaker()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
