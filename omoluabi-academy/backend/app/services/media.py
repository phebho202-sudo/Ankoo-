"""Local media processing with FFmpeg (free, no external service).

Every command runs with a timeout and fails loudly. Text on images uses DejaVu Sans with
HarfBuzz shaping: tested to place Yoruba stacked marks (Ẹ̀, ọ́, jẹ́, ń) correctly, which
Noto Sans does not do in FFmpeg's drawtext.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import textwrap
from pathlib import Path

from app.core.errors import AppError
from app.services import yoruba

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
NAVY, GOLD, CREAM = "0x0B1F3A", "0xC9A227", "0xFAF6EC"
SEGMENT_PAUSE = 0.35  # seconds of silence between narrated segments
TIMEOUT = 600


class MediaError(AppError):
    code = "media_error"
    status_code = 500


def available() -> list[str]:
    """Problems that would stop media work on this machine (empty list = ready)."""
    problems = []
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            problems.append(f"{tool} is not installed")
    for font in (FONT_BOLD, FONT_REGULAR):
        if not Path(font).exists():
            problems.append(f"font missing: {font} (install fonts-dejavu-core)")
    return problems


def _run(args: list[str], timeout: float = TIMEOUT) -> None:
    try:
        proc = subprocess.run(  # noqa: S603
            args, capture_output=True, timeout=timeout, check=False, stdin=subprocess.DEVNULL
        )
    except subprocess.TimeoutExpired as exc:
        raise MediaError(f"{args[0]} timed out") from exc
    if proc.returncode != 0:
        tail = proc.stderr.decode(errors="replace").strip().splitlines()[-3:]
        raise MediaError(f"{args[0]} failed: {' | '.join(tail)}")


def ffmpeg(*args: str, timeout: float = TIMEOUT) -> None:
    _run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *args], timeout=timeout)


def image_size(path: Path) -> tuple[int, int]:
    """Decode an image's dimensions; raises MediaError if it is not a readable image."""
    try:
        proc = subprocess.run(  # noqa: S603
            [  # noqa: S607
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            timeout=30,
            check=True,
            stdin=subprocess.DEVNULL,
        )
        stream = json.loads(proc.stdout)["streams"][0]
        w, h = int(stream["width"]), int(stream["height"])
    except (subprocess.SubprocessError, KeyError, IndexError, ValueError) as exc:
        raise MediaError("The image could not be read") from exc
    if w < 64 or h < 64:
        raise MediaError("The image is too small")
    return w, h


def duration(path: Path) -> float:
    try:
        proc = subprocess.run(  # noqa: S603
            [  # noqa: S607 (ffprobe/ffmpeg are resolved from PATH by design; checked in available())
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            timeout=60,
            check=True,
        )
        return round(float(json.loads(proc.stdout)["format"]["duration"]), 3)
    except (subprocess.SubprocessError, KeyError, ValueError) as exc:
        raise MediaError(f"Could not read the duration of {path.name}") from exc


def to_wav(src: Path, dst: Path) -> Path:
    """Decode any audio to 44.1 kHz mono 16-bit WAV (exact, sample-accurate joining)."""
    ffmpeg("-i", str(src), "-ac", "1", "-ar", "44100", "-sample_fmt", "s16", str(dst))
    return dst


def join_with_pauses(wavs: list[Path], dst: Path, pause: float = SEGMENT_PAUSE) -> list[float]:
    """Concatenate segment WAVs, each followed by ``pause`` seconds of silence (except the last).

    Returns the effective per-segment durations (audio + following pause), which the subtitle
    timeline uses so captions stay in sync with the joined narration.
    """
    if not wavs:
        raise MediaError("Nothing to join")
    inputs, filters, labels, durations = [], [], [], []
    for i, w in enumerate(wavs):
        inputs += ["-i", str(w)]
        d = duration(w)
        pad = pause if i < len(wavs) - 1 else 0.0
        filters.append(f"[{i}:a]apad=pad_dur={pad}[a{i}]")
        labels.append(f"[a{i}]")
        durations.append(round(d + pad, 3))
    graph = ";".join(filters) + f";{''.join(labels)}concat=n={len(wavs)}:v=0:a=1[out]"
    ffmpeg(*inputs, "-filter_complex", graph, "-map", "[out]", "-ac", "1", "-ar", "44100", str(dst))
    return durations


def normalise_to_mp3(src: Path, dst: Path) -> Path:
    """EBU R128 loudness normalisation (-16 LUFS, typical for online video) and MP3 encode."""
    ffmpeg(
        "-i",
        str(src),
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-ar",
        "44100",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "128k",
        str(dst),
    )
    return dst


def waveform(src: Path, dst: Path, width: int = 1600, height: int = 240) -> Path:
    ffmpeg(
        "-i",
        str(src),
        "-filter_complex",
        f"aformat=channel_layouts=mono,showwavespic=s={width}x{height}:colors={GOLD}",
        "-frames:v",
        "1",
        str(dst),
    )
    return dst


def _escape_path(p: Path) -> str:
    return str(p).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def slide(
    dst: Path,
    *,
    heading: str,
    body: str,
    footer: str,
    size: tuple[int, int] = (1920, 1080),
    body_wrap: int = 46,
    body_size: int = 56,
) -> Path:
    """A branded educational card: navy background, gold rule, Yoruba text with correct marks.

    ``body_wrap``/``body_size`` narrow the text column, e.g. to leave room for the presenter.
    """
    w, h = size
    heading_file = dst.with_suffix(".heading.txt")
    body_file = dst.with_suffix(".body.txt")
    footer_file = dst.with_suffix(".footer.txt")
    heading_file.write_text(
        yoruba.normalise(textwrap.fill(heading, max(20, body_wrap - 8))), encoding="utf-8"
    )
    body_file.write_text(yoruba.normalise(textwrap.fill(body, body_wrap)), encoding="utf-8")
    footer_file.write_text(footer, encoding="utf-8")
    vf = ",".join(
        [
            f"drawbox=x=120:y=150:w=220:h=10:color={GOLD}:t=fill",
            f"drawtext=fontfile={FONT_BOLD}:textfile='{_escape_path(heading_file)}':text_shaping=1:"
            f"fontcolor={GOLD}:fontsize=64:line_spacing=18:x=120:y=200",
            f"drawtext=fontfile={FONT_BOLD}:textfile='{_escape_path(body_file)}':text_shaping=1:"
            f"fontcolor={CREAM}:fontsize={body_size}:line_spacing=26:x=120:y=430",
            f"drawtext=fontfile={FONT_REGULAR}:textfile='{_escape_path(footer_file)}':text_shaping=1:"
            f"fontcolor={CREAM}@0.7:fontsize=30:x=120:y=h-110",
        ]
    )
    try:
        ffmpeg(
            "-f",
            "lavfi",
            "-i",
            f"color=c={NAVY}:s={w}x{h}:d=1",
            "-vf",
            vf,
            "-frames:v",
            "1",
            str(dst),
        )
    finally:
        for f in (heading_file, body_file, footer_file):
            f.unlink(missing_ok=True)
    return dst


def placeholder_portrait(dst: Path) -> Path:
    """Brand card used when no portrait has been uploaded (no invented face)."""
    letter = dst.with_suffix(".txt")
    letter.write_text("Ọ", encoding="utf-8")
    try:
        ffmpeg(
            "-f",
            "lavfi",
            "-i",
            f"color=c={NAVY}:s=1080x1080:d=1",
            "-vf",
            f"drawbox=x=290:y=290:w=500:h=500:color={GOLD}:t=fill,"
            f"drawtext=fontfile={FONT_BOLD}:textfile='{_escape_path(letter)}':text_shaping=1:"
            f"fontcolor={NAVY}:fontsize=360:x=(w-text_w)/2:y=(h-text_h)/2",
            "-frames:v",
            "1",
            str(dst),
        )
    finally:
        letter.unlink(missing_ok=True)
    return dst


def presenter_clip(
    portrait: Path,
    audio: Path,
    dst: Path,
    *,
    seconds: float,
    size: tuple[int, int] = (1280, 720),
    fps: int = 25,
) -> Path:
    """Hybrid presenter video: the still portrait with a slow push-in, over the narration.

    Cheap (rendered locally) and consistent. A lip-synced avatar is an optional upgrade that
    needs a licensed avatar provider and an avatar-minutes budget.
    """
    w, h = size
    frames = max(1, int(seconds * fps))
    # Decode the portrait once into a clean PNG with a short timeout. Looping a corrupt image
    # directly can make FFmpeg retry forever.
    clean = dst.with_suffix(".portrait.png")
    ffmpeg("-i", str(portrait), "-frames:v", "1", str(clean), timeout=60)
    vf = (
        f"scale={w * 2}:{h * 2}:force_original_aspect_ratio=increase,crop={w * 2}:{h * 2},"
        f"zoompan=z='min(1.0+0.0004*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s={w}x{h}:fps={fps},format=yuv420p"
    )
    try:
        ffmpeg(
            "-loop",
            "1",
            "-i",
            str(clean),
            "-i",
            str(audio),
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "26",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-t",
            f"{seconds:.3f}",
            "-shortest",
            "-movflags",
            "+faststart",
            str(dst),
            timeout=max(120.0, seconds * 4),
        )
    finally:
        clean.unlink(missing_ok=True)
    return dst
