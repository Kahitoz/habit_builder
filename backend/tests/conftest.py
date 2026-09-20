"""Shared pytest fixtures.

Every test runs against a fresh in-memory SQLite database: a per-test
engine (StaticPool so the ``:memory:`` database is shared by all sessions
of one test) with the schema created via ``Base.metadata.create_all``,
injected through the ``get_db`` dependency override. No Postgres or
running server is required.

Run with:  uv run pytest
"""

from __future__ import annotations

import os

# Settings are read from the environment when the app package is first
# imported, so these must be in place before any ``app.*`` import below.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("AUTO_CREATE", "false")
os.environ.setdefault("JWT_SECRET", "test-secret-key-long-enough-for-hs256!")

import uuid  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: F401,E402  (registers all tables on Base.metadata)
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402

DEFAULT_PASSWORD = "supers..."


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture()
def app(session_factory):
    application = create_app()

    def override_get_db():
        session = session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    application.dependency_overrides[get_db] = override_get_db
    return application


@pytest.fixture()
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def register(client: TestClient, email: str | None = None,
             password: str = DEFAULT_PASSWORD, **extra):
    """Register a throwaway account; return (authPayload, authHeaders)."""
    email = email or f"user-{uuid.uuid4().hex[:10]}@example.com"
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password,
              "displayName": "Tester", **extra},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    headers = {"Authorization": f"Bearer {data['accessToken']}"}
    return data, headers


@pytest.fixture()
def user(client):
    data, headers = register(client)
    return {
        "data": data,
        "headers": headers,
        "email": data["user"]["email"],
        "password": DEFAULT_PASSWORD,
        "refresh": data["refreshToken"],
    }


def make_habit(client, headers, /, **overrides):
    body = {"title": "Test habit", "frequencyType": "daily",
            "difficulty": "medium", **overrides}
    response = client.post("/habits", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def total_xp(client, headers) -> int:
    response = client.get("/analytics/overview", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["totalXp"]


def today_str(client, headers) -> str:
    """The server's notion of today in the user's timezone (ISO)."""
    response = client.get("/dashboard/today", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["date"]
