import pytest

from app.services import media
from app.worker.celery_app import celery_app
from tests.test_roles_scripts_api import FULL, _approved_topic, reviewer  # noqa: F401 (fixture)

DECL = {
    "voice_is_original_or_licensed": True,
    "portrait_is_original_or_licensed": True,
    "not_a_real_person": True,
}


@pytest.fixture
def eager(tmp_path, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "local_storage_path", str(tmp_path / "media"))
    celery_app.conf.task_always_eager = True
    yield
    celery_app.conf.task_always_eager = False


def test_voice_flow_over_api(client, owner_headers, reviewer, eager, tmp_path):  # noqa: F811
    h, rh = owner_headers, reviewer["headers"]
    # presenter
    assert client.put("/api/v1/voice/presenter", headers=rh, json={"name": "x"}).status_code == 403
    r = client.put(
        "/api/v1/voice/presenter",
        headers=h,
        json={"name": "Olùkọ́ Adéwálé", "voice_id": "VOICE1", **DECL},
    )
    pres = r.json()["presenter"]
    assert pres["status"] == "draft" and pres["problems"] == ["pronunciation_test_not_passed"]
    bad = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32  # right header, not a real image
    r = client.post(
        "/api/v1/voice/presenter/portrait", headers=h, files={"file": ("p.png", bad, "image/png")}
    )
    assert r.status_code == 400  # refused up front instead of breaking a later render
    png = media.placeholder_portrait(tmp_path / "portrait.png").read_bytes()
    r = client.post(
        "/api/v1/voice/presenter/portrait", headers=h, files={"file": ("p.png", png, "image/png")}
    )
    assert r.status_code == 200, r.json()
    assert r.json()["presenter"]["has_portrait"] is True
    assert client.get("/api/v1/voice/presenter/portrait", headers=rh).content == png

    # pronunciation test: owner requests, reviewer listens and rates
    r = client.post("/api/v1/voice/tests", headers=h)
    assert r.status_code == 202
    test = client.get("/api/v1/voice/tests", headers=rh).json()["tests"][0]
    assert test["status"] == "awaiting_review" and test["is_sample"]
    audio = client.get(f"/api/v1/media/{test['audio_asset_id']}", headers=rh)
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"
    part = client.get(
        f"/api/v1/media/{test['audio_asset_id']}", headers={**rh, "Range": "bytes=0-99"}
    )
    assert part.status_code == 206 and len(part.content) == 100  # players can seek
    r = client.post(
        f"/api/v1/voice/tests/{test['id']}/rating",
        headers=rh,
        json={"ratings": dict.fromkeys(test["checks"], True), "notes": "Ó dára"},
    )
    assert r.json()["status"] == "passed"
    pres = client.post("/api/v1/voice/presenter/approve", headers=h).json()["presenter"]
    assert pres["status"] == "approved"

    # approved script -> production
    topic_id = _approved_topic(client, h)
    sid = client.post(
        "/api/v1/scripts",
        headers=h,
        json={"kind": "original_lesson", "topic_id": topic_id, "target_minutes": 1},
    ).json()["script_id"]
    client.post(f"/api/v1/scripts/{sid}/submit", headers=h)
    client.post(
        f"/api/v1/scripts/{sid}/reviews",
        headers=rh,
        json={"decision": "approved", "checklist": FULL},
    )
    assert client.post("/api/v1/voice/runs", headers=rh, json={"script_id": sid}).status_code == 403
    r = client.post("/api/v1/voice/runs", headers=h, json={"script_id": sid})
    assert r.status_code == 202, r.text
    run = client.get(f"/api/v1/voice/runs/{r.json()['run_id']}", headers=rh).json()
    assert run["status"] == "completed", run["error"]
    kinds = {a["kind"] for a in run["assets"]}
    assert {
        "narration",
        "waveform",
        "captions_yo",
        "captions_en",
        "slide",
        "presenter_clip",
    } <= kinds
    clip = next(a for a in run["assets"] if a["kind"] == "presenter_clip")
    v = client.get(f"/api/v1/media/{clip['id']}", headers=rh)
    assert v.headers["content-type"] == "video/mp4" and v.content[4:8] == b"ftyp"
    r = client.post(
        "/api/v1/voice/runs", headers=h, json={"script_id": sid, "video_format": "full_avatar"}
    )
    assert r.status_code == 422


def test_media_needs_login(client):
    assert client.get("/api/v1/media/x").status_code == 401
