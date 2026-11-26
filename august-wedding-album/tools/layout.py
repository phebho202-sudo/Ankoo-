"""Editorial album layout -> PDF (print with bleed, or screen).

Usage: python3 -I layout.py <edited_dir> <fonts_dir> <out.pdf> print|screen <tmp_dir>
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
PRINT = MODE == "print"
DPI, Q = (300, 95) if PRINT else (150, 80)
BLEED = 3.0 if PRINT else 0.0
MM = 72 / 25.4
TRIM = 300.0
M = 26.0  # outer margin (mm)

PAPER, INK, TAUPE, RULE = HexColor("#F4EFE7"), HexColor("#2A2623"), HexColor("#7D7165"), HexColor("#CFC5B8")
for n in ["CG-Light", "CG-LightItalic", "CG-Regular", "CG-Italic", "Jost-Light", "Jost-Regular"]:
    pdfmetrics.registerFont(TTFont(n, os.path.join(FONTS, n + ".ttf")))

FILES = {os.path.basename(p).split("_", 1)[1]: p for p in glob.glob(os.path.join(EDIT, "*.jpg"))}


def src(name):
    return FILES[name.lstrip("_")]


def ar(name):
    w, h = Image.open(src(name)).size
    return w / h


DATE = "21 August 2026"
CH = {
    "I": ("The Couple", "Two people, one day."),
    "II": ("The Bride", "Bridal portraits."),
    "III": ("The Groom", "The groom and the men beside him."),
    "IV": ("In Tradition", "In traditional attire."),
    "V": ("The White Wedding", "The arrival, the aisle, the vows."),
    "VI": ("Just the Two of Us", "Portraits, and a second look."),
    "VII": ("Family & Friends", "The people who stood with them."),
    "VIII": ("The Celebration", "Reception and the dance floor."),
    "IX": ("In Between", "The small, unposed moments."),
}

PAGES = [
    ("cover", "DSCF0230.jpg"),
    ("contents",),
    ("opener", "I", "DSCF9966.jpg"),
    ("pair", "DSCF9958.jpg", "6.jpg"),
    ("opener", "II", "DSCF0300.jpg"),
    ("pair", "DSCF0311.jpg", "DSCF0305.jpg"),
    ("opener", "III", "DSCF9939.jpg"),
    ("pair", "DSCF9941.jpg", "_AMP3315.jpg"),
    ("pair", "_AMP3325.jpg", "_AMP3348.jpg"),
    ("opener", "IV", "5.jpg"),
    ("hero", "2.jpg"),
    ("pair", "1.jpg", "4.jpg"),
    ("opener", "V", "_AMP3116.jpg"),
    ("land", "DSCF0001.jpg"),
    ("pair", "DSCF0061.jpg", "_AMP3129.jpg"),
    ("land2", "DSCF0070.jpg", "DSCF0073.jpg"),
    ("bleed", "DSCF0087.jpg", 0.42),
    ("land2", "_AMP3138.jpg", "DSCF0118.jpg"),
    ("opener", "VI", "_AMP3296.jpg"),
    ("bleed", "DSCF0253.jpg", 0.56),
    ("pair", "DSCF9080.jpg", "DSCF9102.jpg"),
    ("land", "DSCF9084.jpg"),
    ("hero", "DSCF9109.jpg"),
    ("opener_land", "VII", "DSCF0182.jpg"),
    ("land2", "DSCF0177.jpg", "DSCF0187.jpg"),
    ("land2", "DSCF0192.jpg", "DSCF0204.jpg"),
    ("opener_land", "VIII", "DSCF0500.jpg"),
    ("bleed", "DSCF0509.jpg", 0.45),
    ("land2", "DSCF0374.jpg", "DSCF0353.jpg"),
    ("land", "DSCF0347.jpg"),
    ("opener", "IX", "DSCF9095.jpg"),
    ("land2", "DSCF0173.jpg", "_AMP3126.jpg"),
    ("closing", "DSCF0276.jpg"),
    ("back",),
]

c = canvas.Canvas(OUT, pagesize=((TRIM + 2 * BLEED) * MM,) * 2)
c.setTitle("The Wedding — 21 August 2026")
c.setAuthor("Wedding album")
_tmp = [0]


def place(name, x, y, w, h, crop=None):
    """Draw image at trim coords (mm). crop=(fx) focus for cover-crop to box aspect."""
    im = Image.open(src(name))
    if crop is not None:
        box_ar, iar = w / h, im.width / im.height
        if iar > box_ar:
            nw = int(im.height * box_ar)
            left = int(min(max(crop * im.width - nw / 2, 0), im.width - nw))
            im = im.crop((left, 0, left + nw, im.height))
        else:
            nh = int(im.width / box_ar)
            top = int((im.height - nh) / 2)
            im = im.crop((0, top, im.width, top + nh))
    px = (round(w / 25.4 * DPI), round(h / 25.4 * DPI))
    if px[0] < im.width:
        im = im.resize(px, Image.LANCZOS)
    _tmp[0] += 1
    p = os.path.join(TMP, f"{MODE}_{_tmp[0]:03d}.jpg")
    im.convert("RGB").save(p, "JPEG", quality=Q, subsampling=0 if PRINT else 2, optimize=True)
    c.drawImage(p, (x + BLEED) * MM, (y + BLEED) * MM, w * MM, h * MM)


def fit(name, bx, by, bw, bh, valign=0.5):
    a = ar(name)
    w, h = (bw, bw / a) if bw / a <= bh else (bh * a, bh)
    x, y = bx + (bw - w) / 2, by + (bh - h) * valign
    place(name, x, y, w, h)
    return x, y, w, h


def text(s, x, y, font, size, color=INK, track=0.0, align="left"):
    c.setFillColor(color)
    t = c.beginText()
    t.setFont(font, size)
    t.setCharSpace(track)
    width = pdfmetrics.stringWidth(s, font, size) + track * (len(s) - 1)
    if align == "center":
        x -= width / MM / 2
    elif align == "right":
        x -= width / MM
    t.setTextOrigin((x + BLEED) * MM, (y + BLEED) * MM)
    t.textOut(s)
    c.drawText(t)


def rule(x1, x2, y):
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line((x1 + BLEED) * MM, (y + BLEED) * MM, (x2 + BLEED) * MM, (y + BLEED) * MM)


def paper():
    c.setFillColor(PAPER)
    c.rect(0, 0, (TRIM + 2 * BLEED) * MM, (TRIM + 2 * BLEED) * MM, stroke=0, fill=1)


def folio(n):
    text(f"{n:02d}", TRIM / 2, 12, "Jost-Light", 6.5, TAUPE, 1.2, "center")


def caps(s, x, y, size=7.5, color=TAUPE, align="left"):
    text(s.upper(), x, y, "Jost-Light", size, color, size * 0.28, align)


toc = {}
for i, p in enumerate(PAGES, 1):
    if p[0] in ("opener", "opener_land"):
        toc[p[1]] = i

for i, p in enumerate(PAGES, 1):
    kind = p[0]
    paper()
    if kind == "cover":
        fit(p[1], M, 82, TRIM - 2 * M, TRIM - M - 82, valign=1)
        text("The Wedding", TRIM / 2, 50, "CG-Light", 34, INK, 1.5, "center")
        rule(TRIM / 2 - 9, TRIM / 2 + 9, 42)
        caps(DATE, TRIM / 2, 33, 8, align="center")
    elif kind == "contents":
        caps("Contents", M + 30, 236, 8)
        y = 214
        for num, (title, _) in CH.items():
            text(num, M + 30, y, "CG-Light", 13, TAUPE, 0.5)
            text(title, M + 52, y, "CG-Light", 17, INK, 0.3)
            text(f"{toc[num]:02d}", TRIM - M - 30, y, "Jost-Light", 8, TAUPE, 1.2, "right")
            y -= 17
        rule(M + 30, TRIM - M - 30, y + 4)
        text("A wedding in August.", M + 30, y - 10, "CG-LightItalic", 13, TAUPE)
        folio(i)
    elif kind == "opener":
        num, (title, sub) = p[1], CH[p[1]]
        fit(p[2], 128, M, TRIM - M - 128, TRIM - 2 * M)
        caps(f"Chapter {num}", M, 214, 7.5)
        text(num, M - 1, 186, "CG-Light", 58, RULE, 0)
        text(title, M, 160, "CG-Light", 25, INK, 0.3)
        rule(M, M + 14, 150)
        text(sub, M, 140, "CG-LightItalic", 12.5, TAUPE)
        folio(i)
    elif kind == "opener_land":
        num, (title, sub) = p[1], CH[p[1]]
        caps(f"Chapter {num}", M, 262, 7.5)
        text(f"{num}  ·  {title}", M, 242, "CG-Light", 25, INK, 0.3)
        text(sub, M, 229, "CG-LightItalic", 12.5, TAUPE)
        fit(p[2], M, M, TRIM - 2 * M, 190, valign=0)
        folio(i)
    elif kind == "hero":
        fit(p[1], M, M + 6, TRIM - 2 * M, TRIM - 2 * M - 6)
        folio(i)
    elif kind == "bleed":
        place(p[1], -BLEED, -BLEED, TRIM + 2 * BLEED, TRIM + 2 * BLEED, crop=p[2])
    elif kind == "land":
        fit(p[1], M, M + 20, TRIM - 2 * M, TRIM - 2 * M - 20)
        folio(i)
    elif kind == "land2":
        a1, a2 = ar(p[1]), ar(p[2])
        g = 7
        w = min(TRIM - 2 * M, (TRIM - 2 * M - 6 - g) / (1 / a1 + 1 / a2))
        h1, h2 = w / a1, w / a2
        x = (TRIM - w) / 2
        top = TRIM / 2 + (h1 + h2 + g) / 2 + 3
        place(p[1], x, top - h1, w, h1)
        place(p[2], x, top - h1 - g - h2, w, h2)
        folio(i)
    elif kind == "pair":
        a1, a2 = ar(p[1]), ar(p[2])
        g = 7
        h = min(TRIM - 2 * M - 10, (TRIM - 2 * M - g) / (a1 + a2))
        w1, w2 = h * a1, h * a2
        x = (TRIM - (w1 + w2 + g)) / 2
        y = (TRIM - h) / 2 + 3
        place(p[1], x, y, w1, h)
        place(p[2], x + w1 + g, y, w2, h)
        folio(i)
    elif kind == "closing":
        fit(p[1], M + 30, 70, TRIM - 2 * M - 60, TRIM - M - 70, valign=1)
        text("Forever begins here.", TRIM / 2, 48, "CG-LightItalic", 16, INK, 0.3, "center")
        caps(DATE, TRIM / 2, 36, 7.5, align="center")
    elif kind == "back":
        text("MMXXVI", TRIM / 2, TRIM / 2, "CG-Light", 14, TAUPE, 4, "center")
    if PRINT:
        tb = [BLEED * MM, BLEED * MM, (TRIM + BLEED) * MM, (TRIM + BLEED) * MM]
        c.setTrimBox(tb)
        c.setBleedBox([0, 0, (TRIM + 2 * BLEED) * MM, (TRIM + 2 * BLEED) * MM])
    c.showPage()

c.save()
print(OUT, len(PAGES), "pages")
