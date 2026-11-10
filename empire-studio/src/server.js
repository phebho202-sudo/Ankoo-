'use strict';
// Empire Studio AI - local web server.
// Serves the dashboard (files in /public) and a small JSON API backed by SQLite.
// No external services are contacted: no YouTube, no paid APIs.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase, TABLES, ValidationError, jobProgress } = require('./db');
const { seedDemo } = require('./seed');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

function todayIn(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function overview(db) {
  const settings = db.getSettings();
  const today = todayIn(settings.timezone);
  const jobs = db.list('jobs').map((j) => ({ ...j, progress: jobProgress(j) }));
  const publishing = db.list('publishing');
  const metrics = db.list('metrics');
  const sum = (rows, f) => rows.reduce((n, r) => n + (Number(r[f]) || 0), 0);
  const last12 = metrics.slice(-12);
  const upcoming = publishing.filter((p) => p.status === 'scheduled' && p.publish_date >= today);
  return {
    today,
    settings,
    has_demo: db.demoCount() > 0,
    stats: {
      documentaries_produced: jobs.filter((j) => j.format === 'documentary' && j.progress === 100).length,
      videos_published: publishing.filter((p) => p.status === 'published').length,
      awaiting_approval: publishing.filter((p) => p.status === 'awaiting_approval').length,
      upcoming_scheduled: upcoming.length,
      topics_in_pipeline: db.list('topics').filter((t) => t.status !== 'rejected').length,
    },
    production: jobs.filter((j) => j.progress < 100),
    schedule: publishing.filter((p) => p.status !== 'published' && p.publish_date >= today).slice(0, 8),
    monetization: {
      subscribers: sum(metrics, 'subscribers_gained'),
      subscribers_goal: Number(settings.subscribers_goal),
      watch_hours_12m: Math.round(sum(last12, 'watch_hours')),
      watch_hours_goal: Number(settings.watch_hours_goal),
      revenue_usd: Math.round(sum(metrics, 'revenue_usd') * 100) / 100,
      total_views: sum(metrics, 'views'),
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2_000_000) { reject(new ValidationError('Request is too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
        resolve(data);
      } catch { reject(new ValidationError('Request body must be a JSON object')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: 'Not found' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

async function handleApi(db, req, res, parts) {
  const [resource, idPart, extra] = parts;
  const method = req.method;

  if (resource === 'health' && method === 'GET') return send(res, 200, { ok: true });
  if (resource === 'overview' && method === 'GET') return send(res, 200, overview(db));

  if (resource === 'export' && method === 'GET' && !idPart) {
    // A full copy of the studio as one file, for backups.
    const backup = { app: 'empire-studio-ai', exported_at: new Date().toISOString(), settings: db.getSettings(), tables: {} };
    for (const table of Object.keys(TABLES)) backup.tables[table] = db.list(table);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="empire-studio-backup-${todayIn(backup.settings.timezone)}.json"`,
      'Cache-Control': 'no-store',
    });
    return res.end(JSON.stringify(backup, null, 2));
  }

  if (resource === 'settings' && !idPart) {
    if (method === 'GET') return send(res, 200, db.getSettings());
    if (method === 'PUT') return send(res, 200, db.saveSettings(await readBody(req)));
  }

  if (resource === 'demo' && method === 'POST' && !extra) {
    if (idPart === 'clear') { db.clearDemo(); return send(res, 200, { ok: true }); }
    if (idPart === 'restore') {
      db.clearDemo();
      const settings = db.getSettings();
      seedDemo(db, todayIn(settings.timezone), settings);
      return send(res, 200, { ok: true });
    }
  }

  if (Object.hasOwn(TABLES, resource) && !extra) {
    if (!idPart) {
      if (method === 'GET') {
        const rows = db.list(resource);
        return send(res, 200, resource === 'jobs' ? rows.map((j) => ({ ...j, progress: jobProgress(j) })) : rows);
      }
      if (method === 'POST') return send(res, 201, db.insert(resource, await readBody(req)));
    } else if (/^\d+$/.test(idPart)) {
      const id = Number(idPart);
      if (method === 'PUT') {
        const row = db.update(resource, id, await readBody(req));
        return row ? send(res, 200, row) : send(res, 404, { error: 'Record not found' });
      }
      if (method === 'DELETE') return db.remove(resource, id) ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Record not found' });
    }
  }
  return send(res, 404, { error: 'Not found' });
}

function createApp({ dbPath, seed = true } = {}) {
  const db = openDatabase(dbPath || process.env.EMPIRE_DB_PATH || path.join(__dirname, '..', 'data', 'empire.db'));
  if (db.firstRun && seed) {
    const settings = db.getSettings();
    seedDemo(db, todayIn(settings.timezone), settings);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname.startsWith('/api/')) {
        // Only this computer's own browser pages may change data.
        if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
          return send(res, 403, { error: 'Forbidden' });
        }
        return await handleApi(db, req, res, pathname.slice(5).split('/').filter(Boolean));
      }
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res, pathname);
    } catch (err) {
      if (err instanceof ValidationError) return send(res, 400, { error: err.message });
      console.error(err);
      return send(res, 500, { error: 'Something went wrong on the server. Check the terminal window for details.' });
    }
  });
  return { server, db };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '127.0.0.1'; // only reachable from this computer
  const { server } = createApp();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${port} is already in use. Close the other program, or start on another port:\n  PORT=4001 npm start   (Mac/Linux)\n  set PORT=4001 && npm start   (Windows)\n`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, host, () => {
    console.log(`\n  Empire Studio AI is running.\n  Open this address in your browser:  http://localhost:${port}\n\n  To stop it, press Ctrl + C in this window.\n`);
  });
}

module.exports = { createApp };
