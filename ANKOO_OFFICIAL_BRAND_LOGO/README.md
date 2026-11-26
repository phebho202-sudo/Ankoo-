# ANKOO — Official Brand Logo

A vector rebuild of the ANKOO logotype, made from the supplied reference (`source/reference.jpg`).
Each letter was drawn from geometric primitives. Their dimensions were fitted to the reference by pixel optimisation,
and the result overlaps the reference at **98.2 % IoU** (intersection over union). The only change was technical clean-up.
The identity itself was not changed.

## Colours
| Name | HEX | RGB |
|---|---|---|
| Ankoo Forest Green | `#034915` | 3 · 73 · 21 |
| White | `#FFFFFF` | 255 · 255 · 255 |
| Black (mono) | `#000000` | 0 · 0 · 0 |

The green is sampled directly from the reference background.

## Files
| Version | SVG | PNG | PDF | EPS |
|---|---|---|---|---|
| 01 Primary: white on forest green | ✓ | 3870×3477 | ✓ | ✓ |
| 02 Reverse: green on white | ✓ | 3870×3477 | ✓ | ✓ |
| 03 White, transparent | ✓ | 4800 px wide | ✓ | ✓ |
| 04 Green, transparent | ✓ | 4800 px wide | ✓ | ✓ |
| 05 Black, transparent | ✓ | 4800 px wide | ✓ | ✓ |
| 06 Symbol "à" (on green, on white, white/green/black transparent) | ✓ | 2000×2000 | ✓ | ✓ |

`ankoo-logo-MASTER.svg` is the master artwork: a tight artboard that is 100 units tall, has no background, and uses one
clean compound path per letter (`a`, `n`, `k`, `o1`, `o2`). It has no strokes, clipping masks or transforms.

## Construction (what was regularised)
- **à**: a perfect circular ring cut by a single 45° channel. The stem's inner edge is tangent to the counter,
  and its outer edge continues the ring's outer curve. The accent is a rectangle set perpendicular to the cut.
- **n, K**: unified 23-unit stems on a shared x-height and baseline. The two K diagonals have the same weight.
- **O O**: both O's use one identical drawing with a concentric counter.
- Letter spacing, proportions and the composition ratio (1290 × 1159, logo ≈ 53 % of the width) follow the reference.
  The logo is centred on both axes.

## Usage
- Keep clear space around the logo of at least the height of the accent.
- Minimum size: wordmark 64 px / 15 mm wide. Below 32 px, use the symbol.
- Do not recolour outside the palette, stretch, add effects, shadows or gradients, or retype the logo in a font.

## Regenerate
`pip install skia-pathops cairocffi numpy pillow` then `python3 source/build.py` (it writes into this folder).
