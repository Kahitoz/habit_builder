"""Habit CRUD, scheduling, streaks, values, and ownership."""

from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import make_habit, register, today_str, total_xp


def shift(iso: str, n: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=n)).isoformat()


def test_habit_crud_and_validation(client, user):
    h = make_habit(client, user["headers"], title="Meditate",
                   icon="sparkles", color="violet", difficulty="easy")
    assert h["currentStreak"] == 0
    assert h["completedToday"] is False
    assert h["frequencyType"] == "daily" and h["active"] is True

    got = client.get(f"/habits/{h['id']}", headers=user["headers"])
    assert got.status_code == 200 and got.json()["title"] == "Meditate"

    patched = client.patch(f"/habits/{h['id']}",
                           json={"title": "Meditate 2.0", "difficulty": "hard"},
                           headers=user["headers"])
    assert patched.status_code == 200
    assert patched.json()["title"] == "Meditate 2.0"
    assert patched.json()["difficulty"] == "hard"

    bad_freq = client.post("/habits",
                           json={"title": "x", "frequencyType": "custom_days"},
                           headers=user["headers"])
    assert bad_freq.status_code == 422
    assert bad_freq.json()["error"]["code"] == "VALIDATION_ERROR"

    bad_diff = client.post("/habits",
                           json={"title": "x", "difficulty": "impossible"},
                           headers=user["headers"])
    assert bad_diff.status_code == 422

    assert client.delete(f"/habits/{h['id']}",
                         headers=user["headers"]).status_code == 204
    assert client.get(f"/habits/{h['id']}",
                      headers=user["headers"]).status_code == 404
    assert client.get("/habits", headers=user["headers"]).json() == []


def test_streaks_undo_and_xp_ledger(client, user):
    h = make_habit(client, user["headers"], difficulty="medium")
    today = today_str(client, user["headers"])

    # Seven consecutive days, oldest first.
    for n in range(6, -1, -1):
        r = client.post(f"/habits/{h['id']}/complete",
                        json={"date": shift(today, -n)}, headers=user["headers"])
        assert r.status_code == 200
    assert r.json()["currentStreak"] == 7
    assert r.json()["longestStreak"] == 7

    # Re-ticking the same day is idempotent (no double XP).
    client.post(f"/habits/{h['id']}/complete", json={"date": today},
                headers=user["headers"])
    # 7 x 20 (medium) + 7 x 50 (perfect days) + 75 (streak-7 bonus)
    assert total_xp(client, user["headers"]) == 565

    # Undo a mid-streak day: completion XP and that day's perfect bonus
    # are reversed; the streak bonus stays. The derived longest streak
    # shrinks with the history (no phantom runs from deleted rows).
    client.delete(f"/habits/{h['id']}/complete/{shift(today, -3)}",
                  headers=user["headers"])
    got = client.get(f"/habits/{h['id']}", headers=user["headers"]).json()
    assert got["currentStreak"] == 3
    assert got["longestStreak"] == 3
    assert total_xp(client, user["headers"]) == 495

    hist = client.get(f"/habits/{h['id']}/history?days=30",
                      headers=user["headers"]).json()
    assert len(hist["completions"]) == 6
    assert hist["currentStreak"] == 3 and hist["longestStreak"] == 3


def test_custom_days_streak_robust_to_unscheduled_days(client, user):
    # Mon/Wed/Fri habit: unscheduled days must not break the streak.
    h = make_habit(client, user["headers"], frequencyType="custom_days",
                   frequencyDays=[1, 3, 5])
    today = date.fromisoformat(today_str(client, user["headers"]))

    scheduled = []
    probe = today - timedelta(days=1)
    while len(scheduled) < 3:
        if probe.isoweekday() in (1, 3, 5):
            scheduled.append(probe.isoformat())
        probe -= timedelta(days=1)

    for iso in reversed(scheduled):
        r = client.post(f"/habits/{h['id']}/complete", json={"date": iso},
                        headers=user["headers"])
        assert r.status_code == 200
    assert r.json()["currentStreak"] == 3
    assert r.json()["longestStreak"] == 3


def test_value_based_completion(client, user):
    h = make_habit(client, user["headers"], title="Read", target=30,
                   unit="min", difficulty="easy")
    today = today_str(client, user["headers"])

    below = client.post(f"/habits/{h['id']}/complete", json={"value": 10},
                        headers=user["headers"]).json()
    assert below["completedToday"] is False
    assert total_xp(client, user["headers"]) == 0

    at = client.post(f"/habits/{h['id']}/complete", json={"value": 35},
                     headers=user["headers"]).json()
    assert at["completedToday"] is True
    assert total_xp(client, user["headers"]) == 60  # 10 + 50 perfect day

    stats = client.get(f"/habits/{h['id']}/stats",
                       headers=user["headers"]).json()
    assert stats["totalCompletions"] == 1
    assert stats["totalValue"] == 35
    assert stats["lastCompletedDate"] == today

    # Dropping below target again unticks for XP purposes.
    lower = client.post(f"/habits/{h['id']}/complete", json={"value": 5},
                        headers=user["headers"]).json()
    assert lower["completedToday"] is False
    assert total_xp(client, user["headers"]) == 0


def test_times_per_week_counts_consecutive_days(client, user):
    h = make_habit(client, user["headers"], frequencyType="times_per_week",
                   frequencyTarget=3)
    today = today_str(client, user["headers"])
    for n in (3, 2, 1, 0):
        r = client.post(f"/habits/{h['id']}/complete",
                        json={"date": shift(today, -n)}, headers=user["headers"])
    assert r.json()["currentStreak"] == 4


def test_habits_are_isolated_between_users(client):
    _, a = register(client)
    _, b = register(client)
    ha = make_habit(client, a, title="A habit")

    assert client.get(f"/habits/{ha['id']}", headers=b).status_code == 404
    assert client.post(f"/habits/{ha['id']}/complete", headers=b).status_code == 404
    assert client.patch(f"/habits/{ha['id']}", json={"title": "hijack"},
                        headers=b).status_code == 404
    assert client.get("/habits", headers=b).json() == []
    assert len(client.get("/habits", headers=a).json()) == 1


def test_delete_habit_revokes_perfect_day_but_keeps_earned_xp(client, user):
    h = make_habit(client, user["headers"], difficulty="hard")
    client.post(f"/habits/{h['id']}/complete", headers=user["headers"])
    assert total_xp(client, user["headers"]) == 80  # 30 + 50 perfect day

    assert client.delete(f"/habits/{h['id']}",
                         headers=user["headers"]).status_code == 204
    # Deleting the only habit makes today unscheduled, so the perfect-day
    # bonus is revoked; already-earned completion XP stays on the ledger.
    assert total_xp(client, user["headers"]) == 30


def test_active_only_filter(client, user):
    h1 = make_habit(client, user["headers"], title="Keep")
    make_habit(client, user["headers"], title="Drop")
    client.patch(f"/habits/{h1['id']}", json={"active": False},
                 headers=user["headers"])
    all_habits = client.get("/habits", headers=user["headers"]).json()
    active_only = client.get("/habits?activeOnly=true",
                             headers=user["headers"]).json()
    assert len(all_habits) == 2
    assert [x["title"] for x in active_only] == ["Drop"]
