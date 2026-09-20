"""XP ledger — the single source of truth for all progression points.

Every award is a row; un-doing an action removes its row (e.g. unticking a
habit deletes the XP event that ticking created). ``level`` is therefore
always derived, never stored.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin

XP_EVENT_TYPES = (
    "habit_completion",
    "perfect_day",
    "streak_bonus",
    "milestone_completed",
    "goal_completed",
)


class XpEvent(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "xp_events"
    __table_args__ = (Index("ix_xp_events_user_type_source", "user_id", "type", "source_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    # Stable reference: completion id, ISO date, "<habit_id>:<milestone_days>", ...
    source_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
