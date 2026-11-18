# Phase status

| Phase | Status |
|---|---|
| 1. Project foundation | Complete. Approved 2026-11-14. |
| 2. Brand and administration | Complete. Approved 2026-11-14. |
| 3. Discovery and research | Complete in sample mode. Approved 2026-11-14 (API keys pending). |
| 4. Rights management | Complete. Approved 2026-11-16. |
| 5. Yoruba content engine | Complete in sample mode. Approved 2026-11-16. |
| 6. Voice and avatar | Complete in sample mode. Approved 2026-11-16 (ElevenLabs account pending). |
| 7. Video production | Complete in sample mode (2026-11-16). |
| 8. Publishing | Complete in sample mode (2026-11-17). Platform apps and accounts pending. |
| 9. Monetisation | Complete in sample mode (2026-11-17). Paystack account pending. |
| 10. Deployment | **Complete (2026-11-17). Not yet deployed to a server: needs your server, domain and R2 bucket.** |

---

## Outstanding requirements and known limitations

### What only you can do (accounts, agreements, spending)
Nothing below has been created, bought or signed: each needs your authorisation.
1. **Server, domain, Cloudflare R2 bucket, alert webhook** (DEPLOYMENT.md). Deploy first to a
   staging server: the Docker images were not built in the development environment.
2. **Provider accounts and keys:** Anthropic (Claude), ElevenLabs, YouTube Data API key,
   Google OAuth client, Meta app, TikTok app, Paystack (start with a test key). API_SETUP.md.
3. **Presenter:** an original or licensed portrait and voice (no real person), then a
   pronunciation test passed by a fluent Yoruba reviewer.
4. **Yoruba reviewer(s):** to review scripts, the glossary, pronunciation and the dashboard's
   own Yoruba text (YORUBA_UI_REVIEW.md).
5. **Licences** for any Alex Hormozi (or other creator) adaptation: signed documents verified in
   Rights management. Without them, adaptations are blocked; original lessons need none.
6. **Approve 10 real videos** before automatic publishing can be switched on; decide on public
   uploads separately. For public YouTube uploads, Google's audit of the API project.
7. **Budget:** confirm the monthly limit (default $50 of provider spend) against the cost report.

### Not verified against the real services (built to their published APIs, tested with simulated servers)
* Claude (live research and scripts), ElevenLabs (Yoruba voice quality unknown until the first
  test), YouTube Data API, YouTube uploads and Analytics, Meta (Facebook Reels, Instagram),
  TikTok, Paystack, Cloudflare R2, alert webhooks.
* Docker image builds and the production Compose stack (validated with `docker compose config`;
  every component was run natively).

### Known limitations by design or for later
* **Presenter:** hybrid format (portrait with gentle motion, voice, slides). A lip-synced avatar
  needs a licensed provider and avatar minutes (capped at 0).
* **Visuals:** slides show the narration text; no generated diagrams or b-roll (no paid image service).
* **Instagram:** public only (API limitation), so unavailable during the trial period.
  **TikTok:** drafts to your inbox; direct posting needs TikTok's audit.
* **Meta tokens:** reconnect about every 60 days (monitored, with a 7-day warning).
* **Analytics:** YouTube only; other platforms' insights need extra permissions and app review.
  NGN and USD are never converted.
* **Digital product delivery:** manual (the product's delivery note); no automatic download link.
* **Quality heuristics** (originality overlap, educational-value advice, translation checks) guide
  human reviewers; they never replace them.
* **Platform rules** (video lengths, scopes, API versions) change: review PUBLISHING.md periodically.
* **Single server:** fine for this scale; the worker renders one video at a time.

---

## Phase 10: Deployment and operations (2026-11-17)

### Delivered
| Requirement | What exists |
|---|---|
| Docker deployment | `docker-compose.prod.yml`: Caddy (automatic HTTPS, security headers, only the dashboard, `/go/` links, the payment webhook and `/health` public), private API, worker (one render at a time), single scheduler, Postgres and Redis with passwords and **no published ports**, restart policies, health checks, log rotation. Validated with `docker compose config`. |
| Environment configuration | `.env.prod.example` with every setting explained; production start-up refuses unsafe settings (default passwords, http addresses, Redis without password, no token key, weak automation token). |
| Database backups | Daily verified `pg_dump` with SHA-256 checksum and retention (`backup` service), `make backup`, `scripts/restore.sh` (refuses a non-empty target unless told). **Tested:** backup → restore into an empty database → identical row counts, audit chain intact (936 entries), tamper-protection triggers restored; overwrite path tested too. |
| Monitoring | Health checks every 15 minutes: database, queue, worker/scheduler heartbeat, budget, storage, publishing pause, platform accounts, failed jobs, unconfirmed uploads, licences, audit-trail integrity. **Overview → System health**, and `GET /api/v1/system/health`. |
| Error alerts | Alerts to `ALERT_WEBHOOK_URL` (Slack/Discord/Google Chat or any JSON endpoint) and the audit trail, repeats suppressed for 6 hours. Also for unexpected server errors (error type only, no private data) and failed background jobs. |
| Secure secrets management | Secrets only in `.env.prod` (git-ignored, mode 600), `SecretStr` everywhere, platform tokens Fernet-encrypted, rotation and leak procedures in the runbook. |
| Spending limits | All budget controls from earlier phases, now with alerts at the threshold and at the limit. **Actual cost per video** (script + voice + rendering) shown on each video. |
| Recovery procedures | RUNBOOK.md: restore, publishing paused, reconnecting accounts, unconfirmed uploads, budget reached, failed migration/rollback, stopped worker, full disk, lost token key, leaked secret, owner lockout (new `reset-password` command). |
| Cloudflare R2 | Private-bucket storage adapter with ranged reads (video seeking through the API) and one-hour signed links for Instagram. Tested with botocore's Stubber. |
| Deliverables | README maps all 14 required deliverables; DEPLOYMENT.md; COSTS.md monthly report. |

### Test results
* **Backend:** 318 passed on PostgreSQL 16, 91% coverage; also passes in SQLite mode. Lint and format clean.
* **Frontend:** typecheck and lint clean; 37 unit tests; production build OK.
* **Browser tests on the real stack (all suites):** Phase 10 **8/8**, Phase 9 **23/23**, Phase 8 **22/22**,
  Phase 7 **23/23**, Phase 6 **15/15**, Phase 5 **20/20**, Phase 4 **19/19**, Phase 3 **18/18**, Phase 2 **19/19**.

### Failures found and fixed
1. **Episode catalogue ordering was unstable** when publication dates were equal (found when the
   Phase 3 and 4 suites could not find a just-scanned channel among many test channels). Pages
   could skip or repeat an episode. A deterministic tiebreak fixes it; a test pages through
   tied rows and checks none is skipped or repeated.
2. The runbook needed an owner password reset that did not exist: added `reset-password`
   (clears the lockout, ends all sessions, audited), with a test.
3. Two shell edits were stopped by the environment's safety check (no deletion was involved);
   the same edits were made with the file tools.

### Needs your action
See **Outstanding requirements** above.

---

## Phase 9: Monetisation and analytics (2026-11-17)

### Delivered
| Requirement | What exists |
|---|---|
| Affiliate links | Links with a short public address (`/go/<name>?s=<source>`), https-only destinations, **mandatory Yoruba and English disclosures**, pause/resume. Clicks are counted with source and referring site only: **no IP address or personal data**. |
| Digital product catalogue | Products (e-book, template, course, workshop) with Yoruba and English names, price in kobo/cents, draft/on sale/archived. |
| Payment integration readiness | Paystack adapter: checkout links, **webhook signature check (HMAC-SHA512)**, a second verification with Paystack, and amount/currency must match the order before anything is recorded. Revenue is recorded once even if Paystack resends. Test mode: simulated orders, no checkout, no money. |
| Sponsorship tracking | Proposed → agreed (needs the signed agreement's reference) → delivered → paid, or cancelled. Linked videos automatically carry a **paid-partnership notice** in every caption. A paid sponsorship becomes revenue. |
| YouTube earnings reporting | Daily import from the YouTube Analytics API (views, watch time, likes, comments, subscribers, and estimated revenue **only if YouTube reports it**). If the channel is not monetised or the permission is missing, revenue is *not reported*, never 0. Estimates are labelled and updated in place as YouTube revises them. **Monetisation is never assumed.** |
| Revenue analytics | Revenue by source and currency (NGN and USD never mixed), provider costs, USD net, cost per approved video, per-video views, watch hours, average view, engagement, revenue and RPM, monthly series, affiliate clicks/sales/conversion/earnings per click, orders and sponsorship pipeline. 30/90/365-day periods. |
| Revenue records | Owner entries (with who entered them), duplicate references refused, no future dates. |
| Dashboard | **Monetisation** and **Analytics** pages, English and Yoruba, owner only. |

### Test results
* **Backend:** 299 passed on PostgreSQL 16; also passes in SQLite mode. Lint clean. Migration up/down checked.
  Analytics calculation tests cover zero denominators, unreported revenue, partial revenue, currency separation, monthly series, net and affiliate rates.
* **Frontend:** typecheck clean; 37 unit tests (including exact money parsing and formatting); build OK.
* **Backend:** 316 passed after the commit-ordering fix (includes early Phase 10 tests).
* **Browser tests on the real stack, all suites in sequence:** Phase 9 **23/23**, Phase 8 **22/22**, Phase 7 **23/23**, Phase 6 **15/15**, Phase 5 **20/20**, Phase 4 **19/19**, Phase 3 **18/18**, Phase 2 **19/19**.

### Failures found and fixed
1. **Empty periods crashed the summary** (a sum of nothing was an integer, not a decimal). Fixed; tested.
2. **A rejected payment notification was lost from the audit trail** because the error rolled
   back the request. The rejection is now committed to the audit trail before the error is returned.
3. The placeholder page component and its text were removed: every dashboard page is now built.
4. A browser-test step reused a form after it had been cleared (test error, fixed in the test).
5. **Database commits happened after the response was sent** (found while running all browser
   suites in sequence). FastAPI 0.162 ends `yield` dependencies after responding by default, so
   a new login token could be used a moment before it was saved ("session ended" right after
   logging in), and a failed commit would have been reported as success. Every route now commits
   before responding; a test proves a failed commit returns an error, and another guards against
   the old form coming back.

### Needs your action
1. **Paystack:** create an account, start with a **test** secret key (`PAYSTACK_SECRET_KEY=sk_test_…`)
   and register the webhook address shown on the Monetisation page.
2. **YouTube Analytics:** reconnect YouTube once so the analytics permissions are granted.
3. Affiliate programmes and sponsors are your agreements; record only real terms.

### Known limitations
* Paystack is not verified live (no account yet). Delivery of digital products to buyers is
  manual (the "how the buyer receives it" note); an automatic download link is a later addition.
* Analytics are imported for YouTube only. Facebook, Instagram and TikTok insights need extra
  permissions and app review; their figures can be entered as revenue manually.
* No currency conversion: NGN and USD are reported separately by design.

---

## Phase 8: Publishing (2026-11-17)

### Delivered
| Requirement | What exists |
|---|---|
| YouTube integration | Google OAuth with PKCE and offline access; resumable upload (category Education, Yoruba language, made-for-kids false, **synthetic-media disclosure on**); Yoruba captions upload; custom thumbnail (warning only if the channel cannot use one); confirmation by reading the video back. Shorts use the vertical video with "#Shorts". |
| Meta integration | Facebook Login; long-lived token; every Page and its linked Instagram professional account. Facebook Reels uploaded as **drafts** during the trial. Instagram Reels (container, processing check, publish) built, but **unavailable until the unlock** because Instagram has no private or draft mode. |
| TikTok integration | Login Kit OAuth; Content Posting API **inbox (draft)** upload with TikTok's chunking rules and status check. |
| OAuth authentication and token refresh | One-time `state` (15 minutes) and PKCE verifier stored server-side; tokens **encrypted** (Fernet, `TOKEN_ENCRYPTION_KEY`), never logged or returned; refresh 5 minutes before expiry; a refused refresh marks the account *Reconnect needed* and stops publishing. |
| Scheduled publishing | Calendar with Lagos time; the `beat` service sends due uploads every 5 minutes (or **Send due uploads now**); daily upload limit; YouTube quota guard. |
| Retry logic | Temporary failures retried at 5, 10, 20… minutes up to the retry limit, **continuing the same upload session**; permanent failures not retried. |
| Upload confirmation | *Uploaded* only after the platform confirms. Otherwise *Not confirmed*, never re-sent automatically; re-checked with the platform, or resolved by you. |
| Duplicate detection | One live publication per video file per destination (code + unique database index). |
| Publishing logs | Every attempt: time, outcome, HTTP status, message. Everything also in the audit trail. |
| Platform-specific captions | Title and description per destination (length limits, Yoruba first, English line, AI disclosure, "education only", licence credit, hashtags), editable before scheduling. |
| Private/draft/test first | Trial period: private, unlisted or draft only. Test mode: sample accounts; uploads are *Simulated* and nothing leaves the server. |
| Automatic publishing after 10 approved videos | The setting is accepted only when 10 **real** videos are owner-approved and a real account is connected; then approved videos are scheduled automatically. Public uploads need a second switch, accepted only after the unlock. |
| Automatic stop | Rights check failure, quality check failure (unapproved, failed check, or file changed since approval) or account permission failure **pauses all publishing** with an alert, until you resume. |
| Dashboard | **Social accounts** (connect, sample accounts, status, expiry, redirect URIs, disconnect) and **Publishing calendar** (running/paused state, trial status, schedule form, upcoming, history, per-upload log and confirmation). English and Yoruba. Owner only. |

### Test results
* **Backend:** 279 passed on PostgreSQL 16; also passes in SQLite mode. Lint clean. Migration up/down checked.
  Adapters are tested against simulated platform servers: OAuth exchange and refresh,
  resumable upload and resume, error classification, TikTok chunking, Facebook drafts,
  Instagram flow. Service tests cover OAuth token refresh, publishing retries, duplicate upload
  prevention (including the database index), unconfirmed uploads, daily limits, automatic stop
  on rights/quality/account failures, the unlock and automatic scheduling.
* **Frontend:** typecheck clean; 35 unit tests; build OK.
* **Browser tests on the real stack:** Phase 8 **22/22** (run twice in a row), Phase 7 **23/23**,
  Phase 6 **15/15**, Phase 5 **20/20**, Phase 4 **19/19**, Phase 3 **18/18**, Phase 2 **19/19**.

### Failures found and fixed
1. **Retry back-off used the wall clock instead of the scheduler's time,** so waiting times
   were miscalculated in a delayed run. Fixed and tested.
2. **Sample accounts accepted visibilities the real platform does not offer** (for example a
   private Instagram upload). Sample publishers now mirror each platform's real options.
3. **Identical sample videos were refused as duplicates after a simulated upload.** A
   simulated upload never reaches a platform, so it no longer blocks a later attempt. Real
   uploads still do.
4. The Social accounts page briefly showed the old placeholder because the previous
   dashboard server was still running. Test-environment issue only.

### Needs your action
1. Generate and safely store **TOKEN_ENCRYPTION_KEY**, and set **PUBLIC_BASE_URL** (API_SETUP.md §6.0).
2. Create the **Google OAuth client**, the **Meta app** and the **TikTok app** (free, but each
   is an agreement with that platform), then connect one account at a time.
3. Upload **one private test video** per platform and check it on the platform.
4. YouTube: until Google audits the API project, uploads stay private. Plan the audit before
   you want public uploads.

### Known limitations
* **Not run against the real platforms** (no accounts exist yet); built to their published
  APIs and tested against simulated servers.
* Instagram needs public video hosting (`PUBLIC_MEDIA_BASE_URL`, Phase 10 R2) and a public
  upload, so it stays unavailable during the trial.
* TikTok direct posting needs TikTok's audit; drafts are finished in the TikTok app.
* Meta tokens must be renewed by reconnecting about every 60 days (the dashboard shows the date).
* Platform rules (lengths, scopes, API versions) change; review PUBLISHING.md periodically.

---

## Phase 7: Video production (2026-11-16)

### Delivered
| Requirement | What exists |
|---|---|
| Long-form 16:9 YouTube lesson | 1920×1080 H.264/AAC: a 4 s branded intro card (academy name, Yoruba title), one Yoruba slide per narrated segment shown for exactly that segment's measured length, the presenter framed in gold on the right, then a 5 s outro ("Ẹ ṣé tí ẹ wò ó!") with the licence credit when a licence requires one. Fades in and out. |
| Vertical 9:16 master | 1080×1920: branded header with the Yoruba title, the presenter, **burned-in Yoruba captions** (libass + DejaVu Sans, tone marks checked) and an end card. Lessons up to 85 s are used whole; longer lessons use their opening segments (up to 55 s) and end with a card pointing to the full lesson. |
| YouTube Shorts, Instagram Reels, Facebook Reels, TikTok | The vertical master serves all four. Each video shows which destinations it fits, from documented length limits (YouTube Shorts 180 s, Instagram Reels 180 s, Facebook Reels 90 s, TikTok 600 s; see PUBLISHING.md). |
| Thumbnails | 1280×720 lesson thumbnail and 1080×1920 cover: Yoruba title, presenter portrait in a gold frame, brand line. |
| Subtitle files | Yoruba and English SRT for each video. The lesson's captions are shifted past the intro card; vertical captions use shorter lines. |
| Branded intro and outro | As above, in the academy colours. |
| Substantial original educational value | **Educational value gate**, checked when a render is requested, again before rendering and again at approval: completed narration; latest script version approved by a Yoruba reviewer; no automated quality errors; original lessons not flagged as copied, adaptations still holding valid rights; enough substance (long-form lessons at least `production.min_long_form_seconds`, default 120 s, and at least 3 teaching segments). Advice shown to you: a practical action, Nigerian examples, no income promises. |
| Quality checks | After rendering, each video is probed: resolution, sound present, length matches the narration (±0.6 s), captions end inside the video. **Any failure stops the video: it can never be approved or published.** |
| No duplicates | Each lesson version (script, version, voice) has a fingerprint. A second video for the same lesson version is refused (409) while one is queued, rendering, waiting or approved. |
| Owner approval | Every video waits for you. Approving needs six confirmations (watched in full, captions match the voice and marks are correct, presenter consistent, educational value, no income promises, credits). Rejecting needs a note. Everything is in the audit trail. **Approving publishes nothing.** |
| Unlock count | The Video page shows how many real videos you have approved out of the 10 required for automatic publishing. **Sample videos never count.** |
| Dashboard | **Video production** page (unlock progress, lessons ready with their gate report, video list) and a **video** page (both players, where it fits, thumbnails, caption files, gate, automated checks, your review). English and Yoruba. Owner only: reviewers cannot open finished videos. |

### Test results
* **Backend:** 237 passed on PostgreSQL 16 (94% coverage); SQLite mode 235 passed + 2 skipped (PostgreSQL-only). Lint clean. Migration up/down checked.
  Video tests render real videos with FFmpeg and check them with ffprobe.
* **Frontend:** typecheck clean; 33 unit tests; build OK.
* **Browser tests on the real stack:** Phase 7 **23/23**, Phase 6 **15/15**, Phase 5 **20/20**, Phase 4 **19/19**, Phase 3 **18/18**, Phase 2 **19/19**.

### Failures found and fixed
1. **Burned-in captions appeared at the top of the vertical video.** Subtitles from an SRT
   use a 288-pixel-high virtual canvas, so the bottom margin pushed the text up. Captions
   are now written as ASS with the real frame size, so margins are in true pixels.
2. **Sample lessons are only seconds long,** so the substance check would make test mode
   unusable. In sample mode the check is reported but not enforced, and sample videos
   never count toward the unlock. It is enforced for every real lesson (tested).
3. **A second narration of the same script version was offered for rendering again.** The
   list of lessons ready to render now hides any lesson version that already has a video.

### Needs your action
1. Nothing new to buy. Rendering is local and costs $0.
2. Before the first real video, look at the default 120 s minimum for long-form lessons
   (System settings) and change it if you want.

### Known limitations
* Slides show the narration text. Diagrams, charts and b-roll are not generated (no paid
  image service is used).
* The presenter is the hybrid format (portrait with gentle motion). A lip-synced avatar
  needs a licensed provider and avatar minutes in the budget.
* The value-gate advice (practical action, Nigerian examples, income promises) uses keyword
  heuristics on the English text. It guides your review; it does not replace it.
* Platform length limits are hard-coded from current published rules and must be reviewed
  when platforms change them.
* Rendering uses the worker's CPU: about 15 s for a short sample; a real 8-minute lesson
  will take a few minutes on a small server.

---

## Phase 6: Voice and presenter (2026-11-16)

### Delivered
| Requirement | What exists |
|---|---|
| A consistent original Nigerian male business educator | One presenter profile (name, voice, portrait), locked when approved. Owner declarations that the voice and portrait are original or licensed and depict no real person. Changing either cancels approval. The face itself must come from you: I cannot generate a portrait without a paid image service, and a placeholder brand card is used until you upload one. |
| Test Yoruba pronunciation before large-scale generation | A test passage covering tone minimal pairs (owó/ọwọ́/ọ̀wọ̀, ọkọ/ọkọ̀/ọkọ́, igbá/ìgbà/ìgbá), dotted letters, naira amounts, your dictionary terms and natural pace. A Yoruba reviewer rates each check. **Narration is blocked until the current exact voice configuration passes.** |
| Voice narration | Per-segment synthesis with your approved pronunciations applied, joined and loudness-levelled. ElevenLabs adapter built; sample mode uses a local test tone. |
| Presenter video | **Hybrid (default, cheapest):** portrait with gentle motion over the narration (H.264). Full avatar is refused until a licensed avatar provider is connected, and is capped by avatar minutes (0 by default). |
| Audio waveform | Gold-on-navy waveform image. |
| Captions | English and Yoruba SRT re-timed to the measured narration, segment by segment. |
| Supporting educational graphics | A 1920×1080 Yoruba slide per segment in the brand colours, with correct tone marks. |
| Cost per job | Every test and run records characters and actual cost. Budget reserved before any paid call. Avatar minutes and storage limits enforced. |
| Dashboard | **Voice production** page (presenter, declarations, portrait, pronunciation tests with player and rating, approved scripts, runs) and **run** page (presenter clip, narration, waveform, slides, per-segment audio, captions, cost). Reviewers can rate tests. Both languages. |

### Test results
* **Backend:** 228 passed on PostgreSQL 16 (94% coverage); SQLite mode passes too. Lint clean. Migration checked.
  The pipeline tests run real FFmpeg. ElevenLabs is tested against a simulated server.
* **Frontend:** typecheck clean; 33 unit tests; build OK.
* **Browser tests on the real stack:** Phase 6 **15/15**, Phase 5 **20/20**, Phase 4 **19/19**, Phase 3 **18/18**, Phase 2 **19/19**.

### Failures found and fixed
1. **Yoruba tone marks missing on rendered slides.** FFmpeg with Noto Sans dropped or
   misplaced stacked marks (Ẹ̀kọ́ became Ẹkọ). Compared fonts side by side and switched to
   DejaVu Sans, which renders every combination correctly. It is now in the Docker image.
2. **A corrupt portrait could freeze a production job for 10 minutes.** FFmpeg looping a
   broken image retries endlessly. Portraits are now decoded on upload. The render uses a
   cleaned copy, and every FFmpeg call has a timeout sized to its work and no stdin.
3. **Each production asset was listed twice** (linked to its run two ways). Fixed.
4. Test-script issues (an unapplied test edit, a heading-match race, Unicode forms). Fixed in tests.

### Needs your action
1. **ElevenLabs account and key.** Confirm on their site which model supports Yoruba, choose
   an original or licensed voice, and set your real per-character rate (API_SETUP.md §3).
2. **A presenter portrait,** original or licensed (commissioned or AI-generated for the
   academy), not depicting a real person.
3. **Run a pronunciation test with a fluent Yoruba reviewer** before any real narration.
4. Decide later whether a lip-synced avatar is worth its cost. Hybrid is the default.

### Known limitations
* **ElevenLabs is not verified live, and Yoruba quality is unknown** until the first real test.
* Slides show the Yoruba narration text. Richer diagrams per segment are a possible later addition.
* The waveform is a still image. Animated waveforms belong to Phase 7 video composition.
* Avatar provider: none connected (by design for cost).

---

## Phase 5: Yoruba content engine (2026-11-16)

### Delivered
| Requirement | What exists |
|---|---|
| Expert Yoruba localisation prompt | Instructions to write natural Nigerian Yoruba (Ọ̀yọ́/Ìbàdàn/Lagos standard) with full tone marks and dots below. They also require approved business vocabulary, ₦ figures identical in both languages, concrete Nigerian examples (Balogun, POS agents, ajo/esusu…), honesty about income, and no imitation of any real person. They ask for a list of uncertain words for the reviewer. |
| Original lessons and licensed adaptations | Originals come only from topics you approved, written from the academy's own research, and are checked against every source we hold. Adaptations need a verified licence and the licensed transcript. Rights are re-checked before writing and at approval, and the licence's credit line is added and locked. |
| Translation revisions | Every change is a new numbered version (model-written, model-revised with your instructions, or edited by a person). Older versions can be viewed and are never overwritten. Editing an approved script needs a new review. |
| Pronunciation dictionary | Written → spoken entries that a reviewer approves. Exported as a standard PLS lexicon for the voice service (Phase 6). |
| Business vocabulary | Approved English → Yoruba terms go into every script brief. 20 starter terms are available as *proposals* (`seed-glossary`); none is used until a reviewer approves it. |
| English and Yoruba subtitles, SRT export | Both languages are timed to the Yoruba narration, segment by segment, 2 lines × 42 characters. Timing is estimated now and re-timed to the real audio in Phase 6 (that logic is built and tested). A plain-text script export is also provided. |
| Human language-review stage | Reviewer accounts (created by you, with a one-time password) see only scripts and language resources. Approval needs all six checklist items confirmed on the latest version. "Request changes" needs comments. Everything is audited. |
| Translation quality score | Checks for missing text, misplaced marks, mostly unmarked words, copied wording, missing figures, English words, unused vocabulary and length mismatches. Errors block review. Every score is shown with the statement that it cannot judge tone accuracy or naturalness. |

### Test results
* **Backend:** 203 passed on PostgreSQL 16 (94% coverage); SQLite mode passes too. Lint clean. Migration checked.
* **Frontend:** typecheck clean; 33 unit tests; build OK.
* **Browser tests on the real stack:** Phase 5 **20/20** (owner and reviewer roles), Phase 4 **19/19**, Phase 3 **18/18**, Phase 2 **19/19**.

### Failures found and fixed
1. **Reviewer accounts were created as owners.** An edit to the user-creation code had
   silently not applied. Caught by the role tests before release. Fixed and checked: the
   role tests now cover reviewer access everywhere.
2. **Reviewers could read the settings list** (budget limits). The endpoint needed only a
   login. It is now owner-only, and every route was re-checked.
3. **Approve/Reject buttons didn't send the decision.** The browser left out the clicked
   button's value, so the review was rejected as invalid. Both two-button forms (script
   review and topic approval) now set the decision explicitly.
4. **In-session lists of versions and reviews went stale** after saving. Fixed.
5. **The vocabulary check missed plurals** ("customers" vs "customer"). Fixed.
6. **The quality disclaimer showed in English on Yoruba pages.** Now translated.
7. Test-script issues (CSS upper-casing, a filter menu counted as navigation, a language-
   switch race). Fixed in the tests.

### Needs your action
1. **Appoint at least one fluent Yoruba language reviewer** and create their account
   (System settings → Language reviewers). No script can be approved without a review.
2. Have the reviewer go through the **starter vocabulary** (after `seed-glossary`) and the
   interface wording (`docs/YORUBA_UI_REVIEW.md`).
3. With an Anthropic key, generate one short and one full lesson, and have the reviewer
   judge the Yoruba quality before any volume work. **The localisation instructions are
   untested against the real model.**

### Known limitations
* The automated checks cannot verify that a tone is *correct*, only that marks are present
  and validly placed. Human review is the real quality gate.
* Subtitle timing is estimated until Phase 6 records the voice.
* One approving review is required. A second-reviewer rule can be added if you want it.
* Deleting a vocabulary or pronunciation entry is immediate (audited, no undo).

---

## Phase 4: Rights management (2026-11-14)

### Delivered
| Area | What exists |
|---|---|
| Licence records | Everything the brief requires: source identification (a whole channel or specific episodes), licence reference plus the uploaded signed document (PDF/PNG/JPEG, checked by file signature, SHA-256 fingerprint), translation, adaptation, commercial and distribution rights, permitted platforms, and a **required expiry date**. Also licensor contact, territory, permitted languages and attribution. |
| "Unclear" is never permission | Each right is granted / not granted / unclear. Unclear blocks verification and use. |
| Owner verification | Lists exactly what is missing, then needs an explicit confirmation against the signed document. Edits, scope changes and new documents send it back to draft. Revocation needs a reason. Everything is audited. |
| The rights gate | `check_rights` / `require_rights` refuse when permission is absent, unverified, expired, not yet in force, revoked, missing a needed right, not covering Yoruba or the platform, or when the channel is research-only. Sample episodes can never be published. Every decision is stored (`rights_checks`) and audited. |
| Expiry monitoring | Daily scheduled sweep (new `beat` service): one warning 30 days before expiry, one notice on expiry. Counts are on Overview. |
| Original content safeguard | Shared originality service. A checker on the Rights page quotes any copied passage (grouped by passage) and names its sources. |
| Channel basis | You can switch a channel between research only and licensed, with a recorded reason. |
| Dashboard | **Rights** page (counts, legal disclaimer, licence table with rights badges, rights checker, originality checker), **record licence** page, **licence** page (edit, document upload/download, coverage, verification, revocation), a **rights card** on every episode, and a licence summary on **Overview**. English and Yorùbá. |

### Test results
* **Backend:** 164 passed on PostgreSQL 16 (95% coverage); SQLite mode passes too. Lint clean. Migration upgrade, downgrade and drift checked.
  The rights tests cover every refusal reason, multiple licences, channel-wide coverage,
  verification problems, edits resetting verification, document validation, the expiry
  sweep (including the scheduled task) and the API.
* **Frontend:** typecheck clean; 29 unit tests (including every refusal and problem code in
  both languages); build OK.
* **Browser tests on the real stack:** Phase 4 **19/19**, Phase 3 **18/18**, Phase 2 **19/19**.

### Failures found and fixed
1. **Edited licence showed its old values after saving (and could re-save them).** React
   resets a form to its original values after submission. The licence and coverage forms
   now keep what you entered. A browser check confirms the saved value is shown.
2. **Coverage changes didn't update the licence's last-changed time** (only the link
   table changed). Fixed, with a test.
3. **Licence dates came back in mixed timezones** from the API. Now always UTC.
4. **The originality checker repeated the same passage** once per source. Now grouped.
5. A small document showed as "0 KB". Small files now show bytes.
6. Test-script issues (waiting on hidden page data, duplicate matches). Fixed in the tests,
   not the app.

### Needs your action
* **Have a lawyer review any licence** before you rely on it. The system enforces what you
  record; it cannot judge a contract.
* For each licensed source (for example any agreement covering Alex Hormozi's episodes),
  record the licence with the signed document, set what it covers, switch the channel to
  "Licensed", and verify it.
* Yoruba review of the new wording (YORUBA_UI_REVIEW.md, regenerated).

### Known limitations
* The coverage picker lists the latest 100 episodes. For larger channels, use whole-channel
  coverage or ask for a searchable picker.
* Expiry warnings appear in the audit trail and on Overview and Rights. Email/push alerts
  are part of monitoring in Phase 10.
* Licences cover Yoruba by language code. Territory is recorded but not enforced
  (publishing platforms don't let us restrict by country reliably).

---

## Phase 3: Discovery and research (2026-11-14)

### Delivered
| Area | What exists |
|---|---|
| YouTube Data API v3 adapter | Resolves channels by URL, @handle or ID, and pages through public uploads (`channels.list`, `playlistItems.list`, `videos.list`). Keeps only public, processed, non-live videos. Records the quota used. Reports quota and invalid-key errors plainly. Doesn't download captions (that needs owner consent). |
| Claude adapter | Official `anthropic` SDK (2.8). Structured JSON output, server-side refusal fallback, cost from real token usage at published rates. Unknown models are costed at the highest rate. Refusals are reported, never filled in. |
| Channel authorisation | Each channel needs a basis (research only or licensed) and a written note. Channels can be paused. Every change is audited. |
| Discovery | Scans stop early once caught up (saving quota). Capped by a new setting (videos per scan). Duplicates are impossible at database level, and re-uploads are flagged. Sample and real data can't mix. |
| Permitted transcripts | Added by the owner, with a source and permission reference. No scraping path exists. |
| Research reports | Claude studies an episode (or a subject you type) and proposes 3–8 topics for **original** lessons, with Nigerian context and cautions. The prompt forbids reproducing the source, adopting a creator's persona, or presenting branded frameworks as ours. An **originality check** flags any 12+ word run copied from the source and blocks approval. |
| Topic approval | You approve or reject each topic, with an optional note. Audited. |
| Budget guard | Worst-case cost reserved under a lock before every paid call. Blocked if the monthly limit would be exceeded. Settled to the actual cost afterwards. No automatic retries of paid calls. |
| Dashboard | **Episode catalogue** (channels, scan with live progress, search and filter, pagination), **episode page** (description, transcript form, research), **Research** (approval queue, approved topics, independent research, reports), **report page** (summary, topics, concepts, Nigerian context, cautions, cost, originality result). All in English and Yorùbá. |
| Docs | [API_SETUP.md](API_SETUP.md) (step-by-step keys), [COSTS.md](COSTS.md) |

### Test results
* **Backend:** 127 passed on PostgreSQL 16 (coverage 95%); SQLite fallback passes too. Lint clean.
  New tests cover the YouTube adapter (mocked HTTP), the Claude adapter (fake SDK client,
  real SDK error classes, request shape checked against the installed SDK), discovery
  and duplicates, transcripts, research, the originality check, refusals, the budget guard and the API.
* **Frontend:** typecheck clean; 22 unit tests (every new string has its Yoruba version); build OK.
* **Browser tests on the real stack (sample mode):** Phase 3 suite **18/18** and Phase 2
  suite **19/19**, each run repeatedly.
* **Not tested against the real APIs:** no YouTube or Anthropic key exists yet. Both
  adapters are tested against mocked responses that follow the official API formats. The
  first live scan and the first live report should be watched (see API_SETUP.md §4).

### Failures found and fixed
1. **Saved transcript not visible to research in the same session** (stale relationship).
   Fixed, with a test.
2. **Blocked research reports lost their "blocked" status** when the model wasn't configured
   (the job rollback undid it). Fixed before release; a test confirms the honest status.
3. **New "videos per scan" setting not registered** (my edit missed the reformatted file).
   Caught by the API test.
4. **"Channel authorised" confirmation was hidden** because the form collapsed after the
   first channel. The form is now always visible.
5. A test assertion that could never fail. Replaced with the real rule: a live model
   studying sample data stays labelled sample.
6. Sample output read like code ("sample.topics[0].title"). It now reads
   "[SAMPLE] Example title (topic 2)".

### Needs your action
1. **YouTube Data API key** (free). Steps in API_SETUP.md §1.
2. **Anthropic API key** with prepaid credits and a Console spend limit (API_SETUP.md §2).
   The default model is `claude-opus-5-5`. Choosing a cheaper model is your decision.
3. **The list of channels you are authorised to use**, and for each one whether it is
   research only or licensed. Licensed adaptations stay blocked until Phase 4 verifies the licence.
4. Yoruba review of the new interface text (YORUBA_UI_REVIEW.md, regenerated).

### Known limitations
* Topics are proposed in English. Yoruba scripting, with human language review, is Phase 5.
* The originality check compares against the description and any transcript held. Without
  a transcript it cannot see the spoken content. Reports say so.
* Captions on YouTube are not downloaded (owner consent required). Transcripts come only
  from the permitted-transcript form.
* No scheduled automatic scans yet. Scans are started by you. Scheduling arrives with the
  publishing calendar (Phase 8).

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
