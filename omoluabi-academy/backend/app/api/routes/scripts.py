from __future__ import annotations

from datetime import UTC
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    Principal,
    UserPrincipal,
    require_owner,
    require_staff,
    require_staff_read,
)
from app.core.errors import AppError, NotFoundError
from app.db.base import aware
from app.db.session import get_db
from app.models import (
    GlossaryTerm,
    PronunciationEntry,
    Script,
    ScriptFormat,
    ScriptRevision,
    ScriptStatus,
)
from app.services import audit, quality, scripts, subtitles

router = APIRouter(prefix="/api/v1", tags=["yoruba scripts"])


def _iso(dt):
    return aware(dt).astimezone(UTC).isoformat() if dt else None


def revision_out(r: ScriptRevision) -> dict[str, Any]:
    return {
        "number": r.number,
        "origin": r.origin,
        "title_yo": r.title_yo,
        "segments": r.segments,
        "change_note": r.change_note,
        "quality": r.quality,
        "originality": r.originality,
        "provider": r.provider,
        "model": r.model,
        "cost_usd": str(r.cost_usd),
        "is_sample": r.is_sample,
        "created_by": r.created_by,
        "created_at": _iso(r.created_at),
        "estimated_seconds": round(subtitles.total_seconds(r.segments), 1),
    }


def script_out(s: Script, *, full: bool = False) -> dict[str, Any]:
    latest = s.revisions[-1] if s.revisions else None
    out: dict[str, Any] = {
        "id": s.id,
        "kind": s.kind.value,
        "format": s.format.value,
        "status": s.status.value,
        "title_en": s.title_en,
        "title_yo": s.title_yo,
        "topic_id": s.topic_id,
        "episode_id": s.episode_id,
        "licence_id": s.licence_id,
        "target_minutes": s.target_minutes,
        "is_sample": s.is_sample,
        "current_revision": s.current_revision,
        "approved_revision": s.approved_revision,
        "approved_at": _iso(s.approved_at),
        "blocked_reason": s.blocked_reason,
        "created_by": s.created_by,
        "created_at": _iso(s.created_at),
        "updated_at": _iso(s.updated_at),
        "score": latest.quality.get("score") if latest else None,
        "error_count": len(latest.quality.get("errors", [])) if latest else 0,
    }
    if full:
        out["revision"] = revision_out(latest) if latest else None
        out["revisions"] = [
            {
                "number": r.number,
                "origin": r.origin,
                "created_by": r.created_by,
                "created_at": _iso(r.created_at),
                "score": r.quality.get("score"),
                "change_note": r.change_note,
            }
            for r in reversed(s.revisions)
        ]
        out["reviews"] = [
            {
                "revision_number": v.revision_number,
                "reviewer": v.reviewer,
                "decision": v.decision,
                "checklist": v.checklist,
                "comments": v.comments,
                "created_at": _iso(v.created_at),
            }
            for v in reversed(s.reviews)
        ]
        out["checklist_items"] = list(scripts.REVIEW_CHECKLIST)
        out["quality_disclaimer"] = quality.DISCLAIMER
    return out


def _get(db: Session, script_id: str) -> Script:
    s = db.get(Script, script_id)
    if s is None:
        raise NotFoundError("Script not found")
    return s


def _enqueue(job_id: str, script_id: str) -> None:
    from app.worker.tasks.scripts import generate_script

    generate_script.delay(job_id, script_id)


# ---------------------------------------------------------------- scripts
class ScriptIn(BaseModel):
    kind: Literal["original_lesson", "licensed_adaptation"]
    topic_id: str | None = None
    episode_id: str | None = None
    format: ScriptFormat = ScriptFormat.LONG
    target_minutes: int = Field(default=8, ge=1, le=30)


class SegmentIn(BaseModel):
    id: str | None = None
    text_yo: str = Field(max_length=2000)
    text_en: str = Field(max_length=2000)
    visual: str = Field(default="", max_length=500)
    locked: bool = False


class RevisionIn(BaseModel):
    title_yo: str = Field(min_length=1, max_length=300)
    segments: list[SegmentIn] = Field(min_length=1, max_length=200)
    change_note: str = Field(min_length=1, max_length=2000)


class ReviseIn(BaseModel):
    instructions: str = Field(min_length=1, max_length=4000)


class ReviewIn(BaseModel):
    decision: Literal["approved", "changes_requested"]
    checklist: dict[str, bool] = Field(default_factory=dict)
    comments: str | None = Field(default=None, max_length=4000)


@router.get("/scripts")
def list_scripts(
    _: Principal = Depends(require_staff_read),
    db: Session = Depends(get_db),
    status: ScriptStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    q = select(Script).order_by(Script.updated_at.desc()).limit(limit)
    if status:
        q = q.where(Script.status == status)
    return {"scripts": [script_out(s) for s in db.execute(q).scalars()]}


@router.post("/scripts", status_code=202)
def create_script(
    body: ScriptIn, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    if body.kind == "original_lesson":
        if not body.topic_id:
            raise AppError("Choose an approved topic")
        script, job = scripts.create_original(
            db,
            topic_id=body.topic_id,
            fmt=body.format,
            target_minutes=body.target_minutes,
            actor=p.actor,
        )
    else:
        if not body.episode_id:
            raise AppError("Choose a licensed episode")
        script, job = scripts.create_adaptation(
            db,
            episode_id=body.episode_id,
            fmt=body.format,
            target_minutes=body.target_minutes,
            actor=p.actor,
        )
    db.commit()
    _enqueue(job.id, script.id)
    return {"script_id": script.id, "job_id": job.id}


@router.get("/scripts/{script_id}")
def get_script(
    script_id: str,
    _: Principal = Depends(require_staff_read),
    db: Session = Depends(get_db),
    revision: int | None = None,
) -> dict:
    s = _get(db, script_id)
    out = script_out(s, full=True)
    if revision is not None:
        out["revision"] = revision_out(scripts.revision(s, revision))
    return out


@router.post("/scripts/{script_id}/revisions", status_code=201)
def save_revision(
    script_id: str,
    body: RevisionIn,
    p: UserPrincipal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    s = _get(db, script_id)
    rev = scripts.add_human_revision(
        db,
        s,
        title_yo=body.title_yo,
        segments=[x.model_dump() for x in body.segments],
        change_note=body.change_note,
        actor=p.actor,
    )
    return revision_out(rev)


@router.post("/scripts/{script_id}/revise", status_code=202)
def revise(
    script_id: str,
    body: ReviseIn,
    p: UserPrincipal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    s = _get(db, script_id)
    job = scripts.request_revision(db, s, instructions=body.instructions, actor=p.actor)
    db.commit()
    _enqueue(job.id, s.id)
    return {"job_id": job.id}


@router.post("/scripts/{script_id}/submit")
def submit(
    script_id: str, p: UserPrincipal = Depends(require_staff), db: Session = Depends(get_db)
) -> dict:
    s = _get(db, script_id)
    scripts.submit_for_review(db, s, p.actor)
    return script_out(s)


@router.post("/scripts/{script_id}/reviews")
def review(
    script_id: str,
    body: ReviewIn,
    p: UserPrincipal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    s = _get(db, script_id)
    scripts.review(
        db,
        s,
        decision=body.decision,
        checklist=body.checklist,
        comments=body.comments,
        actor=p.actor,
    )
    return script_out(s)


@router.post("/scripts/{script_id}/archive")
def archive(
    script_id: str, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    s = _get(db, script_id)
    scripts.archive(db, s, p.actor)
    return script_out(s)


def _slug(s: Script) -> str:
    base = "".join(c if c.isalnum() else "-" for c in s.title_en.lower())[:40].strip("-")
    return base or "script"


@router.get("/scripts/{script_id}/subtitles")
def subtitles_srt(
    script_id: str,
    lang: Literal["yo", "en"] = "yo",
    revision: int | None = None,
    _: Principal = Depends(require_staff_read),
    db: Session = Depends(get_db),
) -> Response:
    s = _get(db, script_id)
    rev = scripts.revision(s, revision)
    body = scripts.srt(s, lang, rev.number)
    name = f"{_slug(s)}-r{rev.number}-{lang}.srt"
    return Response(
        body.encode("utf-8"),
        media_type="application/x-subrip; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/scripts/{script_id}/text")
def script_text(
    script_id: str,
    revision: int | None = None,
    _: Principal = Depends(require_staff_read),
    db: Session = Depends(get_db),
) -> Response:
    s = _get(db, script_id)
    rev = scripts.revision(s, revision)
    lines = [rev.title_yo, s.title_en, ""]
    for i, seg in enumerate(rev.segments, start=1):
        lines += [f"[{i}] {seg['text_yo']}", f"    {seg['text_en']}", ""]
    name = f"{_slug(s)}-r{rev.number}.txt"
    return Response(
        "\n".join(lines).encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# ---------------------------------------------------------------- glossary & pronunciation
class TermIn(BaseModel):
    english: str = Field(min_length=1, max_length=120)
    yoruba: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)


class PronIn(BaseModel):
    written: str = Field(min_length=1, max_length=120)
    spoken: str = Field(min_length=1, max_length=200)
    category: Literal["term", "name", "brand", "loanword", "number"] = "term"
    notes: str | None = Field(default=None, max_length=1000)


def _find(db: Session, model, entry_id: str):
    obj = db.get(model, entry_id)
    if obj is None:
        raise NotFoundError("Not found")
    return obj


def term_out(t: GlossaryTerm) -> dict[str, Any]:
    return {
        "id": t.id,
        "english": t.english,
        "yoruba": t.yoruba,
        "notes": t.notes,
        "status": t.status.value,
        "approved_by": t.approved_by,
    }


def pron_out(e: PronunciationEntry) -> dict[str, Any]:
    return {
        "id": e.id,
        "written": e.written,
        "spoken": e.spoken,
        "category": e.category,
        "notes": e.notes,
        "status": e.status.value,
        "approved_by": e.approved_by,
    }


@router.get("/glossary")
def list_glossary(
    _: Principal = Depends(require_staff_read), db: Session = Depends(get_db)
) -> dict:
    rows = db.execute(select(GlossaryTerm).order_by(GlossaryTerm.english)).scalars()
    return {"terms": [term_out(t) for t in rows]}


@router.post("/glossary", status_code=201)
def add_term(
    body: TermIn, p: UserPrincipal = Depends(require_staff), db: Session = Depends(get_db)
) -> dict:
    return term_out(
        scripts.save_term(
            db, english=body.english, yoruba_text=body.yoruba, notes=body.notes, actor=p.actor
        )
    )


@router.put("/glossary/{term_id}")
def update_term(
    term_id: str,
    body: TermIn,
    p: UserPrincipal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    t = _find(db, GlossaryTerm, term_id)
    return term_out(
        scripts.save_term(
            db,
            english=body.english,
            yoruba_text=body.yoruba,
            notes=body.notes,
            actor=p.actor,
            term=t,
        )
    )


@router.post("/glossary/{term_id}/approve")
def approve_term(
    term_id: str, p: UserPrincipal = Depends(require_staff), db: Session = Depends(get_db)
) -> dict:
    t = _find(db, GlossaryTerm, term_id)
    scripts.approve_entry(db, t, p.actor)
    return term_out(t)


@router.delete("/glossary/{term_id}", status_code=204)
def delete_term(
    term_id: str, p: UserPrincipal = Depends(require_staff), db: Session = Depends(get_db)
) -> None:
    t = _find(db, GlossaryTerm, term_id)
    audit.record(
        db,
        actor=p.actor,
        action="glossary.deleted",
        entity_type="glossary",
        entity_id=t.id,
        details={"english": t.english, "yoruba": t.yoruba},
    )
    db.delete(t)


@router.get("/pronunciations")
def list_pronunciations(
    _: Principal = Depends(require_staff_read), db: Session = Depends(get_db)
) -> dict:
    rows = db.execute(select(PronunciationEntry).order_by(PronunciationEntry.written)).scalars()
    return {"entries": [pron_out(e) for e in rows]}


@router.post("/pronunciations", status_code=201)
def add_pron(
    body: PronIn, p: UserPrincipal = Depends(require_staff), db: Session = Depends(get_db)
) -> dict:
    return pron_out(
        scripts.save_pronunciation(
            db,
            written=body.written,
            spoken=body.spoken,
            category=body.category,
            notes=body.notes,
            actor=p.actor,
        )
    )


@router.put("/pronunciations/{entry_id}")
def update_pron(
    entry_id: str,
    body: PronIn,
    p: UserPrincipal = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    e = _find(db, PronunciationEntry, entry_id)
    return pron_out(
        scripts.save_pronunciation(
            db,
            written=body.written,
            spoken=body.spoken,
            category=body.category,
            notes=body.notes,
            actor=p.actor,
            entry=e,
        )
    )


@router.post("/pronunciations/{entry_id}/approve")
def approve_pron(
    entry_id: str, p: UserPrincipal = Depends(require_staff), db: Session = Depends(get_db)
) -> dict:
    e = _find(db, PronunciationEntry, entry_id)
    scripts.approve_entry(db, e, p.actor)
    return pron_out(e)


@router.delete("/pronunciations/{entry_id}", status_code=204)
def delete_pron(
    entry_id: str, p: UserPrincipal = Depends(require_staff), db: Session = Depends(get_db)
) -> None:
    e = _find(db, PronunciationEntry, entry_id)
    audit.record(
        db,
        actor=p.actor,
        action="pronunciation.deleted",
        entity_type="pronunciation",
        entity_id=e.id,
        details={"written": e.written},
    )
    db.delete(e)


@router.get("/pronunciations/lexicon.pls")
def lexicon(_: Principal = Depends(require_staff_read), db: Session = Depends(get_db)) -> Response:
    return Response(
        scripts.pls_lexicon(db).encode("utf-8"),
        media_type="application/pls+xml; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="omoluabi-yoruba.pls"'},
    )
