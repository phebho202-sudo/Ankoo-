# ANKOO — Visual Identity and Colour Grading Guide

| | |
|---|---|
| **Document** | DOC-02 |
| **Version** | v1.0 — Issued for founder approval |
| **Governed by** | DOC-01 Official Cinematic Creative Direction |
| **Used by** | Directors, DOPs, production designers, stylists, colourists, editors, designers |

---

## 1. Principle

ANKOO's colour language is **forest green, deep black and warm ivory**, supported by soft cream, earth tones, natural fabric colours and muted neutrals.

The colour world is built **in front of the camera** (locations, walls, props, wardrobe pairing, light) and **refined in the grade**. It is never achieved by tinting the garment. The garment's real colour is sacred.

---

## 2. The ANKOO palette

> **Status: proposed working values.** No official ANKOO colour codes were found in the asset audit. These values are a starting reference for graphics, typography and set design. If ANKOO already has brand colours (for example, from the logo file or packaging), those override this table. Confirm before printing or building templates.

| Role | Name | HEX | RGB | Use |
|---|---|---|---|---|
| Primary | **ANKOO Forest** | `#1F3A2E` | 31 58 46 | Brand colour fields, end-card backgrounds, set accents |
| Primary | **ANKOO Black** | `#0E0E0C` | 14 14 12 | Backgrounds, typography on light images |
| Primary | **ANKOO Ivory** | `#F2EBDD` | 242 235 221 | Typography on dark images, logo reversal, end cards |
| Support | **Soft Cream** | `#E6DCC8` | 230 220 200 | Secondary fields, packaging backgrounds |
| Support | **Earth** | `#7A5C43` | 122 92 67 | Set dressing, wood, leather tones |
| Support | **Clay** | `#A8805E` | 168 128 94 | Warm accents, light motivated sources |
| Support | **Stone** | `#9A968C` | 154 150 140 | Neutral architecture, secondary text |

### Usage ratio (graphics and set design)
- **60%** deep black / dark neutrals
- **25%** ivory / cream / stone
- **10%** forest green
- **5%** earth / clay accent

### Rules
- Never place forest green text on black (insufficient contrast). Use ivory.
- Never add colours outside this family to graphics, typography or end cards.
- Do not confuse ANKOO Forest with the bright green (`#0b6b3a`) used by the separate Ankoo bookkeeping app in this repository. That is not a fashion brand colour.

---

## 3. Building the colour world on set

| Element | Direction |
|---|---|
| **Locations** | Plaster, stone, dark timber, concrete, limestone, aged brass, deep green foliage, ivory walls. Avoid bright painted walls, branded signage and busy patterns. |
| **Backdrops** | Seamless in deep black, warm grey, forest green or cream. Textured plaster or linen for detail work. |
| **Props** | Minimal and meaningful: a chair, a cap on a table, folded fabric, a mirror, packaging. Nothing decorative for its own sake. |
| **Wardrobe pairing** | Pair the hero garment with accessories and footwear in the palette family so the garment stands out cleanly. |
| **Practicals** | Warm (2700–3200K) practical lights in shot; never coloured LEDs, RGB effects or neon. |
| **Daylight** | Soft, directional window light; avoid hard midday sun on garments unless diffused. |

---

## 4. The ANKOO grade

### 4.1 Target look
- **Shadows:** deep but detailed. Blacks sit low (around 2–5 IRE on the waveform) but texture remains visible in dark fabric. Never crush detail out of black agbada or dark skin.
- **Mid-tones:** natural, warm-leaning.
- **Highlights:** soft roll-off. Ivory and white fabrics hold detail; no clipped whites on embroidery.
- **Contrast:** natural, film-like S-curve. Not flat, not punchy.
- **Saturation:** controlled. Overall saturation slightly below camera default; garment colours restored to accurate values with qualifiers if needed.
- **Colour bias:** gentle warmth in highlights, a faint cool-green lean in deep shadows. This is the Forest-and-Ivory signature; keep it subtle.
- **Grain:** fine, organic film grain at low strength where it suits the material (films, founder documentary). Optional on product close-ups. Never on graphics.

### 4.2 Non-negotiables
1. **Skin first.** All skin tones are rendered accurately and with richness. Check skin against the vectorscope skin-tone line. Never lift blacks so dark skin looks grey or ashy; never push orange.
2. **Garment truth.** The graded garment must match the physical garment viewed under daylight (D65). Compare against a reference still of the garment shot with a colour chart.
3. **No blind presets.** A shared ANKOO base LUT may be used as a starting point, but every shot is balanced and adjusted individually.
4. **Consistency across a film.** Shots in one scene match. Grade hero shots first, then match the rest to them.

### 4.3 Grading workflow
1. Conform the edit; verify source media is linked to the originals, not proxies.
2. Colour-space transform from camera log to the working space (DaVinci Wide Gamut / Intermediate or ACES), then output to Rec.709 Gamma 2.4 (Rec.709-A / 2.2 for web-only deliverables where the team prefers).
3. **Primary balance:** exposure, white balance and contrast per shot, using the colour chart shot at the start of each setup.
4. **Garment check:** compare to the garment reference still; qualify and correct garment hue if it drifted.
5. **Skin check:** isolate and protect skin tones.
6. **Look:** apply the ANKOO look node (shadow/highlight bias, saturation, curve).
7. **Shot match** across each scene.
8. **Grain and texture** last, at output resolution.
9. **Review** on a calibrated reference monitor and on at least one phone (most viewers will see it there).
10. Export a graded master (DOC-09) and save the grade (stills, LUT, project archive) under the campaign's `GRADE` folder.

### 4.4 On-set requirements for colour
- Shoot a colour chart (e.g., X-Rite ColorChecker) and a grey card at the start of every setup and lighting change.
- Shoot a still reference of every garment, flat and on body, under neutral daylight with the chart in frame.
- Lock white balance per setup; do not use auto white balance.
- Record in log or the highest-quality profile available, 10-bit where the camera allows.

---

## 5. Photography (stills) alignment

Stills follow the same grade principles so the website, social feed and films match: deep detailed shadows, soft highlights, accurate skin and fabric, restrained saturation. Product (e-commerce) stills are graded neutral first; campaign stills receive the ANKOO look.

---

## 6. Typography and graphics colour

| Background | Text colour | Logo version |
|---|---|---|
| Dark image / black field | ANKOO Ivory | Light (reversed) version, if approved |
| Forest field | ANKOO Ivory | Light (reversed) version, if approved |
| Light image / ivory field | ANKOO Black | Dark version |

Minimum contrast for any caption: WCAG AA (4.5:1). Check in the edit, not only in design files.

---

## 7. Quick reference card

```
ANKOO COLOUR — FIVE RULES
1. Build the world in front of the lens. Never tint the garment.
2. Skin and fabric are true. Check both every shot.
3. Shadows deep but detailed. Highlights soft, never clipped.
4. Saturation restrained. Green in the shadows, warmth in the light.
5. No blind presets. Every shot balanced by hand.
```

---

## Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| v1.0 | 2026-11-09 | First issue; palette values proposed pending confirmation | Pending — Bolu Felix |
