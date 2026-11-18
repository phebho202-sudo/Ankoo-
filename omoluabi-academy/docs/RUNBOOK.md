# Runbook: recovery procedures

Short, tested steps for the problems most likely to happen. `P` below means
`docker compose -f docker-compose.prod.yml --env-file .env.prod` (run from
`omoluabi-academy/` on the server).

## 1. Restore the database from a backup

Tested in development: backup → restore into an empty database → identical row counts,
audit trail verified intact, tamper-protection triggers present.

```bash
P exec backup ls -lh /backups                       # choose a file
P stop api worker beat                              # nothing writes during the restore
P exec postgres createdb -U "$POSTGRES_USER" omoluabi_restored
P exec backup /bin/sh /scripts/restore.sh /backups/<file>.dump omoluabi_restored
```
Check it (counts of users, scripts, publications; the audit trail):
```bash
P exec postgres psql -U "$POSTGRES_USER" -d omoluabi_restored -c "select count(*) from audit_logs"
```
Switch to it: set `POSTGRES_DB=omoluabi_restored` in `.env.prod`, then `make prod-up`
(migrations run first). Open **Overview**: the audit trail must show "intact". Keep the old
database until you are satisfied; remove it later with `dropdb`.

`restore.sh` refuses a non-empty target unless you add `--yes`. It also checks the
backup's SHA-256 before restoring.

## 2. Publishing paused itself

**Calendar** shows the reason. It pauses on purpose when:
* **Rights check failed:** a licence expired, was revoked, or does not cover that platform.
  Fix the licence (Rights) or cancel the affected uploads.
* **Quality check failed:** a video is no longer approved, failed an automated check, or its
  file changed after approval. Re-render and re-approve, or cancel the upload.
* **Account permission failed:** see §3.

When the cause is fixed: **Calendar → Resume publishing**. Uploads that were already
*Uploaded* are never sent again.

## 3. A platform account needs reconnecting

**Social accounts** shows *Reconnect needed* and the last error. Click **Connect** for that
platform and sign in with the same account; the existing record is updated (no duplicate).
Meta accounts need this about every 60 days; the dashboard shows the expiry date and the
monitor warns 7 days before. Then resume publishing (§2).

## 4. An upload shows "Not confirmed"

It was sent but the platform did not confirm it, so it will **not** be sent again
automatically (that could create a duplicate). The scheduler keeps asking the platform. If it
stays unconfirmed, open the platform: if the video is there, choose **It is on the platform**
(paste the link); if not, choose **It is not there**, and schedule it again.

## 5. Budget limit reached

Paid jobs are **blocked** (not queued) once the month's limit would be exceeded; the monitor
alerts at your threshold. Options: wait for the next month, or raise the limit in **System
settings** (needs your explicit confirmation; recorded as a budget approval). Never raise it
to work around a runaway cost: check **Overview → Recent activity** first.

## 6. A deployment or migration failed

* The `migrate` service runs before the API. If it fails, the API does not start and the
  data is untouched. Read the error: `P logs migrate`.
* Roll back the code: `git checkout <previous tag or commit>` then `make prod-up`.
* If a migration had partly applied (PostgreSQL migrations here are transactional, so this
  should not happen), restore the backup taken just before the update (§1).

## 7. The worker or scheduler stopped

The monitor reports "Worker or scheduler stopped" after 20 minutes without a heartbeat.
```bash
P ps
P logs --tail=200 worker beat
P up -d worker beat
```
Jobs that were *running* when the worker died stay *running*: re-run them from the
dashboard. Paid jobs are never retried automatically, so nothing is billed twice. An upload
that was in progress becomes *Not confirmed* after an hour (§4).

## 8. Disk or storage full

* Server disk: `df -h`; clear old Docker images with `docker image prune`; check the
  `backups` volume size (`BACKUP_KEEP_DAYS`).
* Media storage limit (System settings): production stops when reached. Delete media of
  rejected videos or raise the limit (owner confirmation).

## 9. Lost TOKEN_ENCRYPTION_KEY

Stored platform tokens can no longer be read. Set a new key in `.env.prod`, `make prod-up`,
then reconnect every account (§3). Nothing else is affected.

## 10. A secret leaked

1. Revoke it at the provider (Anthropic, ElevenLabs, Google, Meta, TikTok, Paystack, R2,
   alert webhook) and create a new one.
2. Put the new value in `.env.prod` and `make prod-up`.
3. For the database or Redis password: change it in `.env.prod`, then in the database
   (`ALTER USER ... PASSWORD ...`), then `make prod-up`.
4. Check **Overview → Recent activity** and the provider's usage page for anything unexpected.

## 11. Owner locked out

After 5 wrong passwords the login is locked for 15 minutes. If the password is lost, reset it
on the server (this also clears the lock and ends every session of that account; it is
recorded in the audit trail):
```bash
P run --rm api python -m app.cli reset-password --email <owner email>
```
