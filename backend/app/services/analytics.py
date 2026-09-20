"""Analytics queries: heatmap, consistency, XP timeline, category breakdown."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.time_utils import add_days
from app.models.gamification import XpEvent
from app.models.goal import Goal
from app.models.habit import Habit, HabitCompletion


def _habit_rows(db: Session, user_id: uuid.UUID, since: date):
    """Habits (active or not) plus their completions since ``since``.

    Archived habits still count for historical days: a day they were done in
    was really done, and the frequency rule is evaluated without the active
    flag so archiving today does not rewrite history.
    """
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user_id)).all())
    habits_by_id = {h.id: h for h in habits}
    rows = db.scalars(
        select(HabitCompletion).where(
            HabitCompletion.habit_id.in_(habits_by_id.keys() or {uuid.uuid4()}),
            HabitCompletion.date >= since,
        )
    ).all()
    return habits, habits_by_id, rows


def _scheduled_any(habit: Habit, day: date) -> bool:
    if habit.frequency_type == "custom_days":
        return day.isoweekday() in (habit.frequency_days or [])
    return True  # daily and times_per_week can be done on any day


def _day_counts(habits, habits_by_id, rows, start: date, end: date):
    from app.services.streaks import is_effectively_done

    done_by_habit: dict[uuid.UUID, set[date]] = {}
    for row in rows:
        habit = habits_by_id.get(row.habit_id)
        if habit is not None and is_effectively_done(row, habit):
            done_by_habit.setdefault(row.habit_id, set()).add(row.date)

    counts: dict[date, tuple[int, int]] = {}
    day = start
    while day <= end:
        scheduled = completed = 0
        for habit in habits:
            if _scheduled_any(habit, day):
                scheduled += 1
                if day in done_by_habit.get(habit.id, ()):
                    completed += 1
        counts[day] = (scheduled, completed)
        day = add_days(day, 1)
    return counts


def heatmap(db: Session, user_id: uuid.UUID, today: date, months: int = 12) -> list[dict]:
    start = add_days(today, -min(months * 31, 370) + 1)
    habits, by_id, rows = _habit_rows(db, user_id, start)
    counts = _day_counts(habits, by_id, rows, start, today)
    out = []
    for day, (scheduled, completed) in counts.items():
        if scheduled == 0:
            level = 0
        else:
            rate = completed / scheduled
            level = 5 if completed == scheduled else (1 if rate < 0.25 else 2 if rate < 0.5 else 3 if rate < 0.75 else 4)
        out.append(
            {
                "date": day,
                "level": level,
                "scheduled": scheduled,
                "completed": completed,
            }
        )
    return out


def consistency_series(db: Session, user_id: uuid.UUID, today: date, days: int = 90) -> list[dict]:
    start = add_days(today, -days + 1)
    habits, by_id, rows = _habit_rows(db, user_id, start)
    counts = _day_counts(habits, by_id, rows, start, today)
    return [
        {
            "date": day,
            "scheduled": scheduled,
            "completed": completed,
            "rate": round(completed / scheduled * 100) if scheduled else 0,
        }
        for day, (scheduled, completed) in counts.items()
    ]


def xp_timeline(db: Session, user_id: uuid.UUID, today: date, days: int = 90) -> list[dict]:
    start = add_days(today, -days + 1)
    rows = db.execute(
        select(XpEvent.created_at, XpEvent.amount).where(
            XpEvent.user_id == user_id, func.date(XpEvent.created_at) >= start.isoformat()
        )
    ).all()
    by_day: dict[str, int] = {}
    for created_at, amount in rows:
        key = created_at.date().isoformat()
        by_day[key] = by_day.get(key, 0) + int(amount)
    out = []
    cumulative = 0
    day = start
    while day <= today:
        xp = by_day.get(day.isoformat(), 0)
        cumulative += xp
        out.append({"date": day, "xp": xp, "cumulative": cumulative})
        day = add_days(day, 1)
    # ``cumulative`` here covers only the visible window; add the pre-window base.
    base = (
        db.scalar(
            select(func.coalesce(func.sum(XpEvent.amount), 0)).where(
                XpEvent.user_id == user_id,
                func.date(XpEvent.created_at) < start.isoformat(),
            )
        )
        or 0
    )
    return [
        {**item, "cumulative": item["cumulative"] + int(base)} for item in out
    ]


def category_breakdown(db: Session, user_id: uuid.UUID, today: date) -> list[dict]:
    """Distribution of goals/habits per category + 30d completion stats."""
    from app.services.goals import goal_progress

    start = add_days(today, -29)
    habits, by_id, rows = _habit_rows(db, user_id, start)
    counts = _day_counts(habits, by_id, rows, start, today)
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user_id)).all())
    goal_by_id = {g.id: g for g in goals}

    def habit_category(habit: Habit) -> str:
        goal = goal_by_id.get(habit.goal_id) if habit.goal_id else None
        return goal.category if goal else "other"

    done_by_habit: dict[uuid.UUID, set[date]] = {}
    from app.services.streaks import is_effectively_done

    for row in rows:
        habit = by_id.get(row.habit_id)
        if habit is not None and is_effectively_done(row, habit):
            done_by_habit.setdefault(row.habit_id, set()).add(row.date)

    buckets: dict[str, dict] = {}

    def bucket(category: str) -> dict:
        return buckets.setdefault(
            category,
            {
                "category": category,
                "goals": 0,
                "habits": 0,
                "completions30d": 0,
                "avgGoalProgress": 0,
                "_progress_sum": 0,
                "_progress_n": 0,
            },
        )

    for goal in goals:
        entry = bucket(goal.category)
        entry["goals"] += 1
        entry["_progress_sum"] += goal_progress(goal)
        entry["_progress_n"] += 1

    for habit in habits:
        entry = bucket(habit_category(habit))
        entry["habits"] += 1
        entry["completions30d"] += len(done_by_habit.get(habit.id, ()))

    out = []
    for entry in buckets.values():
        n = entry.pop("_progress_n")
        s = entry.pop("_progress_sum")
        entry["avgGoalProgress"] = round(s / n) if n else 0
        out.append(entry)
    out.sort(key=lambda e: (-e["goals"], -e["habits"], e["category"]))

    total_completed = sum(c for _, c in counts.values())
    total_scheduled = sum(s for s, _ in counts.values())
    out.append(
        {
            "category": "__overall__",
            "goals": len(goals),
            "habits": len(habits),
            "completions30d": total_completed,
            "avgGoalProgress": round(total_completed / total_scheduled * 100)
            if total_scheduled
            else 0,
        }
    )
    return out


def overview(db: Session, user_id: uuid.UUID, today: date) -> dict:
    from app.services.streaks import current_streak, is_effectively_done

    habits = list(db.scalars(select(Habit).where(Habit.user_id == user_id)).all())
    active = [h for h in habits if h.active]

    start = add_days(today, -365)
    rows = db.scalars(
        select(HabitCompletion)
        .join(Habit, Habit.id == HabitCompletion.habit_id)
        .where(Habit.user_id == user_id, HabitCompletion.date >= start)
    ).all()
    done_by_habit: dict[uuid.UUID, dict[date, bool]] = {h.id: {} for h in habits}
    by_id = {h.id: h for h in habits}
    for row in rows:
        habit = by_id.get(row.habit_id)
        if habit is not None:
            done_by_habit[row.habit_id][row.date] = is_effectively_done(row, habit)

    best_streak = 0
    for habit in active:
        best_streak = max(
            best_streak, current_streak(habit, done_by_habit[habit.id], today)
        )

    counts = _day_counts(habits, by_id, rows, add_days(today, -89), today)
    perfect_days = sum(1 for s, c in counts.values() if s > 0 and c == s)

    goals = list(db.scalars(select(Goal).where(Goal.user_id == user_id)).all())
    total_xp = db.scalar(
        select(func.coalesce(func.sum(XpEvent.amount), 0)).where(XpEvent.user_id == user_id)
    )

    return {
        "totalCompletions": sum(
            sum(1 for v in d.values() if v) for d in done_by_habit.values()
        ),
        "activeHabits": len(active),
        "totalHabits": len(habits),
        "activeGoals": sum(1 for g in goals if g.status == "active"),
        "completedGoals": sum(1 for g in goals if g.status == "completed"),
        "bestCurrentStreak": best_streak,
        "perfectDays90d": perfect_days,
        "totalXp": int(total_xp or 0),
    }
