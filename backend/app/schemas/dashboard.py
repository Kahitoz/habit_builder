"""Dashboard payload schemas (mirrors services/dashboard.build_day_view)."""

from __future__ import annotations

import uuid
from datetime import date

from app.schemas.common import CamelModel
from app.schemas.goal import GoalSummary


class DayHabit(CamelModel):
    id: uuid.UUID
    title: str
    icon: str | None
    color: str | None
    goal_id: uuid.UUID | None
    goal_title: str | None
    target: float
    unit: str | None
    difficulty: str
    frequency_type: str
    done: bool
    at_risk: bool
    current_streak: int


class DaySummary(CamelModel):
    scheduled: int
    completed: int
    remaining: int
    completion_rate: int
    at_risk_count: int


class MomentumFactors(CamelModel):
    consistency7d: int
    best_streak: int
    goal_progress: int


class Momentum(CamelModel):
    score: int
    trend: str
    change: int
    factors: MomentumFactors


class LevelInfo(CamelModel):
    level: int
    total_xp: int
    level_start_xp: int
    next_level_xp: int
    current_level_xp: int
    xp_for_next_level: int
    progress: int


class WindowStats(CamelModel):
    scheduled: int
    completed: int
    rate: int


class Consistency(CamelModel):
    today: WindowStats
    week: WindowStats
    month: WindowStats


class PerfectDay(CamelModel):
    achieved: bool
    remaining: int
    bonus: int


class TodayResponse(CamelModel):
    date: date
    time_of_day: str | None
    day_state: str
    summary: DaySummary
    habits: list[DayHabit]
    goals: list[GoalSummary]
    momentum: Momentum
    level: LevelInfo
    consistency: Consistency
    perfect_day: PerfectDay
