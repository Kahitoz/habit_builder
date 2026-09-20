"""Dashboard routes: today + any specific date."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.time_utils import now_in_tz
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import TodayResponse
from app.services.dashboard import build_day_view

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/today", response_model=TodayResponse)
def get_today(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    today = now_in_tz(user.timezone).date()
    return build_day_view(db, user, today)


@router.get("/{day}", response_model=TodayResponse)
def get_day(
    day: date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Historical (or future) day view. Time-of-day is only meaningful for today."""
    payload = build_day_view(db, user, day)
    today = now_in_tz(user.timezone).date()
    if day != today:
        payload["timeOfDay"] = None
    return payload
