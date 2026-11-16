"""Presenter profile, pronunciation tests and voice production runs (Phase 6)."""

from __future__ import annotations

import hashlib
import json
import re
import tempfile
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters.base import StorageProvider, TTSProvider
from app.core.errors import AppError, BlockedByPolicyError, NotFoundError, ProviderError
from app.db.base import utcnow
from app.models import (
    JobRun,
    MediaAsset,
    PresenterProfile,
    PresenterStatus,
    ProductionRun,
    PronunciationEntry,
    PronunciationTest,
    RunStatus,
    Script,
    ScriptKind,
    ScriptStatus,
    TermStatus,
    VoiceTestStatus,
)
from app.services import audit, budget, media, rights, subtitles, yoruba
from app.services import settings as settings_service
from app.services.rights import Purpose

MAX_PORTRAIT_BYTES = 5 * 1024 * 1024
TEST_CHECKS = ("tones", "dotted_letters", "numbers_naira", "terms", "natural_pace")


# ---------------------------------------------------------------- presenter
def get_presenter(db: Session) -> PresenterProfile | None:
    return (
        db.execute(select(PresenterProfile).order_by(PresenterProfile.created_at)).scalars().first()
    )


def voice_config_hash(p: PresenterProfile) -> str:
    cfg = {
        "provider": p.voice_provider,
        "voice_id": p.voice_id,
        "model": p.voice_model,
        "settings": p.voice_settings,
    }
    return hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()


def _reset_approval(db: Session, p: PresenterProfile, actor: str, why: str) -> None:
    if p.status == PresenterStatus.APPROVED:
        p.status, p.approved_by, p.approved_at = PresenterStatus.DRAFT, None, None
        audit.record(
            db,
            actor=actor,
            action="presenter.approval_reset",
            entity_type="presenter",
            entity_id=p.id,
            details={"reason": why},
        )


def save_presenter(db: Session, data: dict[str, Any], actor: str) -> PresenterProfile:
    p = get_presenter(db)
    if p is None:
        p = PresenterProfile(name=data.get("name", "").strip() or "Olùkọ́", updated_by=actor)
        db.add(p)
        db.flush()
    before = voice_config_hash(p)
    for k in (
        "name",
        "description",
        "voice_provider",
        "voice_id",
        "voice_model",
        "voice_settings",
        "voice_is_original_or_licensed",
        "portrait_is_original_or_licensed",
        "not_a_real_person",
    ):
        if k in data and data[k] is not None:
            v = data[k]
            setattr(p, k, yoruba.normalise(v.strip()) if isinstance(v, str) else v)
    if not p.name.strip():
        raise AppError("The presenter needs a name")
    p.updated_by = actor
    if voice_config_hash(p) != before:
        _reset_approval(db, p, actor, "voice changed")
    if not (
        p.voice_is_original_or_licensed
        and p.portrait_is_original_or_licensed
        and p.not_a_real_person
    ):
        _reset_approval(db, p, actor, "declarations withdrawn")
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="presenter.saved",
        entity_type="presenter",
        entity_id=p.id,
        details={
            "name": p.name,
            "voice_provider": p.voice_provider,
            "voice_id": p.voice_id,
            "voice_model": p.voice_model,
        },
    )
    return p


def attach_portrait(
    db: Session,
    storage: StorageProvider,
    p: PresenterProfile,
    *,
    data: bytes,
    content_type: str,
    actor: str,
) -> PresenterProfile:
    if not data or len(data) > MAX_PORTRAIT_BYTES:
        raise AppError("The portrait must be an image up to 5 MB")
    if not (
        (content_type == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n"))
        or (content_type == "image/jpeg" and data.startswith(b"\xff\xd8\xff"))
    ):
        raise AppError("Upload the portrait as a PNG or JPEG image")
    with tempfile.TemporaryDirectory() as tmp:  # must really decode, not just look like an image
        probe = Path(tmp) / ("p.png" if content_type == "image/png" else "p.jpg")
        probe.write_bytes(data)
        try:
            media.image_size(probe)
        except media.MediaError as exc:
            raise AppError(f"The portrait could not be used: {exc.message}") from exc
    digest = hashlib.sha256(data).hexdigest()
    key = f"presenter/{p.id}/{digest}.{'png' if content_type == 'image/png' else 'jpg'}"
    storage.put(key, data, content_type)
    p.portrait_key, p.portrait_sha256 = key, digest
    _reset_approval(db, p, actor, "portrait changed")
    audit.record(
        db,
        actor=actor,
        action="presenter.portrait_set",
        entity_type="presenter",
        entity_id=p.id,
        details={"sha256": digest, "bytes": len(data)},
    )
    return p


def passed_test(db: Session, p: PresenterProfile) -> PronunciationTest | None:
    return (
        db.execute(
            select(PronunciationTest)
            .where(
                PronunciationTest.presenter_id == p.id,
                PronunciationTest.voice_config_hash == voice_config_hash(p),
                PronunciationTest.status == VoiceTestStatus.PASSED,
            )
            .order_by(PronunciationTest.created_at.desc())
        )
        .scalars()
        .first()
    )


def approval_problems(db: Session, p: PresenterProfile) -> list[str]:
    problems = []
    if not p.voice_id.strip():
        problems.append("voice_missing")
    if not (
        p.voice_is_original_or_licensed
        and p.portrait_is_original_or_licensed
        and p.not_a_real_person
    ):
        problems.append("declarations_missing")
    if passed_test(db, p) is None:
        problems.append("pronunciation_test_not_passed")
    return problems


def approve_presenter(db: Session, p: PresenterProfile, actor: str) -> PresenterProfile:
    problems = approval_problems(db, p)
    if problems:
        raise BlockedByPolicyError(
            "The presenter cannot be approved yet", details={"problems": problems}
        )
    p.status, p.approved_by, p.approved_at = PresenterStatus.APPROVED, actor, utcnow()
    audit.record(
        db,
        actor=actor,
        action="presenter.approved",
        entity_type="presenter",
        entity_id=p.id,
        details={"voice_config": voice_config_hash(p), "portrait_sha256": p.portrait_sha256},
    )
    return p


# ---------------------------------------------------------------- pronunciation
def approved_pronunciations(db: Session) -> list[PronunciationEntry]:
    return list(
        db.execute(
            select(PronunciationEntry).where(PronunciationEntry.status == TermStatus.APPROVED)
        ).scalars()
    )


def apply_pronunciations(text: str, entries: list[PronunciationEntry]) -> str:
    """Replace written forms with their spoken form before sending text to any TTS provider.

    Provider-independent (works whether or not the provider supports pronunciation
    dictionaries). Longest entries first so "POS agent" wins over "POS".
    """
    out = yoruba.normalise(text)
    for e in sorted(entries, key=lambda x: len(x.written), reverse=True):
        out = re.sub(rf"(?<!\w){re.escape(e.written)}(?!\w)", e.spoken, out)
    return out


def test_passage(p: PresenterProfile, entries: list[PronunciationEntry]) -> list[dict[str, Any]]:
    items = [
        {
            "id": "greeting",
            "checks": ["natural_pace"],
            "text": f"Ẹ káàbọ̀ sí Ọmọlúàbí Business Academy. Èmi ni {p.name}, olùkọ́ yín.",
        },
        {
            "id": "tones",
            "checks": ["tones"],
            "text": "Owó, ọwọ́, ọ̀wọ̀. Ọkọ, ọkọ̀, ọkọ́. Igbá, ìgbà, ìgbá.",
        },
        {
            "id": "dotted",
            "checks": ["dotted_letters"],
            "text": "Ẹ̀kọ́ òní ṣe pàtàkì fún gbogbo oníṣòwò àti oníbàárà.",
        },
        {
            "id": "naira",
            "checks": ["numbers_naira"],
            "text": "Iye owó aṣọ kan jẹ́ ₦12,500, ṣùgbọ́n ẹ lè tà á ní ₦15,000.",
        },
        {
            "id": "sentence",
            "checks": ["natural_pace", "tones"],
            "text": "Ẹ má ṣe gbàgbé láti kọ gbogbo ìnáwó yín sílẹ̀ lójoojúmọ́.",
        },
    ]
    if entries:
        words = ", ".join(e.written for e in entries[:12])
        items.append(
            {"id": "terms", "checks": ["terms"], "text": f"Àwọn ọ̀rọ̀ inú ìwé atúmọ̀ wa: {words}."}
        )
    return items


def request_test(db: Session, actor: str) -> tuple[PronunciationTest, JobRun]:
    p = get_presenter(db)
    if p is None or not p.voice_id.strip():
        raise BlockedByPolicyError("Set up the presenter's voice first")
    entries = approved_pronunciations(db)
    test = PronunciationTest(
        presenter_id=p.id,
        voice_config_hash=voice_config_hash(p),
        passage=test_passage(p, entries),
        requested_by=actor,
    )
    db.add(test)
    db.flush()
    job = JobRun(task_name="voice.pronunciation_test", payload={"test_id": test.id})
    db.add(job)
    db.flush()
    test.job_id = job.id
    audit.record(
        db, actor=actor, action="voice_test.requested", entity_type="voice_test", entity_id=test.id
    )
    return test, job


def _store(
    db: Session,
    storage: StorageProvider,
    *,
    key: str,
    path: Path,
    kind: str,
    mime: str,
    run: ProductionRun | None = None,
    position: int = 0,
    seconds: float | None = None,
    is_sample: bool = False,
) -> MediaAsset:
    data = path.read_bytes()
    storage.put(key, data, mime)
    asset = MediaAsset(
        kind=kind,
        position=position,
        storage_key=key,
        mime_type=mime,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        duration_seconds=seconds,
        is_sample=is_sample,
    )
    if run is not None:
        run.assets.append(asset)  # sets run_id; one link only, so the list never duplicates
    else:
        db.add(asset)
    db.flush()
    return asset


def _synth(
    tts: TTSProvider, p: PresenterProfile, text: str, dst_dir: Path, n: int
) -> tuple[Path, int, Decimal]:
    res = tts.synthesize(
        text=text,
        voice_id=p.voice_id,
        language="yo",
        model=p.voice_model or None,
        settings=p.voice_settings or None,
    )
    ext = ".mp3" if res.mime_type == "audio/mpeg" else ".wav"
    raw = dst_dir / f"seg{n:03d}{ext}"
    raw.write_bytes(res.audio)
    wav = media.to_wav(raw, dst_dir / f"seg{n:03d}.norm.wav")
    return wav, res.characters, res.cost_usd


def run_test(
    db: Session, test: PronunciationTest, job: JobRun, tts: TTSProvider, storage: StorageProvider
) -> None:
    p = db.get(PresenterProfile, test.presenter_id)
    entries = approved_pronunciations(db)
    texts = [apply_pronunciations(i["text"], entries) for i in test.passage]
    chars = sum(len(t) for t in texts)
    test.provider, test.is_sample, job.is_sample = tts.name, tts.is_sample, tts.is_sample
    if not tts.is_sample:
        try:
            budget.reserve(db, job, tts.estimate_cost(chars), provider=tts.name)
        except BlockedByPolicyError as exc:
            test.status, test.error = VoiceTestStatus.BLOCKED, exc.message
            return
    cost = Decimal("0")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            wavs = []
            for n, text in enumerate(texts):
                wav, _, c = _synth(tts, p, text, d, n)
                wavs.append(wav)
                cost += c
            media.join_with_pauses(wavs, d / "joined.wav", pause=0.8)
            mp3 = media.normalise_to_mp3(d / "joined.wav", d / "test.mp3")
            asset = _store(
                db,
                storage,
                key=f"voice-tests/{test.id}.mp3",
                path=mp3,
                kind="voice_test",
                mime="audio/mpeg",
                seconds=media.duration(mp3),
                is_sample=tts.is_sample,
            )
    except (ProviderError, media.MediaError) as exc:
        budget.settle(db, job, cost)
        test.status, test.error, test.cost_usd = VoiceTestStatus.BLOCKED, exc.message, cost
        return
    budget.settle(db, job, cost)
    test.audio_asset_id, test.characters, test.cost_usd = asset.id, chars, cost
    test.status = VoiceTestStatus.AWAITING_REVIEW
    audit.record(
        db,
        actor="worker",
        action="voice_test.generated",
        entity_type="voice_test",
        entity_id=test.id,
        details={"characters": chars, "cost_usd": str(cost)},
    )


def rate_test(
    db: Session, test: PronunciationTest, *, ratings: dict[str, bool], notes: str | None, actor: str
) -> PronunciationTest:
    if test.status != VoiceTestStatus.AWAITING_REVIEW:
        raise BlockedByPolicyError("This test is not waiting for review")
    needed = sorted({c for item in test.passage for c in item["checks"]})
    ratings = {k: bool(ratings.get(k)) for k in needed}
    notes = (notes or "").strip() or None
    passed = all(ratings.values())
    if not passed and not notes:
        raise AppError(
            "Say what was mispronounced, so the voice settings or dictionary can be fixed"
        )
    test.ratings, test.notes, test.reviewed_by, test.reviewed_at = ratings, notes, actor, utcnow()
    test.status = VoiceTestStatus.PASSED if passed else VoiceTestStatus.FAILED
    audit.record(
        db,
        actor=actor,
        action=f"voice_test.{test.status.value}",
        entity_type="voice_test",
        entity_id=test.id,
        details={"ratings": ratings, "notes": notes},
    )
    return test


# ---------------------------------------------------------------- production
def avatar_minutes_used(db: Session) -> float:
    secs = db.execute(
        select(func.coalesce(func.sum(ProductionRun.avatar_seconds), 0.0)).where(
            ProductionRun.created_at >= budget.month_start()
        )
    ).scalar_one()
    return float(secs) / 60


def check_avatar_minutes(db: Session, needed_minutes: float) -> None:
    allowed = float(settings_service.get_value(db, "budget.max_avatar_minutes_per_month"))
    used = avatar_minutes_used(db)
    if used + needed_minutes > allowed:
        raise BlockedByPolicyError(
            "Avatar minutes for this month would be exceeded",
            details={
                "used": round(used, 2),
                "needed": round(needed_minutes, 2),
                "allowed": allowed,
            },
        )


def check_storage(db: Session, storage: StorageProvider) -> None:
    limit_gb = Decimal(settings_service.get_value(db, "storage.max_storage_gb"))
    used = Decimal(storage.usage_bytes()) / (1024**3)
    if used >= limit_gb:
        raise BlockedByPolicyError(
            "The media storage limit has been reached",
            details={"used_gb": str(round(used, 2)), "limit_gb": str(limit_gb)},
        )


def request_production(
    db: Session, *, script_id: str, video_format: str, actor: str
) -> tuple[ProductionRun, JobRun]:
    script = db.get(Script, script_id)
    if script is None:
        raise NotFoundError("Script not found")
    if (
        script.status != ScriptStatus.APPROVED
        or script.approved_revision != script.current_revision
    ):
        raise BlockedByPolicyError(
            "Only a script whose latest version passed language review can be voiced"
        )
    p = get_presenter(db)
    if p is None or p.status != PresenterStatus.APPROVED:
        raise BlockedByPolicyError(
            "Approve the presenter (voice, portrait and pronunciation test) first"
        )
    if passed_test(db, p) is None:
        raise BlockedByPolicyError("The current voice has not passed a pronunciation test")
    if script.kind == ScriptKind.ADAPTATION:
        rights.require_rights(db, script.episode_id, Purpose.ADAPTATION, actor=actor)
    if video_format == "full_avatar":
        # Enforce the cap even before a provider exists, so the rule is never skipped later.
        check_avatar_minutes(db, subtitles.total_seconds(script.revisions[-1].segments) / 60)
        raise BlockedByPolicyError(
            "No licensed avatar provider is connected. The hybrid format (portrait, voice, "
            "slides) is used by default."
        )
    if video_format != "hybrid":
        raise AppError("Unknown video format")
    run = ProductionRun(
        script_id=script.id,
        script_revision=script.current_revision,
        presenter_id=p.id,
        voice_config_hash=voice_config_hash(p),
        video_format="hybrid",
        is_sample=script.is_sample,
        requested_by=actor,
    )
    db.add(run)
    db.flush()
    job = JobRun(task_name="voice.produce", payload={"run_id": run.id})
    db.add(job)
    db.flush()
    run.job_id = job.id
    audit.record(
        db,
        actor=actor,
        action="production.requested",
        entity_type="production_run",
        entity_id=run.id,
        details={"script_id": script.id, "revision": script.current_revision},
    )
    return run, job


def run_production(
    db: Session, run: ProductionRun, job: JobRun, tts: TTSProvider, storage: StorageProvider
) -> None:
    script = db.get(Script, run.script_id)
    p = db.get(PresenterProfile, run.presenter_id)
    rev = next(r for r in script.revisions if r.number == run.script_revision)

    def stop(status: RunStatus, reason: str) -> None:
        run.status, run.error, run.finished_at = status, reason, utcnow()

    run.status = RunStatus.RUNNING
    if voice_config_hash(p) != run.voice_config_hash or p.status != PresenterStatus.APPROVED:
        return stop(RunStatus.BLOCKED, "The presenter changed after this run was requested")
    if script.kind == ScriptKind.ADAPTATION:
        try:
            rights.require_rights(db, script.episode_id, Purpose.ADAPTATION, actor="worker")
        except BlockedByPolicyError as exc:
            codes = ", ".join(r["code"] for r in exc.details.get("reasons", []))
            return stop(RunStatus.BLOCKED, f"Rights check failed: {codes}")
    problems = media.available()
    if problems:
        return stop(RunStatus.FAILED, "; ".join(problems))
    try:
        check_storage(db, storage)
    except BlockedByPolicyError as exc:
        return stop(RunStatus.BLOCKED, exc.message)

    entries = approved_pronunciations(db)
    texts = [apply_pronunciations(s["text_yo"], entries) for s in rev.segments]
    chars = sum(len(t) for t in texts)
    run.tts_provider, run.is_sample = tts.name, run.is_sample or tts.is_sample
    job.is_sample = tts.is_sample
    if not tts.is_sample:
        try:
            budget.reserve(db, job, tts.estimate_cost(chars), provider=tts.name)
        except BlockedByPolicyError as exc:
            return stop(RunStatus.BLOCKED, exc.message)

    cost = Decimal("0")
    sample = run.is_sample
    try:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            wavs = []
            for n, text in enumerate(texts):
                wav, _, c = _synth(tts, p, text, d, n)
                cost += c
                wavs.append(wav)
                _store(
                    db,
                    storage,
                    key=f"runs/{run.id}/segment-{n + 1:03d}.wav",
                    path=wav,
                    kind="segment_audio",
                    mime="audio/wav",
                    run=run,
                    position=n + 1,
                    seconds=media.duration(wav),
                    is_sample=sample,
                )
            durations = media.join_with_pauses(wavs, d / "joined.wav")
            mp3 = media.normalise_to_mp3(d / "joined.wav", d / "narration.mp3")
            total = media.duration(mp3)
            _store(
                db,
                storage,
                key=f"runs/{run.id}/narration.mp3",
                path=mp3,
                kind="narration",
                mime="audio/mpeg",
                run=run,
                seconds=total,
                is_sample=sample,
            )
            wave = media.waveform(mp3, d / "waveform.png")
            _store(
                db,
                storage,
                key=f"runs/{run.id}/waveform.png",
                path=wave,
                kind="waveform",
                mime="image/png",
                run=run,
                is_sample=sample,
            )
            for lang in ("yo", "en"):
                srt = d / f"captions-{lang}.srt"
                srt.write_text(
                    subtitles.to_srt(subtitles.build_cues(rev.segments, lang, durations)),
                    encoding="utf-8",
                )
                _store(
                    db,
                    storage,
                    key=f"runs/{run.id}/captions-{lang}.srt",
                    path=srt,
                    kind=f"captions_{lang}",
                    mime="application/x-subrip",
                    run=run,
                    is_sample=sample,
                )
            n_seg = len(rev.segments)
            for n, seg in enumerate(rev.segments, start=1):
                png = media.slide(
                    d / f"slide-{n:03d}.png",
                    heading=rev.title_yo,
                    body=seg["text_yo"],
                    footer=f"ỌMỌLÚÀBÍ BUSINESS ACADEMY  ·  {n}/{n_seg}",
                )
                _store(
                    db,
                    storage,
                    key=f"runs/{run.id}/slide-{n:03d}.png",
                    path=png,
                    kind="slide",
                    mime="image/png",
                    run=run,
                    position=n,
                    is_sample=sample,
                )
            portrait = d / "portrait.png"
            if p.portrait_key:
                portrait = d / ("portrait" + Path(p.portrait_key).suffix)
                portrait.write_bytes(storage.get(p.portrait_key))
            else:
                media.placeholder_portrait(portrait)
            clip = media.presenter_clip(portrait, mp3, d / "presenter.mp4", seconds=total)
            _store(
                db,
                storage,
                key=f"runs/{run.id}/presenter.mp4",
                path=clip,
                kind="presenter_clip",
                mime="video/mp4",
                run=run,
                seconds=media.duration(clip),
                is_sample=sample,
            )
    except (ProviderError, media.MediaError) as exc:
        budget.settle(db, job, cost)
        run.tts_cost_usd = run.total_cost_usd = cost
        return stop(RunStatus.FAILED, exc.message)

    budget.settle(db, job, cost)
    run.tts_characters, run.tts_cost_usd = chars, cost
    run.total_cost_usd = cost + run.avatar_cost_usd
    run.duration_seconds, run.segment_durations = total, durations
    run.status, run.finished_at = RunStatus.COMPLETED, utcnow()
    audit.record(
        db,
        actor="worker",
        action="production.completed",
        entity_type="production_run",
        entity_id=run.id,
        details={
            "seconds": total,
            "characters": chars,
            "cost_usd": str(run.total_cost_usd),
            "assets": len(run.assets),
        },
    )
