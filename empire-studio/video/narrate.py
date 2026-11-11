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

PAUSE_SENTENCE = 0.38   # seconds of silence between sentences
PAUSE_SHOT = 0.75       # between shots
CARD_SECONDS = 3.4      # silent chapter title card
LEAD_IN = 1.2           # silence before the first word
TAIL = 3.0              # hold on the final card
PACE = 1.1              # above 1 = slower, more measured delivery


def spoken(text):
    return re.sub(r"\{([^|}]*)\|([^}]*)\}", r"\2", text)


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


def main():
    script_path, model, out_dir = sys.argv[1:4]
    speaker = int(sys.argv[4]) if len(sys.argv) > 4 else None
    script = json.load(open(script_path, encoding="utf-8"))
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
