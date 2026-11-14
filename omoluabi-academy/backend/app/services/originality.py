"""Originality checks: how much of a text was copied word for word from source material.

Used by research (Phase 3), the rights tools (Phase 4) and, later, Yoruba scripts (Phase 5),
so that original content never reproduces protected source wording.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Episode

FLAG_WORDS = 12  # a run of this many words copied from a source is flagged
_NGRAM = 6
_WORD = re.compile(r"[a-z0-9']+")


def _tokens(text: str) -> list[str]:
    return _WORD.findall(text.lower())


@dataclass(frozen=True)
class Overlap:
    words: int  # length of the longest copied run (0 if under 6 words)
    excerpt: str  # the copied run, as words


def longest_overlap(source: str, candidate: str) -> Overlap:
    src = _tokens(source)
    if len(src) < _NGRAM:
        return Overlap(0, "")
    grams = {tuple(src[i : i + _NGRAM]) for i in range(len(src) - _NGRAM + 1)}
    cand = _tokens(candidate)
    best = run = 0
    best_end = -1
    for i in range(len(cand) - _NGRAM + 1):
        if tuple(cand[i : i + _NGRAM]) in grams:
            run += 1
            if run + _NGRAM - 1 > best:
                best, best_end = run + _NGRAM - 1, i + _NGRAM
        else:
            run = 0
    excerpt = " ".join(cand[best_end - best : best_end]) if best else ""
    return Overlap(best, excerpt[:400])


def longest_verbatim_overlap(source: str, candidate: str) -> int:
    return longest_overlap(source, candidate).words


@dataclass(frozen=True)
class SourceMatch:
    episode_id: str
    episode_title: str
    used_transcript: bool
    words: int
    excerpt: str
    flagged: bool


def check_against_sources(
    db: Session, text: str, episode_ids: list[str] | None = None, *, limit: int = 10
) -> list[SourceMatch]:
    """Compare ``text`` with the description and transcript of each source episode.

    Returns the matches (longest first). Sources without a transcript can only be compared
    with their description; ``used_transcript`` says which was available.
    """
    q = select(Episode).options(selectinload(Episode.transcript))
    if episode_ids is not None:
        q = q.where(Episode.id.in_(episode_ids))
    out: list[SourceMatch] = []
    for ep in db.execute(q).scalars():
        source = ep.description + "\n" + (ep.transcript.text if ep.transcript else "")
        ov = longest_overlap(source, text)
        if ov.words:
            out.append(
                SourceMatch(
                    ep.id,
                    ep.title,
                    ep.transcript is not None,
                    ov.words,
                    ov.excerpt,
                    ov.words >= FLAG_WORDS,
                )
            )
    out.sort(key=lambda m: m.words, reverse=True)
    return out[:limit]
