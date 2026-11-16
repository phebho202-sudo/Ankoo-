from __future__ import annotations

from datetime import UTC
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import UserPrincipal, require_admin, require_owner
from app.api.routes.voice import asset_out, run_out
from app.core.errors import NotFoundError
from app.db.base import aware
from app.db.session import get_db
from app.models import Script, VideoRender
from app.services import settings as settings_service
from app.services import videos

router = APIRouter(prefix="/api/v1", tags=["video production"])


def _iso(dt):
    return aware(dt).astimezone(UTC).isoformat() if dt else None


def render_out(db: Session, vr: VideoRender, *, full: bool = False) -> dict[str, Any]:
    script = db.get(Script, vr.script_id)
    out = {
        "id": vr.id,
        "run_id": vr.run_id,
        "script_id": vr.script_id,
        "script_revision": vr.script_revision,
        "title_en": script.title_en if script else None,
        "title_yo": script.title_yo if script else None,
        "status": vr.status.value,
        "formats": vr.formats,
        "platforms": vr.platforms,
        "long_seconds": vr.long_seconds,
        "vertical_seconds": vr.vertical_seconds,
        "vertical_is_full": vr.vertical_is_full,
        "is_sample": vr.is_sample,
        "error": vr.error,
        "job_id": vr.job_id,
        "requested_by": vr.requested_by,
        "decided_by": vr.decided_by,
        "decided_at": _iso(vr.decided_at),
        "decision_notes": vr.decision_notes,
        "created_at": _iso(vr.created_at),
        "finished_at": _iso(vr.finished_at),
    }
    if full:
        out["value_report"] = vr.value_report
        out["checks"] = vr.checks
        out["review_checklist"] = vr.review_checklist
        out["checklist_items"] = list(videos.REVIEW_CHECKLIST)
        out["assets"] = [asset_out(a) for a in vr.assets]
    return out


def _enqueue(job_id: str, render_id: str) -> None:
    from app.worker.tasks import video as tasks

    tasks.render.delay(job_id, render_id)


@router.get("/videos")
def list_videos(
    _: str = Depends(require_admin), db: Session = Depends(get_db, scope="function")
) -> dict:
    rows = db.execute(select(VideoRender).order_by(VideoRender.created_at.desc()).limit(100))
    required = int(settings_service.get_value(db, "publishing.required_approved_videos"))
    return {
        "videos": [render_out(db, vr) for vr in rows.scalars()],
        "approved_count": videos.approved_count(db),
        "required_approved": required,
        "platform_rules": videos.PLATFORM_RULES,
    }


@router.get("/videos/candidates")
def list_candidates(
    _: str = Depends(require_admin), db: Session = Depends(get_db, scope="function")
) -> dict:
    out = []
    for run, report in videos.candidates(db):
        script = db.get(Script, run.script_id)
        out.append(
            {
                "run": run_out(run),
                "title_yo": script.title_yo,
                "title_en": script.title_en,
                "format": script.format.value,
                "value_report": report,
            }
        )
    return {"candidates": out}


class RenderIn(BaseModel):
    run_id: str


@router.post("/videos", status_code=202)
def request_render(
    body: RenderIn,
    actor: str = Depends(require_admin),
    db: Session = Depends(get_db, scope="function"),
) -> dict:
    vr, job = videos.request_render(db, run_id=body.run_id, actor=actor)
    db.commit()
    _enqueue(job.id, vr.id)
    return {"render_id": vr.id, "job_id": job.id}


@router.get("/videos/{render_id}")
def get_video(
    render_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db, scope="function")
):
    vr = db.get(VideoRender, render_id)
    if vr is None:
        raise NotFoundError("Video not found")
    return render_out(db, vr, full=True)


class DecisionIn(BaseModel):
    decision: Literal["approved", "rejected"]
    checklist: dict[str, bool] = Field(default_factory=dict)
    notes: str | None = Field(default=None, max_length=4000)


@router.post("/videos/{render_id}/decision")
def decide(
    render_id: str,
    body: DecisionIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
) -> dict:
    vr = db.get(VideoRender, render_id)
    if vr is None:
        raise NotFoundError("Video not found")
    videos.decide(
        db, vr, decision=body.decision, checklist=body.checklist, notes=body.notes, actor=p.actor
    )
    return render_out(db, vr, full=True)
