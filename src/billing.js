'use strict';
// Paystack billing + agent commissions.
const crypto = require('node:crypto');

const PLANS = {
  monthly: { label: 'Pro Monthly', amount_kobo: 1_500 * 100, days: 31 },
  yearly: { label: 'Pro Yearly', amount_kobo: 15_000 * 100, days: 366 },
};

const COMMISSION_RATE = Number(process.env.AGENT_COMMISSION_RATE || 0.2); // 20%
const COMMISSION_MONTHS = 12; // agent earns on a referral's payments for its first 12 months

function secret() { return process.env.PAYSTACK_SECRET_KEY || ''; }

async function initialize({ email, amount_kobo, reference, callback_url, metadata }) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount: amount_kobo, reference, callback_url, currency: 'NGN', metadata }),
  });
  const body = await res.json();
  if (!res.ok || !body.status) throw new Error(body.message || 'Paystack initialize failed');
  return body.data.authorization_url;
}

async function verify(reference) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  const body = await res.json();
  if (!res.ok || !body.status) return null;
  return body.data; // { status: 'success', amount, reference, ... }
}

function validWebhookSignature(rawBody, signature) {
  if (!secret() || !signature) return false;
  const expected = crypto.createHmac('sha512', secret()).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Marks a payment successful exactly once, extends Pro, and books the agent commission.
// Returns true if this call applied the payment.
function applyPayment(db, reference, paidAmountKobo) {
  const pay = db.prepare('SELECT * FROM payments WHERE reference = ?').get(reference);
  if (!pay || pay.status === 'success') return false;
  if (paidAmountKobo !== undefined && Number(paidAmountKobo) < pay.amount_kobo) return false;
  const plan = PLANS[pay.plan];
  if (!plan) return false;

  db.exec('BEGIN');
  try {
    const changed = db.prepare(
      "UPDATE payments SET status = 'success', paid_at = datetime('now') WHERE id = ? AND status != 'success'"
    ).run(pay.id).changes;
    if (!changed) { db.exec('ROLLBACK'); return false; }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pay.user_id);
    const now = Date.now();
    const base = user.pro_until && Date.parse(user.pro_until) > now ? Date.parse(user.pro_until) : now;
    const until = new Date(base + plan.days * 864e5).toISOString();
    db.prepare('UPDATE users SET pro_until = ? WHERE id = ?').run(until, user.id);

    if (user.referred_by) {
      const ageMonths = (now - Date.parse(user.created_at + 'Z')) / (30.44 * 864e5);
      if (ageMonths <= COMMISSION_MONTHS) {
        db.prepare('INSERT INTO commissions (agent_id, payment_id, amount_kobo) VALUES (?, ?, ?)')
          .run(user.referred_by, pay.id, Math.round(pay.amount_kobo * COMMISSION_RATE));
      }
    }
    db.exec('COMMIT');
    return true;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function isPro(user) {
  return Boolean(user && user.pro_until && Date.parse(user.pro_until) > Date.now());
}

module.exports = { PLANS, COMMISSION_RATE, initialize, verify, validWebhookSignature, applyPayment, isPro, secret };
