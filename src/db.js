'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

function open(file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'ankoo.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      business_name TEXT NOT NULL,
      business_type TEXT NOT NULL DEFAULT 'individual',
      professional_services INTEGER NOT NULL DEFAULT 0,
      fixed_assets_kobo INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by INTEGER REFERENCES users(id),
      pro_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('sale','expense')),
      amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
      category TEXT NOT NULL DEFAULT '',
      method TEXT NOT NULL DEFAULT 'cash',
      note TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, client_id)
    );
    CREATE INDEX IF NOT EXISTS entries_user_date ON entries(user_id, date);
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
      due_date TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      plan TEXT NOT NULL,
      amount_kobo INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES users(id),
      payment_id INTEGER UNIQUE NOT NULL REFERENCES payments(id),
      amount_kobo INTEGER NOT NULL,
      paid_out INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

module.exports = { open };
