"""Goal progress helpers."""

from __future__ import annotations

from app.models.goal import Goal, Milestone


def sorted_milestones(goal: Goal) -> list[Milestone]:
    return sorted(goal.milestones, key=lambda m: (m.sort_order, m.created_at))


def goal_progress(goal: Goal) -> int:
    """Percent complete. Milestones drive progress when present."""
    if goal.status == "completed":
        return 100
    ms = sorted_milestones(goal)
    if ms:
        done = sum(1 for m in ms if m.completed)
        return round(done / len(ms) * 100)
    return max(0, min(goal.manual_progress, 100))


def next_milestone(goal: Goal) -> Milestone | None:
    for m in sorted_milestones(goal):
        if not m.completed:
            return m
    return None
