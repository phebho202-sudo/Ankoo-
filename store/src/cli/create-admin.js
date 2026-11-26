'use strict';
// Usage: npm run create-admin -- you@example.com "Your Name"
// Creates (or promotes) an admin account and prints a one-time password.
const config = require('../config');
const db = require('../db');
const auth = require('../auth');
const { token, now, email } = require('../util');

const [addr, name = 'ANKOO Admin'] = process.argv.slice(2);
if (!addr) { console.error('Usage: npm run create-admin -- you@example.com "Your Name"'); process.exit(1); }
const e = email(addr);
const database = db.open(config.dbPath);
const existing = database.prepare('SELECT * FROM users WHERE email = ?').get(e);
if (existing) {
  database.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
  console.log(`${e} is now an admin. Sign in with the existing password.`);
} else {
  const pw = token(12);
  database.prepare("INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, 'admin', ?)").run(e, auth.hashPassword(pw), name, now());
  console.log(`Admin created: ${e}\nTemporary password: ${pw}\nSign in at /login and change it under Account > Profile.`);
}
