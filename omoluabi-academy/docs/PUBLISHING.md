# Publishing

## How it works

1. **Approve the video** (Video production). Only approved videos can be scheduled.
2. **Connect accounts** (Social accounts). Tokens are encrypted with `TOKEN_ENCRYPTION_KEY`.
3. **Schedule** (Publishing calendar): choose the video, destination, account, visibility and
   time. The title and description are prepared per platform (Yoruba first, an English line,
   the AI disclosure, "education only, not financial advice", any licence credit, hashtags)
   and you can edit them.
4. The scheduler runs **every 5 minutes** (the `beat` service), or immediately with
   **Send due uploads now**.

## The trial period (until 10 real videos are approved)

| Destination | Allowed during the trial |
|---|---|
| YouTube / YouTube Shorts | Private or unlisted |
| Facebook Reels | Draft |
| TikTok | Draft in your TikTok inbox (always) |
| Instagram Reels | Not available: the API has no private or draft mode |

**Automatic publishing** can be switched on (System settings) only when you have approved
the required number of **real** videos (10 by default; sample videos never count) and at
least one real account is connected. Then each approved video is scheduled automatically
to every destination it fits, at `publishing.auto_hour` (Lagos), no more than
`publishing.daily_limit` a day. **Public uploads** need a second switch,
`publishing.allow_public`, which is only accepted after automatic publishing is on.
Switching automatic publishing off also withdraws public uploads.

## Retries, duplicates and confirmation

* **Temporary failures** (network, server errors, rate limits, quota) are retried after 5,
  10, 20… minutes, up to `budget.max_retries_per_job` retries. An interrupted YouTube or
  Facebook upload **continues the same upload session**, so a retry never creates a second
  video.
* **Permanent failures** (the platform refused the request) are not retried.
* **Confirmation:** an upload is *Uploaded* only after the platform confirms it exists. If it
  was sent but not confirmed, it is *Not confirmed*: it is **never sent again
  automatically**. The scheduler keeps asking the platform; you can also record what you
  found on the platform.
* **Duplicates:** one live publication per video file (SHA-256) per destination, enforced
  in code and by a unique database index. Cancelled, failed, stopped and simulated
  publications never reached a platform, so the video can be scheduled again.
* **Daily limits:** `publishing.daily_limit` uploads a day, and YouTube's API quota
  (`publishing.youtube_daily_quota_units`, about 2,050 units per upload). Extra uploads move
  to the next day.

## Automatic stop

Publishing **pauses itself** (System settings → Publishing paused) and alerts you when:
* a **rights check** fails for an adaptation on that platform (licence expired, revoked,
  platform not granted);
* a **quality check** fails (the video is no longer approved, failed an automated check, or
  its file changed after approval);
* an **account permission** fails (token refused, refresh refused or expired).

Nothing else is uploaded until you fix the cause and press **Resume publishing**.

## Test mode

With `PROVIDER_MODE=sample`, real sign-in is switched off and you can add **sample accounts**.
Uploads to them are *Simulated*: nothing leaves the server, and they are never shown as
confirmed uploads.

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
