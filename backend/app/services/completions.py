"""The completion flow: ticking / unticking a habit for a day.

This is the heart of the XP economy. Everything stays consistent by
deriving from the XP ledger:

* ticking a habit        -> award habit XP (idempotent per completion row),
                            streak bonuses (once per threshold per habit),
                            perfect-day bonus (once per date).
* changing value/note    -> same idempotent awards; nothing double-counts.
* unticking a habit      -> reverse that completion's XP event, then
                            re-evaluate the perfect-day bonus for the date.

Streak bonuses are *not* clawed back when a streak later breaks — they are
granted the moment the streak reaches the threshold.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitCompletion
from app.models.user import User
from app.services import xp as xp_service
from app.services.activity import add_event
from app.services.scheduling import is_scheduled
from app.services.streaks import EPSILON, current_streak, done_map
from app.services.xp import PERFECT_DAY_XP, STREAK_BONUSES


def get_completion(db: Session, habit_id: uuid.UUID, day: date) -> HabitCompletion | None:
    return db.scalar(
        select(HabitCompletion).where(
            HabitCompletion.habit_id == habit_id, HabitCompletion.date == day
        )
    )


def habit_done_map(db: Session, habit: Habit, *, limit_days: int = 760) -> dict[date, bool]:
    """Done-flags for a habit's recent history, ready for streak maths."""
    from app.core.time_utils import add_days, utcnow

    since = add_days(utcnow().date(), -limit_days)
    rows = db.scalars(
        select(HabitCompletion).where(
            HabitCompletion.habit_id == habit.id, HabitCompletion.date >= since
        )
    ).all()
    return done_map(habit, list(rows))


def reevaluate_perfect_day(db: Session, user: User, day: date) -> bool:
    """Grant or revoke the perfect-day bonus for ``day``; returns achieved."""
    habits = db.scalars(
        select(Habit).where(Habit.user_id == user.id, Habit.active.is_(True))
    ).all()
    scheduled = [h for h in habits if is_scheduled(h, day)]
    if not scheduled:
        xp_service.reverse(db, user.id, "perfect_day", day.isoformat())
        return False

    rows = db.scalars(
        select(HabitCompletion).where(
            HabitCompletion.habit_id.in_([h.id for h in scheduled]),
            HabitCompletion.date == day,
        )
    ).all()
    by_habit = {r.habit_id: r for r in rows}
    from app.services.streaks import is_effectively_done

    achieved = all(is_effectively_done(by_habit.get(h.id), h) for h in scheduled)
    source = day.isoformat()
    if achieved:
        created = xp_service.award_once(
            db, user.id, "perfect_day", PERFECT_DAY_XP, source
        )
        if created is not None:
            add_event(db, user.id, "perfect_day", {"date": source, "xp": PERFECT_DAY_XP})
    else:
        xp_service.reverse(db, user.id, "perfect_day", source)
    return achieved


def set_completion(
    db: Session,
    user: User,
    habit: Habit,
    day: date,
    *,
    value: float | None = None,
    note: str | None = None,
) -> HabitCompletion:
    """Tick (or restat) a habit for ``day`` and settle all XP consequences."""
    row = get_completion(db, habit.id, day)
    was_done = row is not None and (row.completed or row.value >= habit.target - EPSILON)

    new_value = habit.target if value is None else value
    now_done = new_value >= habit.target - EPSILON

    if row is None:
        row = HabitCompletion(
            habit_id=habit.id, date=day, value=new_value, completed=now_done, note=note
        )
        db.add(row)
    else:
        row.value = new_value
        row.completed = now_done
        if note is not None:
            row.note = note
    db.flush()

    if now_done:
        xp_service.award_once(
            db,
            user.id,
            "habit_completion",
            xp_service.xp_for_completion(habit.difficulty),
            str(row.id),
        )
        if not was_done:
            add_event(
                db,
                user.id,
                "habit_completed",
                {"habitTitle": habit.title, "date": day.isoformat(), "value": new_value},
                habit_id=habit.id,
                goal_id=habit.goal_id,
            )
        # Streak bonuses — idempotent per (habit, threshold).
        done = habit_done_map(db, habit)
        streak = current_streak(habit, done, day)
        for threshold, bonus in STREAK_BONUSES.items():
            if streak >= threshold:
                earned = xp_service.award_once(
                    db, user.id, "streak_bonus", bonus, f"{habit.id}:{threshold}"
                )
                if earned is not None:
                    add_event(
                        db,
                        user.id,
                        "streak_bonus",
                        {
                            "habitTitle": habit.title,
                            "streak": threshold,
                            "xp": bonus,
                        },
                        habit_id=habit.id,
                        goal_id=habit.goal_id,
                    )
    else:
        # Value dropped below target: treat as unticked for XP purposes.
        xp_service.reverse(db, user.id, "habit_completion", str(row.id))

    reevaluate_perfect_day(db, user, day)
    return row


def remove_completion(db: Session, user: User, habit: Habit, day: date) -> bool:
    """Untick a habit for ``day``. Returns True if a row existed."""
    row = get_completion(db, habit.id, day)
    if row is None:
        reevaluate_perfect_day(db, user, day)
        return False

    add_event(
        db,
        user.id,
        "habit_uncompleted",
        {"habitTitle": habit.title, "date": day.isoformat()},
        habit_id=habit.id,
        goal_id=habit.goal_id,
    )
    xp_service.reverse(db, user.id, "habit_completion", str(row.id))
    db.delete(row)
    db.flush()
    reevaluate_perfect_day(db, user, day)
    return True
