from decimal import Decimal

import pytest
from sqlalchemy import select

from app.adapters.sample import SampleTTS
from app.adapters.storage.local import LocalStorage
from app.core.errors import AppError, BlockedByPolicyError
from app.models import (
    JobRun,
    PresenterStatus,
    PronunciationEntry,
    RunStatus,
    TermStatus,
    VoiceTestStatus,
)
from app.services import media, scripts, subtitles, voice
from app.services import settings as settings_service
from tests.fakes import FakeLiveTTS
from tests.test_scripts import FULL, GOOD_SCRIPT, generate, original, topic  # noqa: F401 (fixtures)

ACTOR = "owner:o@x.ng"
FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64  # right header, not an image


@pytest.fixture(scope="module")
def real_png(tmp_path_factory):
    return media.placeholder_portrait(tmp_path_factory.mktemp("img") / "p.png").read_bytes()


DECLARED = dict(
    voice_is_original_or_licensed=True,
    portrait_is_original_or_licensed=True,
    not_a_real_person=True,
)


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(tmp_path / "store")


def make_presenter(db, **over):
    data = dict(
        name="Olùkọ́ Adéwálé",
        description="Original presenter",
        voice_id="VOICE1",
        voice_model="eleven_multilingual_v2",
        voice_settings={"stability": 0.5},
        **DECLARED,
    )
    data.update(over)
    return voice.save_presenter(db, data, ACTOR)


def passed_presenter(db, storage, tts=None):
    p = make_presenter(db)
    test, job = voice.request_test(db, ACTOR)
    voice.run_test(db, test, job, tts or SampleTTS(), storage)
    voice.rate_test(
        db, test, ratings=dict.fromkeys(voice.TEST_CHECKS, True), notes=None, actor="reviewer:r"
    )
    voice.approve_presenter(db, p, ACTOR)
    return p


@pytest.fixture
def approved_script(db, original):  # noqa: F811
    scripts.submit_for_review(db, original, ACTOR)
    scripts.review(
        db, original, decision="approved", checklist=FULL, comments=None, actor="reviewer:r"
    )
    return original


# ---------------------------------------------------------------- presenter
def test_voice_change_resets_approval_and_invalidates_test(db, storage):
    p = passed_presenter(db, storage)
    assert p.status == PresenterStatus.APPROVED and voice.passed_test(db, p) is not None
    voice.save_presenter(db, {"description": "New bio"}, ACTOR)
    assert p.status == PresenterStatus.APPROVED  # description is not the voice
    voice.save_presenter(db, {"voice_settings": {"stability": 0.9}}, ACTOR)
    assert p.status == PresenterStatus.DRAFT and voice.passed_test(db, p) is None
    assert voice.approval_problems(db, p) == ["pronunciation_test_not_passed"]


def test_approval_needs_declarations_voice_and_test(db, storage):
    p = make_presenter(db, voice_id="", not_a_real_person=False)
    assert set(voice.approval_problems(db, p)) == {
        "voice_missing",
        "declarations_missing",
        "pronunciation_test_not_passed",
    }
    with pytest.raises(BlockedByPolicyError):
        voice.approve_presenter(db, p, ACTOR)


def test_portrait_validation_and_reset(db, storage, real_png):
    p = passed_presenter(db, storage)
    with pytest.raises(AppError, match="PNG or JPEG"):
        voice.attach_portrait(db, storage, p, data=b"GIF89a", content_type="image/png", actor=ACTOR)
    with pytest.raises(AppError, match="could not be used"):  # a corrupt file is refused up front
        voice.attach_portrait(db, storage, p, data=FAKE_PNG, content_type="image/png", actor=ACTOR)
    voice.attach_portrait(db, storage, p, data=real_png, content_type="image/png", actor=ACTOR)
    assert storage.get(p.portrait_key) == real_png and p.status == PresenterStatus.DRAFT


def test_ffmpeg_timeout_is_an_error_not_a_hang(tmp_path):
    with pytest.raises(media.MediaError, match="timed out"):
        media.ffmpeg(
            "-f", "lavfi", "-i", "anullsrc", "-t", "600", str(tmp_path / "x.wav"), timeout=0.5
        )


# ---------------------------------------------------------------- pronunciation
def test_apply_pronunciations_longest_first_and_whole_words():
    entries = [
        PronunciationEntry(written="POS", spoken="pí-ó-ẹ́sì"),
        PronunciationEntry(written="POS agent", spoken="aṣojú pí-ó-ẹ́sì"),
    ]
    out = voice.apply_pronunciations("Ẹ lọ sí POS agent. POSITIVE ni POS.", entries)
    assert out == "Ẹ lọ sí aṣojú pí-ó-ẹ́sì. POSITIVE ni pí-ó-ẹ́sì."


def test_passage_covers_tones_naira_name_and_terms(db):
    p = make_presenter(db)
    db.add(
        PronunciationEntry(
            written="POS", spoken="pí-ó-ẹ́sì", status=TermStatus.APPROVED, created_by="o"
        )
    )
    db.flush()
    passage = voice.test_passage(p, voice.approved_pronunciations(db))
    text = " ".join(i["text"] for i in passage)
    assert "Olùkọ́ Adéwálé" in text and "ọwọ́" in text and "₦12,500" in text and "POS" in text
    assert {c for i in passage for c in i["checks"]} == set(voice.TEST_CHECKS)


def test_pronunciation_test_flow(db, storage):
    make_presenter(db)
    test, job = voice.request_test(db, ACTOR)
    voice.run_test(db, test, job, SampleTTS(), storage)
    assert test.status == VoiceTestStatus.AWAITING_REVIEW and test.is_sample and test.cost_usd == 0
    from app.models import MediaAsset

    asset = db.get(MediaAsset, test.audio_asset_id)
    assert asset.kind == "voice_test" and asset.duration_seconds > 3
    with pytest.raises(AppError, match="mispronounced"):
        voice.rate_test(db, test, ratings={"tones": False}, notes="", actor="reviewer:r")
    voice.rate_test(
        db, test, ratings={"tones": False}, notes="ọkọ̀ sounded like ọkọ", actor="reviewer:r"
    )
    assert test.status == VoiceTestStatus.FAILED and test.reviewed_by == "reviewer:r"


def test_live_test_costs_by_characters_and_respects_budget(db, storage):
    make_presenter(db)
    test, job = voice.request_test(db, ACTOR)
    tts = FakeLiveTTS(rate="0.30")
    voice.run_test(db, test, job, tts, storage)
    chars = sum(len(c["text"]) for c in tts.calls)
    assert test.characters == chars and test.cost_usd == tts.estimate_cost(chars)
    assert job.cost_usd == test.cost_usd and tts.calls[0]["voice_id"] == "VOICE1"
    settings_service.update_setting(db, key="budget.monthly_limit_usd", value="0", actor="o")
    test2, job2 = voice.request_test(db, ACTOR)
    tts2 = FakeLiveTTS()
    voice.run_test(db, test2, job2, tts2, storage)
    assert test2.status == VoiceTestStatus.BLOCKED and tts2.calls == []


# ---------------------------------------------------------------- production
def test_production_needs_approved_script_and_presenter(db, storage, original):  # noqa: F811
    with pytest.raises(BlockedByPolicyError, match="language review"):
        voice.request_production(db, script_id=original.id, video_format="hybrid", actor=ACTOR)
    scripts.submit_for_review(db, original, ACTOR)
    scripts.review(db, original, decision="approved", checklist=FULL, comments=None, actor="r")
    with pytest.raises(BlockedByPolicyError, match="Approve the presenter"):
        voice.request_production(db, script_id=original.id, video_format="hybrid", actor=ACTOR)


def test_full_avatar_is_capped_and_needs_a_provider(db, storage, approved_script):
    passed_presenter(db, storage)
    with pytest.raises(BlockedByPolicyError, match="Avatar minutes"):
        voice.request_production(
            db, script_id=approved_script.id, video_format="full_avatar", actor=ACTOR
        )
    settings_service.update_setting(
        db, key="budget.max_avatar_minutes_per_month", value=30, actor="o", confirm_increase=True
    )
    with pytest.raises(BlockedByPolicyError, match="No licensed avatar provider"):
        voice.request_production(
            db, script_id=approved_script.id, video_format="full_avatar", actor=ACTOR
        )


def produce(db, storage, script, tts=None):
    run, job = voice.request_production(db, script_id=script.id, video_format="hybrid", actor=ACTOR)
    voice.run_production(db, run, job, tts or SampleTTS(), storage)
    return run, job


def test_hybrid_production_creates_synced_assets(db, storage, approved_script):
    passed_presenter(db, storage)
    run, job = produce(db, storage, approved_script)
    assert run.status == RunStatus.COMPLETED, run.error
    kinds = [a.kind for a in run.assets]
    n = len(approved_script.revisions[-1].segments)
    assert kinds.count("segment_audio") == n and kinds.count("slide") == n
    for k in ("narration", "waveform", "captions_yo", "captions_en", "presenter_clip"):
        assert kinds.count(k) == 1, k
    narration = next(a for a in run.assets if a.kind == "narration")
    clip = next(a for a in run.assets if a.kind == "presenter_clip")
    assert abs(sum(run.segment_durations) - narration.duration_seconds) < 0.1
    assert abs(clip.duration_seconds - narration.duration_seconds) < 0.15
    srt = storage.get(next(a for a in run.assets if a.kind == "captions_en").storage_key).decode()
    cues = subtitles.build_cues(approved_script.revisions[-1].segments, "en", run.segment_durations)
    assert abs(cues[-1].end - sum(run.segment_durations)) < 0.01 and srt.count("-->") == len(cues)
    assert run.is_sample and run.total_cost_usd == 0 and run.video_format == "hybrid"


def test_live_production_records_cost_per_job(db, storage, approved_script):
    passed_presenter(db, storage)
    tts = FakeLiveTTS(rate="0.30")
    run, job = produce(db, storage, approved_script, tts)
    chars = sum(len(c["text"]) for c in tts.calls)
    assert run.tts_characters == chars and run.tts_cost_usd == tts.estimate_cost(chars)
    assert run.total_cost_usd == run.tts_cost_usd == db.get(JobRun, job.id).cost_usd


def test_provider_failure_mid_run_is_recorded(db, storage, approved_script):
    passed_presenter(db, storage)
    run, job = produce(db, storage, approved_script, FakeLiveTTS(fail_after=1))
    assert run.status == RunStatus.FAILED and "500" in run.error
    assert run.tts_cost_usd > 0  # the segment that was synthesised is still paid for and recorded


def test_presenter_change_after_request_blocks(db, storage, approved_script):
    passed_presenter(db, storage)
    run, job = voice.request_production(
        db, script_id=approved_script.id, video_format="hybrid", actor=ACTOR
    )
    voice.save_presenter(db, {"voice_id": "OTHER"}, ACTOR)
    voice.run_production(db, run, job, SampleTTS(), storage)
    assert run.status == RunStatus.BLOCKED and "presenter changed" in run.error


def test_storage_limit_blocks(db, storage, approved_script, monkeypatch):
    passed_presenter(db, storage)
    monkeypatch.setattr(storage, "usage_bytes", lambda: 11 * 1024**3)
    run, _ = produce(db, storage, approved_script)
    assert run.status == RunStatus.BLOCKED and "storage limit" in run.error


def test_missing_ffmpeg_fails_honestly(db, storage, approved_script, monkeypatch):
    passed_presenter(db, storage)
    monkeypatch.setattr(media, "available", lambda: ["ffmpeg is not installed"])
    run, _ = produce(db, storage, approved_script)
    assert run.status == RunStatus.FAILED and "ffmpeg" in run.error


def test_avatar_minutes_used_counts_this_month(db):
    assert voice.avatar_minutes_used(db) == 0.0
    assert Decimal(settings_service.get_value(db, "budget.max_avatar_minutes_per_month")) == 0
    assert db.execute(select(JobRun)).scalars().all() == []
