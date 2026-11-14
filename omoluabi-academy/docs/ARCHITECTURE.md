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
| `llm` | `LLMProvider.complete()` | Claude API | 5 |
| `tts` | `TTSProvider.synthesize()` | ElevenLabs (Yoruba-capable) | 6 |
| `avatar` | `AvatarProvider.render()` | licensed avatar API (when affordable) | 6 |
| `storage` | `StorageProvider.put/get/...` | local filesystem now, Cloudflare R2 later | 1 / 10 |
| `video_source` | `VideoSourceProvider.list_channel_videos()` | YouTube Data API v3 | 3 |
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
