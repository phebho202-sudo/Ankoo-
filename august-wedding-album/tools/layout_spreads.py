"""Flush-mount layflat album in spreads (style ref: light & airy collage photobook).

Photos run edge to edge, separated only by thin white seams. Ivory text panels open chapters.
Usage: python3 -I layout_spreads.py <edited_dir> <fonts_dir> <out_dir> print|screen <tmp_dir>
Writes: COVER.pdf (single 30x30 page) and SPREADS.pdf (60x30 spreads); screen mode also writes
spread JPEGs for the web album.
"""
import glob
import os
import sys

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

EDIT, FONTS, OUT, MODE, TMP = sys.argv[1:6]
os.makedirs(TMP, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
PRINT = MODE == "print"
DPI, Q = (300, 95) if PRINT else (150, 80)
B = 3.0 if PRINT else 0.0  # bleed (mm)
MM = 72 / 25.4
PW, H = 300.0, 300.0  # page
W = 2 * PW  # spread
G = 3.0  # white seam between photos

IVORY, SEAM, INK, TAUPE, RULE = (HexColor(c) for c in ("#F3EEE6", "#FBF9F5", "#2A2623", "#7D7165", "#CFC5B8"))
for n in ["CG-Light", "CG-LightItalic", "Jost-Light"]:
    pdfmetrics.registerFont(TTFont(n, os.path.join(FONTS, n + ".ttf")))
FILES = {os.path.basename(p).split("_", 1)[1]: p for p in glob.glob(os.path.join(EDIT, "*.jpg"))}
DATE = "21 August 2026"

# Focus points (fx, fy from top) for cover-crops; default centre, upper-third for portraits.
FOCUS = {
    "DSCF0230.jpg": (0.62, 0.5), "DSCF9966.jpg": (0.55, 0.38), "DSCF9958.jpg": (0.5, 0.35), "6.jpg": (0.5, 0.42),
    "DSCF0253.jpg": (0.55, 0.45), "DSCF0300.jpg": (0.45, 0.4), "DSCF0311.jpg": (0.42, 0.5), "DSCF0305.jpg": (0.5, 0.5),
    "DSCF9939.jpg": (0.5, 0.35), "DSCF9941.jpg": (0.45, 0.45), "5.jpg": (0.5, 0.45), "2.jpg": (0.5, 0.5),
    "1.jpg": (0.5, 0.5), "4.jpg": (0.5, 0.5), "_AMP3116.jpg": (0.45, 0.4), "DSCF0061.jpg": (0.5, 0.35),
    "_AMP3129.jpg": (0.5, 0.35), "DSCF0087.jpg": (0.5, 0.6), "_AMP3296.jpg": (0.5, 0.4), "DSCF9109.jpg": (0.5, 0.5),
    "DSCF9084.jpg": (0.4, 0.4), "DSCF0276.jpg": (0.5, 0.4), "DSCF0509.jpg": (0.4, 0.45), "DSCF0001.jpg": (0.5, 0.6),
    "DSCF0182.jpg": (0.5, 0.45), "DSCF0177.jpg": (0.5, 0.4), "DSCF0187.jpg": (0.5, 0.45), "DSCF0192.jpg": (0.5, 0.45),
    "DSCF0204.jpg": (0.5, 0.42), "DSCF0374.jpg": (0.5, 0.42), "DSCF0353.jpg": (0.5, 0.4), "DSCF0347.jpg": (0.5, 0.35),
    "DSCF0173.jpg": (0.5, 0.45), "DSCF0500.jpg": (0.5, 0.35), "DSCF0070.jpg": (0.5, 0.56), "DSCF0073.jpg": (0.5, 0.45),
    "_AMP3138.jpg": (0.5, 0.45), "DSCF0118.jpg": (0.5, 0.4),
}

CH = {
    "I": ("The Couple", "Two people, one day."),
    "II": ("The Bride", "Bridal portraits."),
    "III": ("The Groom", "The groom and his men."),
    "IV": ("In Tradition", "In traditional attire."),
    "V": ("The White Wedding", "The arrival, the aisle, the vows."),
    "VI": ("Just the Two of Us", "Portraits, and a second look."),
    "VII": ("Family & Friends", "The people who stood with them."),
    "VIII": ("The Celebration", "Guests, toasts and the dance floor."),
}

SPREADS = [
    ("title", "DSCF0230.jpg"),
    ("openP", "I", "6.jpg", ["DSCF9966.jpg"]),
    ("halves", "DSCF9958.jpg", "DSCF0253.jpg"),
    ("openP", "II", "DSCF0300.jpg", ["DSCF0311.jpg", "DSCF0305.jpg"]),
    ("openP", "III", "DSCF9941.jpg", ["DSCF9939.jpg"]),
    ("trio", "_AMP3315.jpg", "_AMP3325.jpg", "_AMP3348.jpg"),
    ("openP", "IV", "2.jpg", ["5.jpg"]),
    ("halves", "1.jpg", "4.jpg"),
    ("openL", "V", "DSCF0001.jpg", ["_AMP3116.jpg"]),
    ("halves", "DSCF0061.jpg", "_AMP3129.jpg"),
    ("pano", "DSCF0087.jpg"),
    ("stack4", "DSCF0070.jpg", "DSCF0073.jpg", "_AMP3138.jpg", "DSCF0118.jpg"),
    ("openP", "VI", "_AMP3296.jpg", ["DSCF9109.jpg"]),
    ("mosaic", "DSCF9084.jpg", "DSCF9095.jpg", "DSCF9102.jpg", "DSCF9080.jpg"),
    ("openL", "VII", "DSCF0182.jpg", ["DSCF0177.jpg", "DSCF0187.jpg"]),
    ("stack4", "DSCF0192.jpg", "DSCF0204.jpg", "DSCF0374.jpg", "DSCF0353.jpg"),
    ("openL", "VIII", "DSCF0500.jpg", ["DSCF0347.jpg", "DSCF0173.jpg"]),
    ("pano", "DSCF0509.jpg"),
    ("closing", "DSCF0276.jpg"),
]

_n = [0]
spread_imgs = []  # for screen: list of (spread index, [(name, x, y, w, h)]) to build web JPEGs


def text(c, s, x, y, font, size, color=INK, track=0.0, align="left"):
    c.setFillColor(color)
    t = c.beginText()
    t.setFont(font, size)
    t.setCharSpace(track)
    wd = pdfmetrics.stringWidth(s, font, size) + track * (len(s) - 1)
    if align == "center":
        x -= wd / MM / 2
    elif align == "right":
        x -= wd / MM
    t.setTextOrigin((x + B) * MM, (y + B) * MM)
    t.textOut(s)
    c.drawText(t)


def caps(c, s, x, y, size=7.5, align="left"):
    text(c, s.upper(), x, y, "Jost-Light", size, TAUPE, size * 0.28, align)


def crop_to(name, w, h):
    im = Image.open(FILES[name.lstrip("_")])
    fx, fy = FOCUS.get(name, (0.5, 0.4))
    box, iar = w / h, im.width / im.height
    if iar > box:
        nw = int(im.height * box)
        left = int(min(max(fx * im.width - nw / 2, 0), im.width - nw))
        im = im.crop((left, 0, left + nw, im.height))
    else:
        nh = int(im.width / box)
        top = int(min(max(fy * im.height - nh / 2, 0), im.height - nh))
        im = im.crop((0, top, im.width, top + nh))
    return im


def cell(c, name, x, y, w, h, sw):
    """Fill cell (spread mm) edge-to-edge; cells on the outer edge run into the bleed."""
    x0, y0, x1, y1 = x, y, x + w, y + h
    if x0 <= 0.01:
        x0 -= B
    if y0 <= 0.01:
        y0 -= B
    if x1 >= sw - 0.01:
        x1 += B
    if y1 >= H - 0.01:
        y1 += B
    w, h = x1 - x0, y1 - y0
    im = crop_to(name, w, h)
    px = (round(w / 25.4 * DPI), round(h / 25.4 * DPI))
    if px[0] < im.width:
        im = im.resize(px, Image.LANCZOS)
    eff = im.width / (w / 25.4)
    _n[0] += 1
    p = os.path.join(TMP, f"{MODE}_{_n[0]:03d}.jpg")
    im.convert("RGB").save(p, "JPEG", quality=Q, subsampling=0 if PRINT else 2, optimize=True)
    c.drawImage(p, (x0 + B) * MM, (y0 + B) * MM, w * MM, h * MM)
    return eff


def bg(c, color, x, y, w, h):
    c.setFillColor(color)
    c.rect((x + B) * MM, (y + B) * MM, w * MM, h * MM, stroke=0, fill=1)


def chapter_text(c, num, x0, wd, top=True, y_base=None):
    title, sub = CH[num]
    if y_base is None:  # tall strip: numeral high, words low
        text(c, num, x0 + 14, 236, "CG-Light", 54, RULE)
        caps(c, f"Chapter {num}", x0 + 15, 92)
        text(c, title, x0 + 14, 70, "CG-Light", 23, INK, 0.3)
        text(c, sub, x0 + 14, 56, "CG-LightItalic", 11.5, TAUPE)
    else:
        caps(c, f"Chapter {num}", x0 + 20, y_base + 62)
        text(c, f"{num}   {title}", x0 + 20, y_base + 40, "CG-Light", 25, INK, 0.3)
        text(c, sub, x0 + 20, y_base + 25, "CG-LightItalic", 12, TAUPE)


lowres = []


def draw_spread(c, sp):
    kind = sp[0]
    h2 = (H - G) / 2
    R0, RW = PW + G / 2, PW - G / 2  # right page cell origin/width
    LW = PW - G / 2
    cells = []
    bg(c, SEAM, -B, -B, W + 2 * B, H + 2 * B)
    if kind == "title":
        bg(c, IVORY, -B, -B, PW + B, H + 2 * B)
        caps(c, "A wedding album", PW / 2, 214, 7.5, "center")
        text(c, "The Wedding", PW / 2, 184, "CG-Light", 36, INK, 1.5, "center")
        caps(c, DATE, PW / 2, 166, 7.5, "center")
        y = 128
        for num, (t, _) in CH.items():
            text(c, num, 92, y, "CG-Light", 11, TAUPE)
            text(c, t, 110, y, "CG-Light", 13.5, INK, 0.2)
            y -= 11.5
        cells.append((sp[1], R0, 0, RW, H))
    elif kind in ("openP", "openL"):
        num, lead, right = sp[1], sp[2], sp[3]
        bg(c, IVORY, -B, -B, PW + B, H + 2 * B)
        if kind == "openP":
            strip = 112
            chapter_text(c, num, 0, strip)
            cells.append((lead, strip, 0, LW - strip, H))
        else:
            chapter_text(c, num, 0, LW, y_base=200)
            cells.append((lead, 0, 0, LW, 196))
        if len(right) == 1:
            cells.append((right[0], R0, 0, RW, H))
        elif kind == "openP":
            cw = (RW - G) / 2
            cells += [(right[0], R0, 0, cw, H), (right[1], R0 + cw + G, 0, cw, H)]
        else:
            cells += [(right[0], R0, h2 + G, RW, h2), (right[1], R0, 0, RW, h2)]
    elif kind == "halves":
        cells += [(sp[1], 0, 0, LW, H), (sp[2], R0, 0, RW, H)]
    elif kind == "trio":
        cw = (W - 2 * G) / 3
        cells += [(sp[1 + i], i * (cw + G), 0, cw, H) for i in range(3)]
    elif kind == "pano":
        cells.append((sp[1], 0, 0, W, H))
    elif kind == "stack4":
        cells += [(sp[1], 0, h2 + G, LW, h2), (sp[2], 0, 0, LW, h2),
                  (sp[3], R0, h2 + G, RW, h2), (sp[4], R0, 0, RW, h2)]
    elif kind == "mosaic":
        mw = 120
        cells += [(sp[1], 0, 0, LW, H), (sp[2], R0, h2 + G, mw, h2), (sp[3], R0, 0, mw, h2),
                  (sp[4], R0 + mw + G, 0, W - (R0 + mw + G), H)]
    elif kind == "closing":
        cells.append((sp[1], 0, 0, LW, H))
        bg(c, IVORY, PW, -B, PW + B, H + 2 * B)
        text(c, "Forever begins here.", PW + PW / 2, 156, "CG-LightItalic", 19, INK, 0.3, "center")
        caps(c, DATE, PW + PW / 2, 140, 7.5, "center")
    for name, x, y, w, h in cells:
        eff = cell(c, name, x, y, w, h, W)
        if eff < 250:
            lowres.append((name, round(eff)))
    return cells


# Cover: single 30x30 ivory page, no photograph (like a fabric cover with a debossed title).
cov = canvas.Canvas(os.path.join(OUT, "COVER.pdf"), pagesize=((PW + 2 * B) * MM, (H + 2 * B) * MM))
cov.setFillColor(IVORY)
cov.rect(0, 0, (PW + 2 * B) * MM, (H + 2 * B) * MM, stroke=0, fill=1)
text(cov, "The Wedding", PW / 2, 156, "CG-Light", 34, INK, 1.6, "center")
cov.setStrokeColor(RULE)
cov.line((PW / 2 - 9 + B) * MM, (146 + B) * MM, (PW / 2 + 9 + B) * MM, (146 + B) * MM)
caps(cov, DATE, PW / 2, 136, 7.5, "center")
cov.showPage()
cov.save()

c = canvas.Canvas(os.path.join(OUT, "SPREADS.pdf"), pagesize=((W + 2 * B) * MM, (H + 2 * B) * MM))
c.setTitle("The Wedding — 21 August 2026")
used = []
for i, sp in enumerate(SPREADS, 1):
    cells = draw_spread(c, sp)
    used += [x[0] for x in cells]
    if PRINT:
        c.setTrimBox([B * MM, B * MM, (W + B) * MM, (H + B) * MM])
        c.setBleedBox([0, 0, (W + 2 * B) * MM, (H + 2 * B) * MM])
    c.showPage()
c.save()
print(len(SPREADS), "spreads,", len(used), "photos; under 250 ppi:", lowres or "none")
print("USED", " ".join(used))
