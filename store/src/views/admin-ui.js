'use strict';
const { html, raw, naira, fmtDateTime } = require('../util');
const catalog = require('../catalog');

const NAV = [
  ['Overview', [['/admin', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/customers', 'Customers']]],
  ['Catalogue', [['/admin/products', 'Products'], ['/admin/collections', 'Collections'], ['/admin/discounts', 'Discount codes'], ['/admin/shipping', 'Shipping']]],
  ['Content', [['/admin/homepage', 'Homepage'], ['/admin/slides', 'Hero banners'], ['/admin/journal', 'Journal'], ['/admin/pages', 'Pages'], ['/admin/testimonials', 'Testimonials'], ['/admin/instagram', 'Instagram'], ['/admin/media', 'Media library']]],
  ['Customers', [['/admin/messages', 'Messages'], ['/admin/whatsapp', 'WhatsApp log'], ['/admin/subscribers', 'Subscribers']]],
  ['Setup', [['/admin/settings', 'Settings'], ['/admin/emails', 'Email log']]],
];

function shell(ctx, { title, body, actions = '' }) {
  const path = ctx.path;
  const isOn = (h) => (h === '/admin' ? path === '/admin' : path === h || path.startsWith(`${h}/`));
  const unread = ctx.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE handled = 0').get().n;
  const toShip = ctx.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('paid','processing','ready')").get().n;
  const badge = (h) => (h === '/admin/messages' && unread ? html`<b class="badge">${unread}</b>` : h === '/admin/orders' && toShip ? html`<b class="badge">${toShip}</b>` : '');
  return html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | ANKOO Admin</title><meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/assets/img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${ctx.asset('css/admin.css')}">
<meta name="csrf" content="${ctx.csrf}">
</head><body class="admin">
<header class="a-top"><button class="a-menu" type="button" aria-label="Menu" data-a-menu>☰</button><a class="a-brand" href="/admin">ANKOO <span>Admin</span></a><a class="a-view" href="/" target="_blank">View site ↗</a></header>
<div class="a-wrap">
<nav class="a-nav" data-a-nav>
  ${NAV.map(([group, links]) => html`<p>${group}</p><ul>${links.map(([h, l]) => html`<li><a href="${h}" class="${isOn(h) ? 'on' : ''}">${l}${badge(h)}</a></li>`)}</ul>`)}
  <form method="post" action="/logout"><input type="hidden" name="_csrf" value="${ctx.csrf}"><button type="submit">Sign out</button></form>
</nav>
<main class="a-main">
  <div class="a-head"><h1>${title}</h1><div class="a-actions">${actions}</div></div>
  ${ctx.flash ? html`<div class="a-flash a-flash-${ctx.flash.type}">${ctx.flash.message}</div>` : ''}
  ${body}
</main>
</div>
<dialog class="picker" data-picker><form method="dialog" class="picker-head"><h2>Media library</h2><button aria-label="Close">✕</button></form>
<div class="picker-upload"><label class="a-btn">Upload new<input type="file" accept="image/*" multiple hidden data-picker-upload></label><span data-picker-status></span></div>
<div class="picker-grid" data-picker-grid></div></dialog>
<script src="${ctx.asset('js/admin.js')}" defer></script>
</body></html>`;
}

function mediaThumb(db, id) {
  const m = catalog.getMedia(db, id);
  if (!m) return '';
  return m.kind === 'video' ? html`<span class="m-video">▶ Video #${m.id}</span>` : html`<img src="${catalog.mediaUrl(m, true)}" alt="">`;
}

// ---- Generic form field renderer ----
function field(ctx, f, value) {
  const id = `f-${f.name}`;
  const v = value === undefined || value === null ? (f.default ?? '') : value;
  const help = f.help ? html`<small>${f.help}</small>` : '';
  const req = f.required ? raw('required') : '';
  switch (f.type) {
    case 'textarea':
    case 'markdown':
      return html`<div class="a-field ${f.wide ? 'wide' : ''}"><label for="${id}">${f.label}</label><textarea id="${id}" name="${f.name}" rows="${f.rows || (f.type === 'markdown' ? 10 : 4)}" ${req}>${v}</textarea>${f.type === 'markdown' ? html`<small>${f.help || ''} Formatting: ## Heading, **bold**, *italic*, - list, [link](https://…), ![alt](/media/…), "video: https://youtube.com/…" on its own line.</small>` : help}</div>`;
    case 'checkbox':
      return html`<div class="a-field a-check"><label><input type="checkbox" name="${f.name}" value="1" ${Number(v) ? raw('checked') : ''}> ${f.label}</label>${help}</div>`;
    case 'select':
      return html`<div class="a-field"><label for="${id}">${f.label}</label><select id="${id}" name="${f.name}" ${req}>${f.options.map(([ov, ol]) => html`<option value="${ov}" ${String(ov) === String(v) ? raw('selected') : ''}>${ol}</option>`)}</select>${help}</div>`;
    case 'money':
      return html`<div class="a-field"><label for="${id}">${f.label}</label><div class="a-money"><span>₦</span><input id="${id}" name="${f.name}" inputmode="decimal" value="${v === '' ? '' : Number(v) / 100}" ${req}></div>${help}</div>`;
    case 'number':
      return html`<div class="a-field"><label for="${id}">${f.label}</label><input id="${id}" type="number" name="${f.name}" value="${v}" ${f.min !== undefined ? raw(`min="${f.min}"`) : ''} ${f.max !== undefined ? raw(`max="${f.max}"`) : ''} ${req}>${help}</div>`;
    case 'datetime':
      return html`<div class="a-field"><label for="${id}">${f.label}</label><input id="${id}" type="datetime-local" name="${f.name}" value="${v ? isoToLocal(v) : ''}">${help || html`<small>Nigeria time (WAT).</small>`}</div>`;
    case 'media':
      return html`<div class="a-field"><label>${f.label}</label><div class="a-media" data-media-field data-kind="${f.kind || 'image'}">
        <input type="hidden" name="${f.name}" value="${v || ''}"><div class="a-media-preview" data-preview>${v ? mediaThumb(ctx.db, v) : ''}</div>
        <button class="a-btn a-btn-sm" type="button" data-pick>${v ? 'Change' : 'Choose'}</button> <button class="a-btn a-btn-sm a-btn-ghost" type="button" data-clear ${v ? '' : raw('hidden')}>Remove</button>
      </div>${help}</div>`;
    default:
      return html`<div class="a-field ${f.wide ? 'wide' : ''}"><label for="${id}">${f.label}</label><input id="${id}" type="${f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}" name="${f.name}" value="${v}" ${f.maxlength ? raw(`maxlength="${f.maxlength}"`) : ''} ${req} ${f.placeholder ? raw(`placeholder="${f.placeholder}"`) : ''}>${help}</div>`;
  }
}
// Convert ISO (UTC) to a datetime-local value in WAT (UTC+1, no DST) and back.
function isoToLocal(iso) { const d = new Date(new Date(iso).getTime() + 3600e3); return d.toISOString().slice(0, 16); }
function localToIso(v) { if (!v) return null; const d = new Date(`${v}:00Z`); return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() - 3600e3).toISOString(); }

function kpi(label, value, sub = '') { return html`<div class="kpi"><p>${label}</p><b>${value}</b>${sub ? html`<small>${sub}</small>` : ''}</div>`; }

// Daily revenue bar chart as inline SVG (no client library needed).
function revenueChart(days) {
  if (!days.some((d) => d.kobo > 0)) return html`<div class="chart-empty">No paid orders in this period yet.</div>`;
  const max = Math.max(1, ...days.map((d) => d.kobo));
  const w = 720; const h = 180; const gap = 2; const bw = Math.max(2, (w - gap * days.length) / days.length);
  const bars = days.map((d, i) => {
    const bh = Math.round((d.kobo / max) * (h - 20));
    return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${h - bh}" width="${bw.toFixed(1)}" height="${bh}" rx="1.5"><title>${d.day}: ${naira(d.kobo)} (${d.orders} orders)</title></rect>`;
  }).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Revenue per day">${bars}</svg>`);
}

const statusPill = (statuses, s) => html`<span class="pill s-${s}">${statuses[s] || s}</span>`;
const when = (iso) => fmtDateTime(iso);

module.exports = { shell, field, mediaThumb, kpi, revenueChart, statusPill, when, localToIso, isoToLocal };
