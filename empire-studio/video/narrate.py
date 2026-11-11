#!/usr/bin/env python3
"""Step 1 of the video pipeline: turn a script into narration audio and a timeline.

Usage:  python3 narrate.py <script.json> <voice.onnx> <out_dir> [speaker_id]

Reads every "say" line in the script, speaks it with the free, offline Piper voice engine,
joins the audio with natural pauses, and writes:
  <out_dir>/narration.wav   the full voice track
  <out_dir>/timeline.json   when each shot, caption and chapter starts and ends
The renderer (render.js) uses the timeline so pictures and captions match the voice exactly.
"""
import json
import re
import sys
import wave

import numpy as np
from piper import PiperVoice, SynthesisConfig

PAUSE_SENTENCE = 0.5    # seconds of silence between sentences
PAUSE_SHOT = 1.0        # between shots
CARD_SECONDS = 3.4      # silent chapter title card
LEAD_IN = 1.2           # silence before the first word
TAIL = 3.0              # hold on the final card
PACE = 1.14             # above 1 = slower, more measured delivery


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "twenty thirty forty fifty sixty seventy eighty ninety".split()
DECADES = "hundreds tens twenties thirties forties fifties sixties seventies eighties nineties".split()


def two_digits(n):
    return ONES[n] if n < 20 else TENS[n // 10 - 2] + ("-" + ONES[n % 10] if n % 10 else "")


def year_words(match):
    """1870 -> eighteen seventy, 1902 -> nineteen oh two, 1880s -> eighteen eighties."""
    y, plural = int(match.group(1)), match.group(2)
    hi, lo = divmod(y, 100)
    if plural:
        return f"{two_digits(hi)} {DECADES[lo // 10]}"
    if y == 2000:
        return "two thousand"
    if 2000 < y < 2010:
        return "two thousand and " + ONES[lo]
    if lo == 0:
        return two_digits(hi) + " hundred"
    return f"{two_digits(hi)} {'oh ' + ONES[lo] if lo < 10 else two_digits(lo)}"


def spoken(text):
    """What the voice says. {shown|spoken} overrides win; years, dollars and percentages are converted automatically."""
    parts = re.split(r"(\{[^}]*\})", text)
    out = []
    for part in parts:
        if part.startswith("{"):
            out.append(part[1:-1].split("|")[1])
            continue
        part = re.sub(r"\$([\d,.]*\d)( million| billion)?", r"\1\2 dollars", part)
        part = re.sub(r"(\d)%", r"\1 percent", part)
        part = re.sub(r"(?<![\d,.$])(1[5-9]\d\d|20\d\d)(s?)(?!\d|[,.]\d)", year_words, part)
        out.append(part)
    return "".join(out)


def shown(text):
    return re.sub(r"\{([^|}]*)\|([^}]*)\}", r"\1", text)


def caption_chunks(text, limit=62):
    """Split a sentence into short caption lines, breaking at punctuation where possible."""
    words, chunks, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > limit:
            chunks.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
            if len(cur) > limit * 0.6 and cur[-1] in ",;:." and w is not words[-1]:
                chunks.append(cur)
                cur = ""
    if cur:
        chunks.append(cur)
    # avoid a tiny orphan as the last caption
    if len(chunks) > 1 and len(chunks[-1]) < 14:
        last = chunks.pop()
        chunks[-1] += " " + last
    return chunks


def parse_text_script(path):
    """Read the plain-text script format (see README): '# Chapter', '@type fields', then narration lines."""
    script = {"title": "", "channel": "", "chapters": []}
    shot = None
    num = lambda x: float(x) if "." in x else int(x)
    for raw in open(path, encoding="utf-8"):
        line = raw.strip()
        if not line:
            shot = None
        elif line.startswith("title:") and not script["chapters"]:
            script["title"] = line[6:].strip()
        elif line.startswith("channel:") and not script["chapters"]:
            script["channel"] = line[8:].strip()
        elif line.startswith("#"):
            name = line[1:].replace("!nocard", "").strip()
            script["chapters"].append({"title": name, "card": "!nocard" not in line, "shots": []})
        elif line.startswith("@"):
            kind, _, rest = line[1:].partition(" ")
            f = [x.strip() for x in rest.split("|")]
            if kind == "year":
                shot = {"type": "year", "year": int(f[0]), "label": f[1]}
            elif kind == "stat":
                shot = {"type": "stat", "prefix": f[0], "value": num(f[1]), "suffix": (" " + f[2]) if f[2] and f[2] != "%" else f[2], "label": f[3]}
            elif kind == "words":
                shot = {"type": "words", "lines": f}
            elif kind == "duo":
                shot = {"type": "duo", "left": f[0].split(";"), "right": f[1].split(";")}
            elif kind == "art":
                shot = {"type": "art", "art": f[0], "caption": f[1]}
            elif kind == "share":
                a, b = f[0].split()
                shot = {"type": "share", "from": int(a), "to": int(b), "label": f[1]}
            elif kind == "grid":
                a, b = f[0].split()
                shot = {"type": "grid", "total": int(a), "taken": int(b), "label": f[1]}
            elif kind == "split":
                a = f[0].split()
                shot = {"type": "split", "count": int(a[0]), "quarter": "quarter" in a, "label": f[1]}
            elif kind == "names":
                shot = {"type": "names", "rows": f}
            elif kind == "arrows":
                shot = {"type": "names", "arrows": True, "rows": [x.replace(">", "→") for x in f]}
            elif kind == "title":
                shot = {"type": "title", "kicker": f[0], "title": f[1], "sub": f[2]}
            elif kind == "timeline":
                shot = {"type": "timeline", "points": [x.split(":", 1) for x in f]}
            elif kind == "bars":
                shot = {"type": "bars", "format": f[0], "rows": [[x.rsplit(":", 1)[0], num(x.rsplit(":", 1)[1])] for x in f[1:]]}
            else:
                raise SystemExit(f"Unknown shot type: {line}")
            shot["say"] = []
            script["chapters"][-1]["shots"].append(shot)
        elif shot is not None:
            shot["say"].append(line)
        else:
            raise SystemExit(f"Narration line outside a shot: {line}")
    return script


def main():
    script_path, model, out_dir = sys.argv[1:4]
    speaker = int(sys.argv[4]) if len(sys.argv) > 4 else None
    script = parse_text_script(script_path) if script_path.endswith(".txt") else json.load(open(script_path, encoding="utf-8"))
    if model == "--check":  # no audio: just report length and how numbers will be spoken
        lines = [l for c in script["chapters"] for s in c["shots"] for l in s["say"]]
        words = sum(len(shown(l).split()) for l in lines)
        print(f"{words} words, {sum(len(c['shots']) for c in script['chapters'])} shots, about {words / 132:.0f} minutes at the pilot's pace")
        for l in lines:
            if spoken(l) != shown(l):
                print("  SAY:", spoken(l))
        return
    voice = PiperVoice.load(model)
    rate = voice.config.sample_rate
    cfg = SynthesisConfig(speaker_id=speaker, length_scale=PACE)

    audio = [np.zeros(int(LEAD_IN * rate), dtype=np.int16)]
    now = LEAD_IN
    shots, captions, chapters, words = [], [], [], 0

    def silence(seconds):
        nonlocal now
        audio.append(np.zeros(int(seconds * rate), dtype=np.int16))
        now += seconds

    for ci, chapter in enumerate(script["chapters"]):
        chapters.append({"start": round(now, 3), "title": chapter["title"]})
        if chapter.get("card", True):
            shots.append({"type": "chapter", "num": ci, "title": chapter["title"], "chapter": chapter["title"],
                          "start": round(now, 3), "end": round(now + CARD_SECONDS, 3)})
            silence(CARD_SECONDS)
        for shot in chapter["shots"]:
            start = now
            for si, line in enumerate(shot["say"]):
                pcm = np.concatenate([c.audio_int16_array for c in voice.synthesize(spoken(line), cfg)])
                # trim leading/trailing near-silence so pauses are under our control
                loud = np.where(np.abs(pcm) > 350)[0]
                if len(loud):
                    pcm = pcm[max(0, loud[0] - int(0.03 * rate)): loud[-1] + int(0.08 * rate)]
                dur = len(pcm) / rate
                text = shown(line)
                words += len(text.split())
                parts = caption_chunks(text)
                total = sum(len(p) for p in parts)
                t = now
                for p in parts:
                    d = dur * len(p) / total
                    captions.append({"start": round(t, 3), "end": round(t + d, 3), "text": p})
                    t += d
                audio.append(pcm)
                now += dur
                if si < len(shot["say"]) - 1:
                    silence(PAUSE_SENTENCE)
            silence(PAUSE_SHOT)
            entry = {k: v for k, v in shot.items() if k != "say"}
            entry.update(chapter=chapter["title"], start=round(start, 3), end=round(now, 3))
            shots.append(entry)

    silence(TAIL)
    shots[-1]["end"] = round(now, 3)
    pcm = np.concatenate(audio)
    with wave.open(f"{out_dir}/narration.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    json.dump({"title": script["title"], "channel": script["channel"], "duration": round(now, 3),
               "shots": shots, "captions": captions, "chapters": chapters},
              open(f"{out_dir}/timeline.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{words} words, {len(shots)} shots, {len(captions)} captions, {now / 60:.2f} minutes")
    for c in chapters:
        print(f"  {int(c['start'] // 60)}:{int(c['start'] % 60):02d} {c['title']}")


if __name__ == "__main__":
    main()
