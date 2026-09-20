"""Life goals and milestones."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

GOAL_STATUSES = ("active", "completed", "paused", "archived")
GOAL_CATEGORIES = ("health", "mind", "career", "finance", "relationships", "creative", "other")


class Goal(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(32), default="other", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active", index=True, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Manual progress override used when a goal has no milestones (0-100).
    manual_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user: Mapped["User"] = relationship(back_populates="goals")  # noqa: F821
    milestones: Mapped[list["Milestone"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="Milestone.sort_order",
        passive_deletes=True,
    )
    habits: Mapped[list["Habit"]] = relationship(  # noqa: F821
        back_populates="goal",
    )

    @property
    def is_active(self) -> bool:
        return self.status == "active"


class Milestone(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "milestones"

    goal_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("goals.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    goal: Mapped[Goal] = relationship(back_populates="milestones")
