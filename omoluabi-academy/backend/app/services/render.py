"""Video composition with FFmpeg (Phase 7): long-form 16:9, vertical 9:16, thumbnails.

Everything is rendered locally (no paid service). Yoruba text is drawn with DejaVu Sans,
which places stacked tone marks correctly both in drawtext and in libass (burned captions).
"""

from __future__ import annotations

import json
import subprocess
import textwrap
from dataclasses import dataclass
from pathlib import Path

from app.services import yoruba
from app.services.media import (
    CREAM,
    FONT_BOLD,
    FONT_REGULAR,
    GOLD,
    NAVY,
    MediaError,
    _escape_path,
    ffmpeg,
)
from app.services.subtitles import Cue

FPS = 25
LONG_SIZE = (1920, 1080)
VERTICAL_SIZE = (1080, 1920)
THUMB_SIZE = (1280, 720)
INTRO_SECONDS = 4.0
OUTRO_SECONDS = 5.0
VERTICAL_END_SECONDS = 2.5
FONT_DIR = str(Path(FONT_BOLD).parent)
BRAND = "ỌMỌLÚÀBÍ BUSINESS ACADEMY"


@dataclass(frozen=True)
class Text:
    text: str
    size: int
    y: int
    color: str = CREAM
    bold: bool = True
    wrap: int = 0  # characters per line; 0 = no wrapping
    x: int | None = None  # None = centred


def _drawtext(dst_dir: Path, n: int, t: Text) -> str:
    body = yoruba.normalise(textwrap.fill(t.text, t.wrap) if t.wrap else t.text)
    f = dst_dir / f"text-{n:02d}.txt"
    f.write_text(body, encoding="utf-8")
    x = "(w-text_w)/2" if t.x is None else str(t.x)
    return (
        f"drawtext=fontfile={FONT_BOLD if t.bold else FONT_REGULAR}:"
        f"textfile='{_escape_path(f)}':text_shaping=1:fontcolor={t.color}:"
        f"fontsize={t.size}:line_spacing={t.size // 3}:x={x}:y={t.y}"
    )


def card(dst: Path, texts: list[Text], size: tuple[int, int], *, rule_y: int | None = None) -> Path:
    """A plain branded card (intro, outro, vertical header)."""
    w, h = size
    work = dst.parent / f".{dst.stem}-text"
    work.mkdir(exist_ok=True)
    parts = []
    if rule_y is not None:
        parts.append(f"drawbox=x=(iw-240)/2:y={rule_y}:w=240:h=10:color={GOLD}:t=fill")
    parts += [_drawtext(work, n, t) for n, t in enumerate(texts)]
    try:
        ffmpeg(
            "-f",
            "lavfi",
            "-i",
            f"color=c={NAVY}:s={w}x{h}:d=1",
            "-vf",
            ",".join(parts) if parts else "null",
            "-frames:v",
            "1",
            str(dst),
        )
    finally:
        for f in work.glob("*"):
            f.unlink()
        work.rmdir()
    return dst


def poster(
    dst: Path, *, title: str, portrait: Path, size: tuple[int, int], label: str = ""
) -> Path:
    """Thumbnail / cover: title in gold, presenter portrait framed in gold, brand line."""
    w, h = size
    vertical = h > w
    work = dst.parent / f".{dst.stem}-text"
    work.mkdir(exist_ok=True)
    if vertical:
        side = int(w * 0.66)
        px, py = (w - side) // 2, int(h * 0.42)
        texts = [
            Text(BRAND, 40, 140, GOLD),
            Text(title, 84, 300, CREAM, wrap=16),
            Text(label, 44, py + side + 90, GOLD) if label else None,
        ]
    else:
        side = int(h * 0.62)
        px, py = w - side - 70, (h - side) // 2
        texts = [
            Text(BRAND, 26, 60, GOLD, x=60),
            Text(title, 62, 150, CREAM, wrap=16, x=60),
            Text(label, 32, h - 90, GOLD, x=60) if label else None,
        ]
    draws = [_drawtext(work, n, t) for n, t in enumerate(x for x in texts if x)]
    border = 10
    graph = (
        f"[1:v]scale={side}:{side}:force_original_aspect_ratio=increase,crop={side}:{side},"
        f"pad={side + 2 * border}:{side + 2 * border}:{border}:{border}:color={GOLD}[p];"
        f"[0:v][p]overlay={px - border}:{py - border},{','.join(draws)}"
    )
    try:
        ffmpeg(
            "-f",
            "lavfi",
            "-i",
            f"color=c={NAVY}:s={w}x{h}:d=1",
            "-i",
            str(portrait),
            "-filter_complex",
            graph,
            "-frames:v",
            "1",
            str(dst),
            timeout=120,
        )
    finally:
        for f in work.glob("*"):
            f.unlink()
        work.rmdir()
    return dst


def _ass_time(seconds: float) -> str:
    cs = int(round(seconds * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def ass_captions(
    cues: list[Cue], dst: Path, *, size: tuple[int, int] = VERTICAL_SIZE, font_size: int = 56
) -> Path:
    """Burn-in captions as ASS with the real frame size as PlayRes (so margins are in pixels)."""
    w, h = size
    # Colours are &HAABBGGRR. Cream text on a translucent navy box.
    style = (
        f"Style: Cap,DejaVu Sans,{font_size},&H00ECF6FA,&H00ECF6FA,&H003A1F0B,&H603A1F0B,"
        f"1,0,0,0,100,100,0,0,3,14,0,2,70,70,{int(h * 0.15)},1"
    )
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {w}",
        f"PlayResY: {h}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        style,
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for c in cues:
        # Braces start ASS override tags; the narration never needs them.
        text = yoruba.normalise(c.text).replace("{", "(").replace("}", ")").replace("\n", "\\N")
        lines.append(f"Dialogue: 0,{_ass_time(c.start)},{_ass_time(c.end)},Cap,,0,0,0,,{text}")
    dst.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return dst


def probe(path: Path) -> dict:
    """Facts used by the automated render checks."""
    try:
        proc = subprocess.run(  # noqa: S603
            [  # noqa: S607
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "stream=codec_type,codec_name,width,height:format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            timeout=60,
            check=True,
            stdin=subprocess.DEVNULL,
        )
        info = json.loads(proc.stdout)
    except (subprocess.SubprocessError, ValueError) as exc:
        raise MediaError(f"Could not inspect {path.name}") from exc
    video = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    audio = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), None)
    return {
        "width": video.get("width"),
        "height": video.get("height"),
        "video_codec": video.get("codec_name"),
        "audio_codec": audio.get("codec_name") if audio else None,
        "duration": round(float(info.get("format", {}).get("duration", 0.0)), 3),
    }


def _encode_args(total: float) -> list[str]:
    return [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(FPS),
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ar",
        "44100",
        "-t",
        f"{total:.3f}",
        "-movflags",
        "+faststart",
    ]


def render_long(
    *,
    intro: Path,
    slides: list[Path],
    durations: list[float],
    outro: Path,
    presenter: Path,
    narration_seconds: float,
    dst: Path,
) -> Path:
    """16:9 lesson: intro card, one slide per narrated segment (for exactly its measured
    duration) with the presenter framed on the right, then the outro card."""
    if len(slides) != len(durations):
        raise MediaError("One slide is needed per segment")
    total = INTRO_SECONDS + narration_seconds + OUTRO_SECONDS
    listing = dst.with_suffix(".ffconcat")
    entries = [(intro, INTRO_SECONDS), *zip(slides, durations, strict=True)]
    # The last segment may be slightly shorter/longer than the measured narration; the outro
    # starts exactly when the narration ends.
    entries.append((outro, OUTRO_SECONDS + 1))
    text = "ffconcat version 1.0\n" + "".join(
        f"file '{p.as_posix()}'\nduration {d:.3f}\n" for p, d in entries
    )
    listing.write_text(text + f"file '{outro.as_posix()}'\n", encoding="utf-8")
    w, h = LONG_SIZE
    pw, ph, border = 512, 288, 6
    delay_ms = int(INTRO_SECONDS * 1000)
    end = INTRO_SECONDS + narration_seconds
    graph = (
        f"[0:v]fps={FPS},scale={w}:{h},format=yuv420p,setsar=1[bg];"
        f"[1:v]scale={pw}:{ph},pad={pw + 2 * border}:{ph + 2 * border}:{border}:{border}:"
        f"color={GOLD},setpts=PTS-STARTPTS+{INTRO_SECONDS}/TB[pip];"
        f"[bg][pip]overlay=x=W-w-80:y=(H-h)/2+40:eof_action=pass:"
        f"enable='between(t,{INTRO_SECONDS},{end:.3f})',"
        f"fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.8:.3f}:d=0.8[v];"
        f"[1:a]adelay=delays={delay_ms}:all=1,apad,afade=t=out:st={total - 0.8:.3f}:d=0.8[a]"
    )
    try:
        ffmpeg(
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(listing),
            "-i",
            str(presenter),
            "-filter_complex",
            graph,
            "-map",
            "[v]",
            "-map",
            "[a]",
            *_encode_args(total),
            str(dst),
            timeout=max(300.0, total * 6),
        )
    finally:
        listing.unlink(missing_ok=True)
    return dst


def render_vertical(
    *,
    background: Path,
    presenter: Path,
    captions: Path,
    end_card: Path,
    seconds: float,
    dst: Path,
) -> Path:
    """9:16 cut: branded header, presenter, burned-in Yoruba captions, then an end card."""
    total = seconds + VERTICAL_END_SECONDS
    w, h = VERTICAL_SIZE
    graph = (
        f"[1:v]trim=0:{seconds:.3f},setpts=PTS-STARTPTS,scale={w}:{w * 9 // 16}[p];"
        f"[0:v][p]overlay=0:{int(h * 0.36)}:eof_action=pass,"
        f"ass=filename='{_escape_path(captions)}':fontsdir={FONT_DIR}[c];"
        f"[c][2:v]overlay=0:0:enable='gte(t,{seconds:.3f})',format=yuv420p,setsar=1,"
        f"fade=t=in:st=0:d=0.3[v];"
        f"[1:a]atrim=0:{seconds:.3f},asetpts=PTS-STARTPTS,"
        f"afade=t=out:st={max(0.0, seconds - 0.4):.3f}:d=0.4,apad[a]"
    )
    ffmpeg(
        "-loop",
        "1",
        "-framerate",
        str(FPS),
        "-t",
        f"{total:.3f}",
        "-i",
        str(background),
        "-i",
        str(presenter),
        "-loop",
        "1",
        "-framerate",
        str(FPS),
        "-t",
        f"{total:.3f}",
        "-i",
        str(end_card),
        "-filter_complex",
        graph,
        "-map",
        "[v]",
        "-map",
        "[a]",
        *_encode_args(total),
        str(dst),
        timeout=max(300.0, total * 8),
    )
    return dst
