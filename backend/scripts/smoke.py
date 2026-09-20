"""End-to-end smoke test against the live app (throwaway SQLite DB).

Run from backend/:  DATABASE_URL="sqlite:///./_smoke.db" uv run python scripts/smoke.py
"""

from fastapi.testclient import TestClient

from app.main import app

with TestClient(app) as c:
    r = c.get("/health")
    print("health:", r.status_code, r.json())

    r = c.post("/auth/register", json={"email": "a@b.co", "password": "supersecret", "displayName": "Ash"})
    print("register:", r.status_code)
    body = r.json()
    tok, rtok = body["accessToken"], body["refreshToken"]
    H = {"Authorization": f"Bearer {tok}"}

    r = c.get("/users/me", headers=H)
    print("me:", r.status_code, r.json()["email"])

    r = c.post("/habits", headers=H, json={"title": "Run", "frequencyType": "daily", "difficulty": "hard"})
    print("create habit:", r.status_code)
    hid = r.json()["id"]

    r = c.post(f"/habits/{hid}/complete", headers=H, json={})
    print("complete:", r.status_code, "streak:", r.json().get("currentStreak"))

    r = c.post("/habits", headers=H, json={"title": "Read", "frequencyType": "custom_days"})
    print("custom_days w/o days ->", r.status_code, r.json()["error"]["code"] if r.status_code == 422 else r.text)

    r = c.post(
        "/goals",
        headers=H,
        json={"title": "Finish marathon", "category": "health", "milestones": [{"title": "5k"}, {"title": "10k"}]},
    )
    print("goal:", r.status_code, "progress:", r.json().get("progress"))
    gid, mid = r.json()["id"], r.json()["milestones"][0]["id"]
    r = c.post(f"/milestones/{mid}/complete", headers=H)
    print("milestone complete:", r.status_code, r.json()["completed"])
    r = c.patch(f"/milestones/{mid}", headers=H, json={"title": "5k run"})
    print("milestone patch:", r.status_code, r.json()["title"])
    r = c.post(f"/goals/{gid}/milestones", headers=H, json={"title": "21k"})
    print("milestone add:", r.status_code, r.json()["sortOrder"])
    r = c.delete(f"/milestones/{r.json()['id']}", headers=H)
    print("milestone delete:", r.status_code)

    r = c.patch(f"/habits/{hid}", headers=H, json={"goalId": gid})
    print("link habit->goal:", r.status_code)

    r = c.get("/dashboard/today", headers=H)
    d = r.json()
    print("dashboard:", r.status_code, "state:", d.get("dayState"), "level:", d["level"]["level"], "summary:", d["summary"])

    r = c.get("/analytics/overview", headers=H)
    print("overview:", r.status_code, r.json())
    r = c.get("/analytics/heatmap?months=3", headers=H)
    print("heatmap:", r.status_code, len(r.json()))
    r = c.get("/analytics/consistency?days=14", headers=H)
    print("consistency:", r.status_code, len(r.json()))
    r = c.get("/analytics/xp?days=14", headers=H)
    print("xp:", r.status_code, r.json()[-1])
    r = c.get("/analytics/categories", headers=H)
    print("categories:", r.status_code, len(r.json()))

    r = c.get("/activity", headers=H)
    print("activity:", r.status_code, len(r.json()["items"]), "cursor:", bool(r.json()["nextCursor"]))
    r2 = c.get("/reviews/weekly", headers=H)
    print("review get:", r2.status_code, r2.json()["stats"])
    r3 = c.put("/reviews/weekly", headers=H, json={"weekStart": r2.json()["weekStart"], "wentWell": "x", "toChange": "y"})
    print("review put:", r3.status_code, "reviewId set:", r3.json()["id"] is not None)

    r = c.delete(f"/habits/{hid}/complete/{d['date']}", headers=H)
    print("uncomplete:", r.status_code, "streak:", r.json().get("currentStreak"))
    r = c.get("/analytics/overview", headers=H)
    print("overview after undo:", r.json()["totalCompletions"], "xp:", r.json()["totalXp"])

    r = c.get(f"/habits/{hid}/history?days=30", headers=H)
    print("history:", r.status_code, len(r.json()["completions"]), "streaks:", r.json()["currentStreak"], r.json()["longestStreak"])
    r = c.get(f"/habits/{hid}/stats", headers=H)
    print("stats:", r.status_code, r.json())
    r = c.delete(f"/goals/{gid}", headers=H)
    print("delete goal:", r.status_code)
    r = c.get("/habits", headers=H)
    print("habits after goal delete:", r.status_code, "goalId:", r.json()[0]["goalId"])
    r = c.delete(f"/habits/{hid}", headers=H)
    print("delete habit:", r.status_code)

    r = c.post("/auth/register", json={"email": "a@b.co", "password": "supersecret", "displayName": "Ash2"})
    print("dup register:", r.status_code, r.json()["error"]["code"])
    r = c.post("/auth/login", json={"email": "a@b.co", "password": "wrong"})
    print("bad login:", r.status_code, r.json()["error"]["code"])
    r = c.get("/habits")
    print("unauth:", r.status_code, r.json()["error"]["code"])

    r = c.post("/auth/refresh", json={"refreshToken": rtok})
    print("refresh:", r.status_code)
    new_rt = r.json().get("refreshToken")
    r = c.post("/auth/refresh", json={"refreshToken": rtok})
    print("refresh reuse:", r.status_code, r.json()["error"]["code"] if r.status_code != 200 else "FAIL not rotated")
    r = c.post("/auth/logout", headers=H, json={"refreshToken": new_rt})
    print("logout:", r.status_code)
    r = c.get("/dashboard/2024-01-15", headers=H)
    print("dashboard by date:", r.status_code, "timeOfDay:", r.json().get("timeOfDay"))
