"""Subtitles in English and Yoruba, as SRT.

Both languages are timed to the *Yoruba narration*, segment by segment, so they always line
up with the voice. Before a voice track exists (Phase 6), segment durations are estimated
from syllable counts; afterwards the real per-segment audio durations are passed in.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.services import yoruba

MAX_LINE = 42
MAX_LINES = 2
SYLLABLES_PER_SECOND = 4.2  # unhurried teaching pace
MIN_SEGMENT_SECONDS = 1.0
PAUSE_SECONDS = 0.3  # breath between segments in the estimate


@dataclass(frozen=True)
class Cue:
    index: int
    start: float
    end: float
    text: str
    segment: int  # 1-based segment number


def estimate_seconds(text_yo: str) -> float:
    return max(MIN_SEGMENT_SECONDS, yoruba.syllables(text_yo) / SYLLABLES_PER_SECOND)


def _wrap(text: str, max_line: int = MAX_LINE) -> list[str]:
    """Split text into cue texts of at most MAX_LINES lines of ``max_line`` characters."""
    sentences = [s for s in re.split(r"(?<=[.!?…])\s+", " ".join(text.split())) if s]
    cues: list[str] = []
    for sentence in sentences:
        lines: list[str] = []
        line = ""
        for word in sentence.split(" "):
            candidate = f"{line} {word}".strip()
            if len(candidate) <= max_line or not line:
                line = candidate
            else:
                lines.append(line)
                line = word
            if len(lines) == MAX_LINES:
                cues.append("\n".join(lines))
                lines = []
        if line:
            lines.append(line)
        if lines:
            cues.append("\n".join(lines))
    return cues


def build_cues(
    segments: list[dict[str, Any]],
    lang: str,
    durations: list[float] | None = None,
    *,
    offset: float = 0.0,
    max_line: int = MAX_LINE,
) -> list[Cue]:
    """Cues for ``lang`` ("yo" or "en") on the Yoruba narration timeline.

    ``offset`` shifts every cue (e.g. past a video's intro card); ``max_line`` narrows lines
    for vertical video.
    """
    if durations is not None and len(durations) != len(segments):
        raise ValueError("One duration is needed per segment")
    key = "text_yo" if lang == "yo" else "text_en"
    cues: list[Cue] = []
    t = offset
    for i, seg in enumerate(segments):
        seg_len = (
            durations[i] if durations is not None else estimate_seconds(seg.get("text_yo", ""))
        )
        parts = _wrap(seg.get(key, ""), max_line) or [""]
        weights = [max(1, len(p.replace("\n", ""))) for p in parts]
        total = sum(weights)
        start = t
        for p, w in zip(parts, weights, strict=True):
            end = start + seg_len * w / total
            if p:
                cues.append(Cue(len(cues) + 1, round(start, 3), round(end, 3), p, i + 1))
            start = end
        t += seg_len + (PAUSE_SECONDS if durations is None else 0.0)
    return cues


def _ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def to_srt(cues: list[Cue]) -> str:
    blocks = [
        f"{c.index}\n{_ts(c.start)} --> {_ts(c.end)}\n{yoruba.normalise(c.text)}" for c in cues
    ]
    return "\n\n".join(blocks) + "\n"


def total_seconds(segments: list[dict[str, Any]]) -> float:
    return sum(estimate_seconds(s.get("text_yo", "")) for s in segments) + PAUSE_SECONDS * max(
        0, len(segments) - 1
    )
