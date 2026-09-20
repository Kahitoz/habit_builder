"""Goal CRUD, milestone management and completion."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import not_found
from app.core.time_utils import utcnow
from app.db.session import get_db
from app.models.goal import Goal, Milestone
from app.models.habit import Habit
from app.models.user import User
from app.schemas.goal import (
    GoalCreate,
    GoalOut,
    GoalUpdate,
    MilestoneCreate,
    MilestoneOut,
)
from app.services import goals as goal_service
from app.services import xp as xp_service
from app.services.activity import add_event
from app.services.xp import GOAL_XP

router = APIRouter(prefix="/goals", tags=["goals"])


def _get_owned_goal(db: Session, user: User, goal_id: uuid.UUID) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise not_found("Goal not found.")
    return goal


def _milestone_out(m: Milestone) -> MilestoneOut:
    return MilestoneOut.model_validate(m)


def _goal_out(db: Session, user: User, goal: Goal) -> GoalOut:
    habit_count = db.scalar(
        select(func.count(Habit.id)).where(
            Habit.goal_id == goal.id, Habit.active.is_(True)
        )
    )
    return GoalOut(
        id=goal.id,
        title=goal.title,
        description=goal.description,
        category=goal.category,
        status=goal.status,
        target_date=goal.target_date,
        manual_progress=goal.manual_progress,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        progress=goal_service.goal_progress(goal),
        milestones=[_milestone_out(m) for m in goal_service.sorted_milestones(goal)],
        habit_count=int(habit_count or 0),
    )


@router.get("", response_model=list[GoalOut])
def list_goals(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GoalOut]:
    stmt = select(Goal).where(Goal.user_id == user.id)
    if status:
        stmt = stmt.where(Goal.status == status)
    stmt = stmt.order_by(Goal.created_at.desc())
    return [_goal_out(db, user, g) for g in db.scalars(stmt).all()]


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(
    payload: GoalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = Goal(
        user_id=user.id,
        title=payload.title.strip(),
        description=payload.description,
        category=payload.category,
        target_date=payload.target_date,
    )
    for i, m in enumerate(payload.milestones or []):
        goal.milestones.append(
            Milestone(
                title=m.title.strip(),
                target_date=m.target_date,
                sort_order=m.sort_order if m.sort_order is not None else i,
            )
        )
    db.add(goal)
    db.flush()
    add_event(db, user.id, "goal_created", {"title": goal.title}, goal_id=goal.id)
    return _goal_out(db, user, goal)


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    return _goal_out(db, user, _get_owned_goal(db, user, goal_id))


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _get_owned_goal(db, user, goal_id)
    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] != goal.status:
        _set_status(db, user, goal, data["status"])
        data.pop("status")

    for key, value in data.items():
        if key == "title" and isinstance(value, str):
            value = value.strip()
        setattr(goal, key, value)
    db.flush()
    return _goal_out(db, user, goal)


def _set_status(db: Session, user: User, goal: Goal, new_status: str) -> None:
    """Move a goal between statuses and settle completion XP."""
    if new_status == "completed" and goal.status != "completed":
        goal.completed_at = utcnow()
        xp_service.award_once(db, user.id, "goal_completed", GOAL_XP, str(goal.id))
        add_event(db, user.id, "goal_completed", {"title": goal.title}, goal_id=goal.id)
    elif new_status != "completed" and goal.status == "completed":
        goal.completed_at = None
        xp_service.reverse(db, user.id, "goal_completed", str(goal.id))
    goal.status = new_status


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    goal = _get_owned_goal(db, user, goal_id)
    add_event(db, user.id, "goal_deleted", {"title": goal.title})
    if goal.status == "completed":
        xp_service.reverse(db, user.id, "goal_completed", str(goal.id))
    for m in goal.milestones:
        if m.completed:
            xp_service.reverse(db, user.id, "milestone_completed", str(m.id))
    db.delete(goal)
    db.flush()


# --- Milestones -----------------------------------------------------------
# Nested creation per spec; PATCH/DELETE/complete live on /milestones.


@router.post("/{goal_id}/milestones", response_model=MilestoneOut, status_code=201)
def add_milestone(
    goal_id: uuid.UUID,
    payload: MilestoneCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MilestoneOut:
    goal = _get_owned_goal(db, user, goal_id)
    max_order = max((m.sort_order for m in goal.milestones), default=-1)
    m = Milestone(
        goal_id=goal.id,
        title=payload.title.strip(),
        target_date=payload.target_date,
        sort_order=payload.sort_order if payload.sort_order is not None else max_order + 1,
    )
    db.add(m)
    db.flush()
    add_event(
        db, user.id, "milestone_created",
        {"title": m.title, "goalTitle": goal.title}, goal_id=goal.id,
    )
    return _milestone_out(m)


@router.post("/{goal_id}/complete", response_model=GoalOut)
def complete_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    goal = _get_owned_goal(db, user, goal_id)
    if goal.status != "completed":
        _set_status(db, user, goal, "completed")
        db.flush()
    return _goal_out(db, user, goal)
