'use strict';
// Transactional email via Resend's HTTP API (https://resend.com). Without a key, emails are logged only.
const config = require('./config');
const { esc, naira, now, fmtDate } = require('./util');
const { STATUSES } = require('./commerce');

function enabled() { return Boolean(config.resendKey && config.mailFrom); }

async function send(db, { to, subject, html, text, replyTo }) {
  if (!to) return false;
  const log = (status, error = null) => db.prepare('INSERT INTO email_log (to_addr, subject, status, error, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(String(to), subject, status, error, now());
  if (!enabled()) { log('not_sent_no_provider'); return false; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mailFrom, to: [to], subject, html, text, reply_to: replyTo || undefined }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { const t = await res.text(); log('failed', t.slice(0, 500)); return false; }
    log('sent');
    return true;
  } catch (e) {
    log('failed', String(e.message || e).slice(0, 500));
    return false;
  }
}
// Fire-and-forget: never block or fail a customer request on email delivery.
function queue(db, msg) { send(db, msg).catch((e) => console.error('mail', e)); }

function layout(title, bodyHtml, site) {
  return `<!doctype html><html><body style="margin:0;background:#F5F0E6;font-family:Helvetica,Arial,sans-serif;color:#1B1C18">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E6;padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">
<tr><td style="background:#16301F;padding:28px;text-align:center;color:#F5F0E6;font-family:Georgia,serif;font-size:26px;letter-spacing:8px">ANKOO</td></tr>
<tr><td style="padding:32px 28px;font-size:15px;line-height:1.6">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;margin:0 0 16px">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #EDE6D8;font-size:12px;color:#6B6A62;text-align:center">
ANKOO · Akure &amp; Lagos, Nigeria<br><a href="${esc(site)}" style="color:#16301F">${esc(site.replace(/^https?:\/\//, ''))}</a>
</td></tr></table></td></tr></table></body></html>`;
}
function itemsTable(items) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #EDE6D8">${items.map((i) => `
<tr><td style="padding:10px 0;border-bottom:1px solid #EDE6D8">${esc(i.name)}<br><span style="color:#6B6A62;font-size:13px">${esc([i.size, i.colour].filter(Boolean).join(' · '))}${i.made_to_order ? ' · Made to order' : ''} × ${i.qty}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #EDE6D8">${naira(i.unit_kobo * i.qty)}</td></tr>`).join('')}</table>`;
}
function totals(o) {
  const row = (l, v, b) => `<tr><td style="padding:3px 0${b ? ';font-weight:bold' : ''}">${l}</td><td align="right" style="padding:3px 0${b ? ';font-weight:bold' : ''}">${v}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0">${row('Subtotal', naira(o.subtotal_kobo))}${o.discount_kobo ? row(`Discount (${esc(o.discount_code)})`, `−${naira(o.discount_kobo)}`) : ''}${row(`Delivery: ${esc(o.zone_name)}`, naira(o.shipping_kobo))}${row('Total', naira(o.total_kobo), true)}</table>`;
}
const button = (href, label) => `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#16301F;color:#F5F0E6;padding:14px 24px;text-decoration:none;letter-spacing:2px;font-size:12px;text-transform:uppercase">${esc(label)}</a></p>`;

function orderConfirmation(db, site, order, items) {
  const link = `${site}/order/${order.number}?k=${order.access_key}`;
  queue(db, {
    to: order.email,
    subject: `Your ANKOO order ${order.number}`,
    html: layout('Thank you for your order', `<p>Dear ${esc(order.name)},</p><p>We have received your payment for order <strong>${esc(order.number)}</strong>. Our team will keep you updated as it progresses.</p>${itemsTable(items)}${totals(order)}${button(link, 'View your order')}<p style="color:#6B6A62;font-size:13px">Placed on ${fmtDate(order.created_at)}.</p>`, site),
    text: `Thank you for your order ${order.number}. Total ${naira(order.total_kobo)}. View it at ${link}`,
  });
}
function adminNewOrder(db, site, order, items, to) {
  if (!to) return;
  queue(db, {
    to,
    subject: `New paid order ${order.number}: ${naira(order.total_kobo)}`,
    html: layout(`New order ${order.number}`, `<p><strong>${esc(order.name)}</strong> · ${esc(order.email)} · ${esc(order.phone)}<br>${esc([order.address_line, order.city, order.state, order.country].filter(Boolean).join(', '))}</p>${itemsTable(items)}${totals(order)}${order.measurements ? `<p><strong>Measurements / bespoke notes:</strong><br>${esc(order.measurements).replace(/\n/g, '<br>')}</p>` : ''}${order.customer_note ? `<p><strong>Note:</strong> ${esc(order.customer_note)}</p>` : ''}${order.stock_issue ? '<p style="color:#9B2C2C"><strong>Stock check needed:</strong> one or more items had less stock than ordered.</p>' : ''}${button(`${site}/admin/orders/${order.id}`, 'Open in admin')}`, site),
    text: `New order ${order.number} for ${naira(order.total_kobo)}.`,
  });
}
function statusUpdate(db, site, order, note) {
  const link = `${site}/order/${order.number}?k=${order.access_key}`;
  queue(db, {
    to: order.email,
    subject: `Order ${order.number}: ${STATUSES[order.status] || order.status}`,
    html: layout(STATUSES[order.status] || 'Order update', `<p>Dear ${esc(order.name)},</p><p>Your order <strong>${esc(order.number)}</strong> has been updated: <strong>${esc(STATUSES[order.status] || order.status)}</strong>.</p>${note ? `<p>${esc(note).replace(/\n/g, '<br>')}</p>` : ''}${button(link, 'Track your order')}`, site),
    text: `Order ${order.number}: ${STATUSES[order.status] || order.status}. ${note || ''} ${link}`,
  });
}
function passwordReset(db, site, user, link) {
  queue(db, {
    to: user.email,
    subject: 'Reset your ANKOO password',
    html: layout('Reset your password', `<p>We received a request to reset the password for your ANKOO account. This link expires in one hour.</p>${button(link, 'Choose a new password')}<p style="color:#6B6A62;font-size:13px">If you did not ask for this, you can ignore this email.</p>`, site),
    text: `Reset your ANKOO password: ${link} (expires in one hour)`,
  });
}
function contactMessage(db, site, to, m) {
  if (!to) return;
  queue(db, {
    to, replyTo: m.email,
    subject: `Website enquiry: ${m.subject || 'General'}`,
    html: layout('New website enquiry', `<p><strong>${esc(m.name)}</strong> · ${esc(m.email)}${m.phone ? ` · ${esc(m.phone)}` : ''}</p><p><strong>${esc(m.subject)}</strong></p><p>${esc(m.message).replace(/\n/g, '<br>')}</p>`, site),
    text: `${m.name} (${m.email}, ${m.phone}): ${m.subject}\n\n${m.message}`,
  });
}

module.exports = { enabled, send, orderConfirmation, adminNewOrder, statusUpdate, passwordReset, contactMessage };
