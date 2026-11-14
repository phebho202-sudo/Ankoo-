from datetime import timedelta

from app.db.base import utcnow
from tests.conftest import ADMIN_HEADERS
from tests.test_rights import PDF


def _make_episode(client, h):
    r = client.post(
        "/api/v1/channels",
        headers=h,
        json={
            "reference": "@licensed",
            "authorisation_basis": "licensed",
            "authorisation_note": "Licence AH-2026-01 signed",
        },
    )
    ch = r.json()
    from app.worker.celery_app import celery_app

    celery_app.conf.task_always_eager = True
    try:
        client.post(f"/api/v1/channels/{ch['id']}/scan", headers=h)
    finally:
        celery_app.conf.task_always_eager = False
    ep = client.get("/api/v1/episodes?limit=1", headers=h).json()["episodes"][0]
    return ch, ep


def test_licence_lifecycle_over_api(client, owner_headers):
    h = owner_headers
    ch, ep = _make_episode(client, h)
    now = utcnow()
    body = {
        "licence_reference": "AH-2026-01",
        "licensor_name": "Rights Holder Ltd",
        "effective_from": (now - timedelta(days=1)).isoformat(),
        "expires_at": (now + timedelta(days=300)).isoformat(),
        "translation": "granted",
        "adaptation": "granted",
        "commercial": "granted",
        "distribution": "granted",
        "permitted_platforms": ["youtube"],
    }
    lic = client.post("/api/v1/rights/licences", headers=h, json=body).json()
    assert lic["status"] == "draft" and set(lic["problems"]) == {
        "document_missing",
        "scope_missing",
    }

    r = client.post(
        f"/api/v1/rights/licences/{lic['id']}/document",
        headers=h,
        files={"file": ("licence.pdf", PDF, "application/pdf")},
    )
    assert r.status_code == 200 and r.json()["document"]["size"] == len(PDF)
    r = client.put(
        f"/api/v1/rights/licences/{lic['id']}/scope",
        headers=h,
        json={"channel_id": ch["id"], "episode_ids": []},
    )
    assert r.json()["problems"] == []

    r = client.post(
        f"/api/v1/rights/licences/{lic['id']}/verify", headers=h, json={"confirmed": False}
    )
    assert r.status_code == 400
    r = client.post(
        f"/api/v1/rights/licences/{lic['id']}/verify", headers=h, json={"confirmed": True}
    )
    assert r.json()["status"] == "verified" and r.json()["state"] == "active"

    d = client.get(f"/api/v1/rights/licences/{lic['id']}/document", headers=h)
    assert d.content == PDF and d.headers["content-type"] == "application/pdf"
    assert d.headers["cache-control"] == "private, no-store"

    r = client.post(
        "/api/v1/rights/check", headers=h, json={"episode_id": ep["id"], "purpose": "adaptation"}
    )
    assert r.json()["allowed"] is True
    r = client.post(
        "/api/v1/rights/check",
        headers=h,
        json={"episode_id": ep["id"], "purpose": "publish", "platform": "youtube"},
    )
    assert r.json()["allowed"] is False  # sample episodes can never be published
    assert [x["code"] for x in r.json()["reasons"]] == ["sample_episode"]

    checks = client.get(f"/api/v1/rights/checks?episode_id={ep['id']}", headers=h).json()["checks"]
    assert len(checks) == 2
    s = client.get("/api/v1/rights/summary", headers=h).json()["summary"]
    assert s["active"] == 1

    r = client.post(
        f"/api/v1/rights/licences/{lic['id']}/revoke", headers=h, json={"reason": "Ended"}
    )
    assert r.json()["state"] == "revoked"


def test_wrong_file_type_rejected(client, owner_headers):
    now = utcnow()
    lic = client.post(
        "/api/v1/rights/licences",
        headers=owner_headers,
        json={
            "licence_reference": "X",
            "licensor_name": "Y",
            "effective_from": now.isoformat(),
            "expires_at": (now + timedelta(days=1)).isoformat(),
        },
    ).json()
    r = client.post(
        f"/api/v1/rights/licences/{lic['id']}/document",
        headers=owner_headers,
        files={"file": ("x.pdf", b"<script>", "application/pdf")},
    )
    assert r.status_code == 400


def test_naive_dates_are_lagos_time(client, owner_headers):
    lic = client.post(
        "/api/v1/rights/licences",
        headers=owner_headers,
        json={
            "licence_reference": "X",
            "licensor_name": "Y",
            "effective_from": "2026-12-01T00:00:00",
            "expires_at": "2027-12-01T00:00:00",
        },
    ).json()
    assert lic["effective_from"] == "2026-11-30T23:00:00+00:00"


def test_licence_changes_need_owner_login(client):
    r = client.post("/api/v1/rights/licences", headers=ADMIN_HEADERS, json={})
    assert r.status_code in (401, 422)
    now = utcnow()
    r = client.post(
        "/api/v1/rights/licences",
        headers=ADMIN_HEADERS,
        json={
            "licence_reference": "X",
            "licensor_name": "Y",
            "effective_from": now.isoformat(),
            "expires_at": (now + timedelta(days=1)).isoformat(),
        },
    )
    assert r.status_code == 401


def test_originality_endpoint(client, owner_headers):
    r = client.post("/api/v1/rights/originality", headers=owner_headers, json={"text": "too short"})
    assert r.status_code == 400
    r = client.post(
        "/api/v1/rights/originality",
        headers=owner_headers,
        json={"text": "A completely original lesson about saving money in ajo groups."},
    )
    assert r.status_code == 200 and r.json()["flagged"] is False


def test_channel_basis_change_api(client, owner_headers):
    ch = client.post(
        "/api/v1/channels",
        headers=owner_headers,
        json={
            "reference": "@basis",
            "authorisation_basis": "research_only",
            "authorisation_note": "research only, public videos",
        },
    ).json()
    r = client.patch(
        f"/api/v1/channels/{ch['id']}",
        headers=owner_headers,
        json={"authorisation_basis": "licensed", "authorisation_note": "short"},
    )
    assert r.status_code == 400
    r = client.patch(
        f"/api/v1/channels/{ch['id']}",
        headers=owner_headers,
        json={
            "authorisation_basis": "licensed",
            "authorisation_note": "Licence AH-2026-02 signed 1 Dec",
        },
    )
    assert r.json()["authorisation_basis"] == "licensed"
