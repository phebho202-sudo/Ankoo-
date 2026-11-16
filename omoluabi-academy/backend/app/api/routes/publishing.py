from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import registry
from app.api.deps import UserPrincipal, require_admin, require_owner
from app.core.config import ProviderMode, get_settings
from app.core.errors import AppError, NotFoundError
from app.db.base import aware, utcnow
from app.db.session import get_db
from app.models import (
    AccountStatus,
    PlatformAccount,
    Publication,
    RenderStatus,
    Script,
    VideoRender,
)
from app.services import publishing, videos
from app.services import settings as settings_service

router = APIRouter(prefix="/api/v1", tags=["publishing"])


def _iso(dt):
    return aware(dt).astimezone(UTC).isoformat() if dt else None


def account_out(a: PlatformAccount) -> dict[str, Any]:
    # Tokens are never returned.
    return {
        "id": a.id,
        "platform": a.platform,
        "oauth_provider": a.oauth_provider,
        "external_id": a.external_id,
        "display_name": a.display_name,
        "status": a.status.value,
        "is_sample": a.is_sample,
        "scopes": a.scopes,
        "token_expires_at": _iso(a.token_expires_at),
        "has_refresh_token": a.refresh_token_enc is not None,
        "last_refreshed_at": _iso(a.last_refreshed_at),
        "last_error": a.last_error,
        "connected_by": a.connected_by,
        "created_at": _iso(a.created_at),
    }


def publication_out(db: Session, p: Publication, *, full: bool = False) -> dict[str, Any]:
    vr = db.get(VideoRender, p.render_id)
    script = db.get(Script, vr.script_id) if vr else None
    acc = db.get(PlatformAccount, p.account_id)
    out = {
        "id": p.id,
        "render_id": p.render_id,
        "lesson_title": (script.title_yo or script.title_en) if script else None,
        "destination": p.destination,
        "account": {"id": acc.id, "name": acc.display_name, "platform": acc.platform},
        "title": p.title,
        "visibility": p.visibility,
        "scheduled_at": _iso(p.scheduled_at),
        "next_attempt_at": _iso(p.next_attempt_at),
        "status": p.status.value,
        "attempts": p.attempts,
        "external_id": p.external_id,
        "external_url": p.external_url,
        "warnings": p.warnings,
        "approval_mode": p.approval_mode,
        "is_sample": p.is_sample,
        "error": p.error,
        "created_by": p.created_by,
        "published_at": _iso(p.published_at),
    }
    if full:
        out["description"] = p.description
        out["tags"] = p.tags
        out["video_sha256"] = p.video_sha256
        out["log"] = [
            {
                "number": a.number,
                "started_at": _iso(a.started_at),
                "finished_at": _iso(a.finished_at),
                "outcome": a.outcome,
                "http_status": a.http_status,
                "message": a.message,
            }
            for a in p.attempt_log
        ]
    return out


# ---------------------------------------------------------------- accounts
@router.get("/accounts")
def list_accounts(_: str = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    rows = db.execute(select(PlatformAccount).order_by(PlatformAccount.created_at)).scalars()
    return {
        "accounts": [account_out(a) for a in rows],
        "sample_mode": s.provider_mode == ProviderMode.SAMPLE,
        "oauth_configured": registry.configured_oauth(s),
        "token_encryption_configured": s.token_encryption_key is not None,
        "public_media_configured": bool(s.public_media_base_url),
        "redirect_uris": {p: publishing.redirect_uri(s, p) for p in publishing.OAUTH_PROVIDERS},
    }


@router.post("/accounts/connect/{provider}")
def connect(
    provider: str, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
):
    url = publishing.start_connect(db, provider, p.actor, get_settings())
    return {"auth_url": url}


class CallbackIn(BaseModel):
    code: str = Field(min_length=1, max_length=4000)
    state: str = Field(min_length=1, max_length=200)


@router.post("/accounts/callback/{provider}")
def callback(
    provider: str,
    body: CallbackIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db),
) -> dict:
    accounts = publishing.complete_connect(
        db, provider, code=body.code, state=body.state, actor=p.actor, settings=get_settings()
    )
    return {"accounts": [account_out(a) for a in accounts]}


@router.post("/accounts/sample/{platform}")
def connect_sample(
    platform: str, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    return account_out(publishing.connect_sample(db, platform, p.actor, get_settings()))


@router.post("/accounts/{account_id}/disconnect")
def disconnect(
    account_id: str, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    acc = db.get(PlatformAccount, account_id)
    if acc is None:
        raise NotFoundError("Account not found")
    return account_out(publishing.disconnect(db, acc, p.actor))


# ---------------------------------------------------------------- publishing
@router.get("/publishing")
def overview(_: str = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    now = utcnow()
    pubs = db.execute(
        select(Publication).order_by(Publication.scheduled_at.desc()).limit(200)
    ).scalars()
    get = lambda k: settings_service.get_value(db, k)  # noqa: E731
    return {
        "status": {
            "paused": publishing.is_paused(db),
            "pause_reason": publishing.pause_reason(db),
            "trial_mode": publishing.trial_mode(db),
            "auto_publish_enabled": bool(get("publishing.auto_publish_enabled")),
            "allow_public": bool(get("publishing.allow_public")),
            "approved_count": videos.approved_count(db),
            "required_approved": int(get("publishing.required_approved_videos")),
            "daily_limit": int(get("publishing.daily_limit")),
            "sent_today": publishing._sent_today(db, now),
        },
        "publications": [publication_out(db, p) for p in pubs],
    }


@router.get("/publishing/options/{render_id}")
def options(render_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db)):
    """What the owner can choose for one approved video: destinations, accounts, visibility."""
    vr = db.get(VideoRender, render_id)
    if vr is None:
        raise NotFoundError("Video not found")
    s = get_settings()
    out = []
    for dest, platform in registry.DESTINATIONS.items():
        accounts = db.execute(
            select(PlatformAccount).where(
                PlatformAccount.platform == platform,
                PlatformAccount.status == AccountStatus.CONNECTED,
                PlatformAccount.is_sample.is_(vr.is_sample),
            )
        ).scalars()
        try:
            pub = registry.get_publisher(dest, sample=vr.is_sample, settings=s)
            allowed = publishing.allowed_visibilities(db, pub)
            default = publishing.default_visibility(db, dest, pub)
        except AppError:
            allowed, default = [], None
        out.append(
            {
                "destination": dest,
                "fits": bool(vr.platforms.get(dest)),
                "accounts": [{"id": a.id, "name": a.display_name} for a in accounts],
                "visibilities": allowed,
                "default_visibility": default,
                "caption": publishing.captions_for(db, vr, dest),
            }
        )
    return {"render_id": vr.id, "approved": vr.status == RenderStatus.APPROVED, "destinations": out}


class ScheduleIn(BaseModel):
    render_id: str
    destination: str
    account_id: str
    scheduled_at: datetime | None = None
    visibility: str | None = None
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


@router.post("/publications", status_code=201)
def schedule(
    body: ScheduleIn, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    pub = publishing.schedule(
        db,
        render_id=body.render_id,
        destination=body.destination,
        account_id=body.account_id,
        actor=p.actor,
        settings=get_settings(),
        scheduled_at=body.scheduled_at,
        visibility=body.visibility,
        title=body.title,
        description=body.description,
    )
    return publication_out(db, pub, full=True)


@router.get("/publications/{pub_id}")
def get_publication(pub_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db)):
    pub = db.get(Publication, pub_id)
    if pub is None:
        raise NotFoundError("Publication not found")
    return publication_out(db, pub, full=True)


@router.post("/publications/{pub_id}/cancel")
def cancel(pub_id: str, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)):
    pub = db.get(Publication, pub_id)
    if pub is None:
        raise NotFoundError("Publication not found")
    return publication_out(db, publishing.cancel(db, pub, p.actor), full=True)


class ResolveIn(BaseModel):
    on_platform: bool
    url: str | None = Field(default=None, max_length=500)


@router.post("/publications/{pub_id}/resolve")
def resolve(
    pub_id: str,
    body: ResolveIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db),
):
    pub = db.get(Publication, pub_id)
    if pub is None:
        raise NotFoundError("Publication not found")
    publishing.resolve_unconfirmed(
        db, pub, on_platform=body.on_platform, url=body.url, actor=p.actor
    )
    return publication_out(db, pub, full=True)


@router.post("/publishing/pause")
def pause(p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)) -> dict:
    settings_service.update_setting(db, key="publishing.paused", value=True, actor=p.actor)
    return {"paused": True}


@router.post("/publishing/resume")
def resume(p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)) -> dict:
    publishing.resume(db, p.actor)
    return {"paused": False}


@router.post("/publishing/run", status_code=202)
def run_now(_: str = Depends(require_admin)) -> dict:
    """Send due uploads now instead of waiting for the next five-minute run."""
    from app.worker.tasks import publishing as tasks

    tasks.dispatch.delay()
    return {"queued": True}
