"""Goals, milestones, and their XP effects."""

from __future__ import annotations

from tests.conftest import make_habit, register, total_xp


def make_goal(client, headers, /, **overrides):
    body = {"title": "Run a marathon", "category": "health", **overrides}
    r = client.post("/goals", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_goal_crud_and_milestones(client, user):
    g = make_goal(client, user["headers"], milestones=[
        {"title": "Run 5k"},
        {"title": "Run 10k", "targetDate": "2026-12-31"},
    ])
    assert g["status"] == "active" and g["progress"] == 0
    titles = [m["title"] for m in g["milestones"]]
    assert titles == ["Run 5k", "Run 10k"]

    mid = g["milestones"][0]["id"]
    base = total_xp(client, user["headers"])

    done = client.post(f"/milestones/{mid}/complete", headers=user["headers"])
    assert done.status_code == 200 and done.json()["completed"] is True
    assert total_xp(client, user["headers"]) == base + 200

    # Unticking a milestone reverses its XP.
    undone = client.patch(f"/milestones/{mid}", json={"completed": False},
                          headers=user["headers"])
    assert undone.json()["completed"] is False
    assert total_xp(client, user["headers"]) == base

    renamed = client.patch(f"/milestones/{mid}", json={"title": "Run 5k race"},
                           headers=user["headers"])
    assert renamed.json()["title"] == "Run 5k race"

    extra = client.post(f"/goals/{g['id']}/milestones",
                        json={"title": "Run a half"}, headers=user["headers"])
    assert extra.status_code == 201
    assert extra.json()["sortOrder"] == 2

    assert client.delete(f"/milestones/{extra.json()['id']}",
                         headers=user["headers"]).status_code == 204
    assert len(client.get(f"/goals/{g['id']}",
                          headers=user["headers"]).json()["milestones"]) == 2

    paused = client.patch(f"/goals/{g['id']}", json={"status": "paused"},
                          headers=user["headers"])
    assert paused.json()["status"] == "paused"

    assert client.delete(f"/goals/{g['id']}",
                         headers=user["headers"]).status_code == 204
    assert client.get(f"/goals/{g['id']}",
                      headers=user["headers"]).status_code == 404


def test_goal_completion_xp_round_trip(client, user):
    g = make_goal(client, user["headers"])
    client.post(f"/goals/{g['id']}/milestones", json={"title": "Step 1"},
                headers=user["headers"])
    base = total_xp(client, user["headers"])

    complete = client.post(f"/goals/{g['id']}/complete", headers=user["headers"])
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"
    assert total_xp(client, user["headers"]) == base + 1000

    # Reopening the goal reverses the goal XP (milestone XP untouched).
    reopen = client.patch(f"/goals/{g['id']}", json={"status": "active"},
                          headers=user["headers"])
    assert reopen.json()["status"] == "active"
    assert total_xp(client, user["headers"]) == base

    # Completing both goal and milestone, then deleting the goal, nets zero.
    mid = client.get(f"/goals/{g['id']}", headers=user["headers"]).json()["milestones"][0]["id"]
    client.post(f"/milestones/{mid}/complete", headers=user["headers"])
    client.post(f"/goals/{g['id']}/complete", headers=user["headers"])
    assert total_xp(client, user["headers"]) == base + 1200

    client.delete(f"/goals/{g['id']}", headers=user["headers"])
    assert total_xp(client, user["headers"]) == base


def test_goal_list_status_filter(client, user):
    g1 = make_goal(client, user["headers"], title="A")
    make_goal(client, user["headers"], title="B")
    client.post(f"/goals/{g1['id']}/complete", headers=user["headers"])

    active = client.get("/goals?status=active", headers=user["headers"]).json()
    completed = client.get("/goals?status=completed", headers=user["headers"]).json()
    assert [x["title"] for x in completed] == ["A"]
    assert [x["title"] for x in active] == ["B"]


def test_habit_goal_link_and_disassociation(client, user):
    g = make_goal(client, user["headers"])
    h = make_habit(client, user["headers"], title="Trained for goal",
                   goalId=g["id"])
    assert h["goalId"] == g["id"]

    goal = client.get(f"/goals/{g['id']}", headers=user["headers"]).json()
    assert goal["habitCount"] == 1

    client.delete(f"/goals/{g['id']}", headers=user["headers"])
    after = client.get(f"/habits/{h['id']}", headers=user["headers"]).json()
    assert after["goalId"] is None

    bad = client.patch(f"/habits/{h['id']}",
                       json={"goalId": "00000000-0000-0000-0000-000000000000"},
                       headers=user["headers"])
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"


def test_goals_isolated_between_users(client):
    _, a = register(client)
    _, b = register(client)
    ga = make_goal(client, a)

    assert client.get(f"/goals/{ga['id']}", headers=b).status_code == 404
    patch = client.patch(f"/goals/{ga['id']}", json={"title": "hijacked"},
                         headers=b)
    assert patch.status_code == 404
    mids = client.post(f"/goals/{ga['id']}/milestones",
                       json={"title": "sneaky"}, headers=b)
    assert mids.status_code == 404
    mid = ga["milestones"][0]["id"] if ga["milestones"] else None
    assert mid is None
    assert client.get("/goals", headers=b).json() == []
    assert len(client.get("/goals", headers=a).json()) == 1


def test_milestone_ownership_enforced(client):
    _, a = register(client)
    _, b = register(client)
    ga = make_goal(client, a, milestones=[{"title": "A step"}])
    mid = ga["milestones"][0]["id"]

    assert client.patch(f"/milestones/{mid}", json={"completed": True},
                        headers=b).status_code == 404
    assert client.post(f"/milestones/{mid}/complete",
                       headers=b).status_code == 404
    assert client.delete(f"/milestones/{mid}", headers=b).status_code == 404
    assert total_xp(client, b) == 0
