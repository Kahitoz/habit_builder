"""Milestone routes at the top level, per spec: PATCH/DELETE/complete."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import not_found
from app.core.time_utils import utcnow
from app.db.session import get_db
from app.models.goal import Goal, Milestone
from app.models.user import User
from app.schemas.goal import MilestoneOut, MilestoneUpdate
from app.services import xp as xp_service
from app.services.activity import add_event
from app.services.xp import MILESTONE_XP

router = APIRouter(prefix="/milestones", tags=["milestones"])


def _get_owned_milestone(
    db: Session, user: User, milestone_id: uuid.UUID
) -> tuple[Goal, Milestone]:
    m = db.get(Milestone, milestone_id)
    if m is not None:
        goal = db.get(Goal, m.goal_id)
        if goal is not None and goal.user_id == user.id:
            return goal, m
    raise not_found("Milestone not found.")


def _set_completed(db: Session, user: User, goal: Goal, m: Milestone, completed: bool) -> None:
    """Toggle completion and settle milestone XP idempotently."""
    if completed == m.completed:
        return
    if completed:
        m.completed_at = utcnow()
        xp_service.award_once(db, user.id, "milestone_completed", MILESTONE_XP, str(m.id))
        add_event(
            db, user.id, "milestone_completed",
            {"title": m.title, "goalTitle": goal.title, "xp": MILESTONE_XP},
            goal_id=goal.id,
        )
    else:
        m.completed_at = None
        xp_service.reverse(db, user.id, "milestone_completed", str(m.id))
    m.completed = completed


@router.patch("/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MilestoneOut:
    goal, m = _get_owned_milestone(db, user, milestone_id)
    data = payload.model_dump(exclude_unset=True)

    if "completed" in data:
        _set_completed(db, user, goal, m, bool(data.pop("completed")))

    for key, value in data.items():
        if key == "title" and isinstance(value, str):
            value = value.strip()
        setattr(m, key, value)
    db.flush()
    return MilestoneOut.model_validate(m)


@router.post("/{milestone_id}/complete", response_model=MilestoneOut)
def complete_milestone(
    milestone_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MilestoneOut:
    goal, m = _get_owned_milestone(db, user, milestone_id)
    _set_completed(db, user, goal, m, True)
    db.flush()
    return MilestoneOut.model_validate(m)


@router.delete("/{milestone_id}", status_code=204)
def delete_milestone(
    milestone_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _goal, m = _get_owned_milestone(db, user, milestone_id)
    if m.completed:
        xp_service.reverse(db, user.id, "milestone_completed", str(m.id))
    db.delete(m)
    db.flush()
