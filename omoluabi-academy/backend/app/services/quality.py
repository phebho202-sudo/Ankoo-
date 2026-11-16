"""Automated translation quality checks.

The score is a *guide for the human reviewer*: it catches mechanical problems. It is never
treated as proof that the Yoruba is correct, natural or well-toned. Approval always needs a
human language review.
"""

from __future__ import annotations

import re
from typing import Any

from app.services import yoruba

DISCLAIMER = (
    "Automated checks only. They catch missing marks, English left in the text, missing "
    "numbers and similar problems. They cannot judge tone accuracy or naturalness: a fluent "
    "Yoruba reviewer must approve every script."
)
UNMARKED_WARN = 0.55  # above this share of unmarked words, tone marks are probably missing
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _numbers(text: str) -> set[str]:
    return {n.replace(",", "") for n in _NUMBER.findall(text)}


def assess(
    segments: list[dict[str, Any]],
    title_yo: str,
    glossary: dict[str, str] | None = None,
    originality: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return {score, errors, warnings, stats, disclaimer}. Errors block review."""
    glossary = glossary or {}
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    all_yo = title_yo + "\n" + "\n".join(s.get("text_yo", "") for s in segments)

    if not segments:
        errors.append({"code": "no_segments"})
    for i, seg in enumerate(segments, start=1):
        yo, en = (seg.get("text_yo") or "").strip(), (seg.get("text_en") or "").strip()
        if not yo:
            errors.append({"code": "missing_yoruba", "segment": i})
            continue
        if not en:
            errors.append({"code": "missing_english", "segment": i})
            continue
        ratio = len(yo) / max(1, len(en))
        if ratio < 0.6 or ratio > 3.0:
            warnings.append({"code": "length_mismatch", "segment": i, "ratio": round(ratio, 2)})
        missing_numbers = sorted(_numbers(en) - _numbers(yo))
        if missing_numbers:
            warnings.append({"code": "numbers_missing", "segment": i, "numbers": missing_numbers})
        leaked = yoruba.english_words(yo)
        if leaked:
            warnings.append(
                {"code": "english_in_yoruba", "segment": i, "words": sorted(set(leaked))[:10]}
            )
        for en_term, yo_term in glossary.items():
            if (
                # "customer" should also catch "customers"
                re.search(rf"(?i)\b{re.escape(en_term)}(?:s|es)?\b", en)
                and yoruba.normalise(yo_term).lower() not in yoruba.normalise(yo).lower()
            ):
                warnings.append(
                    {
                        "code": "glossary_term_not_used",
                        "segment": i,
                        "english": en_term,
                        "yoruba": yo_term,
                    }
                )

    bad_marks = yoruba.mark_problems(all_yo)
    if bad_marks:
        errors.append({"code": "misplaced_marks", "words": sorted(set(bad_marks))[:10]})
    if yoruba.uses_line_below(all_yo):
        warnings.append({"code": "line_below_used"})
    ratio, counted = yoruba.unmarked_ratio(all_yo)
    if counted >= 10 and ratio > UNMARKED_WARN:
        errors.append({"code": "tone_marks_missing", "unmarked_percent": round(ratio * 100)})
    if originality and originality.get("flagged"):
        errors.append(
            {
                "code": "copied_source_wording",
                "words": originality.get("words"),
                "excerpt": originality.get("excerpt"),
            }
        )

    score = 100 - 25 * len(errors) - 5 * len(warnings)
    return {
        "score": max(0, min(100, score)),
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "segments": len(segments),
            "yoruba_words": counted,
            "unmarked_percent": round(ratio * 100),
        },
        "disclaimer": DISCLAIMER,
    }
