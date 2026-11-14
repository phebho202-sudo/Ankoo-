from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.adapters.registry import get_video_source
from app.api.deps import UserPrincipal, require_admin, require_user
from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models import (
    AuthorisationBasis,
    Episode,
    EpisodeStatus,
    JobRun,
    ReportStatus,
    ResearchReport,
    SourceChannel,
    Topic,
    TopicStatus,
    TranscriptSource,
)
from app.services import audit, discovery, research

router = APIRouter(prefix="/api/v1", tags=["discovery & research"])


# ---------------------------------------------------------------- serialisers
def channel_out(c: SourceChannel, episode_count: int = 0) -> dict[str, Any]:
    return {
        "id": c.id,
        "platform": c.platform,
        "external_id": c.external_id,
        "title": c.title,
        "handle": c.handle,
        "authorisation_basis": c.authorisation_basis.value,
        "authorisation_note": c.authorisation_note,
        "authorised_by": c.authorised_by,
        "authorised_at": c.authorised_at.isoformat(),
        "is_active": c.is_active,
        "is_sample": c.is_sample,
        "episode_count": episode_count,
        "last_scanned_at": c.last_scanned_at.isoformat() if c.last_scanned_at else None,
    }


def episode_out(e: Episode) -> dict[str, Any]:
    return {
        "id": e.id,
        "channel_id": e.channel_id,
        "channel_title": e.channel.title,
        "platform": e.platform,
        "external_id": e.external_id,
        "title": e.title,
        "published_at": e.published_at.isoformat(),
        "duration_seconds": e.duration_seconds,
        "url": e.url,
        "thumbnail_url": e.thumbnail_url,
        "has_captions": e.has_captions,
        "status": e.status.value,
        "is_sample": e.is_sample,
        "possible_duplicate_of_id": e.possible_duplicate_of_id,
        "has_transcript": e.transcript is not None,
    }


def topic_out(t: Topic) -> dict[str, Any]:
    return {
        "id": t.id,
        "report_id": t.report_id,
        "title": t.title,
        "description": t.description,
        "audience_fit": t.audience_fit,
        "lesson_angle": t.lesson_angle,
        "status": t.status.value,
        "decided_by": t.decided_by,
        "decided_at": t.decided_at.isoformat() if t.decided_at else None,
        "decision_note": t.decision_note,
        "is_sample": t.is_sample,
    }


def report_out(r: ResearchReport, *, full: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": r.id,
        "episode_id": r.episode_id,
        "subject": r.subject,
        "status": r.status.value,
        "provider": r.provider,
        "model": r.model,
        "is_sample": r.is_sample,
        "cost_usd": str(r.cost_usd),
        "overlap_flagged": r.overlap_flagged,
        "max_verbatim_overlap_words": r.max_verbatim_overlap_words,
        "used_transcript": r.used_transcript,
        "error": r.error,
        "job_id": r.job_id,
        "requested_by": r.requested_by,
        "created_at": r.created_at.isoformat(),
        "topic_count": len(r.topics),
    }
    if full:
        out.update(
            {
                "summary": r.summary,
                "key_concepts": r.key_concepts,
                "nigerian_context": r.nigerian_context,
                "cautions": r.cautions,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "topics": [topic_out(t) for t in r.topics],
            }
        )
    return out


def _enqueue(task, *args) -> None:
    task.delay(*args)


# ---------------------------------------------------------------- channels
class ChannelIn(BaseModel):
    reference: str = Field(min_length=2, max_length=300)
    authorisation_basis: AuthorisationBasis
    authorisation_note: str = Field(min_length=1, max_length=2000)


class ChannelPatch(BaseModel):
    is_active: bool


@router.get("/channels")
def list_channels(_: str = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    counts = dict(
        db.execute(select(Episode.channel_id, func.count()).group_by(Episode.channel_id)).all()
    )
    rows = db.execute(select(SourceChannel).order_by(SourceChannel.created_at)).scalars()
    return {"channels": [channel_out(c, counts.get(c.id, 0)) for c in rows]}


@router.post("/channels", status_code=201)
def add_channel(
    body: ChannelIn, p: UserPrincipal = Depends(require_user), db: Session = Depends(get_db)
) -> dict:
    provider = get_video_source(get_settings())
    ch = discovery.add_channel(
        db,
        provider,
        reference=body.reference,
        basis=body.authorisation_basis,
        note=body.authorisation_note,
        actor=p.actor,
    )
    return channel_out(ch)


@router.patch("/channels/{channel_id}")
def patch_channel(
    channel_id: str,
    body: ChannelPatch,
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    ch = db.get(SourceChannel, channel_id)
    if ch is None:
        raise NotFoundError("Channel not found")
    discovery.set_channel_active(db, ch, body.is_active, p.actor)
    return channel_out(ch)


@router.post("/channels/{channel_id}/scan", status_code=202)
def scan_channel(
    channel_id: str, actor: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    from app.worker.tasks.content import scan_channel as task

    ch = db.get(SourceChannel, channel_id)
    if ch is None:
        raise NotFoundError("Channel not found")
    job = JobRun(task_name="discovery.scan_channel", payload={"channel_id": ch.id})
    db.add(job)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="job.enqueued",
        entity_type="job_run",
        entity_id=job.id,
        details={"task": "discovery.scan_channel", "channel": ch.title},
    )
    db.commit()
    _enqueue(task, job.id, ch.id)
    return {"job_id": job.id}


# ---------------------------------------------------------------- episodes
class TranscriptIn(BaseModel):
    text: str = Field(min_length=1)
    language: str = Field(default="en", pattern="^(en|yo)$")
    source: TranscriptSource
    permission_reference: str = Field(min_length=1, max_length=2000)


@router.get("/episodes")
def list_episodes(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
    status: EpisodeStatus | None = None,
    channel_id: str | None = None,
    q: str | None = Query(None, max_length=200),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
    base = select(Episode)
    if status:
        base = base.where(Episode.status == status)
    if channel_id:
        base = base.where(Episode.channel_id == channel_id)
    if q:
        like = f"%{q.strip()}%"
        base = base.where(or_(Episode.title.ilike(like), Episode.description.ilike(like)))
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    rows = db.execute(
        base.options(selectinload(Episode.channel), selectinload(Episode.transcript))
        .order_by(Episode.published_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars()
    return {"episodes": [episode_out(e) for e in rows], "total": total}


@router.get("/episodes/{episode_id}")
def get_episode(
    episode_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    e = db.get(Episode, episode_id)
    if e is None:
        raise NotFoundError("Episode not found")
    out = episode_out(e)
    out["description"] = e.description
    out["transcript"] = (
        {
            "language": e.transcript.language,
            "source": e.transcript.source.value,
            "permission_reference": e.transcript.permission_reference,
            "word_count": e.transcript.word_count,
            "added_by": e.transcript.added_by,
            "created_at": e.transcript.created_at.isoformat(),
        }
        if e.transcript
        else None
    )
    reports = db.execute(
        select(ResearchReport)
        .where(ResearchReport.episode_id == e.id)
        .order_by(ResearchReport.created_at.desc())
    ).scalars()
    out["reports"] = [report_out(r) for r in reports]
    return out


@router.put("/episodes/{episode_id}/transcript")
def put_transcript(
    episode_id: str,
    body: TranscriptIn,
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    e = db.get(Episode, episode_id)
    if e is None:
        raise NotFoundError("Episode not found")
    tr = research.save_transcript(
        db,
        e,
        text=body.text,
        language=body.language,
        source=body.source,
        permission_reference=body.permission_reference,
        actor=p.actor,
    )
    return {"episode_id": e.id, "word_count": tr.word_count}


# ---------------------------------------------------------------- research
class ResearchIn(BaseModel):
    episode_id: str | None = None
    subject: str | None = Field(default=None, max_length=300)


class DecisionIn(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=2000)


@router.post("/research", status_code=202)
def request_research(
    body: ResearchIn, actor: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    from app.worker.tasks.content import generate_report as task

    report, job = research.request_report(
        db, episode_id=body.episode_id, subject=body.subject, actor=actor
    )
    db.commit()
    _enqueue(task, job.id, report.id)
    return {"report_id": report.id, "job_id": job.id}


@router.get("/research/reports")
def list_reports(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
    status: ReportStatus | None = None,
    limit: int = Query(25, ge=1, le=100),
) -> dict:
    q = select(ResearchReport).options(selectinload(ResearchReport.topics))
    if status:
        q = q.where(ResearchReport.status == status)
    rows = db.execute(q.order_by(ResearchReport.created_at.desc()).limit(limit)).scalars()
    return {"reports": [report_out(r) for r in rows]}


@router.get("/research/reports/{report_id}")
def get_report(
    report_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    r = db.get(ResearchReport, report_id)
    if r is None:
        raise NotFoundError("Report not found")
    return report_out(r, full=True)


@router.get("/topics")
def list_topics(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
    status: TopicStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    q = select(Topic)
    if status:
        q = q.where(Topic.status == status)
    rows = db.execute(q.order_by(Topic.created_at.desc(), Topic.position).limit(limit)).scalars()
    return {"topics": [topic_out(t) for t in rows]}


@router.post("/topics/{topic_id}/decision")
def decide(
    topic_id: str,
    body: DecisionIn,
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    t = db.get(Topic, topic_id)
    if t is None:
        raise NotFoundError("Topic not found")
    research.decide_topic(db, t, decision=TopicStatus(body.decision), note=body.note, actor=p.actor)
    return topic_out(t)
