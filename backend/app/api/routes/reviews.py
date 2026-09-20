"""Weekly review: notes + computed stats for any week."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.core.time_utils import add_days, now_in_tz, week_start_of
from app.db.session import get_db
from app.models.activity import WeeklyReview
from app.models.gamification import XpEvent
from app.models.user import User
from app.schemas.activity import ReviewUpsert, ReviewStats, ReviewWithStats
from app.services import analytics
from app.services.activity import add_event

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _week_bounds(anchor: date, week_start_day: int) -> tuple[date, date]:
    start = week_start_of(anchor, week_start_day)
    return start, add_days(start, 6)


def _find_review(db: Session, user_id, week_start: date) -> WeeklyReview | None:
    return db.scalar(
        select(WeeklyReview).where(
            WeeklyReview.user_id == user_id,
            WeeklyReview.week_start == week_start,
        )
    )


def _build_stats(db: Session, user: User, start: date, end: date) -> ReviewStats:
    series = analytics.consistency_series(db, user.id, end, days=7)
    scheduled = sum(p["scheduled"] for p in series)
    completed = sum(p["completed"] for p in series)
    rate = round(completed / scheduled * 100) if scheduled else 0

    xp = int(
        db.scalar(
            select(func.coalesce(func.sum(XpEvent.amount), 0)).where(
                XpEvent.user_id == user.id,
                func.date(XpEvent.created_at) >= start,
                func.date(XpEvent.created_at) <= end,
            )
        )
        or 0
    )
    perfect_days = int(
        db.scalar(
            select(func.count(XpEvent.id)).where(
                XpEvent.user_id == user.id,
                XpEvent.type == "perfect_day",
                func.date(XpEvent.created_at) >= start,
                func.date(XpEvent.created_at) <= end,
            )
        )
        or 0
    )
    return ReviewStats(
        scheduled=scheduled, completed=completed, rate=rate, xp=xp,
        perfect_days=perfect_days,
    )


@router.get("/weekly", response_model=ReviewWithStats)
def get_weekly_review(
    week_start: date | None = Query(default=None, alias="weekStart"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewWithStats:
    today = now_in_tz(user.timezone).date()
    start, end = _week_bounds(week_start or today, user.week_start)
    review = _find_review(db, user.id, start)
    stats = _build_stats(db, user, start, end)
    return ReviewWithStats(
        id=review.id if review else None,
        week_start=start,
        went_well=review.went_well if review else None,
        to_change=review.to_change if review else None,
        created_at=review.created_at if review else None,
        updated_at=review.updated_at if review else None,
        stats=stats,
    )


@router.put("/weekly", response_model=ReviewWithStats)
def upsert_weekly_review(
    payload: ReviewUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewWithStats:
    start, end = _week_bounds(payload.week_start, user.week_start)
    if start > now_in_tz(user.timezone).date():
        raise AppError("VALIDATION_ERROR", "Cannot review a future week.", 422)

    review = _find_review(db, user.id, start)
    if review is None:
        review = WeeklyReview(
            user_id=user.id,
            week_start=start,
            went_well=payload.went_well,
            to_change=payload.to_change,
        )
        db.add(review)
        db.flush()
        add_event(db, user.id, "review_created", {"weekStart": start.isoformat()})
    else:
        review.went_well = payload.went_well
        review.to_change = payload.to_change
        db.flush()
        add_event(db, user.id, "review_updated", {"weekStart": start.isoformat()})

    stats = _build_stats(db, user, start, end)
    return ReviewWithStats(
        id=review.id,
        week_start=review.week_start,
        went_well=review.went_well,
        to_change=review.to_change,
        created_at=review.created_at,
        updated_at=review.updated_at,
        stats=stats,
    )
