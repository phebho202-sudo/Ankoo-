# ANKOO — Editing and Post-Production Standard

| | |
|---|---|
| **Document** | DOC-06 |
| **Version** | v1.0 — Issued for founder approval |
| **Governed by** | DOC-01 |
| **Used by** | Editors, assistant editors, colourists, motion designers, sound mixers |

---

## 1. Editing principles

1. **Every scene serves a purpose.** If removing a shot changes nothing, remove it.
2. **Every transition is intentional.** Default is the straight cut.
3. **Breathing space.** Hold shots long enough to be felt (DOC-01 Signature 1).
4. **Natural garment movement is preserved.** Do not cut mid-swing of the fabric; let it settle or complete.
5. **No excessive speed ramps.** At most one gentle speed change per film, and only on footage shot at high frame rate.
6. **No added zoom effects.** No digital push-ins or "Ken Burns" moves on video. Reframing for aspect ratio is allowed (DOC-09) within the limits in §7.
7. **Sound design strengthens the picture.** Cut to sound, not just to music beats.
8. **The opening earns attention without sacrificing sophistication.**
9. **Elegant typography, consistent caption placement.**
10. **The garment always appears as it really is.**

---

## 2. The ten defined approaches

### 2.1 Opening sequences
- **Purpose:** establish mood, intrigue and the ANKOO world within the first 1–3 seconds.
- **Approved openings:**
  - *The Fabric Close*: a macro texture shot with a single, clean sound.
  - *The Threshold*: a man in a doorway, light behind, still.
  - *The Detail Reveal*: hands placing a cap, fastening a cuff, adjusting a sleeve.
  - *The Line*: a single line of narration over black, then image.
- **Rules:** no logo slam, no text-heavy title cards, no countdowns. For social, the first frame must be visually arresting on its own (it is also the thumbnail).

### 2.2 Main storytelling sequences
- Structure every film with a clear arc: **Arrival → Preparation → The Moment → The Gathering → Close.** (Adapt by pillar; see DOC-07.)
- Shot durations: 2.5–6 s typical in films; 1.5–3 s typical in social. Vary rhythm; slow down into the emotional peak, do not speed up.
- Alternate scales: wide (architecture) → medium (man) → close (detail). This wide–medium–close rhythm is part of ANKOO's editorial identity.

### 2.3 Product detail sequences
- Use the Garment Coverage Standard (DOC-04 §4).
- Order: silhouette → movement → construction details → silhouette again (bookending).
- Each detail shot holds long enough to read (minimum 2 s).
- No speed ramps on details; real-time or gentle slow motion only.

### 2.4 Founder narration
- Use only approved script lines (DOC-08 Stage 7). Founder voice lines are approved by Bolu Felix.
- Leave space: 1–2 seconds of picture between narration lines.
- Cut picture on the breath, not mid-word.
- Real founder interview audio: edit for clarity but never re-order words to change meaning.
- Cloned voice: only for approved scripts, logged in the campaign's AI register (DOC-12).

### 2.5 Cinematic transitions
| Approved | Use |
|---|---|
| Straight cut | Default |
| Match cut (shape, movement, colour) | Linking scenes elegantly, e.g., the curve of a sleeve to an arch |
| Slow dissolve (12–36 frames) | Passage of time, memory, founder story |
| Fade to/from black | Chapter breaks, the end card |
| Sound bridge (J-cut / L-cut) | Smooth transitions led by audio |

**Banned:** whip transitions, glitch, light leaks as transitions, zoom transitions, spin, slide/push, shape wipes, flash frames, "film burn" packs.

### 2.6 Logo end cards
Follow DOC-03 §6 exactly. Template file to be created once the official logo is supplied and stored in `06_BRAND_ASSETS/TEMPLATES/`.

### 2.7 Social media captions
- **Font:** the ANKOO sans-serif (provisional until brand fonts are supplied, DOC-01 §7).
- **Size:** legible on a phone at arm's length: around 4–5% of frame height on 9:16.
- **Colour:** ivory on dark, black on light. No boxes, outlines or emoji. A very soft shadow only if legibility is otherwise impossible.
- **Position:** lower-middle, inside platform safe zones (DOC-09), consistent within and across videos.
- **Style:** sentence case, short lines (max ~32 characters per line, 2 lines), no word-by-word pop animations. Captions appear and disappear with a quick (2–4 frame) fade or a cut.
- **Accuracy:** captions match narration exactly; Yoruba captions carry correct tone marks and are proofread by a fluent reviewer.
- Also upload closed caption files (`.srt`) where the platform supports them.

### 2.8 Final colour grading
Follow DOC-02 §4. Grade after picture lock. Reference: garment stills and colour chart.

### 2.9 Audio mastering
Follow DOC-05 §7. Mix after picture lock; deliver stems.

### 2.10 Export and quality control
Follow DOC-09 for specifications and DOC-10 for QC. Nothing leaves post-production without a completed QC sheet.

---

## 3. Typography in edits

- Title cards: centred or placed on a consistent grid; uppercase, wide-tracked serif; small.
- Lower thirds (names, places): sans-serif, small, left-aligned in the lower third, ivory, fade in/out over 8–12 frames.
- Garment names (if used): same lower-third style.
- Never animate typography letter by letter, bounce, slide or scale.
- Maximum one typographic element on screen at a time (besides captions).

---

## 4. Project and media management

### 4.1 Folder structure per campaign
```
05_CAMPAIGNS/ANKOO_<YYYY>_<CampaignCode>/
  00_BRIEF/            brief, objectives, approvals
  01_REFERENCES/       moodboards, storyboards, shot lists
  02_SOURCE_READ_ONLY/ original camera media and audio, never edited or moved after ingest
  03_PROXIES/
  04_AUDIO/            music (with licences), VO, SFX, stems
  05_PROJECT/          NLE project files (versioned)
  06_GRADE/            grade projects, stills, LUTs
  07_GRAPHICS/         titles, end cards (using official logo exports only)
  08_EXPORTS_REVIEW/   watermarked review cuts
  09_EXPORTS_MASTER/   approved masters
  10_QC/               completed QC checklists
  11_AI_REGISTER/      AI usage log (DOC-12)
```

### 4.2 Naming convention
```
ANKOO_<YYYY>_<CampaignCode>_<Deliverable>_<Platform>_<Ratio>_<Lang>_v<NN>.<ext>

Examples:
ANKOO_2026_MOMENT_BrandFilm_MASTER_16x9_EN_v03.mov
ANKOO_2026_MOMENT_Reel01_IG_9x16_YO_v01.mp4
ANKOO_2026_MOMENT_Cutdown15_TT_9x16_EN_v02.mp4
```
- Version numbers are two digits and only go up. Never overwrite a previous version.
- Approved files get `_APPROVED` appended and are copied (not moved) to `10_FINAL_APPROVED_CONTENT/`.

### 4.3 Source protection
- Ingest with checksum verification (e.g., Hedge, ShotPut Pro, DaVinci Clone or `rsync --checksum`).
- **3-2-1 backup:** three copies, two media types, one off-site/cloud.
- After ingest, set `02_SOURCE_READ_ONLY` to read-only.
- Edit from proxies or links; never transcode over originals; never rename original camera files.
- Large media files are **not** stored in this Git repository (see `ANKOO/.gitignore`); they live in the production storage with the same folder structure.

---

## 5. Review and approval rounds

| Round | Content | Approver |
|---|---|---|
| R1 — Assembly | Story and structure | Creative lead |
| R2 — Rough cut | Pacing, narration, music direction | Creative lead + founder |
| R3 — Fine cut / picture lock | Final picture | Founder |
| R4 — Online (grade, mix, graphics, logo) | Technical and brand QC | Creative lead → founder |
| R5 — Platform versions | All exports | Creative lead; founder final sign-off |

Review exports are watermarked "ANKOO — FOR REVIEW — NOT FOR DISTRIBUTION" and timecoded.

---

## 6. Things an ANKOO editor never does

- Adds a transition pack, LUT pack or text-animation pack.
- Adds digital zooms to "add energy".
- Cuts to the beat at the expense of the garment.
- Speeds up footage to fit a duration.
- Uses the logo more than DOC-03 allows.
- Publishes, uploads publicly or shares externally without approval.

---

## 7. Reframing limits

- Scaling up footage in the edit: maximum 120% on 4K sources delivered at 1080p, and **no scaling** on hero garment detail shots at 4K delivery.
- If a 9:16 recompose loses the garment silhouette or the logo safe zone, use an alternate take or the dedicated vertical setup (DOC-04 §6). Do not force a crop.

---

## Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| v1.0 | 2026-11-09 | First issue | Pending — Bolu Felix |
