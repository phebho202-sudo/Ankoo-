"""Build the digital (phone + desktop) album: web JPEGs + index.html.

Usage: python3 -I make_web.py <edited_dir> <out_dir>
"""
import glob
import html
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
EDIT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(OUT, "img"), exist_ok=True)

FILES = {os.path.basename(p).split("_", 1)[1]: p for p in glob.glob(os.path.join(EDIT, "*.jpg"))}
CH = [
    ("i", "I", "The Couple", "Two people, one day.", ["DSCF9966", "DSCF9958", "6"]),
    ("ii", "II", "The Bride", "Bridal portraits.", ["DSCF0300", "DSCF0311", "DSCF0305"]),
    ("iii", "III", "The Groom", "The groom and the men beside him.",
     ["DSCF9939", "DSCF9941", "AMP3315", "AMP3325", "AMP3348"]),
    ("iv", "IV", "In Tradition", "In traditional attire.", ["5", "2", "1", "4"]),
    ("v", "V", "The White Wedding", "The arrival, the aisle, the vows.",
     ["AMP3116", "DSCF0001", "DSCF0061", "AMP3129", "DSCF0070", "DSCF0073", "DSCF0087", "AMP3138", "DSCF0118"]),
    ("vi", "VI", "Just the Two of Us", "Portraits, and a second look.",
     ["AMP3296", "DSCF0253", "DSCF9080", "DSCF9102", "DSCF9084", "DSCF9109"]),
    ("vii", "VII", "Family & Friends", "The people who stood with them.",
     ["DSCF0182", "DSCF0177", "DSCF0187", "DSCF0192", "DSCF0204"]),
    ("viii", "VIII", "The Celebration", "Reception and the dance floor.",
     ["DSCF0500", "DSCF0509", "DSCF0374", "DSCF0353", "DSCF0347"]),
    ("ix", "IX", "In Between", "The small, unposed moments.", ["DSCF9095", "DSCF0173", "AMP3126"]),
]
COVER, CLOSING = "DSCF0230", "DSCF0276"

meta = {}


def web(stem):
    if stem in meta:
        return meta[stem]
    im = Image.open(FILES[stem + ".jpg"])
    im.thumbnail((1800, 1800), Image.LANCZOS)
    n = len(meta) + 1
    name = f"img/{n:02d}.jpg"
    im.save(os.path.join(OUT, name), "JPEG", quality=78, optimize=True, progressive=True)
    meta[stem] = (name, im.width, im.height)
    return meta[stem]


def fig(stem, idx, cls=""):
    src, w, h = web(stem)
    kind = "land" if w > h * 1.05 else "port"
    return (f'<figure class="ph {kind} {cls}"><button class="open" data-i="{idx}" '
            f'aria-label="Open photograph {idx + 1}"><img src="{src}" width="{w}" height="{h}" '
            f'loading="lazy" decoding="async" alt=""></button></figure>')


order = []
cover_src, cw, chh = web(COVER)
parts = []
idx = 0
toc = []
for cid, num, title, sub, stems in CH:
    toc.append(f'<li><a href="#chapter-{cid}"><span class="n">{num}</span>'
               f'<span class="t">{html.escape(title)}</span></a></li>')
    figs = []
    for s in stems:
        figs.append(fig(s, idx))
        order.append(s)
        idx += 1
    parts.append(f'''<section class="chapter" id="chapter-{cid}" aria-labelledby="h-{cid}">
  <header class="ch-head"><p class="eyebrow">Chapter {num}</p><p class="num" aria-hidden="true">{num}</p>
  <h2 id="h-{cid}">{html.escape(title)}</h2><p class="sub">{html.escape(sub)}</p></header>
  <div class="grid">{''.join(figs)}</div>
</section>''')
close_src, clw, clh = web(CLOSING)
order.append(CLOSING)
allsrc = [meta[s][0] for s in order]
allsrc_js = ",".join(f'"{s}"' for s in allsrc)

page = f'''<title>Our August Wedding</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400&display=swap">
<style>
/* Layout: a printed album translated to scroll. Wide ivory margins, chapters as quiet title cards, photographs given room. */
:root {{
  --paper: #F3EEE6; --ink: #2A2623; --muted: #786C60; --line: #D6CCBF; --mat: #EAE3D8; --veil: rgba(20,18,16,.94);
  --display: "Cormorant Garamond", "Cormorant", Garamond, "Times New Roman", serif;
  --label: "Jost", "Futura", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
  --measure: 1120px;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --paper: #161412; --ink: #ECE5DA; --muted: #A79A8B; --line: #39332D; --mat: #1F1C19; --veil: rgba(8,7,6,.96); color-scheme: dark; }} }}
:root[data-theme="dark"] {{ --paper: #161412; --ink: #ECE5DA; --muted: #A79A8B; --line: #39332D; --mat: #1F1C19; --veil: rgba(8,7,6,.96); color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--paper); color: var(--ink); font-family: var(--display); font-weight: 300;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }}
.wrap {{ max-width: var(--measure); margin: 0 auto; }}
.eyebrow, .date, .toc .n, footer p {{ font-family: var(--label); font-weight: 300; text-transform: uppercase; letter-spacing: .28em; font-size: .68rem; color: var(--muted); }}
.cover {{ padding-block: clamp(32px, 8vw, 96px) clamp(40px, 7vw, 88px); display: grid; gap: clamp(28px, 4vw, 48px); justify-items: center; text-align: center; }}
.cover img {{ width: 100%; max-width: 980px; height: auto; display: block; }}
h1 {{ font-weight: 300; font-size: clamp(2.6rem, 7vw, 4.6rem); letter-spacing: .02em; line-height: 1; margin: 0; text-wrap: balance; }}
.rule {{ width: 44px; height: 1px; background: var(--line); border: 0; margin: 0; }}
.cover .titles {{ display: grid; gap: 18px; justify-items: center; }}
.toc {{ border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding-block: 28px; margin-bottom: clamp(48px, 9vw, 120px); }}
.toc ol {{ list-style: none; margin: 0 auto; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 6px 32px; max-width: 900px; }}
.toc a {{ display: flex; gap: 14px; align-items: baseline; color: var(--ink); text-decoration: none; padding: 6px 0; font-size: 1.22rem; }}
.toc a:hover .t, .toc a:focus-visible .t {{ text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 5px; }}
.toc .n {{ min-width: 2.6em; }}
.chapter {{ padding-block: clamp(24px, 4vw, 48px) clamp(56px, 10vw, 140px); scroll-margin-top: 24px; }}
.ch-head {{ display: grid; gap: 6px; margin-bottom: clamp(28px, 5vw, 56px); max-width: 640px; }}
.ch-head .num {{ font-size: clamp(3.4rem, 9vw, 5.6rem); line-height: .9; margin: 10px 0 0; color: var(--line); font-weight: 300; }}
h2 {{ font-weight: 300; font-size: clamp(1.9rem, 4.2vw, 2.7rem); margin: 0; letter-spacing: .01em; text-wrap: balance; }}
.sub {{ font-style: italic; color: var(--muted); font-size: 1.2rem; margin: 4px 0 0; }}
.eyebrow {{ margin: 0; }}
.grid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(12px, 2.4vw, 28px); align-items: center; }}
.ph {{ margin: 0; min-width: 0; }}
.ph.land {{ grid-column: 1 / -1; }}
.ph img {{ display: block; width: 100%; height: auto; max-width: 100%; }}
.ph.land img {{ max-width: 980px; margin: 0 auto; }}
.open {{ all: unset; display: block; cursor: zoom-in; }}
.open:focus-visible {{ outline: 1px solid var(--muted); outline-offset: 6px; }}
.closing {{ display: grid; justify-items: center; gap: 22px; text-align: center; padding-block: 20px clamp(64px, 10vw, 120px); }}
.closing img {{ width: min(100%, 560px); height: auto; display: block; }}
.closing .line {{ font-style: italic; font-size: clamp(1.5rem, 3.4vw, 2rem); margin: 0; }}
footer {{ border-top: 1px solid var(--line); padding-block: 28px 40px; text-align: center; }}
footer p {{ margin: 0; }}
@media (max-width: 560px) {{ .grid {{ grid-template-columns: minmax(0, 1fr); }} }}
.lb {{ position: fixed; inset: 0; background: var(--veil); z-index: 50; display: grid; grid-template-rows: 1fr auto;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) max(16px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 12px) max(16px, env(safe-area-inset-left, 0px)); }}
.lb[hidden] {{ display: none; }}
.lb img {{ max-width: 100%; max-height: 100%; width: auto; height: auto; margin: auto; display: block; align-self: center; justify-self: center; min-height: 0; }}
.lb .stage {{ display: grid; min-height: 0; }}
.lb .bar {{ display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #E9E1D6; font-family: var(--label); font-size: .72rem; letter-spacing: .24em; text-transform: uppercase; padding-top: 10px; }}
.lb button {{ background: none; border: 1px solid rgba(233,225,214,.35); color: #E9E1D6; font: inherit; letter-spacing: inherit; padding: 10px 16px; cursor: pointer; }}
.lb button:focus-visible {{ outline: 1px solid #E9E1D6; outline-offset: 2px; }}
.lb .nav {{ display: flex; gap: 8px; }}
@media (prefers-reduced-motion: no-preference) {{ .lb img {{ animation: fade .35s ease; }} @keyframes fade {{ from {{ opacity: .3; }} to {{ opacity: 1; }} }} }}
</style>

<div class="wrap">
  <header class="cover">
    <img src="{cover_src}" width="{cw}" height="{chh}" alt="The bride's cathedral veil spread across the grass beneath tall trees">
    <div class="titles">
      <p class="eyebrow">A wedding album</p>
      <h1>The Wedding</h1>
      <hr class="rule">
      <p class="date">21 August 2026</p>
    </div>
  </header>
  <nav class="toc" aria-label="Chapters"><ol>{''.join(toc)}</ol></nav>
  {''.join(parts)}
  <section class="closing" aria-label="Closing">
    <button class="open" data-i="{len(order) - 1}" aria-label="Open the closing photograph"><img src="{close_src}" width="{clw}" height="{clh}" loading="lazy" alt="The couple share a kiss beneath the trees"></button>
    <p class="line">Forever begins here.</p>
    <p class="date">21 August 2026</p>
  </section>
  <footer><p>{len(meta)} photographs &middot; nine chapters &middot; MMXXVI</p></footer>
</div>

<div class="lb" id="lightbox" role="dialog" aria-modal="true" aria-label="Photograph viewer" hidden>
  <div class="stage"><img id="lb-img" alt=""></div>
  <div class="bar"><span id="lb-count"></span>
    <div class="nav"><button id="lb-prev" type="button">Previous</button><button id="lb-next" type="button">Next</button><button id="lb-close" type="button">Close</button></div>
  </div>
</div>

<script>
(() => {{
  const SRC = [{allsrc_js}];
  const lb = document.getElementById('lightbox'), img = document.getElementById('lb-img'), count = document.getElementById('lb-count');
  let i = 0, last = null;
  const show = n => {{ i = (n + SRC.length) % SRC.length; img.src = SRC[i]; count.textContent = String(i + 1).padStart(2, '0') + ' / ' + SRC.length; }};
  const open = n => {{ last = document.activeElement; show(n); lb.hidden = false; document.body.style.overflow = 'hidden'; document.getElementById('lb-close').focus(); }};
  const close = () => {{ lb.hidden = true; document.body.style.overflow = ''; if (last) last.focus(); }};
  document.querySelectorAll('.open').forEach(b => b.addEventListener('click', () => open(+b.dataset.i)));
  document.getElementById('lb-prev').onclick = () => show(i - 1);
  document.getElementById('lb-next').onclick = () => show(i + 1);
  document.getElementById('lb-close').onclick = close;
  lb.addEventListener('click', e => {{ if (e.target === lb || e.target.classList.contains('stage')) close(); }});
  document.addEventListener('keydown', e => {{ if (lb.hidden) return;
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); }});
  let x0 = null;
  lb.addEventListener('touchstart', e => {{ x0 = e.touches[0].clientX; }}, {{ passive: true }});
  lb.addEventListener('touchend', e => {{ if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; }});
}})();
</script>
'''
open(os.path.join(OUT, "index.html"), "w").write(page)
print("images", len(meta), "order", len(order))
