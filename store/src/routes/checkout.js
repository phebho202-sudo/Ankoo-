'use strict';
const { html, raw, str, email, phone, HttpError, naira, safeEqual, fmtDateTime, jsonParse } = require('../util');
const commerce = require('../commerce');
const paystack = require('../paystack');
const mailer = require('../mailer');
const whatsapp = require('../whatsapp');
const config = require('../config');
const { NG_STATES, countryList, countryName } = require('../geo');
const { layout, picture, csrf, icons } = require('../views/layout');

function addressFrom(b) {
  const country = /^[A-Z]{2}$/.test(String(b.country || '').toUpperCase()) ? String(b.country).toUpperCase() : 'NG';
  const state = country === 'NG' ? str(b.state_ng, 60) : str(b.state_intl, 100);
  return { country, state, city: str(b.city, 100), line: str(b.line, 300), postcode: str(b.postcode, 20) };
}

function optionsBlock(ctx, q, zoneId) {
  if (!q.options.length) {
    const wa = whatsapp.link(ctx.settings, 'Hello ANKOO, I would like to arrange delivery for an order.');
    return html`<p class="notice">Delivery to this address is not yet available online. ${wa ? html`<a href="${wa}" target="_blank" rel="noopener">Message us on WhatsApp</a> and our team will help.` : 'Please contact us and our team will help.'}</p>`;
  }
  return html`${q.optionsView.map((o, i) => html`<label class="ship-opt">
    <input type="radio" name="zone" value="${o.id}" required ${Number(zoneId) === o.id || (!zoneId && i === 0) ? raw('checked') : ''}>
    <span class="ship-name">${o.name}${o.description ? html`<small>${o.description}</small>` : ''}${o.eta ? html`<small>${o.eta}</small>` : ''}</span>
    <span class="ship-fee">${o.fee ? naira(o.fee) : 'Free'}</span>
  </label>`)}`;
}
function totalsBlock(q) {
  return html`<dl class="totals">
    <div><dt>Subtotal</dt><dd>${naira(q.subtotal)}</dd></div>
    ${q.discountKobo ? html`<div><dt>Discount (${q.discount.code})</dt><dd>−${naira(q.discountKobo)}</dd></div>` : ''}
    <div><dt>Delivery</dt><dd>${q.zone ? (q.shipping ? naira(q.shipping) : 'Free') : html`<span class="muted">Choose an option</span>`}</dd></div>
    <div class="total"><dt>Total</dt><dd>${naira(q.total)}</dd></div>
  </dl>`;
}

function checkoutPage(ctx, { values = {}, error = '' } = {}) {
  const cart = commerce.loadCart(ctx.db, ctx.cartId);
  if (!cart.items.length) return ctx.redirect('/cart');
  const u = ctx.user;
  const ua = u ? jsonParse(u.address_json, {}) : {};
  const v = {
    name: u ? u.name : '', email: u ? u.email : '', phone: u ? u.phone : '',
    country: ua.country || 'NG', state_ng: ua.country && ua.country !== 'NG' ? '' : (ua.state || ''), state_intl: ua.country && ua.country !== 'NG' ? ua.state : '',
    city: ua.city || '', line: ua.line || '', postcode: ua.postcode || '', ...values,
  };
  const address = addressFrom(v);
  const q = commerce.quote(ctx.db, cart, { address, zoneId: v.zone });
  const zoneId = v.zone || (q.options[0] && q.options[0].id);
  const q2 = commerce.quote(ctx.db, cart, { address, zoneId });
  const payReady = paystack.enabled() || paystack.devMode();
  const wa = whatsapp.link(ctx.settings, `Hello ANKOO, I would like to complete an order:\n${cart.items.map((i) => `• ${i.name}${i.size ? ` (${i.size})` : ''} × ${i.qty}`).join('\n')}`);
  const sel = (a, b) => (String(a) === String(b) ? raw('selected') : '');

  ctx.html(layout(ctx, {
    title: 'Checkout', noindex: true, bodyClass: 'checkout-page',
    track: { event: 'InitiateCheckout', value: q2.total / 100, currency: 'NGN', num_items: cart.count },
    body: html`<section class="page-head page-head-sm"><div class="page-head-inner"><h1 class="display">Checkout</h1></div></section>
${error ? html`<div class="flash flash-error" role="alert">${error}</div>` : ''}
${!payReady ? html`<div class="flash flash-info">Online payment is being set up. ${wa ? html`<a href="${wa}" target="_blank" rel="noopener">Complete your order on WhatsApp</a>.` : ''}</div>` : ''}
<form class="checkout" method="post" action="/checkout" data-checkout>
  ${csrf(ctx)}
  <div class="checkout-main">
    <fieldset class="form-section"><legend>Contact</legend>
      <div class="field"><label for="co-name">Full name</label><input id="co-name" name="name" required maxlength="120" autocomplete="name" value="${v.name}"></div>
      <div class="field-row">
        <div class="field"><label for="co-email">Email</label><input id="co-email" type="email" name="email" required autocomplete="email" value="${v.email}"></div>
        <div class="field"><label for="co-phone">Phone (WhatsApp preferred)</label><input id="co-phone" type="tel" name="phone" required autocomplete="tel" placeholder="+234" value="${v.phone}"></div>
      </div>
      ${!u ? html`<p class="fine">Have an account? <a href="/login?next=/checkout">Sign in</a> for faster checkout.</p>` : ''}
    </fieldset>
    <fieldset class="form-section" data-address><legend>Delivery address</legend>
      <div class="field"><label for="co-country">Country</label><select id="co-country" name="country" autocomplete="country" data-quote>
        ${countryList().map((c) => html`<option value="${c.code}" ${sel(v.country, c.code)}>${c.name}</option>`)}
      </select></div>
      <div class="field"><label for="co-line">Street address</label><input id="co-line" name="line" required maxlength="300" autocomplete="street-address" value="${v.line}"></div>
      <div class="field-row">
        <div class="field"><label for="co-city">City / town</label><input id="co-city" name="city" required maxlength="100" autocomplete="address-level2" value="${v.city}" data-quote></div>
        <div class="field" data-ng ${v.country !== 'NG' ? raw('hidden') : ''}><label for="co-state">State</label><select id="co-state" name="state_ng" data-quote ${v.country === 'NG' ? raw('required') : ''}>
          <option value="">Select state</option>${NG_STATES.map((s) => html`<option ${sel(v.state_ng, s)}>${s}</option>`)}</select></div>
        <div class="field" data-intl ${v.country === 'NG' ? raw('hidden') : ''}><label for="co-region">State / region</label><input id="co-region" name="state_intl" maxlength="100" autocomplete="address-level1" value="${v.state_intl}" data-quote></div>
      </div>
      <div class="field"><label for="co-post">Postcode <small>(optional)</small></label><input id="co-post" name="postcode" maxlength="20" autocomplete="postal-code" value="${v.postcode}"></div>
      <noscript><button class="btn btn-outline btn-sm" type="submit" name="refresh" value="1">Update delivery options</button></noscript>
    </fieldset>
    <fieldset class="form-section"><legend>Delivery</legend>
      <div class="ship-opts" data-ship-opts>${address.city || address.state ? optionsBlock(ctx, q2, zoneId) : html`<p class="muted">Enter your address to see delivery options.</p>`}</div>
    </fieldset>
    ${cart.hasMadeToOrder ? html`<fieldset class="form-section"><legend>Bespoke &amp; made-to-order details</legend>
      <div class="field"><label for="co-meas">Measurements and fitting notes</label><textarea id="co-meas" name="measurements" rows="4" maxlength="3000" placeholder="Share your measurements, or tell us how you would like to arrange a fitting.">${v.measurements || ''}</textarea><small>Our team will confirm details with you before production.</small></div>
    </fieldset>` : ''}
    <fieldset class="form-section"><legend>Order note <small>(optional)</small></legend>
      <div class="field"><label class="sr" for="co-note">Order note</label><textarea id="co-note" name="note" rows="3" maxlength="1000">${v.note || ''}</textarea></div>
    </fieldset>
  </div>
  <aside class="summary checkout-summary">
    <h2 class="h3">Your order</h2>
    <ul class="mini-lines">${cart.items.map((i) => html`<li>
      <span class="mini-thumb">${i.image ? picture(i.image, { alt: '', sizes: '64px', small: true }) : ''}<b>${i.qty}</b></span>
      <span class="mini-name">${i.name}<small>${[i.size, i.colour].filter(Boolean).join(' · ')}${i.made_to_order ? ' · Made to order' : ''}</small>${i.issue ? html`<small class="error-text">${i.issue}</small>` : ''}</span>
      <span>${naira(i.line_kobo)}</span></li>`)}</ul>
    <div data-totals>${totalsBlock(q2)}</div>
    <label class="check"><input type="checkbox" name="agree" value="1" required> I have read the <a href="/pages/terms" target="_blank">terms of sale</a>. ${ctx.settings.returns_policy}</label>
    <button class="btn btn-block" type="submit" ${!payReady ? raw('disabled') : ''}>Pay securely</button>
    <p class="fine center">Payments are processed by Paystack: card, bank transfer, USSD and other methods available to you. ANKOO never sees or stores your card details.</p>
  </aside>
</form>`,
  }));
}

async function onPaid(ctx, order) {
  const items = commerce.orderItems(ctx.db, order.id);
  mailer.orderConfirmation(ctx.db, ctx.site, order, items);
  mailer.adminNewOrder(ctx.db, ctx.site, order, items, config.orderNotifyEmail || ctx.settings.business_email);
}

function canView(ctx, o) {
  if (ctx.query.k && safeEqual(ctx.query.k, o.access_key)) return true;
  if (ctx.user && (ctx.user.role === 'admin' || o.user_id === ctx.user.id)) return true;
  return false;
}

module.exports = function register(app) {
  app.get('/checkout', (ctx) => checkoutPage(ctx));

  app.post('/checkout/quote', (ctx) => {
    const cart = commerce.loadCart(ctx.db, ctx.cartId);
    const address = addressFrom(ctx.body);
    const q = commerce.quote(ctx.db, cart, { address, zoneId: ctx.body.zone });
    const zoneId = q.zone ? q.zone.id : (q.options[0] && q.options[0].id);
    const q2 = commerce.quote(ctx.db, cart, { address, zoneId });
    ctx.json({ options: String(optionsBlock(ctx, q2, zoneId)), totals: String(totalsBlock(q2)) });
  }, { api: true });

  app.post('/checkout', async (ctx) => {
    const b = ctx.body;
    const values = { ...b };
    delete values._csrf;
    if (b.refresh) return checkoutPage(ctx, { values });
    let order;
    try {
      const cart = commerce.loadCart(ctx.db, ctx.cartId);
      if (!cart.items.length) return ctx.redirect('/cart');
      const customer = { name: str(b.name, 120), email: email(b.email), phone: phone(b.phone) };
      if (!customer.name) throw new HttpError(400, 'Please enter your full name.');
      const address = addressFrom(b);
      if (!address.line || !address.city || !address.state && address.country === 'NG') throw new HttpError(400, 'Please complete your delivery address.');
      if (!b.agree) throw new HttpError(400, 'Please confirm you have read the terms of sale.');
      const q = commerce.quote(ctx.db, cart, { address, zoneId: b.zone });
      if (!q.zone) throw new HttpError(400, q.options.length ? 'Please choose a delivery option.' : 'Delivery to this address is not yet available online. Please contact us on WhatsApp.');
      if (!paystack.enabled() && !paystack.devMode()) throw new HttpError(503, 'Online payment is being set up. Please complete your order on WhatsApp.');
      order = commerce.createOrder(ctx.db, { cart, user: ctx.user, customer, address, zone: q.zone, q, note: str(b.note, 1000), measurements: str(b.measurements, 3000) });
      if (ctx.user) {
        const addr = { ...jsonParse(ctx.user.address_json, {}), ...address };
        ctx.db.prepare("UPDATE users SET address_json = ?, phone = CASE WHEN phone = '' THEN ? ELSE phone END WHERE id = ?").run(JSON.stringify(addr), customer.phone, ctx.user.id);
      }
    } catch (e) {
      if (e instanceof HttpError && e.status < 500 || e.status === 503) return checkoutPage(ctx, { values, error: e.message });
      throw e;
    }
    if (paystack.devMode()) return ctx.redirect(`/checkout/test-payment/${order.number}?k=${order.access_key}`);
    try {
      const url = await paystack.initialize({
        email: order.email, amountKobo: order.total_kobo, reference: order.payment_ref,
        callbackUrl: `${ctx.site}/checkout/callback`, metadata: { order_number: order.number, custom_fields: [{ display_name: 'Order', variable_name: 'order', value: order.number }] },
      });
      ctx.redirect(url);
    } catch (e) {
      checkoutPage(ctx, { values, error: e.message });
    }
  });

  app.get('/checkout/callback', async (ctx) => {
    const ref = str(ctx.query.reference || ctx.query.trxref, 100);
    const o = ctx.db.prepare('SELECT * FROM orders WHERE payment_ref = ?').get(ref);
    if (!o) throw new HttpError(404, 'Page not found');
    if (!o.paid_at) {
      const v = await paystack.verify(ref);
      if (!v.success) return ctx.redirect('/checkout', { type: 'error', message: 'Your payment was not completed. You have not been charged; please try again.' });
      const r = commerce.markPaid(ctx.db, o.id, { amountKobo: v.amountKobo, currency: v.currency, channel: v.channel });
      if (r.mismatch) throw new HttpError(400, 'We could not confirm this payment. Please contact us with your order number.');
      if (r.newlyPaid) await onPaid(ctx, r.order);
    }
    ctx.redirect(`/order/${o.number}?k=${o.access_key}&new=1`);
  });

  // Development-only payment simulator (disabled when NODE_ENV=production or a Paystack key is set).
  app.get('/checkout/test-payment/:number', (ctx) => {
    if (!paystack.devMode()) throw new HttpError(404, 'Page not found');
    const o = ctx.db.prepare('SELECT * FROM orders WHERE number = ?').get(ctx.params.number);
    if (!o || !canView(ctx, o)) throw new HttpError(404, 'Page not found');
    ctx.html(layout(ctx, {
      title: 'Test payment', noindex: true,
      body: html`<section class="narrow center pad-xl"><p class="eyebrow">Development mode</p><h1 class="display">Test payment</h1>
<p class="lede">Paystack is not configured, so this simulates a successful payment of ${naira(o.total_kobo)} for ${o.number}.</p>
<form method="post" action="/checkout/test-payment/${o.number}">${csrf(ctx)}<input type="hidden" name="k" value="${o.access_key}"><button class="btn" type="submit">Simulate successful payment</button></form>
<p><a href="/checkout">Cancel</a></p></section>`,
    }));
  });
  app.post('/checkout/test-payment/:number', async (ctx) => {
    if (!paystack.devMode()) throw new HttpError(404, 'Page not found');
    const o = ctx.db.prepare('SELECT * FROM orders WHERE number = ?').get(ctx.params.number);
    if (!o || !safeEqual(String(ctx.body.k || ''), o.access_key)) throw new HttpError(404, 'Page not found');
    const r = commerce.markPaid(ctx.db, o.id, { amountKobo: o.total_kobo, currency: 'NGN', channel: 'test' });
    if (r.newlyPaid) await onPaid(ctx, r.order);
    ctx.redirect(`/order/${o.number}?k=${o.access_key}&new=1`);
  });

  app.get('/order/:number', (ctx) => {
    const o = ctx.db.prepare('SELECT * FROM orders WHERE number = ?').get(str(ctx.params.number, 20).toUpperCase());
    if (!o || !canView(ctx, o)) throw new HttpError(404, 'Page not found');
    const items = commerce.orderItems(ctx.db, o.id);
    const events = commerce.orderEvents(ctx.db, o.id);
    const fresh = ctx.query.new === '1' && o.paid_at;
    const wa = whatsapp.link(ctx.settings, `Hello ANKOO, I have a question about my order ${o.number}.`);
    const flow = ['paid', 'processing', 'ready', 'shipped', 'delivered'];
    const at = flow.indexOf(o.status);
    ctx.html(layout(ctx, {
      title: `Order ${o.number}`, noindex: true,
      track: fresh ? { event: 'Purchase', value: o.total_kobo / 100, currency: 'NGN', order: o.number, ids: items.map((i) => i.product_id) } : undefined,
      body: html`<section class="page-head page-head-sm"><div class="page-head-inner">
  <p class="eyebrow">Order ${o.number}</p>
  <h1 class="display">${fresh ? 'Thank you for your order' : commerce.STATUSES[o.status] || o.status}</h1>
  ${fresh ? html`<p class="lede">A confirmation has been sent to ${o.email}. We will keep you updated as your order progresses.</p>` : ''}
  ${o.status === 'pending_payment' ? html`<p class="lede">We have not received payment for this order yet.</p>` : ''}
</div></section>
<div class="order">
  ${at >= 0 ? html`<ol class="progress">${flow.map((s, i) => html`<li class="${i <= at ? 'done' : ''}">${commerce.STATUSES[s]}</li>`)}</ol>` : ''}
  <div class="two-col">
    <div>
      <h2 class="h3">Items</h2>
      <ul class="mini-lines">${items.map((i) => html`<li><span class="mini-thumb">${i.image ? html`<img src="${i.image}" alt="" loading="lazy">` : ''}<b>${i.qty}</b></span><span class="mini-name">${i.name}<small>${[i.size, i.colour].filter(Boolean).join(' · ')}${i.made_to_order ? ' · Made to order' : ''}</small></span><span>${naira(i.unit_kobo * i.qty)}</span></li>`)}</ul>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${naira(o.subtotal_kobo)}</dd></div>
        ${o.discount_kobo ? html`<div><dt>Discount (${o.discount_code})</dt><dd>−${naira(o.discount_kobo)}</dd></div>` : ''}
        <div><dt>Delivery: ${o.zone_name}</dt><dd>${o.shipping_kobo ? naira(o.shipping_kobo) : 'Free'}</dd></div>
        <div class="total"><dt>Total</dt><dd>${naira(o.total_kobo)}</dd></div>
      </dl>
    </div>
    <div>
      <h2 class="h3">Delivery to</h2>
      <p>${o.name}<br>${o.address_line}<br>${[o.city, o.state].filter(Boolean).join(', ')}<br>${countryName(o.country)}${o.postcode ? html`<br>${o.postcode}` : ''}<br>${o.phone}</p>
      <h2 class="h3">Updates</h2>
      <ul class="timeline">${events.slice().reverse().map((e) => html`<li><b>${commerce.STATUSES[e.status] || e.status}</b><span class="muted small">${fmtDateTime(e.created_at)}</span>${e.note && e.note !== 'Order placed' && e.note !== 'Payment confirmed' ? html`<p>${e.note}</p>` : ''}</li>`)}</ul>
      ${wa ? html`<a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">${icons.whatsapp} Questions about this order?</a>` : ''}
    </div>
  </div>
</div>`,
    }));
  });

  // ---- Webhooks ----
  app.post('/webhooks/paystack', async (ctx) => {
    if (!paystack.validSignature(ctx.rawBody, ctx.req.headers['x-paystack-signature'])) return ctx.json({ error: 'invalid signature' }, 401);
    const evt = jsonParse(ctx.rawBody.toString('utf8'), {});
    if (evt.event === 'charge.success' && evt.data) {
      const o = ctx.db.prepare('SELECT * FROM orders WHERE payment_ref = ?').get(String(evt.data.reference || ''));
      if (o) {
        const r = commerce.markPaid(ctx.db, o.id, { amountKobo: evt.data.amount, currency: evt.data.currency, channel: evt.data.channel });
        if (r.newlyPaid) await onPaid(ctx, r.order);
      }
    }
    ctx.json({ ok: true });
  }, { noCsrf: true, api: true, bodyLimit: 2e5 });

  app.get('/webhooks/whatsapp', (ctx) => {
    const q = ctx.query;
    if (q['hub.mode'] === 'subscribe' && config.whatsapp.verifyToken && safeEqual(String(q['hub.verify_token'] || ''), config.whatsapp.verifyToken)) {
      return ctx.send(200, String(q['hub.challenge'] || ''), { 'Content-Type': 'text/plain' });
    }
    ctx.send(403, 'forbidden', { 'Content-Type': 'text/plain' });
  });
  app.post('/webhooks/whatsapp', (ctx) => {
    if (!whatsapp.validSignature(ctx.rawBody, ctx.req.headers['x-hub-signature-256'])) return ctx.json({ error: 'invalid signature' }, 401);
    const payload = jsonParse(ctx.rawBody.toString('utf8'), {});
    ctx.json({ ok: true }); // acknowledge immediately; Meta retries slow webhooks
    whatsapp.handleWebhook(ctx.db, ctx.settings, ctx.site, payload).catch((e) => console.error('WhatsApp webhook', e));
  }, { noCsrf: true, api: true, bodyLimit: 1e6 });
};
