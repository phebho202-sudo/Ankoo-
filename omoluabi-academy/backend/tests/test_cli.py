from sqlalchemy import select

from app import cli
from app.models import User


def test_create_owner_cli(session_factory, monkeypatch, capsys, db):
    monkeypatch.setattr(cli, "get_sessionmaker", lambda: session_factory)
    monkeypatch.setenv("OWNER_PASSWORD", "Strong-Pass-2026")
    assert cli.main(["create-owner", "--email", "Ade@Example.ng", "--name", "Adé"]) == 0
    assert "Owner account created: ade@example.ng" in capsys.readouterr().out
    assert db.execute(select(User).where(User.email == "ade@example.ng")).scalar_one()

    monkeypatch.setenv("OWNER_PASSWORD", "weak")
    assert cli.main(["create-owner", "--email", "b@example.ng"]) == 1


def test_reset_password_unlocks_and_ends_sessions(session_factory, monkeypatch, capsys, db, client):
    from datetime import timedelta

    from app.db.base import utcnow

    monkeypatch.setattr(cli, "get_sessionmaker", lambda: session_factory)
    monkeypatch.setenv("OWNER_PASSWORD", "Strong-Pass-2026")
    cli.main(["create-owner", "--email", "owner2@example.ng"])
    token = client.post(
        "/api/v1/auth/login", json={"email": "owner2@example.ng", "password": "Strong-Pass-2026"}
    ).json()["token"]
    user = db.execute(select(User).where(User.email == "owner2@example.ng")).scalar_one()
    user.locked_until = utcnow() + timedelta(minutes=10)
    db.commit()

    monkeypatch.setenv("NEW_PASSWORD", "weak")
    assert cli.main(["reset-password", "--email", "owner2@example.ng"]) == 1
    assert cli.main(["reset-password", "--email", "nobody@example.ng"]) == 1
    monkeypatch.setenv("NEW_PASSWORD", "Another-Strong-2026")
    assert cli.main(["reset-password", "--email", "owner2@example.ng"]) == 0
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401  # session ended
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "owner2@example.ng", "password": "Another-Strong-2026"},
    )
    assert r.status_code == 200  # lockout cleared, new password works
