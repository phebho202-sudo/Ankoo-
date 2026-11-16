"""The database commit must finish before the client gets its answer."""

from sqlalchemy.orm import Session


def test_a_failed_commit_is_never_reported_as_success(client, owner_headers, monkeypatch):
    def broken_commit(self):
        raise RuntimeError("disk full")

    monkeypatch.setattr(Session, "commit", broken_commit)
    r = client.put(
        "/api/v1/settings/budget.alert_threshold_percent", headers=owner_headers, json={"value": 70}
    )
    # With the commit after the response (FastAPI's default scope) this would have been 200.
    assert r.status_code == 500


def test_every_route_commits_before_responding():
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "app"
    uses = bad = 0
    for f in root.rglob("*.py"):
        text = f.read_text(encoding="utf-8")
        uses += text.count("Depends(get_db")
        bad += len(re.findall(r"Depends\(get_db\)", text))
    assert uses > 50 and bad == 0
