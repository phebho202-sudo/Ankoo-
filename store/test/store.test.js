'use strict';
// End-to-end tests against a real HTTP server and an in-memory database.
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.ADMIN_EMAILS = 'owner@ankoo.test';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ankoo-up-'));
delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.NODE_ENV;

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const db = require('../src/db');
const { build } = require('../src/server');
const commerce = require('../src/commerce');
const whatsapp = require('../src/whatsapp');
const { markdown } = require('../src/markdown');
const { parseVideo } = require('../src/video');

let server; let base; let database;

function client() {
  const jar = new Map();
  async function req(method, url, { form, json, headers = {}, raw } = {}) {
    const h = { ...headers, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    if (json) { body = JSON.stringify(json); h['content-type'] = 'application/json'; h.accept = 'application/json'; }
    if (raw) body = raw;
    const res = await fetch(base + url, { method, headers: h, body, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      const k = pair.slice(0, i); const v = pair.slice(i + 1);
      if (/Max-Age=0/.test(c)) jar.delete(k); else jar.set(k, v);
    }
    const text = await res.text();
    return { status: res.status, text, headers: res.headers, location: res.headers.get('location') };
  }
  const c = {
    jar,
    get: (u, o) => req('GET', u, o),
    post: (u, form = {}, o = {}) => req('POST', u, { ...o, form: { _csrf: decodeURIComponent(jar.get('csrf') || ''), ...form } }),
    postJson: (u, json) => req('POST', u, { json, headers: { 'x-csrf-token': decodeURIComponent(jar.get('csrf') || '') } }),
    raw: req,
  };
  return c;
}

async function register(c, email, name = 'Test Person') {
  await c.get('/register');
  return c.post('/register', { name, email, password: 'correct horse battery', phone: '08030000000' });
}

before(async () => {
  database = db.open(':memory:');
  const app = build(database);
  server = http.createServer(app.handle);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }); });

test('homepage renders the brand with security headers', async () => {
  const c = client();
  const r = await c.get('/');
  assert.equal(r.status, 200);
  assert.match(r.text, /Rooted in Heritage\. Defined by Elegance\./);
  assert.match(r.text, /Explore Collection/);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.match(r.text, /"@type":"ClothingStore"/);
});

test('POST without CSRF token is rejected', async () => {
  const c = client();
  await c.get('/login');
  const r = await c.raw('POST', '/login', { form: { email: 'a@b.co', password: 'x' } });
  assert.equal(r.status, 303);
  const page = await c.get(r.location);
  assert.match(page.text, /session expired/i);
});

test('customers cannot reach the admin', async () => {
  const c = client();
  await register(c, 'customer1@example.com');
  const r = await c.get('/admin');
  assert.equal(r.status, 404);
});

let admin; let productId; let variantM;
test('admin can upload media and create a product with variants', async () => {
  admin = client();
  const r = await register(admin, 'owner@ankoo.test', 'Owner');
  assert.equal(r.location, '/admin');
  assert.equal((await admin.get('/admin')).status, 200);

  // 1x1 PNG
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const up = await admin.postJson('/admin/media/upload', { data: png, width: 1, height: 1, alt: 'Agbada' });
  assert.equal(up.status, 200, up.text);
  const media = JSON.parse(up.text);
  const bad = await admin.postJson('/admin/media/upload', { data: Buffer.from('<html><script>alert(1)</script></html>').toString('base64') });
  assert.equal(bad.status, 400);

  const men = database.prepare("SELECT id FROM collections WHERE slug = 'men'").get().id;
  const save = await admin.post('/admin/products/new', {
    name: 'Ìtàn Agbada <script>x</script>', status: 'active', price_kobo: '250000', description: 'Hand-finished.',
    'images[]': String(media.id), 'collections[]': String(men),
    'v_size[]': 'M', 'v_colour[]': 'Forest Green', 'v_stock[]': '2', 'v_sku[]': 'AG-M', 'v_active[]': '1',
  });
  assert.equal(save.status, 303, save.text);
  productId = Number(save.location.split('/').pop());
  const p = database.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  assert.equal(p.price_kobo, 25000000);
  variantM = database.prepare('SELECT * FROM variants WHERE product_id = ?').get(productId);
  assert.equal(variantM.stock, 2);

  const page = await client().get(`/product/${p.slug}`);
  assert.equal(page.status, 200);
  assert.ok(!page.text.includes('<script>x</script>'), 'product name must be escaped');
  assert.match(page.text, /"priceCurrency":"NGN","price":"250000.00"/);
  assert.match(page.text, /₦250,000/);
  const listing = await client().get('/collections/men');
  assert.match(listing.text, /Ìtàn Agbada/);
  assert.match((await client().get('/sitemap.xml')).text, new RegExp(`/product/${p.slug}`));
  assert.match((await client().get('/feeds/products.csv')).text, /250000\.00 NGN/);
});

test('stock limits are enforced when adding to the bag', async () => {
  const c = client();
  await c.get('/');
  const r = await c.raw('POST', '/cart/add', {
    form: { _csrf: decodeURIComponent(c.jar.get('csrf')), product_id: productId, size: 'M', colour: 'Forest Green', qty: 3 },
    headers: { 'x-requested-with': 'fetch' },
  });
  assert.equal(r.status, 400);
  assert.match(r.text, /Only 2 available/);
});

test('full checkout: discount, shipping zone, payment, stock and emails', async () => {
  // Admin: discount code and a delivery fee for Lagos.
  await admin.post('/admin/discounts/new', { code: 'welcome10', kind: 'percent', percent: '10', active: '1' });
  const lagos = database.prepare("SELECT id FROM shipping_zones WHERE name = 'Lagos'").get().id;
  const z = await admin.post(`/admin/shipping/${lagos}`, { name: 'Lagos', countries: 'NG', states: 'Lagos', fee_kobo: '5000', active: '1', sort: '2' });
  assert.equal(z.status, 303, z.text);

  const c = client();
  await register(c, 'buyer@example.com', 'Ada Buyer');
  await c.post('/cart/add', { product_id: productId, size: 'M', colour: 'Forest Green', qty: 2 });
  const d = await c.post('/cart/discount', { code: 'WELCOME10' });
  assert.equal(d.status, 303);

  // Delivery options appear only for configured zones.
  const quote = await c.postJson('/checkout/quote', { country: 'NG', state_ng: 'Lagos', city: 'Ikeja' });
  assert.match(JSON.parse(quote.text).options, /Lagos/);
  const none = await c.postJson('/checkout/quote', { country: 'NG', state_ng: 'Kano', city: 'Kano' });
  assert.match(JSON.parse(none.text).options, /not yet available/);

  const co = await c.post('/checkout', {
    name: 'Ada Buyer', email: 'buyer@example.com', phone: '+2348030000000', country: 'NG', state_ng: 'Lagos',
    city: 'Ikeja', line: '1 Allen Avenue', zone: String(lagos), agree: '1',
  });
  assert.equal(co.status, 303, co.text.slice(0, 500));
  assert.match(co.location, /^\/checkout\/test-payment\/ANK-/);
  const order = database.prepare('SELECT * FROM orders ORDER BY id DESC').get();
  // 2 x 250,000 = 500,000; 10% off = 450,000; + 5,000 delivery
  assert.equal(order.subtotal_kobo, 50000000);
  assert.equal(order.discount_kobo, 5000000);
  assert.equal(order.shipping_kobo, 500000);
  assert.equal(order.total_kobo, 45500000);

  // Order pages are private without the access key.
  assert.equal((await client().get(`/order/${order.number}`)).status, 404);

  const pay = await c.post(`/checkout/test-payment/${order.number}`, { k: order.access_key });
  assert.equal(pay.status, 303);
  const paid = database.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  assert.equal(paid.status, 'paid');
  assert.equal(database.prepare('SELECT stock FROM variants WHERE id = ?').get(variantM.id).stock, 0);
  assert.equal(database.prepare("SELECT used_count FROM discounts WHERE code = 'WELCOME10'").get().used_count, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM cart_items').get().n, 0);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(database.prepare("SELECT COUNT(*) AS n FROM email_log WHERE subject LIKE '%' || ? || '%'").get(order.number).n >= 1);

  // Paying twice is idempotent.
  const again = commerce.markPaid(database, order.id, { amountKobo: order.total_kobo });
  assert.equal(again.newlyPaid, false);

  const view = await c.get(`/order/${order.number}?k=${order.access_key}&new=1`);
  assert.match(view.text, /Thank you for your order/);
  assert.match(view.text, /"event":"Purchase"/);

  // Track order by number + email
  const t = client(); await t.get('/track');
  const tr = await t.post('/track', { number: order.number, email: 'buyer@example.com' });
  assert.match(tr.location, new RegExp(`/order/${order.number}\\?k=`));

  // Admin status update with restock on cancellation
  const up = await admin.post(`/admin/orders/${order.id}/status`, { status: 'cancelled', note: 'Customer request', public: '1', notify: '1', restock: '1' });
  assert.equal(up.status, 303);
  assert.equal(database.prepare('SELECT stock FROM variants WHERE id = ?').get(variantM.id).stock, 2);
});

test('payment amount mismatch never marks an order paid', () => {
  const o = database.prepare("SELECT * FROM orders WHERE status = 'cancelled'").get();
  const id = Number(database.prepare(`INSERT INTO orders (number, access_key, email, phone, name, subtotal_kobo, total_kobo, payment_ref, created_at, updated_at)
    VALUES ('ANK-TEST01', 'k', 'x@y.co', '1', 'X', 100, 100, 'ref-x', ?, ?)`).run(o.created_at, o.created_at).lastInsertRowid);
  const r = commerce.markPaid(database, id, { amountKobo: 1 });
  assert.equal(r.mismatch, true);
  assert.equal(database.prepare('SELECT paid_at FROM orders WHERE id = ?').get(id).paid_at, null);
});

test('webhooks reject unsigned requests', async () => {
  const c = client();
  const r = await c.raw('POST', '/webhooks/paystack', { raw: '{"event":"charge.success"}', headers: { 'content-type': 'application/json', 'x-paystack-signature': 'bad' } });
  assert.equal(r.status, 401);
  const w = await c.raw('POST', '/webhooks/whatsapp', { raw: '{}', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=bad' } });
  assert.equal(w.status, 401);
});

test('shipping zones choose the most specific match', () => {
  const zones = [
    { id: 1, countries: 'NG', states: 'Ondo', cities: 'Akure' },
    { id: 2, countries: 'NG', states: '', cities: '' },
    { id: 3, countries: 'INTL', states: '', cities: '' },
  ];
  assert.ok(commerce.zoneMatches(zones[0], { country: 'NG', state: 'Ondo', city: 'akure' }));
  assert.ok(!commerce.zoneMatches(zones[0], { country: 'NG', state: 'Ondo', city: 'Owo' }));
  assert.ok(commerce.zoneMatches(zones[2], { country: 'GB', state: '', city: 'London' }));
  assert.ok(!commerce.zoneMatches(zones[2], { country: 'NG', state: 'Lagos', city: 'Ikeja' }));
});

test('WhatsApp automation classifies routine enquiries and protects order details', () => {
  assert.equal(whatsapp.classify('Hello'), 'greeting');
  assert.equal(whatsapp.classify('what size should I get?'), 'sizing');
  assert.equal(whatsapp.classify('How much is delivery to Abuja'), 'delivery');
  assert.equal(whatsapp.classify('I want a bespoke agbada for my wedding'), 'bespoke');
  assert.equal(whatsapp.classify('can I return this'), 'returns');
  assert.equal(whatsapp.normalizeNumber('0803 000 0000'), '2348030000000');
  const settings = db.getSettings(database);
  const o = database.prepare('SELECT * FROM orders WHERE number != ? ORDER BY id LIMIT 1').get('ANK-TEST01');
  const stranger = whatsapp.replyFor(database, settings, 'https://ankoo.test', { from: '2349999999999', text: `status of ${o.number}?` });
  assert.ok(!stranger.body.includes(o.access_key));
  const owner = whatsapp.replyFor(database, settings, 'https://ankoo.test', { from: '2348030000000', text: `status of ${o.number}?` });
  assert.ok(owner.body.includes(o.access_key));
  const ret = whatsapp.replyFor(database, settings, 'https://ankoo.test', { from: '1', text: 'refund please' });
  assert.match(ret.body, /No returns on bespoke or personalised orders; defective items are assessed\./);
});

test('markdown is safe and video links embed', () => {
  const out = markdown('Hello <img src=x onerror=alert(1)> [x](javascript:alert(1)) **bold**');
  assert.ok(!out.includes('<img src=x'));
  assert.ok(!out.includes('javascript:'));
  assert.match(out, /<strong>bold<\/strong>/);
  assert.ok(parseVideo('https://youtu.be/dQw4w9WgXcQ').src.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  assert.ok(parseVideo('https://www.tiktok.com/@ankoo/video/7300000000000000000').src.includes('tiktok.com/embed'));
  assert.equal(parseVideo('https://evil.example/x'), null);
});

test('password reset flow', async () => {
  const c = client();
  await c.get('/forgot');
  const r = await c.post('/forgot', { email: 'buyer@example.com' });
  assert.equal(r.status, 303);
  const row = database.prepare('SELECT * FROM password_resets').get();
  assert.ok(row);
  // Unknown token is rejected
  const bad = await c.post('/reset', { t: 'nope', password: 'another password' });
  assert.equal(bad.status, 303);
  assert.match((await c.get(bad.location)).text, /invalid or has expired/);
  void crypto;
});

test('journal publishes ÌTÀN ÀNKÓÒ episodes with embedded video', async () => {
  const r = await admin.post('/admin/journal/new', { title: 'Episode One', category: 'itan-ankoo', episode: 'Episode 1', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', body: 'A story.', status: 'published' });
  assert.equal(r.status, 303, r.text);
  const page = await client().get('/journal/episode-one');
  assert.equal(page.status, 200);
  assert.match(page.text, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match((await client().get('/about')).text, /Episode One/);
});
