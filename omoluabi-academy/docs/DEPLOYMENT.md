# Production deployment guide

This guide puts the platform on one small Linux server with HTTPS, private database and job
queue, encrypted secrets, daily backups, health monitoring and owner alerts. Every step that
creates an account or costs money is yours to decide: nothing here buys anything for you.

## 1. What you need

| Item | Suggestion | Notes |
|---|---|---|
| A server | 4 vCPU, 8 GB RAM, 80 GB disk, Ubuntu 24.04 (e.g. Hetzner CPX31/CX32 or a DigitalOcean 8 GB droplet) | Video rendering uses CPU. 2 vCPU / 4 GB works for a few videos a day, with slower renders. |
| A domain name | e.g. `admin.omoluabi.ng` | An A record pointing at the server's IP. |
| Cloudflare R2 bucket | private bucket, e.g. `omoluabi-media` | Media storage; no egress fees. Keys with *Object Read & Write* on that bucket only. |
| Alert channel | Slack, Discord or Google Chat incoming webhook | Where problems are reported. |

## 2. Prepare the server

```bash
# as root on a fresh server
adduser --disabled-password omoluabi && usermod -aG sudo omoluabi
apt-get update && apt-get -y upgrade
apt-get install -y ca-certificates curl git ufw unattended-upgrades
curl -fsSL https://get.docker.com | sh && usermod -aG docker omoluabi
ufw default deny incoming && ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
```
Use SSH keys only (`PasswordAuthentication no` in `/etc/ssh/sshd_config`).

## 3. Get the code and configure secrets

```bash
su - omoluabi
git clone <your repository URL> academy && cd academy/omoluabi-academy
cp .env.prod.example .env.prod && chmod 600 .env.prod
nano .env.prod
```
Fill in at least: `DOMAIN`, `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `POSTGRES_PASSWORD`,
`REDIS_PASSWORD` (random, e.g. `openssl rand -hex 24`), `TOKEN_ENCRYPTION_KEY`, the four
`R2_*` values and `ALERT_WEBHOOK_URL`. Leave `PROVIDER_MODE=sample` and the provider keys
blank until you have authorised each provider (docs/API_SETUP.md).

**Secrets rules:** `.env.prod` lives only on the server (it is git-ignored), readable only by
its owner. Keep an offline copy of `TOKEN_ENCRYPTION_KEY` and the database password in your
password manager. Never paste keys into the dashboard, chat or tickets. Rotate a key by
replacing it in `.env.prod` and running `make prod-up` (the services restart with the new
value).

The API refuses to start in production with unsafe settings (default passwords, http
addresses, a Redis without password, a missing token key) and lists what to fix.

## 4. Start

```bash
make prod-up          # builds the images, runs migrations, starts everything
make prod-logs        # watch the start-up (Ctrl-C to stop watching)
make prod-owner       # create your owner login
```
Open `https://<DOMAIN>`: Caddy obtains the HTTPS certificate automatically on first visit.

What runs (docker-compose.prod.yml):

| Service | Role | Reachable from the internet |
|---|---|---|
| caddy | HTTPS, security headers, routing | **Yes** (80/443): the dashboard, `/go/...` links, the Paystack webhook, `/health` |
| frontend | Admin dashboard | Through Caddy only |
| api | Backend API | Only the webhook and `/health`, through Caddy |
| worker | Background jobs (research, scripts, voice, rendering, uploads) | No |
| beat | Scheduler (publishing every 5 min, monitoring every 15 min, analytics daily, licence expiry daily, backups via the backup service) | No |
| postgres, redis | Database, job queue (password-protected) | No |
| backup | Daily database backup at 02:30 Lagos time | No |

## 5. After the first start

1. **System settings:** check the monthly budget ($50 by default), per-video cost cap, storage
   limit and alert threshold.
2. **Overview → System health:** every check should be OK within 15 minutes (the worker
   heartbeat appears after the first scheduler run).
3. Send a test alert: stop the worker for 25 minutes (`docker compose -f docker-compose.prod.yml
   --env-file .env.prod stop worker`), check that the alert arrives, then start it again.
4. Add an uptime monitor (e.g. UptimeRobot, free) on `https://<DOMAIN>/health`.
5. Follow docs/API_SETUP.md to connect providers one at a time, switching
   `PROVIDER_MODE=live` only when you are ready.

## 6. Backups

* The **backup** service writes a compressed, verified `pg_dump` with a SHA-256 checksum
  every day and keeps `BACKUP_KEEP_DAYS` (14) days, in the `backups` volume.
* Take one now: `make backup`.
* **Copy backups off the server.** A simple way with rclone and your R2 account (a separate
  bucket, e.g. `omoluabi-backups`, with its own key):
  ```bash
  # crontab -e (as omoluabi): every day at 03:15
  15 3 * * * docker run --rm -v omoluabi-prod_backups:/b:ro -v $HOME/.config/rclone:/config/rclone rclone/rclone copy /b r2:omoluabi-backups
  ```
* Media files are in R2, which stores them redundantly. Turn on R2 object versioning or a
  lifecycle rule if you also want protection against accidental deletion.
* **Test a restore every month** (docs/RUNBOOK.md §1). A backup you have not restored is a hope.

## 7. Updating

```bash
make backup
git pull
make prod-up      # rebuilds, migrates, restarts
```
Database migrations run automatically before the API starts. If a migration fails, the API
does not start and the old data is untouched: see docs/RUNBOOK.md §6.

## 8. Monitoring and alerts

* `beat` records a heartbeat every 5 minutes; `system.monitor` checks every 15 minutes: database,
  job queue, worker and scheduler, monthly budget (alert at your threshold, error at the limit),
  storage (80% / 100%), publishing paused, accounts needing reconnection or expiring, failed jobs,
  uploads waiting for confirmation, licences expiring, audit-trail integrity.
* Problems appear on **Overview → System health** and go to `ALERT_WEBHOOK_URL`. The same
  problem is not repeated for 6 hours.
* Unexpected server errors and failed background jobs also send alerts (error type only: no
  private data leaves the server).
* Logs: `make prod-logs` (JSON, rotated at 10 MB × 5 per service).

## 9. Not verified in the build environment

Docker images could not be built where this platform was developed (no Docker daemon and no
access to the Debian package mirrors). The production Compose file was validated with
`docker compose config`, and every component was run and tested natively. **Run the first
deployment on a staging server or a fresh VM** and go through §5 before inviting reviewers.
