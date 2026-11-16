import pytest
from sqlalchemy import select

from app.adapters.sample import SampleLLM, SampleVideoSource
from app.core.errors import AppError, BlockedByPolicyError
from app.models import (
    AuditLog,
    AuthorisationBasis,
    Episode,
    GlossaryTerm,
    JobRun,
    ScriptFormat,
    ScriptStatus,
    TermStatus,
    TopicStatus,
    TranscriptSource,
)
from app.services import discovery, research, rights, scripts
from app.services import settings as settings_service
from tests.fakes import FakeLiveLLM
from tests.test_rights import ACTOR, make  # licence helpers

FULL = dict.fromkeys(scripts.REVIEW_CHECKLIST, True)
GOOD_SCRIPT = {
    "title_en": "Pricing for profit",
    "title_yo": "Bí a ṣe ń díyelé ọjà fún èrè",
    "segments": [
        {
            "text_yo": "Ẹ káàbọ̀. Lónìí a ó kọ́ bí a ṣe ń díyelé ọjà wa.",
            "text_en": "Welcome. Today we learn how to price our goods.",
            "visual": "Title",
        },
        {
            "text_yo": "Bí aṣọ kan bá ń ná yín ní ₦8,000, ẹ má tà á ní ₦8,500 nìkan.",
            "text_en": "If a fabric costs you ₦8,000, do not sell it for only ₦8,500.",
            "visual": "Prices",
        },
    ],
    "notes_for_reviewer": ["díyelé: check this verb"],
}


@pytest.fixture
def topic(db):
    ch = discovery.add_channel(
        db,
        SampleVideoSource(),
        reference="@s",
        basis=AuthorisationBasis.RESEARCH_ONLY,
        note="Research only, public videos",
        actor="o",
    )
    discovery.scan_channel(db, ch, SampleVideoSource(), max_videos=1)
    rep, job = research.request_report(
        db, episode_id=None, subject="Pricing for traders", actor="o"
    )
    research.run_report(
        db, rep, job, FakeLiveLLM(__import__("tests.fakes", fromlist=["x"]).good_report())
    )
    t = rep.topics[0]
    research.decide_topic(db, t, decision=TopicStatus.APPROVED, note=None, actor=ACTOR)
    db.flush()
    return t


def generate(db, script, job, llm=None, mode="generate", instructions=None):
    scripts.run_generation(
        db, script, job, llm or FakeLiveLLM(GOOD_SCRIPT), mode=mode, instructions=instructions
    )
    db.flush()


@pytest.fixture
def original(db, topic):
    s, job = scripts.create_original(
        db, topic_id=topic.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
    )
    generate(db, s, job)
    return s


# ---------------------------------------------------------------- original lessons
def test_only_approved_topics_become_lessons(db, topic):
    topic.status = TopicStatus.PROPOSED
    with pytest.raises(BlockedByPolicyError):
        scripts.create_original(
            db, topic_id=topic.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
        )


def test_generation_creates_checked_revision_and_records_cost(db, original):
    assert original.status == ScriptStatus.DRAFT and original.current_revision == 1
    rev = original.revisions[0]
    assert rev.origin == "generated" and rev.cost_usd > 0
    assert rev.quality["score"] == 100 and rev.originality["flagged"] is False
    assert [s["id"] for s in rev.segments] == ["s1", "s2"]
    assert "díyelé: check this verb" in rev.change_note
    assert original.title_yo == "Bí a ṣe ń díyelé ọjà fún èrè"


def test_prompt_contains_rules_research_and_only_approved_glossary(db, topic):
    db.add_all(
        [
            GlossaryTerm(
                english="profit", yoruba="èrè", status=TermStatus.APPROVED, created_by="o"
            ),
            GlossaryTerm(english="loss", yoruba="XXX", status=TermStatus.PROPOSED, created_by="o"),
        ]
    )
    s, job = scripts.create_original(
        db, topic_id=topic.id, fmt=ScriptFormat.SHORT, target_minutes=1, actor=ACTOR
    )
    llm = FakeLiveLLM(GOOD_SCRIPT)
    generate(db, s, job, llm)
    system, msg = llm.calls[0]["system"], llm.calls[0]["messages"][0].content
    assert "dot below" in system and "Never imitate any real person" in system
    assert "ORIGINAL lesson" in msg and topic.title in msg and "under 60 seconds" in msg
    assert "profit → èrè" in msg and "XXX" not in msg
    assert llm.calls[0]["schema"] == scripts.SCRIPT_SCHEMA


def test_sample_mode_script_passes_checks_and_is_labelled(db, topic):
    s, job = scripts.create_original(
        db, topic_id=topic.id, fmt=ScriptFormat.LONG, target_minutes=2, actor=ACTOR
    )
    generate(db, s, job, SampleLLM())
    rev = s.revisions[0]
    assert rev.is_sample and rev.cost_usd == 0 and not rev.quality["errors"]


def test_copied_wording_blocks_review(db, topic):
    ep = db.execute(select(Episode)).scalars().first()
    source = "every trader should count stock each evening before closing the shop and record it"
    research.save_transcript(
        db,
        ep,
        text=source,
        language="en",
        source=TranscriptSource.OWNER_ENTERED,
        permission_reference="my own notes",
        actor="o",
    )
    copied = dict(
        GOOD_SCRIPT,
        segments=[{"text_yo": "Ẹ ka ọjà yín.", "text_en": source.capitalize() + ".", "visual": ""}],
    )
    s, job = scripts.create_original(
        db, topic_id=topic.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
    )
    generate(db, s, job, FakeLiveLLM(copied))
    assert s.revisions[0].originality["flagged"]
    with pytest.raises(BlockedByPolicyError, match="automated checks"):
        scripts.submit_for_review(db, s, ACTOR)


# ---------------------------------------------------------------- review workflow
def test_review_requires_full_checklist_and_records_reviewer(db, original):
    scripts.submit_for_review(db, original, ACTOR)
    assert original.status == ScriptStatus.IN_REVIEW
    with pytest.raises(AppError, match="every checklist item"):
        scripts.review(
            db,
            original,
            decision="approved",
            checklist={"tone_marks": True},
            comments=None,
            actor="reviewer:r@x.ng",
        )
    with pytest.raises(AppError, match="Explain"):
        scripts.review(
            db,
            original,
            decision="changes_requested",
            checklist={},
            comments="",
            actor="reviewer:r@x.ng",
        )
    scripts.review(
        db,
        original,
        decision="approved",
        checklist=FULL,
        comments="Ó dára",
        actor="reviewer:r@x.ng",
    )
    assert original.status == ScriptStatus.APPROVED and original.approved_revision == 1
    assert original.reviews[0].reviewer == "reviewer:r@x.ng"


def test_edits_create_revisions_and_supersede_approval(db, original):
    scripts.submit_for_review(db, original, ACTOR)
    with pytest.raises(BlockedByPolicyError, match="being reviewed"):
        scripts.add_human_revision(
            db,
            original,
            title_yo="x",
            segments=GOOD_SCRIPT["segments"],
            change_note="fix",
            actor=ACTOR,
        )
    scripts.review(db, original, decision="approved", checklist=FULL, comments=None, actor="r")
    segs = [dict(s) for s in original.revisions[0].segments]
    segs[0]["text_yo"] = "Ẹ káàbọ̀ o! Lónìí a ó kọ́ bí a ṣe ń díyelé ọjà."
    rev = scripts.add_human_revision(
        db,
        original,
        title_yo=original.title_yo,
        segments=segs,
        change_note="Warmer greeting",
        actor="reviewer:r@x.ng",
    )
    assert rev.number == 2 and original.status == ScriptStatus.DRAFT
    assert original.approved_revision == 1  # history kept, but no longer the current text
    assert original.revisions[0].segments[0]["text_yo"].startswith("Ẹ káàbọ̀. ")  # unchanged
    actions = db.execute(select(AuditLog.action)).scalars().all()
    assert "script.approval_superseded" in actions


def test_revise_with_instructions(db, original):
    job = scripts.request_revision(db, original, instructions="Use a Kano example too", actor=ACTOR)
    llm = FakeLiveLLM(GOOD_SCRIPT)
    generate(db, original, job, llm, mode="revise", instructions="Use a Kano example too")
    assert original.current_revision == 2 and original.revisions[1].origin == "revised"
    msg = llm.calls[0]["messages"][0].content
    assert "Use a Kano example too" in msg and "<current_script>" in msg


def test_refusal_and_budget_never_produce_text(db, topic):
    s, job = scripts.create_original(
        db, topic_id=topic.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
    )
    generate(db, s, job, FakeLiveLLM(refused=True))
    assert s.status == ScriptStatus.BLOCKED and s.revisions == [] and "declined" in s.blocked_reason
    settings_service.update_setting(db, key="budget.monthly_limit_usd", value="0", actor="o")
    s2, job2 = scripts.create_original(
        db, topic_id=topic.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
    )
    llm = FakeLiveLLM(GOOD_SCRIPT)
    generate(db, s2, job2, llm)
    assert s2.status == ScriptStatus.BLOCKED and llm.calls == []


def test_srt_export(db, original):
    srt = scripts.srt(original, "yo")
    assert srt.startswith("1\n00:00:00,000 --> ") and "₦8,000" in srt
    assert "Welcome." in scripts.srt(original, "en")


# ---------------------------------------------------------------- licensed adaptations
@pytest.fixture
def licensed_episode(db, tmp_path):
    from app.adapters.storage.local import LocalStorage
    from app.models import SourceChannel
    from tests.test_rights import _episode

    ch = SourceChannel(
        platform="youtube",
        external_id="UC" + "Z" * 22,
        title="Licensed",
        authorisation_basis=AuthorisationBasis.LICENSED,
        authorisation_note="Licence AH-1 signed",
        authorised_by=ACTOR,
    )
    db.add(ch)
    db.flush()
    ep = _episode(db, ch, 7)
    research.save_transcript(
        db,
        ep,
        text="We teach pricing.",
        language="en",
        source=TranscriptSource.LICENSOR_PROVIDED,
        permission_reference="Licence AH-1 schedule A",
        actor="o",
    )
    storage = LocalStorage(tmp_path)
    lic = make(
        db,
        storage,
        ep,
        attribution_required=True,
        attribution_text="Adapted with permission from the original creator.",
    )
    return ep, lic


def test_adaptation_needs_verified_rights(db, topic):
    ep = db.execute(select(Episode)).scalars().first()
    with pytest.raises(BlockedByPolicyError, match="Rights check failed"):
        scripts.create_adaptation(
            db, episode_id=ep.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
        )


def test_adaptation_flow_credit_and_rights_rechecks(db, licensed_episode):
    ep, lic = licensed_episode
    s, job = scripts.create_adaptation(
        db, episode_id=ep.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
    )
    llm = FakeLiveLLM(GOOD_SCRIPT)
    generate(db, s, job, llm)
    assert "LICENSED ADAPTATION" in llm.calls[0]["messages"][0].content
    assert "We teach pricing." in llm.calls[0]["messages"][0].content
    credit = s.revisions[0].segments[-1]
    assert credit["locked"] and "permission" in credit["text_en"]
    # the credit cannot be edited away
    rev = scripts.add_human_revision(
        db,
        s,
        title_yo=s.title_yo,
        segments=GOOD_SCRIPT["segments"],
        change_note="edit",
        actor=ACTOR,
    )
    assert rev.segments[-1]["id"] == "credit"
    # licence revoked: review approval is refused
    scripts.submit_for_review(db, s, ACTOR)
    rights.revoke_licence(db, lic, reason="Agreement ended", actor=ACTOR)
    with pytest.raises(BlockedByPolicyError, match="Rights check failed"):
        scripts.review(db, s, decision="approved", checklist=FULL, comments=None, actor="r")


def test_generation_stops_if_rights_lapse(db, licensed_episode):
    ep, lic = licensed_episode
    s, job = scripts.create_adaptation(
        db, episode_id=ep.id, fmt=ScriptFormat.LONG, target_minutes=8, actor=ACTOR
    )
    rights.revoke_licence(db, lic, reason="Agreement ended", actor=ACTOR)
    llm = FakeLiveLLM(GOOD_SCRIPT)
    generate(db, s, job, llm)
    assert s.status == ScriptStatus.BLOCKED and llm.calls == []
    assert "licence_revoked" in s.blocked_reason
    assert db.get(JobRun, job.id).cost_usd == 0


# ---------------------------------------------------------------- glossary & pronunciation
def test_glossary_changes_need_reapproval(db):
    t = scripts.save_term(db, english="  Cash Flow ", yoruba_text="ìṣàn owó", notes=None, actor="o")
    assert t.english == "cash flow" and t.status == TermStatus.PROPOSED
    scripts.approve_entry(db, t, "reviewer:r")
    assert scripts.approved_glossary(db) == {"cash flow": "ìṣàn owó"}
    scripts.save_term(
        db, english="cash flow", yoruba_text="ìṣàn owó wọlé", notes=None, actor="o", term=t
    )
    assert scripts.approved_glossary(db) == {}
    with pytest.raises(AppError, match="already"):
        scripts.save_term(db, english="cash flow", yoruba_text="x", notes=None, actor="o")


def test_seed_glossary_adds_only_proposals(db):
    assert scripts.seed_glossary(db, "cli") == len(scripts.STARTER_GLOSSARY)
    assert scripts.seed_glossary(db, "cli") == 0
    assert scripts.approved_glossary(db) == {}


def test_pls_lexicon_contains_only_approved_entries_escaped(db):
    e = scripts.save_pronunciation(
        db, written="R&D", spoken="àr-án-dí", category="term", notes=None, actor="o"
    )
    scripts.save_pronunciation(
        db, written="POS", spoken="pí-ó-ẹ́sì", category="term", notes=None, actor="o"
    )
    scripts.approve_entry(db, e, "reviewer:r")
    pls = scripts.pls_lexicon(db)
    assert "<grapheme>R&amp;D</grapheme>" in pls and "àr-án-dí" in pls and "POS" not in pls
    assert pls.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    import xml.etree.ElementTree as ET

    ET.fromstring(pls.encode())  # noqa: S314 (our own generated XML, checking it is well-formed)
