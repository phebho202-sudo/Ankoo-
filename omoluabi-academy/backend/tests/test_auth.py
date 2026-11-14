from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.errors import AppError, ConflictError
from app.core.security import hash_password, validate_password_strength, verify_password
from app.db.base import utcnow
from app.models import AuditLog, AuthSession
from app.services import auth
from tests.conftest import ADMIN_HEADERS, OWNER_EMAIL, OWNER_PASSWORD


def test_password_hash_roundtrip_and_salting():
    h1, h2 = hash_password("Abcdefghij12"), hash_password("Abcdefghij12")
    assert h1 != h2  # random salt
    assert verify_password("Abcdefghij12", h1)
    assert not verify_password("Abcdefghij13", h1)
    assert not verify_password("x", "garbage")


@pytest.mark.parametrize(
    "pw", ["short1A", "alllowercase123", "ALLUPPERCASE123", "NoDigitsHereAtAll"]
)
def test_weak_passwords_rejected(pw):
    assert validate_password_strength(pw)


def test_create_owner_validates_and_prevents_duplicates(db, owner):
    assert owner.email == OWNER_EMAIL and owner.password_hash.startswith("scrypt$")
    with pytest.raises(ConflictError):
        auth.create_owner(db, email=OWNER_EMAIL.upper(), password=OWNER_PASSWORD, display_name="x")
    with pytest.raises(AppError):
        auth.create_owner(db, email="b@x.ng", password="weak", display_name="x")


def test_login_returns_session_and_stores_only_hash(client, db, owner):
    r = client.post(
        "/api/v1/auth/login", json={"email": "  Owner@Omoluabi.TEST ", "password": OWNER_PASSWORD}
    )
    assert r.status_code == 200
    token = r.json()["token"]
    assert r.json()["user"]["email"] == OWNER_EMAIL
    stored = db.execute(select(AuthSession.token_hash)).scalars().all()
    assert token not in stored and len(stored) == 1


def test_wrong_password_and_unknown_email_give_same_error(client, owner):
    a = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": "Wrong-pass-99"})
    b = client.post(
        "/api/v1/auth/login", json={"email": "nobody@x.ng", "password": "Wrong-pass-99"}
    )
    assert a.status_code == b.status_code == 401
    assert a.json()["error"]["message"] == b.json()["error"]["message"]


def test_lockout_after_repeated_failures(client, db, owner):
    for _ in range(auth.MAX_FAILED_LOGINS):
        client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": "Wrong-pass-99"})
    r = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 401
    assert "Too many failed attempts" in r.json()["error"]["message"]
    actions = db.execute(select(AuditLog.action)).scalars().all()
    assert actions.count("auth.login_failed") == auth.MAX_FAILED_LOGINS
    assert "auth.login_blocked" in actions


def test_me_and_logout_revokes_session(client, owner_headers):
    assert client.get("/api/v1/auth/me", headers=owner_headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=owner_headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=owner_headers).status_code == 401


def test_expired_session_rejected(client, db, owner_headers):
    for s in db.execute(select(AuthSession)).scalars():
        s.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/v1/auth/me", headers=owner_headers).status_code == 401


def test_inactive_user_session_rejected(client, db, owner, owner_headers):
    owner.is_active = False
    db.commit()
    assert client.get("/api/v1/overview", headers=owner_headers).status_code == 401


def test_service_token_cannot_act_as_owner(client):
    assert client.get("/api/v1/auth/me", headers=ADMIN_HEADERS).status_code == 401


def test_language_preference(client, owner_headers):
    r = client.put("/api/v1/auth/me/language", json={"language": "yo"}, headers=owner_headers)
    assert r.json()["preferred_language"] == "yo"
    r = client.put("/api/v1/auth/me/language", json={"language": "fr"}, headers=owner_headers)
    assert r.status_code == 422
