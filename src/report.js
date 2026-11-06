'use strict';
// Printable annual "Tax Readiness Report" (Pro). Users print it or save as PDF.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const naira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STYLE = `
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#fff;max-width:820px;margin:24px auto;padding:0 16px;line-height:1.45}
  h1{font-size:22px;margin:0}.muted{color:#555;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-variant-numeric:tabular-nums}
  th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
  .box{border:1px solid #ccc;border-radius:8px;padding:12px 16px;margin:16px 0}
  .ok{border-color:#1d7a46;background:#eef8f2}.warn{border-color:#a86200;background:#fff6e8}
  button{padding:8px 14px;font-size:14px;cursor:pointer}
  @media print{button{display:none}body{margin:0}}`;

function render(user, year, a) {
  const rows = a.months.map((m) => `<tr><td>${MONTHS[m.month - 1]}</td><td>${naira(m.sales)}</td><td>${naira(m.expenses)}</td><td>${naira(m.sales - m.expenses)}</td></tr>`).join('');
  let verdict;
  if (a.businessType === 'company') {
    verdict = a.smallCompany
      ? `<div class="box ok"><strong>Likely a small company (0% Companies Income Tax).</strong><br>Turnover ${naira(a.sales)} of the ${naira(a.thresholds.smallCompanyTurnover)} limit (${a.turnoverUsedPct}%).</div>`
      : `<div class="box warn"><strong>Small-company relief likely does not apply.</strong></div>`;
  } else {
    verdict = `<div class="box ${a.estimatedTax === 0 ? 'ok' : 'warn'}"><strong>Estimated personal income tax: ${naira(a.estimatedTax)}</strong><br>Based on profit of ${naira(a.profit)} and the 2026 bands (first ₦800,000 tax-free).</div>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tax Readiness Report ${year}</title><style>${STYLE}</style></head><body>
<button onclick="print()">Print / Save as PDF</button>
<h1>Tax Readiness Report — ${year}</h1>
<p class="muted">${esc(user.business_name)} · ${esc(user.email)}${user.phone ? ' · ' + esc(user.phone) : ''} · ${user.business_type === 'company' ? 'Limited company' : 'Individual / business name'}<br>
Generated ${new Date().toISOString().slice(0, 10)} by Ankoo</p>
<table><tr><th>Total sales (turnover)</th><td>${naira(a.sales)}</td></tr>
<tr><th>Total expenses</th><td>${naira(a.expenses)}</td></tr>
<tr><th>Profit</th><td><strong>${naira(a.profit)}</strong></td></tr></table>
${verdict}
<h2 style="font-size:17px">Monthly breakdown</h2>
<table><thead><tr><th>Month</th><th>Sales</th><th>Expenses</th><th>Profit</th></tr></thead><tbody>${rows}</tbody></table>
<h2 style="font-size:17px">Notes</h2><ul>${a.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
<p class="muted">This report is an estimate prepared from records entered by the business owner. It is not tax advice.
Confirm your position with the Nigeria Revenue Service, your State Internal Revenue Service, or a chartered accountant before filing.</p>
</body></html>`;
}

function upsell() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Upgrade to Pro</title><style>${STYLE}</style></head>
<body><h1>Tax Readiness Report is a Pro feature</h1><p>Upgrade for ₦1,500/month or ₦15,000/year to download your report, export CSV, and record without limits.</p><p><a href="/#account">Go to Account → Upgrade</a></p></body></html>`;
}

module.exports = { render, upsell };
