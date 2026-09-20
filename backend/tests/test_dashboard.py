"""Dashboard day view: shape, time-of-day, and day-state transitions."""

from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import make_habit, today_str


def shift(iso: str, n: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=n)).isoformat()


def test_dashboard_today_shape(client, user):
    body = client.get("/api/dashboard/today", headers=user["headers"]).json()
    assert body["date"] == today_str(client, user["headers"])
    assert body["timeOfDay"] in {"morning", "midday", "evening", "night"}
    # Brand-new user: nothing scheduled.
    assert body["dayState"] == "fresh"
    assert body["summary"] == {
        "scheduled": 0, "completed": 0, "remaining": 0,
        "completionRate": 0, "atRiskCount": 0,
    }
    assert body["habits"] == [] and body["goals"] == []
    assert 0 <= body["momentum"]["score"] <= 100
    assert isinstance(body["momentum"]["trend"], str)
    assert body["level"]["level"] == 1 and body["level"]["totalXp"] == 0
    assert body["perfectDay"] == {"achieved": False, "remaining": 0, "bonus": 50}
    for window in ("today", "week", "month"):
        assert body["consistency"][window]["scheduled"] == 0


def test_day_state_perfect_and_closed(client, user):
    h = make_habit(client, user["headers"])
    today = today_str(client, user["headers"])

    past = shift(today, -5)
    before = client.get(f"/api/dashboard/{past}", headers=user["headers"]).json()
    assert before["date"] == past
    assert before["timeOfDay"] is None  # time-of-day only makes sense today
    assert before["dayState"] == "closed"

    client.post(f"/api/habits/{h['id']}/complete", headers=user["headers"])
    body = client.get("/api/dashboard/today", headers=user["headers"]).json()
    assert body["dayState"] == "perfect"
    assert body["summary"]["completed"] == 1
    assert body["summary"]["remaining"] == 0
    assert body["summary"]["completionRate"] == 100
    assert body["perfectDay"]["achieved"] is True
    assert body["habits"][0]["done"] is True

    # Backfilling a past day flips that day from closed to perfect.
    client.post(f"/api/habits/{h['id']}/complete", json={"date": past},
                headers=user["headers"])
    after = client.get(f"/api/dashboard/{past}", headers=user["headers"]).json()
    assert after["dayState"] == "perfect"


def test_day_state_future_is_fresh(client, user):
    make_habit(client, user["headers"])
    today = today_str(client, user["headers"])
    body = client.get(f"/api/dashboard/{shift(today, 3)}",
                      headers=user["headers"]).json()
    assert body["dayState"] == "fresh"
    assert body["timeOfDay"] is None


def test_day_state_at_risk(client, user):
    h = make_habit(client, user["headers"])
    today = today_str(client, user["headers"])
    client.post(f"/api/habits/{h['id']}/complete", json={"date": shift(today, -1)},
                headers=user["headers"])
    body = client.get("/api/dashboard/today", headers=user["headers"]).json()
    assert body["summary"]["atRiskCount"] == 1
    assert body["dayState"] == "at_risk"
    assert body["habits"][0]["atRisk"] is True
    assert body["habits"][0]["currentStreak"] == 1


def test_day_state_recovery(client, user):
    # Two daily habits, nothing done in the last three days, then a single
    # completion today -> recovery (not at_risk: streaks are all zero).
    a = make_habit(client, user["headers"], title="A")
    make_habit(client, user["headers"], title="B")
    client.post(f"/api/habits/{a['id']}/complete", headers=user["headers"])
    body = client.get("/api/dashboard/today", headers=user["headers"]).json()
    assert body["summary"]["remaining"] == 1
    assert body["summary"]["atRiskCount"] == 0
    assert body["dayState"] == "recovery"


def test_dashboard_rejects_bad_day(client, user):
    r = client.get("/api/dashboard/not-a-date", headers=user["headers"])
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
