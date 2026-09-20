"""Habits and daily completions."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

FREQUENCY_TYPES = ("daily", "custom_days", "times_per_week")
DIFFICULTIES = ("easy", "medium", "hard")


class Habit(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "habits"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("goals.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    color: Mapped[str | None] = mapped_column(String(24), nullable=True)

    # Frequency: "daily" | "custom_days" (frequency_days = ISO weekdays 1-7)
    #            | "times_per_week" (frequency_target = times per week)
    frequency_type: Mapped[str] = mapped_column(String(24), default="daily", nullable=False)
    frequency_days: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    frequency_target: Mapped[int | None] = mapped_column(Integer, nullable=True)

    target: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(24), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(12), default="medium", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="habits")  # noqa: F821
    goal: Mapped["Goal | None"] = relationship(back_populates="habits")  # noqa: F821
    completions: Mapped[list["HabitCompletion"]] = relationship(
        back_populates="habit", cascade="all, delete-orphan", passive_deletes=True
    )


class HabitCompletion(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "habit_completions"
    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_completion_habit_date"),)

    habit_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("habits.id", ondelete="CASCADE"), index=True, nullable=False
    )
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    habit: Mapped[Habit] = relationship(back_populates="completions")
