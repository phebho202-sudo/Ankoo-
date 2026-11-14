"""Research reports and topic approval.

A report studies one source episode (or a subject the owner types in) and proposes topics for
*original* Yoruba lessons. It never produces a translation or adaptation of the source; that
needs verified rights (Phase 4). The owner approves or rejects each proposed topic.
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.adapters.base import LLMMessage, LLMProvider
from app.core.errors import AppError, BlockedByPolicyError, NotFoundError, ProviderError
from app.db.base import utcnow
from app.models import (
    Episode,
    EpisodeStatus,
    JobRun,
    ReportStatus,
    ResearchReport,
    Topic,
    TopicStatus,
    Transcript,
    TranscriptSource,
)
from app.services import audit, budget

MAX_TRANSCRIPT_CHARS = 200_000  # rejected at entry, so nothing is ever silently truncated
MAX_OUTPUT_TOKENS = 8000
OVERLAP_FLAG_WORDS = 12  # a run this long copied from the source is flagged for review
_NGRAM = 6

SYSTEM_PROMPT = """\
You are the research analyst for OMỌLÚÀBÍ BUSINESS ACADEMY, which teaches practical business \
skills in natural Nigerian Yoruba to small-business owners, traders and early-stage founders \
in Nigeria.

Your job is to study the material provided and propose topics for ORIGINAL lessons that the \
academy will write and present itself.

Rules:
1. Work at the level of general, widely known business concepts (pricing, offers, cash flow, \
sales, customer acquisition, hiring, and so on). Explain every idea in your own words.
2. Do not reproduce the source. Never quote more than eight consecutive words from it, and do \
not copy its structure, examples, stories, jokes or catchphrases.
3. Do not present any creator's branded frameworks, persona or signature phrases as the \
academy's. Do not write in the voice of the source's presenter. If an idea is closely tied to \
one person's proprietary framework, say so in "cautions" instead of teaching it.
4. Ground lessons in Nigerian reality: naira amounts, local markets and trading, POS and \
mobile money, power and logistics costs, informal credit (ajo, esusu), regulation (CAC, \
FIRS/state revenue), and the realities of small family businesses.
5. Be honest about uncertainty. Put claims that need checking, figures that may be out of \
date, and anything that would be risky to teach in "cautions".
6. Write in clear English. The Yoruba script is written later by a separate process with \
human language review.

Return only the JSON object described by the schema: 3 to 8 topics, each one a lesson the \
academy could teach without the source."""

REPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "key_concepts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "explanation": {"type": "string"}},
                "required": ["name", "explanation"],
                "additionalProperties": False,
            },
        },
        "nigerian_context": {"type": "string"},
        "topics": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "audience_fit": {"type": "string"},
                    "lesson_angle": {"type": "string"},
                },
                "required": ["title", "description", "audience_fit", "lesson_angle"],
                "additionalProperties": False,
            },
        },
        "cautions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "key_concepts", "nigerian_context", "topics", "cautions"],
    "additionalProperties": False,
}


class _Concept(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    explanation: str = Field(min_length=1, max_length=2000)


class _TopicOut(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=1, max_length=3000)
    audience_fit: str = Field(max_length=2000)
    lesson_angle: str = Field(min_length=1, max_length=3000)


class ReportOut(BaseModel):
    summary: str = Field(min_length=1, max_length=6000)
    key_concepts: list[_Concept] = Field(max_length=20)
    nigerian_context: str = Field(max_length=4000)
    topics: list[_TopicOut] = Field(min_length=1, max_length=8)
    cautions: list[str] = Field(max_length=20)


# ---------------------------------------------------------------- transcripts
def save_transcript(
    db: Session,
    episode: Episode,
    *,
    text: str,
    language: str,
    source: TranscriptSource,
    permission_reference: str,
    actor: str,
) -> Transcript:
    text = text.strip()
    permission_reference = permission_reference.strip()
    if not text:
        raise AppError("Transcript text is empty")
    if len(text) > MAX_TRANSCRIPT_CHARS:
        raise AppError(
            f"Transcript is too long ({len(text):,} characters; maximum "
            f"{MAX_TRANSCRIPT_CHARS:,}). Split the episode or summarise it first."
        )
    if len(permission_reference) < 10:
        raise AppError(
            "Say why we may hold this transcript (licence reference, written permission, "
            "or that it is your own material): at least 10 characters"
        )
    tr = episode.transcript
    action = "transcript.replaced" if tr else "transcript.added"
    if tr is None:
        tr = Transcript(episode_id=episode.id)
        episode.transcript = tr  # keep the in-session relationship current
        db.add(tr)
    tr.text, tr.language, tr.source = text, language, source
    tr.permission_reference, tr.added_by = permission_reference, actor
    tr.word_count = len(text.split())
    db.flush()
    audit.record(
        db,
        actor=actor,
        action=action,
        entity_type="episode",
        entity_id=episode.id,
        details={
            "source": source.value,
            "permission_reference": permission_reference,
            "words": tr.word_count,
        },
    )
    return tr


# ---------------------------------------------------------------- overlap check
def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def longest_verbatim_overlap(source: str, generated: str) -> int:
    """Length in words of the longest run in ``generated`` copied from ``source`` (>= 6)."""
    src = _words(source)
    if len(src) < _NGRAM:
        return 0
    grams = {tuple(src[i : i + _NGRAM]) for i in range(len(src) - _NGRAM + 1)}
    gen = _words(generated)
    best = run = 0
    for i in range(len(gen) - _NGRAM + 1):
        if tuple(gen[i : i + _NGRAM]) in grams:
            run += 1
            best = max(best, run + _NGRAM - 1)
        else:
            run = 0
    return best


def _report_text(r: ReportOut) -> str:
    parts = [r.summary, r.nigerian_context, *r.cautions]
    parts += [f"{c.name} {c.explanation}" for c in r.key_concepts]
    parts += [f"{t.title} {t.description} {t.audience_fit} {t.lesson_angle}" for t in r.topics]
    return "\n".join(parts)


# ---------------------------------------------------------------- reports
def request_report(
    db: Session, *, episode_id: str | None, subject: str | None, actor: str
) -> tuple[ResearchReport, JobRun]:
    episode = None
    if episode_id:
        episode = db.get(Episode, episode_id)
        if episode is None:
            raise NotFoundError("Episode not found")
        subject = episode.title
    subject = (subject or "").strip()
    if len(subject) < 5:
        raise AppError("Give a subject of at least 5 characters, or choose an episode")
    report = ResearchReport(
        episode_id=episode.id if episode else None, subject=subject[:300], requested_by=actor
    )
    db.add(report)
    db.flush()
    job = JobRun(task_name="research.generate_report", payload={"report_id": report.id})
    db.add(job)
    db.flush()
    report.job_id = job.id
    audit.record(
        db,
        actor=actor,
        action="research.requested",
        entity_type="research_report",
        entity_id=report.id,
        details={"episode_id": report.episode_id, "subject": subject},
    )
    return report, job


def _build_user_message(report: ResearchReport, episode: Episode | None) -> tuple[str, str]:
    """Return (message, source_text_for_overlap_check)."""
    if episode is None:
        return (
            f"Independent research subject chosen by the academy owner:\n{report.subject}\n\n"
            "No source video is attached. Propose original lesson topics on this subject.",
            "",
        )
    parts = [
        "Source video (studied for ideas only; the academy will not translate or republish it):",
        f"Title: {episode.title}",
        f"Published: {episode.published_at.date().isoformat()}",
    ]
    if episode.duration_seconds:
        parts.append(f"Duration: {episode.duration_seconds // 60} min")
    if episode.description.strip():
        parts.append(f"Description:\n<description>\n{episode.description}\n</description>")
    source = episode.description
    if episode.transcript is not None:
        parts.append(
            "Transcript (held with permission: "
            f"{episode.transcript.permission_reference}):\n"
            f"<transcript>\n{episode.transcript.text}\n</transcript>"
        )
        source += "\n" + episode.transcript.text
    else:
        parts.append(
            "No transcript is available. Work from the title and description only, "
            "and say in cautions that the content was not reviewed in full."
        )
    return "\n\n".join(parts), source


def run_report(db: Session, report: ResearchReport, job: JobRun, llm: LLMProvider) -> None:
    """Execute a pending report. Records status, cost and topics; never raises for policy stops."""
    episode = db.get(Episode, report.episode_id) if report.episode_id else None
    message, source_text = _build_user_message(report, episode)
    estimate = llm.estimate_max_cost(
        input_chars=len(SYSTEM_PROMPT) + len(message), max_tokens=MAX_OUTPUT_TOKENS
    )
    job.is_sample = llm.is_sample
    if not llm.is_sample:
        try:
            budget.reserve(db, job, estimate, provider=llm.name)
        except BlockedByPolicyError as exc:
            report.status, report.error = ReportStatus.BLOCKED, exc.message
            return

    try:
        resp = llm.complete(
            system=SYSTEM_PROMPT,
            messages=[LLMMessage("user", message)],
            max_tokens=MAX_OUTPUT_TOKENS,
            json_schema=REPORT_SCHEMA,
        )
    except ProviderError as exc:
        # The SDK raised before returning usage; failed requests are not billed, so the
        # reservation is released. (A live run's real bill is checked in the Console.)
        budget.settle(db, job, Decimal("0"))
        report.status, report.error = ReportStatus.FAILED, exc.message
        return

    budget.settle(db, job, resp.cost_usd)
    report.provider, report.model, report.is_sample = resp.provider, resp.model, resp.is_sample
    report.input_tokens, report.output_tokens = resp.input_tokens, resp.output_tokens
    report.cost_usd = resp.cost_usd
    report.used_transcript = episode is not None and episode.transcript is not None
    if resp.refused:
        report.status = ReportStatus.BLOCKED
        report.error = "The model declined this request (safety policy). Nothing was produced."
        return
    try:
        out = ReportOut.model_validate(resp.parsed or {})
    except ValidationError as exc:
        report.status = ReportStatus.FAILED
        report.error = (
            f"The model's answer did not match the report format: {exc.error_count()} problem(s)"
        )
        return

    overlap = longest_verbatim_overlap(source_text, _report_text(out)) if source_text else 0
    report.summary = out.summary
    report.key_concepts = [c.model_dump() for c in out.key_concepts]
    report.nigerian_context = out.nigerian_context
    report.lesson_angles = [t.lesson_angle for t in out.topics]
    report.cautions = list(out.cautions)
    report.max_verbatim_overlap_words = overlap
    report.overlap_flagged = overlap >= OVERLAP_FLAG_WORDS
    seen: set[str] = set()
    sample = resp.is_sample or (episode is not None and episode.is_sample)
    for i, t in enumerate(out.topics):
        key = t.title.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        db.add(
            Topic(
                report_id=report.id,
                position=i,
                title=t.title.strip(),
                description=t.description,
                audience_fit=t.audience_fit,
                lesson_angle=t.lesson_angle,
                is_sample=sample,
            )
        )
    report.is_sample = sample
    report.status = ReportStatus.COMPLETED
    if episode is not None and episode.status == EpisodeStatus.DISCOVERED:
        episode.status = EpisodeStatus.RESEARCHED
    audit.record(
        db,
        actor="worker",
        action="research.completed",
        entity_type="research_report",
        entity_id=report.id,
        details={
            "topics": len(seen),
            "cost_usd": str(resp.cost_usd),
            "model": resp.model,
            "overlap_words": overlap,
            "overlap_flagged": report.overlap_flagged,
        },
    )


def decide_topic(
    db: Session, topic: Topic, *, decision: TopicStatus, note: str | None, actor: str
) -> Topic:
    if decision not in (TopicStatus.APPROVED, TopicStatus.REJECTED):
        raise AppError("Decision must be approved or rejected")
    report = topic.report
    if decision == TopicStatus.APPROVED and report.overlap_flagged:
        raise BlockedByPolicyError(
            "This report repeats the source word for word. Re-run the research before "
            "approving its topics."
        )
    old = topic.status
    topic.status, topic.decision_note = decision, (note or "").strip() or None
    topic.decided_by, topic.decided_at = actor, utcnow()
    audit.record(
        db,
        actor=actor,
        action=f"topic.{decision.value}",
        entity_type="topic",
        entity_id=topic.id,
        details={
            "title": topic.title,
            "previous": old.value,
            "note": topic.decision_note,
            "is_sample": topic.is_sample,
        },
    )
    return topic
