"""Analytics endpoints: overview, heatmap, consistency, XP timeline, categories."""

from __future__ import annotations

from tests.conftest import make_habit, total_xp, today_str


def test_overview_counts(client, user):
    blank = client.get("/analytics/overview", headers=user["headers"]).json()
    assert blank["totalCompletions"] == 0
    assert blank["totalXp"] == 0
    assert blank["activeHabits"] == 0 and blank["totalHabits"] == 0
    assert blank["activeGoals"] == 0 and blank["completedGoals"] == 0
    assert blank["bestCurrentStreak"] == 0
    assert blank["perfectDays90d"] == 0

    make_habit(client, user["headers"], title="One")
    h2 = make_habit(client, user["headers"], title="Two")
    client.post("/goals", json={"title": "Goal", "category": "career"},
                headers=user["headers"])
    client.post(f"/habits/{h2['id']}/complete", headers=user["headers"])

    ov = client.get("/analytics/overview", headers=user["headers"]).json()
    assert ov["totalHabits"] == 2 and ov["activeHabits"] == 2
    assert ov["totalCompletions"] == 1
    # One of two scheduled habits done -> no perfect day, just completion XP.
    assert ov["totalXp"] == 20
    assert ov["perfectDays90d"] == 0
    assert ov["bestCurrentStreak"] == 1
    assert ov["activeGoals"] == 1 and ov["completedGoals"] == 0


def test_heatmap(client, user):
    h = make_habit(client, user["headers"])
    client.post(f"/habits/{h['id']}/complete", headers=user["headers"])

    cells = client.get("/analytics/heatmap?months=2",
                       headers=user["headers"]).json()
    assert isinstance(cells, list) and 55 <= len(cells) <= 70
    today = today_str(client, user["headers"])
    by_date = {c["date"]: c for c in cells}
    assert by_date[today]["completed"] == 1
    assert by_date[today]["scheduled"] == 1
    assert by_date[today]["level"] >= 1
    assert all(0 <= c["level"] <= 5 for c in cells)


def test_consistency_series(client, user):
    h = make_habit(client, user["headers"])
    client.post(f"/habits/{h['id']}/complete", headers=user["headers"])

    pts = client.get("/analytics/consistency?days=14",
                     headers=user["headers"]).json()
    assert len(pts) == 14
    dates = [p["date"] for p in pts]
    assert dates == sorted(dates)
    assert pts[-1]["date"] == today_str(client, user["headers"])
    assert sum(p["completed"] for p in pts) == 1
    assert all(0 <= p["rate"] <= 100 for p in pts)


def test_xp_timeline(client, user):
    h = make_habit(client, user["headers"], difficulty="hard")
    client.post(f"/habits/{h['id']}/complete", headers=user["headers"])

    pts = client.get("/analytics/xp?days=14",
                     headers=user["headers"]).json()
    assert len(pts) == 14
    cumulatives = [p["cumulative"] for p in pts]
    assert cumulatives == sorted(cumulatives)  # never decreases
    assert pts[-1]["cumulative"] == total_xp(client, user["headers"])
    assert pts[-1]["xp"] > 0


def test_category_breakdown(client, user):
    goal = client.post("/goals", json={"title": "Get fit", "category": "health"},
                       headers=user["headers"]).json()
    make_habit(client, user["headers"], title="Gym", goalId=goal["id"])

    cats = client.get("/analytics/categories", headers=user["headers"]).json()
    health = next(c for c in cats if c["category"] == "health")
    assert health["goals"] == 1
    assert health["habits"] == 1
    assert all(0 <= c["avgGoalProgress"] <= 100 for c in cats)


def test_analytics_require_auth(client):
    assert client.get("/analytics/overview").status_code == 401
