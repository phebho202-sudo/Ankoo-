import pytest

from app.models import RenderStatus, ScriptRevision, VideoRender
from app.services import media, render, subtitles, videos
from tests.test_roles_scripts_api import FULL, _approved_topic, reviewer  # noqa: F401 (fixture)
from tests.test_voice_api import DECL, eager  # noqa: F401 (fixture)

CHECKLIST = dict.fromkeys(videos.REVIEW_CHECKLIST, True)


def _completed_run(client, h, rh, tmp_path, *, target_minutes=4):
    """Approved presenter + approved script + completed (sample) production run."""
    client.put(
        "/api/v1/voice/presenter",
        headers=h,
        json={"name": "Olùkọ́ Adéwálé", "voice_id": "VOICE1", **DECL},
    )
    png = media.placeholder_portrait(tmp_path / "portrait.png").read_bytes()
    client.post(
        "/api/v1/voice/presenter/portrait", headers=h, files={"file": ("p.png", png, "image/png")}
    )
    client.post("/api/v1/voice/tests", headers=h)
    test = client.get("/api/v1/voice/tests", headers=h).json()["tests"][0]
    client.post(
        f"/api/v1/voice/tests/{test['id']}/rating",
        headers=rh,
        json={"ratings": dict.fromkeys(test["checks"], True)},
    )
    assert client.post("/api/v1/voice/presenter/approve", headers=h).status_code == 200
    topic_id = _approved_topic(client, h)
    sid = client.post(
        "/api/v1/scripts",
        headers=h,
        json={"kind": "original_lesson", "topic_id": topic_id, "target_minutes": target_minutes},
    ).json()["script_id"]
    client.post(f"/api/v1/scripts/{sid}/submit", headers=h)
    client.post(
        f"/api/v1/scripts/{sid}/reviews",
        headers=rh,
        json={"decision": "approved", "checklist": FULL},
    )
    r = client.post("/api/v1/voice/runs", headers=h, json={"script_id": sid})
    run = client.get(f"/api/v1/voice/runs/{r.json()['run_id']}", headers=h).json()
    assert run["status"] == "completed", run["error"]
    return sid, run


# ---------------------------------------------------------------- pure functions
def test_vertical_plan_uses_whole_short_lessons_or_an_opening_cut():
    assert videos._vertical_plan([20.0, 20.0, 20.0]) == (3, True)
    k, whole = videos._vertical_plan([20.0] * 10)
    assert (k, whole) == (2, False)  # 40 s fits under the 55 s teaser limit, 60 s does not
    assert videos._vertical_plan([90.0, 10.0]) == (1, False)  # never empty


def test_platform_eligibility_follows_format_and_length():
    e = videos.eligibility(["long", "vertical"], 600.0, 58.0)
    assert e == {
        "youtube": True,
        "youtube_short": True,
        "instagram_reel": True,
        "facebook_reel": True,
        "tiktok": True,
    }
    e = videos.eligibility(["vertical"], None, 120.0)
    assert e["youtube"] is False and e["facebook_reel"] is False and e["youtube_short"] is True


def test_caption_offset_and_vertical_line_length():
    segs = [{"text_yo": "Ẹ káàbọ̀ sí ẹ̀kọ́ òní nípa bí a ṣe ń ṣírò èrè.", "text_en": "Welcome."}]
    cues = subtitles.build_cues(segs, "yo", [4.0], offset=4.0, max_line=26)
    assert cues[0].start == 4.0 and cues[-1].end == pytest.approx(8.0)
    assert all(len(line) <= 26 for c in cues for line in c.text.split("\n"))


def test_ass_captions_use_frame_size_and_escape_overrides(tmp_path):
    cues = [subtitles.Cue(1, 0.0, 2.5, "Ẹ̀kọ́ {òní}\nlíla", 1)]
    text = render.ass_captions(cues, tmp_path / "c.ass").read_text(encoding="utf-8")
    assert "PlayResX: 1080" in text and "PlayResY: 1920" in text
    assert "DejaVu Sans" in text
    assert "Dialogue: 0,0:00:00.00,0:00:02.50,Cap,,0,0,0,,Ẹ̀kọ́ (òní)\\Nlíla" in text


# ---------------------------------------------------------------- full flow
@pytest.mark.skipif(bool(media.available()), reason="FFmpeg and DejaVu fonts are required")
def test_render_flow_over_api(client, owner_headers, reviewer, eager, tmp_path, db):  # noqa: F811
    h, rh = owner_headers, reviewer["headers"]
    sid, run = _completed_run(client, h, rh, tmp_path)

    # gate: in test mode the substance check is reported but not enforced
    cands = client.get("/api/v1/videos/candidates", headers=h).json()["candidates"]
    report = next(c for c in cands if c["run"]["id"] == run["id"])["value_report"]
    substance = next(c for c in report["checks"] if c["code"] == "enough_substance")
    assert report["passed"] is True
    assert substance["ok"] is False and substance["blocking"] is False

    assert client.get("/api/v1/videos", headers=rh).status_code == 403  # reviewers: no access
    r = client.post("/api/v1/videos", headers=h, json={"run_id": run["id"]})
    assert r.status_code == 202, r.text
    vid = r.json()["render_id"]
    v = client.get(f"/api/v1/videos/{vid}", headers=h).json()
    assert v["status"] == "awaiting_approval", v["error"]
    assert v["formats"] == ["long", "vertical"] and v["is_sample"]
    assert all(c["ok"] for c in v["checks"]), v["checks"]
    kinds = {a["kind"] for a in v["assets"]}
    assert kinds == {
        "video_long",
        "video_vertical",
        "thumbnail_long",
        "thumbnail_vertical",
        "captions_long_yo",
        "captions_long_en",
        "captions_vertical_yo",
        "captions_vertical_en",
    }
    narration = run["duration_seconds"]
    assert v["long_seconds"] == pytest.approx(
        render.INTRO_SECONDS + narration + render.OUTRO_SECONDS, abs=0.6
    )
    assert v["vertical_seconds"] <= videos.PLATFORM_RULES["facebook_reel"]["max_seconds"]
    assert v["platforms"]["youtube"] and v["platforms"]["tiktok"]

    # the long video's captions start after the intro card
    srt_id = next(a["id"] for a in v["assets"] if a["kind"] == "captions_long_yo")
    srt = client.get(f"/api/v1/media/{srt_id}", headers=h).text
    assert srt.startswith("1\n00:00:04,000 --> ")
    video_id = next(a["id"] for a in v["assets"] if a["kind"] == "video_vertical")
    clip = client.get(f"/api/v1/media/{video_id}", headers=h)
    assert clip.headers["content-type"] == "video/mp4" and clip.content[4:8] == b"ftyp"
    assert client.get(f"/api/v1/media/{video_id}", headers=rh).status_code == 403

    # the same lesson version cannot be rendered twice
    r = client.post("/api/v1/videos", headers=h, json={"run_id": run["id"]})
    assert r.status_code == 409

    # owner decision: every point must be confirmed; a rejection needs a reason
    url = f"/api/v1/videos/{vid}/decision"
    partial = {**CHECKLIST, "watched_in_full": False}
    r = client.post(url, headers=h, json={"decision": "approved", "checklist": partial})
    assert r.status_code == 422
    assert client.post(url, headers=h, json={"decision": "rejected"}).status_code == 400
    assert (
        client.post(url, headers=rh, json={"decision": "approved", "checklist": CHECKLIST})
    ).status_code == 403
    r = client.post(url, headers=h, json={"decision": "approved", "checklist": CHECKLIST})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    listing = client.get("/api/v1/videos", headers=h).json()
    assert listing["approved_count"] == 0  # sample videos never unlock automatic publishing
    db.get(VideoRender, vid).is_sample = False
    db.flush()
    assert videos.approved_count(db) == 1


@pytest.mark.skipif(bool(media.available()), reason="FFmpeg and DejaVu fonts are required")
def test_quality_failure_stops_the_video(
    client,
    owner_headers,
    reviewer,  # noqa: F811
    eager,  # noqa: F811
    tmp_path,
    monkeypatch,
):
    h, rh = owner_headers, reviewer["headers"]
    _, run = _completed_run(client, h, rh, tmp_path)
    real = render.probe
    monkeypatch.setattr(render, "probe", lambda p: {**real(p), "audio_codec": None})
    vid = client.post("/api/v1/videos", headers=h, json={"run_id": run["id"]}).json()["render_id"]
    v = client.get(f"/api/v1/videos/{vid}", headers=h).json()
    assert v["status"] == "failed" and "long_has_audio" in v["error"]
    r = client.post(
        f"/api/v1/videos/{vid}/decision",
        headers=h,
        json={"decision": "approved", "checklist": CHECKLIST},
    )
    assert r.status_code == 422  # a failed video can never be approved
    # A failed render does not block a fresh attempt at the same lesson version.
    monkeypatch.setattr(render, "probe", real)
    assert client.post("/api/v1/videos", headers=h, json={"run_id": run["id"]}).status_code == 202


def test_copied_content_fails_the_value_gate(client, owner_headers, reviewer, eager, tmp_path, db):  # noqa: F811
    h, rh = owner_headers, reviewer["headers"]
    sid, run = _completed_run(client, h, rh, tmp_path)
    rev = (
        db.query(ScriptRevision).filter_by(script_id=sid).order_by(ScriptRevision.number).all()[-1]
    )
    rev.originality = {**(rev.originality or {}), "flagged": True}
    db.flush()
    r = client.post("/api/v1/videos", headers=h, json={"run_id": run["id"]})
    assert r.status_code == 422
    assert "original_content" in r.json()["error"]["details"]["failed"]
    assert db.query(VideoRender).count() == 0
    assert RenderStatus.APPROVED.value == "approved"


def test_real_lessons_must_have_enough_substance(
    client,
    owner_headers,
    reviewer,  # noqa: F811
    eager,  # noqa: F811
    tmp_path,
    db,
):
    from app.models import ProductionRun

    _, run = _completed_run(client, owner_headers, reviewer["headers"], tmp_path)
    pr = db.get(ProductionRun, run["id"])
    pr.is_sample = False  # as if it had been voiced for real
    report = videos.value_report(db, pr)
    substance = next(c for c in report["checks"] if c["code"] == "enough_substance")
    assert report["passed"] is False and substance["blocking"] is True
    assert substance["detail"]["minimum"] == 120
    r = client.post("/api/v1/videos", headers=owner_headers, json={"run_id": run["id"]})
    assert r.status_code == 422 and "enough_substance" in r.json()["error"]["details"]["failed"]


def test_candidates_hide_lessons_that_already_have_a_video(
    client,
    owner_headers,
    reviewer,  # noqa: F811
    eager,  # noqa: F811
    tmp_path,
    monkeypatch,
):
    h = owner_headers
    sid, run = _completed_run(client, h, reviewer["headers"], tmp_path)
    # Rendering is not needed for this check: only the request is recorded.
    monkeypatch.setattr("app.api.routes.videos._enqueue", lambda *a: None)
    assert client.post("/api/v1/videos", headers=h, json={"run_id": run["id"]}).status_code == 202
    # A second narration of the same script version is the same lesson: not offered again.
    r2 = client.post("/api/v1/voice/runs", headers=h, json={"script_id": sid}).json()["run_id"]
    ids = [
        c["run"]["id"]
        for c in client.get("/api/v1/videos/candidates", headers=h).json()["candidates"]
    ]
    assert run["id"] not in ids and r2 not in ids
    assert client.post("/api/v1/videos", headers=h, json={"run_id": r2}).status_code == 409
