import pytest

from app.worker.celery_app import celery_app
from tests.conftest import ADMIN_HEADERS, OWNER_PASSWORD

FULL = {
    k: True
    for k in (
        "tone_marks",
        "natural_phrasing",
        "terminology",
        "numbers_and_naira",
        "cultural_fit",
        "source_handling",
    )
}


@pytest.fixture
def eager():
    celery_app.conf.task_always_eager = True
    yield
    celery_app.conf.task_always_eager = False


@pytest.fixture
def reviewer(client, owner_headers):
    r = client.post(
        "/api/v1/users",
        headers=owner_headers,
        json={"email": "Ade@Review.ng", "display_name": "Adé Reviewer"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "ade@review.ng", "password": body["temporary_password"]},
    )
    assert login.status_code == 200
    return {
        "id": body["id"],
        "password": body["temporary_password"],
        "headers": {"Authorization": f"Bearer {login.json()['token']}"},
    }


def test_reviewer_is_limited_to_language_work(client, reviewer):
    h = reviewer["headers"]
    assert client.get("/api/v1/auth/me", headers=h).json()["role"] == "reviewer"
    for path in ("/api/v1/scripts", "/api/v1/glossary", "/api/v1/pronunciations"):
        assert client.get(path, headers=h).status_code == 200, path
    for path in (
        "/api/v1/overview",
        "/api/v1/channels",
        "/api/v1/rights/licences",
        "/api/v1/settings",
        "/api/v1/audit",
        "/api/v1/users",
    ):
        assert client.get(path, headers=h).status_code == 403, path
    r = client.put("/api/v1/settings/budget.monthly_limit_usd", headers=h, json={"value": "1"})
    assert r.status_code == 403
    r = client.post("/api/v1/scripts", headers=h, json={"kind": "original_lesson", "topic_id": "x"})
    assert r.status_code == 403


def test_deactivating_a_reviewer_ends_their_sessions(client, owner_headers, reviewer):
    r = client.patch(
        f"/api/v1/users/{reviewer['id']}", headers=owner_headers, json={"is_active": False}
    )
    assert r.json()["is_active"] is False
    assert client.get("/api/v1/scripts", headers=reviewer["headers"]).status_code == 401


def test_password_change_signs_out_other_sessions(client, owner_headers, reviewer):
    other = client.post(
        "/api/v1/auth/login", json={"email": "ade@review.ng", "password": reviewer["password"]}
    ).json()
    bad = client.put(
        "/api/v1/auth/me/password",
        headers=reviewer["headers"],
        json={"current_password": "wrong", "new_password": "New-Pass-2026x"},
    )
    assert bad.status_code == 401
    weak = client.put(
        "/api/v1/auth/me/password",
        headers=reviewer["headers"],
        json={"current_password": reviewer["password"], "new_password": "weak"},
    )
    assert weak.status_code == 400
    ok = client.put(
        "/api/v1/auth/me/password",
        headers=reviewer["headers"],
        json={"current_password": reviewer["password"], "new_password": "New-Pass-2026x"},
    )
    assert ok.status_code == 204
    assert client.get("/api/v1/auth/me", headers=reviewer["headers"]).status_code == 200
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {other['token']}"}
        ).status_code
        == 401
    )


def test_owner_cannot_be_deactivated(client, owner_headers, owner):
    r = client.patch(f"/api/v1/users/{owner.id}", headers=owner_headers, json={"is_active": False})
    assert r.status_code == 400


def _approved_topic(client, h):
    r = client.post("/api/v1/research", headers=h, json={"subject": "Pricing for market traders"})
    rep = client.get(f"/api/v1/research/reports/{r.json()['report_id']}", headers=h).json()
    topic = rep["topics"][0]
    client.post(f"/api/v1/topics/{topic['id']}/decision", headers=h, json={"decision": "approved"})
    return topic["id"]


def test_script_workflow_over_api(client, owner_headers, reviewer, eager):
    h, rh = owner_headers, reviewer["headers"]
    topic_id = _approved_topic(client, h)
    r = client.post(
        "/api/v1/scripts",
        headers=h,
        json={"kind": "original_lesson", "topic_id": topic_id, "target_minutes": 2},
    )
    assert r.status_code == 202, r.text
    sid = r.json()["script_id"]
    s = client.get(f"/api/v1/scripts/{sid}", headers=rh).json()
    assert s["status"] == "draft" and s["revision"]["number"] == 1 and s["is_sample"]
    assert "cannot judge tone accuracy" in s["quality_disclaimer"]

    # reviewer edits, owner submits, reviewer approves
    segs = s["revision"]["segments"]
    segs[0]["text_yo"] = "Ẹ káàbọ̀ sí ẹ̀kọ́ òní."
    r = client.post(
        f"/api/v1/scripts/{sid}/revisions",
        headers=rh,
        json={"title_yo": "Ẹ̀kọ́ òní", "segments": segs, "change_note": "Greeting"},
    )
    assert r.status_code == 201 and r.json()["number"] == 2
    assert client.post(f"/api/v1/scripts/{sid}/submit", headers=h).json()["status"] == "in_review"
    r = client.post(
        f"/api/v1/scripts/{sid}/reviews",
        headers=ADMIN_HEADERS,
        json={"decision": "approved", "checklist": FULL},
    )
    assert r.status_code == 401  # automation token can never approve language
    r = client.post(
        f"/api/v1/scripts/{sid}/reviews",
        headers=rh,
        json={"decision": "approved", "checklist": FULL, "comments": "Ó dára"},
    )
    s = r.json()
    assert s["status"] == "approved" and s["approved_revision"] == 2

    srt = client.get(f"/api/v1/scripts/{sid}/subtitles?lang=yo", headers=rh)
    assert srt.status_code == 200 and "Ẹ káàbọ̀ sí ẹ̀kọ́ òní." in srt.text
    assert srt.headers["content-type"].startswith("application/x-subrip")
    assert "-r2-yo.srt" in srt.headers["content-disposition"]
    txt = client.get(f"/api/v1/scripts/{sid}/text?revision=1", headers=rh)
    assert txt.status_code == 200 and "[1]" in txt.text

    full = client.get(f"/api/v1/scripts/{sid}", headers=h).json()
    assert [r["number"] for r in full["revisions"]] == [2, 1]
    assert full["reviews"][0]["reviewer"] == "reviewer:ade@review.ng"


def test_glossary_and_lexicon_api(client, reviewer):
    rh = reviewer["headers"]
    t = client.post(
        "/api/v1/glossary", headers=rh, json={"english": "Profit", "yoruba": "èrè"}
    ).json()
    assert t["status"] == "proposed"
    assert (
        client.post(f"/api/v1/glossary/{t['id']}/approve", headers=rh).json()["status"]
        == "approved"
    )
    e = client.post(
        "/api/v1/pronunciations",
        headers=rh,
        json={"written": "POS", "spoken": "pí-ó-ẹ́sì", "category": "loanword"},
    ).json()
    client.post(f"/api/v1/pronunciations/{e['id']}/approve", headers=rh)
    pls = client.get("/api/v1/pronunciations/lexicon.pls", headers=rh)
    assert pls.status_code == 200 and "pí-ó-ẹ́sì" in pls.text
    assert client.delete(f"/api/v1/glossary/{t['id']}", headers=rh).status_code == 204


def test_owner_login_still_works(client, owner):
    from tests.conftest import OWNER_EMAIL

    assert (
        client.post(
            "/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}
        ).status_code
        == 200
    )
