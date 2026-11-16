import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr

from app.adapters.base import ConnectedIdentity, TokenSet
from app.core import crypto
from app.core.config import ProviderMode, get_settings
from app.core.errors import AppError
from app.models import PlatformAccount
from app.services import media, publishing
from tests.test_roles_scripts_api import reviewer  # noqa: F401 (fixture)
from tests.test_video import CHECKLIST, _completed_run
from tests.test_voice_api import eager  # noqa: F401 (fixture)


@pytest.mark.skipif(bool(media.available()), reason="FFmpeg and DejaVu fonts are required")
def test_sample_publishing_flow_over_api(client, owner_headers, reviewer, eager, tmp_path):  # noqa: F811
    h, rh = owner_headers, reviewer["headers"]
    _, run = _completed_run(client, h, rh, tmp_path)
    vid = client.post("/api/v1/videos", headers=h, json={"run_id": run["id"]}).json()["render_id"]
    client.post(
        f"/api/v1/videos/{vid}/decision",
        headers=h,
        json={"decision": "approved", "checklist": CHECKLIST},
    )

    assert client.get("/api/v1/accounts", headers=rh).status_code == 403
    # Real sign-in is refused in test mode; sample accounts are offered instead.
    assert client.post("/api/v1/accounts/connect/google", headers=h).status_code == 422
    acc = client.post("/api/v1/accounts/sample/youtube", headers=h).json()
    assert acc["is_sample"] and acc["status"] == "connected"
    listing = client.get("/api/v1/accounts", headers=h).json()
    assert listing["sample_mode"] is True
    assert "access_token_enc" not in str(listing) and "refresh_token" not in listing["accounts"][0]

    opts = client.get(f"/api/v1/publishing/options/{vid}", headers=h).json()
    yt = next(d for d in opts["destinations"] if d["destination"] == "youtube")
    assert yt["fits"] and yt["accounts"][0]["id"] == acc["id"]
    assert yt["visibilities"] == ["private", "unlisted"] and yt["default_visibility"] == "private"
    ig = next(d for d in opts["destinations"] if d["destination"] == "instagram_reel")
    assert ig["visibilities"] == []  # no private mode on Instagram: unavailable in the trial

    body = {"render_id": vid, "destination": "youtube", "account_id": acc["id"]}
    assert client.post("/api/v1/publications", headers=rh, json=body).status_code == 403
    r = client.post("/api/v1/publications", headers=h, json={**body, "visibility": "public"})
    assert r.status_code == 422
    r = client.post("/api/v1/publications", headers=h, json=body)
    assert r.status_code == 201, r.text
    pub = r.json()
    assert pub["status"] == "scheduled" and pub["is_sample"]
    assert client.post("/api/v1/publications", headers=h, json=body).status_code == 409

    assert client.post("/api/v1/publishing/run", headers=h).status_code == 202
    done = client.get(f"/api/v1/publications/{pub['id']}", headers=h).json()
    assert done["status"] == "simulated" and done["external_url"] is None
    assert done["log"][0]["outcome"] == "simulated"
    assert "nothing was sent" in done["log"][0]["message"]
    # A simulated upload never reached a platform, so it does not block a later attempt.
    assert client.post("/api/v1/publications", headers=h, json=body).status_code == 201
    status = client.get("/api/v1/publishing", headers=h).json()["status"]
    assert status["trial_mode"] and not status["paused"] and status["sent_today"] == 0

    assert client.post("/api/v1/publishing/pause", headers=h).json() == {"paused": True}
    st = client.get("/api/v1/publishing", headers=h).json()["status"]
    assert st["paused"] and st["pause_reason"] == "Paused by the owner"
    assert client.post("/api/v1/publishing/resume", headers=h).json() == {"paused": False}


class FakeOAuth:
    provider = "google"

    def exchange_code(self, *, code, redirect_uri, code_verifier):
        assert code == "CODE" and len(code_verifier) >= 43
        return TokenSet("ACCESS", "REFRESH", 3600, ("youtube.upload",))

    def identities(self, tokens):
        return [ConnectedIdentity("youtube", "UC123", "Ọmọlúàbí Academy")]

    def authorize_url(self, *, state, redirect_uri, code_challenge):
        return f"https://accounts.example/auth?state={state}&redirect_uri={redirect_uri}"


def test_oauth_connect_validates_state_and_encrypts_tokens(db, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "provider_mode", ProviderMode.LIVE)
    monkeypatch.setattr(s, "token_encryption_key", SecretStr(Fernet.generate_key().decode()))
    monkeypatch.setattr(publishing.registry, "get_oauth", lambda p, st: FakeOAuth())
    url = publishing.start_connect(db, "google", "owner", s)
    state = url.split("state=")[1].split("&")[0]
    assert "/accounts/callback/google" in url
    with pytest.raises(AppError):
        publishing.complete_connect(
            db, "google", code="CODE", state="forged", actor="o", settings=s
        )
    with pytest.raises(AppError):  # the state belongs to another provider
        publishing.complete_connect(db, "tiktok", code="CODE", state=state, actor="o", settings=s)
    [acc] = publishing.complete_connect(
        db, "google", code="CODE", state=state, actor="owner", settings=s
    )
    assert acc.platform == "youtube" and acc.external_id == "UC123" and not acc.is_sample
    assert "ACCESS" not in acc.access_token_enc and crypto.decrypt(acc.access_token_enc) == "ACCESS"
    assert crypto.decrypt(acc.refresh_token_enc) == "REFRESH"
    with pytest.raises(AppError):  # a state can be used once
        publishing.complete_connect(db, "google", code="CODE", state=state, actor="o", settings=s)
    # Reconnecting updates the same account instead of creating a duplicate.
    url2 = publishing.start_connect(db, "google", "owner", s)
    publishing.complete_connect(
        db,
        "google",
        code="CODE",
        state=url2.split("state=")[1].split("&")[0],
        actor="o",
        settings=s,
    )
    assert db.query(PlatformAccount).count() == 1


def test_connect_refuses_without_an_encryption_key(db, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "provider_mode", ProviderMode.LIVE)
    monkeypatch.setattr(s, "token_encryption_key", None)
    monkeypatch.setattr(publishing.registry, "get_oauth", lambda p, st: FakeOAuth())
    from app.core.errors import ProviderNotConfiguredError

    with pytest.raises(ProviderNotConfiguredError):
        publishing.start_connect(db, "google", "owner", s)


def test_live_connect_needs_oauth_app_credentials(client, owner_headers, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "provider_mode", ProviderMode.LIVE)
    r = client.post("/api/v1/accounts/connect/google", headers=owner_headers)
    assert r.status_code == 503 and "GOOGLE_CLIENT_ID" in r.json()["error"]["message"]
