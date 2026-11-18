"""Video production (Phase 7): educational value gate, rendering, automated checks, approval.

A render turns one completed production run (narration, presenter clip, timings) into:
- a 16:9 long-form lesson with a branded intro and outro (long-form scripts only),
- a 9:16 vertical cut with burned-in Yoruba captions (Shorts, Reels, TikTok),
- thumbnails and SRT caption files timed to each video.

Nothing here publishes. Every render waits for the owner to watch and approve it, and the
count of owner-approved real (non-sample) renders is what unlocks automatic publishing.
"""

from __future__ import annotations

import hashlib
import re
import tempfile
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters.base import StorageProvider
from app.core.errors import AppError, BlockedByPolicyError, ConflictError, NotFoundError
from app.db.base import utcnow
from app.models import (
    JobRun,
    MediaAsset,
    PresenterProfile,
    PresenterStatus,
    ProductionRun,
    RenderStatus,
    RunStatus,
    Script,
    ScriptFormat,
    ScriptKind,
    ScriptStatus,
    VideoRender,
)
from app.services import audit, media, render, rights, subtitles
from app.services import settings as settings_service
from app.services.rights import Purpose
from app.services.voice import check_storage

# Upload limits per destination. Platforms change these; review them when they announce
# changes (see docs/PUBLISHING.md). The vertical cut is kept short enough for all of them.
PLATFORM_RULES: dict[str, dict[str, Any]] = {
    "youtube": {"format": "long", "max_seconds": 12 * 3600},
    "youtube_short": {"format": "vertical", "max_seconds": 180},
    "instagram_reel": {"format": "vertical", "max_seconds": 180},
    "facebook_reel": {"format": "vertical", "max_seconds": 90},
    "tiktok": {"format": "vertical", "max_seconds": 600},
}
FULL_VERTICAL_MAX = 85.0  # lessons up to this length are used whole as the vertical video
TEASER_MAX = 55.0  # otherwise the vertical cut is the opening segments up to this length
ACTIVE = (
    RenderStatus.QUEUED,
    RenderStatus.RENDERING,
    RenderStatus.AWAITING_APPROVAL,
    RenderStatus.APPROVED,
)
REVIEW_CHECKLIST = (
    "watched_in_full",
    "captions_match_voice",
    "presenter_consistent",
    "educational_value",
    "no_income_promises",
    "credits_correct",
)
_ACTION = re.compile(
    r"(?i)\b(this week|today|tomorrow|step|try|write down|calculate|count|list|start|ask|"
    r"check|record|compare|set aside|save)\b"
)
_LOCAL = re.compile(
    r"(?i)(₦|naira|\blagos\b|\bibadan\b|\babeokuta\b|\bosogbo\b|\bakure\b|\bilorin\b|\bkano\b|"
    r"\babuja\b|\bbalogun\b|\bdugbe\b|\bajo\b|\besusu\b|\bpos\b|\bokada\b|\bdanfo\b|\bmarket\b|"
    r"\bnigeria)"
)
_PROMISE = re.compile(
    r"(?i)(guaranteed (income|profit|returns?)|get rich|double your money|make millions|"
    r"passive income|financial freedom in)"
)


# ---------------------------------------------------------------- gate
def fingerprint(run: ProductionRun) -> str:
    raw = f"{run.script_id}:{run.script_revision}:{run.voice_config_hash}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _check(code: str, ok: bool, *, blocking: bool, detail: Any = None) -> dict[str, Any]:
    return {"code": code, "ok": bool(ok), "blocking": blocking, "detail": detail}


def value_report(db: Session, run: ProductionRun) -> dict[str, Any]:
    """Educational value and eligibility gate. Blocking failures stop the render."""
    script = db.get(Script, run.script_id)
    rev = next(r for r in script.revisions if r.number == run.script_revision)
    segments = rev.segments
    teaching = [s for s in segments if s.get("id") != "credit"]
    english = "\n".join(s.get("text_en", "") for s in teaching)
    checks = [
        _check("run_completed", run.status == RunStatus.COMPLETED, blocking=True),
        _check(
            "approved_latest_script",
            script.status == ScriptStatus.APPROVED
            and script.approved_revision == run.script_revision == script.current_revision,
            blocking=True,
        ),
        _check(
            "automated_quality_clean",
            not (rev.quality or {}).get("errors"),
            blocking=True,
            detail=[e.get("code") for e in (rev.quality or {}).get("errors", [])],
        ),
    ]
    if script.kind == ScriptKind.ORIGINAL:
        flagged = bool((rev.originality or {}).get("flagged"))
        checks.append(_check("original_content", not flagged, blocking=True))
    else:
        ok, reasons = True, []
        try:
            rights.require_rights(db, script.episode_id, Purpose.ADAPTATION, actor="system")
        except BlockedByPolicyError as exc:
            ok, reasons = False, [r["code"] for r in exc.details.get("reasons", [])]
        checks.append(_check("adaptation_rights_valid", ok, blocking=True, detail=reasons))
    seconds = float(run.duration_seconds or 0.0)
    # Sample (test-mode) lessons are placeholders a few seconds long: the check is still
    # reported, but only enforced for real content. Sample videos never unlock publishing.
    enforce = not run.is_sample
    if script.format == ScriptFormat.LONG:
        minimum = int(settings_service.get_value(db, "production.min_long_form_seconds"))
        checks.append(
            _check(
                "enough_substance",
                seconds >= minimum and len(teaching) >= 3,
                blocking=enforce,
                detail={"seconds": round(seconds, 1), "minimum": minimum, "enforced": enforce},
            )
        )
    else:
        checks.append(
            _check(
                "enough_substance",
                len(teaching) >= 3,
                blocking=enforce,
                detail={"segments": len(teaching), "enforced": enforce},
            )
        )
    checks += [
        _check("practical_action", bool(_ACTION.search(english)), blocking=False),
        _check("local_examples", bool(_LOCAL.search(english)), blocking=False),
        _check(
            "no_income_promises",
            not _PROMISE.search(english),
            blocking=False,
            detail=sorted({m.group(0) for m in _PROMISE.finditer(english)}),
        ),
    ]
    return {
        "passed": all(c["ok"] for c in checks if c["blocking"]),
        "checks": checks,
        "note": "Heuristic checks guide the owner; the owner's own viewing decides.",
    }


def _vertical_plan(durations: list[float]) -> tuple[int, bool]:
    """(number of opening segments in the vertical cut, whether that is the whole lesson)."""
    total = sum(durations)
    if total <= FULL_VERTICAL_MAX:
        return len(durations), True
    k, t = 0, 0.0
    for d in durations:
        if t + d > TEASER_MAX:
            break
        t += d
        k += 1
    return max(1, k), False


def eligibility(formats: list[str], long_seconds: float | None, vertical_seconds: float | None):
    out = {}
    for platform, rule in PLATFORM_RULES.items():
        secs = long_seconds if rule["format"] == "long" else vertical_seconds
        out[platform] = (
            rule["format"] in formats and secs is not None and secs <= rule["max_seconds"]
        )
    return out


# ---------------------------------------------------------------- requests
def candidates(db: Session) -> list[tuple[ProductionRun, dict[str, Any]]]:
    """Completed runs (latest per script) whose lesson version has no active video yet."""
    taken = set(
        db.execute(select(VideoRender.fingerprint).where(VideoRender.status.in_(ACTIVE))).scalars()
    )
    runs = (
        db.execute(
            select(ProductionRun)
            .where(ProductionRun.status == RunStatus.COMPLETED)
            .order_by(ProductionRun.created_at.desc())
            .limit(100)
        )
        .scalars()
        .all()
    )
    seen, out = set(), []
    for r in runs:
        if r.script_id in seen:
            continue
        seen.add(r.script_id)
        if fingerprint(r) in taken:
            continue
        out.append((r, value_report(db, r)))
    return out


def request_render(db: Session, *, run_id: str, actor: str) -> tuple[VideoRender, JobRun]:
    run = db.get(ProductionRun, run_id)
    if run is None:
        raise NotFoundError("Production run not found")
    fp = fingerprint(run)
    dup = db.execute(
        select(VideoRender).where(VideoRender.fingerprint == fp, VideoRender.status.in_(ACTIVE))
    ).scalar_one_or_none()
    if dup is not None:
        raise ConflictError(
            "This lesson version already has a video", details={"render_id": dup.id}
        )
    report = value_report(db, run)
    if not report["passed"]:
        failed = [c["code"] for c in report["checks"] if c["blocking"] and not c["ok"]]
        raise BlockedByPolicyError(
            "The educational value gate failed", details={"failed": failed, "report": report}
        )
    script = db.get(Script, run.script_id)
    vr = VideoRender(
        run_id=run.id,
        script_id=run.script_id,
        script_revision=run.script_revision,
        fingerprint=fp,
        formats=(["long", "vertical"] if script.format == ScriptFormat.LONG else ["vertical"]),
        value_report=report,
        is_sample=run.is_sample,
        requested_by=actor,
    )
    db.add(vr)
    db.flush()
    job = JobRun(task_name="video.render", payload={"render_id": vr.id})
    db.add(job)
    db.flush()
    vr.job_id = job.id
    audit.record(
        db,
        actor=actor,
        action="video.render_requested",
        entity_type="video_render",
        entity_id=vr.id,
        details={"run_id": run.id, "formats": vr.formats},
    )
    return vr, job


# ---------------------------------------------------------------- rendering
def _store(
    db: Session,
    storage: StorageProvider,
    vr: VideoRender,
    *,
    key: str,
    path: Path,
    kind: str,
    mime: str,
    seconds: float | None = None,
) -> MediaAsset:
    data = path.read_bytes()
    storage.put(key, data, mime)
    asset = MediaAsset(
        kind=kind,
        storage_key=key,
        mime_type=mime,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        duration_seconds=seconds,
        is_sample=vr.is_sample,
    )
    vr.assets.append(asset)
    db.flush()
    return asset


def _asset(run: ProductionRun, kind: str) -> MediaAsset:
    a = next((a for a in run.assets if a.kind == kind), None)
    if a is None:
        raise media.MediaError(f"The production run has no {kind}")
    return a


def _credit(segments: list[dict[str, Any]]) -> str | None:
    c = next((s for s in segments if s.get("id") == "credit"), None)
    return c.get("text_yo") if c else None


def _video_checks(
    info: dict[str, Any], *, size: tuple[int, int], expected: float, cues_end: float, label: str
) -> list[dict[str, Any]]:
    w, h = size
    return [
        _check(f"{label}_resolution", (info["width"], info["height"]) == (w, h), blocking=True),
        _check(f"{label}_has_audio", info["audio_codec"] is not None, blocking=True),
        _check(
            f"{label}_duration",
            abs(info["duration"] - expected) <= 0.6,
            blocking=True,
            detail={"actual": info["duration"], "expected": round(expected, 3)},
        ),
        _check(
            f"{label}_captions_within_video",
            cues_end <= info["duration"] + 0.05,
            blocking=True,
            detail={"last_caption_end": round(cues_end, 3)},
        ),
    ]


def run_render(db: Session, vr: VideoRender, storage: StorageProvider) -> None:
    run = db.get(ProductionRun, vr.run_id)
    script = db.get(Script, vr.script_id)
    presenter = db.get(PresenterProfile, run.presenter_id)
    rev = next(r for r in script.revisions if r.number == vr.script_revision)

    def stop(status: RenderStatus, reason: str) -> None:
        vr.status, vr.error, vr.finished_at = status, reason, utcnow()
        audit.record(
            db,
            actor="worker",
            action=f"video.render_{status.value}",
            entity_type="video_render",
            entity_id=vr.id,
            details={"reason": reason},
        )

    vr.status = RenderStatus.RENDERING
    report = value_report(db, run)  # re-checked: rights or approvals may have changed
    vr.value_report = report
    if not report["passed"]:
        failed = ", ".join(c["code"] for c in report["checks"] if c["blocking"] and not c["ok"])
        return stop(RenderStatus.BLOCKED, f"Educational value gate failed: {failed}")
    if presenter is None or presenter.status != PresenterStatus.APPROVED:
        return stop(RenderStatus.BLOCKED, "The presenter is no longer approved")
    problems = media.available()
    if problems:
        return stop(RenderStatus.FAILED, "; ".join(problems))
    try:
        check_storage(db, storage)
    except BlockedByPolicyError as exc:
        return stop(RenderStatus.BLOCKED, exc.message)

    segments = rev.segments
    durations = list(run.segment_durations)
    if len(durations) != len(segments):
        return stop(RenderStatus.FAILED, "Segment timings do not match the script")
    narration_seconds = float(run.duration_seconds)
    title = rev.title_yo
    credit = _credit(segments)
    checks: list[dict[str, Any]] = []
    prefix = f"renders/{vr.id}"
    try:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            clip = d / "presenter.mp4"
            clip.write_bytes(storage.get(_asset(run, "presenter_clip").storage_key))
            portrait = d / "portrait.png"
            if presenter.portrait_key:
                raw = d / ("portrait-src" + Path(presenter.portrait_key).suffix)
                raw.write_bytes(storage.get(presenter.portrait_key))
                media.ffmpeg("-i", str(raw), "-frames:v", "1", str(portrait), timeout=60)
            else:
                media.placeholder_portrait(portrait)

            long_seconds = None
            if "long" in vr.formats:
                n_seg = len(segments)
                slides = [
                    media.slide(
                        d / f"slide-{n:03d}.png",
                        heading=title,
                        body=seg["text_yo"],
                        footer=f"{render.BRAND}  ·  {n}/{n_seg}",
                        body_wrap=30,
                        body_size=52,
                    )
                    for n, seg in enumerate(segments, start=1)
                ]
                intro = render.card(
                    d / "intro.png",
                    [
                        render.Text(render.BRAND, 48, 330, render.GOLD),
                        render.Text(title, 92, 470, wrap=26),
                    ],
                    render.LONG_SIZE,
                    rule_y=420,
                )
                outro_texts = [
                    render.Text("Ẹ ṣé tí ẹ wò ó!", 96, 300, render.GOLD),
                    render.Text("Ẹ máa bá wa kẹ́kọ̀ọ́ lọ.", 56, 450),
                    render.Text(render.BRAND, 44, 560, render.GOLD),
                ]
                if credit:
                    outro_texts.append(render.Text(credit, 34, 760, wrap=70, bold=False))
                outro = render.card(d / "outro.png", outro_texts, render.LONG_SIZE)
                long_mp4 = render.render_long(
                    intro=intro,
                    slides=slides,
                    durations=durations,
                    outro=outro,
                    presenter=clip,
                    narration_seconds=narration_seconds,
                    dst=d / "lesson-16x9.mp4",
                )
                info = render.probe(long_mp4)
                long_seconds = info["duration"]
                cue_sets = {
                    lang: subtitles.build_cues(
                        segments, lang, durations, offset=render.INTRO_SECONDS
                    )
                    for lang in ("yo", "en")
                }
                checks += _video_checks(
                    info,
                    size=render.LONG_SIZE,
                    expected=render.INTRO_SECONDS + narration_seconds + render.OUTRO_SECONDS,
                    cues_end=max(c.end for c in cue_sets["yo"]),
                    label="long",
                )
                _store(
                    db,
                    storage,
                    vr,
                    key=f"{prefix}/lesson-16x9.mp4",
                    path=long_mp4,
                    kind="video_long",
                    mime="video/mp4",
                    seconds=long_seconds,
                )
                for lang, cues in cue_sets.items():
                    srt = d / f"lesson-{lang}.srt"
                    srt.write_text(subtitles.to_srt(cues), encoding="utf-8")
                    _store(
                        db,
                        storage,
                        vr,
                        key=f"{prefix}/lesson-{lang}.srt",
                        path=srt,
                        kind=f"captions_long_{lang}",
                        mime="application/x-subrip",
                    )
                thumb = render.poster(
                    d / "thumbnail-16x9.png",
                    title=title,
                    portrait=portrait,
                    size=render.THUMB_SIZE,
                    label="Ẹ̀kọ́ iṣẹ́ òwò ní èdè Yorùbá",
                )
                _store(
                    db,
                    storage,
                    vr,
                    key=f"{prefix}/thumbnail-16x9.png",
                    path=thumb,
                    kind="thumbnail_long",
                    mime="image/png",
                )

            k, whole = _vertical_plan(durations)
            v_segments, v_durations = segments[:k], durations[:k]
            # A cut keeps the short breath after its last segment before the end card.
            v_seconds = narration_seconds if whole else sum(v_durations)
            vcues = {
                lang: subtitles.build_cues(v_segments, lang, v_durations, max_line=26)
                for lang in ("yo", "en")
            }
            ass = render.ass_captions(vcues["yo"], d / "vertical.ass")
            background = render.card(
                d / "vertical-bg.png",
                [
                    render.Text(render.BRAND, 40, 170, render.GOLD),
                    render.Text(title, 76, 280, wrap=20),
                ],
                render.VERTICAL_SIZE,
            )
            end_texts = [
                render.Text(
                    "Ẹ ṣé tí ẹ wò ó!" if whole else "Ẹ̀kọ́ kíkún wà lórí ikanni wa",
                    68,
                    760,
                    render.GOLD,
                    wrap=20,
                ),
                render.Text(render.BRAND, 40, 1000),
            ]
            if credit:
                end_texts.append(render.Text(credit, 30, 1150, wrap=48, bold=False))
            end_card = render.card(d / "vertical-end.png", end_texts, render.VERTICAL_SIZE)
            v_mp4 = render.render_vertical(
                background=background,
                presenter=clip,
                captions=ass,
                end_card=end_card,
                seconds=v_seconds,
                dst=d / "vertical-9x16.mp4",
            )
            vinfo = render.probe(v_mp4)
            checks += _video_checks(
                vinfo,
                size=render.VERTICAL_SIZE,
                expected=v_seconds + render.VERTICAL_END_SECONDS,
                cues_end=max(c.end for c in vcues["yo"]),
                label="vertical",
            )
            _store(
                db,
                storage,
                vr,
                key=f"{prefix}/vertical-9x16.mp4",
                path=v_mp4,
                kind="video_vertical",
                mime="video/mp4",
                seconds=vinfo["duration"],
            )
            for lang, cues in vcues.items():
                srt = d / f"vertical-{lang}.srt"
                srt.write_text(subtitles.to_srt(cues), encoding="utf-8")
                _store(
                    db,
                    storage,
                    vr,
                    key=f"{prefix}/vertical-{lang}.srt",
                    path=srt,
                    kind=f"captions_vertical_{lang}",
                    mime="application/x-subrip",
                )
            cover = render.poster(
                d / "cover-9x16.png", title=title, portrait=portrait, size=render.VERTICAL_SIZE
            )
            _store(
                db,
                storage,
                vr,
                key=f"{prefix}/cover-9x16.png",
                path=cover,
                kind="thumbnail_vertical",
                mime="image/png",
            )
    except media.MediaError as exc:
        vr.checks = checks
        return stop(RenderStatus.FAILED, exc.message)

    vr.checks = checks
    vr.long_seconds, vr.vertical_seconds = long_seconds, vinfo["duration"]
    vr.vertical_is_full = whole
    vr.platforms = eligibility(vr.formats, long_seconds, vr.vertical_seconds)
    failed = [c["code"] for c in checks if c["blocking"] and not c["ok"]]
    if failed:
        # Quality failure: the video can never be approved or published.
        return stop(RenderStatus.FAILED, f"Automated video checks failed: {', '.join(failed)}")
    vr.status, vr.finished_at = RenderStatus.AWAITING_APPROVAL, utcnow()
    audit.record(
        db,
        actor="worker",
        action="video.rendered",
        entity_type="video_render",
        entity_id=vr.id,
        details={
            "long_seconds": long_seconds,
            "vertical_seconds": vr.vertical_seconds,
            "assets": len(vr.assets),
            "platforms": vr.platforms,
        },
    )


# ---------------------------------------------------------------- owner decision
def decide(
    db: Session,
    vr: VideoRender,
    *,
    decision: str,
    checklist: dict[str, bool],
    notes: str | None,
    actor: str,
) -> VideoRender:
    if vr.status != RenderStatus.AWAITING_APPROVAL:
        raise BlockedByPolicyError("This video is not waiting for approval")
    checklist = {k: bool(checklist.get(k)) for k in REVIEW_CHECKLIST}
    notes = (notes or "").strip() or None
    if decision == "approved":
        missing = [k for k, v in checklist.items() if not v]
        if missing:
            raise BlockedByPolicyError(
                "Confirm every review point before approving", details={"missing": missing}
            )
        run = db.get(ProductionRun, vr.run_id)
        report = value_report(db, run)  # rights/approval may have changed since rendering
        if not report["passed"]:
            vr.value_report = report
            failed = [c["code"] for c in report["checks"] if c["blocking"] and not c["ok"]]
            raise BlockedByPolicyError(
                "The educational value gate no longer passes", details={"failed": failed}
            )
        vr.status = RenderStatus.APPROVED
    elif decision == "rejected":
        if not notes:
            raise AppError("Say what needs to change")
        vr.status = RenderStatus.REJECTED
    else:
        raise AppError("Unknown decision")
    vr.review_checklist, vr.decision_notes = checklist, notes
    vr.decided_by, vr.decided_at = actor, utcnow()
    audit.record(
        db,
        actor=actor,
        action=f"video.{vr.status.value}",
        entity_type="video_render",
        entity_id=vr.id,
        details={"checklist": checklist, "notes": notes, "is_sample": vr.is_sample},
    )
    return vr


def approved_count(db: Session) -> int:
    """Owner-approved real videos (sample/test videos never count toward the unlock)."""
    return int(
        db.execute(
            select(func.count())
            .select_from(VideoRender)
            .where(VideoRender.status == RenderStatus.APPROVED, VideoRender.is_sample.is_(False))
        ).scalar_one()
    )


def video_cost(db: Session, vr: VideoRender) -> dict[str, str]:
    """Actual recorded cost of one video: every script version written for it (AI), its
    narration and presenter (voice/avatar), and rendering (local, $0)."""
    from decimal import Decimal

    from app.models import ScriptRevision

    script_cost = db.execute(
        select(func.coalesce(func.sum(ScriptRevision.cost_usd), 0)).where(
            ScriptRevision.script_id == vr.script_id
        )
    ).scalar_one()
    run = db.get(ProductionRun, vr.run_id)
    script_cost = Decimal(str(script_cost))
    voice = Decimal(str(run.total_cost_usd)) if run else Decimal("0")
    total = script_cost + voice
    return {
        "script_usd": f"{script_cost:.4f}",
        "voice_usd": f"{voice:.4f}",
        "render_usd": "0.0000",
        "total_usd": f"{total:.4f}",
    }
