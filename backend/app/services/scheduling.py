"""Which habits are scheduled on a given day."""

from __future__ import annotations

from datetime import date

from app.models.habit import Habit


def is_scheduled(habit: Habit, day: date) -> bool:
    """Is this habit scheduled on ``day``?

    * daily          -> every day
    * custom_days    -> ISO weekdays listed in ``frequency_days`` (1=Mon..7=Sun)
    * times_per_week -> flexible; any day counts
    """
    if not habit.active:
        return False
    if habit.frequency_type == "daily":
        return True
    if habit.frequency_type == "times_per_week":
        return True
    if habit.frequency_type == "custom_days":
        days = habit.frequency_days or []
        return day.isoweekday() in days
    return False


def scheduled_habits(habits: list[Habit], day: date) -> list[Habit]:
    return [h for h in habits if is_scheduled(h, day)]


def previous_scheduled_day(habit: Habit, day: date) -> date:
    """The most recent scheduled day strictly before ``day`` (bounded search)."""
    from app.core.time_utils import add_days

    candidate = add_days(day, -1)
    for _ in range(30):  # a gap of >30 days means the habit has no schedule
        if is_scheduled(habit, candidate):
            return candidate
        candidate = add_days(candidate, -1)
    return day


def next_scheduled_day(habit: Habit, day: date) -> date | None:
    from app.core.time_utils import add_days

    candidate = add_days(day, 1)
    for _ in range(30):
        if is_scheduled(habit, candidate):
            return candidate
        candidate = add_days(candidate, 1)
    return None
