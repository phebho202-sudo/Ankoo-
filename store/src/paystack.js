'use strict';
// Paystack: hosted checkout (card, bank transfer, USSD, Apple Pay and other channels Paystack enables
// on the merchant account). Card details never touch this server.
const crypto = require('node:crypto');
const config = require('./config');
const { HttpError, safeEqual } = require('./util');

const API = 'https://api.paystack.co';

function enabled() { return Boolean(config.paystackSecret); }
// Dev-only fake checkout, so the full flow can be tested without keys. Never available in production.
function devMode() { return !enabled() && !config.production; }

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.paystackSecret}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    console.error('Paystack error', res.status, json && json.message);
    throw new HttpError(502, 'The payment service could not be reached. Please try again.');
  }
  return json.data;
}

async function initialize({ email, amountKobo, reference, callbackUrl, metadata }) {
  const data = await call('POST', '/transaction/initialize', {
    email, amount: amountKobo, currency: 'NGN', reference, callback_url: callbackUrl, metadata,
  });
  return data.authorization_url;
}
async function verify(reference) {
  const d = await call('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
  return { success: d.status === 'success', amountKobo: d.amount, currency: d.currency, channel: d.channel, reference: d.reference };
}
function validSignature(rawBody, signature) {
  if (!enabled() || !signature) return false;
  const expected = crypto.createHmac('sha512', config.paystackSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

module.exports = { enabled, devMode, initialize, verify, validSignature };
