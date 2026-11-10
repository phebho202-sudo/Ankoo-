# Empire Studio AI

Production dashboard for the YouTube channel **Behind the Fortune**. Phase 1 built the foundation, Phase 2 added the production tools, and Phase 3 added the free AI prompt workflow.
It runs entirely on your own computer. It does not connect to YouTube, does not use any paid service, and publishes nothing.

It lives in its own folder (`empire-studio/`) so it does not touch the Ankoo app in the rest of this repository.

## What you need

**Node.js version 22.5 or newer.** Nothing else. There are no packages to install: the database (SQLite) is built into Node.js.

Check your version by typing this in a terminal:

```bash
node -v
```

If it prints `v22.5.0` or higher, you are ready. If not, install the "LTS" version from https://nodejs.org.

## Run it

1. Open a terminal in the project folder, then move into the studio folder (`cd` means "change directory"):

   ```bash
   cd empire-studio
   ```

2. Start the studio (`npm start` runs the start command saved in `package.json`):

   ```bash
   npm start
   ```

3. Open **http://localhost:4000** in your browser.

To stop it, click the terminal window and press `Ctrl + C`. Your data is kept; start it again any time.

If port 4000 is busy, start on another one: `PORT=4001 npm start` (Mac/Linux) or `set PORT=4001 && npm start` (Windows).

## Check that everything works

```bash
npm test
```

This runs the automated checks against a temporary database. Your real data is not touched.

## The sections

| Section | What it does |
|---|---|
| Overview | Channel name, documentaries produced, videos published, awaiting approval, upcoming, production progress, publishing schedule, monetization progress |
| Topic Research | Add, score, filter, approve or reject ideas. "Start production" turns an approved topic into a production job |
| Content Calendar | Month view of everything scheduled. Click a day to schedule a video, click an entry to edit it |
| Research Library | Sources and notes per topic, with a credibility rating |
| Script Studio | Write scripts with a live word count and running time. Insert a 45-minute documentary structure, see each section's timestamp, download the script, and turn its sections into narration segments or a scene list in one click |
| Voice Studio | Narration segments with their text, length and status. "Preview" reads a segment aloud using the free voice built into your browser. Download all narration for a video as one file |
| Visual Studio | Scenes and prompts per video. Copy a prompt, or download all prompts for a video |
| Video Production | Each video's five stages (script, voice, visuals, edit, thumbnail). When all are done, "Send for approval" |
| Thumbnail Studio | Thumbnail concepts with a headline mock-up |
| Upload Manager | Approval queue and publishing record. "Publishing pack" drafts the title, description, chapters and tags for you to copy into YouTube. You upload to YouTube yourself, then mark it published here |
| YouTube Analytics | Monthly numbers you type in from YouTube Studio, with charts |
| Monetization Tracker | Progress toward your subscriber and watch-hour goals, and revenue |
| Settings | Channel settings, demo data controls, backup download |

## The free AI workflow

The studio never calls an AI service and needs no account or key. It writes the prompts; you carry them to a free AI chat (ChatGPT, Claude or Gemini) and bring the answers back.

- **Topic Research → AI topic ideas:** copy the prompt, paste the AI's answer back, and the ideas are imported as topics.
- **Script Studio → AI assistant:** work through the steps in order: research brief, outline, each section of the script, fact-check, titles and thumbnails, Shorts. Each prompt is built from your channel settings, the topic, your research notes and the script so far.
- Research briefs and fact-checks are saved to the Research Library as **unverified**. Facts the AI is unsure of are marked `[VERIFY]`, and Script Studio counts how many are left.

AI drafts contain mistakes. Check the facts against real sources and rewrite in your own words before recording.

## Writing a script that the tools understand

- Put each section heading on its own line in CAPITALS, for example `ACT 1 - THE ORIGIN`.
- Lines wholly inside `[square brackets]` are notes to yourself. They are not narrated and not counted.
- Everything else is narration.

"Insert documentary structure" in Script Studio sets this up for you.

## Updating to a newer version

Your studio data lives in the `data` folder inside `empire-studio`. To update without losing it:

1. Stop the studio (`Ctrl + C` in its window).
2. Download and unzip the new version.
3. Copy the `data` folder from your old `empire-studio` folder into the new `empire-studio` folder.
4. Start the studio from the new folder with `npm start`. The database upgrades itself.

## Demo data

The first time you start the studio it loads sample records so the screens are not empty.
Every sample record carries a **DEMO** badge. The numbers and notes are invented, not real research or real channel statistics.
Remove them all in **Settings → Demo data → Remove demo data**. Records you create yourself are never removed by that button.

## Where your data is

Everything is saved in one file: `empire-studio/data/empire.db`. It is created on first start and is not uploaded to GitHub.
To back up your studio, use **Settings → Backup → Download backup file**, or stop the app and copy that file somewhere safe.

Tables: `settings`, `topics`, `research`, `scripts`, `jobs` (production jobs), `assets` (voice segments, scenes, thumbnail concepts), `publishing`, `metrics`.

## Files

```
empire-studio/
  package.json      the start and test commands
  src/server.js     the local web server and API
  src/db.js         database tables and validation rules
  src/seed.js       the demo data
  public/           the dashboard itself (index.html, styles.css, app.js)
  test/             automated checks
```
