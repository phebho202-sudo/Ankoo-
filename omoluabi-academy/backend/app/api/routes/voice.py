from __future__ import annotations

from datetime import UTC
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.registry import get_storage
from app.adapters.storage.local import LocalStorage
from app.api.deps import Principal, UserPrincipal, require_owner, require_staff, require_staff_read
from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.db.base import aware
from app.db.session import get_db
from app.models import MediaAsset, ProductionRun, PronunciationTest
from app.services import voice

router = APIRouter(prefix="/api/v1", tags=["voice & presenter"])


def _iso(dt):
    return aware(dt).astimezone(UTC).isoformat() if dt else None


def presenter_out(db: Session, p) -> dict[str, Any] | None:
    if p is None:
        return None
    test = voice.passed_test(db, p)
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "voice_provider": p.voice_provider,
        "voice_id": p.voice_id,
        "voice_model": p.voice_model,
        "voice_settings": p.voice_settings,
        "has_portrait": p.portrait_key is not None,
        "portrait_sha256": p.portrait_sha256,
        "voice_is_original_or_licensed": p.voice_is_original_or_licensed,
        "portrait_is_original_or_licensed": p.portrait_is_original_or_licensed,
        "not_a_real_person": p.not_a_real_person,
        "status": p.status.value,
        "approved_by": p.approved_by,
        "approved_at": _iso(p.approved_at),
        "voice_config_hash": voice.voice_config_hash(p),
        "passed_test_id": test.id if test else None,
        "problems": voice.approval_problems(db, p),
        "updated_at": _iso(p.updated_at),
    }


def test_out(t: PronunciationTest) -> dict[str, Any]:
    return {
        "id": t.id,
        "status": t.status.value,
        "passage": t.passage,
        "audio_asset_id": t.audio_asset_id,
        "ratings": t.ratings,
        "notes": t.notes,
        "reviewed_by": t.reviewed_by,
        "reviewed_at": _iso(t.reviewed_at),
        "provider": t.provider,
        "characters": t.characters,
        "cost_usd": str(t.cost_usd),
        "is_sample": t.is_sample,
        "error": t.error,
        "job_id": t.job_id,
        "voice_config_hash": t.voice_config_hash,
        "created_at": _iso(t.created_at),
        "checks": list(voice.TEST_CHECKS),
    }


def asset_out(a: MediaAsset) -> dict[str, Any]:
    return {
        "id": a.id,
        "kind": a.kind,
        "position": a.position,
        "mime_type": a.mime_type,
        "size_bytes": a.size_bytes,
        "sha256": a.sha256,
        "duration_seconds": a.duration_seconds,
        "is_sample": a.is_sample,
    }


def run_out(r: ProductionRun, *, full: bool = False) -> dict[str, Any]:
    out = {
        "id": r.id,
        "script_id": r.script_id,
        "script_revision": r.script_revision,
        "video_format": r.video_format,
        "status": r.status.value,
        "tts_provider": r.tts_provider,
        "tts_characters": r.tts_characters,
        "tts_cost_usd": str(r.tts_cost_usd),
        "avatar_seconds": r.avatar_seconds,
        "avatar_cost_usd": str(r.avatar_cost_usd),
        "total_cost_usd": str(r.total_cost_usd),
        "duration_seconds": r.duration_seconds,
        "is_sample": r.is_sample,
        "error": r.error,
        "job_id": r.job_id,
        "requested_by": r.requested_by,
        "created_at": _iso(r.created_at),
        "finished_at": _iso(r.finished_at),
    }
    if full:
        out["segment_durations"] = r.segment_durations
        out["assets"] = [asset_out(a) for a in r.assets]
    return out


def _enqueue(task_name: str, job_id: str, obj_id: str) -> None:
    from app.worker.tasks import voice as tasks

    getattr(tasks, task_name).delay(job_id, obj_id)


# ---------------------------------------------------------------- presenter
class PresenterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    voice_provider: Literal["elevenlabs"] = "elevenlabs"
    voice_id: str = Field(default="", max_length=120)
    voice_model: str = Field(default="", max_length=80)
    voice_settings: dict[str, float] = Field(default_factory=dict)
    voice_is_original_or_licensed: bool = False
    portrait_is_original_or_licensed: bool = False
    not_a_real_person: bool = False


@router.get("/voice/presenter")
def get_presenter(
    _: Principal = Depends(require_staff_read), db: Session = Depends(get_db)
) -> dict:
    return {"presenter": presenter_out(db, voice.get_presenter(db))}


@router.put("/voice/presenter")
def save_presenter(
    body: PresenterIn, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    return {"presenter": presenter_out(db, voice.save_presenter(db, body.model_dump(), p.actor))}


@router.post("/voice/presenter/portrait")
async def upload_portrait(
    file: UploadFile = File(...),
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db),
) -> dict:
    prof = voice.get_presenter(db)
    if prof is None:
        raise NotFoundError("Save the presenter profile first")
    data = await file.read(voice.MAX_PORTRAIT_BYTES + 1)
    voice.attach_portrait(
        db,
        get_storage(get_settings()),
        prof,
        data=data,
        content_type=file.content_type or "",
        actor=p.actor,
    )
    return {"presenter": presenter_out(db, prof)}


@router.get("/voice/presenter/portrait")
def portrait(_: Principal = Depends(require_staff_read), db: Session = Depends(get_db)) -> Response:
    prof = voice.get_presenter(db)
    if prof is None or not prof.portrait_key:
        raise NotFoundError("No portrait uploaded")
    data = get_storage(get_settings()).get(prof.portrait_key)
    mime = "image/png" if prof.portrait_key.endswith(".png") else "image/jpeg"
    return Response(data, media_type=mime, headers={"Cache-Control": "private, no-store"})


@router.post("/voice/presenter/approve")
def approve(p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)) -> dict:
    prof = voice.get_presenter(db)
    if prof is None:
        raise NotFoundError("No presenter profile")
    return {"presenter": presenter_out(db, voice.approve_presenter(db, prof, p.actor))}


# ---------------------------------------------------------------- pronunciation tests
class RatingIn(BaseModel):
    ratings: dict[str, bool] = Field(default_factory=dict)
    notes: str | None = Field(default=None, max_length=4000)


@router.get("/voice/tests")
def list_tests(_: Principal = Depends(require_staff_read), db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(PronunciationTest).order_by(PronunciationTest.created_at.desc()).limit(20)
    ).scalars()
    return {"tests": [test_out(t) for t in rows]}


@router.post("/voice/tests", status_code=202)
def request_test(p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)) -> dict:
    test, job = voice.request_test(db, p.actor)
    db.commit()
    _enqueue("pronunciation_test", job.id, test.id)
    return {"test_id": test.id, "job_id": job.id}


@router.post("/voice/tests/{test_id}/rating")
def rate(
    test_id: str,
    body: RatingIn,
    p: UserPrincipal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    t = db.get(PronunciationTest, test_id)
    if t is None:
        raise NotFoundError("Test not found")
    return test_out(voice.rate_test(db, t, ratings=body.ratings, notes=body.notes, actor=p.actor))


# ---------------------------------------------------------------- production runs
class RunIn(BaseModel):
    script_id: str
    video_format: Literal["hybrid", "full_avatar"] = "hybrid"


@router.get("/voice/runs")
def list_runs(
    _: Principal = Depends(require_staff_read),
    db: Session = Depends(get_db),
    script_id: str | None = None,
) -> dict:
    q = select(ProductionRun).order_by(ProductionRun.created_at.desc()).limit(50)
    if script_id:
        q = q.where(ProductionRun.script_id == script_id)
    return {"runs": [run_out(r) for r in db.execute(q).scalars()]}


@router.post("/voice/runs", status_code=202)
def request_run(
    body: RunIn, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    run, job = voice.request_production(
        db, script_id=body.script_id, video_format=body.video_format, actor=p.actor
    )
    db.commit()
    _enqueue("produce", job.id, run.id)
    return {"run_id": run.id, "job_id": job.id}


@router.get("/voice/runs/{run_id}")
def get_run(
    run_id: str, _: Principal = Depends(require_staff_read), db: Session = Depends(get_db)
) -> dict:
    r = db.get(ProductionRun, run_id)
    if r is None:
        raise NotFoundError("Run not found")
    return run_out(r, full=True)


# ---------------------------------------------------------------- media
@router.get("/media/{asset_id}")
def media_file(
    asset_id: str, _: Principal = Depends(require_staff_read), db: Session = Depends(get_db)
) -> Response:
    a = db.get(MediaAsset, asset_id)
    if a is None:
        raise NotFoundError("Media not found")
    storage = get_storage(get_settings())
    headers = {"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"}
    if isinstance(storage, LocalStorage):  # range requests, so audio/video players can seek
        return FileResponse(
            storage.local_path(a.storage_key), media_type=a.mime_type, headers=headers
        )
    return Response(storage.get(a.storage_key), media_type=a.mime_type, headers=headers)
