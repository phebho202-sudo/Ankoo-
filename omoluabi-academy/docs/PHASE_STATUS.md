# Phase status

| Phase | Status |
|---|---|
| 1. Project foundation | Complete. Approved 2026-11-14. |
| 2. Brand and administration | **Complete. Awaiting owner approval.** |
| 3. Discovery and research | Not started |
| 4. Rights management | Not started |
| 5. Yoruba content engine | Not started |
| 6. Voice and avatar | Not started |
| 7. Video production | Not started |
| 8. Publishing | Not started |
| 9. Monetisation | Not started |
| 10. Deployment | Not started |

---

## Phase 2: Brand and administration (2026-11-14)

Owner decisions: English **and** Yoruba interface; proper owner login (two-step
verification not requested, available later).

### Delivered
| Area | What exists |
|---|---|
| Owner login | Email and password login (scrypt), 5-attempt lockout for 15 minutes, 12-hour sessions stored only as hashes, httpOnly cookies, logout revokes the session, `create-owner` CLI. Every login, failure, lockout and logout is audited. |
| Bilingual dashboard | Every screen in English and Yorùbá. The switch is remembered per account. TypeScript blocks any missing Yoruba string. |
| Brand | Deep navy sidebar, warm gold accents, cream pages, charcoal text. Self-hosted Noto fonts so Yoruba tone marks render correctly. Responsive down to phone width. |
| 12 pages | **Overview** and **System settings** are fully working. The other 10 (Episodes, Research, Rights, Yoruba scripts, Voice, Video, Publishing calendar, Social accounts, Analytics, Monetisation) are labelled "Not built yet · Phase N", explain their purpose and safeguards, and show no sample data. |
| Overview | Live health (API, database, Redis), provider mode, real spend this month against the limit with the alert marker (sample runs are excluded), job counts, audit-trail integrity, setup checklist, provider status, recent activity. |
| System settings | 10 typed, range-checked settings for budget, storage, publishing and production. Raising a spending limit needs a ticked approval box and is audited as `budget.limit_increase_approved`. Automatic publishing cannot be switched on yet. Paginated audit-trail viewer. |
| API | `POST /api/v1/auth/login`, `POST /auth/logout`, `GET /auth/me`, `PUT /auth/me/language`, `GET /api/v1/overview`, `GET /api/v1/audit`, `GET/PUT /api/v1/settings` |
| Migration | `users`, `auth_sessions` (upgrade, downgrade and drift checked) |

### Test results
* **Backend:** 72 passed on PostgreSQL 16 (coverage 97%). SQLite fallback: 70 passed, 2 skipped. Lint clean.
* **Frontend:** typecheck clean; 22 unit tests passed (dictionary completeness and
  placeholders, NFC Yoruba text, date formats, settings parsing, API errors); production build succeeded.
* **Browser test** (`frontend/e2e/dashboard.e2e.cjs`, real API, worker, PostgreSQL and Redis):
  19 of 19 checks passed, 3 consecutive runs. It covers the login redirect, wrong password,
  httpOnly cookie, real $0.00 spend, lowering a limit, a blocked unapproved raise, an approved
  raise that is audited, the blocked auto-publish, the Yoruba switch, the honest placeholder
  page, no horizontal scroll on mobile, logout revoking the token, the saved language
  restored on the next login, and no browser errors.

### Failures found and fixed during Phase 2
1. **Email cleared after a failed login.** React 19 resets forms after an action, so the
   owner had to retype the email. The form now keeps it.
2. **Yoruba tone marks misplaced in headings** (e.g. "Àkópọ̀"). The system fonts could not
   stack diacritics. Fixed with self-hosted Noto fonts.
3. **Yoruba dates showed as "14 11 2026"** (the runtime has no Yoruba month names). Now
   "14/11/2026, 07:56", Lagos time.
4. A route-module name clash in `main.py` broke every endpoint (caught by tests at once).
5. **SQLite test isolation:** rows leaked between tests because pysqlite ignores
   SAVEPOINTs. Fixed with SQLAlchemy's documented recipe.
6. Several browser-test timing and selector mistakes (in the test script, not the app).

### Needs your action
* **Yoruba language review.** The interface text was written carefully but has not been
  checked by a fluent Nigerian Yoruba reviewer. The full list of terms is in
  [YORUBA_UI_REVIEW.md](YORUBA_UI_REVIEW.md).
* Docker images still need one build on your machine or in CI (unchanged from Phase 1).

### Known limitations
* Single owner role. No staff or reviewer accounts yet; they are added when the
  language-review workflow needs them (Phase 5).
* No two-step verification (can be added on request).
* No password reset by email (no email provider configured). If you forget your password,
  create a new owner with the CLI on the server.
* No rate limit by IP address beyond the per-account lockout. A reverse-proxy rate limit is
  part of Phase 10.

---

## Phase 1: Project foundation (2026-11-14)

### Delivered
| Area | What exists |
|---|---|
| Backend | FastAPI app factory, request-ID middleware, CORS, uniform error handling, health and readiness endpoints |
| Configuration | Environment-only settings, `SecretStr` secrets, production safety validation |
| Logging | JSON or text logs, request IDs, secret redaction |
| Database | SQLAlchemy 2 models, Alembic migration (tested upgrade → downgrade → upgrade), naming conventions |
| Audit trail | Hash-chained `audit_logs`, PostgreSQL triggers block UPDATE/DELETE/TRUNCATE, verification endpoint |
| Worker | Celery + Redis with safe defaults (acks_late, bounded retries, time limits), `system.ping` job that records status and audit entries |
| Adapters | Interfaces for LLM, TTS, avatar, storage, video source and publisher; offline sample adapters; real local storage; registry that refuses to fake live connections |
| Frontend | Next.js 15 + TypeScript + Tailwind with the brand palette; live system status page that shows "unreachable" rather than invented data |
| Docker | Backend and frontend Dockerfiles (non-root), `docker-compose.yml` with Postgres, Redis, migrations, API, worker and dashboard |
| Tests and CI | pytest (PostgreSQL or SQLite fallback), vitest, ruff; GitHub Actions workflow for backend, frontend and Docker build |
| Docs | README, installation guide, architecture and schema |

### Test results
* **Backend:** 38 passed, 0 failed, against PostgreSQL 16 with the real migrations. Coverage 96%.
  * SQLite fallback: 36 passed, 2 skipped (PostgreSQL-only trigger and drift tests).
* **Lint:** `ruff check` and `ruff format --check` clean.
* **Frontend:** typecheck clean; 4/4 vitest tests passed; `next build` succeeded.
* **Manual end-to-end:** a live uvicorn API, a real Celery worker, Redis and PostgreSQL.
  `POST /jobs/ping` was processed by `celery@vm` and reached `succeeded`. The audit chain
  verified (2 entries). The dashboard was checked with the backend up and down.

### Failures found and fixed during Phase 1
1. **Audit entry recorded without its job ID.** The job's UUID was only generated at flush
   time, so the `job.enqueued` audit row had `entity_id = NULL`. Fixed by assigning the ID
   before auditing. A test now checks this.
2. The Celery task held a direct reference to the session factory, which made it hard to
   test in isolation. It now resolves the factory through the module.
3. A config test was reading the test environment's admin token. It now passes explicit values.

### Not verified in this environment
* **Docker image builds.** `docker compose config` validates, but `docker compose build`
  could not finish here: the build sandbox's network policy blocks Debian package mirrors
  (`apt-get` exit 100). This is a limitation of the build machine, not a known Dockerfile
  defect. The CI workflow's `docker` job builds the images on GitHub. **Owner action:** run
  `docker compose up --build` once locally, or check that CI job.

### Known limitations (by design for Phase 1)
* The admin API uses a single bearer token. Owner login sessions come in Phase 2.
* No live provider adapters are installed yet. In `PROVIDER_MODE=live`, every AI and
  publishing capability reports "not configured", which is correct.
* Cloudflare R2 is not implemented yet. Local filesystem storage is used.
* Budget limits, rights verification, duplicate detection and publishing gates are not
  built yet (Phases 3–8 and section D).
