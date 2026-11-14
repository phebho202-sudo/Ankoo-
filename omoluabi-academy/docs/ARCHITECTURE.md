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

## Database schema (Phase 1)

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

Later phases add: source channels, episodes, licences and rights, research reports,
scripts and revisions, pronunciation dictionary, voice/video assets, publications,
platform accounts and tokens, budgets and spend, and monetisation tables.

## Security model (Phase 1)

* Owner/admin API: bearer token (`ADMIN_API_TOKEN`), compared in constant time. If the
  token is not set, the admin API is disabled. It is never left open. Phase 2 replaces this
  with proper owner login sessions.
* Production start-up refuses default database passwords, short admin tokens and localhost
  CORS origins.
* Containers run as non-root users. Ports bind to 127.0.0.1 in the dev compose file.
