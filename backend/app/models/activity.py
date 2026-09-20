"""Activity timeline + weekly review notes."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import JSON, Date, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class ActivityEvent(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "activity_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    # Rendering payload: {"habitId": ..., "title": ..., "xp": ..., "streak": ...}
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    habit_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("habits.id", ondelete="CASCADE"), nullable=True
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("goals.id", ondelete="CASCADE"), nullable=True
    )


class WeeklyReview(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "weekly_reviews"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_review_user_week"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    went_well: Mapped[str | None] = mapped_column(Text, nullable=True)
    to_change: Mapped[str | None] = mapped_column(Text, nullable=True)
