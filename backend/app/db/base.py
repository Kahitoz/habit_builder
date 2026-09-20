"""Declarative base + shared column conventions.

Portability rules (SQLite <-> PostgreSQL, enforced by these conventions):

* UUID primary/foreign keys use ``sqlalchemy.Uuid`` — rendered as native
  ``UUID`` on PostgreSQL and ``CHAR(32)`` on SQLite.
* Enum-like columns are plain ``String`` validated by Pydantic — never
  PostgreSQL-native ENUM types.
* Flexible data uses ``JSON`` (supported by both) — never ``JSONB``.
* Datetimes are naive UTC (see ``app.core.time_utils``) and defaults are
  applied Python-side, so no dialect-specific ``server_default`` SQL.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.time_utils import utcnow


class Base(DeclarativeBase):
    pass


class UUIDPkMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
