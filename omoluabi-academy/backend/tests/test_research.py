from decimal import Decimal

import pytest
from sqlalchemy import select

from app.adapters.sample import SampleLLM, SampleVideoSource
from app.core.errors import AppError, BlockedByPolicyError
from app.models import (
    AuditLog,
    AuthorisationBasis,
    Episode,
    EpisodeStatus,
    JobRun,
    ReportStatus,
    Topic,
    TopicStatus,
    TranscriptSource,
)
from app.services import budget, discovery, research
from app.services import settings as settings_service
from tests.fakes import FakeLiveLLM, good_report

TRANSCRIPT = (
    "today we talk about pricing and why most small shops undercharge for the value they "
    "deliver every single day to their loyal customers in the market"
)


@pytest.fixture
def episode(db):
    ch = discovery.add_channel(
        db,
        SampleVideoSource(),
        reference="@s",
        basis=AuthorisationBasis.RESEARCH_ONLY,
        note="Research only, public videos",
        actor="o",
    )
    discovery.scan_channel(db, ch, SampleVideoSource(), max_videos=1)
    return db.execute(select(Episode)).scalar_one()


def _run(db, llm, **kw):
    report, job = research.request_report(db, actor="owner:t", **kw)
    research.run_report(db, report, job, llm)
    db.flush()
    return report, job


def test_transcript_requires_permission_and_size_limit(db, episode):
    with pytest.raises(AppError, match="why we may hold"):
        research.save_transcript(
            db,
            episode,
            text="x",
            language="en",
            source=TranscriptSource.OWNER_ENTERED,
            permission_reference="",
            actor="o",
        )
    with pytest.raises(AppError, match="too long"):
        research.save_transcript(
            db,
            episode,
            text="a" * (research.MAX_TRANSCRIPT_CHARS + 1),
            language="en",
            source=TranscriptSource.LICENSOR_PROVIDED,
            permission_reference="Licence L-2026-001",
            actor="o",
        )
    tr = research.save_transcript(
        db,
        episode,
        text=TRANSCRIPT,
        language="en",
        source=TranscriptSource.LICENSOR_PROVIDED,
        permission_reference="Licence L-2026-001",
        actor="o",
    )
    assert tr.word_count == len(TRANSCRIPT.split())


def test_sample_mode_report_is_labelled_and_free(db, episode):
    report, job = _run(db, SampleLLM(), episode_id=episode.id, subject=None)
    assert report.status == ReportStatus.COMPLETED and report.is_sample
    assert report.cost_usd == 0 and job.cost_usd == 0
    assert all(t.is_sample for t in report.topics) and len(report.topics) >= 1
    assert episode.status == EpisodeStatus.RESEARCHED


def test_live_report_records_cost_topics_and_prompt_rules(db, episode):
    llm = FakeLiveLLM(good_report(), cost="0.0420")
    report, job = _run(db, llm, episode_id=episode.id, subject=None)
    assert report.status == ReportStatus.COMPLETED
    # A live model studying a *sample* episode still produces sample-labelled output.
    assert report.is_sample is True and report.provider == "fake-live-llm"
    assert report.cost_usd == Decimal("0.0420") and job.cost_usd == Decimal("0.0420")
    assert [t.title for t in report.topics] == [
        "Pricing for profit in an inflationary economy",
        "Bundling products to raise basket size",
    ]
    sent = llm.calls[0]
    assert "Do not reproduce the source" in sent["system"]
    assert sent["schema"] == research.REPORT_SCHEMA
    assert episode.title in sent["messages"][0].content


def test_independent_subject_needs_no_episode(db):
    report, _ = _run(
        db,
        FakeLiveLLM(good_report()),
        episode_id=None,
        subject="Managing cash flow for market traders",
    )
    assert report.status == ReportStatus.COMPLETED and report.episode_id is None
    assert report.is_sample is False and all(not t.is_sample for t in report.topics)


def test_copied_text_is_flagged_and_blocks_approval(db, episode):
    research.save_transcript(
        db,
        episode,
        text=TRANSCRIPT,
        language="en",
        source=TranscriptSource.LICENSOR_PROVIDED,
        permission_reference="Licence L-2026-001",
        actor="o",
    )
    copied = good_report(summary="As he said: " + TRANSCRIPT)
    report, _ = _run(db, FakeLiveLLM(copied), episode_id=episode.id, subject=None)
    assert report.overlap_flagged and report.max_verbatim_overlap_words >= 20
    with pytest.raises(BlockedByPolicyError, match="word for word"):
        research.decide_topic(
            db, report.topics[0], decision=TopicStatus.APPROVED, note=None, actor="owner:t"
        )


def test_refusal_blocks_without_inventing_content(db, episode):
    report, _ = _run(db, FakeLiveLLM(refused=True), episode_id=episode.id, subject=None)
    assert report.status == ReportStatus.BLOCKED and report.topics == []
    assert "declined" in report.error and report.cost_usd > 0


def test_malformed_answer_fails_cleanly(db, episode):
    report, _ = _run(
        db, FakeLiveLLM({"summary": "x", "topics": []}), episode_id=episode.id, subject=None
    )
    assert report.status == ReportStatus.FAILED and report.topics == []


def test_provider_error_releases_budget_reservation(db, episode):
    report, job = _run(
        db, FakeLiveLLM(error="Anthropic API error 500"), episode_id=episode.id, subject=None
    )
    assert report.status == ReportStatus.FAILED and job.cost_usd == 0


def test_budget_guard_blocks_before_spending(db, episode):
    settings_service.update_setting(db, key="budget.monthly_limit_usd", value="1", actor="o")
    db.add(JobRun(task_name="earlier", cost_usd=Decimal("0.80")))  # already spent this month
    db.flush()
    llm = FakeLiveLLM(good_report(), estimate="0.50")
    report, job = _run(db, llm, episode_id=episode.id, subject=None)
    assert report.status == ReportStatus.BLOCKED and "spending limit" in report.error
    assert llm.calls == []  # the paid call never happened
    assert "budget.blocked" in db.execute(select(AuditLog.action)).scalars().all()


def test_reservation_counts_toward_spend(db, episode):
    report, job = research.request_report(db, episode_id=episode.id, subject=None, actor="o")
    before = budget.month_spend(db)
    budget.reserve(db, job, Decimal("0.30"), provider="fake")
    assert budget.month_spend(db) - before == Decimal("0.30")


def test_topic_decisions_are_audited(db, episode):
    report, _ = _run(db, FakeLiveLLM(good_report()), episode_id=episode.id, subject=None)
    t1, t2 = report.topics
    research.decide_topic(db, t1, decision=TopicStatus.APPROVED, note="Great fit", actor="owner:t")
    research.decide_topic(db, t2, decision=TopicStatus.REJECTED, note=None, actor="owner:t")
    assert (t1.status, t2.status) == (TopicStatus.APPROVED, TopicStatus.REJECTED)
    assert t1.decided_by == "owner:t" and t1.decided_at is not None
    actions = db.execute(select(AuditLog.action)).scalars().all()
    assert "topic.approved" in actions and "topic.rejected" in actions
    with pytest.raises(AppError):
        research.decide_topic(db, t1, decision=TopicStatus.PROPOSED, note=None, actor="o")
    assert db.execute(select(Topic)).scalars().all()


@pytest.mark.parametrize(
    "src,gen,expected",
    [
        ("one two three four five six seven", "nothing alike here at all friends", 0),
        ("a b c d e f g h i j", "x a b c d e f g y", 7),
    ],
)
def test_overlap_measure(src, gen, expected):
    assert research.longest_verbatim_overlap(src, gen) == expected
