"""Analytics response schemas."""

from __future__ import annotations

from datetime import date

from app.schemas.common import CamelModel


class HeatmapCell(CamelModel):
    date: date
    level: int  # 0 none .. 4 partial .. 5 perfect day
    scheduled: int
    completed: int


class ConsistencyPoint(CamelModel):
    date: date
    scheduled: int
    completed: int
    rate: int


class XpPoint(CamelModel):
    date: date
    xp: int
    cumulative: int


class CategoryStat(CamelModel):
    category: str
    goals: int
    habits: int
    completions_30d: int
    avg_goal_progress: int


class Overview(CamelModel):
    total_completions: int
    active_habits: int
    total_habits: int
    active_goals: int
    completed_goals: int
    best_current_streak: int
    perfect_days_90d: int
    total_xp: int
