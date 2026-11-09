# ANKOO — Platform-Specific Production Specifications

| | |
|---|---|
| **Document** | DOC-09 |
| **Version** | v1.0 — Issued for founder approval |
| **Governed by** | DOC-01 |
| **Used by** | Editors, motion designers, social team, web team |

> Platform limits (durations, file sizes, safe zones) change often. **Check each platform's current help pages at the start of every campaign** and update this document if they have changed. The values below are ANKOO's working standard as of November 2026.

---

## 1. Principles

1. **One master, recomposed, never blind-cropped.** Each ratio is re-edited so the garment silhouette, faces and typography are correctly placed.
2. **Vertical is planned on set** (DOC-04 §6). Hero social shots should come from dedicated vertical setups or protected 9:16 frames.
3. **Luxury travels at every size.** The same grade, typography, pacing principles and logo rules apply on every platform.
4. **Upload the highest quality the platform accepts.** Platforms recompress; give them the best source.
5. **Captions on everything social.** Most viewers watch without sound.

---

## 2. Masters

| Master | Resolution | Frame rate | Codec | Colour | Audio |
|---|---|---|---|---|---|
| **Film master (16:9)** | 3840×2160 (UHD) where source supports; otherwise 1920×1080 | 23.976 or 25 (as shot) | ProRes 422 HQ (or DNxHR HQX), 10-bit | Rec.709 Gamma 2.4 | 48 kHz / 24-bit WAV, stereo; −14 LUFS mix + stems |
| **Vertical master (9:16)** | 2160×3840 where possible; otherwise 1080×1920 | As shot | ProRes 422 HQ | Rec.709 | As above |
| **Textless masters** | Same as above, without titles, captions or logo | | | | M&E stem |

Archive: master + textless master + stems + caption files + graphics project + grade project in `09_EXPORTS_MASTER/`.

---

## 3. Platform delivery matrix

### Instagram
| Format | Ratio | Resolution | Duration (ANKOO standard) | Notes |
|---|---|---|---|---|
| **Reels** | 9:16 | 1080×1920 | 15–45 s (up to 90 s for founder/story) | Cover frame designed; keep key content in centre 4:5 area for grid preview |
| **Stories** | 9:16 | 1080×1920 | 5–15 s per frame | Avoid top ~250 px and bottom ~340 px for UI |
| **Feed video / carousel** | **4:5** (preferred) or 1:1 | 1080×1350 / 1080×1080 | 6–60 s | 4:5 for editorial; 1:1 only when layout requires |
| **Feed stills** | 4:5 | 1080×1350 (export at 2160×2700 where accepted) | — | Consistent grid rhythm: detail · silhouette · portrait |

### TikTok
| Format | Ratio | Resolution | Duration | Notes |
|---|---|---|---|---|
| **Video** | 9:16 | 1080×1920 | 9–34 s typical; up to 60–90 s for story pieces | **Strong opening moment in the first 1–2 s** (Fabric Close, Threshold, a striking line), delivered calmly. Native-feeling captions in ANKOO style. Keep right edge (~120 px) and bottom (~400 px) clear of UI. |

### Facebook
| Format | Ratio | Resolution | Duration | Notes |
|---|---|---|---|---|
| **Reels** | 9:16 | 1080×1920 | 15–45 s | Same edit as Instagram Reels where suitable |
| **Feed video** | 4:5 or 1:1 | 1080×1350 / 1080×1080 | 15–90 s | Burned-in captions |
| **Campaign announcements** | 4:5 still or 16:9 film | | | Link to website/YouTube master |

### YouTube
| Format | Ratio | Resolution | Duration | Notes |
|---|---|---|---|---|
| **Long-form documentaries** | 16:9 | 3840×2160 | 3–15 min chapters | Upload 4K even if viewers watch lower; chapters, description, uploaded `.srt` captions EN/YO |
| **Collection films / brand films** | 16:9 | 3840×2160 | 60–180 s | Custom thumbnail: a held frame + small title; no clickbait faces or arrows |
| **Shorts** | 9:16 | 1080×1920 | 15–60 s | Derived from vertical master |

YouTube upload file: H.264 High profile or ProRes/DNxHR mezzanine; 4K H.264 at ~45–68 Mbps (24–30 fps) or higher; AAC 320 kbps or uncompressed audio.

### WhatsApp
| Format | Ratio | Resolution | Duration | Notes |
|---|---|---|---|---|
| **Status** | 9:16 | 1080×1920 | Edit as **self-contained segments within the current Status length limit** (plan ≤30 s segments for broad compatibility) | Heavy compression: keep text larger, avoid fine-pattern close-ups as the only content; keep file small (target < 16 MB per segment) |
| **Product presentation videos** | 9:16 or 4:5 | 1080×1920 / 1080×1350 | 15–45 s | For one-to-one sharing with clients; include garment name and how to enquire on the final card |
| **Campaign announcements** | 9:16 still or short video | | | |

### Website
| Format | Ratio | Resolution | Duration | Notes |
|---|---|---|---|---|
| **Homepage hero film** | 16:9 desktop + 9:16 or 4:5 mobile version | 1920×1080 and 3840×2160 desktop; 1080×1920 mobile | 10–30 s seamless loop | **Silent autoplay**, muted, `playsinline`; poster image required; H.264 MP4 plus HEVC or AV1/WebM; target < 6 MB (1080p) for the loop |
| **Collection campaign videos** | 16:9 | 1920×1080 / 4K | 60–120 s | Click-to-play with sound; captions |
| **Product storytelling** | 4:5 or 1:1 | 1080×1350 | 6–15 s loops | Next to product images; true colour critical |
| **Brand introduction film** | 16:9 | 4K | 60–120 s | Hosted on YouTube/Vimeo or a video CDN, embedded |

---

## 4. Social export settings (standard)

| Setting | Value |
|---|---|
| Container / codec | MP4, H.264 High profile (HEVC accepted where supported) |
| Resolution | As per matrix (1080×1920, 1080×1350, 1080×1080) |
| Frame rate | Same as master (23.976/25); do not convert to 30 unless required |
| Bitrate | 1080p: 16–25 Mbps VBR 2-pass; 4K: 45–68 Mbps |
| Colour | Rec.709, full tags (BT.709 primaries/transfer/matrix) |
| Audio | AAC-LC, 48 kHz, 320 kbps, stereo, −14 LUFS, −1 dBTP |

---

## 5. Safe zones and recomposition (9:16)

```
┌──────────────────────┐  1080 × 1920
│  top ~ 250 px: UI     │  ← no text/logo
│                      │
│   ┌──────────────┐   │
│   │  ANKOO SAFE   │   │  ← captions, logo, faces, garment silhouette
│   │  AREA         │   │     (~ centre 1080×1350 region)
│   │               │   │
│   └──────────────┘   │
│                  ←UI │  ← right ~120 px: TikTok/Reels buttons
│ bottom ~ 400 px: UI   │  ← no captions here
└──────────────────────┘
```

**Recomposition rules:**
- Full silhouettes in 9:16: the whole figure including feet should fit; if the 16:9 shot cannot become a full-length vertical without losing feet or cap, use a vertical take or a different shot.
- Groups (the Gathering) rarely survive a vertical crop. Shoot a vertical Gathering, or use a medium shot of two figures.
- Re-time edits for vertical: verticals often need slightly shorter shots, but never below the Held Frame minimum (2.5 s hero shots).
- Re-place typography and logo for each ratio; never scale a 16:9 title card down into a 9:16 frame.

---

## 6. Deliverable naming and folders

```
09_SOCIAL_MEDIA_EXPORTS/
  INSTAGRAM/   TIKTOK/   FACEBOOK/   YOUTUBE/   WHATSAPP/   WEBSITE/

ANKOO_<YYYY>_<Code>_<Deliverable>_<Platform>_<Ratio>_<Lang>_v<NN>.mp4
Platform codes: IG, TT, FB, YT, YTS (Shorts), WA, WEB
```

---

## 7. Per-campaign deliverables checklist

| Deliverable | 16:9 | 9:16 | 4:5 | 1:1 | EN | YO |
|---|---|---|---|---|---|---|
| Master film | ☐ | ☐ | | | ☐ | ☐ |
| 30 s cutdown | ☐ | ☐ | ☐ | | ☐ | ☐ |
| 15 s cutdown | ☐ | ☐ | ☐ | | ☐ | ☐ |
| 6 s bumper | ☐ | ☐ | | | ☐ | |
| Reels / TikToks (×4–8) | | ☐ | | | ☐ | ☐ |
| Stories set | | ☐ | | | ☐ | |
| Carousel | | | ☐ | | ☐ | |
| YouTube film + thumbnail | ☐ | | | | ☐ | ☐ |
| WhatsApp Status segments | | ☐ | | | ☐ | ☐ |
| Website hero loop (silent) | ☐ | ☐ | | | — | — |
| Caption files (.srt) | ☐ | ☐ | | | ☐ | ☐ |

---

## Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| v1.0 | 2026-11-09 | First issue | Pending — Bolu Felix |
