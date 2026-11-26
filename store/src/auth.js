'use strict';
const crypto = require('node:crypto');
const { token, sha256, now, HttpError } = require('./util');

const SESSION_DAYS = 30;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}
function validatePassword(p) {
  const s = String(p || '');
  if (s.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (s.length > 200) throw new HttpError(400, 'Password is too long');
  return s;
}

function createSession(db, userId) {
  const t = token(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(sha256(t), userId, expires, now());
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), userId);
  return t;
}
function userFromToken(db, t) {
  if (!t) return null;
  return db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(t), now()) || null;
}
function destroySession(db, t) { if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(t)); }

// In-memory fixed-window limiter, keyed by IP + action.
const buckets = new Map();
function rateLimited(key, max = 10, windowMs = 15 * 60 * 1000) {
  const t = Date.now();
  const rec = buckets.get(key) || { count: 0, start: t };
  if (t - rec.start > windowMs) { rec.count = 0; rec.start = t; }
  rec.count += 1;
  buckets.set(key, rec);
  if (buckets.size > 50000) buckets.clear();
  return rec.count > max;
}

module.exports = { hashPassword, verifyPassword, validatePassword, createSession, userFromToken, destroySession, rateLimited, SESSION_DAYS };
