# Deploying the ANKOO website

**Nothing has been published or purchased.** These steps are for you to follow when you approve. Railway (about $5/month on the Hobby plan, which you already use for the bookkeeping app) is recommended. Any host with Node 22 or Docker **and a persistent disk** also works, for example a VPS, Render with a disk, or Fly.io with a volume.

## Railway

1. In your existing Railway project (or a new one), choose **New → GitHub Repo → Ankoo-**. This creates a second service; the bookkeeping app is not affected.
2. In the new service's **Settings**:
   - **Source → Root Directory:** `store`
   - **Config-as-code → Railway config file:** `/store/railway.json`
   - **Branch:** the branch you merge the website into.
3. **Attach a volume** to this service with mount path `/data`. Do not skip this: it holds the database, photographs and videos.
4. **Variables:** paste the block from `.env.example` and fill in at least `BASE_URL` and `ADMIN_EMAILS`. Add the Paystack and Resend keys when ready. `NODE_ENV`, `DB_PATH`, `UPLOAD_DIR` and `TRUST_PROXY` are already set in the Dockerfile.
5. **Networking → Generate Domain.** Open the site, then **Create an account** with the email in `ADMIN_EMAILS`. You land in the admin.
6. Work through the **launch checklist** on the dashboard.

## Connecting the ANKOO domain (once you supply it)

Railway → service → Settings → Networking → **Custom Domain**. Add `www.yourdomain` (and the root domain if your registrar supports CNAME flattening or ALIAS records), then create the DNS records Railway shows at your registrar. Update `BASE_URL`, the Paystack webhook URL, Resend's domain, and the Search Console property.

## Backups

The volume holds everything. Turn on Railway volume backups, or copy `/data/store.db` (SQLite) and `/data/uploads` regularly. To copy the database safely while the site runs, use `sqlite3 /data/store.db ".backup /data/backup.db"`.

## Performance notes

- Images are resized in the admin before upload (2400px plus a 900px mobile version), served with long-lived caching, and lazy-loaded.
- HTML, CSS and JS are gzip-compressed. There are no front-end frameworks: the whole site's JavaScript is about 10 KB.
- For long films, use YouTube embeds rather than uploading video files.
- If traffic grows, put Cloudflare in front of the domain to cache `/media/*` and `/assets/*` close to visitors.
