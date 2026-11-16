"""Publishing (Phase 8): platform accounts, captions, scheduling, uploads, retries, auto-stop.

Safety rules enforced here:
* Only owner-approved videos are scheduled; sample videos only go to sample accounts.
* Trial period: private, unlisted or draft uploads only. Public uploads need automatic
  publishing to be unlocked (10 approved real videos) and the owner to allow them.
* One live publication per video file per destination (also a database unique index).
* An upload that may have reached the platform is never sent again automatically: an
  interrupted upload resumes its own session, and an unconfirmed one waits for the owner.
* Publishing pauses itself when a rights check, a quality check or an account permission
  fails, and stays paused until the owner resumes it.
* Tokens are stored encrypted and never logged or returned by the API.
"""

from __future__ import annotations

import hashlib
import secrets
import tempfile
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters import registry
from app.adapters.base import (
    PublisherProvider,
    PublishError,
    PublishRequest,
    TokenSet,
    Visibility,
)
from app.adapters.publishers.common import pkce_pair
from app.core import crypto
from app.core.config import ProviderMode, Settings
from app.core.errors import (
    AppError,
    BlockedByPolicyError,
    ConflictError,
    NotFoundError,
    ProviderNotConfiguredError,
)
from app.db.base import aware, utcnow
from app.models import (
    AccountStatus,
    MediaAsset,
    OAuthState,
    PlatformAccount,
    Publication,
    PublicationStatus,
    PublishAttempt,
    RenderStatus,
    Script,
    ScriptKind,
    VideoRender,
)
from app.models.publishing import REUSABLE_STATUSES
from app.services import alerts, audit, rights
from app.services import settings as settings_service
from app.services.rights import Purpose

LAGOS = timezone(timedelta(hours=1), "WAT")  # West Africa Time, no daylight saving
STATE_TTL = timedelta(minutes=15)
REFRESH_MARGIN = timedelta(minutes=5)
STALE_UPLOAD = timedelta(hours=1)
RETRY_BASE = timedelta(minutes=5)
YOUTUBE_UNITS_PER_UPLOAD = 2050
ACTIVE = (
    PublicationStatus.SCHEDULED,
    PublicationStatus.UPLOADING,
    PublicationStatus.RETRYING,
    PublicationStatus.UPLOADED,
    PublicationStatus.UNCONFIRMED,
    PublicationStatus.SIMULATED,
)
DUE = (PublicationStatus.SCHEDULED, PublicationStatus.RETRYING)
OAUTH_PROVIDERS = ("google", "meta", "tiktok")
SAMPLE_NAMES = {
    "youtube": "Sample YouTube channel",
    "facebook": "Sample Facebook Page",
    "instagram": "Sample Instagram account",
    "tiktok": "Sample TikTok account",
}


# ---------------------------------------------------------------- accounts & OAuth
def redirect_uri(settings: Settings, provider: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/accounts/callback/{provider}"


def start_connect(db: Session, provider: str, actor: str, settings: Settings) -> str:
    if provider not in OAUTH_PROVIDERS:
        raise NotFoundError("Unknown platform")
    if settings.provider_mode == ProviderMode.SAMPLE:
        raise BlockedByPolicyError(
            "Test mode: connect a sample account instead (PROVIDER_MODE=sample)"
        )
    client = registry.get_oauth(provider, settings)
    crypto.encrypt("check")  # refuse early if tokens could not be stored safely
    verifier, challenge = pkce_pair()
    state = secrets.token_urlsafe(32)
    db.add(OAuthState(state=state, provider=provider, code_verifier=verifier, created_by=actor))
    audit.record(
        db, actor=actor, action="account.connect_started", entity_type="oauth", entity_id=provider
    )
    return client.authorize_url(
        state=state, redirect_uri=redirect_uri(settings, provider), code_challenge=challenge
    )


def _expiry(seconds: int | None, now: datetime) -> datetime | None:
    return now + timedelta(seconds=int(seconds)) if seconds else None


def complete_connect(
    db: Session, provider: str, *, code: str, state: str, actor: str, settings: Settings
) -> list[PlatformAccount]:
    row = db.get(OAuthState, state)
    now = utcnow()
    if (
        row is None
        or row.provider != provider
        or row.used_at is not None
        or aware(row.created_at) < now - STATE_TTL
    ):
        raise AppError("This sign-in link is invalid or has expired. Start again.")
    row.used_at = now
    client = registry.get_oauth(provider, settings)
    try:
        tokens = client.exchange_code(
            code=code,
            redirect_uri=redirect_uri(settings, provider),
            code_verifier=row.code_verifier,
        )
        identities = client.identities(tokens)
    except PublishError as exc:
        audit.record(
            db,
            actor=actor,
            action="account.connect_failed",
            entity_type="oauth",
            entity_id=provider,
            details={"error": exc.message},
        )
        raise AppError(f"The platform refused the connection: {exc.message}") from exc
    if not identities:
        raise AppError("No channel, Page or account was found for this sign-in")
    accounts = []
    for ident in identities:
        acc = db.execute(
            select(PlatformAccount).where(
                PlatformAccount.platform == ident.platform,
                PlatformAccount.external_id == ident.external_id,
            )
        ).scalar_one_or_none()
        if acc is None:
            acc = PlatformAccount(
                platform=ident.platform,
                external_id=ident.external_id,
                oauth_provider=provider,
                display_name=ident.display_name,
                connected_by=actor,
            )
            db.add(acc)
        page_token = ident.access_token is not None
        acc.display_name = ident.display_name
        acc.access_token_enc = crypto.encrypt(ident.access_token or tokens.access_token)
        acc.refresh_token_enc = crypto.encrypt(tokens.refresh_token)
        acc.token_expires_at = _expiry(ident.expires_in if page_token else tokens.expires_in, now)
        acc.scopes = list(tokens.scopes)
        acc.status, acc.last_error, acc.is_sample = AccountStatus.CONNECTED, None, False
        acc.connected_by, acc.last_refreshed_at = actor, now
        db.flush()
        audit.record(
            db,
            actor=actor,
            action="account.connected",
            entity_type="platform_account",
            entity_id=acc.id,
            details={"platform": acc.platform, "name": acc.display_name},
        )
        accounts.append(acc)
    return accounts


def connect_sample(db: Session, platform: str, actor: str, settings: Settings) -> PlatformAccount:
    if settings.provider_mode != ProviderMode.SAMPLE:
        raise BlockedByPolicyError("Sample accounts exist only in test mode")
    if platform not in SAMPLE_NAMES:
        raise NotFoundError("Unknown platform")
    ext = f"sample-{platform}"
    acc = db.execute(
        select(PlatformAccount).where(
            PlatformAccount.platform == platform, PlatformAccount.external_id == ext
        )
    ).scalar_one_or_none()
    if acc is None:
        acc = PlatformAccount(
            platform=platform,
            oauth_provider=registry.OAUTH_FOR_PLATFORM[platform],
            external_id=ext,
            display_name=SAMPLE_NAMES[platform],
            is_sample=True,
            connected_by=actor,
        )
        db.add(acc)
    acc.status = AccountStatus.CONNECTED
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="account.sample_connected",
        entity_type="platform_account",
        entity_id=acc.id,
        details={"platform": platform},
    )
    return acc


def disconnect(db: Session, acc: PlatformAccount, actor: str) -> PlatformAccount:
    acc.status = AccountStatus.DISCONNECTED
    acc.access_token_enc = acc.refresh_token_enc = None
    acc.token_expires_at = None
    pending = db.execute(
        select(Publication).where(Publication.account_id == acc.id, Publication.status.in_(DUE))
    ).scalars()
    for pub in pending:
        pub.status, pub.error = PublicationStatus.CANCELLED, "Account disconnected"
    audit.record(
        db,
        actor=actor,
        action="account.disconnected",
        entity_type="platform_account",
        entity_id=acc.id,
        details={"platform": acc.platform},
    )
    return acc


def access_token(db: Session, acc: PlatformAccount, settings: Settings) -> str:
    """A valid access token, refreshed when close to expiry. Marks the account expired (and
    raises PublishError(auth=True)) when the platform no longer accepts it."""
    if acc.is_sample:
        return ""
    if acc.status != AccountStatus.CONNECTED or acc.access_token_enc is None:
        raise PublishError("The account is not connected", transient=False, auth=True)
    now = utcnow()
    expires = aware(acc.token_expires_at) if acc.token_expires_at else None
    if expires is None or expires - REFRESH_MARGIN > now:
        return crypto.decrypt(acc.access_token_enc) or ""
    refresh = crypto.decrypt(acc.refresh_token_enc)
    try:
        if not refresh:
            raise PublishError("The access token expired", transient=False, auth=True)
        tokens: TokenSet = registry.get_oauth(acc.oauth_provider, settings).refresh(refresh)
    except PublishError as exc:
        if exc.auth:
            mark_expired(db, acc, exc.message)
        raise
    acc.access_token_enc = crypto.encrypt(tokens.access_token)
    if tokens.refresh_token:
        acc.refresh_token_enc = crypto.encrypt(tokens.refresh_token)
    acc.token_expires_at = _expiry(tokens.expires_in, now)
    acc.last_refreshed_at, acc.last_error = now, None
    audit.record(
        db,
        actor="system",
        action="account.token_refreshed",
        entity_type="platform_account",
        entity_id=acc.id,
    )
    return tokens.access_token


def mark_expired(db: Session, acc: PlatformAccount, reason: str) -> None:
    acc.status, acc.last_error = AccountStatus.EXPIRED, reason
    audit.record(
        db,
        actor="system",
        action="account.expired",
        entity_type="platform_account",
        entity_id=acc.id,
        details={"reason": reason},
    )


# ---------------------------------------------------------------- pause / resume
def is_paused(db: Session) -> bool:
    return bool(settings_service.get_value(db, "publishing.paused"))


def pause(db: Session, reason: str, details: dict[str, Any] | None = None) -> None:
    """Automatic stop. Every upload waits until the owner resumes publishing."""
    if not is_paused(db):
        settings_service.update_setting(db, key="publishing.paused", value=True, actor="system")
    audit.record(
        db,
        actor="system",
        action="publishing.auto_paused",
        entity_type="publishing",
        entity_id="all",
        details={"reason": reason, **(details or {})},
    )
    alerts.notify(db, "publishing_paused", f"Publishing paused: {reason}", details)


def resume(db: Session, actor: str) -> None:
    settings_service.update_setting(db, key="publishing.paused", value=False, actor=actor)
    audit.record(
        db, actor=actor, action="publishing.resumed", entity_type="publishing", entity_id="all"
    )


def pause_reason(db: Session) -> str | None:
    if not is_paused(db):
        return None
    from app.models import AuditLog

    last = db.execute(
        select(AuditLog)
        .where(AuditLog.action.in_(("publishing.auto_paused", "setting.updated")))
        .where(AuditLog.entity_id.in_(("all", "publishing.paused")))
        .order_by(AuditLog.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if last is not None and last.action == "publishing.auto_paused":
        return (last.details or {}).get("reason")
    return "Paused by the owner"


# ---------------------------------------------------------------- policy
def trial_mode(db: Session) -> bool:
    return not settings_service.get_value(db, "publishing.auto_publish_enabled")


def allowed_visibilities(db: Session, publisher: PublisherProvider) -> list[str]:
    allowed = {Visibility.PRIVATE, Visibility.UNLISTED, Visibility.DRAFT}
    if not trial_mode(db) and settings_service.get_value(db, "publishing.allow_public"):
        allowed.add(Visibility.PUBLIC)
    return [v.value for v in publisher.supported_visibilities if v in allowed]


def default_visibility(db: Session, destination: str, publisher: PublisherProvider) -> str | None:
    allowed = allowed_visibilities(db, publisher)
    if not allowed:
        return None
    if destination in ("youtube", "youtube_short"):
        preferred = settings_service.get_value(db, "publishing.default_visibility")
        return preferred if preferred in allowed else allowed[0]
    return "draft" if "draft" in allowed else allowed[0]


# ---------------------------------------------------------------- captions
AI_NOTE_YO = "Olùkọ́ àti ohùn inú fídíò yìí jẹ́ ti AI."
AI_NOTE_EN = "The presenter and voice in this video are AI-generated."
EDU_NOTE = "Ẹ̀kọ́ nìkan ni, kì í ṣe ìmọ̀ràn ìnáwó. Education only, not financial advice."
TAGS = ["Yoruba", "business", "Nigeria", "Omoluabi Business Academy", "ẹ̀kọ́ òwò"]
LIMITS = {  # (title, description)
    "youtube": (100, 5000),
    "youtube_short": (100, 5000),
    "facebook_reel": (255, 2200),
    "instagram_reel": (0, 2200),
    "tiktok": (0, 2200),
}


def _clip(text: str, n: int) -> str:
    return text if len(text) <= n else text[: max(0, n - 1)].rstrip() + "…"


def captions_for(db: Session, vr: VideoRender, destination: str) -> dict[str, Any]:
    """Platform-specific title, description and tags (Yoruba first, English line, AI note)."""
    script = db.get(Script, vr.script_id)
    rev = next(r for r in script.revisions if r.number == vr.script_revision)
    teaching = [s for s in rev.segments if s.get("id") != "credit"]
    credit = next((s["text_en"] for s in rev.segments if s.get("id") == "credit"), None)
    title_yo, title_en = rev.title_yo, script.title_en
    hook = teaching[0]["text_yo"] if teaching else ""
    hashtags = "#Yoruba #Business #Nigeria" + (" #Shorts" if destination == "youtube_short" else "")
    lines = [title_yo, title_en, "", _clip(hook, 300), ""]
    if destination == "youtube":
        lines += ["Ẹ̀kọ́ iṣẹ́ òwò ní èdè Yorùbá. Practical business lessons in Yoruba.", ""]
    lines += [AI_NOTE_YO, AI_NOTE_EN, EDU_NOTE]
    if credit:
        lines += ["", credit]
    lines += ["", hashtags]
    title_max, desc_max = LIMITS[destination]
    title = ""
    if title_max:
        suffix = " #Shorts" if destination == "youtube_short" else ""
        title = _clip(title_yo, title_max - len(suffix)) + suffix
    return {
        "title": title or _clip(title_yo, 200),
        "description": _clip("\n".join(lines), desc_max),
        "tags": TAGS,
    }


# ---------------------------------------------------------------- scheduling
def _video_asset(vr: VideoRender, destination: str) -> MediaAsset:
    kind = "video_long" if destination == "youtube" else "video_vertical"
    asset = next((a for a in vr.assets if a.kind == kind), None)
    if asset is None:
        raise BlockedByPolicyError("This video has no file for that destination")
    return asset


def _active_duplicate(db: Session, destination: str, sha: str, exclude: str | None = None):
    q = select(Publication).where(
        Publication.destination == destination,
        Publication.video_sha256 == sha,
        Publication.status.not_in(REUSABLE_STATUSES),
    )
    if exclude:
        q = q.where(Publication.id != exclude)
    return db.execute(q).scalars().first()


def _rights_ok(db: Session, vr: VideoRender, platform: str, actor: str) -> list[str]:
    script = db.get(Script, vr.script_id)
    if script.kind != ScriptKind.ADAPTATION:
        return []
    try:
        rights.require_rights(
            db, script.episode_id, Purpose.PUBLISH, platform=platform, actor=actor
        )
    except BlockedByPolicyError as exc:
        return [r["code"] for r in exc.details.get("reasons", [])] or ["rights_check_failed"]
    return []


def schedule(
    db: Session,
    *,
    render_id: str,
    destination: str,
    account_id: str,
    actor: str,
    settings: Settings,
    scheduled_at: datetime | None = None,
    visibility: str | None = None,
    title: str | None = None,
    description: str | None = None,
    mode: str = "owner",
) -> Publication:
    vr = db.get(VideoRender, render_id)
    acc = db.get(PlatformAccount, account_id)
    if vr is None or acc is None:
        raise NotFoundError("Video or account not found")
    if destination not in registry.DESTINATIONS:
        raise AppError("Unknown destination")
    if vr.status != RenderStatus.APPROVED:
        raise BlockedByPolicyError("Only videos you have approved can be published")
    if not vr.platforms.get(destination):
        raise BlockedByPolicyError("This video does not fit that destination")
    if acc.platform != registry.DESTINATIONS[destination]:
        raise AppError("That account cannot publish to this destination")
    if acc.status != AccountStatus.CONNECTED:
        raise BlockedByPolicyError("Reconnect the account first")
    if acc.is_sample != vr.is_sample:
        raise BlockedByPolicyError(
            "Sample videos go only to sample accounts, and real videos only to real accounts"
        )
    publisher = registry.get_publisher(destination, sample=acc.is_sample, settings=settings)
    allowed = allowed_visibilities(db, publisher)
    visibility = visibility or default_visibility(db, destination, publisher)
    if not allowed or visibility not in allowed:
        if destination == "instagram_reel":
            raise BlockedByPolicyError(
                "Instagram can only publish publicly. It becomes available after automatic "
                "publishing is unlocked and you allow public uploads.",
                details={"allowed": allowed},
            )
        raise BlockedByPolicyError(
            "That visibility is not allowed now: trial uploads are private, unlisted or draft",
            details={"allowed": allowed},
        )
    if destination == "instagram_reel" and not acc.is_sample and not settings.public_media_base_url:
        raise ProviderNotConfiguredError(
            "Instagram needs PUBLIC_MEDIA_BASE_URL (public video hosting)"
        )
    problems = _rights_ok(db, vr, acc.platform, actor)
    if problems:
        raise BlockedByPolicyError(
            "The rights check for this platform failed", details={"reasons": problems}
        )
    asset = _video_asset(vr, destination)
    dup = _active_duplicate(db, destination, asset.sha256)
    if dup is not None:
        raise ConflictError(
            "This video is already scheduled or published there", details={"publication_id": dup.id}
        )
    text = captions_for(db, vr, destination)
    when = aware(scheduled_at) if scheduled_at else utcnow()
    if when < utcnow() - timedelta(minutes=5):
        raise AppError("Choose a time in the future")
    pub = Publication(
        render_id=vr.id,
        account_id=acc.id,
        destination=destination,
        video_asset_id=asset.id,
        video_sha256=asset.sha256,
        title=(title or text["title"]).strip()[:200],
        description=(description or text["description"]).strip(),
        tags=text["tags"],
        visibility=visibility,
        scheduled_at=when,
        approval_mode=mode,
        is_sample=acc.is_sample,
        created_by=actor,
    )
    db.add(pub)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="publication.scheduled",
        entity_type="publication",
        entity_id=pub.id,
        details={
            "render_id": vr.id,
            "destination": destination,
            "account_id": acc.id,
            "visibility": visibility,
            "scheduled_at": when.isoformat(),
            "mode": mode,
        },
    )
    return pub


def cancel(db: Session, pub: Publication, actor: str) -> Publication:
    if pub.status not in DUE:
        raise BlockedByPolicyError("Only scheduled or waiting uploads can be cancelled")
    pub.status = PublicationStatus.CANCELLED
    audit.record(
        db, actor=actor, action="publication.cancelled", entity_type="publication", entity_id=pub.id
    )
    return pub


def resolve_unconfirmed(
    db: Session, pub: Publication, *, on_platform: bool, url: str | None, actor: str
) -> Publication:
    """The owner checked the platform for an unconfirmed upload."""
    if pub.status != PublicationStatus.UNCONFIRMED:
        raise BlockedByPolicyError("This upload is not waiting for confirmation")
    if on_platform:
        pub.status, pub.published_at = PublicationStatus.UPLOADED, utcnow()
        pub.external_url = url or pub.external_url
    else:
        # Not on the platform: it may be scheduled again (a new publication).
        pub.status, pub.error = PublicationStatus.FAILED, "Owner found it was not on the platform"
    audit.record(
        db,
        actor=actor,
        action="publication.confirmed_by_owner"
        if on_platform
        else "publication.not_found_by_owner",
        entity_type="publication",
        entity_id=pub.id,
        details={"url": url},
    )
    return pub


# ---------------------------------------------------------------- dispatch
def lagos_day_start(now: datetime) -> datetime:
    local = now.astimezone(LAGOS)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)


def _sent_today(db: Session, now: datetime, platform: str | None = None) -> int:
    q = (
        select(func.count(func.distinct(PublishAttempt.publication_id)))
        .join(Publication, Publication.id == PublishAttempt.publication_id)
        .where(
            PublishAttempt.started_at >= lagos_day_start(now),
            PublishAttempt.outcome.not_in(("blocked", "deferred")),
            Publication.is_sample.is_(False),
        )
    )
    if platform:
        q = q.join(PlatformAccount, PlatformAccount.id == Publication.account_id).where(
            PlatformAccount.platform == platform
        )
    return int(db.execute(q).scalar_one())


def _attempt(db: Session, pub: Publication, outcome: str, **kw: Any) -> PublishAttempt:
    a = PublishAttempt(
        publication_id=pub.id,
        number=len(pub.attempt_log) + 1,
        outcome=outcome,
        finished_at=utcnow(),
        **kw,
    )
    pub.attempt_log.append(a)
    db.flush()
    return a


def _block(db: Session, pub: Publication, reason: str, *, stop_all: bool, code: str) -> None:
    pub.status, pub.error = PublicationStatus.BLOCKED, reason
    _attempt(db, pub, "blocked", message=reason, details={"code": code})
    audit.record(
        db,
        actor="system",
        action="publication.blocked",
        entity_type="publication",
        entity_id=pub.id,
        details={"reason": reason, "code": code},
    )
    if stop_all:
        pause(db, reason, {"publication_id": pub.id, "code": code})


def preflight(db: Session, pub: Publication, settings: Settings, storage) -> str | None:
    """Policy checks just before upload. Returns an access token, or blocks and returns None."""
    vr = db.get(VideoRender, pub.render_id)
    acc = db.get(PlatformAccount, pub.account_id)
    if (
        vr is None
        or vr.status != RenderStatus.APPROVED
        or any(c.get("blocking") and not c.get("ok") for c in vr.checks)
    ):
        _block(
            db,
            pub,
            "The video is no longer approved or failed a quality check",
            stop_all=True,
            code="quality",
        )
        return None
    asset = db.get(MediaAsset, pub.video_asset_id)
    data = storage.get(asset.storage_key) if asset else b""
    if not asset or hashlib.sha256(data).hexdigest() != pub.video_sha256:
        _block(
            db,
            pub,
            "The video file changed or is missing (quality check)",
            stop_all=True,
            code="quality",
        )
        return None
    problems = _rights_ok(db, vr, acc.platform, "system")
    if problems:
        _block(db, pub, f"Rights check failed: {', '.join(problems)}", stop_all=True, code="rights")
        return None
    if _active_duplicate(db, pub.destination, pub.video_sha256, exclude=pub.id):
        _block(
            db,
            pub,
            "Another publication of this video exists there",
            stop_all=False,
            code="duplicate",
        )
        return None
    publisher = registry.get_publisher(pub.destination, sample=acc.is_sample, settings=settings)
    if pub.visibility not in allowed_visibilities(db, publisher):
        _block(db, pub, "This visibility is no longer allowed", stop_all=False, code="visibility")
        return None
    try:
        return access_token(db, acc, settings)
    except PublishError as exc:
        if exc.auth:
            _block(
                db, pub, f"Account permission failed: {exc.message}", stop_all=True, code="account"
            )
            return None
        raise


def _files(pub: Publication, vr: VideoRender, storage, tmp: Path, settings: Settings):
    asset_by_kind = {a.kind: a for a in vr.assets}
    video = tmp / "video.mp4"
    main = next(a for a in vr.assets if a.id == pub.video_asset_id)
    video.write_bytes(storage.get(main.storage_key))
    long = pub.destination == "youtube"
    captions = thumb = None
    cap = asset_by_kind.get("captions_long_yo" if long else "captions_vertical_yo")
    if cap and pub.destination in ("youtube", "youtube_short"):
        captions = tmp / "captions.srt"
        captions.write_bytes(storage.get(cap.storage_key))
    th = asset_by_kind.get("thumbnail_long" if long else "thumbnail_vertical")
    if th and long:
        thumb = tmp / "thumbnail.png"
        thumb.write_bytes(storage.get(th.storage_key))
    url = None
    if settings.public_media_base_url:
        url = f"{settings.public_media_base_url.rstrip('/')}/{main.storage_key}"
    return video, captions, thumb, url


def process(db: Session, pub: Publication, settings: Settings, storage, now: datetime) -> None:
    acc = db.get(PlatformAccount, pub.account_id)
    if not acc.is_sample:
        limit = int(settings_service.get_value(db, "publishing.daily_limit"))
        quota = int(settings_service.get_value(db, "publishing.youtube_daily_quota_units"))
        over_daily = _sent_today(db, now) >= limit
        over_quota = acc.platform == "youtube" and (
            (_sent_today(db, now, "youtube") + 1) * YOUTUBE_UNITS_PER_UPLOAD > quota
        )
        if over_daily or over_quota:
            pub.next_attempt_at = lagos_day_start(now) + timedelta(days=1, minutes=10)
            _attempt(
                db,
                pub,
                "deferred",
                message="Daily limit reached" if over_daily else "YouTube quota",
            )
            return
    token = preflight(db, pub, settings, storage)
    if token is None:
        return
    vr = db.get(VideoRender, pub.render_id)
    publisher = registry.get_publisher(pub.destination, sample=acc.is_sample, settings=settings)
    pub.status, pub.attempts = PublicationStatus.UPLOADING, pub.attempts + 1
    attempt = PublishAttempt(publication_id=pub.id, number=len(pub.attempt_log) + 1)
    pub.attempt_log.append(attempt)
    db.commit()  # if the worker dies mid-upload, the row stays "uploading" (never re-sent)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            video, captions, thumb, url = _files(pub, vr, storage, Path(tmp), settings)
            result = publisher.upload(
                PublishRequest(
                    video_path=video,
                    title=pub.title,
                    description=pub.description,
                    tags=pub.tags,
                    visibility=Visibility(pub.visibility),
                    content_fingerprint=pub.video_sha256,
                    access_token=token,
                    account_external_id=acc.external_id,
                    captions_path=captions,
                    thumbnail_path=thumb,
                    video_url=url,
                    resume_token=pub.resume_token,
                )
            )
    except PublishError as exc:
        attempt.finished_at, attempt.http_status, attempt.message = (
            utcnow(),
            exc.http_status,
            exc.message,
        )
        if exc.resume_token:
            pub.resume_token = exc.resume_token
        pub.error = exc.message
        if exc.auth:
            attempt.outcome = "auth_error"
            mark_expired(db, acc, exc.message)
            pub.status = PublicationStatus.BLOCKED
            pause(db, f"Account permission failed: {exc.message}", {"publication_id": pub.id})
        elif exc.transient:
            max_tries = int(settings_service.get_value(db, "budget.max_retries_per_job")) + 1
            attempt.outcome = "transient_error"
            if pub.attempts < max_tries:
                pub.status = PublicationStatus.RETRYING
                pub.next_attempt_at = now + RETRY_BASE * (2 ** (pub.attempts - 1))
            else:
                pub.status = PublicationStatus.FAILED
        else:
            attempt.outcome = "permanent_error"
            pub.status = PublicationStatus.FAILED
        _log_outcome(db, pub)
        return
    except Exception as exc:  # unknown state: the video may have reached the platform
        attempt.finished_at, attempt.outcome = utcnow(), "unknown_error"
        attempt.message = type(exc).__name__
        pub.status, pub.error = (
            PublicationStatus.UNCONFIRMED,
            f"Unexpected error: {type(exc).__name__}",
        )
        _log_outcome(db, pub)
        return
    attempt.finished_at = utcnow()
    pub.external_id, pub.external_url = result.external_id, result.url
    pub.warnings, pub.resume_token, pub.error = list(result.warnings), None, None
    if result.is_sample:
        pub.status, attempt.outcome = PublicationStatus.SIMULATED, "simulated"
        attempt.message = "Sample account: nothing was sent to any platform"
    elif result.confirmed:
        pub.status, attempt.outcome = PublicationStatus.UPLOADED, "confirmed"
        pub.published_at = utcnow()
    else:
        pub.status, attempt.outcome = PublicationStatus.UNCONFIRMED, "unconfirmed"
    attempt.details = {"external_id": result.external_id, "warnings": list(result.warnings)}
    _log_outcome(db, pub)


def _log_outcome(db: Session, pub: Publication) -> None:
    audit.record(
        db,
        actor="system",
        action=f"publication.{pub.status.value}",
        entity_type="publication",
        entity_id=pub.id,
        details={
            "attempt": pub.attempts,
            "external_id": pub.external_id,
            "error": pub.error,
            "next_attempt_at": pub.next_attempt_at.isoformat() if pub.next_attempt_at else None,
        },
    )


def recheck_unconfirmed(db: Session, settings: Settings, now: datetime) -> int:
    """Ask the platform about unconfirmed uploads (verification only, never a re-upload)."""
    stale = db.execute(
        select(Publication).where(
            Publication.status == PublicationStatus.UPLOADING,
            Publication.updated_at < now - STALE_UPLOAD,
        )
    ).scalars()
    for pub in stale:
        pub.status, pub.error = PublicationStatus.UNCONFIRMED, "The upload was interrupted"
        _log_outcome(db, pub)
    confirmed = 0
    rows = db.execute(
        select(Publication).where(
            Publication.status == PublicationStatus.UNCONFIRMED,
            Publication.external_id.is_not(None),
        )
    ).scalars()
    for pub in rows:
        acc = db.get(PlatformAccount, pub.account_id)
        if acc.is_sample or acc.status != AccountStatus.CONNECTED:
            continue
        try:
            token = access_token(db, acc, settings)
        except PublishError:
            continue
        pubr = registry.get_publisher(pub.destination, sample=False, settings=settings)
        if pubr.verify(pub.external_id, token):
            pub.status, pub.published_at = PublicationStatus.UPLOADED, utcnow()
            _log_outcome(db, pub)
            confirmed += 1
    return confirmed


def run_due(db: Session, settings: Settings, storage, now: datetime | None = None) -> dict:
    now = now or utcnow()
    if is_paused(db):
        return {"paused": True, "processed": 0}
    recheck_unconfirmed(db, settings, now)
    due = (
        db.execute(
            select(Publication)
            .where(
                Publication.status.in_(DUE),
                func.coalesce(Publication.next_attempt_at, Publication.scheduled_at) <= now,
            )
            .order_by(Publication.scheduled_at)
            .limit(10)
        )
        .scalars()
        .all()
    )
    processed = 0
    for pub in due:
        if is_paused(db):  # an earlier publication in this batch may have stopped everything
            break
        process(db, pub, settings, storage, now)
        db.commit()
        processed += 1
    return {"paused": is_paused(db), "processed": processed}


# ---------------------------------------------------------------- automatic scheduling
def next_slot(db: Session, now: datetime) -> datetime:
    hour = int(settings_service.get_value(db, "publishing.auto_hour"))
    limit = int(settings_service.get_value(db, "publishing.daily_limit"))
    local = now.astimezone(LAGOS)
    day = local.replace(hour=hour, minute=0, second=0, microsecond=0)
    if day <= local:
        day += timedelta(days=1)
    for _ in range(60):
        start = day.replace(hour=0).astimezone(UTC)
        booked = db.execute(
            select(func.count())
            .select_from(Publication)
            .where(
                Publication.scheduled_at >= start,
                Publication.scheduled_at < start + timedelta(days=1),
                Publication.status.in_(ACTIVE),
                Publication.is_sample.is_(False),
            )
        ).scalar_one()
        if booked < limit:
            return (day + timedelta(minutes=15 * booked)).astimezone(UTC)
        day += timedelta(days=1)
    raise AppError("No free publishing slot in the next 60 days")


def auto_schedule(db: Session, settings: Settings, now: datetime | None = None) -> int:
    """After the unlock: schedule each approved real video to every destination it fits
    that has a connected account. Never runs during the trial period or while paused."""
    now = now or utcnow()
    if trial_mode(db) or is_paused(db):
        return 0
    created = 0
    renders = db.execute(
        select(VideoRender).where(
            VideoRender.status == RenderStatus.APPROVED, VideoRender.is_sample.is_(False)
        )
    ).scalars()
    for vr in renders:
        for destination, fits in vr.platforms.items():
            if not fits:
                continue
            taken = db.execute(
                select(Publication.id).where(
                    Publication.render_id == vr.id,
                    Publication.destination == destination,
                    Publication.status != PublicationStatus.CANCELLED,
                )
            ).first()
            if taken:
                continue
            acc = (
                db.execute(
                    select(PlatformAccount).where(
                        PlatformAccount.platform == registry.DESTINATIONS[destination],
                        PlatformAccount.status == AccountStatus.CONNECTED,
                        PlatformAccount.is_sample.is_(False),
                    )
                )
                .scalars()
                .first()
            )
            if acc is None:
                continue
            try:
                schedule(
                    db,
                    render_id=vr.id,
                    destination=destination,
                    account_id=acc.id,
                    actor="system",
                    settings=settings,
                    scheduled_at=next_slot(db, now),
                    mode="auto",
                )
                created += 1
            except (BlockedByPolicyError, ConflictError, ProviderNotConfiguredError):
                continue  # e.g. Instagram without public uploads; the owner sees why on screen
    return created
