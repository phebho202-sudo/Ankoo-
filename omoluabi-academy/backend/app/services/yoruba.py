"""Yoruba text utilities: normalisation and orthography checks.

Standard Yoruba marks tone with an acute (high) or grave (low) accent; mid tone is normally
unmarked. Ẹ, Ọ and Ṣ carry a dot below. Syllabic nasals (n, m) can also carry a tone mark.
These checks catch mechanical problems (missing or misplaced marks, mixed encodings,
English left in the text). They cannot tell whether a tone is the *right* one; only a
human reader can.
"""

from __future__ import annotations

import re
import unicodedata

GRAVE, ACUTE, MACRON = "̀", "́", "̄"
DOT_BELOW, LINE_BELOW = "̣", "̩"
TONES = {GRAVE, ACUTE, MACRON}
TONE_BASES = set("aeiouAEIOUnmNM")
DOT_BASES = set("eosEOS")
VOWELS = set("aeiouAEIOU")

_WORD = re.compile(r"[^\W\d_](?:[^\W\d_]|[̀-ͯ])*", re.UNICODE)

# Common English words that should not appear in Yoruba narration. Brand and technical
# names (YouTube, POS...) are allowed through the glossary/pronunciation dictionary.
ENGLISH_WORDS = frozenset(
    """
the and of to in is are was were be been for with that this these those it its on at by from
as or but not you your we our they their he she his her them have has had do does did will
would can could should may might must about into over under after before because so if then
than very more most less many much some any all every each other such only also just how what
when where who why which there here business profit customer customers money price prices
market sales sell buy product products service services cost costs income loan bank pay
""".split()
)


def normalise(text: str) -> str:
    """NFC, and the vertical line below (e̩, o̩, s̩) replaced by the standard dot below."""
    decomposed = unicodedata.normalize("NFD", text).replace(LINE_BELOW, DOT_BELOW)
    return unicodedata.normalize("NFC", decomposed)


def words(text: str) -> list[str]:
    return _WORD.findall(unicodedata.normalize("NFD", text))


def has_tone_or_dot(word_nfd: str) -> bool:
    return any(c in TONES or c == DOT_BELOW for c in word_nfd)


def mark_problems(text: str) -> list[str]:
    """Words where a tone mark or dot below sits on a letter that cannot carry it."""
    bad: list[str] = []
    for w in words(text):
        base = ""
        for c in w:
            if unicodedata.combining(c):
                if (c in TONES and base not in TONE_BASES) or (
                    c == DOT_BELOW and base not in DOT_BASES
                ):
                    bad.append(unicodedata.normalize("NFC", w))
                    break
            else:
                base = c
    return bad


def uses_line_below(text: str) -> bool:
    return LINE_BELOW in unicodedata.normalize("NFD", text)


def unmarked_ratio(text: str) -> tuple[float, int]:
    """Share of Yoruba words (2+ letters) with no tone mark and no dot below."""
    ws = [
        w
        for w in words(text)
        if len([c for c in w if not unicodedata.combining(c)]) >= 2
        and w.lower() not in ENGLISH_WORDS
    ]
    if not ws:
        return 0.0, 0
    unmarked = sum(1 for w in ws if not has_tone_or_dot(w))
    return unmarked / len(ws), len(ws)


def english_words(text: str) -> list[str]:
    found = []
    for w in words(text):
        if w.isascii() and w.lower() in ENGLISH_WORDS:
            found.append(w)
    return found


def syllables(text: str) -> int:
    """Approximate syllable count (each vowel, plus syllabic nasals before consonants)."""
    base = "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))
    count = sum(1 for c in base if c in VOWELS)
    count += len(re.findall(r"(?i)\bn(?=[^aeiou\W])", base))  # e.g. "n" in "n ló", "ńlá"
    return count
