'use strict';
// Cart, discounts, shipping, totals and order lifecycle. All money is integer kobo (NGN).
const crypto = require('node:crypto');
const { HttpError, now, token } = require('./util');
const { tx } = require('./db');
const catalog = require('./catalog');

const MAX_QTY = 20;

// ---------- Cart ----------
function createCart(db, userId = null) {
  const id = token(18);
  db.prepare('INSERT INTO carts (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, userId, now(), now());
  return id;
}
function findCart(db, id) { return id ? db.prepare('SELECT * FROM carts WHERE id = ?').get(id) || null : null; }
function userCart(db, userId) {
  return db.prepare('SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId) || null;
}

function loadCart(db, cartId) {
  const cart = findCart(db, cartId);
  if (!cart) return { id: null, items: [], count: 0, subtotal: 0, discount_code: null };
  const rows = db.prepare(`SELECT ci.id AS item_id, ci.qty, v.id AS variant_id, v.size, v.colour, v.stock, v.active AS variant_active,
      p.id AS product_id, p.slug, p.name, p.price_kobo, p.status, p.made_to_order
    FROM cart_items ci JOIN variants v ON v.id = ci.variant_id JOIN products p ON p.id = v.product_id
    WHERE ci.cart_id = ? ORDER BY ci.id`).all(cart.id);
  const imgs = new Map();
  const decorated = catalog.decorate(db, [...new Map(rows.map((r) => [r.product_id, { id: r.product_id }])).values()]);
  for (const d of decorated) imgs.set(d.id, d.images[0] || null);
  const items = rows.map((r) => {
    let issue = '';
    if (r.status !== 'active' || !r.variant_active) issue = 'This piece is no longer available.';
    else if (!r.made_to_order && r.stock < r.qty) issue = r.stock > 0 ? `Only ${r.stock} available.` : 'Sold out.';
    return { ...r, image: imgs.get(r.product_id), line_kobo: r.price_kobo * r.qty, issue };
  });
  return {
    id: cart.id, discount_code: cart.discount_code, items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: items.reduce((n, i) => n + i.line_kobo, 0),
    hasMadeToOrder: items.some((i) => i.made_to_order),
  };
}

function addItem(db, cartId, variantId, qty) {
  qty = Math.max(1, Math.min(MAX_QTY, Number(qty) || 1));
  const v = db.prepare(`SELECT v.*, p.status, p.made_to_order FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`).get(variantId);
  if (!v || !v.active || v.status !== 'active') throw new HttpError(400, 'This piece is not available.');
  const existing = db.prepare('SELECT qty FROM cart_items WHERE cart_id = ? AND variant_id = ?').get(cartId, variantId);
  const want = Math.min(MAX_QTY, (existing ? existing.qty : 0) + qty);
  if (!v.made_to_order && want > v.stock) {
    throw new HttpError(400, v.stock > 0 ? `Only ${v.stock} available in this option.` : 'This option is sold out.');
  }
  db.prepare(`INSERT INTO cart_items (cart_id, variant_id, qty) VALUES (?, ?, ?)
    ON CONFLICT(cart_id, variant_id) DO UPDATE SET qty = excluded.qty`).run(cartId, variantId, want);
  db.prepare('UPDATE carts SET updated_at = ? WHERE id = ?').run(now(), cartId);
}
function setQty(db, cartId, itemId, qty) {
  qty = Number(qty);
  if (!Number.isFinite(qty) || qty <= 0) { db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(itemId, cartId); return; }
  const row = db.prepare(`SELECT ci.id, v.stock, p.made_to_order FROM cart_items ci JOIN variants v ON v.id = ci.variant_id
    JOIN products p ON p.id = v.product_id WHERE ci.id = ? AND ci.cart_id = ?`).get(itemId, cartId);
  if (!row) return;
  const q = Math.min(MAX_QTY, Math.floor(qty), row.made_to_order ? MAX_QTY : Math.max(1, row.stock));
  db.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').run(q, itemId);
}
function mergeIntoUser(db, guestCartId, userId) {
  const guest = findCart(db, guestCartId);
  let mine = userCart(db, userId);
  if (!guest || guest.user_id === userId) return guest ? guest.id : (mine ? mine.id : null);
  if (!mine) {
    db.prepare('UPDATE carts SET user_id = ?, updated_at = ? WHERE id = ?').run(userId, now(), guest.id);
    return guest.id;
  }
  for (const it of db.prepare('SELECT * FROM cart_items WHERE cart_id = ?').all(guest.id)) {
    db.prepare(`INSERT INTO cart_items (cart_id, variant_id, qty) VALUES (?, ?, ?)
      ON CONFLICT(cart_id, variant_id) DO UPDATE SET qty = MIN(${MAX_QTY}, qty + excluded.qty)`).run(mine.id, it.variant_id, it.qty);
  }
  db.prepare('DELETE FROM carts WHERE id = ?').run(guest.id);
  return mine.id;
}

// ---------- Discounts ----------
function checkDiscount(db, code, subtotal) {
  if (!code) return { discount: null };
  const d = db.prepare('SELECT * FROM discounts WHERE code = ?').get(String(code).trim());
  const t = now();
  if (!d || !d.active) return { error: 'This code is not valid.' };
  if (d.starts_at && d.starts_at > t) return { error: 'This code is not active yet.' };
  if (d.ends_at && d.ends_at < t) return { error: 'This code has expired.' };
  if (d.max_uses !== null && d.max_uses !== undefined && d.used_count >= d.max_uses) return { error: 'This code has been fully used.' };
  if (subtotal < d.min_subtotal_kobo) return { error: `This code needs a minimum order of ₦${(d.min_subtotal_kobo / 100).toLocaleString('en-NG')}.`, discount: null };
  return { discount: d };
}
function discountAmount(d, subtotal) {
  if (!d) return 0;
  if (d.kind === 'percent') return Math.floor((subtotal * Math.min(100, Math.max(0, d.value))) / 100);
  if (d.kind === 'fixed') return Math.min(subtotal, d.value);
  return 0;
}

// ---------- Shipping ----------
const list = (s) => String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
function zoneMatches(z, { country, state, city }) {
  const c = String(country || '').toUpperCase();
  const cs = String(z.countries || '').toUpperCase().split(',').map((x) => x.trim()).filter(Boolean);
  let countryOk;
  if (cs.includes('ALL')) countryOk = true;
  else if (cs.includes('INTL')) countryOk = c && c !== 'NG';
  else countryOk = cs.includes(c);
  if (!countryOk) return false;
  const states = list(z.states);
  if (states.length && !states.includes(String(state || '').trim().toLowerCase())) return false;
  const cities = list(z.cities);
  if (cities.length && !cities.includes(String(city || '').trim().toLowerCase())) return false;
  return true;
}
function specificity(z) { return (list(z.cities).length ? 4 : 0) + (list(z.states).length ? 2 : 0) + (String(z.countries).toUpperCase().includes('INTL') || String(z.countries).toUpperCase().includes('ALL') ? 0 : 1); }

// Returns the delivery options for an address: the most specific matching zones, plus pickup options.
function shippingOptions(db, address) {
  const zones = db.prepare('SELECT * FROM shipping_zones WHERE active = 1 AND fee_kobo IS NOT NULL ORDER BY sort, id').all()
    .filter((z) => zoneMatches(z, address));
  const delivery = zones.filter((z) => !z.is_pickup);
  const best = Math.max(-1, ...delivery.map(specificity));
  return [...delivery.filter((z) => specificity(z) === best), ...zones.filter((z) => z.is_pickup)];
}
function shippingFee(zone, afterDiscount, discount) {
  if (!zone) return 0;
  if (discount && discount.kind === 'free_shipping') return 0;
  if (zone.free_over_kobo && afterDiscount >= zone.free_over_kobo) return 0;
  return zone.fee_kobo || 0;
}

function quote(db, cart, { discountCode, zoneId, address } = {}) {
  const subtotal = cart.subtotal;
  const code = discountCode !== undefined ? discountCode : cart.discount_code;
  const dc = checkDiscount(db, code, subtotal);
  const discount = dc.discount || null;
  const discountKobo = discountAmount(discount, subtotal);
  const after = subtotal - discountKobo;
  const options = address ? shippingOptions(db, address) : [];
  const zone = options.find((z) => z.id === Number(zoneId)) || null;
  const shipping = shippingFee(zone, after, discount);
  return {
    subtotal, discount, discountError: dc.error || '', discountKobo, options, zone,
    shipping, total: after + shipping,
    optionsView: options.map((z) => ({ id: z.id, name: z.name, description: z.description, eta: z.eta_text, pickup: !!z.is_pickup, fee: shippingFee(z, after, discount) })),
  };
}

// ---------- Orders ----------
const STATUSES = {
  pending_payment: 'Awaiting payment',
  paid: 'Payment received',
  processing: 'In the atelier',
  ready: 'Ready for dispatch',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
function orderNumber(db) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let s = 'ANK-';
    for (const b of crypto.randomBytes(6)) s += alphabet[b % alphabet.length];
    if (!db.prepare('SELECT 1 FROM orders WHERE number = ?').get(s)) return s;
  }
}

function createOrder(db, { cart, user, customer, address, zone, q, note, measurements }) {
  if (!cart.items.length) throw new HttpError(400, 'Your bag is empty.');
  const bad = cart.items.find((i) => i.issue);
  if (bad) throw new HttpError(409, `${bad.name}: ${bad.issue} Please update your bag.`);
  if (!zone) throw new HttpError(400, 'Choose a delivery option.');
  return tx(db, () => {
    const number = orderNumber(db);
    const t = now();
    const r = db.prepare(`INSERT INTO orders (number, access_key, user_id, cart_id, email, phone, name, address_line, city, state, country, postcode,
        zone_id, zone_name, subtotal_kobo, discount_kobo, discount_code, shipping_kobo, total_kobo, status, payment_ref,
        customer_note, measurements, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?)`).run(
      number, token(18), user ? user.id : null, cart.id, customer.email, customer.phone, customer.name,
      address.line, address.city, address.state, address.country, address.postcode,
      zone.id, zone.name, q.subtotal, q.discountKobo, q.discount ? q.discount.code : null, q.shipping, q.total,
      `${number}-${token(6)}`, note || '', measurements || '', t, t,
    );
    const orderId = Number(r.lastInsertRowid);
    const ins = db.prepare(`INSERT INTO order_items (order_id, product_id, variant_id, name, size, colour, made_to_order, unit_kobo, qty, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const i of cart.items) {
      ins.run(orderId, i.product_id, i.variant_id, i.name, i.size, i.colour, i.made_to_order, i.price_kobo, i.qty, i.image ? catalog.mediaUrl(i.image, true) : null);
    }
    db.prepare('INSERT INTO order_events (order_id, status, note, created_at) VALUES (?, ?, ?, ?)').run(orderId, 'pending_payment', 'Order placed', t);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });
}

// Idempotent: safe to call from both the payment callback and the webhook.
function markPaid(db, orderId, { amountKobo, currency = 'NGN', channel = '' }) {
  return tx(db, () => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) throw new HttpError(404, 'Order not found');
    if (o.paid_at) return { order: o, newlyPaid: false };
    if (Number(amountKobo) !== o.total_kobo || String(currency).toUpperCase() !== o.currency) {
      db.prepare('INSERT INTO order_events (order_id, status, note, public, created_at) VALUES (?, ?, ?, 0, ?)')
        .run(o.id, o.status, `Payment amount mismatch: received ${amountKobo} ${currency}`, now());
      return { order: o, newlyPaid: false, mismatch: true };
    }
    let stockIssue = 0;
    for (const it of db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id)) {
      if (it.made_to_order || !it.variant_id) continue;
      const v = db.prepare('SELECT stock FROM variants WHERE id = ?').get(it.variant_id);
      if (!v || v.stock < it.qty) stockIssue = 1;
      db.prepare('UPDATE variants SET stock = MAX(0, stock - ?) WHERE id = ?').run(it.qty, it.variant_id);
    }
    if (o.discount_code) db.prepare('UPDATE discounts SET used_count = used_count + 1 WHERE code = ?').run(o.discount_code);
    const t = now();
    db.prepare(`UPDATE orders SET status = 'paid', paid_at = ?, payment_channel = ?, stock_issue = ?, updated_at = ? WHERE id = ?`)
      .run(t, channel, stockIssue, t, o.id);
    db.prepare('INSERT INTO order_events (order_id, status, note, created_at) VALUES (?, ?, ?, ?)').run(o.id, 'paid', 'Payment confirmed', t);
    if (o.cart_id) {
      db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(o.cart_id);
      db.prepare('UPDATE carts SET discount_code = NULL WHERE id = ?').run(o.cart_id);
    }
    return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id), newlyPaid: true };
  });
}

function orderItems(db, orderId) { return db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId); }
function orderEvents(db, orderId, publicOnly = true) {
  return db.prepare(`SELECT * FROM order_events WHERE order_id = ? ${publicOnly ? 'AND public = 1' : ''} ORDER BY id`).all(orderId);
}

module.exports = {
  createCart, findCart, userCart, loadCart, addItem, setQty, mergeIntoUser,
  checkDiscount, discountAmount, shippingOptions, zoneMatches, quote,
  STATUSES, createOrder, markPaid, orderItems, orderEvents, MAX_QTY,
};
