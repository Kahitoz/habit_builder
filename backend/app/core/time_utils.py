"""Time helpers.

All datetimes are stored as *naive UTC* so that both SQLite (which stores
what you give it) and PostgreSQL (TIMESTAMP WITHOUT TIME ZONE) behave
identically. Convert to the user's timezone only at the edge, in the
dashboard service.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc


def utcnow() -> datetime:
    """Naive UTC now — the canonical storage form."""
    return datetime.now(UTC).replace(tzinfo=None)


def now_in_tz(tz_name: str | None) -> datetime:
    """Current time in the given IANA timezone (falls back to UTC)."""
    tz = get_tz(tz_name)
    return datetime.now(tz).replace(tzinfo=None)


def get_tz(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or "UTC")
    except Exception:
        # Unknown / invalid zone names degrade to UTC instead of crashing.
        return ZoneInfo("UTC")


def add_days(d: date, n: int) -> date:
    return d + timedelta(days=n)


def week_start_of(d: date, week_start: int = 1) -> date:
    """Monday of the week containing ``d`` (ISO), or Sunday when week_start=7."""
    iso = d.isoweekday()  # Mon=1 .. Sun=7
    delta = (iso - week_start) % 7
    return d - timedelta(days=delta)


def date_range(start: date, end: date) -> list[date]:
    days: list[date] = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days


def time_of_day(hour: int) -> str:
    """Coarse time bucket used by the time-aware dashboard."""
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 18:
        return "midday"
    if 18 <= hour < 22:
        return "evening"
    return "night"
