# Publishing

## Platform length limits used by the platform

Each finished video shows which destinations it fits. The limits live in
`backend/app/services/videos.py` (`PLATFORM_RULES`). Platforms change their rules: check
these against each platform's own help pages every few months and update the table and the
code together.

| Destination | Video used | Longest accepted here | Notes |
|---|---|---|---|
| YouTube | 16:9 lesson | 12 hours | Long uploads need a verified channel. |
| YouTube Shorts | 9:16 vertical | 180 s | |
| Instagram Reels | 9:16 vertical | 180 s | |
| Facebook Reels | 9:16 vertical | 90 s | |
| TikTok | 9:16 vertical | 600 s | |

The vertical cut is kept to 85 s (whole lesson) or 55 s (opening of a longer lesson), so it
fits every destination above.
