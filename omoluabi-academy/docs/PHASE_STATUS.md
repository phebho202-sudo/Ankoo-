# Phase status

| Phase | Status |
|---|---|
| 1. Project foundation | **Complete. Awaiting owner approval.** |
| 2. Brand and administration | Not started |
| 3. Discovery and research | Not started |
| 4. Rights management | Not started |
| 5. Yoruba content engine | Not started |
| 6. Voice and avatar | Not started |
| 7. Video production | Not started |
| 8. Publishing | Not started |
| 9. Monetisation | Not started |
| 10. Deployment | Not started |

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
