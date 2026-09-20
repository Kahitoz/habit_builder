"""XP ledger and level curve."""

from __future__ import annotations

from datetime import date, timedelta

from app.services.xp import level_from_xp, level_progress, level_threshold
from tests.conftest import make_habit, today_str, total_xp


def test_level_thresholds_match_spec():
    assert level_threshold(1) == 0
    assert level_threshold(2) == 500
    assert level_threshold(3) == 1200
    assert level_threshold(4) == 2100


def test_level_from_xp_boundaries():
    assert level_from_xp(0) == 1
    assert level_from_xp(499) == 1
    assert level_from_xp(500) == 2
    assert level_from_xp(1199) == 2
    assert level_from_xp(1200) == 3


def test_level_progress_at_280_xp():
    lp = level_progress(280)
    assert lp["level"] == 1
    assert lp["nextLevelXp"] == 500
    assert lp["xpForNextLevel"] == 220
    assert lp["progress"] == 56


def test_difficulty_xp_and_perfect_day(client, user):
    totals = {"easy": 10, "medium": 20, "hard": 30}
    for diff in totals:
        h = make_habit(client, user["headers"], title=f"H {diff}",
                       difficulty=diff)
        r = client.post(f"/habits/{h['id']}/complete", headers=user["headers"])
        assert r.status_code == 200
    # All 3 habits done today -> 60 + 50 perfect-day bonus.
    assert total_xp(client, user["headers"]) == 110


def test_level_info_in_dashboard(client, user):
    h = make_habit(client, user["headers"], difficulty="hard")
    client.post(f"/habits/{h['id']}/complete", headers=user["headers"])
    dash = client.get("/dashboard/today", headers=user["headers"]).json()
    assert dash["level"]["level"] == 1
    assert dash["level"]["totalXp"] == 80
    assert dash["level"]["xpForNextLevel"] == 420


def test_streak_bonuses_granted_once(client, user):
    """Crossing the 7-day threshold awards 75 XP exactly once."""
    h = make_habit(client, user["headers"], difficulty="easy")
    today = date.fromisoformat(today_str(client, user["headers"]))
    dates = [(today - timedelta(days=n)).isoformat() for n in range(6, -1, -1)]
    for iso in dates:
        client.post(f"/habits/{h['id']}/complete", json={"date": iso},
                    headers=user["headers"])
    expected = 7 * 10 + 7 * 50 + 75
    assert total_xp(client, user["headers"]) == expected
