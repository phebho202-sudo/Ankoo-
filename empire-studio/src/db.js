'use strict';
// Database layer for Empire Studio AI.
// Uses SQLite, which is built into Node.js 22.5+, so there is nothing to install.
// Everything is stored in one file on disk (data/empire.db) and survives restarts.

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const STAGE = ['not_started', 'in_progress', 'done'];
const STAGE_FIELDS = ['script_status', 'voice_status', 'visuals_status', 'edit_status', 'thumbnail_status'];

// One entry per table: which columns the app may write, and what each must look like.
const TABLES = {
  topics: {
    order: 'potential_score DESC, id DESC',
    fields: {
      title: { type: 'text', required: true, max: 200 },
      category: { type: 'enum', values: ['Billionaires', 'Corporate Empires', 'Luxury Brands', 'Wealth Psychology', 'Business History'], default: 'Corporate Empires' },
      angle: { type: 'text', max: 1000 },
      potential_score: { type: 'int', min: 0, max: 100, default: 50 },
      status: { type: 'enum', values: ['idea', 'shortlisted', 'approved', 'in_production', 'rejected'], default: 'idea' },
      notes: { type: 'text', max: 5000 },
    },
  },
  research: {
    order: 'id DESC',
    fields: {
      topic_id: { type: 'ref', table: 'topics' },
      title: { type: 'text', required: true, max: 200 },
      source_type: { type: 'enum', values: ['article', 'book', 'company filing', 'interview', 'video', 'report', 'other'], default: 'article' },
      source_url: { type: 'text', max: 1000 },
      summary: { type: 'text', max: 20000 },
      credibility: { type: 'enum', values: ['high', 'medium', 'low', 'unverified'], default: 'unverified' },
    },
  },
  scripts: {
    order: 'updated_at DESC, id DESC',
    fields: {
      topic_id: { type: 'ref', table: 'topics' },
      title: { type: 'text', required: true, max: 200 },
      content: { type: 'text', max: 400000 },
      status: { type: 'enum', values: ['outline', 'draft', 'in_review', 'approved'], default: 'outline' },
    },
  },
  jobs: {
    order: 'id DESC',
    fields: {
      topic_id: { type: 'ref', table: 'topics' },
      title: { type: 'text', required: true, max: 200 },
      format: { type: 'enum', values: ['documentary', 'short'], default: 'documentary' },
      script_status: { type: 'enum', values: STAGE, default: 'not_started' },
      voice_status: { type: 'enum', values: STAGE, default: 'not_started' },
      visuals_status: { type: 'enum', values: STAGE, default: 'not_started' },
      edit_status: { type: 'enum', values: STAGE, default: 'not_started' },
      thumbnail_status: { type: 'enum', values: STAGE, default: 'not_started' },
      notes: { type: 'text', max: 5000 },
    },
  },
  assets: {
    order: 'job_id DESC, id ASC',
    fields: {
      job_id: { type: 'ref', table: 'jobs' },
      kind: { type: 'enum', values: ['voice', 'visual', 'thumbnail'], required: true },
      name: { type: 'text', required: true, max: 200 },
      details: { type: 'text', max: 5000 },
      status: { type: 'enum', values: ['planned', 'in_progress', 'ready', 'approved'], default: 'planned' },
    },
  },
  publishing: {
    order: 'publish_date ASC, publish_time ASC, id ASC',
    fields: {
      job_id: { type: 'ref', table: 'jobs' },
      title: { type: 'text', required: true, max: 200 },
      format: { type: 'enum', values: ['documentary', 'short'], default: 'documentary' },
      publish_date: { type: 'date', required: true },
      publish_time: { type: 'time', required: true },
      status: { type: 'enum', values: ['awaiting_approval', 'scheduled', 'published'], default: 'awaiting_approval' },
      youtube_url: { type: 'text', max: 500 },
      notes: { type: 'text', max: 5000 },
    },
  },
  metrics: {
    order: 'month ASC',
    fields: {
      month: { type: 'month', required: true },
      views: { type: 'int', min: 0, default: 0 },
      watch_hours: { type: 'num', min: 0, default: 0 },
      subscribers_gained: { type: 'int', default: 0 },
      revenue_usd: { type: 'num', min: 0, default: 0 },
    },
  },
};

const DEFAULT_SETTINGS = {
  channel_name: 'Behind the Fortune',
  niche: 'Business documentaries, billionaires, wealth psychology, luxury brands and corporate empires',
  language: 'English',
  narration: 'Professional male documentary narrator',
  video_duration_minutes: '45',
  visual_style: 'AI-assisted cinematic documentary',
  timezone: 'Africa/Lagos',
  main_publish_time: '19:00',
  shorts_publish_time: '17:00',
  target: 'Build a sustainable, monetizable YouTube media business',
  words_per_minute: '150',
  subscribers_goal: '1000',
  watch_hours_goal: '4000',
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT, angle TEXT,
  potential_score INTEGER DEFAULT 50, status TEXT DEFAULT 'idea', notes TEXT,
  is_demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS research (
  id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL, source_type TEXT, source_url TEXT, summary TEXT, credibility TEXT,
  is_demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL, content TEXT, status TEXT DEFAULT 'outline',
  is_demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL, format TEXT DEFAULT 'documentary',
  script_status TEXT DEFAULT 'not_started', voice_status TEXT DEFAULT 'not_started',
  visuals_status TEXT DEFAULT 'not_started', edit_status TEXT DEFAULT 'not_started',
  thumbnail_status TEXT DEFAULT 'not_started', notes TEXT,
  is_demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, name TEXT NOT NULL, details TEXT, status TEXT DEFAULT 'planned',
  is_demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS publishing (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL, format TEXT DEFAULT 'documentary', publish_date TEXT NOT NULL,
  publish_time TEXT NOT NULL, status TEXT DEFAULT 'awaiting_approval', youtube_url TEXT, notes TEXT,
  is_demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT NOT NULL UNIQUE, views INTEGER DEFAULT 0,
  watch_hours REAL DEFAULT 0, subscribers_gained INTEGER DEFAULT 0, revenue_usd REAL DEFAULT 0,
  is_demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
`;

class ValidationError extends Error {}

function clean(table, input, partial) {
  const out = {};
  for (const [name, spec] of Object.entries(TABLES[table].fields)) {
    let v = input[name];
    if (v === undefined) {
      if (partial) continue;
      v = spec.default ?? null;
    }
    if (v === '' || v === null) {
      if (spec.required) throw new ValidationError(`"${name}" is required`);
      out[name] = spec.type === 'text' ? '' : (spec.default ?? null);
      continue;
    }
    switch (spec.type) {
      case 'text':
        v = String(v).trim();
        if (spec.required && !v) throw new ValidationError(`"${name}" is required`);
        if (v.length > spec.max) throw new ValidationError(`"${name}" is too long (max ${spec.max} characters)`);
        break;
      case 'int': case 'num': case 'ref':
        v = Number(v);
        if (!Number.isFinite(v) || (spec.type !== 'num' && !Number.isInteger(v))) throw new ValidationError(`"${name}" must be a number`);
        if (spec.min !== undefined && v < spec.min) throw new ValidationError(`"${name}" must be at least ${spec.min}`);
        if (spec.max !== undefined && v > spec.max) throw new ValidationError(`"${name}" must be at most ${spec.max}`);
        break;
      case 'enum':
        if (!spec.values.includes(v)) throw new ValidationError(`"${name}" must be one of: ${spec.values.join(', ')}`);
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new ValidationError(`"${name}" must be a date like 2026-01-31`);
        break;
      case 'time':
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new ValidationError(`"${name}" must be a time like 19:00`);
        break;
      case 'month':
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new ValidationError(`"${name}" must be a month like 2026-01`);
        break;
    }
    out[name] = v;
  }
  return out;
}

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const firstRun = db.prepare('SELECT COUNT(*) AS n FROM settings').get().n === 0;
  const putSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const addSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) addSetting.run(k, v);

  const api = {
    raw: db,
    firstRun,
    close: () => db.close(),

    getSettings() {
      const out = {};
      for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
      return out;
    },
    saveSettings(input) {
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (input[key] === undefined) continue;
        const value = String(input[key]).trim();
        if (!value) throw new ValidationError(`"${key}" cannot be empty`);
        if (value.length > 500) throw new ValidationError(`"${key}" is too long`);
        if (key.endsWith('_time') && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new ValidationError(`"${key}" must be a time like 19:00`);
        if (['video_duration_minutes', 'words_per_minute', 'subscribers_goal', 'watch_hours_goal'].includes(key) && !(Number(value) > 0)) throw new ValidationError(`"${key}" must be a number above zero`);
        if (key === 'timezone') {
          try { new Intl.DateTimeFormat('en', { timeZone: value }); } catch { throw new ValidationError('Unknown timezone. Example: Africa/Lagos'); }
        }
        putSetting.run(key, value);
      }
      return api.getSettings();
    },

    list(table) {
      return db.prepare(`SELECT * FROM ${table} ORDER BY ${TABLES[table].order}`).all();
    },
    get(table, id) {
      return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    },
    checkRefs(table, row) {
      for (const [name, spec] of Object.entries(TABLES[table].fields)) {
        if (spec.type === 'ref' && row[name] != null && !api.get(spec.table, row[name])) {
          throw new ValidationError(`"${name}" points to a record that does not exist`);
        }
      }
    },
    insert(table, input, isDemo = 0) {
      const row = clean(table, input, false);
      api.checkRefs(table, row);
      const now = new Date().toISOString();
      const cols = [...Object.keys(row), 'is_demo', 'created_at', 'updated_at'];
      try {
        const res = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
          .run(...Object.values(row), isDemo ? 1 : 0, now, now);
        return api.get(table, Number(res.lastInsertRowid));
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) throw new ValidationError('A record for that month already exists. Edit it instead.');
        throw e;
      }
    },
    update(table, id, input) {
      if (!api.get(table, id)) return null;
      const row = clean(table, input, true);
      api.checkRefs(table, row);
      const cols = Object.keys(row);
      if (cols.length) {
        try {
          db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
            .run(...Object.values(row), new Date().toISOString(), id);
        } catch (e) {
          if (String(e.message).includes('UNIQUE')) throw new ValidationError('A record for that month already exists.');
          throw e;
        }
      }
      return api.get(table, id);
    },
    remove(table, id) {
      return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
    },

    demoCount() {
      return Object.keys(TABLES).reduce((n, t) => n + db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE is_demo = 1`).get().n, 0);
    },
    clearDemo() {
      // Children first so nothing is left pointing at a deleted parent.
      for (const t of ['assets', 'publishing', 'metrics', 'scripts', 'research', 'jobs', 'topics']) {
        db.prepare(`DELETE FROM ${t} WHERE is_demo = 1`).run();
      }
    },
  };
  return api;
}

function jobProgress(job) {
  const points = STAGE_FIELDS.reduce((n, f) => n + (job[f] === 'done' ? 1 : job[f] === 'in_progress' ? 0.5 : 0), 0);
  return Math.round((points / STAGE_FIELDS.length) * 100);
}

module.exports = { openDatabase, TABLES, STAGE_FIELDS, DEFAULT_SETTINGS, ValidationError, jobProgress };
