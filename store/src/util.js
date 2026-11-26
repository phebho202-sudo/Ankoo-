'use strict';
const crypto = require('node:crypto');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---- Safe HTML templating: every interpolation is escaped unless wrapped in raw() ----
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ESC[c]); }
function renderVal(v) {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(renderVal).join('');
  return esc(v);
}
function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += renderVal(vals[i]) + strings[i + 1];
  return new Safe(out);
}
const raw = (s) => new Safe(String(s ?? ''));

// ---- Money (all amounts stored as integer kobo) ----
function naira(kobo, { symbol = true } = {}) {
  const n = Math.round(Number(kobo || 0)) / 100;
  const s = n.toLocaleString('en-NG', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return symbol ? `₦${s}` : s;
}
function toKobo(v, { allowZero = false, allowEmpty = false } = {}) {
  const s = String(v ?? '').replace(/[,\s₦]/g, '');
  if (s === '' && allowEmpty) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n > 1e11) throw new HttpError(400, 'Enter a valid amount in naira');
  return Math.round(n * 100);
}

function str(v, max = 300) { return String(v ?? '').trim().slice(0, max); }
function int(v, def = 0, min = -Infinity, max = Infinity) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function email(v, required = true) {
  const e = str(v, 254).toLowerCase();
  if (!e && !required) return '';
  if (!EMAIL_RE.test(e)) throw new HttpError(400, 'Enter a valid email address');
  return e;
}
function phone(v, required = true) {
  const p = str(v, 30);
  if (!p && !required) return '';
  if (!/^\+?[0-9 ()-]{7,20}$/.test(p)) throw new HttpError(400, 'Enter a valid phone number');
  return p;
}
function token(bytes = 24) { return crypto.randomBytes(bytes).toString('base64url'); }
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function now() { return new Date().toISOString(); }
function fmtDate(iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', ...opts });
}
function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function jsonParse(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } }
// Only allow site-relative links or http(s) URLs in admin-entered links.
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(mailto|tel):/i.test(s)) return s;
  return '';
}
function csv(rows) {
  return rows.map((r) => r.map((c) => {
    let s = String(c ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

module.exports = {
  HttpError, Safe, html, raw, esc, naira, toKobo, str, int, slugify, email, phone,
  token, sha256, safeEqual, now, fmtDate, fmtDateTime, jsonParse, safeUrl, csv,
};
