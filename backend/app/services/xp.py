"""XP ledger + level curve.

Level curve from the product spec:

    L1=0, L2=500, L3=1200, L4=2100 ...

which is exactly ``threshold(n) = 100 * (n - 1) * (n + 3)``.
"""

from __future__ import annotations

import math
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.gamification import XpEvent

XP_BY_DIFFICULTY = {"easy": 10, "medium": 20, "hard": 30}
PERFECT_DAY_XP = 50
MILESTONE_XP = 200
GOAL_XP = 1000
# Bonus keyed by the streak length that triggers it (awarded once per habit).
STREAK_BONUSES = {7: 75, 30: 300, 100: 1000}


def xp_for_completion(difficulty: str) -> int:
    return XP_BY_DIFFICULTY.get(difficulty, XP_BY_DIFFICULTY["medium"])


def level_threshold(level: int) -> int:
    """Cumulative XP needed to *reach* ``level`` (>=1)."""
    if level <= 1:
        return 0
    return 100 * (level - 1) * (level + 3)


def level_from_xp(total_xp: int) -> int:
    if total_xp <= 0:
        return 1
    # Invert 100*(n-1)*(n+3) <= x  ->  n^2 + 2n - 3 - x/100 <= 0
    n = -1 + math.sqrt(4 + total_xp / 100.0)
    level = int(math.floor(n + 1e-9))
    return max(1, level)


def level_progress(total_xp: int) -> dict:
    level = level_from_xp(total_xp)
    floor_xp = level_threshold(level)
    ceil_xp = level_threshold(level + 1)
    span = max(ceil_xp - floor_xp, 1)
    current = total_xp - floor_xp
    return {
        "level": level,
        "totalXp": total_xp,
        "levelStartXp": floor_xp,
        "nextLevelXp": ceil_xp,
        "currentLevelXp": current,
        "xpForNextLevel": max(ceil_xp - total_xp, 0),
        "progress": min(round(current / span * 100), 100),
    }


def get_total_xp(db: Session, user_id: uuid.UUID) -> int:
    value = db.scalar(
        select(func.coalesce(func.sum(XpEvent.amount), 0)).where(XpEvent.user_id == user_id)
    )
    return int(value or 0)


def award(
    db: Session,
    user_id: uuid.UUID,
    event_type: str,
    amount: int,
    source_id: str | None = None,
) -> XpEvent:
    event = XpEvent(user_id=user_id, type=event_type, amount=amount, source_id=source_id)
    db.add(event)
    db.flush()
    return event


def award_once(
    db: Session,
    user_id: uuid.UUID,
    event_type: str,
    amount: int,
    source_id: str,
) -> XpEvent | None:
    """Idempotent award — skips when an event for this source already exists."""
    exists = db.scalar(
        select(XpEvent.id).where(
            XpEvent.user_id == user_id,
            XpEvent.type == event_type,
            XpEvent.source_id == source_id,
        )
    )
    if exists is not None:
        return None
    return award(db, user_id, event_type, amount, source_id)


def reverse(db: Session, user_id: uuid.UUID, event_type: str, source_id: str) -> int:
    """Delete awarded events for a source (e.g. unticking a habit). Returns count."""
    rows = db.scalars(
        select(XpEvent).where(
            XpEvent.user_id == user_id,
            XpEvent.type == event_type,
            XpEvent.source_id == source_id,
        )
    ).all()
    for row in rows:
        db.delete(row)
    db.flush()
    return len(rows)
