"""The day view engine: scheduled habits, day state, consistency, momentum.

Day states (product spec §"Dynamic Dashboard"):

    fresh            nothing scheduled / nothing done yet at day start
    on_track         completion rate keeps pace with elapsed day
    ahead            rate above pace
    falling_behind   rate below pace
    at_risk          an existing streak would break if today goes unfinished
    recovery         a rough few days, but today is already in motion
    perfect          everything scheduled today is done
    closed           past date with work left undone
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time_utils import add_days, now_in_tz, time_of_day, week_start_of
from app.models.goal import Goal
from app.models.habit import Habit, HabitCompletion
from app.models.user import User
from app.services.goals import goal_progress, next_milestone
from app.services.momentum import compute_momentum
from app.services.scheduling import is_scheduled
from app.services.streaks import current_streak, is_at_risk, is_effectively_done
from app.services.xp import PERFECT_DAY_XP, get_total_xp, level_progress

HISTORY_WINDOW = 400  # days of completions loaded for streak/consistency math


def _load_done_maps(db: Session, user_id: uuid.UUID, habits: list[Habit], anchor: date):
    """Return {habit_id: {date: done_flag}} for the loaded history window."""
    rows = db.scalars(
        select(HabitCompletion)
        .join(Habit, Habit.id == HabitCompletion.habit_id)
        .where(
            Habit.user_id == user_id,
            HabitCompletion.date >= add_days(anchor, -HISTORY_WINDOW),
            HabitCompletion.date <= anchor,
        )
    ).all()
    done: dict = {h.id: {} for h in habits}
    habits_by_id = {h.id: h for h in habits}
    for row in rows:
        habit = habits_by_id.get(row.habit_id)
        if habit is not None:
            done[row.habit_id][row.date] = is_effectively_done(row, habit)
    return done


def _rate_window(habits: list[Habit], done: dict, start: date, end: date) -> dict:
    scheduled = completed = 0
    for habit in habits:
        day = start
        while day <= end:
            if is_scheduled(habit, day):
                scheduled += 1
                if done[habit.id].get(day, False):
                    completed += 1
            day = add_days(day, 1)
    return {
        "scheduled": scheduled,
        "completed": completed,
        "rate": round(completed / scheduled * 100) if scheduled else 0,
    }


def _day_state(
    *,
    day: date,
    today: date,
    scheduled_count: int,
    completed_count: int,
    at_risk_count: int,
    time_progress: float,
    rough_recent_days: int,
) -> str:
    if day < today:
        return "perfect" if completed_count >= scheduled_count else "closed"
    if day > today:
        return "fresh"
    if scheduled_count == 0:
        return "fresh"
    remaining = scheduled_count - completed_count
    if remaining == 0:
        return "perfect"
    if rough_recent_days >= 2 and completed_count >= 1:
        return "recovery"
    if at_risk_count >= 1:
        return "at_risk"
    rate = completed_count / scheduled_count
    if rate >= time_progress + 0.15:
        return "ahead"
    if rate >= time_progress - 0.15:
        return "on_track"
    return "falling_behind"


def build_day_view(db: Session, user: User, day: date) -> dict:
    """Compose the dashboard payload for one local day (works for today and past)."""
    local_now = now_in_tz(user.timezone)
    real_today = local_now.date()

    habits = list(
        db.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.active.is_(True))
            .order_by(Habit.position, Habit.created_at)
        )
    )
    done = _load_done_maps(db, user.id, habits, max(day, real_today))

    scheduled = [h for h in habits if is_scheduled(h, day)]
    scheduled_ids = {h.id for h in scheduled}

    completed_ids = {h.id for h in scheduled if done[h.id].get(day, False)}
    at_risk_ids: set[uuid.UUID] = set()
    streaks: dict[uuid.UUID, int] = {}
    for habit in habits:
        d = done[habit.id]
        streaks[habit.id] = current_streak(habit, d, day)
        if habit.id in scheduled_ids and is_at_risk(habit, d, day):
            at_risk_ids.add(habit.id)

    if day == real_today:
        elapsed = (local_now.hour * 60 + local_now.minute) / (24 * 60)
    elif day < real_today:
        elapsed = 1.0
    else:
        elapsed = 0.0

    # Recovery detection: of the last 3 finished days, how many had unfinished work.
    rough = 0
    for offset in (1, 2, 3):
        prev = add_days(day, -offset)
        sched_prev = [h for h in habits if is_scheduled(h, prev)]
        if not sched_prev:
            continue
        done_prev = sum(1 for h in sched_prev if done[h.id].get(prev, False))
        if done_prev < len(sched_prev):
            rough += 1

    scheduled_count = len(scheduled)
    completed_count = len(completed_ids)
    remaining = max(scheduled_count - completed_count, 0)

    state = _day_state(
        day=day,
        today=real_today,
        scheduled_count=scheduled_count,
        completed_count=completed_count,
        at_risk_count=len(at_risk_ids),
        time_progress=elapsed,
        rough_recent_days=rough,
    )

    # ---- habit entries (only habits scheduled on this day) ----
    goals_by_id = {
        g.id: g
        for g in db.scalars(select(Goal).where(Goal.user_id == user.id)).all()
    }

    def sort_key(h: Habit):
        group = 0 if h.id in at_risk_ids else 1 if h.id not in completed_ids else 2
        return (group, h.position, h.title.lower())

    habit_entries = []
    for habit in sorted(scheduled, key=sort_key):
        habit_entries.append(
            {
                "id": habit.id,
                "title": habit.title,
                "icon": habit.icon,
                "color": habit.color,
                "goalId": habit.goal_id,
                "goalTitle": goals_by_id[habit.goal_id].title if habit.goal_id in goals_by_id else None,
                "target": habit.target,
                "unit": habit.unit,
                "difficulty": habit.difficulty,
                "frequencyType": habit.frequency_type,
                "done": habit.id in completed_ids,
                "atRisk": habit.id in at_risk_ids,
                "currentStreak": streaks.get(habit.id, 0),
            }
        )

    # ---- goals snapshot ----
    goal_entries = []
    for goal in goals_by_id.values():
        if goal.status != "active":
            continue
        nm = next_milestone(goal)
        goal_entries.append(
            {
                "id": goal.id,
                "title": goal.title,
                "category": goal.category,
                "status": goal.status,
                "progress": goal_progress(goal),
                "targetDate": goal.target_date,
                "nextMilestone": (
                    {"id": nm.id, "title": nm.title, "targetDate": nm.target_date} if nm else None
                ),
                "habitCount": sum(1 for h in habits if h.goal_id == goal.id),
            }
        )
    goal_entries.sort(key=lambda g: -g["progress"])

    momentum = compute_momentum(db, user.id, day)
    total_xp = get_total_xp(db, user.id)

    week_start = week_start_of(day, user.week_start)
    consistency = {
        "today": {
            "scheduled": scheduled_count,
            "completed": completed_count,
            "rate": round(completed_count / scheduled_count * 100) if scheduled_count else 0,
        },
        "week": _rate_window(habits, done, week_start, min(day, max(day, week_start))),
        "month": _rate_window(habits, done, add_days(day, -29), day),
    }

    perfect = {
        "achieved": scheduled_count > 0 and remaining == 0 and day <= real_today,
        "remaining": remaining if day == real_today else (0 if state == "perfect" else remaining),
        "bonus": PERFECT_DAY_XP,
    }

    return {
        "date": day,
        "timeOfDay": time_of_day(local_now.hour) if day == real_today else None,
        "dayState": state,
        "summary": {
            "scheduled": scheduled_count,
            "completed": completed_count,
            "remaining": remaining,
            "completionRate": consistency["today"]["rate"],
            "atRiskCount": len(at_risk_ids),
        },
        "habits": habit_entries,
        "goals": goal_entries,
        "momentum": momentum,
        "level": level_progress(total_xp),
        "consistency": consistency,
        "perfectDay": perfect,
    }
