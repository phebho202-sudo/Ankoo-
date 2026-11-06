'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const QUEUE_KEY = 'ankoo_queue';
  const naira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
  const today = () => new Date().toISOString().slice(0, 10);
  let me = null;
  let plans = {};

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return n;
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET', credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.status = res.status; throw e; }
    return data;
  }

  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  // ---------- Offline queue ----------
  const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };
  const writeQueue = (q) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* storage full or blocked */ } };

  async function flushQueue() {
    const q = readQueue();
    if (!q.length || !navigator.onLine) return;
    const left = [];
    for (const item of q) {
      try { await api('/api/entries', { method: 'POST', body: item }); }
      catch (e) { if (!e.status || e.status >= 500) left.push(item); /* 4xx: drop invalid */ }
    }
    writeQueue(left);
    if (q.length !== left.length) { toast(`Synced ${q.length - left.length} saved record(s)`); refresh(); }
  }

  function setNet() { $('#net').hidden = navigator.onLine; }
  addEventListener('online', () => { setNet(); flushQueue(); });
  addEventListener('offline', setNet);

  // ---------- Auth ----------
  const params = new URLSearchParams(location.search);
  if (params.get('ref')) { try { localStorage.setItem('ankoo_ref', params.get('ref')); } catch {} }
  $('#signupForm [name=ref]').value = params.get('ref') || (() => { try { return localStorage.getItem('ankoo_ref') || ''; } catch { return ''; } })();

  $('#showSignup').onclick = () => { $('#signupForm').hidden = false; $('#loginForm').hidden = true; $('#showSignup').classList.add('on'); $('#showLogin').classList.remove('on'); };
  $('#showLogin').onclick = () => { $('#signupForm').hidden = true; $('#loginForm').hidden = false; $('#showLogin').classList.add('on'); $('#showSignup').classList.remove('on'); };

  $('#signupForm').onsubmit = async (e) => {
    e.preventDefault(); $('#authErr').textContent = '';
    try { await api('/api/signup', { method: 'POST', body: formData(e.target) }); await boot(); }
    catch (err) { $('#authErr').textContent = err.message; }
  };
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault(); $('#authErr').textContent = '';
    try { await api('/api/login', { method: 'POST', body: formData(e.target) }); await boot(); }
    catch (err) { $('#authErr').textContent = err.message; }
  };
  $('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); location.hash = ''; boot(); };

  // ---------- Views ----------
  function show(view) {
    document.querySelectorAll('[data-view]').forEach((s) => { s.hidden = s.dataset.view !== view; });
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === view));
    ({ home: loadHome, book: loadBook, debts: loadDebts, tax: loadTax, account: loadAccount }[view] || loadHome)();
  }
  addEventListener('hashchange', () => me && show(location.hash.slice(1) || 'home'));
  const refresh = () => show(location.hash.slice(1) || 'home');

  async function loadHome() {
    $('#hello').textContent = me.business_name;
    $('#quickForm [name=date]').value = $('#quickForm [name=date]').value || today();
    try {
      const s = await api('/api/summary');
      $('#tSales').textContent = naira(s.today.sales);
      $('#tExp').textContent = naira(s.today.expenses);
      $('#tProfit').textContent = naira(s.today.profit);
      $('#mProfit').textContent = naira(s.month.profit);
      $('#owed').textContent = `${naira(s.owed_to_you)} (${s.debtors})`;
    } catch { /* offline: keep last values */ }
  }

  $('#quickForm').onsubmit = async (e) => {
    e.preventDefault(); $('#quickErr').textContent = '';
    const item = { ...formData(e.target), client_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()) };
    const reset = () => { e.target.amount.value = ''; e.target.note.value = ''; e.target.category.value = ''; e.target.amount.focus(); };
    try {
      await api('/api/entries', { method: 'POST', body: item });
      toast(item.kind === 'sale' ? `Sale of ${naira(item.amount)} saved` : `Expense of ${naira(item.amount)} saved`);
      reset(); loadHome();
    } catch (err) {
      if (!err.status) { writeQueue([...readQueue(), item]); toast('No network — saved on phone, will sync'); reset(); }
      else $('#quickErr').textContent = err.message;
    }
  };

  $('#monthPick').onchange = () => loadBook();
  async function loadBook() {
    if (!$('#monthPick').value) $('#monthPick').value = today().slice(0, 7);
    const list = $('#entryList'); list.replaceChildren();
    const pending = readQueue().filter((q) => q.date.startsWith($('#monthPick').value));
    for (const q of pending) list.append(el('li', {}, el('div', {}, el('div', {}, q.category || q.kind), el('div', { class: 'meta' }, `${q.date} · waiting to sync`)), el('span', { class: `amt ${q.kind}` }, (q.kind === 'sale' ? '+' : '−') + naira(q.amount))));
    try {
      const { entries } = await api(`/api/entries?month=${$('#monthPick').value}`);
      let s = 0, x = 0;
      for (const r of entries) {
        if (r.kind === 'sale') s += r.amount; else x += r.amount;
        list.append(el('li', {},
          el('div', {}, el('div', {}, r.category || (r.kind === 'sale' ? 'Sale' : 'Expense')), el('div', { class: 'meta' }, `${r.date} · ${r.method}${r.note ? ' · ' + r.note : ''}`)),
          el('div', { class: 'row' }, el('span', { class: `amt ${r.kind}` }, (r.kind === 'sale' ? '+' : '−') + naira(r.amount)),
            el('button', { 'aria-label': 'Delete', onclick: async () => { if (confirm('Delete this record?')) { await api(`/api/entries/${r.id}`, { method: 'DELETE' }); loadBook(); } } }, '✕'))));
      }
      $('#bookTotals').textContent = `Sales ${naira(s)} · Expenses ${naira(x)} · Profit ${naira(s - x)}`;
      if (!entries.length && !pending.length) list.append(el('li', {}, el('span', { class: 'muted' }, 'No records this month yet.')));
    } catch { $('#bookTotals').textContent = 'Offline — showing records saved on this phone only.'; }
  }

  function waLink(phone, text) {
    let p = String(phone || '').replace(/\D/g, '');
    if (p.startsWith('0')) p = '234' + p.slice(1);
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
  }

  $('#debtForm').onsubmit = async (e) => {
    e.preventDefault(); $('#debtErr').textContent = '';
    try { await api('/api/debts', { method: 'POST', body: formData(e.target) }); e.target.reset(); toast('Debt added'); loadDebts(); }
    catch (err) { $('#debtErr').textContent = err.message; }
  };
  async function loadDebts() {
    const list = $('#debtList'); list.replaceChildren();
    try {
      const { debts } = await api('/api/debts');
      for (const d of debts) {
        const paid = Boolean(d.paid_at);
        const actions = el('div', { class: 'row' }, el('span', { class: 'amt' }, naira(d.amount)));
        if (!paid) {
          if (d.phone) actions.append(el('a', { class: 'btn', target: '_blank', rel: 'noopener', href: waLink(d.phone, `Hello ${d.customer}, this is a friendly reminder from ${me.business_name} that ${naira(d.amount)} is outstanding${d.due_date ? ' (due ' + d.due_date + ')' : ''}. Thank you!`) }, 'Remind'));
          actions.append(el('button', { onclick: async () => { await api(`/api/debts/${d.id}/paid`, { method: 'POST' }); toast('Marked paid and added to sales'); loadDebts(); } }, 'Paid'));
        }
        list.append(el('li', {}, el('div', {}, el('div', {}, d.customer), el('div', { class: 'meta' }, paid ? `Paid ${d.paid_at.slice(0, 10)}` : (d.due_date ? `Due ${d.due_date}` : 'No due date'))), actions));
      }
      if (!debts.length) list.append(el('li', {}, el('span', { class: 'muted' }, 'Nobody owes you. 🎉')));
    } catch { list.append(el('li', {}, el('span', { class: 'muted' }, 'Connect to the internet to see debts.'))); }
  }

  async function loadTax() {
    const sel = $('#taxYear');
    if (!sel.options.length) { const y = new Date().getFullYear(); for (let i = y; i >= y - 5; i--) sel.append(el('option', { value: i }, i)); sel.onchange = loadTax; }
    const year = sel.value;
    const box = $('#taxBox'); box.replaceChildren(el('p', { class: 'muted' }, 'Loading…'));
    try {
      const { tax } = await api(`/api/summary?year=${year}`);
      box.replaceChildren(
        el('table', {}, el('tr', {}, el('th', {}, 'Sales (turnover)'), el('td', {}, naira(tax.sales))),
          el('tr', {}, el('th', {}, 'Expenses'), el('td', {}, naira(tax.expenses))),
          el('tr', {}, el('th', {}, 'Profit'), el('td', {}, naira(tax.profit)))));
      if (tax.businessType === 'company') {
        box.append(el('p', {}, `Small-company turnover limit used: ${tax.turnoverUsedPct}% of ${naira(tax.thresholds.smallCompanyTurnover)}`));
        const bar = el('div', { class: 'bar' }, el('i', { style: `width:${tax.turnoverUsedPct}%` })); box.append(bar);
        box.append(el('h3', {}, tax.smallCompany ? '✅ Likely 0% Companies Income Tax' : '⚠️ Small-company relief may not apply'));
      } else {
        box.append(el('h3', {}, `Estimated income tax: ${naira(tax.estimatedTax)}`));
      }
      box.append(el('ul', {}, ...tax.notes.map((n) => el('li', {}, n))));
    } catch (err) { box.replaceChildren(el('p', { class: 'err' }, err.message)); }
    $('#reportLink').href = `/report?year=${year}`;
    $('#csvLink').href = `/api/export.csv?year=${year}`;
    $('#proNote').textContent = me.pro ? '' : 'Report and CSV need Pro (₦1,500/month). Upgrade under Account.';
  }

  async function loadAccount() {
    const box = $('#planBox'); box.replaceChildren();
    if (me.pro) {
      box.append(el('h3', {}, '⭐ Pro'), el('p', {}, `Active until ${String(me.pro_until).slice(0, 10)}. Unlimited records, tax report and CSV.`));
    } else {
      box.append(el('h3', {}, 'Free plan'), el('p', { class: 'muted' }, 'Up to 60 records a month. Pro unlocks unlimited records, the Tax Readiness Report and CSV export.'));
    }
    for (const [key, p] of Object.entries(plans)) {
      box.append(el('button', { class: 'primary', onclick: async () => {
        try { const { url } = await api('/api/billing/checkout', { method: 'POST', body: { plan: key } }); location.href = url; }
        catch (err) { toast(err.message); }
      } }, `${me.pro ? 'Extend' : 'Get'} ${p.label} — ${naira(p.amount_kobo / 100)}`));
    }
    const f = $('#profileForm');
    f.business_name.value = me.business_name; f.phone.value = me.phone || ''; f.business_type.value = me.business_type;
    f.fixed_assets.value = me.fixed_assets || ''; f.professional_services.checked = me.professional_services;
    try {
      const r = await api('/api/referrals');
      $('#rate').textContent = `${Math.round(r.rate * 100)}%`;
      $('#refLink').value = r.link;
      $('#shareRef').href = `https://wa.me/?text=${encodeURIComponent(`I use Ankoo to record my sales, expenses and debts on my phone, and to get ready for the new tax rules. Try it free: ${r.link}`)}`;
      $('#refCount').textContent = r.referred; $('#refPaying').textContent = r.paying;
      $('#refEarned').textContent = naira(r.earned); $('#refUnpaid').textContent = naira(r.unpaid);
    } catch {}
    if (me.admin) loadAdmin();
  }
  $('#copyRef').onclick = () => { navigator.clipboard?.writeText($('#refLink').value).then(() => toast('Link copied')); };
  $('#profileForm').onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(e.target); d.professional_services = e.target.professional_services.checked;
    try { const r = await api('/api/profile', { method: 'POST', body: d }); me = { ...me, ...r.user }; $('#profileMsg').textContent = 'Saved'; }
    catch (err) { $('#profileMsg').textContent = err.message; }
  };

  async function loadAdmin() {
    const box = $('#adminBox'); box.hidden = false;
    const s = await api('/api/admin/stats');
    box.replaceChildren(el('h3', {}, 'Admin'),
      el('div', { class: 'stats small' },
        el('div', { class: 'stat' }, el('span', {}, 'Users'), el('strong', {}, s.users)),
        el('div', { class: 'stat' }, el('span', {}, 'Pro'), el('strong', {}, s.pro)),
        el('div', { class: 'stat' }, el('span', {}, 'Revenue (30d)'), el('strong', {}, naira(s.last30))),
        el('div', { class: 'stat' }, el('span', {}, 'Revenue (all)'), el('strong', {}, naira(s.revenue)))),
      el('h3', {}, 'Agent commissions to pay'));
    if (!s.commissions_owed.length) box.append(el('p', { class: 'muted' }, 'None owed.'));
    for (const a of s.commissions_owed) {
      box.append(el('div', { class: 'row between' }, el('span', {}, `${a.email} ${a.phone || ''} (${a.referral_code})`), el('strong', {}, naira(a.amount)),
        el('button', { onclick: async () => { if (confirm(`Mark ${naira(a.amount)} as paid to ${a.email}?`)) { await api('/api/admin/payout', { method: 'POST', body: { referral_code: a.referral_code } }); loadAdmin(); } } }, 'Mark paid')));
    }
  }

  async function boot() {
    setNet();
    try {
      const r = await api('/api/me'); me = r.user; plans = r.plans || {};
      try { localStorage.setItem('ankoo_me', JSON.stringify(me ? { me, plans } : null)); } catch {}
    } catch {
      // Offline: reopen with the last known account so records can still be queued.
      try { const c = JSON.parse(localStorage.getItem('ankoo_me') || 'null'); if (c) { me = c.me; plans = c.plans; } } catch {}
    }
    const loggedIn = Boolean(me);
    $('#auth').hidden = loggedIn; $('#app').hidden = !loggedIn; $('#nav').hidden = !loggedIn;
    if (loggedIn) { refresh(); flushQueue(); }
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  boot();
})();
