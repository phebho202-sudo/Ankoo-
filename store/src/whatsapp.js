'use strict';
// WhatsApp: click-to-chat links everywhere, plus optional automated replies through the WhatsApp Cloud API.
// Automated answers only use text ANKOO controls in Admin → Settings → Customer support.
const crypto = require('node:crypto');
const config = require('./config');
const { safeEqual, now } = require('./util');
const { STATUSES } = require('./commerce');

function normalizeNumber(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = `234${d.slice(1)}`; // Nigerian local format
  return d;
}
function link(settings, text) {
  const n = normalizeNumber(settings.whatsapp_number);
  if (!n) return '';
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function cloudEnabled() { return Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId && config.whatsapp.appSecret); }
function validSignature(rawBody, header) {
  if (!config.whatsapp.appSecret || !header) return false;
  const expected = `sha256=${crypto.createHmac('sha256', config.whatsapp.appSecret).update(rawBody).digest('hex')}`;
  return safeEqual(expected, header);
}

const INTENTS = [
  ['order', /\bANK-[A-Z0-9]{6}\b/i],
  ['human', /\b(agent|human|person|someone|call me|speak to)\b/i],
  ['bespoke', /\b(bespoke|custom|made[ -]to[ -]measure|tailor(ed)?|personali[sz]ed|wedding|aso ?ebi)\b/i],
  ['returns', /\b(return|refund|exchange|defect(ive)?|damaged|faulty|wrong item)\b/i],
  ['sizing', /\b(size|sizing|fit|measure(ment)?s?|chart|small|large)\b/i],
  ['delivery', /\b(deliver(y|ed)?|shipping|ship|dispatch|courier|arrive|waybill)\b/i],
  ['product', /\b(price|cost|how much|available|availability|in stock|collection|catalogue|catalog)\b/i],
  ['greeting', /^\s*(hi|hello|hey|good (morning|afternoon|evening)|greetings|howdy)\b/i],
];
function classify(text) {
  for (const [intent, re] of INTENTS) if (re.test(text)) return intent;
  return 'other';
}

function replyFor(db, settings, site, { from, text }) {
  const intent = classify(text);
  const fill = (s) => String(s || '').replaceAll('{site}', site);
  switch (intent) {
    case 'order': {
      const num = text.match(/\bANK-[A-Z0-9]{6}\b/i)[0].toUpperCase();
      const o = db.prepare('SELECT * FROM orders WHERE number = ?').get(num);
      const sameNumber = o && normalizeNumber(o.phone).slice(-10) === normalizeNumber(from).slice(-10);
      if (!o || !sameNumber) {
        return { intent, body: `For your security we can only share order details with the phone number used on the order. ${fill(settings.support_handoff)}` };
      }
      return { intent, body: `Order ${o.number}: ${STATUSES[o.status] || o.status}.\nTrack it here: ${site}/order/${o.number}?k=${o.access_key}\n\n${fill(settings.support_handoff)}` };
    }
    case 'bespoke': return { intent, body: fill(settings.support_bespoke) };
    case 'returns': return { intent, body: `${settings.returns_policy}\n\nIf an item is defective, please send your order number and photographs. ${fill(settings.support_handoff)}` };
    case 'sizing': return { intent, body: fill(settings.support_sizing) };
    case 'delivery': return { intent, body: fill(settings.support_delivery) };
    case 'product': return { intent, body: `You can browse every available piece, with prices and sizes, at ${site}/shop\n\n${fill(settings.support_handoff)}` };
    case 'greeting': return { intent, body: fill(settings.support_greeting) };
    default: return { intent, body: fill(settings.support_handoff) };
  }
}

async function sendText(to, body) {
  const v = process.env.WHATSAPP_API_VERSION || 'v23.0';
  const res = await fetch(`https://graph.facebook.com/${v}/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: body.slice(0, 4000), preview_url: true } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) console.error('WhatsApp send failed', res.status, (await res.text()).slice(0, 300));
}

// Handles a Cloud API webhook payload: logs inbound text and sends the automated reply.
async function handleWebhook(db, settings, site, payload) {
  const log = db.prepare('INSERT INTO wa_messages (wa_from, direction, body, intent, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of (change.value && change.value.messages) || []) {
        const from = String(msg.from || '');
        const text = msg.type === 'text' ? String(msg.text?.body || '') : `[${msg.type}]`;
        const r = msg.type === 'text' ? replyFor(db, settings, site, { from, text }) : { intent: 'media', body: settings.support_handoff };
        log.run(from, 'in', text.slice(0, 4000), r.intent, now());
        if (cloudEnabled()) {
          await sendText(from, r.body);
          log.run(from, 'out', r.body, r.intent, now());
        }
      }
    }
  }
}

module.exports = { link, normalizeNumber, classify, replyFor, handleWebhook, validSignature, cloudEnabled };
