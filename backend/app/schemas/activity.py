"""Activity timeline + weekly review schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from app.schemas.common import CamelModel


class ActivityOut(CamelModel):
    id: uuid.UUID
    type: str
    payload: dict
    habit_id: uuid.UUID | None
    goal_id: uuid.UUID | None
    created_at: datetime


class ActivityPage(CamelModel):
    items: list[ActivityOut]
    next_cursor: str | None = None


class ReviewOut(CamelModel):
    id: uuid.UUID
    week_start: date
    went_well: str | None
    to_change: str | None
    created_at: datetime
    updated_at: datetime


class ReviewUpsert(CamelModel):
    week_start: date
    went_well: str | None = None
    to_change: str | None = None


class ReviewStats(CamelModel):
    scheduled: int = 0
    completed: int = 0
    rate: int = 0
    xp: int = 0
    perfect_days: int = 0


class ReviewWithStats(CamelModel):
    """GET /reviews/weekly result: stored notes plus computed week stats."""

    id: uuid.UUID | None = None
    week_start: date
    went_well: str | None = None
    to_change: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    stats: ReviewStats = ReviewStats()
