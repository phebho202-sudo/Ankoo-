'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { html, raw, str, int, naira, toKobo, slugify, HttpError, now, token, email, safeUrl, csv, fmtDate, jsonParse } = require('../util');
const { setSetting, tx } = require('../db');
const config = require('../config');
const catalog = require('../catalog');
const commerce = require('../commerce');
const mailer = require('../mailer');
const paystack = require('../paystack');
const whatsapp = require('../whatsapp');
const { JOURNAL_CATEGORIES } = require('./content');
const { NG_STATES } = require('../geo');
const ui = require('../views/admin-ui');

const ADMIN = { admin: true };
const STATUS_OPTS = Object.entries(commerce.STATUSES);

function uniqueSlug(db, table, base, id) {
  let slug = slugify(base); let n = 1;
  while (db.prepare(`SELECT 1 FROM ${table} WHERE slug = ? AND ${table === 'pages' ? 'slug' : 'id'} != ?`).get(slug, id ?? -1)) slug = `${slugify(base)}-${++n}`;
  return slug;
}

// ---------- Generic CRUD ----------
function parseField(f, b) {
  const v = b[f.name];
  switch (f.type) {
    case 'checkbox': return v ? 1 : 0;
    case 'number': return v === '' || v === undefined ? (f.nullable ? null : 0) : int(v, 0, f.min ?? -1e9, f.max ?? 1e9);
    case 'money': return toKobo(v, { allowEmpty: !f.required, allowZero: Boolean(f.allowZero) });
    case 'datetime': return ui.localToIso(str(v, 30));
    case 'media': return v ? int(v, null) : null;
    case 'select': { const s = str(v, 60); if (!f.options.some(([o]) => String(o) === s)) throw new HttpError(400, `Choose a valid ${f.label.toLowerCase()}`); return s; }
    case 'markdown': return str(v, 50000);
    case 'textarea': return str(v, f.maxlength || 5000);
    default: return str(v, f.maxlength || 300);
  }
}

function crud(app, def) {
  const base = `/admin/${def.key}`;
  const cols = def.fields.filter((f) => !f.virtual).map((f) => f.name);
  const formPage = (ctx, row) => {
    const values = row ? (def.load ? def.load(row) : row) : {};
    for (const [k, v] of Object.entries(ctx.old || {})) if (!['_csrf'].includes(k)) values[k] = def.fields.find((f) => f.name === k && f.type === 'money') ? (v === '' ? '' : Math.round(Number(v) * 100)) : v;
    ctx.html(ui.shell(ctx, {
      title: row ? `Edit ${def.singular}` : `New ${def.singular}`,
      actions: html`<a class="a-btn a-btn-ghost" href="${base}">← All ${def.title.toLowerCase()}</a>${row && def.viewUrl ? html` <a class="a-btn a-btn-ghost" href="${def.viewUrl(row)}" target="_blank">View ↗</a>` : ''}`,
      body: html`${def.intro ? html`<p class="a-intro">${def.intro}</p>` : ''}
<form class="a-form" method="post" action="${row ? `${base}/${row[def.pk || 'id']}` : `${base}/new`}">
  <input type="hidden" name="_csrf" value="${ctx.csrf}">
  <div class="a-grid">${def.fields.map((f) => ui.field(ctx, f, values[f.name]))}</div>
  <div class="a-bar"><button class="a-btn" type="submit">Save</button></div>
</form>
${row && def.deletable !== false && (!def.canDelete || def.canDelete(row)) ? html`<form method="post" action="${base}/${row[def.pk || 'id']}/delete" class="a-danger" data-confirm="Delete this ${def.singular}? This cannot be undone."><input type="hidden" name="_csrf" value="${ctx.csrf}"><button class="a-btn a-btn-danger" type="submit">Delete ${def.singular}</button></form>` : ''}`,
    }));
  };
  const save = (ctx, existing) => {
    const parsed = {};
    for (const f of def.fields) parsed[f.name] = parseField(f, ctx.body);
    for (const f of def.fields) if (f.required && (parsed[f.name] === '' || parsed[f.name] === null)) throw new HttpError(400, `${f.label} is required`);
    const values = def.prepare ? def.prepare(parsed, ctx, existing) : parsed;
    const keys = Object.keys(values).filter((k) => cols.includes(k) || (def.extraCols || []).includes(k));
    const pk = def.pk || 'id';
    if (existing) {
      ctx.db.prepare(`UPDATE ${def.table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${pk} = ?`).run(...keys.map((k) => values[k]), existing[pk]);
      return existing[pk];
    }
    const r = ctx.db.prepare(`INSERT INTO ${def.table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => values[k]));
    return def.pk ? values[def.pk] : Number(r.lastInsertRowid);
  };
  const get = (ctx) => ctx.db.prepare(`SELECT * FROM ${def.table} WHERE ${def.pk || 'id'} = ?`).get(ctx.params.id);

  app.get(base, (ctx) => {
    const rows = ctx.db.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.orderBy || 'id DESC'} LIMIT 500`).all();
    ctx.html(ui.shell(ctx, {
      title: def.title,
      actions: def.creatable === false ? '' : html`<a class="a-btn" href="${base}/new">+ New ${def.singular}</a>`,
      body: html`${def.intro ? html`<p class="a-intro">${def.intro}</p>` : ''}
${rows.length ? html`<div class="a-table-wrap"><table class="a-table"><thead><tr>${def.columns.map(([l]) => html`<th>${l}</th>`)}<th></th></tr></thead><tbody>
${rows.map((r) => html`<tr>${def.columns.map(([l, fn]) => html`<td data-label="${l}">${fn(r, ctx)}</td>`)}<td><a class="a-btn a-btn-sm a-btn-ghost" href="${base}/${r[def.pk || 'id']}">Edit</a></td></tr>`)}
</tbody></table></div>` : html`<div class="a-empty">${def.empty || `No ${def.title.toLowerCase()} yet.`}</div>`}`,
    }));
  }, ADMIN);
  app.get(`${base}/new`, (ctx) => formPage(ctx, null), ADMIN);
  app.get(`${base}/:id`, (ctx) => { const r = get(ctx); if (!r) throw new HttpError(404, 'Not found'); formPage(ctx, r); }, ADMIN);
  app.post(`${base}/new`, (ctx) => { const id = save(ctx, null); if (def.after) def.after(ctx, id); ctx.redirect(`${base}/${id}`, { type: 'success', message: 'Saved.' }); }, ADMIN);
  app.post(`${base}/:id`, (ctx) => { const r = get(ctx); if (!r) throw new HttpError(404, 'Not found'); const id = save(ctx, r); if (def.after) def.after(ctx, id); ctx.redirect(`${base}/${id}`, { type: 'success', message: 'Saved.' }); }, ADMIN);
  app.post(`${base}/:id/delete`, (ctx) => {
    const r = get(ctx);
    if (!r || def.deletable === false || (def.canDelete && !def.canDelete(r))) throw new HttpError(404, 'Not found');
    ctx.db.prepare(`DELETE FROM ${def.table} WHERE ${def.pk || 'id'} = ?`).run(r[def.pk || 'id']);
    ctx.redirect(base, { type: 'success', message: 'Deleted.' });
  }, ADMIN);
}

const yes = (v) => (v ? '✓' : '—');
const thumb = (k) => (r, ctx) => ui.mediaThumb(ctx.db, r[k]);

// ---------- Media ----------
const IMAGE_SIGS = [
  ['jpg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['png', (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['webp', (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'],
  ['gif', (b) => b.slice(0, 4).toString() === 'GIF8'],
  ['avif', (b) => b.slice(4, 12).toString() === 'ftypavif'],
  ['svg', (b) => { const s = b.slice(0, 4096).toString('utf8').trim(); return (s.startsWith('<svg') || s.startsWith('<?xml')) && s.includes('<svg'); }],
];
function imageExt(buf) { const hit = IMAGE_SIGS.find(([, t]) => t(buf)); return hit ? hit[0] : null; }
function videoExt(buf) {
  if (buf.slice(4, 8).toString() === 'ftyp') return buf.slice(8, 10).toString() === 'qt' ? 'mov' : 'mp4';
  if (buf.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'webm';
  return null;
}
function checkSvg(buf) {
  const s = buf.toString('utf8');
  if (/<script|on\w+\s*=|javascript:|<foreignObject/i.test(s)) throw new HttpError(400, 'This SVG contains scripts and cannot be used. Export a plain SVG or PNG.');
}
function writeUpload(name, buf) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadDir, name), buf);
}
function deleteMediaFiles(m) {
  for (const f of [m.file, m.file_sm]) if (f) { try { fs.unlinkSync(path.join(config.uploadDir, path.basename(f))); } catch { /* gone */ } }
}

// ---------- Setup checklist ----------
function checklist(ctx) {
  const s = ctx.settings; const db = ctx.db;
  return [
    ['Upload the ANKOO logo', Boolean(s.logo_media_id), '/admin/settings'],
    ['Add your WhatsApp number', Boolean(s.whatsapp_number), '/admin/settings'],
    ['Add your verified business email', Boolean(s.business_email), '/admin/settings'],
    ['Add Instagram, Facebook and TikTok links', Boolean(s.instagram_url || s.facebook_url || s.tiktok_url), '/admin/settings'],
    ['Add Akure and Lagos addresses', (s.locations || []).some((l) => l.address), '/admin/settings'],
    ['Set delivery fees and switch on shipping zones', Boolean(db.prepare('SELECT 1 FROM shipping_zones WHERE active = 1 AND fee_kobo IS NOT NULL').get()), '/admin/shipping'],
    ['Add your first products', Boolean(db.prepare("SELECT 1 FROM products WHERE status = 'active'").get()), '/admin/products/new'],
    ['Add a hero banner with ANKOO photography', Boolean(db.prepare('SELECT 1 FROM slides WHERE active = 1').get()), '/admin/slides/new'],
    ['Replace the About page with your story', !db.prepare("SELECT needs_review FROM pages WHERE slug = 'about'").get().needs_review, '/admin/pages/about'],
    ['Review delivery, returns, privacy and terms pages', !db.prepare("SELECT 1 FROM pages WHERE needs_review = 1 AND slug != 'about'").get(), '/admin/pages'],
    ['Connect Paystack (PAYSTACK_SECRET_KEY)', paystack.enabled(), null],
    ['Connect email sending (RESEND_API_KEY, MAIL_FROM)', mailer.enabled(), null],
  ];
}

module.exports = function register(app) {
  // ================= Dashboard =================
  app.get('/admin', (ctx) => {
    const db = ctx.db;
    const days = [7, 30, 90, 365].includes(int(ctx.query.p)) ? int(ctx.query.p) : 30;
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const paidWhere = "paid_at IS NOT NULL AND status != 'cancelled'";
    const agg = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total_kobo),0) AS rev FROM orders WHERE ${paidWhere} AND paid_at >= ?`).get(since);
    const prevSince = new Date(Date.now() - 2 * days * 864e5).toISOString();
    const prev = db.prepare(`SELECT COALESCE(SUM(total_kobo),0) AS rev FROM orders WHERE ${paidWhere} AND paid_at >= ? AND paid_at < ?`).get(prevSince, since);
    const customers = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND created_at >= ?").get(since).n;
    const subs = db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed_at IS NULL').get().n;
    const pending = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND status = 'pending_payment'").get(since).n;
    const series = [];
    const byDay = new Map(db.prepare(`SELECT substr(datetime(paid_at, '+1 hour'), 1, 10) AS d, SUM(total_kobo) AS k, COUNT(*) AS n FROM orders WHERE ${paidWhere} AND paid_at >= ? GROUP BY d`).all(since).map((r) => [r.d, r]));
    const span = Math.min(days, 90);
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(Date.now() + 3600e3 - i * 864e5).toISOString().slice(0, 10);
      const r = byDay.get(d);
      series.push({ day: d, kobo: r ? r.k : 0, orders: r ? r.n : 0 });
    }
    const top = db.prepare(`SELECT oi.name, SUM(oi.qty) AS units, SUM(oi.qty * oi.unit_kobo) AS rev FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.${paidWhere.replace(/ AND /, ' AND o.')} AND o.paid_at >= ? GROUP BY oi.product_id, oi.name ORDER BY units DESC LIMIT 8`).all(since);
    const recent = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8').all();
    const low = db.prepare(`SELECT v.*, p.name, p.id AS pid FROM variants v JOIN products p ON p.id = v.product_id
      WHERE p.status = 'active' AND p.made_to_order = 0 AND v.active = 1 AND v.stock <= ? ORDER BY v.stock, p.name LIMIT 12`).all(ctx.settings.low_stock_threshold ?? 3);
    const issues = db.prepare('SELECT * FROM orders WHERE stock_issue = 1 AND status NOT IN (\'delivered\',\'cancelled\') ORDER BY created_at DESC').all();
    const steps = checklist(ctx);
    const done = steps.filter((s) => s[1]).length;
    const change = prev.rev ? Math.round(((agg.rev - prev.rev) / prev.rev) * 100) : null;

    ctx.html(ui.shell(ctx, {
      title: 'Dashboard',
      actions: html`<nav class="a-seg">${[7, 30, 90, 365].map((d) => html`<a href="/admin?p=${d}" class="${d === days ? 'on' : ''}">${d === 365 ? '12 months' : `${d} days`}</a>`)}</nav>`,
      body: html`
${done < steps.length ? html`<section class="a-card a-setup"><h2>Launch checklist <small>${done} of ${steps.length} done</small></h2><ul>${steps.map(([label, ok, href]) => html`<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${href && !ok ? html`<a href="${href}">${label}</a>` : label}</li>`)}</ul>
${!paystack.enabled() ? html`<p class="a-note">Payments: ${config.production ? 'checkout is disabled until a Paystack secret key is set.' : 'development test payments are active. Set PAYSTACK_SECRET_KEY to take real payments.'}</p>` : ''}</section>` : ''}
${issues.length ? html`<div class="a-flash a-flash-error">${issues.length} paid order(s) need a stock check: ${issues.map((o) => html`<a href="/admin/orders/${o.id}">${o.number}</a> `)}</div>` : ''}
<div class="kpis">
  ${ui.kpi('Revenue', naira(agg.rev), change === null ? `Last ${days} days` : `${change >= 0 ? '+' : ''}${change}% vs previous ${days} days`)}
  ${ui.kpi('Paid orders', agg.n, pending ? `${pending} awaiting payment` : '')}
  ${ui.kpi('Average order', agg.n ? naira(Math.round(agg.rev / agg.n)) : '—')}
  ${ui.kpi('New customers', customers, `${subs} newsletter subscribers`)}
</div>
<section class="a-card"><h2>Revenue per day <small>last ${span} days, Nigeria time</small></h2>${ui.revenueChart(series)}</section>
<div class="a-cols">
  <section class="a-card"><h2>Recent orders</h2>${recent.length ? html`<table class="a-table a-compact"><tbody>${recent.map((o) => html`<tr><td><a href="/admin/orders/${o.id}">${o.number}</a><br><small>${o.name}</small></td><td>${ui.statusPill(commerce.STATUSES, o.status)}</td><td class="num">${naira(o.total_kobo)}</td></tr>`)}</tbody></table>` : html`<p class="a-empty">No orders yet.</p>`}</section>
  <section class="a-card"><h2>Top products</h2>${top.length ? html`<table class="a-table a-compact"><tbody>${top.map((t) => html`<tr><td>${t.name}</td><td class="num">${t.units} sold</td><td class="num">${naira(t.rev)}</td></tr>`)}</tbody></table>` : html`<p class="a-empty">Sales will appear here.</p>`}</section>
</div>
<section class="a-card"><h2>Low stock</h2>${low.length ? html`<table class="a-table a-compact"><tbody>${low.map((v) => html`<tr><td><a href="/admin/products/${v.pid}">${v.name}</a></td><td>${[v.size, v.colour].filter(Boolean).join(' · ') || 'Default'}</td><td class="num ${v.stock === 0 ? 'neg' : ''}">${v.stock} left</td></tr>`)}</tbody></table>` : html`<p class="a-empty">All stocked products are above the low-stock threshold.</p>`}</section>`,
    }));
  }, ADMIN);

  // ================= Orders =================
  app.get('/admin/orders', (ctx) => {
    const status = commerce.STATUSES[ctx.query.status] ? ctx.query.status : '';
    const q = str(ctx.query.q, 80);
    const where = []; const args = [];
    if (status) { where.push('status = ?'); args.push(status); } else if (ctx.query.all !== '1') where.push("status != 'pending_payment'");
    if (q) { where.push('(number LIKE ? OR email LIKE ? OR name LIKE ? OR phone LIKE ?)'); const l = `%${q}%`; args.push(l, l, l, l); }
    const rows = ctx.db.prepare(`SELECT o.*, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS units FROM orders o ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 300`).all(...args);
    ctx.html(ui.shell(ctx, {
      title: 'Orders',
      actions: html`<a class="a-btn a-btn-ghost" href="/admin/orders.csv">Export CSV</a>`,
      body: html`<form class="a-filter" method="get"><input name="q" value="${q}" placeholder="Search number, name, email, phone"><select name="status"><option value="">Active &amp; paid orders</option>${STATUS_OPTS.map(([k, l]) => html`<option value="${k}" ${k === status ? raw('selected') : ''}>${l}</option>`)}</select><button class="a-btn a-btn-sm" type="submit">Filter</button> <a href="/admin/orders?all=1">Include unpaid</a></form>
${rows.length ? html`<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Delivery</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
${rows.map((o) => html`<tr><td data-label="Order"><a href="/admin/orders/${o.id}"><b>${o.number}</b></a>${o.stock_issue ? html` <span class="pill s-cancelled">stock check</span>` : ''}${o.measurements ? html` <span class="pill">bespoke</span>` : ''}</td><td data-label="Date">${ui.when(o.created_at)}</td><td data-label="Customer">${o.name}<br><small>${o.phone}</small></td><td data-label="Delivery">${o.zone_name}<br><small>${o.city}, ${o.state}</small></td><td data-label="Status">${ui.statusPill(commerce.STATUSES, o.status)}</td><td data-label="Total" class="num">${naira(o.total_kobo)}<br><small>${o.units} item(s)</small></td></tr>`)}
</tbody></table></div>` : html`<div class="a-empty">No orders match.</div>`}`,
    }));
  }, ADMIN);

  app.get('/admin/orders.csv', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    const out = [['number', 'created_at', 'paid_at', 'status', 'name', 'email', 'phone', 'address', 'city', 'state', 'country', 'delivery', 'subtotal_ngn', 'discount_ngn', 'discount_code', 'delivery_ngn', 'total_ngn', 'payment_channel']];
    for (const o of rows) out.push([o.number, o.created_at, o.paid_at, o.status, o.name, o.email, o.phone, o.address_line, o.city, o.state, o.country, o.zone_name, o.subtotal_kobo / 100, o.discount_kobo / 100, o.discount_code, o.shipping_kobo / 100, o.total_kobo / 100, o.payment_channel]);
    ctx.send(200, csv(out), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ankoo-orders-${new Date().toISOString().slice(0, 10)}.csv"` });
  }, ADMIN);

  app.get('/admin/orders/:id', (ctx) => {
    const o = ctx.db.prepare('SELECT * FROM orders WHERE id = ?').get(int(ctx.params.id));
    if (!o) throw new HttpError(404, 'Not found');
    const items = commerce.orderItems(ctx.db, o.id);
    const events = commerce.orderEvents(ctx.db, o.id, false);
    const custWa = whatsapp.normalizeNumber(o.phone);
    const waMsg = `Hello ${o.name.split(' ')[0]}, this is ANKOO about your order ${o.number}. `;
    ctx.html(ui.shell(ctx, {
      title: `Order ${o.number}`,
      actions: html`<a class="a-btn a-btn-ghost" href="/admin/orders">← Orders</a> <button class="a-btn a-btn-ghost" type="button" data-print>Print packing slip</button>`,
      body: html`<div class="a-cols a-cols-wide">
<div>
  <section class="a-card"><h2>Items ${ui.statusPill(commerce.STATUSES, o.status)}</h2>
    <table class="a-table a-compact"><tbody>${items.map((i) => html`<tr><td>${i.image ? html`<img class="a-thumb" src="${i.image}" alt="">` : ''}</td><td>${i.product_id ? html`<a href="/admin/products/${i.product_id}">${i.name}</a>` : i.name}<br><small>${[i.size, i.colour].filter(Boolean).join(' · ')}${i.made_to_order ? ' · Made to order' : ''}</small></td><td class="num">× ${i.qty}</td><td class="num">${naira(i.unit_kobo * i.qty)}</td></tr>`)}</tbody></table>
    <dl class="a-totals"><dt>Subtotal</dt><dd>${naira(o.subtotal_kobo)}</dd>${o.discount_kobo ? html`<dt>Discount ${o.discount_code}</dt><dd>−${naira(o.discount_kobo)}</dd>` : ''}<dt>Delivery (${o.zone_name})</dt><dd>${naira(o.shipping_kobo)}</dd><dt><b>Total</b></dt><dd><b>${naira(o.total_kobo)}</b></dd></dl>
    <p class="a-note">${o.paid_at ? `Paid ${ui.when(o.paid_at)} via ${o.payment_channel || 'Paystack'} · ref ${o.payment_ref}` : 'Not paid.'}</p>
    ${o.stock_issue ? html`<div class="a-flash a-flash-error">Stock check needed: at least one item had less stock than ordered when payment arrived.</div>` : ''}
  </section>
  ${o.measurements ? html`<section class="a-card"><h2>Measurements &amp; bespoke notes</h2><p class="pre">${o.measurements}</p></section>` : ''}
  ${o.customer_note ? html`<section class="a-card"><h2>Customer note</h2><p class="pre">${o.customer_note}</p></section>` : ''}
  <section class="a-card no-print"><h2>Update status</h2>
    <form class="a-form" method="post" action="/admin/orders/${o.id}/status"><input type="hidden" name="_csrf" value="${ctx.csrf}">
      <div class="a-grid">
        <div class="a-field"><label for="st">Status</label><select id="st" name="status">${STATUS_OPTS.map(([k, l]) => html`<option value="${k}" ${k === o.status ? raw('selected') : ''}>${l}</option>`)}</select></div>
        <div class="a-field wide"><label for="nt">Note</label><textarea id="nt" name="note" rows="3" placeholder="e.g. dispatched with courier, tracking details"></textarea></div>
        <div class="a-field a-check"><label><input type="checkbox" name="public" value="1" checked> Show note to customer on their order page</label></div>
        <div class="a-field a-check"><label><input type="checkbox" name="notify" value="1" checked> Email the customer about this update</label></div>
        <div class="a-field a-check"><label><input type="checkbox" name="restock" value="1"> When cancelling a paid order: return items to stock</label></div>
      </div>
      <div class="a-bar"><button class="a-btn" type="submit">Save update</button></div>
    </form>
  </section>
</div>
<div>
  <section class="a-card"><h2>Customer</h2><p><b>${o.name}</b><br><a href="mailto:${o.email}">${o.email}</a><br>${o.phone}</p>
    ${custWa ? html`<p class="no-print"><a class="a-btn a-btn-sm" href="https://wa.me/${custWa}?text=${encodeURIComponent(waMsg)}" target="_blank" rel="noopener">WhatsApp customer</a></p>` : ''}
    ${o.user_id ? html`<p><a href="/admin/customers/${o.user_id}">Customer account →</a></p>` : html`<p><small>Guest checkout</small></p>`}
  </section>
  <section class="a-card"><h2>Delivery</h2><p>${o.zone_name}</p><p>${o.address_line}<br>${o.city}, ${o.state}<br>${o.country}${o.postcode ? html`<br>${o.postcode}` : ''}</p></section>
  <section class="a-card no-print"><h2>Timeline</h2><ul class="a-timeline">${events.slice().reverse().map((e) => html`<li><b>${commerce.STATUSES[e.status] || e.status}</b> <small>${ui.when(e.created_at)}${e.public ? '' : ' · internal'}${e.notified ? ' · emailed' : ''}</small>${e.note ? html`<p>${e.note}</p>` : ''}</li>`)}</ul>
  <p><a href="/order/${o.number}?k=${o.access_key}" target="_blank">Customer's order page ↗</a></p></section>
</div></div>`,
    }));
  }, ADMIN);

  app.post('/admin/orders/:id/status', (ctx) => {
    const o = ctx.db.prepare('SELECT * FROM orders WHERE id = ?').get(int(ctx.params.id));
    if (!o) throw new HttpError(404, 'Not found');
    const status = str(ctx.body.status, 30);
    if (!commerce.STATUSES[status]) throw new HttpError(400, 'Choose a valid status');
    const note = str(ctx.body.note, 2000);
    const notify = Boolean(ctx.body.notify) && status !== o.status || Boolean(ctx.body.notify) && note;
    tx(ctx.db, () => {
      if (status === 'cancelled' && o.status !== 'cancelled' && o.paid_at && ctx.body.restock) {
        for (const it of commerce.orderItems(ctx.db, o.id)) {
          if (!it.made_to_order && it.variant_id) ctx.db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run(it.qty, it.variant_id);
        }
      }
      ctx.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), o.id);
      ctx.db.prepare('INSERT INTO order_events (order_id, status, note, public, notified, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(o.id, status, note, ctx.body.public ? 1 : 0, notify ? 1 : 0, now());
    });
    if (notify) mailer.statusUpdate(ctx.db, ctx.site, { ...o, status }, ctx.body.public ? note : '');
    ctx.redirect(`/admin/orders/${o.id}`, { type: 'success', message: `Order updated${notify ? ' and the customer has been emailed' : ''}.` });
  }, ADMIN);

  // ================= Products =================
  app.get('/admin/products', (ctx) => {
    const q = str(ctx.query.q, 80);
    const st = ['draft', 'active', 'archived'].includes(ctx.query.status) ? ctx.query.status : '';
    const where = []; const args = [];
    if (q) { where.push('name LIKE ?'); args.push(`%${q}%`); }
    if (st) { where.push('status = ?'); args.push(st); }
    const rows = catalog.decorate(ctx.db, ctx.db.prepare(`SELECT * FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY status = 'active' DESC, sort, created_at DESC LIMIT 500`).all(...args));
    ctx.html(ui.shell(ctx, {
      title: 'Products',
      actions: html`<a class="a-btn" href="/admin/products/new">+ New product</a>`,
      body: html`<form class="a-filter" method="get"><input name="q" value="${q}" placeholder="Search products"><select name="status"><option value="">All statuses</option>${['active', 'draft', 'archived'].map((s) => html`<option ${s === st ? raw('selected') : ''}>${s}</option>`)}</select><button class="a-btn a-btn-sm" type="submit">Filter</button></form>
${rows.length ? html`<div class="a-table-wrap"><table class="a-table"><thead><tr><th></th><th>Product</th><th>Status</th><th class="num">Price</th><th class="num">Stock</th><th></th></tr></thead><tbody>
${rows.map((p) => html`<tr><td>${p.images[0] ? html`<img class="a-thumb" src="${catalog.mediaUrl(p.images[0], true)}" alt="">` : ''}</td><td data-label="Product"><a href="/admin/products/${p.id}"><b>${p.name}</b></a>${p.featured ? html` <span class="pill">featured</span>` : ''}</td><td data-label="Status"><span class="pill s-${p.status}">${p.status}</span></td><td data-label="Price" class="num">${naira(p.price_kobo)}</td><td data-label="Stock" class="num">${p.made_to_order ? 'Made to order' : p.stock}</td><td><a class="a-btn a-btn-sm a-btn-ghost" href="/admin/products/${p.id}">Edit</a></td></tr>`)}
</tbody></table></div>` : html`<div class="a-empty">No products yet. <a href="/admin/products/new">Add your first product</a>, using real ANKOO photography, prices and sizes.</div>`}`,
    }));
  }, ADMIN);

  function productForm(ctx, p) {
    const cols = ctx.db.prepare('SELECT * FROM collections ORDER BY sort, name').all();
    const mine = p ? new Set(ctx.db.prepare('SELECT collection_id FROM product_collections WHERE product_id = ?').all(p.id).map((r) => r.collection_id)) : new Set();
    const images = p ? ctx.db.prepare('SELECT m.* FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = ? ORDER BY pi.position, pi.id').all(p.id) : [];
    const variants = p ? ctx.db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY id').all(p.id) : [];
    const v = p || { status: 'draft', made_to_order: 0, featured: 0, bestseller: 0, sort: 0 };
    const f = (def) => ui.field(ctx, def, v[def.name]);
    ctx.html(ui.shell(ctx, {
      title: p ? p.name : 'New product',
      actions: html`<a class="a-btn a-btn-ghost" href="/admin/products">← Products</a>${p ? html` <a class="a-btn a-btn-ghost" href="/product/${p.slug}" target="_blank">View ↗</a>` : ''}`,
      body: html`<form class="a-form" method="post" action="${p ? `/admin/products/${p.id}` : '/admin/products/new'}" data-product-form>
<input type="hidden" name="_csrf" value="${ctx.csrf}">
<div class="a-cols a-cols-wide">
<div>
  <section class="a-card"><h2>Product</h2><div class="a-grid">
    ${f({ name: 'name', label: 'Name', required: true, wide: true, maxlength: 140 })}
    ${f({ name: 'subtitle', label: 'Short line (optional)', wide: true, maxlength: 140, help: 'e.g. Hand-finished agbada set' })}
    ${f({ name: 'description', label: 'Description', type: 'markdown', rows: 6 })}
    ${f({ name: 'details', label: 'Fabric & material details', type: 'markdown', rows: 4, help: 'Only include details you have confirmed.' })}
    ${f({ name: 'care', label: 'Care instructions', type: 'markdown', rows: 3 })}
  </div></section>
  <section class="a-card"><h2>Photographs</h2>
    <p class="a-note">The first photograph is the main image. Use authentic ANKOO photography; images are resized in your browser before upload.</p>
    <div class="a-images" data-images>${images.map((m) => html`<figure data-id="${m.id}"><img src="${catalog.mediaUrl(m, true)}" alt=""><input type="hidden" name="images[]" value="${m.id}"><div><button type="button" data-left aria-label="Move left">←</button><button type="button" data-right aria-label="Move right">→</button><button type="button" data-remove aria-label="Remove">✕</button></div></figure>`)}</div>
    <button class="a-btn a-btn-sm" type="button" data-add-images>+ Add photographs</button>
  </section>
  <section class="a-card"><h2>Sizes, colours &amp; stock</h2>
    <div class="a-grid">
      <div class="a-field"><label for="opt-sizes">Sizes</label><input id="opt-sizes" data-opt-sizes value="${[...new Set(variants.filter((x) => x.active).map((x) => x.size).filter(Boolean))].join(', ')}" placeholder="e.g. S, M, L, XL"><small>Comma separated. Leave empty for one size.</small></div>
      <div class="a-field"><label for="opt-colours">Colours</label><input id="opt-colours" data-opt-colours value="${[...new Set(variants.filter((x) => x.active).map((x) => x.colour).filter(Boolean))].join(', ')}" placeholder="e.g. Forest Green, Ivory"><small>Comma separated. Leave empty for one colour.</small></div>
    </div>
    <p><button class="a-btn a-btn-sm" type="button" data-gen-variants>Update option table</button></p>
    <div class="a-table-wrap"><table class="a-table a-compact a-variants"><thead><tr><th>Size</th><th>Colour</th><th>Stock</th><th>SKU</th><th>On sale</th></tr></thead><tbody data-variants>
      ${(variants.length ? variants : [{ id: '', size: '', colour: '', stock: 0, sku: '', active: 1 }]).map((x) => html`<tr><td><input type="hidden" name="v_size[]" value="${x.size}">${x.size || '—'}</td><td><input type="hidden" name="v_colour[]" value="${x.colour}">${x.colour || '—'}</td><td><input type="number" name="v_stock[]" value="${x.stock}" min="0" max="100000"></td><td><input name="v_sku[]" value="${x.sku}" maxlength="60"></td><td><select name="v_active[]"><option value="1" ${x.active ? raw('selected') : ''}>Yes</option><option value="0" ${x.active ? '' : raw('selected')}>No</option></select></td></tr>`)}
    </tbody></table></div>
    <p class="a-note">Stock is reduced automatically when an order is paid. For made-to-order pieces stock is not tracked.</p>
  </section>
</div>
<div>
  <section class="a-card"><h2>Publishing</h2><div class="a-grid one">
    ${f({ name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft (hidden)'], ['active', 'Active (on sale)'], ['archived', 'Archived']] })}
    ${f({ name: 'price_kobo', label: 'Price', type: 'money', required: true, help: 'In Nigerian Naira.' })}
    ${f({ name: 'compare_at_kobo', label: 'Original price (optional)', type: 'money', help: 'Shown crossed out when higher than the price.' })}
    ${f({ name: 'made_to_order', label: 'Made to order / bespoke (stock not tracked)', type: 'checkbox' })}
    ${f({ name: 'featured', label: 'Feature on the homepage', type: 'checkbox' })}
    ${f({ name: 'bestseller', label: 'Show in Bestsellers', type: 'checkbox', help: 'Bestsellers also fill automatically from sales.' })}
    ${f({ name: 'sort', label: 'Sort order', type: 'number', help: 'Lower numbers appear first.' })}
  </div></section>
  <section class="a-card"><h2>Collections</h2>${cols.map((c) => html`<label class="a-checkline"><input type="checkbox" name="collections[]" value="${c.id}" ${mine.has(c.id) ? raw('checked') : ''}> ${c.name}</label>`)}</section>
  <section class="a-card"><h2>Search &amp; sharing</h2><div class="a-grid one">
    ${f({ name: 'slug', label: 'URL', help: p ? `/product/${p.slug}` : 'Created from the name if empty.', maxlength: 80 })}
    ${f({ name: 'seo_title', label: 'Page title (optional)', maxlength: 70 })}
    ${f({ name: 'seo_description', label: 'Meta description (optional)', type: 'textarea', rows: 3, maxlength: 300 })}
  </div></section>
</div></div>
<div class="a-bar a-bar-sticky"><button class="a-btn" type="submit">Save product</button></div>
</form>
${p ? html`<form method="post" action="/admin/products/${p.id}/delete" class="a-danger" data-confirm="Delete this product permanently? Past orders keep their details. Consider archiving instead."><input type="hidden" name="_csrf" value="${ctx.csrf}"><button class="a-btn a-btn-danger" type="submit">Delete product</button></form>` : ''}`,
    }));
  }

  function saveProduct(ctx, existing) {
    const b = ctx.body;
    const name = str(b.name, 140);
    if (!name) throw new HttpError(400, 'Name is required');
    const status = ['draft', 'active', 'archived'].includes(b.status) ? b.status : 'draft';
    const price = toKobo(b.price_kobo);
    const compare = toKobo(b.compare_at_kobo, { allowEmpty: true });
    const slug = uniqueSlug(ctx.db, 'products', str(b.slug, 80) || name, existing && existing.id);
    const sizes = [].concat(b['v_size[]'] || []); const colours = [].concat(b['v_colour[]'] || []);
    const stocks = [].concat(b['v_stock[]'] || []); const skus = [].concat(b['v_sku[]'] || []); const actives = [].concat(b['v_active[]'] || []);
    const rows = sizes.map((s, i) => ({ size: str(s, 40), colour: str(colours[i], 40), stock: int(stocks[i], 0, 0, 100000), sku: str(skus[i], 60), active: actives[i] === '0' ? 0 : 1 }));
    if (!rows.length) rows.push({ size: '', colour: '', stock: 0, sku: '', active: 1 });
    const seen = new Set();
    for (const r of rows) { const k = `${r.size}|${r.colour}`; if (seen.has(k)) throw new HttpError(400, `The option ${r.size} ${r.colour} is listed twice.`); seen.add(k); }
    const imageIds = [].concat(b['images[]'] || []).map((x) => int(x)).filter((x) => x > 0);
    const colIds = [].concat(b['collections[]'] || []).map((x) => int(x)).filter((x) => x > 0);
    return tx(ctx.db, () => {
      const vals = [name, slug, str(b.subtitle, 140), str(b.description, 20000), str(b.details, 10000), str(b.care, 5000), price, compare, status,
        b.made_to_order ? 1 : 0, b.featured ? 1 : 0, b.bestseller ? 1 : 0, int(b.sort, 0), str(b.seo_title, 70), str(b.seo_description, 300), now()];
      let id;
      if (existing) {
        ctx.db.prepare(`UPDATE products SET name=?, slug=?, subtitle=?, description=?, details=?, care=?, price_kobo=?, compare_at_kobo=?, status=?,
          made_to_order=?, featured=?, bestseller=?, sort=?, seo_title=?, seo_description=?, updated_at=? WHERE id = ?`).run(...vals, existing.id);
        id = existing.id;
      } else {
        id = Number(ctx.db.prepare(`INSERT INTO products (name, slug, subtitle, description, details, care, price_kobo, compare_at_kobo, status,
          made_to_order, featured, bestseller, sort, seo_title, seo_description, updated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...vals, now()).lastInsertRowid);
      }
      ctx.db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
      imageIds.forEach((mid, i) => { if (catalog.getMedia(ctx.db, mid)) ctx.db.prepare('INSERT INTO product_images (product_id, media_id, position) VALUES (?, ?, ?)').run(id, mid, i); });
      ctx.db.prepare('DELETE FROM product_collections WHERE product_id = ?').run(id);
      for (const cid of colIds) ctx.db.prepare('INSERT OR IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)').run(id, cid);
      // Upsert variants by (size, colour); options removed from the table are switched off, not deleted, so past carts stay valid.
      ctx.db.prepare('UPDATE variants SET active = 0 WHERE product_id = ?').run(id);
      for (const r of rows) {
        ctx.db.prepare(`INSERT INTO variants (product_id, size, colour, stock, sku, active) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(product_id, size, colour) DO UPDATE SET stock = excluded.stock, sku = excluded.sku, active = excluded.active`).run(id, r.size, r.colour, r.stock, r.sku, r.active);
      }
      return id;
    });
  }

  app.get('/admin/products/new', (ctx) => productForm(ctx, null), ADMIN);
  app.get('/admin/products/:id', (ctx) => {
    const p = ctx.db.prepare('SELECT * FROM products WHERE id = ?').get(int(ctx.params.id));
    if (!p) throw new HttpError(404, 'Not found');
    productForm(ctx, p);
  }, ADMIN);
  app.post('/admin/products/new', (ctx) => { const id = saveProduct(ctx, null); ctx.redirect(`/admin/products/${id}`, { type: 'success', message: 'Product saved.' }); }, ADMIN);
  app.post('/admin/products/:id', (ctx) => {
    const p = ctx.db.prepare('SELECT * FROM products WHERE id = ?').get(int(ctx.params.id));
    if (!p) throw new HttpError(404, 'Not found');
    saveProduct(ctx, p);
    ctx.redirect(`/admin/products/${p.id}`, { type: 'success', message: 'Product saved.' });
  }, ADMIN);
  app.post('/admin/products/:id/delete', (ctx) => {
    ctx.db.prepare('DELETE FROM products WHERE id = ?').run(int(ctx.params.id));
    ctx.redirect('/admin/products', { type: 'success', message: 'Product deleted.' });
  }, ADMIN);

  // ================= Simple resources =================
  crud(app, {
    key: 'collections', table: 'collections', title: 'Collections', singular: 'collection', orderBy: 'sort, name',
    viewUrl: (r) => `/collections/${r.slug}`,
    columns: [['', thumb('media_id')], ['Name', (r) => html`<b>${r.name}</b><br><small>/collections/${r.slug}</small>`], ['In menu', (r) => yes(r.show_in_nav)], ['Active', (r) => yes(r.active)], ['Products', (r, ctx) => ctx.db.prepare('SELECT COUNT(*) AS n FROM product_collections WHERE collection_id = ?').get(r.id).n]],
    fields: [
      { name: 'name', label: 'Name', required: true, maxlength: 80 },
      { name: 'slug', label: 'URL slug', help: 'Created from the name if empty.', maxlength: 80 },
      { name: 'description', label: 'Introduction', type: 'markdown', rows: 4 },
      { name: 'media_id', label: 'Banner image', type: 'media' },
      { name: 'sort', label: 'Order', type: 'number' },
      { name: 'active', label: 'Active', type: 'checkbox', default: 1 },
      { name: 'show_in_nav', label: 'Show in menu & homepage', type: 'checkbox', default: 1 },
      { name: 'seo_title', label: 'Page title (optional)', maxlength: 70 },
      { name: 'seo_description', label: 'Meta description (optional)', type: 'textarea', maxlength: 300 },
    ],
    prepare: (v, ctx, ex) => ({ ...v, slug: uniqueSlug(ctx.db, 'collections', v.slug || v.name, ex && ex.id) }),
  });

  crud(app, {
    key: 'discounts', table: 'discounts', title: 'Discount codes', singular: 'discount code', orderBy: 'created_at DESC',
    columns: [['Code', (r) => html`<b>${r.code}</b>`], ['Discount', (r) => (r.kind === 'percent' ? `${r.value}% off` : r.kind === 'fixed' ? `${naira(r.value)} off` : 'Free delivery')],
      ['Used', (r) => `${r.used_count}${r.max_uses !== null ? ` / ${r.max_uses}` : ''}`], ['Ends', (r) => (r.ends_at ? fmtDate(r.ends_at) : '—')], ['Active', (r) => yes(r.active)]],
    fields: [
      { name: 'code', label: 'Code', required: true, maxlength: 40, help: 'Letters and numbers, e.g. WELCOME10' },
      { name: 'kind', label: 'Type', type: 'select', options: [['percent', 'Percentage off'], ['fixed', 'Fixed amount off'], ['free_shipping', 'Free delivery']] },
      { name: 'percent', label: 'Percentage (for percentage codes)', type: 'number', virtual: true, min: 0, max: 100 },
      { name: 'amount', label: 'Amount (for fixed codes)', type: 'money', virtual: true },
      { name: 'min_subtotal_kobo', label: 'Minimum order (optional)', type: 'money', allowZero: true },
      { name: 'max_uses', label: 'Maximum uses (optional)', type: 'number', nullable: true, min: 1 },
      { name: 'starts_at', label: 'Starts (optional)', type: 'datetime' },
      { name: 'ends_at', label: 'Ends (optional)', type: 'datetime' },
      { name: 'active', label: 'Active', type: 'checkbox', default: 1 },
    ],
    extraCols: ['value', 'created_at'],
    load: (r) => ({ ...r, percent: r.kind === 'percent' ? r.value : '', amount: r.kind === 'fixed' ? r.value : '' }),
    prepare: (v, ctx, ex) => {
      const code = v.code.toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new HttpError(400, 'Codes use 3–40 letters, numbers, - or _.');
      if (ctx.db.prepare('SELECT 1 FROM discounts WHERE code = ? AND id != ?').get(code, ex ? ex.id : -1)) throw new HttpError(400, 'That code already exists.');
      let value = 0;
      if (v.kind === 'percent') { if (!(v.percent > 0 && v.percent <= 100)) throw new HttpError(400, 'Enter a percentage between 1 and 100.'); value = v.percent; }
      if (v.kind === 'fixed') { if (!v.amount) throw new HttpError(400, 'Enter the amount off.'); value = v.amount; }
      const out = { code, kind: v.kind, value, min_subtotal_kobo: v.min_subtotal_kobo || 0, max_uses: v.max_uses, starts_at: v.starts_at, ends_at: v.ends_at, active: v.active };
      if (!ex) out.created_at = now();
      return out;
    },
  });

  crud(app, {
    key: 'shipping', table: 'shipping_zones', title: 'Shipping zones', singular: 'shipping zone', orderBy: 'sort, id',
    intro: 'Customers see the most specific active zone that matches their address (city, then state, then country), plus any pickup options. A zone only appears at checkout when it is active and has a fee (₦0 for free).',
    columns: [['Zone', (r) => html`<b>${r.name}</b><br><small>${r.countries}${r.states ? ` · ${r.states}` : ''}${r.cities ? ` · ${r.cities}` : ''}</small>`], ['Fee', (r) => (r.fee_kobo === null ? html`<span class="neg">Not set</span>` : naira(r.fee_kobo))], ['Free over', (r) => (r.free_over_kobo ? naira(r.free_over_kobo) : '—')], ['Active', (r) => yes(r.active)]],
    fields: [
      { name: 'name', label: 'Name shown to customers', required: true, maxlength: 80 },
      { name: 'description', label: 'Description', maxlength: 200 },
      { name: 'countries', label: 'Countries', required: true, help: 'NG for Nigeria, INTL for every other country, or a list of country codes such as GH, GB, US.', default: 'NG' },
      { name: 'states', label: 'States (optional)', help: `Comma separated, Nigerian state names: ${NG_STATES.slice(0, 4).join(', ')}…`, maxlength: 1000 },
      { name: 'cities', label: 'Cities (optional)', help: 'Comma separated, e.g. Akure', maxlength: 1000 },
      { name: 'fee_kobo', label: 'Delivery fee', type: 'money', allowZero: true, help: 'Leave empty to keep this zone unavailable.' },
      { name: 'free_over_kobo', label: 'Free delivery over (optional)', type: 'money' },
      { name: 'eta_text', label: 'Delivery estimate shown at checkout (optional)', maxlength: 120, help: 'Only enter timelines ANKOO has approved.' },
      { name: 'is_pickup', label: 'This is a pickup option (shown alongside delivery)', type: 'checkbox' },
      { name: 'active', label: 'Active', type: 'checkbox' },
      { name: 'sort', label: 'Order', type: 'number' },
    ],
    prepare: (v) => {
      const countries = v.countries.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean);
      if (!countries.every((c) => /^([A-Z]{2}|INTL|ALL)$/.test(c))) throw new HttpError(400, 'Countries must be two-letter codes, INTL or ALL.');
      if (v.active && v.fee_kobo === null) throw new HttpError(400, 'Set a delivery fee (₦0 for free) before activating this zone.');
      return { ...v, countries: countries.join(',') };
    },
  });

  crud(app, {
    key: 'journal', table: 'articles', title: 'Journal', singular: 'story', orderBy: 'COALESCE(published_at, created_at) DESC',
    viewUrl: (r) => `/journal/${r.slug}`,
    intro: 'Publish ÌTÀN ÀNKÓÒ episodes, documentaries, behind-the-scenes films, campaigns and stories. Paste a YouTube, Vimeo, TikTok or Instagram link to embed a video, or upload a short video file.',
    columns: [['', thumb('cover_media_id')], ['Title', (r) => html`<b>${r.title}</b><br><small>${(JOURNAL_CATEGORIES.find(([k]) => k === r.category) || [])[1]}${r.episode ? ` · ${r.episode}` : ''}</small>`], ['Status', (r) => html`<span class="pill s-${r.status}">${r.status}</span>`], ['Published', (r) => (r.published_at ? fmtDate(r.published_at) : '—')]],
    fields: [
      { name: 'title', label: 'Title', required: true, maxlength: 160, wide: true },
      { name: 'category', label: 'Category', type: 'select', options: JOURNAL_CATEGORIES },
      { name: 'episode', label: 'Episode label (optional)', maxlength: 40, help: 'e.g. Episode 1' },
      { name: 'excerpt', label: 'Summary', type: 'textarea', rows: 3, maxlength: 400 },
      { name: 'cover_media_id', label: 'Cover image', type: 'media' },
      { name: 'video_url', label: 'Video link (YouTube, Vimeo, TikTok, Instagram)', type: 'url', maxlength: 400 },
      { name: 'video_media_id', label: 'Or uploaded video file', type: 'media', kind: 'video' },
      { name: 'body', label: 'Story', type: 'markdown', rows: 14 },
      { name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published']] },
      { name: 'featured', label: 'Feature at the top of the Journal', type: 'checkbox' },
      { name: 'published_at', label: 'Publish date', type: 'datetime', help: 'Set automatically when first published.' },
      { name: 'slug', label: 'URL slug', maxlength: 80, help: 'Created from the title if empty.' },
      { name: 'seo_title', label: 'Page title (optional)', maxlength: 70 },
      { name: 'seo_description', label: 'Meta description (optional)', type: 'textarea', maxlength: 300 },
    ],
    extraCols: ['created_at', 'updated_at'],
    prepare: (v, ctx, ex) => {
      if (v.video_url && !require('../video').parseVideo(v.video_url)) throw new HttpError(400, 'That video link is not supported. Use a YouTube, Vimeo, TikTok or Instagram link.');
      const out = { ...v, slug: uniqueSlug(ctx.db, 'articles', v.slug || v.title, ex && ex.id), updated_at: now() };
      if (out.status === 'published' && !out.published_at) out.published_at = now();
      if (!ex) out.created_at = now();
      return out;
    },
  });

  crud(app, {
    key: 'slides', table: 'slides', title: 'Hero banners', singular: 'hero banner', orderBy: 'sort, id',
    intro: 'The first active banner fills the top of the homepage. Use a landscape photograph (and optionally a portrait one for phones) or a short, silent video loop. Without a banner, the homepage shows the headline on deep forest green.',
    columns: [['', thumb('media_id')], ['Headline', (r) => html`<b>${r.title}</b>`], ['Active', (r) => yes(r.active)], ['Order', (r) => r.sort]],
    fields: [
      { name: 'eyebrow', label: 'Small line above headline', maxlength: 80 },
      { name: 'title', label: 'Headline', required: true, maxlength: 120, default: 'Rooted in Heritage. Defined by Elegance.' },
      { name: 'subtitle', label: 'Supporting text', type: 'textarea', rows: 2, maxlength: 300, default: 'Discover ANKOO, where African heritage meets contemporary expression through timeless fashion and thoughtful craftsmanship.' },
      { name: 'media_id', label: 'Image (landscape)', type: 'media' },
      { name: 'mobile_media_id', label: 'Image for phones (portrait, optional)', type: 'media' },
      { name: 'video_media_id', label: 'Background video (optional, MP4, muted)', type: 'media', kind: 'video' },
      { name: 'cta1_label', label: 'Primary button', maxlength: 40, default: 'Explore Collection' },
      { name: 'cta1_url', label: 'Primary button link', maxlength: 300, default: '/shop' },
      { name: 'cta2_label', label: 'Secondary button', maxlength: 40, default: 'Discover Our Story' },
      { name: 'cta2_url', label: 'Secondary button link', maxlength: 300, default: '/about' },
      { name: 'active', label: 'Active', type: 'checkbox', default: 1 },
      { name: 'sort', label: 'Order', type: 'number' },
    ],
    prepare: (v) => {
      for (const k of ['cta1_url', 'cta2_url']) if (v[k] && !safeUrl(v[k])) throw new HttpError(400, 'Button links must start with / or https://');
      return v;
    },
  });

  crud(app, {
    key: 'testimonials', table: 'testimonials', title: 'Testimonials', singular: 'testimonial', orderBy: 'sort, id',
    intro: 'Only publish genuine testimonials from real clients, with their permission. The section is hidden until you add one.',
    columns: [['Quote', (r) => html`“${r.quote.slice(0, 90)}${r.quote.length > 90 ? '…' : ''}”`], ['Client', (r) => r.name], ['Active', (r) => yes(r.active)]],
    fields: [
      { name: 'quote', label: 'Quote', type: 'textarea', required: true, maxlength: 600 },
      { name: 'name', label: 'Client name', required: true, maxlength: 80 },
      { name: 'location', label: 'Location (optional)', maxlength: 80 },
      { name: 'active', label: 'Active', type: 'checkbox', default: 1 },
      { name: 'sort', label: 'Order', type: 'number' },
    ],
  });

  crud(app, {
    key: 'instagram', table: 'instagram_posts', title: 'Instagram', singular: 'Instagram post', orderBy: 'sort, id DESC',
    intro: 'Curate the homepage Instagram grid: upload the image and paste the post link. If INSTAGRAM_ACCESS_TOKEN is set, your latest posts are shown automatically instead.',
    columns: [['', thumb('media_id')], ['Link', (r) => r.permalink || '—'], ['Active', (r) => yes(r.active)]],
    fields: [
      { name: 'media_id', label: 'Image', type: 'media', required: true },
      { name: 'permalink', label: 'Post link', type: 'url', maxlength: 300, placeholder: 'https://www.instagram.com/p/…' },
      { name: 'caption', label: 'Caption (used as image description)', type: 'textarea', maxlength: 300 },
      { name: 'active', label: 'Active', type: 'checkbox', default: 1 },
      { name: 'sort', label: 'Order', type: 'number' },
    ],
    prepare: (v) => { if (v.permalink && !/^https:\/\/(www\.)?instagram\.com\//.test(v.permalink)) throw new HttpError(400, 'Use an instagram.com link.'); return v; },
  });

  const CORE_PAGES = ['about', 'shipping', 'returns', 'size-guide', 'privacy', 'terms'];
  crud(app, {
    key: 'pages', table: 'pages', pk: 'slug', title: 'Pages', singular: 'page', orderBy: 'slug',
    viewUrl: (r) => (r.slug === 'about' ? '/about' : `/pages/${r.slug}`),
    intro: 'Pages marked “needs review” contain starter text. Replace it with ANKOO\'s approved wording, then untick “needs review”.',
    columns: [['Page', (r) => html`<b>${r.title}</b><br><small>${r.slug === 'about' ? '/about' : `/pages/${r.slug}`}</small>`], ['Review', (r) => (r.needs_review ? html`<span class="pill s-pending_payment">needs review</span>` : '✓')], ['Updated', (r) => fmtDate(r.updated_at)]],
    fields: [
      { name: 'title', label: 'Title', required: true, maxlength: 120 },
      { name: 'slug', label: 'URL slug', maxlength: 60, help: 'Used in /pages/… (cannot change for built-in pages).' },
      { name: 'body', label: 'Content', type: 'markdown', rows: 18 },
      { name: 'seo_description', label: 'Meta description (optional)', type: 'textarea', maxlength: 300 },
      { name: 'needs_review', label: 'Needs review (starter text)', type: 'checkbox' },
    ],
    extraCols: ['updated_at'],
    canDelete: (r) => !CORE_PAGES.includes(r.slug),
    prepare: (v, ctx, ex) => {
      const slug = ex && CORE_PAGES.includes(ex.slug) ? ex.slug : uniqueSlug(ctx.db, 'pages', v.slug || v.title, ex ? ex.slug : null);
      return { ...v, slug, updated_at: now() };
    },
  });

  // ================= Customers =================
  app.get('/admin/customers', (ctx) => {
    const q = str(ctx.query.q, 80);
    const rows = ctx.db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS orders,
      (SELECT COALESCE(SUM(total_kobo),0) FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL AND o.status != 'cancelled') AS spent
      FROM users u ${q ? 'WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?' : ''} ORDER BY u.created_at DESC LIMIT 500`).all(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []));
    const guests = ctx.db.prepare('SELECT COUNT(DISTINCT email) AS n FROM orders WHERE user_id IS NULL AND paid_at IS NOT NULL').get().n;
    ctx.html(ui.shell(ctx, {
      title: 'Customers',
      actions: html`<a class="a-btn a-btn-ghost" href="/admin/customers.csv">Export CSV</a>`,
      body: html`<form class="a-filter" method="get"><input name="q" value="${q}" placeholder="Search name, email, phone"><button class="a-btn a-btn-sm" type="submit">Search</button></form>
<p class="a-note">${rows.length} account(s) shown. ${guests} guest customer(s) have ordered without an account; find them in Orders.</p>
${rows.length ? html`<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th class="num">Orders</th><th class="num">Spent</th></tr></thead><tbody>
${rows.map((u) => html`<tr><td data-label="Customer"><a href="/admin/customers/${u.id}"><b>${u.name}</b></a>${u.role === 'admin' ? html` <span class="pill">admin</span>` : ''}<br><small>${u.email}</small></td><td data-label="Phone">${u.phone}</td><td data-label="Joined">${fmtDate(u.created_at)}</td><td data-label="Orders" class="num">${u.orders}</td><td data-label="Spent" class="num">${naira(u.spent)}</td></tr>`)}
</tbody></table></div>` : html`<div class="a-empty">No customers yet.</div>`}`,
    }));
  }, ADMIN);
  app.get('/admin/customers.csv', (ctx) => {
    const rows = ctx.db.prepare('SELECT name, email, phone, role, marketing_opt_in, created_at FROM users ORDER BY created_at').all();
    ctx.send(200, csv([['name', 'email', 'phone', 'role', 'newsletter', 'joined'], ...rows.map((r) => [r.name, r.email, r.phone, r.role, r.marketing_opt_in ? 'yes' : 'no', r.created_at])]),
      { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ankoo-customers.csv"' });
  }, ADMIN);
  app.get('/admin/customers/:id', (ctx) => {
    const u = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(int(ctx.params.id));
    if (!u) throw new HttpError(404, 'Not found');
    const orders = ctx.db.prepare('SELECT * FROM orders WHERE user_id = ? OR email = ? ORDER BY created_at DESC').all(u.id, u.email);
    const wish = ctx.db.prepare('SELECT p.id, p.name FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = ?').all(u.id);
    const addr = jsonParse(u.address_json, {});
    const wa = whatsapp.normalizeNumber(u.phone);
    ctx.html(ui.shell(ctx, {
      title: u.name,
      actions: html`<a class="a-btn a-btn-ghost" href="/admin/customers">← Customers</a>`,
      body: html`<div class="a-cols a-cols-wide"><div>
<section class="a-card"><h2>Orders</h2>${orders.length ? html`<table class="a-table a-compact"><tbody>${orders.map((o) => html`<tr><td><a href="/admin/orders/${o.id}">${o.number}</a></td><td>${fmtDate(o.created_at)}</td><td>${ui.statusPill(commerce.STATUSES, o.status)}</td><td class="num">${naira(o.total_kobo)}</td></tr>`)}</tbody></table>` : html`<p class="a-empty">No orders.</p>`}</section>
<section class="a-card"><h2>Wishlist</h2>${wish.length ? html`<ul>${wish.map((p) => html`<li><a href="/admin/products/${p.id}">${p.name}</a></li>`)}</ul>` : html`<p class="a-empty">Empty.</p>`}</section>
</div><div>
<section class="a-card"><h2>Details</h2><p><a href="mailto:${u.email}">${u.email}</a><br>${u.phone}<br>${[addr.line, addr.city, addr.state].filter(Boolean).join(', ')}</p><p><small>Joined ${fmtDate(u.created_at)} · Newsletter: ${u.marketing_opt_in ? 'yes' : 'no'}</small></p>
${wa ? html`<p><a class="a-btn a-btn-sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a></p>` : ''}</section>
<section class="a-card"><h2>Access</h2>
<form method="post" action="/admin/customers/${u.id}/role" data-confirm="Change this person's access?"><input type="hidden" name="_csrf" value="${ctx.csrf}">
<p>Role: <b>${u.role}</b></p>${u.id !== ctx.user.id ? html`<input type="hidden" name="role" value="${u.role === 'admin' ? 'customer' : 'admin'}"><button class="a-btn a-btn-sm ${u.role === 'admin' ? 'a-btn-danger' : 'a-btn-ghost'}" type="submit">${u.role === 'admin' ? 'Remove admin access' : 'Make admin'}</button>` : html`<small>This is you.</small>`}</form></section>
</div></div>`,
    }));
  }, ADMIN);
  app.post('/admin/customers/:id/role', (ctx) => {
    const id = int(ctx.params.id);
    if (id === ctx.user.id) throw new HttpError(400, 'You cannot change your own access.');
    const role = ctx.body.role === 'admin' ? 'admin' : 'customer';
    ctx.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    if (role === 'customer') ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    ctx.redirect(`/admin/customers/${id}`, { type: 'success', message: 'Access updated.' });
  }, ADMIN);

  // ================= Media =================
  app.get('/admin/media.json', (ctx) => {
    const kind = ctx.query.kind === 'video' ? 'video' : 'image';
    const rows = ctx.db.prepare('SELECT * FROM media WHERE kind = ? ORDER BY id DESC LIMIT 300').all(kind);
    ctx.json(rows.map((m) => ({ id: m.id, url: catalog.mediaUrl(m), thumb: catalog.mediaUrl(m, true), alt: m.alt, kind: m.kind })));
  }, { ...ADMIN, api: true });

  app.post('/admin/media/upload', (ctx) => {
    const b = ctx.body;
    const data = Buffer.from(String(b.data || ''), 'base64');
    if (data.length < 32) throw new HttpError(400, 'No image received.');
    const ext = imageExt(data);
    if (!ext) throw new HttpError(400, 'Please upload a JPG, PNG, WebP, GIF, AVIF or SVG image.');
    if (ext === 'svg') checkSvg(data);
    const base = token(12);
    const file = `${base}.${ext}`;
    writeUpload(file, data);
    let fileSm = null;
    if (b.sm) {
      const sm = Buffer.from(String(b.sm), 'base64');
      const smExt = imageExt(sm);
      if (smExt && smExt !== 'svg') { fileSm = `${base}-sm.${smExt}`; writeUpload(fileSm, sm); }
    }
    const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' }[ext];
    const r = ctx.db.prepare('INSERT INTO media (kind, file, file_sm, mime, width, height, bytes, alt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('image', file, fileSm, mime, int(b.width, null, 1, 20000) || null, int(b.height, null, 1, 20000) || null, data.length, str(b.alt, 200), now());
    const m = catalog.getMedia(ctx.db, Number(r.lastInsertRowid));
    ctx.json({ id: m.id, url: catalog.mediaUrl(m), thumb: catalog.mediaUrl(m, true), kind: 'image' });
  }, { ...ADMIN, api: true, bodyLimit: 40e6 });

  app.post('/admin/media/video', async (ctx) => {
    const limit = 300e6;
    const declared = Number(ctx.req.headers['content-length'] || 0);
    if (declared > limit) throw new HttpError(413, 'Videos must be under 300 MB. For longer films, upload to YouTube and paste the link.');
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const tmp = path.join(config.uploadDir, `.tmp-${token(8)}`);
    const out = fs.createWriteStream(tmp);
    let size = 0; let head = Buffer.alloc(0);
    try {
      await new Promise((resolve, reject) => {
        ctx.req.on('data', (c) => {
          size += c.length;
          if (head.length < 16) head = Buffer.concat([head, c]).slice(0, 16);
          if (size > limit) { reject(new HttpError(413, 'Videos must be under 300 MB.')); ctx.req.destroy(); return; }
          if (!out.write(c)) { ctx.req.pause(); out.once('drain', () => ctx.req.resume()); }
        });
        ctx.req.on('end', resolve);
        ctx.req.on('error', reject);
      });
      await new Promise((r) => out.end(r));
      const ext = videoExt(head);
      if (!ext) throw new HttpError(400, 'Please upload an MP4, MOV or WebM video.');
      const file = `${token(12)}.${ext}`;
      fs.renameSync(tmp, path.join(config.uploadDir, file));
      const mime = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }[ext];
      const r = ctx.db.prepare('INSERT INTO media (kind, file, mime, bytes, alt, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('video', file, mime, size, str(ctx.query.name, 200), now());
      ctx.json({ id: Number(r.lastInsertRowid), url: `/media/${file}`, kind: 'video' });
    } catch (e) {
      out.destroy(); try { fs.unlinkSync(tmp); } catch { /* none */ }
      throw e;
    }
  }, { ...ADMIN, api: true, stream: true });

  app.get('/admin/media', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 500').all();
    const total = rows.reduce((n, m) => n + m.bytes, 0);
    ctx.html(ui.shell(ctx, {
      title: 'Media library',
      actions: html`<label class="a-btn">Upload images<input type="file" accept="image/*" multiple hidden data-library-upload></label> <label class="a-btn a-btn-ghost">Upload video<input type="file" accept="video/mp4,video/quicktime,video/webm" hidden data-video-upload></label>`,
      body: html`<p class="a-note">Images are resized in your browser (long side 2400px plus a 900px version for phones) so pages stay fast on mobile data. Videos: keep them short (under 300 MB, ideally under 30 MB, 1080p MP4). For long films, upload to YouTube and paste the link in a Journal story. <span data-upload-status></span></p>
<p class="a-note">${rows.length} files · ${(total / 1e6).toFixed(1)} MB</p>
<div class="a-media-grid">${rows.map((m) => html`<figure>
  ${m.kind === 'video' ? html`<video src="${catalog.mediaUrl(m)}" preload="metadata" muted></video>` : html`<img src="${catalog.mediaUrl(m, true)}" alt="${m.alt}" loading="lazy">`}
  <figcaption><form method="post" action="/admin/media/${m.id}"><input type="hidden" name="_csrf" value="${ctx.csrf}"><input name="alt" value="${m.alt}" placeholder="Description (alt text)" aria-label="Description"><button class="a-btn a-btn-sm a-btn-ghost" type="submit">Save</button></form>
  <small>#${m.id} · ${m.width ? `${m.width}×${m.height} · ` : ''}${(m.bytes / 1e6).toFixed(2)} MB</small>
  <form method="post" action="/admin/media/${m.id}/delete" data-confirm="Delete this file? It will disappear from anywhere it is used."><input type="hidden" name="_csrf" value="${ctx.csrf}"><button class="link-danger" type="submit">Delete</button></form></figcaption>
</figure>`)}</div>`,
    }));
  }, ADMIN);
  app.post('/admin/media/:id', (ctx) => {
    ctx.db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(str(ctx.body.alt, 200), int(ctx.params.id));
    ctx.redirect('/admin/media', { type: 'success', message: 'Description saved.' });
  }, ADMIN);
  app.post('/admin/media/:id/delete', (ctx) => {
    const m = catalog.getMedia(ctx.db, int(ctx.params.id));
    if (m) { ctx.db.prepare('DELETE FROM media WHERE id = ?').run(m.id); deleteMediaFiles(m); }
    ctx.redirect('/admin/media', { type: 'success', message: 'File deleted.' });
  }, ADMIN);

  // ================= Homepage & settings =================
  const HOME_FIELDS = [
    { name: 'announcement', label: 'Announcement bar (optional)', maxlength: 160, wide: true, help: 'A short line above the header. Leave empty to hide.' },
    { name: 'hero_eyebrow', label: 'Hero: small line', maxlength: 80 },
    { name: 'hero_title', label: 'Hero: headline', maxlength: 120 },
    { name: 'hero_text', label: 'Hero: supporting text', type: 'textarea', maxlength: 300 },
    { name: 'hero_cta1_label', label: 'Hero: primary button', maxlength: 40 }, { name: 'hero_cta1_url', label: 'Primary button link', maxlength: 300 },
    { name: 'hero_cta2_label', label: 'Hero: secondary button', maxlength: 40 }, { name: 'hero_cta2_url', label: 'Secondary button link', maxlength: 300 },
    { name: 'story_title', label: 'Brand story: title', maxlength: 120 },
    { name: 'story_text', label: 'Brand story: text', type: 'textarea', rows: 4, maxlength: 800 },
    { name: 'story_media_id', label: 'Brand story: photograph', type: 'media' },
    { name: 'about_media_id', label: 'About page: lead photograph', type: 'media' },
    { name: 'og_media_id', label: 'Default sharing image (Open Graph, 1200×630)', type: 'media' },
    { name: 'seo_title', label: 'Homepage title (search results)', maxlength: 70, wide: true },
    { name: 'seo_description', label: 'Homepage meta description', type: 'textarea', maxlength: 300 },
  ];
  app.get('/admin/homepage', (ctx) => {
    ctx.html(ui.shell(ctx, {
      title: 'Homepage',
      actions: html`<a class="a-btn a-btn-ghost" href="/admin/slides">Hero banners</a>`,
      body: html`<p class="a-intro">The hero text below is used when no hero banner is active. Featured products, new arrivals and bestsellers come from Products; testimonials and Instagram have their own pages.</p>
<form class="a-form" method="post" action="/admin/homepage"><input type="hidden" name="_csrf" value="${ctx.csrf}"><div class="a-grid">${HOME_FIELDS.map((f) => ui.field(ctx, f, ctx.settings[f.name]))}</div><div class="a-bar"><button class="a-btn" type="submit">Save</button></div></form>`,
    }));
  }, ADMIN);
  app.post('/admin/homepage', (ctx) => {
    for (const f of HOME_FIELDS) {
      const v = parseField(f, ctx.body);
      if (/_url$/.test(f.name) && v && !safeUrl(v)) throw new HttpError(400, 'Links must start with / or https://');
      setSetting(ctx.db, f.name, v);
    }
    ctx.redirect('/admin/homepage', { type: 'success', message: 'Homepage saved.' });
  }, ADMIN);

  const SETTINGS_GROUPS = [
    ['Brand', [
      { name: 'brand_name', label: 'Brand name', maxlength: 40 },
      { name: 'logo_media_id', label: 'Logo (SVG or transparent PNG)', type: 'media', help: 'Without a logo, the ANKOO wordmark is set in the brand typeface.' },
    ]],
    ['Contact & social', [
      { name: 'business_email', label: 'Business email (verified)', type: 'email', maxlength: 200, help: 'Shown on the Contact page; receives contact-form messages.' },
      { name: 'whatsapp_number', label: 'WhatsApp number', maxlength: 30, help: 'International format, e.g. +234 803 000 0000. Powers every WhatsApp button.' },
      { name: 'instagram_handle', label: 'Instagram handle', maxlength: 60 },
      { name: 'instagram_url', label: 'Instagram link', type: 'url', maxlength: 300 },
      { name: 'facebook_url', label: 'Facebook link', type: 'url', maxlength: 300 },
      { name: 'tiktok_url', label: 'TikTok link', type: 'url', maxlength: 300 },
      { name: 'youtube_url', label: 'YouTube link', type: 'url', maxlength: 300 },
    ]],
    ['Customer support (WhatsApp automated replies)', [
      { name: 'returns_policy', label: 'Returns policy', type: 'textarea', rows: 2, maxlength: 600 },
      { name: 'support_greeting', label: 'Greeting', type: 'textarea', rows: 3, maxlength: 1000 },
      { name: 'support_sizing', label: 'Sizing questions', type: 'textarea', rows: 3, maxlength: 1000, help: '{site} becomes your website address.' },
      { name: 'support_delivery', label: 'Delivery questions', type: 'textarea', rows: 3, maxlength: 1000, help: 'Do not promise timelines that have not been approved.' },
      { name: 'support_bespoke', label: 'Bespoke enquiries', type: 'textarea', rows: 3, maxlength: 1000 },
      { name: 'support_handoff', label: 'Hand-over to the team', type: 'textarea', rows: 2, maxlength: 1000 },
    ]],
    ['Analytics & marketing', [
      { name: 'ga_id', label: 'Google Analytics 4 measurement ID', maxlength: 30, placeholder: 'G-XXXXXXXXXX' },
      { name: 'meta_pixel_id', label: 'Meta Pixel ID', maxlength: 30 },
      { name: 'gsc_verification', label: 'Google Search Console verification code', maxlength: 100, help: 'The content value of the HTML-tag verification method.' },
      { name: 'require_consent', label: 'Ask visitors for cookie consent before loading analytics (recommended under the NDPA)', type: 'checkbox' },
    ]],
    ['Store', [
      { name: 'low_stock_threshold', label: 'Show “Only N left” at or below', type: 'number', min: 0, max: 100 },
    ]],
  ];
  app.get('/admin/settings', (ctx) => {
    const s = ctx.settings;
    const locs = [...(s.locations || []), {}, {}].slice(0, Math.max(3, (s.locations || []).length + 1));
    const rates = Object.entries(s.currency_rates || {}).map(([c, r]) => `${c}=${r}`).join('\n');
    ctx.html(ui.shell(ctx, {
      title: 'Settings',
      body: html`<form class="a-form" method="post" action="/admin/settings"><input type="hidden" name="_csrf" value="${ctx.csrf}">
${SETTINGS_GROUPS.map(([g, fields]) => html`<section class="a-card"><h2>${g}</h2><div class="a-grid">${fields.map((f) => ui.field(ctx, f, s[f.name]))}</div></section>`)}
<section class="a-card"><h2>Locations</h2><div class="a-locs">${locs.map((l, i) => html`<fieldset><legend>Location ${i + 1}</legend>
  <div class="a-field"><label>City</label><input name="loc_city[]" value="${l.city || ''}"></div>
  <div class="a-field"><label>Region</label><input name="loc_region[]" value="${l.region || ''}" placeholder="e.g. Ondo State, Nigeria"></div>
  <div class="a-field"><label>Address</label><input name="loc_address[]" value="${l.address || ''}"></div>
  <div class="a-field"><label>Opening hours</label><input name="loc_hours[]" value="${l.hours || ''}"></div>
  <div class="a-field"><label>Map link</label><input name="loc_map[]" value="${l.map_url || ''}" placeholder="https://maps.google.com/…"></div>
</fieldset>`)}</div><p class="a-note">Leave the city empty to remove a location.</p></section>
<section class="a-card"><h2>International prices (display only)</h2>
<div class="a-field"><label for="rates">Exchange rates</label><textarea id="rates" name="currency_rates" rows="3" placeholder="USD=1600&#10;GBP=2000">${rates}</textarea><small>One per line: CURRENCY=naira per unit. Visitors can then see approximate prices in that currency; every payment is still charged in NGN. Leave empty to show Naira only.</small></div></section>
<div class="a-bar a-bar-sticky"><button class="a-btn" type="submit">Save settings</button></div></form>
<section class="a-card"><h2>Integrations status</h2><ul class="a-status">
<li>${paystack.enabled() ? '✓ Paystack connected' : (config.production ? '✗ Paystack not connected: set PAYSTACK_SECRET_KEY' : '○ Paystack not connected (development test payments active)')}</li>
<li>${mailer.enabled() ? '✓ Email sending connected' : '✗ Email sending not connected: set RESEND_API_KEY and MAIL_FROM'}</li>
<li>${whatsapp.cloudEnabled() ? '✓ WhatsApp automated replies connected' : '○ WhatsApp automated replies off (click-to-chat buttons still work): see docs/INTEGRATIONS.md'}</li>
<li>${config.instagramToken ? '✓ Instagram live feed connected' : '○ Instagram live feed off: curated posts are used'}</li>
<li>Product feed for Meta Commerce Manager &amp; Google Merchant Center: <a href="/feeds/products.csv">${ctx.site}/feeds/products.csv</a></li>
<li>Sitemap for Google Search Console: <a href="/sitemap.xml">${ctx.site}/sitemap.xml</a></li>
</ul></section>`,
    }));
  }, ADMIN);
  app.post('/admin/settings', (ctx) => {
    const b = ctx.body;
    const updates = {};
    for (const [, fields] of SETTINGS_GROUPS) for (const f of fields) updates[f.name] = parseField(f, b);
    if (updates.business_email) updates.business_email = email(updates.business_email);
    if (updates.whatsapp_number && whatsapp.normalizeNumber(updates.whatsapp_number).length < 8) throw new HttpError(400, 'Enter the WhatsApp number in international format, e.g. +234 803 000 0000.');
    for (const k of ['instagram_url', 'facebook_url', 'tiktok_url', 'youtube_url']) if (updates[k] && !/^https:\/\//.test(updates[k])) throw new HttpError(400, 'Social links must start with https://');
    if (updates.ga_id && !/^G-[A-Z0-9]+$/i.test(updates.ga_id)) throw new HttpError(400, 'The Google Analytics ID looks like G-XXXXXXXXXX.');
    if (updates.meta_pixel_id && !/^\d{5,20}$/.test(updates.meta_pixel_id)) throw new HttpError(400, 'The Meta Pixel ID is a number.');
    updates.instagram_handle = String(updates.instagram_handle || '').replace(/^@/, '');
    const cities = [].concat(b['loc_city[]'] || []);
    updates.locations = cities.map((c, i) => ({
      city: str(c, 80), region: str([].concat(b['loc_region[]'] || [])[i], 120), address: str([].concat(b['loc_address[]'] || [])[i], 300),
      hours: str([].concat(b['loc_hours[]'] || [])[i], 200), map_url: safeUrl(str([].concat(b['loc_map[]'] || [])[i], 500)),
    })).filter((l) => l.city);
    const rates = {};
    for (const line of String(b.currency_rates || '').split(/\r?\n/)) {
      const m = line.trim().toUpperCase().match(/^([A-Z]{3})\s*=\s*([\d.]+)$/);
      if (m && Number(m[2]) > 0 && m[1] !== 'NGN') rates[m[1]] = Number(m[2]);
      else if (line.trim()) throw new HttpError(400, `Could not read the exchange rate line “${line.trim()}”. Use the format USD=1600.`);
    }
    updates.currency_rates = rates;
    for (const [k, v] of Object.entries(updates)) setSetting(ctx.db, k, v);
    ctx.redirect('/admin/settings', { type: 'success', message: 'Settings saved.' });
  }, ADMIN);

  // ================= Inbox, subscribers, logs =================
  app.get('/admin/messages', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM messages ORDER BY handled, created_at DESC LIMIT 300').all();
    ctx.html(ui.shell(ctx, {
      title: 'Messages',
      body: rows.length ? html`<div class="a-msgs">${rows.map((m) => html`<section class="a-card ${m.handled ? 'done' : ''}"><h2>${m.subject || 'Enquiry'} <small>${ui.when(m.created_at)}</small></h2>
<p><b>${m.name}</b> · <a href="mailto:${m.email}">${m.email}</a>${m.phone ? html` · ${m.phone} ${whatsapp.normalizeNumber(m.phone) ? html`<a href="https://wa.me/${whatsapp.normalizeNumber(m.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}` : ''}</p>
<p class="pre">${m.message}</p>
<form method="post" action="/admin/messages/${m.id}"><input type="hidden" name="_csrf" value="${ctx.csrf}"><button class="a-btn a-btn-sm a-btn-ghost" type="submit">${m.handled ? 'Mark as open' : 'Mark as handled'}</button></form></section>`)}</div>`
        : html`<div class="a-empty">No messages yet. Contact-form messages appear here and are emailed to your business address.</div>`,
    }));
  }, ADMIN);
  app.post('/admin/messages/:id', (ctx) => {
    ctx.db.prepare('UPDATE messages SET handled = 1 - handled WHERE id = ?').run(int(ctx.params.id));
    ctx.redirect('/admin/messages');
  }, ADMIN);

  app.get('/admin/subscribers', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 1000').all();
    const active = rows.filter((r) => !r.unsubscribed_at).length;
    ctx.html(ui.shell(ctx, {
      title: 'Newsletter subscribers',
      actions: html`<a class="a-btn a-btn-ghost" href="/admin/subscribers.csv">Export CSV</a>`,
      body: html`<p class="a-note">${active} active subscriber(s). Export the CSV to import into your email marketing tool (e.g. Mailchimp, Brevo). Each subscriber has a personal unsubscribe link: ${ctx.site}/unsubscribe?t=TOKEN.</p>
${rows.length ? html`<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Email</th><th>Source</th><th>Joined</th><th>Status</th></tr></thead><tbody>${rows.map((r) => html`<tr><td data-label="Email">${r.email}</td><td data-label="Source">${r.source}</td><td data-label="Joined">${fmtDate(r.created_at)}</td><td data-label="Status">${r.unsubscribed_at ? 'Unsubscribed' : 'Active'}</td></tr>`)}</tbody></table></div>` : html`<div class="a-empty">No subscribers yet.</div>`}`,
    }));
  }, ADMIN);
  app.get('/admin/subscribers.csv', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at').all();
    ctx.send(200, csv([['email', 'source', 'joined', 'unsubscribe_url'], ...rows.map((r) => [r.email, r.source, r.created_at, `${ctx.site}/unsubscribe?t=${r.token}`])]),
      { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ankoo-subscribers.csv"' });
  }, ADMIN);

  app.get('/admin/whatsapp', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM wa_messages ORDER BY id DESC LIMIT 300').all();
    ctx.html(ui.shell(ctx, {
      title: 'WhatsApp log',
      body: html`<p class="a-intro">${whatsapp.cloudEnabled() ? 'Automated replies are on. Routine questions (sizing, delivery, bespoke, returns, order status) are answered with the texts in Settings; everything else gets the hand-over message so your team can follow up in WhatsApp.' : 'Automated replies are off. Connect the WhatsApp Cloud API (docs/INTEGRATIONS.md) to answer routine questions automatically, around the clock.'}</p>
${rows.length ? html`<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Time</th><th>Number</th><th></th><th>Message</th><th>Topic</th></tr></thead><tbody>${rows.map((r) => html`<tr><td data-label="Time">${ui.when(r.created_at)}</td><td data-label="Number"><a href="https://wa.me/${r.wa_from}" target="_blank" rel="noopener">+${r.wa_from}</a></td><td>${r.direction === 'in' ? '←' : '→'}</td><td data-label="Message" class="pre">${r.body}</td><td data-label="Topic">${r.intent}</td></tr>`)}</tbody></table></div>` : html`<div class="a-empty">No WhatsApp messages logged yet.</div>`}`,
    }));
  }, ADMIN);

  app.get('/admin/emails', (ctx) => {
    const rows = ctx.db.prepare('SELECT * FROM email_log ORDER BY id DESC LIMIT 300').all();
    ctx.html(ui.shell(ctx, {
      title: 'Email log',
      body: html`<p class="a-intro">${mailer.enabled() ? 'Emails are sent through Resend.' : 'Email sending is not connected yet, so emails are recorded here but not delivered. Set RESEND_API_KEY and MAIL_FROM.'}</p>
${rows.length ? html`<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Time</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>${rows.map((r) => html`<tr><td data-label="Time">${ui.when(r.created_at)}</td><td data-label="To">${r.to_addr}</td><td data-label="Subject">${r.subject}</td><td data-label="Status">${r.status}${r.error ? html`<br><small>${r.error}</small>` : ''}</td></tr>`)}</tbody></table></div>` : html`<div class="a-empty">No emails yet.</div>`}`,
    }));
  }, ADMIN);
};
