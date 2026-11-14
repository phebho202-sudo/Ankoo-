# Installation guide

Two ways to run the platform on a clean development machine. **Option A (Docker)** is the
simplest. **Option B (native)** is better for day-to-day development.

Nothing here creates paid accounts or spends money. The platform starts in **sample mode**
(`PROVIDER_MODE=sample`): every AI and publishing provider is replaced by an offline sample
adapter that makes no network calls. To connect real YouTube and Claude accounts later,
follow [API_SETUP.md](API_SETUP.md).

---

## Option A: Docker (Windows, macOS, Linux)

### 1. Install
- **Docker Desktop** (Windows/macOS) or **Docker Engine + Compose plugin** (Linux):
  https://docs.docker.com/get-docker/
- **Git**

### 2. Configure
```bash
git clone <your-repository-url>
cd <repository>/omoluabi-academy
cp .env.example .env
```
`ADMIN_API_TOKEN` is optional. It is only for scripts and `curl`; you log in to the
dashboard with your own email and password (step 4).

### 3. Start
```bash
docker compose up --build
```
This starts PostgreSQL, Redis, runs database migrations, then starts the API, the worker
and the dashboard.

| Service | URL |
|---|---|
| Admin dashboard | http://localhost:3000 |
| API | http://localhost:8000 |
| Interactive API docs | http://localhost:8000/docs |

### 4. Create your owner login (once)
```bash
docker compose exec api python -m app.cli create-owner --email you@example.com --name "Your Name"
```
You are asked for a password twice: at least 12 characters, mixed case, and a digit.

### 5. Check it works
```bash
curl http://localhost:8000/health/ready
# {"status":"ok","checks":{"database":{"ok":true},"redis":{"ok":true}},...}
```
Open http://localhost:3000 and log in. The Overview page should show **API / database /
job queue: OK** and **SAMPLE mode**. Use the **English / Yorùbá** switch at the bottom of
the menu to change the language. Your choice is remembered on your account.

Stop with `docker compose down`. Your data stays in Docker volumes. `docker compose down -v`
**deletes** all data.

---

## Option B: Native development

### 1. Install prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.12 or newer | `python3 --version` |
| uv (recommended) or pip | latest | `uv --version` |
| Node.js | 22 LTS | `node --version` |
| PostgreSQL | 16 | `psql --version` |
| Redis | 7 | `redis-server --version` |
| FFmpeg | 6+ (needed from Phase 6) | `ffmpeg -version` |

**Ubuntu/Debian**
```bash
sudo apt update
sudo apt install -y python3 python3-venv postgresql redis-server ffmpeg git curl
curl -LsSf https://astral.sh/uv/install.sh | sh
# Node.js 22: https://nodejs.org/en/download (or use nvm)
```

**macOS (Homebrew)**
```bash
brew install python@3.12 uv node@22 postgresql@16 redis ffmpeg
brew services start postgresql@16 && brew services start redis
```

**Windows**: use WSL2 with Ubuntu and follow the Ubuntu steps, or use Option A.

### 2. Create the databases
```bash
sudo -u postgres psql -c "CREATE USER omoluabi WITH PASSWORD 'omoluabi' CREATEDB;"
sudo -u postgres createdb -O omoluabi omoluabi
sudo -u postgres createdb -O omoluabi omoluabi_test
```
(On macOS drop `sudo -u postgres`.) This password is for local development only. The API
refuses to start in production with it.

### 3. Backend
```bash
cd omoluabi-academy
make backend-setup         # or: cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp backend/.env.example backend/.env
make migrate               # creates the tables
make owner                 # creates your owner login (asks for email and password)
```

### 4. Frontend
```bash
make frontend-setup
cp frontend/.env.example frontend/.env.local
```

### 5. Run (three terminals)
```bash
make api       # http://localhost:8000
make worker    # background jobs
make web       # http://localhost:3000
```

### 6. Log in
Open http://localhost:3000 and sign in with the owner email and password.

### 7. Verify the full pipeline (API → Redis → worker → database)
This uses the optional automation token. Set `ADMIN_API_TOKEN` in `backend/.env` first
and restart the API.
```bash
TOKEN=<your ADMIN_API_TOKEN>
curl -s -X POST -H "Authorization: Bearer $TOKEN" localhost:8000/api/v1/system/jobs/ping
# -> {"job_id":"<id>", ...}
curl -s -H "Authorization: Bearer $TOKEN" localhost:8000/api/v1/system/jobs/<id>
# -> "status":"succeeded"
curl -s -H "Authorization: Bearer $TOKEN" localhost:8000/api/v1/system/audit/verify
# -> {"ok":true,...}
```

### 8. Run the tests
```bash
make test     # backend pytest + frontend typecheck and tests
make lint
```
Backend tests use the `omoluabi_test` PostgreSQL database when it is reachable (and apply
the real migrations). Otherwise they fall back to SQLite and skip the PostgreSQL-only tests.
Set `TEST_DATABASE_URL` to use a different database. **Tests never call paid APIs.**

Browser test of the running dashboard. It changes settings, so use development data only:
```bash
E2E_EMAIL=you@example.com E2E_PASSWORD='...' make e2e
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/health/ready` returns 503 | The response says which dependency is down. Start PostgreSQL/Redis. |
| Login says "Incorrect email or password" | Check the email. Create the owner with `make owner` if you haven't. |
| Login says "Too many failed attempts" | 5 wrong passwords lock the account for 15 minutes. Wait, then try again. |
| Logged straight back out, or the login loops | You are using plain `http://` on an address other than `localhost`: set `COOKIE_SECURE=false` for the frontend (development only). |
| `authentication_required` (401) from `curl` | Send `Authorization: Bearer <ADMIN_API_TOKEN>` (set in `backend/.env`). |
| Dashboard says "Backend unreachable" | Start the API, or set `BACKEND_URL` in `frontend/.env.local`. |
| `alembic upgrade` cannot connect | Check `DATABASE_URL` in `backend/.env`. |
