"""Analytics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.time_utils import now_in_tz
from app.db.session import get_db
from app.models.user import User
from app.services import analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _today(user: User):
    return now_in_tz(user.timezone).date()


@router.get("/overview")
def get_overview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return analytics.overview(db, user.id, _today(user))


@router.get("/consistency")
def get_consistency(
    days: int = Query(default=90, ge=7, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return analytics.consistency_series(db, user.id, _today(user), days)


@router.get("/xp")
def get_xp_timeline(
    days: int = Query(default=90, ge=7, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return analytics.xp_timeline(db, user.id, _today(user), days)


@router.get("/categories")
def get_categories(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return analytics.category_breakdown(db, user.id, _today(user))


@router.get("/heatmap")
def get_heatmap(
    months: int = Query(default=12, ge=1, le=24),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return analytics.heatmap(db, user.id, _today(user), months)
