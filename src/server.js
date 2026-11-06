'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const auth = require('./auth');
const billing = require('./billing');
const tax = require('./tax');
const report = require('./report');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const FREE_ENTRIES_PER_MONTH = Number(process.env.FREE_ENTRIES_PER_MONTH || 60);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json' : 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function toKobo(naira) {
  const n = Number(naira);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) throw new HttpError(400, 'Enter a valid amount');
  return Math.round(n * 100);
}

function validDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d)) || Number.isNaN(Date.parse(d))) throw new HttpError(400, 'Invalid date');
  return d;
}

function str(v, max = 200) { return String(v ?? '').trim().slice(0, max); }

function publicUser(u) {
  return {
    id: u.id, email: u.email, phone: u.phone, business_name: u.business_name,
    business_type: u.business_type, professional_services: Boolean(u.professional_services),
    fixed_assets: u.fixed_assets_kobo / 100, referral_code: u.referral_code,
    pro: billing.isPro(u), pro_until: u.pro_until,
  };
}

function baseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  return `http://${req.headers.host}`;
}

function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `ankoo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function isAdmin(user) {
  const admins = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return Boolean(user && admins.includes(user.email));
}

function yearEntries(db, userId, year) {
  return db.prepare('SELECT * FROM entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date')
    .all(userId, `${year}-01-01`, `${year}-12-31`);
}

function createApp(db) {
  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const p = url.pathname;
    const method = req.method;
    const cookies = parseCookies(req);
    const user = auth.userFromToken(db, cookies.ankoo_session);

    let raw = Buffer.alloc(0);
    let body = {};
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      raw = await readBody(req);
      if (p.startsWith('/api/')) {
        // JSON-only API: blocks cross-site form posts (CSRF) along with SameSite cookies.
        if (raw.length && !String(req.headers['content-type'] || '').includes('application/json')) {
          throw new HttpError(415, 'Use application/json');
        }
        try { body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch { throw new HttpError(400, 'Bad JSON'); }
      }
    }

    const needUser = () => { if (!user) throw new HttpError(401, 'Please log in'); return user; };
    const needPro = () => { needUser(); if (!billing.isPro(user)) throw new HttpError(402, 'This is a Pro feature. Upgrade for ₦1,500/month.'); return user; };

    // ---------- Auth ----------
    if (method === 'POST' && p === '/api/signup') {
      const ip = req.socket.remoteAddress;
      if (auth.rateLimited(`signup:${ip}`, 20)) throw new HttpError(429, 'Too many attempts. Try later.');
      const email = str(body.email, 120).toLowerCase();
      const password = String(body.password || '');
      const business = str(body.business_name, 100);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
      if (!business) throw new HttpError(400, 'Enter your business name');
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'Email already registered');
      let referredBy = null;
      if (body.ref) {
        const agent = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(str(body.ref, 20).toUpperCase());
        if (agent) referredBy = agent.id;
      }
      let code;
      do { code = auth.referralCode(); } while (db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code));
      const businessType = body.business_type === 'company' ? 'company' : 'individual';
      const info = db.prepare(
        `INSERT INTO users (email, phone, business_name, business_type, password_hash, referral_code, referred_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(email, str(body.phone, 20), business, businessType, auth.hashPassword(password), code, referredBy);
      const token = auth.createSession(db, info.lastInsertRowid);
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      return send(res, 201, { user: publicUser(u) }, { 'Set-Cookie': sessionCookie(token, 30 * 86400) });
    }

    if (method === 'POST' && p === '/api/login') {
      const email = str(body.email, 120).toLowerCase();
      if (auth.rateLimited(`login:${email}`)) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
      const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!u || !auth.verifyPassword(String(body.password || ''), u.password_hash)) throw new HttpError(401, 'Wrong email or password');
      const token = auth.createSession(db, u.id);
      return send(res, 200, { user: publicUser(u) }, { 'Set-Cookie': sessionCookie(token, 30 * 86400) });
    }

    if (method === 'POST' && p === '/api/logout') {
      if (cookies.ankoo_session) auth.destroySession(db, cookies.ankoo_session);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    if (method === 'GET' && p === '/api/me') {
      if (!user) return send(res, 200, { user: null });
      return send(res, 200, { user: { ...publicUser(user), admin: isAdmin(user) }, plans: billing.PLANS });
    }

    if (method === 'POST' && p === '/api/profile') {
      needUser();
      const businessType = body.business_type === 'company' ? 'company' : 'individual';
      const fixed = body.fixed_assets ? Math.round(Number(body.fixed_assets) * 100) : 0;
      if (!Number.isFinite(fixed) || fixed < 0) throw new HttpError(400, 'Invalid fixed assets value');
      db.prepare(`UPDATE users SET business_name = COALESCE(NULLIF(?, ''), business_name), phone = ?,
        business_type = ?, professional_services = ?, fixed_assets_kobo = ? WHERE id = ?`)
        .run(str(body.business_name, 100), str(body.phone, 20), businessType, body.professional_services ? 1 : 0, fixed, user.id);
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      return send(res, 200, { user: publicUser(u) });
    }

    // ---------- Entries (sales & expenses) ----------
    if (method === 'GET' && p === '/api/entries') {
      needUser();
      const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : new Date().toISOString().slice(0, 7);
      const rows = db.prepare('SELECT * FROM entries WHERE user_id = ? AND date LIKE ? ORDER BY date DESC, id DESC')
        .all(user.id, `${month}-%`);
      return send(res, 200, { month, entries: rows.map((r) => ({ ...r, amount: r.amount_kobo / 100 })) });
    }

    if (method === 'POST' && p === '/api/entries') {
      needUser();
      const kind = body.kind === 'expense' ? 'expense' : body.kind === 'sale' ? 'sale' : null;
      if (!kind) throw new HttpError(400, 'Choose sale or expense');
      const amount = toKobo(body.amount);
      const date = validDate(body.date || new Date().toISOString().slice(0, 10));
      const clientId = body.client_id ? str(body.client_id, 64) : null;
      if (clientId) {
        const existing = db.prepare('SELECT * FROM entries WHERE user_id = ? AND client_id = ?').get(user.id, clientId);
        if (existing) return send(res, 200, { entry: existing, duplicate: true });
      }
      if (!billing.isPro(user)) {
        const n = db.prepare('SELECT COUNT(*) AS n FROM entries WHERE user_id = ? AND date LIKE ?').get(user.id, `${date.slice(0, 7)}-%`).n;
        if (n >= FREE_ENTRIES_PER_MONTH) throw new HttpError(402, `Free plan allows ${FREE_ENTRIES_PER_MONTH} records per month. Upgrade to Pro for unlimited records.`);
      }
      const info = db.prepare(`INSERT INTO entries (user_id, client_id, kind, amount_kobo, category, method, note, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(user.id, clientId, kind, amount, str(body.category, 50), str(body.method, 20) || 'cash', str(body.note, 200), date);
      const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid);
      return send(res, 201, { entry });
    }

    let m;
    if (method === 'DELETE' && (m = p.match(/^\/api\/entries\/(\d+)$/))) {
      needUser();
      const changes = db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').run(Number(m[1]), user.id).changes;
      if (!changes) throw new HttpError(404, 'Not found');
      return send(res, 200, { ok: true });
    }

    // ---------- Summary & tax ----------
    if (method === 'GET' && p === '/api/summary') {
      needUser();
      const year = Number(url.searchParams.get('year')) || new Date().getUTCFullYear();
      const rows = yearEntries(db, user.id, year);
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);
      const t = tax.summarise(rows.filter((r) => r.date === today));
      const mo = tax.summarise(rows.filter((r) => r.date.startsWith(month)));
      const assessment = tax.assess(rows, user);
      const debts = db.prepare('SELECT COALESCE(SUM(amount_kobo),0) AS s, COUNT(*) AS n FROM debts WHERE user_id = ? AND paid_at IS NULL').get(user.id);
      return send(res, 200, {
        year, today: { sales: t.sales, expenses: t.expenses, profit: t.profit },
        month: { sales: mo.sales, expenses: mo.expenses, profit: mo.profit },
        tax: assessment, owed_to_you: debts.s / 100, debtors: debts.n,
      });
    }

    if (method === 'GET' && p === '/report') {
      if (!user) return send(res, 302, '', { Location: '/' });
      if (!billing.isPro(user)) return send(res, 402, report.upsell());
      const year = Number(url.searchParams.get('year')) || new Date().getUTCFullYear();
      return send(res, 200, report.render(user, year, tax.assess(yearEntries(db, user.id, year), user)));
    }

    if (method === 'GET' && p === '/api/export.csv') {
      needPro();
      const year = Number(url.searchParams.get('year')) || new Date().getUTCFullYear();
      const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = ['date,type,amount_naira,category,method,note'];
      for (const r of yearEntries(db, user.id, year)) {
        lines.push([r.date, r.kind, (r.amount_kobo / 100).toFixed(2), esc(r.category), esc(r.method), esc(r.note)].join(','));
      }
      return send(res, 200, lines.join('\n'), {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ankoo-${year}.csv"`,
      });
    }

    // ---------- Debts (credit book) ----------
    if (method === 'GET' && p === '/api/debts') {
      needUser();
      const rows = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY paid_at IS NOT NULL, due_date, id DESC').all(user.id);
      return send(res, 200, { debts: rows.map((r) => ({ ...r, amount: r.amount_kobo / 100 })) });
    }

    if (method === 'POST' && p === '/api/debts') {
      needUser();
      const customer = str(body.customer, 80);
      if (!customer) throw new HttpError(400, 'Enter customer name');
      const due = body.due_date ? validDate(body.due_date) : null;
      const info = db.prepare('INSERT INTO debts (user_id, customer, phone, amount_kobo, due_date) VALUES (?, ?, ?, ?, ?)')
        .run(user.id, customer, str(body.phone, 20), toKobo(body.amount), due);
      return send(res, 201, { debt: db.prepare('SELECT * FROM debts WHERE id = ?').get(info.lastInsertRowid) });
    }

    if (method === 'POST' && (m = p.match(/^\/api\/debts\/(\d+)\/paid$/))) {
      needUser();
      const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ? AND paid_at IS NULL').get(Number(m[1]), user.id);
      if (!debt) throw new HttpError(404, 'Not found');
      db.exec('BEGIN');
      try {
        db.prepare("UPDATE debts SET paid_at = datetime('now') WHERE id = ?").run(debt.id);
        // A repaid debt is a sale received today. Recorded regardless of the free-plan limit.
        db.prepare(`INSERT OR IGNORE INTO entries (user_id, client_id, kind, amount_kobo, category, method, note, date)
          VALUES (?, ?, 'sale', ?, 'Debt repaid', 'cash', ?, ?)`)
          .run(user.id, `debt-${debt.id}`, debt.amount_kobo, `Paid by ${debt.customer}`, new Date().toISOString().slice(0, 10));
        db.exec('COMMIT');
      } catch (err) { db.exec('ROLLBACK'); throw err; }
      return send(res, 200, { ok: true });
    }

    // ---------- Billing ----------
    if (method === 'POST' && p === '/api/billing/checkout') {
      needUser();
      const plan = billing.PLANS[body.plan] ? body.plan : null;
      if (!plan) throw new HttpError(400, 'Unknown plan');
      const reference = `ANK-${user.id}-${crypto.randomBytes(6).toString('hex')}`;
      const amount = billing.PLANS[plan].amount_kobo;
      db.prepare('INSERT INTO payments (reference, user_id, plan, amount_kobo) VALUES (?, ?, ?, ?)').run(reference, user.id, plan, amount);
      if (!billing.secret()) {
        if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'Payments are not configured');
        return send(res, 200, { url: `/billing/dev-confirm?reference=${reference}`, dev: true });
      }
      const authUrl = await billing.initialize({
        email: user.email, amount_kobo: amount, reference,
        callback_url: `${baseUrl(req)}/billing/callback`, metadata: { user_id: user.id, plan },
      });
      return send(res, 200, { url: authUrl });
    }

    if (method === 'GET' && p === '/billing/callback') {
      const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
      if (reference && billing.secret()) {
        const data = await billing.verify(reference);
        if (data && data.status === 'success' && data.currency === 'NGN') billing.applyPayment(db, reference, data.amount);
      }
      return send(res, 302, '', { Location: '/#account' });
    }

    if (method === 'GET' && p === '/billing/dev-confirm') {
      if (process.env.NODE_ENV === 'production' || billing.secret()) throw new HttpError(404, 'Not found');
      needUser();
      const reference = url.searchParams.get('reference');
      const pay = db.prepare('SELECT * FROM payments WHERE reference = ? AND user_id = ?').get(reference, user.id);
      if (pay) billing.applyPayment(db, reference);
      return send(res, 302, '', { Location: '/#account' });
    }

    if (method === 'POST' && p === '/webhooks/paystack') {
      if (!billing.validWebhookSignature(raw, req.headers['x-paystack-signature'])) throw new HttpError(401, 'Bad signature');
      let event;
      try { event = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Bad JSON'); }
      if (event.event === 'charge.success' && event.data && event.data.currency === 'NGN') {
        billing.applyPayment(db, event.data.reference, event.data.amount);
      }
      return send(res, 200, { ok: true });
    }

    // ---------- Agent / referral program ----------
    if (method === 'GET' && p === '/api/referrals') {
      needUser();
      const referred = db.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?').get(user.id).n;
      const paying = db.prepare(`SELECT COUNT(DISTINCT u.id) AS n FROM users u JOIN payments p ON p.user_id = u.id
        WHERE u.referred_by = ? AND p.status = 'success'`).get(user.id).n;
      const earn = db.prepare(`SELECT COALESCE(SUM(amount_kobo),0) AS total,
        COALESCE(SUM(CASE WHEN paid_out = 0 THEN amount_kobo ELSE 0 END),0) AS unpaid FROM commissions WHERE agent_id = ?`).get(user.id);
      return send(res, 200, {
        code: user.referral_code, link: `${baseUrl(req)}/?ref=${user.referral_code}`,
        referred, paying, earned: earn.total / 100, unpaid: earn.unpaid / 100, rate: billing.COMMISSION_RATE,
      });
    }

    // ---------- Admin ----------
    if (method === 'GET' && p === '/api/admin/stats') {
      needUser();
      if (!isAdmin(user)) throw new HttpError(403, 'Admins only');
      const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
      const pro = db.prepare('SELECT COUNT(*) AS n FROM users WHERE pro_until > ?').get(new Date().toISOString()).n;
      const revenue = db.prepare("SELECT COALESCE(SUM(amount_kobo),0) AS s FROM payments WHERE status = 'success'").get().s / 100;
      const last30 = db.prepare("SELECT COALESCE(SUM(amount_kobo),0) AS s FROM payments WHERE status = 'success' AND paid_at > datetime('now','-30 days')").get().s / 100;
      const owed = db.prepare(`SELECT u.email, u.phone, u.referral_code, SUM(c.amount_kobo)/100.0 AS amount
        FROM commissions c JOIN users u ON u.id = c.agent_id WHERE c.paid_out = 0 GROUP BY u.id ORDER BY amount DESC`).all();
      return send(res, 200, { users, pro, revenue, last30, commissions_owed: owed });
    }

    if (method === 'POST' && p === '/api/admin/payout') {
      needUser();
      if (!isAdmin(user)) throw new HttpError(403, 'Admins only');
      const agent = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(str(body.referral_code, 20).toUpperCase());
      if (!agent) throw new HttpError(404, 'Agent not found');
      const changes = db.prepare('UPDATE commissions SET paid_out = 1 WHERE agent_id = ? AND paid_out = 0').run(agent.id).changes;
      return send(res, 200, { ok: true, marked: changes });
    }

    if (p.startsWith('/api/')) throw new HttpError(404, 'Not found');

    // ---------- Static files ----------
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    let file = path.normalize(path.join(PUBLIC_DIR, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(404, 'Not found');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    if (path.basename(file) === 'sw.js') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    return method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'Something went wrong' : err.message });
      else res.end();
    });
  });
}

if (require.main === module) {
  const db = require('./db').open();
  const port = Number(process.env.PORT || 3000);
  createApp(db).listen(port, () => console.log(`Ankoo running on http://localhost:${port}`));
}

module.exports = { createApp };
