# Architecture

## Components

```
            ┌──────────────────────┐
 Owner ───▶ │ Next.js admin (3000) │  server-side fetch, never shows invented data
            └──────────┬───────────┘
                       │ HTTPS + admin bearer token
            ┌──────────▼───────────┐        ┌──────────────┐
            │ FastAPI API (8000)   │──────▶ │ PostgreSQL   │  source of truth + audit trail
            └──────────┬───────────┘        └──────▲───────┘
                       │ enqueue                   │
            ┌──────────▼───────────┐               │
            │ Redis (broker)       │               │
            └──────────┬───────────┘               │
            ┌──────────▼───────────┐               │
            │ Celery workers       │───────────────┘
            │ (research, scripts,  │
            │  TTS, video, publish)│──▶ Provider adapters ──▶ Claude, ElevenLabs, YouTube,
            └──────────────────────┘                          avatar API, R2, Meta, TikTok
```

* **API** handles owner actions and approvals. It is quick and never runs long media work.
* **Workers** run every slow or paid operation (LLM calls, TTS, rendering, uploads).
  Settings: `acks_late`, one task prefetched at a time, hard time limits, bounded retries.
* **PostgreSQL** holds all state. Money is stored as `NUMERIC`, never floats.
* **Redis** is the job queue. It holds no data that cannot be rebuilt.

## Provider adapters (rule 10: every external service is replaceable)

`app/adapters/base.py` defines one interface per capability:

| Capability | Interface | Planned live provider | Phase |
|---|---|---|---|
| `llm` | `LLMProvider.complete()` | Claude API (official `anthropic` SDK) | **3 (built)** |
| `tts` | `TTSProvider.synthesize()` / `estimate_cost()` | ElevenLabs (`httpx`; Yoruba support to be confirmed per account) | **6 (built)** |
| `avatar` | `AvatarProvider.render()` | licensed avatar API (when affordable) | 6 |
| `storage` | `StorageProvider.put/get/...` | local filesystem now, Cloudflare R2 later | 1 / 10 |
| `video_source` | `VideoSourceProvider.resolve_channel()` / `list_channel_videos()` | YouTube Data API v3 (`httpx`) | **3 (built)** |
| `publisher` | `PublisherProvider.upload()` | YouTube, Meta, TikTok | 8 |

`app/adapters/registry.py` chooses the implementation:

* `PROVIDER_MODE=sample`: offline sample adapters with no network calls and zero cost.
  Output is labelled `is_sample=True`.
* `PROVIDER_MODE=live`: the real adapter, **only if** it is implemented and its credentials
  are set. Otherwise it raises `ProviderNotConfiguredError`. It never silently falls back
  to sample output.

Switching provider means writing one new adapter class and registering it. No business
logic changes.

## Request handling

* Every request gets an `x-request-id` (taken from the caller or generated). It appears in
  logs, in error bodies and in audit entries.
* All errors share one JSON shape: `{"error": {"code", "message", "request_id"}}`.
  Unexpected exceptions are logged with a traceback and returned as a generic 500, so
  internals never leak.
* Logs are JSON lines (or text in development). Secret-like keys are redacted.

## Database schema (Phases 1–2)

### `audit_logs`: append-only, tamper-evident
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| occurred_at | TIMESTAMPTZ | |
| actor | VARCHAR(120) | `owner`, `worker`, `system`… |
| action | VARCHAR(120) | e.g. `job.enqueued`, later `rights.approved` |
| entity_type / entity_id | VARCHAR | what was acted on |
| details | JSON | snapshot of relevant data |
| request_id | VARCHAR(64) | links to logs |
| prev_hash | CHAR(64) | hash of the previous entry |
| hash | CHAR(64) UNIQUE | SHA-256 of this entry's canonical content plus `prev_hash` |

PostgreSQL triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on this table.
`verify_chain()` recomputes every hash and finds the first altered row.

### `job_runs`: every background job, with its real cost
| Column | Type | Notes |
|---|---|---|
| id | UUID (string) PK | |
| task_name, celery_task_id | VARCHAR | |
| status | ENUM `queued/running/succeeded/failed/blocked` | `blocked` = stopped by a policy |
| attempts | INT | |
| cost_usd | NUMERIC(12,4) | actual provider cost (feeds cost per video) |
| provider, is_sample | | which adapter produced the result |
| payload, result | JSON | |
| error | TEXT | |
| started_at, finished_at, created_at, updated_at | TIMESTAMPTZ | |

### `system_settings`: owner-editable runtime settings (never secrets)
| Column | Type |
|---|---|
| key | VARCHAR(120) PK |
| value | JSON |
| description | TEXT |
| updated_by | VARCHAR(120) |
| created_at, updated_at | TIMESTAMPTZ |

### `users`: dashboard users (Phase 2: the owner)
| Column | Type | Notes |
|---|---|---|
| id | UUID (string) PK | |
| email | VARCHAR(254) UNIQUE | stored lower-case |
| display_name | VARCHAR(120) | |
| role | VARCHAR(20) | `owner` |
| password_hash | VARCHAR(255) | `scrypt$N$r$p$salt$hash` |
| is_active | BOOL | |
| failed_login_count, locked_until | INT, TIMESTAMPTZ | 5 failures, then a 15-minute lockout |
| last_login_at | TIMESTAMPTZ | |
| preferred_language | VARCHAR(5) | `en` or `yo` |

### `auth_sessions`: login sessions
| Column | Type | Notes |
|---|---|---|
| id | UUID (string) PK | |
| user_id | FK → users (cascade) | |
| token_hash | CHAR(64) UNIQUE | SHA-256 of the token. The token itself is never stored. |
| created_at, expires_at, revoked_at, last_seen_at | TIMESTAMPTZ | absolute expiry (`SESSION_TTL_HOURS`, default 12) |
| ip_address, user_agent | VARCHAR | |

### Owner settings registry
`app/services/settings.py` declares every setting, with its type, range and allowed values:
budget limits, alert threshold, cost per video, avatar minutes, retries, storage, and
publishing rules. Unknown keys are rejected. Decimals are stored as strings, never floats.
Settings flagged as **spending limits** can be lowered freely, but raising one needs
`confirm_increase: true` and is audited as `budget.limit_increase_approved`. Automatic
publishing is refused until the Phase 8 approval gate exists.

### Discovery and research (Phase 3)

| Table | Purpose | Key rules |
|---|---|---|
| `source_channels` | Channels the owner authorised | Unique (platform, external_id). `authorisation_basis` is `research_only` or `licensed`. An authorisation note is required. Pausable. Sample channels can't be scanned by live providers, and real channels can't be scanned by the sample provider. |
| `episodes` | Discovered source videos | **Unique (platform, external_id)**, so a video can never be stored twice. `content_fingerprint` (normalised title + rounded duration) flags re-uploads under a new ID via `possible_duplicate_of_id`. |
| `transcripts` | Transcripts we are permitted to hold | One per episode. `source` is `licensor_provided`, `owner_entered` or `official_api`. A `permission_reference` is required. Maximum 200,000 characters (rejected, never truncated). |
| `research_reports` | Model-written research | Status `pending`/`completed`/`failed`/`blocked`; provider, model, tokens, `cost_usd`; `max_verbatim_overlap_words` and `overlap_flagged`. |
| `topics` | Proposed lesson topics | `proposed` → `approved`/`rejected` by the owner (who, when, note, all audited). Can't be approved if the report copied the source. `is_sample` follows the data forever. |

**Research pipeline:** owner request → `research.generate_report` job → budget reservation
→ Claude call with structured JSON output (`output_config.format`) and server-side refusal
fallback → validation (`ReportOut`) → originality check (longest word-for-word run shared
with the description or transcript; 12+ words is flagged) → topics saved → owner decides.

**Budget guard** (`app/services/budget.py`): before any paid call the job's *worst-case*
cost is written onto it under a PostgreSQL advisory lock, after checking that month-to-date
spend plus open reservations plus this estimate stays within the monthly limit. After the
call the reservation is replaced by the actual cost (or released on failure). Paid jobs are
never retried automatically.

### Rights management (Phase 4)

| Table | Purpose | Key rules |
|---|---|---|
| `licences` | The owner's record of a signed agreement | Reference, licensor, `effective_from`, **required** `expires_at`. Four rights (`translation`, `adaptation`, `commercial`, `distribution`), each `granted` / `not_granted` / `unclear`. Permitted platforms and languages, territory, attribution. Signed document (storage key, SHA-256, size, type). Status `draft` → `verified` → `revoked`. |
| `licence_episodes` | Scope | A licence covers a whole channel (`licences.channel_id`) and/or specific episodes. |
| `rights_checks` | Every rights decision made | Episode, purpose, platform, allowed, licence used, reasons, who, when. |

**Verification** is a deliberate owner act. It requires the document, a scope, no
`unclear` right, platforms when distribution is granted, a future expiry, and an explicit
"I have checked every detail against the signed document" confirmation. Any material edit,
scope change or new document returns the licence to `draft`. A revoked licence can't be edited.

**The gate.** `check_rights(episode, purpose, platform)` returns *allowed* only when:
* the channel's basis is `licensed` (research-only channels never qualify),
* for publishing, the episode is not sample data and the platform is permitted,
* at least one covering licence is verified, in force (not expired, not yet effective, or
  revoked), permits Yoruba, and grants every right the purpose needs
  (adaptation: translation + adaptation; publish: + commercial + distribution).

Otherwise it returns machine-readable reasons, which the dashboard shows in English or
Yoruba. `require_rights()` raises on refusal; Phases 5–8 call it before scripting,
production and every upload, so an expired or revoked licence stops the pipeline.

**Monitoring.** The `beat` scheduler runs `rights.expiry_sweep` daily at 06:10 Lagos time.
It writes `licence.expiring_soon` once, 30 days before expiry, and `licence.expired` once
on expiry. The Overview and Rights pages show the counts.

**Originality** (`app/services/originality.py`): the longest word-for-word run shared
between a text and each source's description and permitted transcript, with the copied
passage quoted. 12+ words is flagged. It's used by research, by the Rights page's
checker, and later by Yoruba scripts.

### Yoruba content engine (Phase 5)

| Table | Purpose | Key rules |
|---|---|---|
| `scripts` | A lesson script | `kind` is `original_lesson` (from an approved topic) or `licensed_adaptation` (from an episode, with the licence that allowed it). `format` is long or short. Status: `generating → draft → in_review → changes_requested/approved` (or `blocked`). Tracks `current_revision` and `approved_revision`. |
| `script_revisions` | Every version, never overwritten | Numbered. `origin` is `generated`, `revised` (model, with instructions) or `human_edit`. Segments `[{id, text_yo, text_en, visual, locked?}]`. Stores the quality result, the originality result, provider, model and cost. |
| `language_reviews` | Human review decisions | Tied to a revision number. Reviewer, decision, the six-item checklist, comments. |
| `glossary_terms` | Approved business vocabulary | English → Yoruba. Only `approved` terms go into the writer's instructions; any edit returns a term to `proposed`. |
| `pronunciation_entries` | How the voice should say a word | Written → spoken form. Approved entries export as a W3C PLS lexicon for the TTS provider (Phase 6). |

**Generation** (`app/services/scripts.py`): the localisation instructions (natural Nigerian
Yoruba, full tone marks and dots below, approved vocabulary, ₦ figures identical in both
languages, practical Nigerian examples, no imitation of real people) plus a brief built
from the approved topic and the academy's own research, or from the licensed transcript
for adaptations. Structured JSON output; budget reservation first; refusals and malformed
output are recorded, never patched. Adaptations re-check rights before the paid call and
at approval, and get the licence's credit text as a locked final segment.

**Quality checks** (`quality.py`, `yoruba.py`): errors block review (missing text,
misplaced tone marks, words mostly unmarked, copied source wording). Warnings guide the
reviewer: length mismatch, missing figures, English words, unused approved vocabulary,
non-standard "line below". The score is always shown with the statement that it cannot
judge tone accuracy or naturalness.

**Subtitles** (`subtitles.py`): English and Yoruba cues are both timed to the *Yoruba*
narration, segment by segment, at most 2 lines of 42 characters. Before recording, timing
is estimated from syllables (4.2/s). Phase 6 passes real per-segment audio durations to
`build_cues(..., durations)`, which re-times both languages exactly to the voice.

**Roles** (`app/api/deps.py`): `owner` (everything), `reviewer` (scripts, vocabulary,
pronunciation and their own account only), and the optional automation token (owner
reads and jobs; never approvals, edits or reviews). Deactivating a user or changing a
password ends their other sessions.

### Voice and presenter (Phase 6)

| Table | Purpose |
|---|---|
| `presenter_profiles` | The one presenter: name, description, voice (provider, ID, model, settings), portrait (storage key and SHA-256), three owner declarations, approval. |
| `pronunciation_tests` | A recorded Yoruba test passage for a specific `voice_config_hash`, with per-check ratings, notes, reviewer, cost. |
| `production_runs` | Voice production of one approved script version: status, TTS characters and cost, avatar seconds and cost, total, measured per-segment durations. |
| `media_assets` | Every produced file: kind, storage key, MIME type, size, SHA-256, duration, sample flag. |

**Pipeline** (`app/services/voice.py`, `media.py`): checks first (script approved at its
latest version; presenter approved and unchanged; pronunciation test passed for this voice;
rights for adaptations; storage limit; FFmpeg and fonts present). Then the budget
reservation (characters × rate). Then, per segment: approved pronunciations applied as
text substitutions (works with any TTS provider), synthesised, decoded to WAV. Segments
are joined with 0.35 s pauses, EBU R128 levelled (−16 LUFS) to MP3, and given a waveform.
English and Yoruba captions are **re-timed to the measured segment durations**. Then a 1920×1080
Yoruba slide per segment, and the hybrid presenter clip (portrait with a slow push-in, H.264,
720p). Every asset is stored with a fingerprint, and the actual cost is recorded on the run
and the job.

**Robustness:** every FFmpeg command runs with a timeout sized to its work and no stdin.
Portraits are decoded on upload, so a corrupt image is refused before it can stall a render.

**Fonts:** FFmpeg's text rendering misplaces stacked Yoruba marks with Noto Sans. DejaVu
Sans renders them correctly (tested), so it is used for all rendered text and installed in
the Docker image.

### Video production (Phase 7)

| Table | Purpose |
|---|---|
| `video_renders` | Finished videos from one completed production run: lesson fingerprint (script + version + voice), formats, educational value report, automated checks, platform fit, lengths, status (`queued → rendering → awaiting_approval → approved/rejected`, or `failed`/`blocked`), the owner's checklist, notes and decision. |
| `media_assets.render_id` | Links video files, thumbnails and caption files to their render. |

**Pipeline** (`app/services/videos.py`, `render.py`): value gate → presenter still approved →
FFmpeg and fonts present → storage limit. The 16:9 lesson is built with FFmpeg's concat
demuxer (intro card, one slide per segment for its measured duration, outro card), the
presenter clip overlaid in a gold frame during narration, and the narration delayed past
the intro. The 9:16 cut overlays the presenter on a branded background and burns in ASS
captions (PlayRes = real frame size, DejaVu Sans) before an end card. Thumbnails are drawn
with drawtext. Each output is probed (`ffprobe`) and checked. Any failure marks the render
`failed`, which can never be approved. Rendering costs nothing: no external service.

**Approval and unlock:** `videos.decide()` re-runs the value gate (rights or approvals may
have changed) and needs every checklist item. `videos.approved_count()` counts approved
non-sample renders. Phase 8 uses it to unlock automatic publishing.

### Publishing (Phase 8)

| Table | Purpose |
|---|---|
| `platform_accounts` | A connected YouTube channel, Facebook Page, Instagram account or TikTok account: OAuth provider, platform ID, **encrypted** access and refresh tokens, expiry, scopes, status (connected / expired / disconnected), sample flag. Unique per (platform, external ID). |
| `oauth_states` | One-time OAuth `state` and PKCE verifier, valid 15 minutes. |
| `publications` | One scheduled upload: video and destination, file SHA-256, title/description/tags, visibility, time, status, attempts, next attempt, resume token (upload session), platform ID and URL, warnings, approval mode (owner/auto). **Partial unique index** on (destination, SHA-256) for live statuses. |
| `publish_attempts` | The publishing log: one row per attempt with outcome, HTTP status and message. |

**Adapters** (`app/adapters/publishers/`): `OAuthClient` (authorize URL, code exchange,
refresh, identities) and `PublisherProvider` (upload, verify) per platform. Errors are
`PublishError(transient, auth, resume_token)`, which the service turns into retries, account
expiry or failure. Sample mode uses `SamplePublisher`, which mirrors each platform's options
and never claims a confirmed upload.

**Service** (`app/services/publishing.py`): scheduling policy, platform captions, `run_due`
(called every 5 minutes by `publishing.dispatch`), `process` (preflight checks → upload →
outcome), `recheck_unconfirmed`, `auto_schedule` (hourly, only after the unlock), and
`pause`/`resume`. The row is committed as *uploading* before the network call, so a worker
crash can never cause a silent second upload: stale *uploading* rows become *not confirmed*.

### Monetisation and analytics (Phase 9)

| Table | Purpose |
|---|---|
| `affiliate_links`, `affiliate_clicks` | Partner links with Yoruba/English disclosures; clicks with source and referrer host only. |
| `products`, `orders` | Digital products (minor units + currency) and checkouts (Paystack reference, status, sample flag). |
| `sponsorships` | Sponsor, deliverables, value, status, agreement reference, linked videos. |
| `revenue_entries` | Every amount earned: source, unique reference per source, minor units, currency, date, estimate flag, who recorded it. |
| `video_metrics` | Daily platform figures per publication; revenue is NULL when not reported. |

Adapters: `app/adapters/analytics.py` (YouTube Analytics v2) and `app/adapters/payments.py`
(Paystack, Sample). Services: `monetisation.py` and `analytics.py` (pure calculation
functions plus the database report). The public `/go/<slug>` route (no login) counts a click
through `/api/v1/public/go/<slug>` and redirects. The Paystack webhook is
`/api/v1/payments/paystack/webhook` (signature-checked, idempotent).

Later phases add: source channels, episodes, licences and rights, research reports,
scripts and revisions, pronunciation dictionary, voice/video assets, publications,
platform accounts and tokens, budgets and spend, and monetisation tables.

## Admin dashboard (Phase 2)

* Next.js App Router. Every page is rendered on the server, which calls the API with the
  owner's session token. The browser never holds the token in JavaScript (httpOnly cookie).
* Middleware sends visitors without a session cookie to `/login`. The backend still
  validates every token, and an expired session redirects back to `/login?expired=1`.
* Changes go through server actions (login, logout, language, settings). These have
  built-in same-origin protection.
* **Bilingual:** `frontend/src/lib/i18n/dictionaries.ts` holds English and Yoruba. The
  Yoruba dictionary is typed against the English one, so a missing translation fails the
  build. Tests also check matching placeholders and NFC-normalised text.
* **Fonts:** self-hosted Noto Sans and Noto Serif, because system fonts misplace stacked
  Yoruba diacritics (e.g. ọ̀, ẹ́).
* Pages whose features belong to later phases say so plainly ("Not built yet · Phase N"),
  describe what they will do and their safeguards, and show **no sample data**.

## Security model

* Owner login: email and password, scrypt hashing, equal-time responses for unknown
  emails, lockout after 5 failures, and every login, failure, lockout and logout audited.
* Sessions: 256-bit random tokens, stored only as SHA-256 hashes, absolute expiry, revoked
  on logout, rejected for deactivated users.
* `ADMIN_API_TOKEN` (optional) is for automation only. It can read and run jobs but
  **cannot change settings**: that needs a real owner login.
* Production start-up refuses default database passwords, short admin tokens and localhost
  CORS origins.
* Containers run as non-root users. Ports bind to 127.0.0.1 in the dev compose file.
