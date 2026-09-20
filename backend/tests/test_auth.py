"""Auth + user profile tests."""

from __future__ import annotations

from tests.conftest import register


def test_register_returns_tokens_and_user(client):
    data, headers = register(client, email="Mixed.Case@Example.com")
    assert data["accessToken"] and data["refreshToken"]
    assert data["user"]["email"] == "mixed.case@example.com"  # lowercased
    assert data["user"]["displayName"] == "Tester"
    assert data["user"]["timezone"] == "UTC"

    me = client.get("/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["id"] == data["user"]["id"]


def test_register_duplicate_email_conflict(client):
    _, _ = register(client, email="dup@example.com")
    r = client.post("/auth/register", json={
        "email": "DUP@example.com", "password": "supersecret",
        "displayName": "Other",
    })
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "EMAIL_TAKEN"


def test_register_validation_error_shape(client):
    r = client.post("/auth/register", json={"email": "nope", "password": "x"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_and_bad_password(client, user):
    ok = client.post("/auth/login",
                     json={"email": user["email"], "password": user["password"]})
    assert ok.status_code == 200
    assert ok.json()["accessToken"]

    bad = client.post("/auth/login",
                      json={"email": user["email"], "password": "wrong-here"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_requires_valid_token(client):
    assert client.get("/users/me").status_code == 401
    r = client.get("/users/me", headers={"Authorization": "***"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "TOKEN_INVALID"


def test_refresh_rotates_and_revokes_old(client, user):
    r = client.post("/auth/refresh", json={"refreshToken": user["refresh"]})
    assert r.status_code == 200
    fresh = r.json()
    assert fresh["refreshToken"] != user["refresh"]

    # New pair works.
    me = client.get("/users/me",
                    headers={"Authorization": f"Bearer {fresh['accessToken']}"})
    assert me.status_code == 200

    # Re-using the rotated token is rejected.
    replay = client.post("/auth/refresh", json={"refreshToken": user["refresh"]})
    assert replay.status_code == 401


def test_logout_revokes(client, user):
    # Present a refresh token: it is revoked, the access token still works.
    r = client.post("/auth/logout", json={"refreshToken": user["refresh"]},
                    headers=user["headers"])
    assert r.status_code == 204
    assert client.post("/auth/refresh",
                       json={"refreshToken": user["refresh"]}).status_code == 401

    # Login again, then logout without a body revokes every session.
    login = client.post("/auth/login",
                        json={"email": user["email"], "password": user["password"]})
    tokens = login.json()
    out = client.post("/auth/logout",
                      headers={"Authorization": f"Bearer {tokens['accessToken']}"})
    assert out.status_code == 204
    reuse = client.post("/auth/refresh",
                        json={"refreshToken": tokens["refreshToken"]})
    assert reuse.status_code == 401


def test_update_profile(client, user):
    r = client.patch("/users/me",
                     json={"displayName": "Hero", "weekStart": 7},
                     headers=user["headers"])
    assert r.status_code == 200
    assert r.json()["displayName"] == "Hero"
    assert r.json()["weekStart"] == 7

    bad = client.patch("/users/me", json={"timezone": "Mars/Olympus"},
                       headers=user["headers"])
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"

    ok = client.patch("/users/me", json={"timezone": "Europe/Berlin"},
                      headers=user["headers"])
    assert ok.status_code == 200 and ok.json()["timezone"] == "Europe/Berlin"


def test_change_password(client, user):
    wrong = client.post("/users/me/password",
                        json={"currentPassword": "nope", "newPassword": "brand-new-pw"},
                        headers=user["headers"])
    assert wrong.status_code == 401

    ok = client.post("/users/me/password",
                     json={"currentPassword": user["password"],
                           "newPassword": "brand-new-pw"},
                     headers=user["headers"])
    assert ok.status_code == 204

    assert client.post("/auth/login",
                       json={"email": user["email"], "password": user["password"]}
                       ).status_code == 401
    assert client.post("/auth/login",
                       json={"email": user["email"], "password": "brand-new-pw"}
                       ).status_code == 200
