"""Global, non-destructive 'quiet luxury' finish.

Reads originals (never modified), writes graded copies. Only global tone/colour
operations are used: no local retouching, no face/body/garment changes.
Usage: python3 -I edit.py <originals_dir> <out_dir>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from selection import ordered  # noqa: E402

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# Tone curve: soft S, refined (not crushed) blacks, highlight roll-off, clean whites.
PTS_X = [0.0, 0.06, 0.25, 0.50, 0.75, 0.90, 1.0]
PTS_Y = [0.016, 0.060, 0.238, 0.500, 0.768, 0.905, 0.985]
LUT = np.interp(np.linspace(0, 1, 256), PTS_X, PTS_Y).astype(np.float32)


def is_mono(a):
    s = a[::16, ::16].astype(np.float32)
    return float(np.abs(s[..., 0] - s[..., 1]).mean() + np.abs(s[..., 1] - s[..., 2]).mean()) < 3.0


LIFT = {"DSCF0001.jpg"}


def trim_frame(im):
    """Remove a uniform white mat/letterbox the photographer baked into the file (frame pixels only)."""
    g = np.asarray(im.convert("L"), dtype=np.float32)
    rows = (g.mean(1) > 246) & (g.std(1) < 6)
    cols = (g.mean(0) > 246) & (g.std(0) < 6)

    def run(mask):
        n = 0
        for v in mask:
            if not v:
                break
            n += 1
        return n

    t, b, l, r = run(rows), run(rows[::-1]), run(cols), run(cols[::-1])
    if max(t, b, l, r) < 0.004 * max(g.shape):
        return im, None
    return im.crop((l, t, g.shape[1] - r, g.shape[0] - b)), (t, b, l, r)


def grade(im, lift=False):
    a = np.asarray(im.convert("RGB"))
    mono = is_mono(a)
    x = a.astype(np.float32) / 255.0
    lum = 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]
    med = float(np.median(lum[::8, ::8]))
    if lift:  # only the genuinely under-exposed arrival frame; low-key artistic edits are respected
        g = max(0.72, np.log(0.30) / np.log(max(med, 1e-3)))
        x = np.power(x, g)
    idx = np.clip(x * 255.0, 0, 255).astype(np.uint8)
    y = LUT[idx]
    if not mono:
        l = (0.2126 * y[..., 0] + 0.7152 * y[..., 1] + 0.0722 * y[..., 2])[..., None]
        y = l + (y - l) * 0.95  # soft, sophisticated saturation
        sh = np.clip(1.0 - l * 2.2, 0, 1)  # shadows weight
        hi = np.clip((l - 0.55) / 0.45, 0, 1)  # highlights weight
        y = y + sh * np.array([0.006, 0.002, -0.004], np.float32) \
              + hi * np.array([0.005, 0.002, -0.006], np.float32)
    out = np.clip(y * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGB"), mono, med


for n, name in enumerate(ordered()):
    src = os.path.join(SRC, name)
    im = Image.open(src)
    icc, exif = im.info.get("icc_profile"), im.info.get("exif")
    im = ImageOps.exif_transpose(im)
    im, trimmed = trim_frame(im)
    if trimmed:
        print(f"  trimmed white frame from {name}: top/bottom/left/right px = {trimmed}")
    g, mono, med = grade(im, name in LIFT)
    stem = os.path.splitext(name)[0].lstrip("_")
    dst = os.path.join(OUT, f"{n:02d}_{stem}.jpg")
    kw = dict(quality=94, subsampling=0, optimize=True)
    if icc:
        kw["icc_profile"] = icc
    g.save(dst, "JPEG", **kw)
    print(f"{dst}  mono={mono} median={med:.2f} {g.size}")
