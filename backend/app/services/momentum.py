"""Momentum score (0-100).

Blend of three signals over the trailing 7 days:

    momentum = 50% * completion rate (7d)
             + 30% * best active streak (capped at 30 days)
             + 20% * average progress across active goals

``change`` compares against the same formula computed on the *previous*
7-day window so the UI can show a trend arrow.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time_utils import add_days
from app.models.goal import Goal
from app.models.habit import Habit, HabitCompletion
from app.services.goals import goal_progress
from app.services.streaks import completions_by_date, current_streak, is_effectively_done
from app.services.scheduling import is_scheduled

RANGE = 7


def _rate_over(habits: list[Habit], done: dict, start: date, end: date) -> float:
    scheduled = 0
    completed = 0
    for habit in habits:
        day = start
        while day <= end:
            if is_scheduled(habit, day):
                scheduled += 1
                row = done[habit.id].get(day)
                if row is not None and is_effectively_done(row, habit):
                    completed += 1
            day = add_days(day, 1)
    if scheduled == 0:
        return 0.0
    return completed / scheduled


def compute_momentum(db: Session, user_id: uuid.UUID, today: date) -> dict:
    habits = list(
        db.scalars(select(Habit).where(Habit.user_id == user_id, Habit.active.is_(True)))
    )
    habits_by_id = {h.id: h for h in habits}
    rows = db.scalars(
        select(HabitCompletion).join(Habit, Habit.id == HabitCompletion.habit_id).where(
            Habit.user_id == user_id,
            HabitCompletion.date >= add_days(today, -(RANGE * 2)),
            HabitCompletion.date <= today,
        )
    ).all()
    done: dict = {h.id: {} for h in habits}
    for row in rows:
        if row.habit_id in done:
            done[row.habit_id][row.date] = row

    rate = _rate_over(habits, done, add_days(today, -(RANGE - 1)), today)
    prev_rate = _rate_over(habits, done, add_days(today, -(RANGE * 2 - 1)), add_days(today, -RANGE))

    best_streak = 0
    for habit in habits:
        d = {day: is_effectively_done(row, habit) for day, row in done[habit.id].items()}
        best_streak = max(best_streak, current_streak(habit, d, today))
    streak_factor = min(best_streak / 30.0, 1.0)

    active_goals = db.scalars(
        select(Goal).where(Goal.user_id == user_id, Goal.status == "active")
    ).all()
    goal_factor = (
        sum(goal_progress(g) for g in active_goals) / len(active_goals) / 100.0
        if active_goals
        else 0.0
    )

    score = round(100 * (0.5 * rate + 0.3 * streak_factor + 0.2 * goal_factor))
    prev_score = round(100 * (0.5 * prev_rate + 0.3 * streak_factor + 0.2 * goal_factor))
    change = score - prev_score
    trend = "rising" if change >= 3 else "falling" if change <= -3 else "steady"

    return {
        "score": max(0, min(100, score)),
        "trend": trend,
        "change": change,
        "factors": {
            "consistency7d": round(rate * 100),
            "bestStreak": best_streak,
            "goalProgress": round(goal_factor * 100),
        },
    }
