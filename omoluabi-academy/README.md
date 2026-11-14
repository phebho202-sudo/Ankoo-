# OMỌLÚÀBÍ BUSINESS ACADEMY — Content Operations Platform

Practical business education in natural Nigerian Yoruba. This is the software that will run
the academy's research, rights management, Yoruba scripting, voice and video production,
publishing and monetisation, with a human approval gate at every risky step.

> **Status: Phase 4 (rights management) complete, awaiting owner approval before Phase 5.**
> See [`docs/PHASE_STATUS.md`](docs/PHASE_STATUS.md) for what works, what doesn't yet, and test results.

## Safety rules built into the platform

| Rule | Where it is enforced today |
|---|---|
| Never fabricate API connections | `PROVIDER_MODE=live` never falls back to sample adapters; missing keys raise `provider_not_configured` (`app/adapters/registry.py`) |
| Sample output is never real | Every adapter result carries `is_sample`; sample publisher never reports `confirmed=True` |
| No hard-coded keys | All secrets come from environment variables as `SecretStr`; log redaction for secret-like keys |
| Complete audit trail | Hash-chained `audit_logs`, append-only enforced by PostgreSQL triggers; `GET /api/v1/system/audit/verify` |
| Replaceable services | Every external service sits behind an interface in `app/adapters/base.py` |
| Capped retries | Worker retries are bounded by `TASK_MAX_RETRIES` (max 10) |
| Safe production start | The API refuses to start in production with default passwords or a weak automation token |
| No adaptation without verified rights | `require_rights()` gate: a licence must be verified by the owner against the uploaded signed document, be in force, and grant every needed right ("unclear" always blocks). Research-only channels and sample episodes can never be adapted or published. Every decision is recorded (`app/services/rights.py`). |
| Never exceed the spending limit | Each paid call reserves its worst-case cost first, under a database lock, and is blocked if the monthly limit would be exceeded (`app/services/budget.py`) |
| No duplicate videos | Unique (platform, video ID) in the database, plus re-upload detection by content fingerprint |
| No copying the source | Research is written in our own words, and any run of 12+ words copied from the source flags the report and blocks approval of its topics |
| Permitted transcripts only | No scraping. A transcript needs a recorded source and permission reference. |
| Owner approval for spending | Raising any spending limit needs explicit owner confirmation, recorded as `budget.limit_increase_approved` |
| No early auto-publishing | Automatic publishing cannot be switched on until the publishing pipeline exists and 10 videos are owner-approved |
| Secure owner login | scrypt-hashed passwords, 5-attempt lockout, expiring sessions stored only as hashes, httpOnly cookies |

Publishing gates and automatic publishing rules arrive in Phase 8, as specified.

## Layout

```
omoluabi-academy/
├── backend/            FastAPI + SQLAlchemy + Alembic + Celery (Python 3.12+)
│   ├── app/adapters/   provider interfaces, offline sample adapters, local storage
│   ├── app/api/        HTTP routes
│   ├── app/core/       config, logging, errors
│   ├── app/models/     database models
│   ├── app/services/   business logic (audit trail so far)
│   ├── app/worker/     Celery app and tasks
│   ├── alembic/        database migrations
│   └── tests/          pytest suite
├── frontend/           Next.js + TypeScript + Tailwind admin dashboard (English + Yorùbá)
├── docs/               installation, architecture, phase status
├── docker-compose.yml  full local stack
└── Makefile            common commands
```

## Quick start

See **[docs/INSTALL.md](docs/INSTALL.md)**. Short version with Docker:

```bash
cd omoluabi-academy
cp .env.example .env
docker compose up --build
docker compose exec api python -m app.cli create-owner --email you@example.com --name "Your Name"
# Dashboard: http://localhost:3000   API docs: http://localhost:8000/docs
```

## Documentation

- [Installation guide](docs/INSTALL.md)
- [API configuration: YouTube and Claude keys](docs/API_SETUP.md)
- [Operating costs](docs/COSTS.md)
- [Architecture and database schema](docs/ARCHITECTURE.md)
- [Phase status, test results and known limitations](docs/PHASE_STATUS.md)
- [Yoruba interface text for language review](docs/YORUBA_UI_REVIEW.md)
