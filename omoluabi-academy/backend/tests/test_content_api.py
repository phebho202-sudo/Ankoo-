import pytest

from app.worker.celery_app import celery_app
from tests.conftest import ADMIN_HEADERS


@pytest.fixture
def eager():
    celery_app.conf.task_always_eager = True
    yield
    celery_app.conf.task_always_eager = False


def test_full_discovery_and_research_flow(client, owner_headers, eager):
    h = owner_headers
    r = client.post(
        "/api/v1/channels",
        headers=h,
        json={
            "reference": "@founder",
            "authorisation_basis": "research_only",
            "authorisation_note": "Public videos, studied for research only",
        },
    )
    assert r.status_code == 201, r.text
    ch = r.json()
    assert ch["is_sample"] is True

    r = client.post(f"/api/v1/channels/{ch['id']}/scan", headers=h)
    assert r.status_code == 202
    job = client.get(f"/api/v1/system/jobs/{r.json()['job_id']}", headers=h).json()
    assert job["status"] == "succeeded", (job["error"], job["result"])
    assert job["result"]["new"] == 6

    eps = client.get("/api/v1/episodes?limit=2", headers=h).json()
    assert eps["total"] == 6 and len(eps["episodes"]) == 2
    ep_id = eps["episodes"][0]["id"]

    r = client.put(
        f"/api/v1/episodes/{ep_id}/transcript",
        headers=h,
        json={
            "text": "pricing lesson words",
            "source": "owner_entered",
            "permission_reference": "My own notes from the video",
        },
    )
    assert r.status_code == 200

    r = client.post("/api/v1/research", headers=h, json={"episode_id": ep_id})
    assert r.status_code == 202
    rep = client.get(f"/api/v1/research/reports/{r.json()['report_id']}", headers=h).json()
    assert rep["status"] == "completed" and rep["is_sample"] and rep["used_transcript"]
    detail = client.get(f"/api/v1/episodes/{ep_id}", headers=h).json()
    assert detail["status"] == "researched" and detail["transcript"]["word_count"] == 3

    topic = rep["topics"][0]
    r = client.post(
        f"/api/v1/topics/{topic['id']}/decision",
        headers=h,
        json={"decision": "approved", "note": "Good"},
    )
    assert r.json()["status"] == "approved"
    approved = client.get("/api/v1/topics?status=approved", headers=h).json()["topics"]
    assert [t["id"] for t in approved] == [topic["id"]]


def test_owner_actions_need_owner_login(client, eager):
    assert (
        client.post(
            "/api/v1/channels",
            headers=ADMIN_HEADERS,
            json={
                "reference": "@x",
                "authorisation_basis": "research_only",
                "authorisation_note": "research only, public videos",
            },
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/topics/x/decision", headers=ADMIN_HEADERS, json={"decision": "approved"}
        ).status_code
        == 401
    )


def test_live_mode_without_keys_is_honest(client, owner_headers, eager, monkeypatch):
    from app.core.config import ProviderMode, get_settings

    monkeypatch.setattr(get_settings(), "provider_mode", ProviderMode.LIVE)
    r = client.post(
        "/api/v1/channels",
        headers=owner_headers,
        json={
            "reference": "@x",
            "authorisation_basis": "research_only",
            "authorisation_note": "research only, public videos",
        },
    )
    assert r.status_code == 503 and "YOUTUBE_API_KEY" in r.json()["error"]["message"]

    r = client.post(
        "/api/v1/research", headers=owner_headers, json={"subject": "Cash flow for traders"}
    )
    rep = client.get(
        f"/api/v1/research/reports/{r.json()['report_id']}", headers=owner_headers
    ).json()
    assert rep["status"] == "blocked" and "ANTHROPIC_API_KEY" in rep["error"]
    job = client.get(f"/api/v1/system/jobs/{rep['job_id']}", headers=owner_headers).json()
    assert job["status"] == "blocked"


def test_research_validation(client, owner_headers):
    r = client.post("/api/v1/research", headers=owner_headers, json={"subject": "abc"})
    assert r.status_code == 400
    r = client.post("/api/v1/research", headers=owner_headers, json={"episode_id": "nope"})
    assert r.status_code == 404
