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
