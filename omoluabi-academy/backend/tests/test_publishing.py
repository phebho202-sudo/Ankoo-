"""Publishing service: scheduling policy, duplicates, retries, auto-stop, token refresh, unlock."""

import hashlib
from datetime import timedelta

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy.exc import IntegrityError

from app.adapters.base import PublishError, PublishResult, TokenSet, Visibility
from app.adapters.storage.local import LocalStorage
from app.core import crypto
from app.core.config import get_settings
from app.core.errors import BlockedByPolicyError, ConflictError
from app.db.base import utcnow
from app.models import (
    AccountStatus,
    AuditLog,
    MediaAsset,
    PlatformAccount,
    PresenterProfile,
    ProductionRun,
    Publication,
    PublicationStatus,
    RenderStatus,
    RunStatus,
    Script,
    ScriptFormat,
    ScriptKind,
    ScriptRevision,
    ScriptStatus,
    VideoRender,
)
from app.services import publishing
from app.services import settings as settings_service

ACTOR = "owner@omoluabi.test"
ALL_FIT = dict.fromkeys(
    ("youtube", "youtube_short", "instagram_reel", "facebook_reel", "tiktok"), True
)


@pytest.fixture
def env(tmp_path, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "local_storage_path", str(tmp_path / "media"))
    monkeypatch.setattr(s, "token_encryption_key", SecretStr(Fernet.generate_key().decode()))
    return s


@pytest.fixture
def storage(env):
    return LocalStorage(env.local_storage_path)


def make_render(db, storage, *, sample=False, n=1, kind=ScriptKind.ORIGINAL) -> VideoRender:
    script = Script(
        kind=kind,
        format=ScriptFormat.LONG,
        status=ScriptStatus.APPROVED,
        title_en=f"Pricing lesson {n}",
        title_yo=f"Ẹ̀kọ́ iye owó {n}",
        current_revision=1,
        approved_revision=1,
        is_sample=sample,
        created_by=ACTOR,
    )
    db.add(script)
    db.flush()
    db.add(
        ScriptRevision(
            script_id=script.id,
            number=1,
            origin="human",
            title_yo=f"Ẹ̀kọ́ iye owó {n}",
            segments=[{"id": "s1", "text_yo": "Ṣírò iye owó rẹ.", "text_en": "Count your cost."}],
            created_by=ACTOR,
        )
    )
    p = PresenterProfile(name="Olùkọ́", updated_by=ACTOR)
    db.add(p)
    db.flush()
    run = ProductionRun(
        script_id=script.id,
        script_revision=1,
        presenter_id=p.id,
        voice_config_hash="h",
        status=RunStatus.COMPLETED,
        requested_by=ACTOR,
    )
    db.add(run)
    db.flush()
    vr = VideoRender(
        run_id=run.id,
        script_id=script.id,
        script_revision=1,
        fingerprint=hashlib.sha256(f"{script.id}".encode()).hexdigest(),
        status=RenderStatus.APPROVED,
        formats=["long", "vertical"],
        platforms=dict(ALL_FIT),
        is_sample=sample,
        requested_by=ACTOR,
    )
    db.add(vr)
    db.flush()
    for kind_ in ("video_long", "video_vertical"):
        data = f"{kind_}-{vr.id}".encode()
        key = f"renders/{vr.id}/{kind_}.mp4"
        storage.put(key, data, "video/mp4")
        vr.assets.append(
            MediaAsset(
                kind=kind_,
                storage_key=key,
                mime_type="video/mp4",
                size_bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest(),
            )
        )
    db.flush()
    return vr


def make_account(db, platform="youtube", *, sample=False, expires_in=3600, refresh="R1"):
    acc = PlatformAccount(
        platform=platform,
        oauth_provider={"youtube": "google", "tiktok": "tiktok"}.get(platform, "meta"),
        external_id=f"{platform}-ext-{'s' if sample else 'r'}",
        display_name=f"{platform} account",
        is_sample=sample,
        connected_by=ACTOR,
        access_token_enc=None if sample else crypto.encrypt("ACCESS1"),
        refresh_token_enc=None if sample or refresh is None else crypto.encrypt(refresh),
        token_expires_at=utcnow() + timedelta(seconds=expires_in) if expires_in else None,
    )
    db.add(acc)
    db.flush()
    return acc


class FakePublisher:
    """Programmable platform: a list of outcomes, one per upload call."""

    supported_visibilities = (Visibility.PRIVATE, Visibility.UNLISTED, Visibility.PUBLIC)
    is_sample = False

    def __init__(self, outcomes, verify_result=False):
        self.outcomes = list(outcomes)
        self.requests = []
        self.verify_result = verify_result
        self.verified = []

    def upload(self, request):
        self.requests.append(request)
        out = self.outcomes.pop(0)
        if isinstance(out, Exception):
            raise out
        return PublishResult(
            "youtube", out, f"https://youtu.be/{out}", request.visibility, True, False
        )

    def verify(self, external_id, token):
        self.verified.append(external_id)
        return self.verify_result


def use_publisher(monkeypatch, pub):
    from app.adapters import registry

    real = registry.get_publisher

    def fake(destination, *, sample, settings):
        return real(destination, sample=True, settings=settings) if sample else pub

    monkeypatch.setattr(publishing.registry, "get_publisher", fake)


def sched(db, env, vr, acc, destination="youtube", **kw):
    return publishing.schedule(
        db,
        render_id=vr.id,
        destination=destination,
        account_id=acc.id,
        actor=ACTOR,
        settings=env,
        **kw,
    )


# ---------------------------------------------------------------- scheduling policy
def test_trial_period_allows_only_private_unlisted_or_draft(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher([]))
    vr, acc = make_render(db, storage), make_account(db)
    with pytest.raises(BlockedByPolicyError) as e:
        sched(db, env, vr, acc, visibility="public")
    assert e.value.details["allowed"] == ["private", "unlisted"]
    pub = sched(db, env, vr, acc)
    assert pub.visibility == "private" and pub.status == PublicationStatus.SCHEDULED
    assert "AI" in pub.description and "Ẹ̀kọ́ iye owó 1" in pub.title


def test_only_approved_videos_and_matching_accounts(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher([]))
    vr = make_render(db, storage)
    sample_acc = make_account(db, sample=True)
    with pytest.raises(BlockedByPolicyError):
        sched(db, env, vr, sample_acc)  # a real video never goes to a sample account
    acc = make_account(db)
    vr.status = RenderStatus.AWAITING_APPROVAL
    with pytest.raises(BlockedByPolicyError):
        sched(db, env, vr, acc)
    vr.status = RenderStatus.APPROVED
    vr.platforms = {**ALL_FIT, "youtube": False}
    with pytest.raises(BlockedByPolicyError):
        sched(db, env, vr, acc)


def test_instagram_is_blocked_during_the_trial(db, env, storage):
    vr = make_render(db, storage, sample=True)
    acc = make_account(db, "instagram", sample=True)
    with pytest.raises(BlockedByPolicyError) as e:
        sched(db, env, vr, acc, destination="instagram_reel")
    assert "Instagram can only publish publicly" in e.value.message


def test_platform_specific_captions(db, env, storage):
    vr = make_render(db, storage)
    short = publishing.captions_for(db, vr, "youtube_short")
    assert short["title"].endswith("#Shorts") and len(short["title"]) <= 100
    tiktok = publishing.captions_for(db, vr, "tiktok")
    assert len(tiktok["description"]) <= 2200 and "#Yoruba" in tiktok["description"]
    assert "Education only, not financial advice" in tiktok["description"]


# ---------------------------------------------------------------- duplicates
def test_duplicate_upload_prevention(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher([]))
    vr, acc = make_render(db, storage), make_account(db)
    first = sched(db, env, vr, acc)
    with pytest.raises(ConflictError):
        sched(db, env, vr, acc)
    publishing.cancel(db, first, ACTOR)
    second = sched(db, env, vr, acc)  # a cancelled one never reached the platform
    assert second.id != first.id
    # The database refuses a second live publication of the same file, whatever the code does.
    db.add(
        Publication(
            render_id=vr.id,
            account_id=acc.id,
            destination="youtube",
            video_asset_id=second.video_asset_id,
            video_sha256=second.video_sha256,
            title="x",
            description="x",
            visibility="private",
            scheduled_at=utcnow(),
            created_by=ACTOR,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


# ---------------------------------------------------------------- uploads, retries
def test_confirmed_upload_is_logged(db, env, storage, monkeypatch):
    pub_api = FakePublisher(["VID1"])
    use_publisher(monkeypatch, pub_api)
    vr, acc = make_render(db, storage), make_account(db)
    pub = sched(db, env, vr, acc)
    assert publishing.run_due(db, env, storage) == {"paused": False, "processed": 1}
    assert pub.status == PublicationStatus.UPLOADED and pub.external_id == "VID1"
    assert pub.attempt_log[-1].outcome == "confirmed" and pub.published_at is not None
    req = pub_api.requests[0]
    assert req.access_token == "ACCESS1" and req.visibility == Visibility.PRIVATE
    assert req.content_fingerprint == pub.video_sha256
    assert db.query(AuditLog).filter_by(action="publication.uploaded").count() == 1


def test_publishing_retries_with_backoff_and_resumes_the_same_upload(db, env, storage, monkeypatch):
    session = "https://upload.example/session"
    pub_api = FakePublisher(
        [
            PublishError("network", transient=True, resume_token=session),
            PublishError("503", transient=True, http_status=503),
            "VID9",
        ]
    )
    use_publisher(monkeypatch, pub_api)
    pub = sched(db, env, make_render(db, storage), make_account(db))
    now = utcnow()
    publishing.run_due(db, env, storage, now)
    assert pub.status == PublicationStatus.RETRYING and pub.attempts == 1
    first_wait = pub.next_attempt_at - now
    assert timedelta(minutes=4) < first_wait <= timedelta(minutes=6)
    assert publishing.run_due(db, env, storage, now)["processed"] == 0  # not due yet
    publishing.run_due(db, env, storage, now + timedelta(minutes=6))
    assert pub.status == PublicationStatus.RETRYING and pub.attempts == 2
    assert pub.next_attempt_at - (now + timedelta(minutes=6)) > timedelta(minutes=9)  # doubled
    publishing.run_due(db, env, storage, now + timedelta(minutes=30))
    assert pub.status == PublicationStatus.UPLOADED and pub.external_id == "VID9"
    # Every retry continued the interrupted upload session instead of starting a new upload.
    assert [r.resume_token for r in pub_api.requests] == [None, session, session]
    assert [a.outcome for a in pub.attempt_log] == [
        "transient_error",
        "transient_error",
        "confirmed",
    ]


def test_retries_stop_at_the_configured_limit(db, env, storage, monkeypatch):
    settings_service.update_setting(db, key="budget.max_retries_per_job", value=1, actor=ACTOR)
    use_publisher(monkeypatch, FakePublisher([PublishError("x", transient=True)] * 2))
    pub = sched(db, env, make_render(db, storage), make_account(db))
    now = utcnow()
    publishing.run_due(db, env, storage, now)
    publishing.run_due(db, env, storage, now + timedelta(hours=1))
    assert pub.status == PublicationStatus.FAILED and pub.attempts == 2


def test_permanent_error_is_not_retried(db, env, storage, monkeypatch):
    pub_api = FakePublisher([PublishError("bad title", transient=False, http_status=400)])
    use_publisher(monkeypatch, pub_api)
    pub = sched(db, env, make_render(db, storage), make_account(db))
    publishing.run_due(db, env, storage)
    publishing.run_due(db, env, storage, utcnow() + timedelta(hours=2))
    assert pub.status == PublicationStatus.FAILED and len(pub_api.requests) == 1


def test_unconfirmed_upload_is_never_sent_again(db, env, storage, monkeypatch):
    class Unconfirmed(FakePublisher):
        def upload(self, request):
            self.requests.append(request)
            return PublishResult("youtube", "VIDX", None, request.visibility, False, False)

    pub_api = Unconfirmed([])
    use_publisher(monkeypatch, pub_api)
    pub = sched(db, env, make_render(db, storage), make_account(db))
    publishing.run_due(db, env, storage)
    assert pub.status == PublicationStatus.UNCONFIRMED
    publishing.run_due(db, env, storage, utcnow() + timedelta(hours=3))
    assert len(pub_api.requests) == 1 and pub_api.verified == ["VIDX"]  # checked, not re-sent
    pub_api.verify_result = True
    publishing.run_due(db, env, storage)
    assert pub.status == PublicationStatus.UPLOADED


def test_owner_resolves_an_unconfirmed_upload(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher([RuntimeError("worker crashed")]))
    vr, acc = make_render(db, storage), make_account(db)
    pub = sched(db, env, vr, acc)
    publishing.run_due(db, env, storage)
    assert pub.status == PublicationStatus.UNCONFIRMED  # unknown state is never retried
    with pytest.raises(ConflictError):
        sched(db, env, vr, acc)  # nor scheduled again while it may be on the platform
    publishing.resolve_unconfirmed(db, pub, on_platform=False, url=None, actor=ACTOR)
    assert sched(db, env, vr, acc).status == PublicationStatus.SCHEDULED


def test_daily_limit_defers_to_the_next_day(db, env, storage, monkeypatch):
    settings_service.update_setting(db, key="publishing.daily_limit", value=1, actor=ACTOR)
    use_publisher(monkeypatch, FakePublisher(["V1", "V2"]))
    acc = make_account(db)
    a = sched(db, env, make_render(db, storage, n=1), acc)
    b = sched(db, env, make_render(db, storage, n=2), acc)
    publishing.run_due(db, env, storage)
    assert a.status == PublicationStatus.UPLOADED
    assert b.status == PublicationStatus.SCHEDULED and b.next_attempt_at > utcnow()
    assert b.attempt_log[-1].outcome == "deferred"


# ---------------------------------------------------------------- automatic stop
def test_quality_failure_pauses_all_publishing(db, env, storage, monkeypatch):
    pub_api = FakePublisher(["V1", "V2"])
    use_publisher(monkeypatch, pub_api)
    acc = make_account(db)
    vr1, vr2 = make_render(db, storage, n=1), make_render(db, storage, n=2)
    p1, p2 = sched(db, env, vr1, acc), sched(db, env, vr2, acc)
    # The approved file was changed after approval.
    storage.put(vr1.assets[0].storage_key, b"tampered", "video/mp4")
    publishing.run_due(db, env, storage)
    assert p1.status == PublicationStatus.BLOCKED and "quality" in p1.error
    assert publishing.is_paused(db) and "quality check" in publishing.pause_reason(db)
    assert p2.status == PublicationStatus.SCHEDULED and pub_api.requests == []
    assert publishing.run_due(db, env, storage) == {"paused": True, "processed": 0}
    assert db.query(AuditLog).filter_by(action="alert.publishing_paused").count() == 1
    publishing.resume(db, ACTOR)
    publishing.run_due(db, env, storage)
    assert p2.status == PublicationStatus.UPLOADED


def test_rights_failure_pauses_publishing(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher(["V1"]))
    vr = make_render(db, storage)
    pub = sched(db, env, vr, make_account(db))
    monkeypatch.setattr(publishing, "_rights_ok", lambda *a: ["licence_expired"])
    publishing.run_due(db, env, storage)
    assert pub.status == PublicationStatus.BLOCKED and "licence_expired" in pub.error
    assert publishing.is_paused(db)


# ---------------------------------------------------------------- OAuth token refresh
class FakeOAuth:
    def __init__(self, result):
        self.result, self.calls = result, []

    def refresh(self, refresh_token):
        self.calls.append(refresh_token)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def test_oauth_token_refresh_before_expiry(db, env, storage, monkeypatch):
    oauth = FakeOAuth(TokenSet("ACCESS2", None, 3600))
    monkeypatch.setattr(publishing.registry, "get_oauth", lambda p, s: oauth)
    pub_api = FakePublisher(["V1"])
    use_publisher(monkeypatch, pub_api)
    acc = make_account(db, expires_in=60)  # inside the 5-minute margin
    sched(db, env, make_render(db, storage), acc)
    publishing.run_due(db, env, storage)
    assert oauth.calls == ["R1"] and pub_api.requests[0].access_token == "ACCESS2"
    assert crypto.decrypt(acc.access_token_enc) == "ACCESS2"
    assert crypto.decrypt(acc.refresh_token_enc) == "R1"  # kept when none is returned
    assert "ACCESS2" not in (acc.access_token_enc or "")  # stored encrypted
    assert acc.token_expires_at > utcnow() + timedelta(minutes=50)


def test_expired_permission_marks_the_account_and_pauses(db, env, storage, monkeypatch):
    oauth = FakeOAuth(PublishError("invalid_grant", transient=False, auth=True))
    monkeypatch.setattr(publishing.registry, "get_oauth", lambda p, s: oauth)
    pub_api = FakePublisher(["V1"])
    use_publisher(monkeypatch, pub_api)
    acc = make_account(db, expires_in=10)
    pub = sched(db, env, make_render(db, storage), acc)
    publishing.run_due(db, env, storage)
    assert acc.status == AccountStatus.EXPIRED and pub.status == PublicationStatus.BLOCKED
    assert publishing.is_paused(db) and pub_api.requests == []


def test_token_refused_during_upload_stops_publishing(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher([PublishError("401", transient=False, auth=True)]))
    acc = make_account(db)
    pub = sched(db, env, make_render(db, storage), acc)
    publishing.run_due(db, env, storage)
    assert acc.status == AccountStatus.EXPIRED and pub.status == PublicationStatus.BLOCKED
    assert publishing.is_paused(db)


# ---------------------------------------------------------------- unlock and automation
def _approve_ten(db, storage):
    return [make_render(db, storage, n=i) for i in range(10)]


def test_auto_publish_unlocks_only_after_ten_approved_real_videos(db, env, storage):
    with pytest.raises(BlockedByPolicyError) as e:
        settings_service.update_setting(
            db, key="publishing.auto_publish_enabled", value=True, actor=ACTOR
        )
    assert set(e.value.details["missing"]) == {"approved_videos", "connected_account"}
    for i in range(10):
        make_render(db, storage, n=i, sample=True)  # sample videos never count
    make_account(db)
    with pytest.raises(BlockedByPolicyError) as e:
        settings_service.update_setting(
            db, key="publishing.auto_publish_enabled", value=True, actor=ACTOR
        )
    assert e.value.details["missing"] == ["approved_videos"]
    with pytest.raises(BlockedByPolicyError):
        settings_service.update_setting(db, key="publishing.allow_public", value=True, actor=ACTOR)
    _approve_ten(db, storage)
    settings_service.update_setting(
        db, key="publishing.auto_publish_enabled", value=True, actor=ACTOR
    )
    settings_service.update_setting(db, key="publishing.allow_public", value=True, actor=ACTOR)
    assert publishing.trial_mode(db) is False
    settings_service.update_setting(
        db, key="publishing.auto_publish_enabled", value=False, actor=ACTOR
    )
    assert settings_service.get_value(db, "publishing.allow_public") is False


def test_auto_schedule_does_nothing_in_the_trial(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher([]))
    make_render(db, storage)
    make_account(db)
    assert publishing.auto_schedule(db, env) == 0


def test_auto_schedule_after_unlock(db, env, storage, monkeypatch):
    use_publisher(monkeypatch, FakePublisher([]))
    renders = _approve_ten(db, storage)
    make_account(db)
    settings_service.update_setting(
        db, key="publishing.auto_publish_enabled", value=True, actor=ACTOR
    )
    created = publishing.auto_schedule(db, env)
    # Each video fits both YouTube destinations; one account exists for them.
    assert created == 20
    pubs = db.query(Publication).all()
    assert all(p.approval_mode == "auto" and p.visibility == "private" for p in pubs)
    per_day = {}
    for p in pubs:
        day = p.scheduled_at.astimezone(publishing.LAGOS).date()
        per_day[day] = per_day.get(day, 0) + 1
    assert max(per_day.values()) <= 3  # the daily limit spreads them over days
    assert all(p.scheduled_at.astimezone(publishing.LAGOS).hour == 18 for p in pubs)
    assert publishing.auto_schedule(db, env) == 0  # nothing is scheduled twice
    assert len(renders) == 10
