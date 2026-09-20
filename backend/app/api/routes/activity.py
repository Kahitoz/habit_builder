"""Activity timeline with cursor pagination."""

from __future__ import annotations

import base64
import binascii
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models.activity import ActivityEvent
from app.models.user import User
from app.schemas.activity import ActivityOut, ActivityPage

router = APIRouter(prefix="/activity", tags=["activity"])


def _encode_cursor(event: ActivityEvent) -> str:
    raw = f"{event.created_at.isoformat()}|{event.id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_part, id_part = raw.split("|", 1)
        return datetime.fromisoformat(ts_part), uuid.UUID(id_part)
    except (ValueError, binascii.Error, UnicodeDecodeError) as exc:
        raise AppError("VALIDATION_ERROR", "Invalid cursor.", 422) from exc


@router.get("", response_model=ActivityPage)
def list_activity(
    limit: int = Query(default=30, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityPage:
    stmt = select(ActivityEvent).where(ActivityEvent.user_id == user.id)
    if cursor:
        ts, last_id = _decode_cursor(cursor)
        stmt = stmt.where(
            (ActivityEvent.created_at < ts)
            | ((ActivityEvent.created_at == ts) & (ActivityEvent.id < last_id))
        )
    stmt = stmt.order_by(
        ActivityEvent.created_at.desc(), ActivityEvent.id.desc()
    ).limit(limit + 1)

    rows = list(db.scalars(stmt).all())
    has_more = len(rows) > limit
    items = rows[:limit]
    return ActivityPage(
        items=[
            ActivityOut(
                id=e.id,
                type=e.type,
                payload=e.payload,
                habit_id=e.habit_id,
                goal_id=e.goal_id,
                created_at=e.created_at,
            )
            for e in items
        ],
        next_cursor=_encode_cursor(items[-1]) if has_more and items else None,
    )
