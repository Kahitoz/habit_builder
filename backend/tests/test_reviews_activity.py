"""Weekly reviews and the activity feed's cursor pagination."""

from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import make_habit, register, today_str


def shift(iso: str, n: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=n)).isoformat()


def test_weekly_review_upsert(client, user):
    fresh = client.get("/reviews/weekly", headers=user["headers"]).json()
    assert fresh["id"] is None
    assert fresh["wentWell"] is None and fresh["toChange"] is None
    assert fresh["weekStart"]
    week_start = fresh["weekStart"]

    first = client.put("/reviews/weekly",
                       json={"weekStart": week_start,
                             "wentWell": "Consistent mornings",
                             "toChange": "Less phone at night"},
                       headers=user["headers"])
    assert first.status_code == 200
    body = first.json()
    assert body["id"] is not None
    assert body["wentWell"] == "Consistent mornings"

    again = client.put("/reviews/weekly",
                       json={"weekStart": week_start,
                             "wentWell": "Even better"},
                       headers=user["headers"])
    # Upsert keeps the same row id and replaces the notes.
    assert again.json()["id"] == body["id"]
    assert again.json()["wentWell"] == "Even better"
    assert again.json()["toChange"] is None

    got = client.get("/reviews/weekly", headers=user["headers"]).json()
    assert got["wentWell"] == "Even better"


def test_weekly_review_past_week_and_future_rejection(client, user):
    today = today_str(client, user["headers"])
    past_anchor = shift(today, -14)
    past = client.put("/reviews/weekly",
                      json={"weekStart": past_anchor, "wentWell": "Old week"},
                      headers=user["headers"])
    assert past.status_code == 200
    past_start = past.json()["weekStart"]
    assert past_start <= past_anchor

    got = client.get(f"/reviews/weekly?weekStart={past_anchor}",
                     headers=user["headers"]).json()
    assert got["weekStart"] == past_start
    assert got["wentWell"] == "Old week"

    future = client.put("/reviews/weekly",
                        json={"weekStart": shift(today, 10),
                              "wentWell": "Time travel"},
                        headers=user["headers"])
    assert future.status_code == 422
    assert future.json()["error"]["code"] == "VALIDATION_ERROR"


def test_weekly_review_stats(client, user):
    h = make_habit(client, user["headers"], difficulty="medium")
    client.post(f"/habits/{h['id']}/complete", headers=user["headers"])

    body = client.get("/reviews/weekly", headers=user["headers"]).json()
    stats = body["stats"]
    assert stats["scheduled"] == 7  # one daily habit across the week
    assert stats["completed"] == 1
    assert stats["rate"] == 14
    assert stats["xp"] == 70  # 20 completion + 50 perfect day
    assert stats["perfectDays"] == 1


def test_reviews_isolated_between_users(client):
    _, a = register(client)
    _, b = register(client)
    week_a = client.get("/reviews/weekly", headers=a).json()["weekStart"]
    client.put("/reviews/weekly",
               json={"weekStart": week_a, "wentWell": "Secret notes"},
               headers=a)
    other = client.get("/reviews/weekly", headers=b).json()
    assert other["wentWell"] is None and other["id"] is None


def test_activity_feed_and_cursor_pagination(client, user):
    for i in range(3):
        h = make_habit(client, user["headers"], title=f"H{i}")
        client.post(f"/habits/{h['id']}/complete", headers=user["headers"])
    client.post("/goals", json={"title": "G", "category": "mind"},
                headers=user["headers"])

    full = client.get("/activity?limit=100", headers=user["headers"]).json()
    ids = [item["id"] for item in full["items"]]
    assert len(ids) >= 6  # account + 3 habits + 3 completions + goal (+ bonuses)
    assert len(set(ids)) == len(ids)
    assert full["nextCursor"] is None
    timestamps = [item["createdAt"] for item in full["items"]]
    assert timestamps == sorted(timestamps, reverse=True)

    # Walk the feed two at a time; concatenation must match the full page.
    collected: list[str] = []
    cursor = None
    for _ in range(20):  # generous guard against runaway loops
        url = "/activity?limit=2" + (f"&cursor={cursor}" if cursor else "")
        page = client.get(url, headers=user["headers"]).json()
        collected.extend(item["id"] for item in page["items"])
        cursor = page["nextCursor"]
        if cursor is None:
            break
    assert collected == ids


def test_activity_rejects_bad_inputs(client, user):
    assert client.get("/activity?limit=0",
                      headers=user["headers"]).status_code == 422
    assert client.get("/activity?limit=101",
                      headers=user["headers"]).status_code == 422
    bad = client.get("/activity?cursor=!!!not-base64!!!",
                     headers=user["headers"])
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"


def test_activity_requires_auth(client):
    assert client.get("/activity").status_code == 401
