"""Streak computation.

Streaks are *derived* from completion rows — no stored state to go stale.
A streak counts consecutive **scheduled** days that were completed; days a
habit is not scheduled at all neither extend nor break a streak.

``current_streak`` may end today (habit already done) or yesterday (habit
still doable today). The latter is the "at risk" case surfaced by the UI.
"""

from __future__ import annotations

from datetime import date

from app.core.time_utils import add_days
from app.models.habit import Habit, HabitCompletion
from app.services.scheduling import is_scheduled, previous_scheduled_day

EPSILON = 1e-9


def is_effectively_done(row: HabitCompletion | None, habit: Habit) -> bool:
    """A completion row counts when flagged completed or when value reaches target."""
    if row is None:
        return False
    return bool(row.completed or row.value >= habit.target - EPSILON)


def completions_by_date(completions: list[HabitCompletion]) -> dict[date, HabitCompletion]:
    return {c.date: c for c in completions}


def done_map(habit: Habit, completions: list[HabitCompletion]) -> dict[date, bool]:
    return {d: is_effectively_done(row, habit) for d, row in completions_by_date(completions).items()}


def current_streak(habit: Habit, done: dict[date, bool], today: date) -> int:
    """Consecutive completed scheduled days ending today or the last scheduled day."""
    if habit.frequency_type == "custom_days" and not (habit.frequency_days or []):
        return 0

    day = today
    if not (is_scheduled(habit, day) and done.get(day, False)):
        # Either not scheduled/done today: anchor on the previous scheduled day.
        day = previous_scheduled_day(habit, day)

    streak = 0
    for _ in range(2000):  # hard guard against pathological histories
        if not is_scheduled(habit, day) or not done.get(day, False):
            break
        streak += 1
        prev = previous_scheduled_day(habit, day)
        if prev == day:
            break
        day = prev
    return streak


def longest_streak(habit: Habit, done: dict[date, bool], today: date) -> int:
    """Longest run of completed scheduled days in the stored history (≤ 2 years)."""
    completed_days = [d for d, ok in done.items() if ok]
    if not completed_days:
        return 0
    start = max(min(completed_days), add_days(today, -730))
    best = 0
    run = 0
    day = start
    guard = 0
    while day <= today and guard < 800:
        guard += 1
        if is_scheduled(habit, day):
            if done.get(day, False):
                run += 1
                best = max(best, run)
            else:
                run = 0
        day = add_days(day, 1)
    return best


def is_at_risk(habit: Habit, done: dict[date, bool], today: date) -> bool:
    """Scheduled today, not done yet, and an existing streak would break tonight."""
    if not is_scheduled(habit, today):
        return False
    if done.get(today, False):
        return False
    return current_streak(habit, done, today) > 0
