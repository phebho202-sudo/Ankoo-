# Empire Studio AI

Production dashboard for the YouTube channel **Behind the Fortune**. This is Phase 1: the foundation.
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
| Script Studio | Write scripts, with a live word count and estimated running time against the 45-minute target |
| Voice Studio | Narration segments per video and their status |
| Visual Studio | Scenes and visual prompts per video and their status |
| Video Production | Each video's five stages (script, voice, visuals, edit, thumbnail). When all are done, "Send for approval" |
| Thumbnail Studio | Thumbnail concepts with a headline mock-up |
| Upload Manager | Approval queue and publishing record. You upload to YouTube yourself, then mark it published here |
| YouTube Analytics | Monthly numbers you type in from YouTube Studio, with charts |
| Monetization Tracker | Progress toward your subscriber and watch-hour goals, and revenue |
| Settings | Channel settings, demo data controls |

## Demo data

The first time you start the studio it loads sample records so the screens are not empty.
Every sample record carries a **DEMO** badge. The numbers and notes are invented, not real research or real channel statistics.
Remove them all in **Settings → Demo data → Remove demo data**. Records you create yourself are never removed by that button.

## Where your data is

Everything is saved in one file: `empire-studio/data/empire.db`. It is created on first start and is not uploaded to GitHub.
To back up your studio, stop the app and copy that file somewhere safe.

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
