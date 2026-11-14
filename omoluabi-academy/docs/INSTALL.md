# Installation guide

Two ways to run the platform on a clean development machine. **Option A (Docker)** is the
simplest. **Option B (native)** is better for day-to-day development.

Nothing here creates paid accounts or spends money. The platform starts in **sample mode**
(`PROVIDER_MODE=sample`): every AI and publishing provider is replaced by an offline sample
adapter that makes no network calls.

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
Generate an admin token and paste it into `.env` as `ADMIN_API_TOKEN=...`:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# or: openssl rand -base64 32
```

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

### 4. Check it works
```bash
curl http://localhost:8000/health/ready
# {"status":"ok","checks":{"database":{"ok":true},"redis":{"ok":true}},...}
```
The dashboard home page should show **API / database / redis: OK** and **SAMPLE mode**.

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
# edit backend/.env: set ADMIN_API_TOKEN
make migrate               # creates the tables
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

### 6. Verify the full pipeline (API → Redis → worker → database)
```bash
TOKEN=<your ADMIN_API_TOKEN>
curl -s -X POST -H "Authorization: Bearer $TOKEN" localhost:8000/api/v1/system/jobs/ping
# -> {"job_id":"<id>", ...}
curl -s -H "Authorization: Bearer $TOKEN" localhost:8000/api/v1/system/jobs/<id>
# -> "status":"succeeded"
curl -s -H "Authorization: Bearer $TOKEN" localhost:8000/api/v1/system/audit/verify
# -> {"ok":true,...}
```

### 7. Run the tests
```bash
make test     # backend pytest + frontend typecheck and tests
make lint
```
Backend tests use the `omoluabi_test` PostgreSQL database when it is reachable (and apply
the real migrations). Otherwise they fall back to SQLite and skip the PostgreSQL-only tests.
Set `TEST_DATABASE_URL` to use a different database. **Tests never call paid APIs.**

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/health/ready` returns 503 | The response says which dependency is down. Start PostgreSQL/Redis. |
| `provider_not_configured` (503) on admin endpoints | `ADMIN_API_TOKEN` is not set in the backend's environment. |
| `authentication_required` (401) | Send `Authorization: Bearer <ADMIN_API_TOKEN>`. |
| Dashboard says "Backend unreachable" | Start the API, or set `BACKEND_URL` in `frontend/.env.local`. |
| `alembic upgrade` cannot connect | Check `DATABASE_URL` in `backend/.env`. |
