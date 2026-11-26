'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { now } = require('./util');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  address_json TEXT NOT NULL DEFAULT '{}',
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  file TEXT NOT NULL,
  file_sm TEXT,
  mime TEXT NOT NULL,
  width INTEGER, height INTEGER,
  bytes INTEGER NOT NULL DEFAULT 0,
  alt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  show_in_nav INTEGER NOT NULL DEFAULT 1,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  care TEXT NOT NULL DEFAULT '',
  price_kobo INTEGER NOT NULL CHECK (price_kobo > 0),
  compare_at_kobo INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  made_to_order INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  bestseller INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_collections (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL DEFAULT '',
  colour TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (product_id, size, colour)
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  discount_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL CHECK (qty > 0),
  UNIQUE (cart_id, variant_id)
);
CREATE TABLE IF NOT EXISTS wishlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  kind TEXT NOT NULL CHECK (kind IN ('percent','fixed','free_shipping')),
  value INTEGER NOT NULL DEFAULT 0,
  min_subtotal_kobo INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT, ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_zones (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  countries TEXT NOT NULL DEFAULT 'NG',
  states TEXT NOT NULL DEFAULT '',
  cities TEXT NOT NULL DEFAULT '',
  fee_kobo INTEGER,
  free_over_kobo INTEGER,
  eta_text TEXT NOT NULL DEFAULT '',
  is_pickup INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  access_key TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cart_id TEXT,
  email TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL,
  address_line TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'NG', postcode TEXT NOT NULL DEFAULT '',
  zone_id INTEGER, zone_name TEXT NOT NULL DEFAULT '',
  subtotal_kobo INTEGER NOT NULL, discount_kobo INTEGER NOT NULL DEFAULT 0, discount_code TEXT,
  shipping_kobo INTEGER NOT NULL DEFAULT 0, total_kobo INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_ref TEXT UNIQUE,
  payment_channel TEXT,
  paid_at TEXT,
  customer_note TEXT NOT NULL DEFAULT '',
  measurements TEXT NOT NULL DEFAULT '',
  stock_issue INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status, created_at);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER, variant_id INTEGER,
  name TEXT NOT NULL, size TEXT NOT NULL DEFAULT '', colour TEXT NOT NULL DEFAULT '',
  made_to_order INTEGER NOT NULL DEFAULT 0,
  unit_kobo INTEGER NOT NULL, qty INTEGER NOT NULL,
  image TEXT
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  public INTEGER NOT NULL DEFAULT 1,
  notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'itan-ankoo',
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  video_url TEXT NOT NULL DEFAULT '',
  video_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  episode TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  featured INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  seo_title TEXT NOT NULL DEFAULT '', seo_description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slides (
  id INTEGER PRIMARY KEY,
  eyebrow TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  mobile_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  video_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  cta1_label TEXT NOT NULL DEFAULT '', cta1_url TEXT NOT NULL DEFAULT '',
  cta2_label TEXT NOT NULL DEFAULT '', cta2_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY,
  quote TEXT NOT NULL, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS instagram_posts (
  id INTEGER PRIMARY KEY,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  permalink TEXT NOT NULL DEFAULT '', caption TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  needs_review INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '', message TEXT NOT NULL,
  handled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  token TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  unsubscribed_at TEXT
);
CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY,
  to_addr TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL, error TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wa_messages (
  id INTEGER PRIMARY KEY,
  wa_from TEXT NOT NULL, direction TEXT NOT NULL, body TEXT NOT NULL, intent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
`;

const COLLECTIONS = [
  ['new-arrivals', 'New Arrivals'],
  ['women', 'Women'],
  ['men', 'Men'],
  ['ready-to-wear', 'Ready-to-Wear'],
  ['bespoke', 'Bespoke'],
  ['accessories', 'Accessories'],
];

// Shipping zones start inactive with no fee: ANKOO sets real fees in Admin → Shipping.
const ZONES = [
  ['Akure', 'Delivery within Akure, Ondo State.', 'NG', 'Ondo', 'Akure', 1],
  ['Lagos', 'Delivery within Lagos State.', 'NG', 'Lagos', '', 2],
  ['Other Nigerian states', 'Delivery to other states in Nigeria.', 'NG', '', '', 3],
  ['International', 'Delivery outside Nigeria, where supported.', 'INTL', '', '', 4],
];

const RETURNS_POLICY = 'No returns on bespoke or personalised orders; defective items are assessed.';

const PAGES = [
  ['about', 'About ANKOO', `ANKOO is an African-inspired luxury fashion and lifestyle house, working from Akure, Ondo State, and Lagos.

## Rooted in heritage

Our work begins with African heritage and is expressed through contemporary design. Every piece is considered: its cut, its fabric, its finish.

## Quiet luxury

We believe in understated sophistication. Timeless elegance, premium craftsmanship and garments made to be worn for years.

## Cultural storytelling

ANKOO tells stories through what we make. Our storytelling series, ÌTÀN ÀNKÓÒ, shares them in our own words.`, 1],
  ['shipping', 'Delivery & Shipping', `We deliver to Akure, Lagos, other Nigerian states and selected international destinations.

Delivery fees are calculated at checkout from your delivery address. Where a delivery estimate is available for your area it is shown at checkout.

For a specific question about your delivery, message us on WhatsApp with your order number.`, 1],
  ['returns', 'Returns', `${RETURNS_POLICY}

If an item arrives with a defect, contact us with your order number and photographs of the item. Our team will assess it and respond to you directly.`, 1],
  ['size-guide', 'Size Guide', `For help choosing a size, or to arrange measurements for a bespoke piece, message our team on WhatsApp.`, 1],
  ['privacy', 'Privacy Policy', `This policy explains how ANKOO handles your personal data on this website.

## What we collect

- Details you give us when you order, create an account, subscribe or contact us: your name, email address, phone number and delivery address.
- Order history and wishlist items linked to your account.
- If you accept analytics cookies: anonymous usage data through Google Analytics and the Meta Pixel.

## Payments

Card and bank payments are processed by Paystack. ANKOO never receives or stores your card details.

## How we use it

To process and deliver your orders, respond to your enquiries, send order updates and, only if you subscribe, send our newsletter. You can unsubscribe at any time from the link in each email.

## Your rights

You can ask us to access, correct or delete your personal data by contacting us.`, 1],
  ['terms', 'Terms of Sale', `Prices are shown in Nigerian Naira (₦) and charged in Naira.

## Orders

An order is confirmed once payment is received. You will receive an email confirmation with your order number.

## Bespoke and made-to-order pieces

Bespoke pieces are made to your measurements. ${RETURNS_POLICY}`, 1],
];

const DEFAULT_SETTINGS = {
  brand_name: 'ANKOO',
  hero_eyebrow: 'African heritage · Contemporary expression',
  hero_title: 'Rooted in Heritage. Defined by Elegance.',
  hero_text: 'Discover ANKOO, where African heritage meets contemporary expression through timeless fashion and thoughtful craftsmanship.',
  hero_cta1_label: 'Explore Collection', hero_cta1_url: '/shop',
  hero_cta2_label: 'Discover Our Story', hero_cta2_url: '/about',
  story_title: 'A house rooted in heritage',
  story_text: 'ANKOO is an African-inspired luxury fashion and lifestyle house from Akure and Lagos. Quiet luxury, timeless elegance and premium craftsmanship, told through our own stories.',
  story_media_id: null,
  about_media_id: null,
  logo_media_id: null,
  seo_title: 'ANKOO | African Luxury Fashion House, Akure & Lagos',
  seo_description: 'ANKOO is an African-inspired luxury fashion and lifestyle brand from Akure and Lagos, Nigeria. Contemporary African fashion, bespoke tailoring and timeless craftsmanship.',
  og_media_id: null,
  business_email: '',
  whatsapp_number: '',
  instagram_handle: '',
  instagram_url: '', facebook_url: '', tiktok_url: '', youtube_url: '',
  locations: [
    { city: 'Akure', region: 'Ondo State, Nigeria', address: '', hours: '', map_url: '' },
    { city: 'Lagos', region: 'Lagos, Nigeria', address: '', hours: '', map_url: '' },
  ],
  returns_policy: RETURNS_POLICY,
  support_greeting: 'Welcome to ANKOO. How can we help you today? You can ask about a piece, sizing, bespoke orders, delivery, or an existing order (send your order number, e.g. ANK-ABC123).',
  support_sizing: 'For sizing help, tell us the piece you are interested in and your usual size. You can also read our size guide: {site}/pages/size-guide',
  support_delivery: 'We deliver to Akure, Lagos, other Nigerian states and selected international destinations. Delivery fees are calculated at checkout from your address. A member of our team will confirm details for your order.',
  support_bespoke: 'Thank you for your interest in a bespoke ANKOO piece. Please share what you would like made and the occasion, and a member of our team will continue with you about measurements and details.',
  support_handoff: 'Thank you. A member of the ANKOO team will reply to you here as soon as possible.',
  currency_rates: {},
  low_stock_threshold: 3,
  ga_id: '', meta_pixel_id: '', gsc_verification: '',
  require_consent: true,
  announcement: '',
};

function open(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

function seed(db) {
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, JSON.stringify(v));
  if (!db.prepare('SELECT 1 FROM collections LIMIT 1').get()) {
    const c = db.prepare('INSERT INTO collections (slug, name, sort) VALUES (?, ?, ?)');
    COLLECTIONS.forEach(([slug, name], i) => c.run(slug, name, i));
  }
  if (!db.prepare('SELECT 1 FROM shipping_zones LIMIT 1').get()) {
    const z = db.prepare('INSERT INTO shipping_zones (name, description, countries, states, cities, sort) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of ZONES) z.run(...r);
  }
  const p = db.prepare('INSERT OR IGNORE INTO pages (slug, title, body, needs_review, updated_at) VALUES (?, ?, ?, ?, ?)');
  for (const [slug, title, body, review] of PAGES) p.run(slug, title, body, review, now());
}

// ---- Settings helpers ----
function getSettings(db) {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}
function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { open, getSettings, setSetting, tx, RETURNS_POLICY, DEFAULT_SETTINGS };
