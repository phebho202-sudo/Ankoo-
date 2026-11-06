# Ankoo — Business Book for Nigerian traders

An offline-first web app (it installs on Android and iPhone from the browser) that lets small businesses:

- **Record sales and expenses** in seconds. It keeps working with no network or power and syncs later.
- **See today's profit**, this month's profit, and how much customers owe.
- **Track debtors** and send **WhatsApp reminders** in one tap.
- **Check their 2026 tax position**: the ₦800k personal-income-tax-free band, or 0% tax as a small company. Pro users can download a print-ready **Tax Readiness Report** and a CSV of their records.
- **Earn as agents:** every user gets a referral link and earns 20% of their referrals' payments.

It makes money from Paystack subscriptions: **₦1,500/month or ₦15,000/year**. Free users get 60 records a month.

- Why this product: [`docs/RESEARCH.md`](docs/RESEARCH.md)
- How to make money with it: [`docs/LAUNCH_PLAN.md`](docs/LAUNCH_PLAN.md)

## Run it locally
Needs Node.js 22.5 or newer. There are **no dependencies to install**: it uses Node's built-in SQLite.
```bash
npm start            # http://localhost:3000
npm test             # runs the test suite
```
Without a Paystack key, "Get Pro" uses a fake dev checkout so you can test the whole flow.

## Configuration (environment variables)
| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `DB_PATH` | SQLite file. **Must be on a persistent disk.** | `./data/ankoo.db` |
| `BASE_URL` | Public URL, e.g. `https://ankoo.ng` (used in Paystack callbacks and referral links) | request host |
| `NODE_ENV` | Set to `production` live: secure cookies, dev checkout off | — |
| `TRUST_PROXY` | `1` behind a hosting proxy so rate limits see real visitor IPs (set in Dockerfile) | — |
| `PAYSTACK_SECRET_KEY` | From Paystack Dashboard → Settings → API Keys | — |
| `ADMIN_EMAILS` | Comma-separated emails that see the Admin panel (revenue, agent payouts) | — |
| `SMALL_COMPANY_TURNOVER_NGN` | Small-company turnover limit. **Check ₦50m vs ₦100m against the Act.** | `100000000` |
| `AGENT_COMMISSION_RATE` | Agent share of payments | `0.2` |
| `FREE_ENTRIES_PER_MONTH` | Free-plan record limit | `60` |

In the Paystack dashboard, set the **webhook URL** to `https://YOUR_DOMAIN/webhooks/paystack`.

## Deploy (cheapest options)
**Step-by-step for beginners: [`docs/DEPLOY.md`](docs/DEPLOY.md) (Railway, ~$5/month).**

The app is one Node process plus one SQLite file, so any host with a **persistent disk** works:

- **A $4–6/month VPS** (Hetzner, DigitalOcean, Contabo): install Node 22, clone the repo, then run it under a process manager with HTTPS (Caddy):
  ```bash
  NODE_ENV=production BASE_URL=https://yourdomain PAYSTACK_SECRET_KEY=sk_live_... \
  ADMIN_EMAILS=you@example.com DB_PATH=/var/lib/ankoo/ankoo.db npm start
  ```
- **Docker** (Fly.io with a volume, Railway with a volume, Render with a disk): use the included `Dockerfile` and mount the volume at `/data`.

Don't use a host with an ephemeral filesystem and no volume: you would lose every customer's records.

**Backups:** copy the database every day, e.g. a cron job running `sqlite3 /var/lib/ankoo/ankoo.db ".backup /backups/ankoo-$(date +%F).db"`.

## Project layout
```
src/server.js   HTTP server and API routes
src/db.js       SQLite schema
src/auth.js     scrypt password hashing, sessions, rate limiting
src/billing.js  Paystack checkout/verify/webhook, Pro activation, agent commissions
src/tax.js      2026 tax estimates (PIT bands, small-company test)
src/report.js   Printable Tax Readiness Report
public/         Mobile web app (installable PWA with offline cache)
test/           node:test suite
```

*Tax figures are estimates to help owners prepare. They are not tax advice.*
