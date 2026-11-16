# Phase status

| Phase | Status |
|---|---|
| 1. Project foundation | Complete. Approved 2026-11-14. |
| 2. Brand and administration | Complete. Approved 2026-11-14. |
| 3. Discovery and research | Complete in sample mode. Approved 2026-11-14 (API keys pending). |
| 4. Rights management | Complete. Approved 2026-11-16. |
| 5. Yoruba content engine | Complete in sample mode. Approved 2026-11-16. |
| 6. Voice and avatar | **Complete in sample mode. Awaiting owner approval and an ElevenLabs account.** |
| 7. Video production | Not started |
| 8. Publishing | Not started |
| 9. Monetisation | Not started |
| 10. Deployment | Not started |

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
