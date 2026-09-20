"""Activity timeline writer."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.activity import ActivityEvent


def add_event(
    db: Session,
    user_id: uuid.UUID,
    event_type: str,
    payload: dict | None = None,
    habit_id: uuid.UUID | None = None,
    goal_id: uuid.UUID | None = None,
) -> ActivityEvent:
    event = ActivityEvent(
        user_id=user_id,
        type=event_type,
        payload=payload or {},
        habit_id=habit_id,
        goal_id=goal_id,
    )
    db.add(event)
    db.flush()
    return event
