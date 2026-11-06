'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.PAYSTACK_SECRET_KEY = '';
process.env.ADMIN_EMAILS = 'admin@ankoo.test';
process.env.FREE_ENTRIES_PER_MONTH = '3';

const tax = require('../src/tax');
const billing = require('../src/billing');
const { open } = require('../src/db');
const { createApp } = require('../src/server');

test('PIT estimate follows 2026 bands', () => {
  assert.strictEqual(tax.estimatePIT(800_000), 0);
  assert.strictEqual(tax.estimatePIT(3_000_000), 330_000); // 2.2m * 15%
  assert.strictEqual(tax.estimatePIT(12_000_000), 330_000 + 1_620_000); // + 9m * 18%
  assert.strictEqual(tax.estimatePIT(-5), 0);
});

test('small company assessment', () => {
  const e = [{ kind: 'sale', amount_kobo: 50_000_000 * 100, date: '2026-03-01' }];
  assert.strictEqual(tax.assess(e, { business_type: 'company' }, {}).smallCompany, true);
  assert.strictEqual(tax.assess(e, { business_type: 'company', professional_services: 1 }, {}).smallCompany, false);
  assert.strictEqual(tax.assess(e, { business_type: 'company' }, { SMALL_COMPANY_TURNOVER_NGN: '40000000' }).smallCompany, false);
});

async function startServer() {
  const db = open(':memory:');
  const server = createApp(db);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let cookie = '';
    return async (path, { method = 'GET', body, headers = {} } = {}) => {
      const res = await fetch(base + path, {
        method, redirect: 'manual',
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { json = text; }
      return { status: res.status, body: json, headers: res.headers };
    };
  }
  return { db, server, client };
}

test('end-to-end: signup, records, limits, debts, referral, payment, commission', async () => {
  const { db, server, client } = await startServer();
  try {
    const agent = client();
    let r = await agent('/api/signup', { method: 'POST', body: { email: 'agent@ankoo.test', password: 'password1', business_name: 'Agent Ade' } });
    assert.strictEqual(r.status, 201);
    const code = r.body.user.referral_code;

    const trader = client();
    r = await trader('/api/signup', { method: 'POST', body: { email: 'mama@ankoo.test', password: 'password1', business_name: 'Mama Put', ref: code } });
    assert.strictEqual(r.status, 201);

    // Duplicate & bad input
    assert.strictEqual((await client()('/api/signup', { method: 'POST', body: { email: 'mama@ankoo.test', password: 'password1', business_name: 'x' } })).status, 409);
    assert.strictEqual((await trader('/api/entries', { method: 'POST', body: { kind: 'sale', amount: -1 } })).status, 400);

    // Records + idempotent offline sync
    const date = new Date().toISOString().slice(0, 10);
    r = await trader('/api/entries', { method: 'POST', body: { kind: 'sale', amount: 5000, category: 'Rice', date, client_id: 'abc' } });
    assert.strictEqual(r.status, 201);
    r = await trader('/api/entries', { method: 'POST', body: { kind: 'sale', amount: 5000, category: 'Rice', date, client_id: 'abc' } });
    assert.strictEqual(r.body.duplicate, true);
    await trader('/api/entries', { method: 'POST', body: { kind: 'expense', amount: 1200.5, date } });
    await trader('/api/entries', { method: 'POST', body: { kind: 'sale', amount: 100, date } });
    // Free limit = 3 per month
    r = await trader('/api/entries', { method: 'POST', body: { kind: 'sale', amount: 100, date } });
    assert.strictEqual(r.status, 402);

    r = await trader('/api/summary');
    assert.strictEqual(r.body.today.sales, 5100);
    assert.strictEqual(r.body.today.expenses, 1200.5);
    assert.strictEqual(r.body.tax.estimatedTax, 0);

    // Pro gating
    assert.strictEqual((await trader('/api/export.csv')).status, 402);
    assert.strictEqual((await trader('/report')).status, 402);

    // Debts: repaying adds a sale even past the free limit
    r = await trader('/api/debts', { method: 'POST', body: { customer: 'Chidi', amount: 2000, phone: '08030000000' } });
    assert.strictEqual(r.status, 201);
    assert.strictEqual((await trader(`/api/debts/${r.body.debt.id}/paid`, { method: 'POST' })).status, 200);
    assert.strictEqual((await trader(`/api/debts/${r.body.debt.id}/paid`, { method: 'POST' })).status, 404);
    assert.strictEqual((await trader('/api/summary')).body.today.sales, 7100);

    // Other users cannot see or delete my data
    const stranger = client();
    await stranger('/api/signup', { method: 'POST', body: { email: 's@ankoo.test', password: 'password1', business_name: 'S' } });
    assert.strictEqual((await stranger('/api/entries')).body.entries.length, 0);
    const myEntry = (await trader('/api/entries')).body.entries[0];
    assert.strictEqual((await stranger(`/api/entries/${myEntry.id}`, { method: 'DELETE' })).status, 404);

    // CSRF: non-JSON POST rejected
    assert.strictEqual((await trader('/api/entries', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' })).status, 400 + 15);

    // Payment (dev mode) -> Pro + agent commission
    r = await trader('/api/billing/checkout', { method: 'POST', body: { plan: 'monthly' } });
    assert.strictEqual(r.body.dev, true);
    const reference = new URL(r.body.url, 'http://x').searchParams.get('reference');
    assert.strictEqual(billing.applyPayment(db, reference, 100), false, 'underpayment rejected');
    r = await trader(r.body.url);
    assert.strictEqual(r.status, 302);
    assert.strictEqual(billing.applyPayment(db, reference), false, 'applied only once');
    assert.strictEqual((await trader('/api/me')).body.user.pro, true);
    assert.strictEqual((await trader('/api/export.csv')).status, 200);
    r = await trader('/report');
    assert.strictEqual(r.status, 200);
    assert.match(r.body, /Tax Readiness Report/);

    r = await agent('/api/referrals');
    assert.strictEqual(r.body.referred, 1);
    assert.strictEqual(r.body.paying, 1);
    assert.strictEqual(r.body.earned, 300); // 20% of ₦1,500

    // Admin
    assert.strictEqual((await agent('/api/admin/stats')).status, 403);
    const admin = client();
    await admin('/api/signup', { method: 'POST', body: { email: 'admin@ankoo.test', password: 'password1', business_name: 'HQ' } });
    r = await admin('/api/admin/stats');
    assert.strictEqual(r.body.revenue, 1500);
    assert.strictEqual(r.body.commissions_owed[0].amount, 300);
    await admin('/api/admin/payout', { method: 'POST', body: { referral_code: code } });
    assert.strictEqual((await agent('/api/referrals')).body.unpaid, 0);

    // Login / logout
    await trader('/api/logout', { method: 'POST' });
    assert.strictEqual((await trader('/api/summary')).status, 401);
    assert.strictEqual((await trader('/api/login', { method: 'POST', body: { email: 'mama@ankoo.test', password: 'wrong-pass' } })).status, 401);
    assert.strictEqual((await trader('/api/login', { method: 'POST', body: { email: 'MAMA@ankoo.test', password: 'password1' } })).status, 200);

    // Static & path traversal
    assert.strictEqual((await client()('/')).status, 200);
    assert.doesNotMatch(String((await client()('/..%2f..%2fpackage.json')).body), /"name": "ankoo"/);
  } finally {
    server.close();
  }
});

test('paystack webhook signature check', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
  const { db, server } = await startServer();
  try {
    const port = server.address().port;
    db.prepare("INSERT INTO users (email, business_name, password_hash, referral_code) VALUES ('w@x.y','W','x','CODE01')").run();
    db.prepare("INSERT INTO payments (reference, user_id, plan, amount_kobo) VALUES ('REF1', 1, 'yearly', 1500000)").run();
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'REF1', amount: 1500000, currency: 'NGN' } });
    const bad = await fetch(`http://127.0.0.1:${port}/webhooks/paystack`, { method: 'POST', headers: { 'x-paystack-signature': 'nope' }, body: payload });
    assert.strictEqual(bad.status, 401);
    const sig = crypto.createHmac('sha512', 'sk_test_x').update(payload).digest('hex');
    const ok = await fetch(`http://127.0.0.1:${port}/webhooks/paystack`, { method: 'POST', headers: { 'x-paystack-signature': sig }, body: payload });
    assert.strictEqual(ok.status, 200);
    assert.ok(billing.isPro(db.prepare('SELECT * FROM users WHERE id = 1').get()));
  } finally {
    server.close();
    process.env.PAYSTACK_SECRET_KEY = '';
  }
});
