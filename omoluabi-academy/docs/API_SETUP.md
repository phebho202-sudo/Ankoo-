# API configuration

The platform runs in **sample mode** until you choose otherwise: no real API is called and
nothing is spent. This page explains how to connect the real services built so far. Each
step needs **your** authorisation, because you create the accounts and keys yourself.
Nothing in the software creates accounts or buys anything.

| Service | Used for | Cost | Phase |
|---|---|---|---|
| YouTube Data API v3 | Finding public videos on channels you authorise | Free (10,000 quota units/day) | 3 |
| Claude API (Anthropic) | Research reports and topic proposals | Pay as you go. See [COSTS.md](COSTS.md). | 3 |
| ElevenLabs | Presenter voice (Yoruba narration) | Per character; depends on your plan. See [COSTS.md](COSTS.md). | 6 |
| Google OAuth (YouTube uploads) | Uploading to the academy's own YouTube channel | Free (same daily quota) | 8 |
| Meta app (Facebook Page, Instagram) | Reels on the academy's Page and Instagram account | Free | 8 |
| TikTok developer app | Sending drafts to the academy's TikTok inbox | Free | 8 |
| Paystack | Selling digital products | Per-transaction fee charged by Paystack | 9 |
| Cloudflare R2 | Media storage in production | First 10 GB free, then ≈ $0.015/GB-month, no egress fees | 10 |
| Alert webhook (Slack, Discord, Google Chat) | Owner alerts | Free | 10 |
| Licensed avatar provider | Optional lip-synced presenter | Per minute; capped at 0 until you decide | not connected |

Keys go in environment variables (`backend/.env` for a native install, `.env` for Docker),
**never** in code and never in the dashboard. Restart the API and worker after changing them.

---

## 1. YouTube Data API key

1. Sign in at https://console.cloud.google.com with the Google account the academy will use.
2. Create a project (for example "omoluabi-academy"). Billing is **not** needed for this API.
3. **APIs & Services → Library**: search for **YouTube Data API v3** and click **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Click the new key and choose **Restrict key**:
   * *API restrictions*: allow **YouTube Data API v3** only.
   * *Application restrictions*: if your server has a fixed IP address, restrict to it.
6. Put it in your environment file: `YOUTUBE_API_KEY=...`

**Quota:** each channel scan uses about 1 unit to look up the channel and 2 units per 50
videos. A typical day of scanning a few channels uses well under 100 of the 10,000 free
units. If the quota runs out, scans stop with "YouTube API quota exhausted for today" and
resume the next day. Nothing is charged.

**What the key cannot do (by design):** it reads public video information only. It cannot
download captions or transcripts, because YouTube requires the video owner's consent for
that. Transcripts enter the system only through the **permitted transcript** form on an
episode's page.

## 2. Claude API key (Anthropic)

1. Create an account at https://console.anthropic.com and add a payment method
   (prepaid credits are the safest option on a lean budget).
2. **Set a monthly spend limit in the Anthropic Console as well.** This is a second
   safety net alongside the platform's own budget guard.
3. **API keys → Create key**. Copy it once; it is not shown again.
4. Put it in your environment file: `ANTHROPIC_API_KEY=...`
5. Optional:
   * `ANTHROPIC_MODEL` (default `claude-opus-5-5`, the most capable current model at
     $4 / $20 per million input/output tokens). A cheaper model is your decision:
     `claude-sonnet-5-5` ($2 / $10) or `claude-haiku-5-5` ($0.10 / $0.50). Lower-tier models
     may produce weaker research. Compare a few reports before switching.
   * `ANTHROPIC_EFFORT` (default `medium`): `low` is cheaper and faster; `high` is more thorough.

Requests use **server-side refusal fallback**: if Claude declines a request on safety
grounds, the API retries once on a fallback model within the same call. If every model
declines, the report is marked **Blocked** and no content is invented.

## 3. ElevenLabs voice (presenter narration)

**Not verified from this environment.** The build machine could not reach elevenlabs.io,
so the integration follows ElevenLabs' long-standing public API (`POST
/v1/text-to-speech/{voice_id}`, `xi-api-key` header). Its live behaviour, and whether your
chosen model speaks Yoruba well, must be confirmed on your account. That is exactly what
the pronunciation test is for.

1. Create an account at https://elevenlabs.io and choose a plan. Check on their site which
   models list **Yoruba** as a supported language.
2. **Choose an original or licensed voice** that suits a warm, professional Nigerian male
   teacher, for example one designed with ElevenLabs' voice design, or a library voice whose
   terms allow commercial use. **Do not clone any real person's voice without their written
   consent.**
3. Create an API key and put it in your environment file: `ELEVENLABS_API_KEY=...`
4. Set:
   * `ELEVENLABS_MODEL`: the Yoruba-capable model from step 1 (default
     `eleven_multilingual_v2`; change it if ElevenLabs recommends another for Yoruba).
   * `ELEVENLABS_USD_PER_1K_CHARS`: your plan's real cost per 1,000 characters (default
     0.30, a placeholder). The budget guard and every cost record use this number.
5. In the dashboard (**Voice production**): enter the voice ID, tick the three
   declarations, upload the presenter portrait, then **Record a test**. A Yoruba reviewer
   listens and rates tones, dotted letters, naira amounts, dictionary terms and pace.
   Narration is blocked until a test of the exact voice settings passes. Approve the presenter.

**Portrait:** upload an original image of the presenter, commissioned or AI-generated
for the academy, that does not depict a real person. Without one, videos use the
academy's brand card instead of a face.

**Avatar (lip-synced presenter):** not connected. The default **hybrid** format (portrait
with gentle motion, narration, captions and Yoruba slides) costs nothing beyond the voice.
A licensed avatar provider can be added later. `budget.max_avatar_minutes_per_month`
(default 0) already caps its use.

## 4. Switch to live mode

```
PROVIDER_MODE=live
```
Restart the API and the worker. Then check **Overview → Service providers**:
* **Ready** means the key is set (keys are verified on first use, never by a paid test call).
* **Not configured** means the key is missing. That capability refuses to run rather than
  fall back to sample data.

Channels and episodes created in sample mode stay labelled **SAMPLE**. They cannot be
scanned with the live provider, and sample and real data never mix.

## 5. Before the first real research report

* Check **System settings → Monthly spending limit** (default $50). The research job
  reserves its worst-case cost first and is **blocked** if that would exceed the limit.
* Start with one channel and one report. Read the report, check its cost on the report
  page, and compare with the Anthropic Console's usage page the next day.

## 6. Publishing accounts (Phase 8)

Publishing uses **your own** developer apps on each platform. Creating them is free, but
each one is an agreement with that platform, so you create them yourself. The platform never
signs up for anything on your behalf.

### 6.0 Token encryption key (required first)
Platform access tokens are stored encrypted. Generate a key once and keep a safe copy
(if it is lost, every account must be reconnected):
```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
```
TOKEN_ENCRYPTION_KEY=<the key>
PUBLIC_BASE_URL=https://<your dashboard address>      # e.g. https://admin.omoluabi.ng
```
The redirect URI for each platform is shown on **Social accounts** and is
`PUBLIC_BASE_URL/accounts/callback/<google|meta|tiktok>`.

### 6.1 YouTube (Google OAuth client)
1. Google Cloud Console → the project that holds your YouTube Data API key → **APIs &
   Services → OAuth consent screen**: type *External*, add your own Google account as a
   test user, and add the scopes `youtube.upload`, `youtube.readonly`, `youtube.force-ssl`.
2. **Credentials → Create credentials → OAuth client ID → Web application**. Add the
   redirect URI `PUBLIC_BASE_URL/accounts/callback/google`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, restart, then **Social accounts →
   Connect** and sign in with the Google account that owns the academy's channel.

Notes: while the consent screen is in *Testing*, Google expires refresh tokens after 7 days,
so you would need to reconnect weekly. To avoid that, publish the consent screen (Google may
ask for verification of the `youtube.upload` scope). Videos uploaded by an **unverified API
project are locked to private** by YouTube until the project passes Google's audit. This
matches the trial period (private uploads) but must be resolved before public publishing.
Each upload uses about 2,050 of the 10,000 free daily units.

### 6.2 Facebook Page and Instagram (Meta app)
1. developers.facebook.com → **Create app** (type *Business*). Add **Facebook Login for
   Business** and set the redirect URI `PUBLIC_BASE_URL/accounts/callback/meta`.
2. Permissions requested: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `business_management`, `instagram_basic`, `instagram_content_publish`. In development
   mode they work for app admins and testers; publishing for others needs Meta App Review.
3. Link the academy's Instagram **professional** account to the Facebook Page.
4. Set `META_APP_ID` and `META_APP_SECRET`, restart, then **Social accounts → Connect**.

Notes: Meta tokens last about 60 days and cannot be renewed automatically; the platform
marks the account *Reconnect needed* and pauses publishing when one stops working. Instagram
has no private or draft upload, and fetches videos from a public address: it is available
only after the unlock, when you allow public uploads and set `PUBLIC_MEDIA_BASE_URL`
(public R2 bucket or CDN, Phase 10).

### 6.3 TikTok (developer app)
1. developers.tiktok.com → **Manage apps → Connect an app**. Add **Login Kit** and the
   **Content Posting API**, with the redirect URI `PUBLIC_BASE_URL/accounts/callback/tiktok`.
2. Scopes: `user.info.basic`, `video.upload`.
3. Set `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`, restart, then **Connect**.

Videos go to your TikTok **inbox as drafts**: you add the caption and post them in the app.
Direct posting needs TikTok's app audit and is not used.

### 6.4 Not verified from this build environment
The publishing adapters follow each platform's published API and are tested against
simulated servers. They have **not** been run against the real platforms, because no
accounts exist yet. Connect one account at a time, upload one private test video, and
check it on the platform before scheduling more.

## 7. Payments: Paystack (Phase 9)

1. Create a Paystack account (paystack.com) for the business. This is an agreement with
   Paystack and needs business verification before live payments.
2. **Start with the test secret key** (Settings → API Keys & Webhooks → Test Secret Key):
   `PAYSTACK_SECRET_KEY=sk_test_...`. No real money moves with a test key.
3. Register the webhook URL: your public API address + `/api/v1/payments/paystack/webhook`.
4. Put a product on sale, create a payment link from the Monetisation page, pay it with a
   Paystack test card, and check that the order shows *Paid* and the revenue appears once.

## 8. YouTube Analytics (Phase 9)

No new key. After Phase 9, reconnect the YouTube account once (Social accounts → Connect)
so Google asks for the analytics permissions. Revenue appears only if your channel is in
the YouTube Partner Programme; otherwise it is shown as *Not reported*.

## 9. Media storage: Cloudflare R2 (Phase 10)

1. Cloudflare dashboard → **R2** → create a bucket (e.g. `omoluabi-media`). Keep it
   **private** (no public access, no custom domain needed).
2. **Manage R2 API tokens** → create a token with *Object Read & Write* for that bucket only.
3. Set:
   ```
   STORAGE_BACKEND=r2
   R2_ACCOUNT_ID=<your Cloudflare account ID>
   R2_ACCESS_KEY_ID=<token access key>
   R2_SECRET_ACCESS_KEY=<token secret>
   R2_BUCKET=omoluabi-media
   ```
The dashboard plays media through the API (with seeking). Instagram receives a signed link
valid for one hour, so the bucket never has to be public. Moving existing local media to R2:
copy the `storage` volume's files into the bucket with the same paths (e.g. `rclone copy`).

## 10. Owner alerts

Create an incoming webhook in Slack, Discord or Google Chat (or any service that accepts a
JSON POST) and set `ALERT_WEBHOOK_URL`. The message is sent as both `text` and `content`.
Without it, alerts appear only on the Overview page and in the audit trail.
