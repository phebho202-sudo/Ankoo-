"""Yoruba scripts: generation, revisions, quality checks and human language review."""

from __future__ import annotations

import html
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.base import LLMMessage, LLMProvider
from app.core.errors import AppError, BlockedByPolicyError, NotFoundError, ProviderError
from app.db.base import utcnow
from app.models import (
    Episode,
    GlossaryTerm,
    JobRun,
    Licence,
    PronunciationEntry,
    ResearchReport,
    Script,
    ScriptFormat,
    ScriptKind,
    ScriptRevision,
    ScriptStatus,
    TermStatus,
    Topic,
    TopicStatus,
)
from app.services import audit, budget, originality, quality, rights, subtitles, yoruba
from app.services.rights import Purpose

MAX_OUTPUT_TOKENS = 16000
REVIEW_CHECKLIST = (
    "tone_marks",  # every word correctly toned and dotted
    "natural_phrasing",  # sounds like natural Nigerian Yoruba, not translated English
    "terminology",  # business terms correct and consistent
    "numbers_and_naira",  # figures, prices and naira amounts correct and read naturally
    "cultural_fit",  # examples and register right for the audience
    "source_handling",  # original lessons: no copied source; adaptations: faithful + credited
)

SYSTEM_PROMPT = """\
You are the lead Yoruba scriptwriter and localisation editor for OMỌLÚÀBÍ BUSINESS ACADEMY, \
which teaches practical business skills in Yoruba to traders, artisans and small-business owners \
in Nigeria. A Nigerian Yoruba voice presenter will read your script aloud, with Yoruba and \
English subtitles.

Language
- Write natural, warm, standard Nigerian Yoruba as an educated Yoruba speaker from Ọ̀yọ́, Ìbàdàn \
or Lagos would speak it to adults: clear, respectful, never stiff or word-for-word from English.
- Mark every tone that standard orthography marks (acute for high, grave for low; leave mid tone \
unmarked) and always write ẹ, ọ and ṣ with the dot below. Never use the vertical line below.
- Use the academy's approved business vocabulary (below) whenever the concept appears. Where no \
common Yoruba word exists, use the English loanword that Yoruba speakers actually say, written as \
spoken, and list it in notes_for_reviewer.
- Address the audience respectfully (ẹ / ẹ̀yin). Short sentences that are easy to say aloud.
- Write money in naira with the ₦ sign and digits (e.g. ₦25,000) in both languages, so figures \
match exactly between Yoruba and English.

Teaching
- Make every lesson practical: one clear idea per segment, a concrete Nigerian example \
(Balogun, Ọjà Dugbẹ, a POS agent, a pure-water business, a tailor, ajo or esusu savings, \
power and transport costs), and a simple action the viewer can take this week.
- Be accurate and honest. Do not promise income or quick wealth. If a figure is illustrative, \
say so.
- Never imitate any real person's voice, catchphrases or persona, and never present another \
creator's branded framework as the academy's own.

Output
- Return only the JSON object described by the schema.
- segments: each segment is one or two spoken sentences (about 8 to 15 seconds). text_yo is \
the narration; text_en is a faithful English rendering of that same segment for subtitles \
(not the original source wording); visual is a short note for the on-screen graphic.
- notes_for_reviewer: words or phrases you are unsure of, for the human Yoruba reviewer.
"""

SCRIPT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title_en": {"type": "string"},
        "title_yo": {"type": "string"},
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text_yo": {"type": "string"},
                    "text_en": {"type": "string"},
                    "visual": {"type": "string"},
                },
                "required": ["text_yo", "text_en", "visual"],
                "additionalProperties": False,
            },
        },
        "notes_for_reviewer": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title_en", "title_yo", "segments", "notes_for_reviewer"],
    "additionalProperties": False,
}


class _Seg(BaseModel):
    text_yo: str = Field(min_length=1, max_length=2000)
    text_en: str = Field(min_length=1, max_length=2000)
    visual: str = Field(default="", max_length=500)


class ScriptOut(BaseModel):
    title_en: str = Field(min_length=1, max_length=300)
    title_yo: str = Field(min_length=1, max_length=300)
    segments: list[_Seg] = Field(min_length=1, max_length=200)
    notes_for_reviewer: list[str] = Field(default_factory=list, max_length=50)


# ---------------------------------------------------------------- glossary & pronunciation
def approved_glossary(db: Session) -> dict[str, str]:
    rows = db.execute(
        select(GlossaryTerm).where(GlossaryTerm.status == TermStatus.APPROVED)
    ).scalars()
    return {g.english: g.yoruba for g in rows}


def save_term(
    db: Session,
    *,
    english: str,
    yoruba_text: str,
    notes: str | None,
    actor: str,
    term: GlossaryTerm | None = None,
) -> GlossaryTerm:
    english = " ".join(english.lower().split())
    yoruba_text = yoruba.normalise(yoruba_text.strip())
    if not english or not yoruba_text:
        raise AppError("Both the English term and the Yoruba term are required")
    if term is None:
        if db.execute(
            select(GlossaryTerm).where(GlossaryTerm.english == english)
        ).scalar_one_or_none():
            raise AppError(f"“{english}” is already in the glossary")
        term = GlossaryTerm(english=english, yoruba=yoruba_text, notes=notes, created_by=actor)
        db.add(term)
        action = "glossary.added"
    else:
        term.english, term.yoruba, term.notes = english, yoruba_text, notes
        action = "glossary.updated"
    # Any change must be (re)checked by a Yoruba speaker before the model uses it.
    term.status, term.approved_by = TermStatus.PROPOSED, None
    db.flush()
    audit.record(
        db,
        actor=actor,
        action=action,
        entity_type="glossary",
        entity_id=term.id,
        details={"english": english, "yoruba": yoruba_text},
    )
    return term


def save_pronunciation(
    db: Session,
    *,
    written: str,
    spoken: str,
    category: str,
    notes: str | None,
    actor: str,
    entry: PronunciationEntry | None = None,
) -> PronunciationEntry:
    written, spoken = yoruba.normalise(written.strip()), yoruba.normalise(spoken.strip())
    if not written or not spoken:
        raise AppError("Both the written form and how to say it are required")
    if entry is None:
        if db.execute(
            select(PronunciationEntry).where(PronunciationEntry.written == written)
        ).scalar_one_or_none():
            raise AppError(f"“{written}” is already in the dictionary")
        entry = PronunciationEntry(
            written=written, spoken=spoken, category=category, notes=notes, created_by=actor
        )
        db.add(entry)
        action = "pronunciation.added"
    else:
        entry.written, entry.spoken, entry.category, entry.notes = written, spoken, category, notes
        action = "pronunciation.updated"
    entry.status, entry.approved_by = TermStatus.PROPOSED, None
    db.flush()
    audit.record(
        db,
        actor=actor,
        action=action,
        entity_type="pronunciation",
        entity_id=entry.id,
        details={"written": written, "spoken": spoken},
    )
    return entry


def approve_entry(db: Session, entry: GlossaryTerm | PronunciationEntry, actor: str) -> None:
    entry.status, entry.approved_by = TermStatus.APPROVED, actor
    kind = "glossary" if isinstance(entry, GlossaryTerm) else "pronunciation"
    audit.record(db, actor=actor, action=f"{kind}.approved", entity_type=kind, entity_id=entry.id)


def pls_lexicon(db: Session) -> str:
    """Approved pronunciations as a W3C PLS lexicon (accepted by TTS providers, e.g. ElevenLabs)."""
    rows = db.execute(
        select(PronunciationEntry)
        .where(PronunciationEntry.status == TermStatus.APPROVED)
        .order_by(PronunciationEntry.written)
    ).scalars()
    lexemes = "".join(
        f"  <lexeme>\n    <grapheme>{html.escape(e.written)}</grapheme>\n"
        f"    <alias>{html.escape(e.spoken)}</alias>\n  </lexeme>\n"
        for e in rows
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon" '
        'alphabet="ipa" xml:lang="yo">\n' + lexemes + "</lexicon>\n"
    )


# ---------------------------------------------------------------- creating scripts
def _new_job(db: Session, script: Script, mode: str, instructions: str | None = None) -> JobRun:
    job = JobRun(
        task_name="scripts.generate",
        payload={"script_id": script.id, "mode": mode, "instructions": instructions},
    )
    db.add(job)
    db.flush()
    return job


def create_original(
    db: Session, *, topic_id: str, fmt: ScriptFormat, target_minutes: int, actor: str
) -> tuple[Script, JobRun]:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise NotFoundError("Topic not found")
    if topic.status != TopicStatus.APPROVED:
        raise BlockedByPolicyError("Only topics you have approved can become lessons")
    script = Script(
        kind=ScriptKind.ORIGINAL,
        format=fmt,
        title_en=topic.title,
        topic_id=topic.id,
        target_minutes=target_minutes,
        is_sample=topic.is_sample,
        created_by=actor,
    )
    db.add(script)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="script.created",
        entity_type="script",
        entity_id=script.id,
        details={"kind": script.kind.value, "topic_id": topic.id},
    )
    return script, _new_job(db, script, "generate")


def create_adaptation(
    db: Session, *, episode_id: str, fmt: ScriptFormat, target_minutes: int, actor: str
) -> tuple[Script, JobRun]:
    episode = db.get(Episode, episode_id)
    if episode is None:
        raise NotFoundError("Episode not found")
    decision = rights.require_rights(db, episode_id, Purpose.ADAPTATION, actor=actor)
    if episode.transcript is None:
        raise BlockedByPolicyError("Add the licensed transcript to this episode before adapting it")
    script = Script(
        kind=ScriptKind.ADAPTATION,
        format=fmt,
        title_en=episode.title,
        episode_id=episode.id,
        licence_id=decision.licence_id,
        target_minutes=target_minutes,
        is_sample=episode.is_sample,
        created_by=actor,
    )
    db.add(script)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="script.created",
        entity_type="script",
        entity_id=script.id,
        details={
            "kind": script.kind.value,
            "episode_id": episode.id,
            "licence_id": decision.licence_id,
        },
    )
    return script, _new_job(db, script, "generate")


def request_revision(db: Session, script: Script, *, instructions: str, actor: str) -> JobRun:
    instructions = instructions.strip()
    if len(instructions) < 5:
        raise AppError("Say what should change")
    if script.status not in (
        ScriptStatus.DRAFT,
        ScriptStatus.CHANGES_REQUESTED,
        ScriptStatus.APPROVED,
    ):
        raise BlockedByPolicyError("This script cannot be revised in its current state")
    audit.record(
        db,
        actor=actor,
        action="script.revision_requested",
        entity_type="script",
        entity_id=script.id,
        details={"instructions": instructions},
    )
    return _new_job(db, script, "revise", instructions)


# ---------------------------------------------------------------- generation
def _length_brief(script: Script) -> str:
    if script.format == ScriptFormat.SHORT:
        return (
            "Format: a vertical short of under 60 seconds: 4 to 7 segments. Open with a strong "
            "one-sentence hook, give one practical idea, end with one action."
        )
    n = max(6, script.target_minutes * 5)
    return (
        f"Format: a {script.target_minutes}-minute lesson of about {n} segments: a warm "
        "introduction, the lesson in clear steps with examples, a recap and one action for "
        "this week."
    )


def _glossary_block(db: Session) -> str:
    terms = approved_glossary(db)
    if not terms:
        return "Approved business vocabulary: (none yet: use the most common Yoruba words)."
    lines = "\n".join(f"- {en} → {yo}" for en, yo in sorted(terms.items()))
    return f"Approved business vocabulary (English → Yoruba):\n{lines}"


def _brief(db: Session, script: Script) -> tuple[str, list[str] | None]:
    """The user message, and the source episode ids for the originality check."""
    if script.kind == ScriptKind.ORIGINAL:
        topic = db.get(Topic, script.topic_id)
        report = db.get(ResearchReport, topic.report_id)
        concepts = "\n".join(f"- {c['name']}: {c['explanation']}" for c in report.key_concepts)
        cautions = "\n".join(f"- {c}" for c in report.cautions)
        text = (
            "Write an ORIGINAL lesson. It must be independently written: do not use any source "
            "material's wording, structure, examples or stories.\n\n"
            f"Topic: {topic.title}\nWhat it covers: {topic.description}\n"
            f"Audience: {topic.audience_fit or 'Nigerian small-business owners'}\n"
            f"Lesson angle: {topic.lesson_angle or ''}\n\n"
            f"Background research (the academy's own notes):\n{report.summary or ''}\n"
            f"Key concepts:\n{concepts}\nNigerian context: {report.nigerian_context or ''}\n"
            f"Cautions:\n{cautions}\n\n{_length_brief(script)}\n\n{_glossary_block(db)}"
        )
        return text, None  # compare against every source we hold
    episode = db.get(Episode, script.episode_id)
    text = (
        "Write a LICENSED ADAPTATION into Yoruba of the source below. The academy holds a "
        "verified licence granting translation and adaptation rights. Keep the source's ideas, "
        "order and meaning faithfully; you may replace foreign examples with equivalent Nigerian "
        "ones and convert currency to naira with a clear note that figures are illustrative. "
        "Do not add claims the source does not make. Do not imitate the original presenter's "
        "persona.\n\n"
        f"Source title: {episode.title}\n<source_transcript>\n{episode.transcript.text}\n"
        f"</source_transcript>\n\n{_length_brief(script)}\n\n{_glossary_block(db)}"
    )
    return text, [episode.id]


def _clean_segments(segs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for i, s in enumerate(segs, start=1):
        yo = yoruba.normalise((s.get("text_yo") or "").strip())
        en = " ".join((s.get("text_en") or "").split())
        out.append(
            {
                "id": f"s{i}",
                "text_yo": " ".join(yo.split()),
                "text_en": en,
                "visual": " ".join((s.get("visual") or "").split()),
            }
        )
    return out


def _attribution_segment(db: Session, script: Script) -> dict[str, Any] | None:
    if script.kind != ScriptKind.ADAPTATION or not script.licence_id:
        return None
    lic = db.get(Licence, script.licence_id)
    if lic is None or not lic.attribution_required or not lic.attribution_text:
        return None
    return {
        "id": "credit",
        "text_yo": yoruba.normalise(lic.attribution_text),
        "text_en": lic.attribution_text,
        "visual": "Credit (required by licence)",
        "locked": True,
    }


def evaluate(
    db: Session,
    script: Script,
    title_yo: str,
    segments: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """(quality, originality) for a revision."""
    orig = None
    if script.kind == ScriptKind.ORIGINAL:
        text = "\n".join(s["text_en"] for s in segments)
        matches = originality.check_against_sources(db, text, limit=5)
        top = matches[0] if matches else None
        orig = {
            "flagged": bool(top and top.flagged),
            "words": top.words if top else 0,
            "excerpt": top.excerpt if top else "",
            "episode_id": top.episode_id if top else None,
        }
    q = quality.assess(segments, title_yo, approved_glossary(db), orig)
    return q, orig


def _add_revision(
    db: Session,
    script: Script,
    *,
    origin: str,
    title_yo: str,
    segments: list[dict[str, Any]],
    change_note: str | None,
    actor: str,
    provider: str | None = None,
    model: str | None = None,
    cost: Decimal = Decimal("0"),
    is_sample: bool = False,
) -> ScriptRevision:
    q, orig = evaluate(db, script, title_yo, segments)
    script.current_revision += 1
    rev = ScriptRevision(
        script_id=script.id,
        number=script.current_revision,
        origin=origin,
        title_yo=title_yo,
        segments=segments,
        change_note=change_note,
        quality=q,
        originality=orig,
        provider=provider,
        model=model,
        cost_usd=cost,
        is_sample=is_sample or script.is_sample,
        created_by=actor,
    )
    script.revisions.append(rev)  # keeps the in-session list current
    script.title_yo = title_yo
    if script.status == ScriptStatus.APPROVED:
        audit.record(
            db,
            actor=actor,
            action="script.approval_superseded",
            entity_type="script",
            entity_id=script.id,
            details={"approved_revision": script.approved_revision},
        )
    script.status, script.blocked_reason = ScriptStatus.DRAFT, None
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="script.revision_added",
        entity_type="script",
        entity_id=script.id,
        details={
            "revision": rev.number,
            "origin": origin,
            "score": q["score"],
            "errors": len(q["errors"]),
        },
    )
    return rev


def run_generation(
    db: Session,
    script: Script,
    job: JobRun,
    llm: LLMProvider,
    *,
    mode: str,
    instructions: str | None = None,
) -> None:
    """Generate (or revise) a script with the language model. Records outcome; never fakes text."""

    def stop(reason: str) -> None:
        script.blocked_reason = reason
        if mode == "generate":
            script.status = ScriptStatus.BLOCKED

    if script.kind == ScriptKind.ADAPTATION:
        try:  # rights may have expired or been revoked since the script was created
            rights.require_rights(db, script.episode_id, Purpose.ADAPTATION, actor="worker")
        except BlockedByPolicyError as exc:
            return stop(
                "Rights check failed: "
                + "; ".join(r["code"] for r in exc.details.get("reasons", []))
            )

    brief, _ = _brief(db, script)
    if mode == "revise":
        current = script.revisions[-1]
        brief += (
            "\n\nRevise the CURRENT SCRIPT below according to these instructions from the "
            f"academy (keep everything else):\n<instructions>\n{instructions}\n</instructions>\n"
            f"<current_script>\n{current.title_yo}\n"
            + "\n".join(
                f"[{s['id']}] YO: {s['text_yo']}\n     EN: {s['text_en']}" for s in current.segments
            )
            + "\n</current_script>"
        )
    estimate = llm.estimate_max_cost(
        input_chars=len(SYSTEM_PROMPT) + len(brief), max_tokens=MAX_OUTPUT_TOKENS
    )
    job.is_sample = llm.is_sample
    if not llm.is_sample:
        try:
            budget.reserve(db, job, estimate, provider=llm.name)
        except BlockedByPolicyError as exc:
            return stop(exc.message)
    try:
        resp = llm.complete(
            system=SYSTEM_PROMPT,
            messages=[LLMMessage("user", brief)],
            max_tokens=MAX_OUTPUT_TOKENS,
            json_schema=SCRIPT_SCHEMA,
        )
    except ProviderError as exc:
        budget.settle(db, job, Decimal("0"))
        return stop(exc.message)
    budget.settle(db, job, resp.cost_usd)
    if resp.refused:
        return stop("The model declined this request (safety policy). Nothing was produced.")
    try:
        out = ScriptOut.model_validate(resp.parsed or {})
    except ValidationError as exc:
        return stop(
            f"The model's answer did not match the script format ({exc.error_count()} problems)"
        )

    segments = _clean_segments([s.model_dump() for s in out.segments])
    credit = _attribution_segment(db, script)
    if credit:
        segments.append(credit)
    notes = "; ".join(out.notes_for_reviewer) or None
    _add_revision(
        db,
        script,
        origin="generated" if mode == "generate" else "revised",
        title_yo=yoruba.normalise(out.title_yo),
        segments=segments,
        change_note=(instructions if mode == "revise" else None)
        or (f"Notes for reviewer: {notes}" if notes else None),
        actor="worker",
        provider=resp.provider,
        model=resp.model,
        cost=resp.cost_usd,
        is_sample=resp.is_sample,
    )
    if script.kind == ScriptKind.ORIGINAL:
        script.title_en = out.title_en[:300]


# ---------------------------------------------------------------- human edits & review
def add_human_revision(
    db: Session,
    script: Script,
    *,
    title_yo: str,
    segments: list[dict[str, Any]],
    change_note: str,
    actor: str,
) -> ScriptRevision:
    if script.status in (ScriptStatus.GENERATING, ScriptStatus.ARCHIVED, ScriptStatus.BLOCKED):
        raise BlockedByPolicyError("This script cannot be edited in its current state")
    if script.status == ScriptStatus.IN_REVIEW:
        raise BlockedByPolicyError("The script is being reviewed. Request changes first.")
    if not change_note.strip():
        raise AppError("Describe what you changed")
    previous = script.revisions[-1].segments if script.revisions else []
    locked = [s for s in previous if s.get("locked")]
    cleaned = _clean_segments([s for s in segments if not s.get("locked")])
    if not cleaned:
        raise AppError("A script needs at least one segment")
    return _add_revision(
        db,
        script,
        origin="human_edit",
        title_yo=yoruba.normalise(title_yo.strip()),
        segments=cleaned + locked,
        change_note=change_note.strip(),
        actor=actor,
    )


def submit_for_review(db: Session, script: Script, actor: str) -> None:
    if script.status not in (ScriptStatus.DRAFT, ScriptStatus.CHANGES_REQUESTED):
        raise BlockedByPolicyError("Only a draft can be sent for review")
    rev = script.revisions[-1]
    if rev.quality.get("errors"):
        raise BlockedByPolicyError(
            "Fix the errors found by the automated checks first",
            details={"errors": rev.quality["errors"]},
        )
    if script.kind == ScriptKind.ADAPTATION:
        rights.require_rights(db, script.episode_id, Purpose.ADAPTATION, actor=actor)
    script.status = ScriptStatus.IN_REVIEW
    audit.record(
        db,
        actor=actor,
        action="script.submitted",
        entity_type="script",
        entity_id=script.id,
        details={"revision": rev.number},
    )


def review(
    db: Session,
    script: Script,
    *,
    decision: str,
    checklist: dict[str, bool],
    comments: str | None,
    actor: str,
) -> None:
    from app.models import LanguageReview

    if script.status != ScriptStatus.IN_REVIEW:
        raise BlockedByPolicyError("This script is not waiting for review")
    comments = (comments or "").strip() or None
    checklist = {k: bool(checklist.get(k)) for k in REVIEW_CHECKLIST}
    if decision == "approved":
        missing = [k for k, v in checklist.items() if not v]
        if missing:
            raise AppError(
                "Confirm every checklist item before approving", details={"missing": missing}
            )
        if script.kind == ScriptKind.ADAPTATION:
            rights.require_rights(db, script.episode_id, Purpose.ADAPTATION, actor=actor)
    elif decision == "changes_requested":
        if not comments:
            raise AppError("Explain what needs to change")
    else:
        raise AppError("Unknown decision")
    script.reviews.append(
        LanguageReview(
            script_id=script.id,
            revision_number=script.current_revision,
            reviewer=actor,
            decision=decision,
            checklist=checklist,
            comments=comments,
        )
    )
    if decision == "approved":
        script.status, script.approved_revision, script.approved_at = (
            ScriptStatus.APPROVED,
            script.current_revision,
            utcnow(),
        )
    else:
        script.status = ScriptStatus.CHANGES_REQUESTED
    audit.record(
        db,
        actor=actor,
        action=f"script.review_{decision}",
        entity_type="script",
        entity_id=script.id,
        details={"revision": script.current_revision, "checklist": checklist, "comments": comments},
    )


def archive(db: Session, script: Script, actor: str) -> None:
    script.status = ScriptStatus.ARCHIVED
    audit.record(
        db, actor=actor, action="script.archived", entity_type="script", entity_id=script.id
    )


def revision(script: Script, number: int | None) -> ScriptRevision:
    if not script.revisions:
        raise NotFoundError("This script has no text yet")
    if number is None:
        return script.revisions[-1]
    for r in script.revisions:
        if r.number == number:
            return r
    raise NotFoundError("Revision not found")


def srt(script: Script, lang: str, number: int | None = None) -> str:
    rev = revision(script, number)
    return subtitles.to_srt(subtitles.build_cues(rev.segments, lang))


STARTER_GLOSSARY = {
    # Proposed starter terms. Never used until a Yoruba reviewer approves (or corrects) them.
    "profit": "èrè",
    "loss": "àdánù",
    "capital": "owó ìdókòwò",
    "customer": "oníbàárà",
    "price": "iye owó",
    "sales": "títà",
    "savings": "ìfowópamọ́",
    "debt": "gbèsè",
    "loan": "owó yíyá",
    "interest": "èlé",
    "budget": "ìṣúná",
    "business": "òwò",
    "market": "ọjà",
    "trader": "oníṣòwò",
    "cash flow": "ìṣàn owó",
    "expenses": "ìnáwó",
    "income": "owó-wíwọlé",
    "investment": "ìdókòwò",
    "marketing": "ìpolówó ọjà",
    "partnership": "àjọṣepọ̀",
}


def seed_glossary(db: Session, actor: str) -> int:
    added = 0
    for en, yo in STARTER_GLOSSARY.items():
        if db.execute(select(GlossaryTerm).where(GlossaryTerm.english == en)).scalar_one_or_none():
            continue
        save_term(
            db, english=en, yoruba_text=yo, notes="Starter suggestion: needs review", actor=actor
        )
        added += 1
    return added
