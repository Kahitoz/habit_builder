"""Habit CRUD + complete/uncomplete + history."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import AppError, not_found
from app.core.time_utils import add_days, now_in_tz
from app.db.session import get_db
from app.models.goal import Goal
from app.models.habit import Habit, HabitCompletion
from app.models.user import User
from app.schemas.habit import (
    CompleteRequest,
    CompletionOut,
    HabitCreate,
    HabitHistory,
    HabitOut,
    HabitStats,
    HabitUpdate,
)
from app.services import completions as flow
from app.services.activity import add_event
from app.services.scheduling import is_scheduled
from app.services.streaks import current_streak, done_map, is_at_risk, longest_streak

router = APIRouter(prefix="/habits", tags=["habits"])

HISTORY_SCAN_DAYS = 760


def _today_for(user: User) -> date:
    return now_in_tz(user.timezone).date()


def _get_owned_habit(db: Session, user: User, habit_id: uuid.UUID) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id:
        raise not_found("Habit not found.")
    return habit


def _validate_frequency(freq_type: str, freq_days: list[int] | None) -> None:
    if freq_type == "custom_days" and not freq_days:
        raise AppError(
            "VALIDATION_ERROR",
            "custom_days habits need at least one weekday in frequencyDays.",
            422,
        )


def _decorate(
    db: Session, user: User, habits: list[Habit], today: date
) -> list[HabitOut]:
    """Attach streak/done fields using one completion query."""
    if not habits:
        return []
    since = add_days(today, -HISTORY_SCAN_DAYS)
    rows = db.scalars(
        select(HabitCompletion).where(
            HabitCompletion.habit_id.in_([h.id for h in habits]),
            HabitCompletion.date >= since,
        )
    ).all()
    by_habit: dict[uuid.UUID, list[HabitCompletion]] = {h.id: [] for h in habits}
    for row in rows:
        by_habit.setdefault(row.habit_id, []).append(row)

    window_start = add_days(today, -29)
    out: list[HabitOut] = []
    for h in habits:
        done = done_map(h, by_habit.get(h.id, []))
        completions_30d = sum(
            1 for d, ok in done.items() if ok and window_start <= d <= today
        )
        out.append(
            HabitOut(
                id=h.id,
                title=h.title,
                description=h.description,
                icon=h.icon,
                color=h.color,
                goal_id=h.goal_id,
                frequency_type=h.frequency_type,
                frequency_days=h.frequency_days,
                frequency_target=h.frequency_target,
                target=h.target,
                unit=h.unit,
                difficulty=h.difficulty,
                position=h.position,
                active=h.active,
                created_at=h.created_at,
                current_streak=current_streak(h, done, today),
                longest_streak=longest_streak(h, done, today),
                completed_today=done.get(today, False),
                at_risk=is_at_risk(h, done, today),
                completions_30d=completions_30d,
            )
        )
    return out


def _habit_out(db: Session, user: User, habit: Habit) -> HabitOut:
    return _decorate(db, user, [habit], _today_for(user))[0]


def _check_goal(db: Session, user: User, goal_id: uuid.UUID | None) -> None:
    if goal_id is None:
        return
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise AppError("VALIDATION_ERROR", "Goal not found.", 422)


@router.get("", response_model=list[HabitOut])
def list_habits(
    active_only: bool = Query(default=False, alias="activeOnly"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[HabitOut]:
    stmt = select(Habit).where(Habit.user_id == user.id)
    if active_only:
        stmt = stmt.where(Habit.active.is_(True))
    stmt = stmt.order_by(Habit.position.asc(), Habit.created_at.asc())
    habits = list(db.scalars(stmt).all())
    return _decorate(db, user, habits, _today_for(user))


@router.post("", response_model=HabitOut, status_code=201)
def create_habit(
    payload: HabitCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HabitOut:
    _validate_frequency(payload.frequency_type, payload.frequency_days)
    _check_goal(db, user, payload.goal_id)

    max_pos = db.scalar(
        select(func.coalesce(func.max(Habit.position), -1)).where(Habit.user_id == user.id)
    )
    habit = Habit(
        user_id=user.id,
        title=payload.title.strip(),
        description=payload.description,
        icon=payload.icon,
        color=payload.color,
        goal_id=payload.goal_id,
        frequency_type=payload.frequency_type,
        frequency_days=payload.frequency_days,
        frequency_target=payload.frequency_target
        or (3 if payload.frequency_type == "times_per_week" else None),
        target=payload.target,
        unit=payload.unit,
        difficulty=payload.difficulty,
        position=(max_pos or 0) + 1,
    )
    db.add(habit)
    db.flush()
    add_event(
        db, user.id, "habit_created", {"title": habit.title}, habit_id=habit.id,
        goal_id=habit.goal_id,
    )
    return _habit_out(db, user, habit)


@router.get("/{habit_id}", response_model=HabitOut)
def get_habit(
    habit_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HabitOut:
    return _habit_out(db, user, _get_owned_habit(db, user, habit_id))


@router.patch("/{habit_id}", response_model=HabitOut)
def update_habit(
    habit_id: uuid.UUID,
    payload: HabitUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HabitOut:
    habit = _get_owned_habit(db, user, habit_id)
    data = payload.model_dump(exclude_unset=True)

    if "goal_id" in data:
        _check_goal(db, user, data["goal_id"])

    new_freq = data.get("frequency_type", habit.frequency_type)
    new_days = data.get("frequency_days", habit.frequency_days)
    if new_freq == "custom_days" and not (new_days or []):
        raise AppError(
            "VALIDATION_ERROR",
            "custom_days habits need at least one weekday in frequencyDays.",
            422,
        )
    if new_freq == "times_per_week" and not data.get(
        "frequency_target", habit.frequency_target
    ):
        data["frequency_target"] = 3

    for key, value in data.items():
        if key == "title" and isinstance(value, str):
            value = value.strip()
        setattr(habit, key, value)
    db.flush()
    add_event(db, user.id, "habit_updated", {"title": habit.title}, habit_id=habit.id,
              goal_id=habit.goal_id)
    return _habit_out(db, user, habit)


@router.delete("/{habit_id}", status_code=204)
def delete_habit(
    habit_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    habit = _get_owned_habit(db, user, habit_id)
    today = _today_for(user)
    add_event(db, user.id, "habit_deleted", {"title": habit.title})

    # Removing the habit can complete an otherwise-perfect day: capture the
    # affected dates, delete, then re-evaluate.
    affected = {
        day
        for (day,) in db.execute(
            select(HabitCompletion.date).where(HabitCompletion.habit_id == habit.id)
        )
    }
    db.delete(habit)
    db.flush()
    for day in sorted(affected):
        flow.reevaluate_perfect_day(db, user, day)
    flow.reevaluate_perfect_day(db, user, today)


@router.post("/{habit_id}/complete", response_model=HabitOut)
def complete_habit(
    habit_id: uuid.UUID,
    payload: CompleteRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HabitOut:
    habit = _get_owned_habit(db, user, habit_id)
    body = payload or CompleteRequest()
    day = body.date or _today_for(user)
    flow.set_completion(db, user, habit, day, value=body.value, note=body.note)
    return _habit_out(db, user, habit)


@router.delete("/{habit_id}/complete/{day}", response_model=HabitOut)
def uncomplete_habit(
    habit_id: uuid.UUID,
    day: date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HabitOut:
    """Remove the completion for one day (ISO date path param)."""
    habit = _get_owned_habit(db, user, habit_id)
    flow.remove_completion(db, user, habit, day)
    return _habit_out(db, user, habit)


@router.get("/{habit_id}/history", response_model=HabitHistory)
def habit_history(
    habit_id: uuid.UUID,
    days: int = Query(default=90, ge=1, le=730),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HabitHistory:
    habit = _get_owned_habit(db, user, habit_id)
    today = _today_for(user)
    rows = db.scalars(
        select(HabitCompletion)
        .where(
            HabitCompletion.habit_id == habit.id,
            HabitCompletion.date >= add_days(today, -days),
        )
        .order_by(HabitCompletion.date.desc())
    ).all()
    done = done_map(habit, list(rows)) if rows else {}
    # Streak maths need the fuller history, not just the display window.
    all_rows = db.scalars(
        select(HabitCompletion).where(
            HabitCompletion.habit_id == habit.id,
            HabitCompletion.date >= add_days(today, -HISTORY_SCAN_DAYS),
        )
    ).all()
    full_done = done_map(habit, list(all_rows))
    return HabitHistory(
        habit_id=habit.id,
        completions=[
            CompletionOut(
                id=r.id,
                habit_id=r.habit_id,
                date=r.date,
                value=r.value,
                completed=r.completed,
                note=r.note,
            )
            for r in rows
        ],
        current_streak=current_streak(habit, full_done, today),
        longest_streak=longest_streak(habit, full_done, today),
    )


@router.get("/{habit_id}/stats", response_model=HabitStats)
def habit_stats(
    habit_id: uuid.UUID,
    window: int = Query(default=90, ge=7, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HabitStats:
    habit = _get_owned_habit(db, user, habit_id)
    today = _today_for(user)
    rows = db.scalars(
        select(HabitCompletion).where(
            HabitCompletion.habit_id == habit.id,
            HabitCompletion.date >= add_days(today, -HISTORY_SCAN_DAYS),
        )
    ).all()
    full_done = done_map(habit, list(rows))

    scheduled = 0
    completed = 0
    for i in range(window):
        day = add_days(today, -i)
        if is_scheduled(habit, day):
            scheduled += 1
            if full_done.get(day, False):
                completed += 1

    done_days = [d for d, ok in full_done.items() if ok]
    row_by_date = {r.date: r for r in rows}
    total_value = sum(
        row_by_date[d].value for d in done_days if d in row_by_date
    )
    return HabitStats(
        habit_id=habit.id,
        current_streak=current_streak(habit, full_done, today),
        longest_streak=longest_streak(habit, full_done, today),
        total_completions=len(done_days),
        window_days=window,
        scheduled_in_window=scheduled,
        completed_in_window=completed,
        completion_rate=round(completed / scheduled * 100) if scheduled else 0,
        total_value=round(total_value, 2),
        last_completed_date=max(done_days) if done_days else None,
    )
