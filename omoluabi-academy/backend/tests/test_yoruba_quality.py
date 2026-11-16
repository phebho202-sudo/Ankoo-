import re
import unicodedata

import pytest

from app.services import quality, subtitles, yoruba

GOOD_YO = "Ẹ káàbọ̀ sí Ọmọlúàbí. Lónìí a ó sọ̀rọ̀ nípa èrè nínú òwò kékeré."
GOOD_EN = "Welcome to Omoluabi. Today we will talk about profit in a small business."


# ---------------------------------------------------------------- orthography
def test_normalise_replaces_line_below_and_composes():
    assert yoruba.normalise("e\u0329") == "ẹ"
    assert yoruba.normalise("o\u0323\u0300") == unicodedata.normalize("NFC", "ọ̀")


def test_misplaced_marks_detected():
    assert yoruba.mark_problems(GOOD_YO) == []
    assert yoruba.mark_problems("k\u0301á") == ["ḱá"]  # tone on a consonant
    assert yoruba.mark_problems("a\u0323") == ["ạ"]  # dot below on 'a'
    assert yoruba.mark_problems("ń ǹ ṣ") == []  # syllabic nasals and ṣ are valid


def test_unmarked_ratio():
    assert yoruba.unmarked_ratio(GOOD_YO)[0] < 0.2
    stripped = "".join(
        c for c in unicodedata.normalize("NFD", GOOD_YO) if not unicodedata.combining(c)
    )
    assert yoruba.unmarked_ratio(stripped)[0] == 1.0


def test_english_detection_and_syllables():
    assert yoruba.english_words("Èrè ni the profit wa") == ["the", "profit"]
    assert yoruba.syllables("Ọmọlúàbí") == 5


# ---------------------------------------------------------------- quality score
def seg(yo=GOOD_YO, en=GOOD_EN):
    return {"id": "s1", "text_yo": yo, "text_en": en, "visual": ""}


def test_clean_script_scores_well_and_always_carries_disclaimer():
    q = quality.assess([seg()], "Èrè nínú òwò", {"profit": "èrè"})
    assert q["score"] == 100 and not q["errors"] and not q["warnings"]
    assert "cannot judge tone accuracy" in q["disclaimer"]


def test_missing_tone_marks_is_an_error():
    stripped = "".join(
        c for c in unicodedata.normalize("NFD", GOOD_YO * 2) if not unicodedata.combining(c)
    )
    q = quality.assess([seg(yo=stripped)], "Ere")
    assert [e["code"] for e in q["errors"]] == ["tone_marks_missing"]


@pytest.mark.parametrize(
    "yo,en,code",
    [
        ("", GOOD_EN, "missing_yoruba"),
        (GOOD_YO, "", "missing_english"),
    ],
)
def test_missing_text_is_an_error(yo, en, code):
    assert quality.assess([seg(yo, en)], "x")["errors"][0]["code"] == code


def test_warnings():
    q = quality.assess(
        [seg(yo=GOOD_YO + " the business", en=GOOD_EN + " It costs ₦25,000.")],
        "Èrè",
        {"profit": "èrè", "customer": "oníbàárà", "small business": "òwò kékeré"},
    )
    codes = {w["code"] for w in q["warnings"]}
    assert codes == {"english_in_yoruba", "numbers_missing"}
    q2 = quality.assess([seg(en="Our customers matter.")], "Èrè", {"customer": "oníbàárà"})
    assert any(w["code"] == "glossary_term_not_used" for w in q2["warnings"])


def test_copied_source_is_an_error():
    q = quality.assess([seg()], "Èrè", originality={"flagged": True, "words": 14, "excerpt": "x"})
    assert q["errors"][0]["code"] == "copied_source_wording"


# ---------------------------------------------------------------- subtitles & synchronisation
SEGS = [
    seg(),
    {
        "id": "s2",
        "text_yo": "Ẹ jẹ́ ká wo àpẹẹrẹ kan láti ọjà Balógun, níbi tí ìyá Àdùkẹ́ ti ń ta aṣọ.",
        "text_en": "Let us look at an example from Balogun market, where Mama Aduke sells fabric.",
        "visual": "",
    },
    {
        "id": "s3",
        "text_yo": "Iye owó aṣọ kan jẹ́ ₦12,500.",
        "text_en": "One fabric costs ₦12,500.",
        "visual": "",
    },
]


@pytest.mark.parametrize("durations", [None, [6.0, 9.5, 3.2]])
def test_cues_are_ordered_and_never_overlap(durations):
    for lang in ("yo", "en"):
        cues = subtitles.build_cues(SEGS, lang, durations)
        assert [c.index for c in cues] == list(range(1, len(cues) + 1))
        for a, b in zip(cues, cues[1:], strict=False):
            assert a.start < a.end <= b.start


def test_english_and_yoruba_share_segment_timing():
    yo = subtitles.build_cues(SEGS, "yo")
    en = subtitles.build_cues(SEGS, "en")
    for n in (1, 2, 3):
        yo_seg = [c for c in yo if c.segment == n]
        en_seg = [c for c in en if c.segment == n]
        assert yo_seg[0].start == en_seg[0].start
        assert yo_seg[-1].end == pytest.approx(en_seg[-1].end, abs=0.002)


def test_real_audio_durations_drive_timing():
    durations = [6.0, 9.5, 3.2]
    cues = subtitles.build_cues(SEGS, "yo", durations)
    assert cues[-1].end == pytest.approx(sum(durations), abs=0.002)
    seg2 = [c for c in cues if c.segment == 2]
    assert seg2[0].start == pytest.approx(6.0, abs=0.002)
    assert seg2[-1].end == pytest.approx(15.5, abs=0.002)
    with pytest.raises(ValueError):
        subtitles.build_cues(SEGS, "yo", [1.0])


def test_line_limits():
    long = {"id": "x", "text_yo": "ẹ̀kọ́ " * 60, "text_en": "lesson " * 60, "visual": ""}
    for c in subtitles.build_cues([long], "en"):
        lines = c.text.split("\n")
        assert len(lines) <= subtitles.MAX_LINES
        assert all(len(line) <= subtitles.MAX_LINE for line in lines)


def test_srt_format_is_valid():
    srt = subtitles.to_srt(subtitles.build_cues(SEGS, "yo"))
    blocks = srt.strip().split("\n\n")
    for i, block in enumerate(blocks, start=1):
        lines = block.split("\n")
        assert lines[0] == str(i)
        assert re.fullmatch(r"\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}", lines[1])
        assert len(lines) >= 3
    assert "₦12,500" in srt and srt == unicodedata.normalize("NFC", srt)
    assert subtitles._ts(3725.5) == "01:02:05,500"
