"""Habit schemas."""

# NOTE: `date` is imported under an alias: CompleteRequest has a field named
# `date`, and an annotated assignment evaluates the annotation *after*
# binding the value, so a class attribute `date = None` would shadow
# datetime.date in the annotation expression.

import uuid
from datetime import date as DateType, datetime

from pydantic import Field, field_validator

from app.models.habit import DIFFICULTIES, FREQUENCY_TYPES
from app.schemas.common import CamelModel


class HabitCreate(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    icon: str | None = Field(default=None, max_length=64)
    color: str | None = Field(default=None, max_length=24)
    goal_id: uuid.UUID | None = None
    frequency_type: str = "daily"
    frequency_days: list[int] | None = Field(default=None, max_length=7)
    frequency_target: int | None = Field(default=None, ge=1, le=7)
    target: float = Field(default=1.0, gt=0, le=10000)
    unit: str | None = Field(default=None, max_length=24)
    difficulty: str = "medium"

    @field_validator("frequency_type")
    @classmethod
    def _valid_freq(cls, v: str) -> str:
        if v not in FREQUENCY_TYPES:
            raise ValueError(f"frequencyType must be one of {', '.join(FREQUENCY_TYPES)}")
        return v

    @field_validator("frequency_days")
    @classmethod
    def _valid_days(cls, v: list[int] | None) -> list[int] | None:
        if v is not None and any(d < 1 or d > 7 for d in v):
            raise ValueError("frequencyDays must contain ISO weekdays 1-7")
        return sorted(v) if v else v

    @field_validator("difficulty")
    @classmethod
    def _valid_difficulty(cls, v: str) -> str:
        if v not in DIFFICULTIES:
            raise ValueError(f"difficulty must be one of {', '.join(DIFFICULTIES)}")
        return v


class HabitUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    icon: str | None = Field(default=None, max_length=64)
    color: str | None = Field(default=None, max_length=24)
    goal_id: uuid.UUID | None = None
    frequency_type: str | None = None
    frequency_days: list[int] | None = Field(default=None, max_length=7)
    frequency_target: int | None = Field(default=None, ge=1, le=7)
    target: float | None = Field(default=None, gt=0, le=10000)
    unit: str | None = Field(default=None, max_length=24)
    difficulty: str | None = None
    active: bool | None = None
    position: int | None = None

    @field_validator("frequency_type")
    @classmethod
    def _valid_freq(cls, v: str | None) -> str | None:
        if v is not None and v not in FREQUENCY_TYPES:
            raise ValueError(f"frequencyType must be one of {', '.join(FREQUENCY_TYPES)}")
        return v

    @field_validator("difficulty")
    @classmethod
    def _valid_difficulty(cls, v: str | None) -> str | None:
        if v is not None and v not in DIFFICULTIES:
            raise ValueError(f"difficulty must be one of {', '.join(DIFFICULTIES)}")
        return v


class HabitOut(CamelModel):
    id: uuid.UUID
    title: str
    description: str | None
    icon: str | None
    color: str | None
    goal_id: uuid.UUID | None
    frequency_type: str
    frequency_days: list[int] | None
    frequency_target: int | None
    target: float
    unit: str | None
    difficulty: str
    position: int
    active: bool
    created_at: datetime
    # Derived (filled by the API)
    current_streak: int = 0
    longest_streak: int = 0
    completed_today: bool = False
    at_risk: bool = False
    completions_30d: int = 0


class CompleteRequest(CamelModel):
    date: DateType | None = None  # defaults to today in the user's timezone
    value: float | None = Field(default=None, ge=0, le=10000)
    note: str | None = Field(default=None, max_length=500)


class CompletionOut(CamelModel):
    id: uuid.UUID
    habit_id: uuid.UUID
    date: DateType
    value: float
    completed: bool
    note: str | None


class HabitHistory(CamelModel):
    habit_id: uuid.UUID
    completions: list[CompletionOut]
    current_streak: int
    longest_streak: int


class HabitStats(CamelModel):
    habit_id: uuid.UUID
    current_streak: int
    longest_streak: int
    total_completions: int
    window_days: int
    scheduled_in_window: int
    completed_in_window: int
    completion_rate: int  # 0-100 over scheduled days in the window
    total_value: float
    last_completed_date: DateType | None
