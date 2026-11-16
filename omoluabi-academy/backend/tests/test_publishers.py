"""Platform adapters against simulated platform servers (httpx.MockTransport)."""

import json
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.adapters.base import PublishError, PublishRequest, TokenSet, Visibility
from app.adapters.publishers import tiktok
from app.adapters.publishers.common import pkce_pair
from app.adapters.publishers.meta import (
    FacebookReelsPublisher,
    InstagramReelsPublisher,
    MetaOAuth,
)
from app.adapters.publishers.tiktok import TikTokInboxPublisher, TikTokOAuth
from app.adapters.publishers.youtube import GoogleOAuth, YouTubePublisher


def client(handler):
    calls = []

    def wrapped(request: httpx.Request):
        calls.append(request)
        return handler(request)

    return httpx.Client(transport=httpx.MockTransport(wrapped)), calls


def req(tmp_path, **kw):
    video = tmp_path / "v.mp4"
    video.write_bytes(b"0123456789" * 30)  # 300 bytes
    base = {
        "video_path": video,
        "title": "Ẹ̀kọ́ òní",
        "description": "Àpèjúwe",
        "tags": ["Yoruba"],
        "visibility": Visibility.PRIVATE,
        "content_fingerprint": "f" * 64,
        "access_token": "ACCESS",
        "account_external_id": "PAGE1",
    }
    base.update(kw)
    return PublishRequest(**base)


# ---------------------------------------------------------------- OAuth
def test_pkce_pair_is_s256():
    import base64
    import hashlib

    verifier, challenge = pkce_pair()
    assert 43 <= len(verifier) <= 128
    digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=")
    assert challenge == digest.decode()


def test_google_oauth_exchange_identities_and_refresh():
    def handler(r: httpx.Request):
        if r.url.host == "oauth2.googleapis.com":
            form = parse_qs(r.content.decode())
            if form["grant_type"] == ["authorization_code"]:
                assert form["code_verifier"] == ["VERIFIER"] and form["client_secret"] == ["SEC"]
                return httpx.Response(
                    200,
                    json={
                        "access_token": "A1",
                        "refresh_token": "R1",
                        "expires_in": 3599,
                        "scope": "s1 s2",
                    },
                )
            if form["refresh_token"] == ["REVOKED"]:
                return httpx.Response(400, json={"error": "invalid_grant"})
            return httpx.Response(200, json={"access_token": "A2", "expires_in": 3599})
        assert r.headers["authorization"] == "Bearer A1"
        return httpx.Response(
            200, json={"items": [{"id": "UC1", "snippet": {"title": "Ọmọlúàbí"}}]}
        )

    http, _ = client(handler)
    g = GoogleOAuth("CID", "SEC", http)
    url = urlparse(g.authorize_url(state="ST", redirect_uri="https://x/cb", code_challenge="CH"))
    q = parse_qs(url.query)
    assert q["access_type"] == ["offline"] and q["code_challenge_method"] == ["S256"]
    assert q["state"] == ["ST"] and "youtube.upload" in q["scope"][0]
    t = g.exchange_code(code="C", redirect_uri="https://x/cb", code_verifier="VERIFIER")
    assert (t.access_token, t.refresh_token, t.expires_in) == ("A1", "R1", 3599)
    ids = g.identities(t)
    assert ids[0].platform == "youtube" and ids[0].external_id == "UC1"
    # Google returns no new refresh token: the old one is kept.
    assert g.refresh("R1").refresh_token == "R1"
    with pytest.raises(PublishError) as e:
        g.refresh("REVOKED")
    assert e.value.auth and not e.value.transient


def test_meta_identities_include_pages_and_instagram():
    def handler(r: httpx.Request):
        path = r.url.path
        if path.endswith("oauth/access_token"):
            if "fb_exchange_token" in r.url.params:
                return httpx.Response(200, json={"access_token": "LONG", "expires_in": 5184000})
            return httpx.Response(200, json={"access_token": "SHORT"})
        assert r.url.params["access_token"] == "LONG"
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "P1",
                        "name": "Academy Page",
                        "access_token": "PAGE_TOKEN",
                        "instagram_business_account": {"id": "IG1", "username": "omoluabi"},
                    }
                ]
            },
        )

    http, _ = client(handler)
    m = MetaOAuth("APP", "SEC", "v21.0", http)
    t = m.exchange_code(code="C", redirect_uri="https://x/cb", code_verifier="")
    assert t.access_token == "LONG" and t.refresh_token is None
    ids = m.identities(t)
    assert [(i.platform, i.external_id, i.access_token) for i in ids] == [
        ("facebook", "P1", "PAGE_TOKEN"),
        ("instagram", "IG1", "PAGE_TOKEN"),
    ]
    with pytest.raises(PublishError) as e:
        m.refresh("x")
    assert e.value.auth


def test_tiktok_refresh_error_in_200_body_is_an_auth_error():
    def handler(r):
        return httpx.Response(200, json={"error": "invalid_grant", "error_description": "expired"})

    http, _ = client(handler)
    with pytest.raises(PublishError) as e:
        TikTokOAuth("K", "S", http).refresh("R")
    assert e.value.auth


# ---------------------------------------------------------------- YouTube uploads
def test_youtube_private_upload_with_captions_and_confirmation(tmp_path):
    captions = tmp_path / "c.srt"
    captions.write_text("1\n00:00:04,000 --> 00:00:06,000\nẸ̀kọ́\n", encoding="utf-8")
    thumb = tmp_path / "t.png"
    thumb.write_bytes(b"\x89PNG")
    seen = {}

    def handler(r: httpx.Request):
        if r.method == "POST" and r.url.path == "/upload/youtube/v3/videos":
            seen["meta"] = json.loads(r.content)
            assert r.headers["x-upload-content-length"] == "300"
            return httpx.Response(200, headers={"Location": "https://upload.example/session1"})
        if r.method == "PUT" and r.url.host == "upload.example":
            assert len(r.content) == 300
            return httpx.Response(200, json={"id": "VID1"})
        if r.url.path == "/upload/youtube/v3/captions":
            seen["captions"] = r.content
            return httpx.Response(200, json={"id": "CAP1"})
        if r.url.path == "/upload/youtube/v3/thumbnails/set":
            return httpx.Response(403, json={"error": {"message": "not verified"}})
        if r.url.path == "/youtube/v3/videos":
            return httpx.Response(200, json={"items": [{"id": "VID1"}]})
        raise AssertionError(r.url)

    http, _ = client(handler)
    res = YouTubePublisher(http).upload(req(tmp_path, captions_path=captions, thumbnail_path=thumb))
    assert res.confirmed and res.external_id == "VID1" and not res.is_sample
    assert res.url == "https://www.youtube.com/watch?v=VID1"
    assert res.warnings == ("thumbnail_not_set",)  # a missing thumbnail never fails the upload
    st = seen["meta"]["status"]
    assert st["privacyStatus"] == "private" and st["containsSyntheticMedia"] is True
    assert seen["meta"]["snippet"]["defaultLanguage"] == "yo"
    assert "Ẹ̀kọ́".encode() in seen["captions"]


def test_youtube_network_failure_keeps_the_session_for_resuming(tmp_path):
    def handler(r: httpx.Request):
        if r.method == "POST":
            return httpx.Response(200, headers={"Location": "https://upload.example/s2"})
        raise httpx.ConnectError("reset")

    http, _ = client(handler)
    with pytest.raises(PublishError) as e:
        YouTubePublisher(http).upload(req(tmp_path))
    assert e.value.transient and e.value.resume_token == "https://upload.example/s2"


def test_youtube_resume_continues_the_same_upload(tmp_path):
    def handler(r: httpx.Request):
        if r.method == "PUT" and r.headers.get("content-range") == "bytes */300":
            return httpx.Response(308, headers={"Range": "bytes=0-99"})
        if r.method == "PUT":
            assert r.headers["content-range"] == "bytes 100-299/300" and len(r.content) == 200
            return httpx.Response(201, json={"id": "VID2"})
        return httpx.Response(200, json={"items": [{"id": "VID2"}]})

    http, calls = client(handler)
    res = YouTubePublisher(http, short=True).upload(
        req(tmp_path, resume_token="https://upload.example/s2")
    )
    assert res.external_id == "VID2" and res.url == "https://www.youtube.com/shorts/VID2"
    assert not any(c.method == "POST" for c in calls)


def test_youtube_finished_session_is_not_uploaded_again(tmp_path):
    def handler(r: httpx.Request):
        if r.method == "PUT":
            assert r.headers.get("content-range") == "bytes */300"
            return httpx.Response(200, json={"id": "VID3"})
        return httpx.Response(200, json={"items": [{"id": "VID3"}]})

    http, calls = client(handler)
    res = YouTubePublisher(http).upload(req(tmp_path, resume_token="https://upload.example/s3"))
    assert res.external_id == "VID3" and sum(c.method == "PUT" for c in calls) == 1


@pytest.mark.parametrize(
    ("status", "body", "transient", "auth"),
    [
        (500, {"error": {"message": "backend"}}, True, False),
        (429, {"error": {"message": "slow down"}}, True, False),
        (
            403,
            {"error": {"errors": [{"reason": "quotaExceeded"}], "message": "quota"}},
            True,
            False,
        ),
        (401, {"error": {"message": "invalid credentials"}}, False, True),
        (400, {"error": {"message": "bad title"}}, False, False),
    ],
)
def test_youtube_errors_are_classified(tmp_path, status, body, transient, auth):
    http, _ = client(lambda r: httpx.Response(status, json=body))
    with pytest.raises(PublishError) as e:
        YouTubePublisher(http).upload(req(tmp_path))
    assert (e.value.transient, e.value.auth) == (transient, auth)


# ---------------------------------------------------------------- TikTok
def test_tiktok_chunk_plan_follows_the_rules():
    assert tiktok.chunk_plan(300) == [(0, 299)]
    size = 64 * 1024 * 1024 + 5
    plan = tiktok.chunk_plan(size)
    assert plan[0] == (0, tiktok.CHUNK - 1) and plan[-1][1] == size - 1
    assert len(plan) == size // tiktok.CHUNK
    assert all(b + 1 == c for (_, b), (c, _) in zip(plan, plan[1:], strict=False))


def test_tiktok_inbox_draft_upload(tmp_path):
    statuses = iter(["PROCESSING_UPLOAD", "SEND_TO_USER_INBOX"])

    def handler(r: httpx.Request):
        if r.url.path.endswith("/inbox/video/init/"):
            body = json.loads(r.content)["source_info"]
            assert body == {
                "source": "FILE_UPLOAD",
                "video_size": 300,
                "chunk_size": 300,
                "total_chunk_count": 1,
            }
            return httpx.Response(
                200,
                json={
                    "data": {"publish_id": "PUB1", "upload_url": "https://up.tiktok/x"},
                    "error": {"code": "ok"},
                },
            )
        if r.url.host == "up.tiktok":
            assert r.headers["content-range"] == "bytes 0-299/300"
            return httpx.Response(201)
        return httpx.Response(
            200, json={"data": {"status": next(statuses)}, "error": {"code": "ok"}}
        )

    http, _ = client(handler)
    pub = TikTokInboxPublisher(http, sleep=lambda s: None)
    res = pub.upload(req(tmp_path, visibility=Visibility.DRAFT))
    assert res.confirmed and res.visibility == Visibility.DRAFT and res.external_id == "PUB1"
    with pytest.raises(PublishError):
        pub.upload(req(tmp_path, visibility=Visibility.PUBLIC))  # drafts only


# ---------------------------------------------------------------- Facebook / Instagram
def test_facebook_reel_uploaded_as_draft(tmp_path):
    phases = []

    def handler(r: httpx.Request):
        if r.url.path.endswith("/video_reels"):
            form = parse_qs(r.content.decode())
            phases.append(form["upload_phase"][0])
            if form["upload_phase"] == ["start"]:
                return httpx.Response(200, json={"video_id": "FBV1"})
            assert form["video_state"] == ["DRAFT"]
            return httpx.Response(200, json={"success": True})
        if r.url.host == "rupload.facebook.com":
            assert r.headers["authorization"] == "OAuth ACCESS" and r.headers["file_size"] == "300"
            return httpx.Response(200, json={"success": True})
        return httpx.Response(200, json={"status": {"video_status": "processing"}})

    http, _ = client(handler)
    res = FacebookReelsPublisher("v21.0", http).upload(req(tmp_path, visibility=Visibility.DRAFT))
    assert res.confirmed and phases == ["start", "finish"]


def test_instagram_needs_a_public_url_and_publishes_once(tmp_path):
    pub_calls = []

    def handler(r: httpx.Request):
        if r.url.path.endswith("/media"):
            return httpx.Response(200, json={"id": "CONT1"})
        if r.url.path.endswith("/media_publish"):
            pub_calls.append(r)
            return httpx.Response(200, json={"id": "MEDIA1"})
        if r.url.path.endswith("/CONT1"):
            return httpx.Response(200, json={"status_code": "FINISHED"})
        return httpx.Response(200, json={"id": "MEDIA1"})

    http, _ = client(handler)
    ig = InstagramReelsPublisher("v21.0", http, sleep=lambda s: None)
    with pytest.raises(PublishError):
        ig.upload(req(tmp_path, visibility=Visibility.PUBLIC))
    res = ig.upload(req(tmp_path, visibility=Visibility.PUBLIC, video_url="https://cdn/x.mp4"))
    assert res.confirmed and res.external_id == "MEDIA1" and len(pub_calls) == 1


def test_token_set_defaults():
    assert TokenSet("a").refresh_token is None
