"""Goal + milestone schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import Field, field_validator

from app.models.goal import GOAL_CATEGORIES, GOAL_STATUSES
from app.schemas.common import CamelModel


class MilestoneCreate(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    target_date: date | None = None
    sort_order: int | None = None


class MilestoneUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    target_date: date | None = None
    completed: bool | None = None
    sort_order: int | None = None


class MilestoneOut(CamelModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    title: str
    target_date: date | None
    completed: bool
    completed_at: datetime | None
    sort_order: int


class GoalCreate(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    category: str = "other"
    target_date: date | None = None
    milestones: list[MilestoneCreate] | None = Field(default=None, max_length=50)

    @field_validator("category")
    @classmethod
    def _valid_category(cls, v: str) -> str:
        if v not in GOAL_CATEGORIES:
            raise ValueError(f"category must be one of {', '.join(GOAL_CATEGORIES)}")
        return v


class GoalUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    category: str | None = None
    status: str | None = None
    target_date: date | None = None
    manual_progress: int | None = Field(default=None, ge=0, le=100)

    @field_validator("category")
    @classmethod
    def _valid_category(cls, v: str | None) -> str | None:
        if v is not None and v not in GOAL_CATEGORIES:
            raise ValueError(f"category must be one of {', '.join(GOAL_CATEGORIES)}")
        return v

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str | None) -> str | None:
        if v is not None and v not in GOAL_STATUSES:
            raise ValueError(f"status must be one of {', '.join(GOAL_STATUSES)}")
        return v


class GoalOut(CamelModel):
    id: uuid.UUID
    title: str
    description: str | None
    category: str
    status: str
    target_date: date | None
    manual_progress: int
    created_at: datetime
    updated_at: datetime
    progress: int = 0
    milestones: list[MilestoneOut] = []
    habit_count: int = 0


class GoalSummaryMilestone(CamelModel):
    """Slim milestone pointer embedded in dashboard goal cards."""

    id: uuid.UUID
    title: str
    target_date: date | None


class GoalSummary(CamelModel):
    """Compact goal card used by the dashboard."""

    id: uuid.UUID
    title: str
    category: str
    status: str
    progress: int
    target_date: date | None
    next_milestone: GoalSummaryMilestone | None = None
    habit_count: int = 0
