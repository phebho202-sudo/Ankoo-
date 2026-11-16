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
| Avatar provider, Meta, TikTok, Cloudflare R2 | Later phases | Documented when built | 7–10 |

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
