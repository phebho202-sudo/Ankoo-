'use strict';
/* Empire Studio AI - dashboard front end. Plain JavaScript, no libraries.
   Each dashboard section is a "view" function further down this file. */

// ---------- small helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nice = (v) => { const s = String(v ?? '').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
const num = (v) => Number(v || 0).toLocaleString('en');
const money = (v) => '$' + Number(v || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
const asDate = (d) => new Date(`${d}T12:00:00Z`);
const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => asDate(d).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
const fmtMonth = (m) => asDate(`${m}-01`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const wordCount = (t) => (String(t || '').trim().match(/\S+/g) || []).length;

const ENUMS = {
  category: ['Billionaires', 'Corporate Empires', 'Luxury Brands', 'Wealth Psychology', 'Business History'],
  topicStatus: ['idea', 'shortlisted', 'approved', 'in_production', 'rejected'],
  sourceType: ['article', 'book', 'company filing', 'interview', 'video', 'report', 'other'],
  credibility: ['high', 'medium', 'low', 'unverified'],
  scriptStatus: ['outline', 'draft', 'in_review', 'approved'],
  format: ['documentary', 'short'],
  stage: ['not_started', 'in_progress', 'done'],
  assetStatus: ['planned', 'in_progress', 'ready', 'approved'],
  pubStatus: ['awaiting_approval', 'scheduled', 'published'],
};
const TONE = {
  approved: 'good', done: 'good', published: 'good', high: 'good', ready: 'info', scheduled: 'info', shortlisted: 'info',
  in_review: 'warn', awaiting_approval: 'warn', in_progress: 'warn', in_production: 'gold', medium: 'info',
  rejected: 'bad', low: 'bad', documentary: 'gold',
};
const badge = (v) => `<span class="badge ${TONE[v] || ''}">${esc(nice(v))}</span>`;
const demo = (row) => (row.is_demo ? ' <span class="badge demo" title="Sample data, not real">DEMO</span>' : '');

async function api(method, path, body) {
  const res = await fetch('/api/' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const load = (...tables) => Promise.all(tables.map((t) => api('GET', t)));

let toastTimer;
function toast(message, isError) {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, isError ? 5000 : 2400);
}

function todayIn(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}
function addDays(date, days) {
  const d = asDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- pop-up form ----------
// fields: [{ name, label, type: text|textarea|number|date|time|month|select|url, options, value, required, hint }]
function openForm({ title, fields = [], message, submitLabel = 'Save', danger, onSubmit, onChange }) {
  const modal = $('#modal');
  const form = $('#modalForm');
  form.innerHTML = `<h2>${esc(title)}</h2>${message ? `<p class="muted">${esc(message)}</p>` : ''}` + fields.map((f) => {
    const id = 'f_' + f.name;
    const req = f.required ? ' required' : '';
    let input;
    if (f.type === 'select') {
      input = `<select id="${id}" name="${f.name}"${req}>` + f.options.map((o) => {
        const [value, text] = Array.isArray(o) ? o : [o, nice(o)];
        return `<option value="${esc(value)}"${String(value) === String(f.value ?? '') ? ' selected' : ''}>${esc(text)}</option>`;
      }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"${req}>${esc(f.value)}</textarea>`;
    } else {
      const extra = f.type === 'number' ? ` min="${f.min ?? 0}"${f.max !== undefined ? ` max="${f.max}"` : ''} step="${f.step || 1}"` : '';
      input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value)}"${req}${extra}>`;
    }
    return `<div class="field"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
  }).join('') + `<div class="form-error" id="formError"></div>
    <div class="modal-actions">
      <button type="button" class="btn" id="formCancel">Cancel</button>
      <button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${esc(submitLabel)}</button>
    </div>`;
  $('#formCancel').onclick = () => modal.close();
  form.onchange = onChange ? (e) => onChange(e.target, form) : null;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    try {
      await onSubmit(values);
      modal.close();
    } catch (err) { $('#formError').textContent = err.message; }
  };
  modal.showModal();
}

function confirmDelete(table, row, what) {
  openForm({
    title: `Delete this ${what}?`,
    message: `"${row.title || row.name || fmtMonth(row.month)}" will be permanently removed.`,
    submitLabel: 'Delete', danger: true,
    onSubmit: async () => { await api('DELETE', `${table}/${row.id}`); toast('Deleted'); refresh(); },
  });
}

// Add / edit helper shared by most sections.
function recordForm(table, what, fields, row, extra = {}) {
  openForm({
    title: (row ? 'Edit ' : 'New ') + what,
    fields: fields.map((f) => ({ ...f, value: row ? row[f.name] : f.value })),
    onChange: extra.onChange,
    onSubmit: async (values) => {
      const body = { ...extra.fixed, ...values };
      if (row) await api('PUT', `${table}/${row.id}`, body); else await api('POST', table, body);
      toast('Saved');
      refresh();
    },
  });
}

const optionList = (rows, noneLabel) => [['', noneLabel], ...rows.map((r) => [r.id, r.title])];
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

function barChart(rows, field, format = num) {
  if (!rows.length) return '<div class="empty">No data yet.</div>';
  const W = 640, H = 220, top = 22, bottom = 26, max = Math.max(1, ...rows.map((r) => Number(r[field]) || 0));
  const slot = W / rows.length, bw = Math.min(54, slot * 0.6);
  const bars = rows.map((r, i) => {
    const v = Number(r[field]) || 0, h = ((H - top - bottom) * v) / max, x = i * slot + (slot - bw) / 2, y = H - bottom - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="3"><title>${esc(fmtMonth(r.month))}: ${esc(format(v))}</title></rect>
      <text class="v" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${esc(format(v))}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(fmtMonth(r.month))}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of ${esc(nice(field))} by month"><line x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/>${bars}</svg>`;
}

// ---------- navigation ----------
const ICON = {
  overview: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z',
  topics: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  research: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 9h6M9 13h6',
  scripts: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  voice: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  visuals: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  production: 'M4 8h16v12H4zM4 8l3-4M9 8l3-4M14 8l3-4M19 8l1-4',
  thumbnails: 'M3 6h18v12H3zM10 9.5v5l4.5-2.5z',
  uploads: 'M12 16V5M8 9l4-4 4 4M5 19h14',
  analytics: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  monetization: 'M12 3v18M16 7.5c-.6-1.3-2-2-4-2-2.3 0-4 1-4 3s1.6 2.7 4 3.2 4 1.3 4 3.3-1.7 3-4 3c-2.2 0-3.7-.8-4.3-2.3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
};
const NAV = [
  ['Studio', [['overview', 'Overview', 'Your channel at a glance']]],
  ['Plan', [
    ['topics', 'Topic Research', 'Find, score and approve documentary ideas'],
    ['calendar', 'Content Calendar', 'What publishes when'],
    ['research', 'Research Library', 'Sources and notes for every topic'],
  ]],
  ['Create', [
    ['scripts', 'Script Studio', 'Write and review narration scripts'],
    ['voice', 'Voice Studio', 'Plan and track narration recordings'],
    ['visuals', 'Visual Studio', 'Plan and track scenes and visual prompts'],
    ['production', 'Video Production', 'Track every video from script to final edit'],
    ['thumbnails', 'Thumbnail Studio', 'Thumbnail concepts and headlines'],
  ]],
  ['Publish', [
    ['uploads', 'Upload Manager', 'Approve, schedule and record uploads'],
    ['analytics', 'YouTube Analytics', 'Monthly channel performance'],
    ['monetization', 'Monetization Tracker', 'Progress toward earning from the channel'],
  ]],
  ['System', [['settings', 'Settings', 'Channel settings and data']]],
];
const ROUTES = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([id, title, sub]) => [id, { title, sub }])));

$('#nav').innerHTML = NAV.map(([group, items]) => `<div class="nav-group">${group}</div>` + items.map(([id, title]) =>
  `<a href="#/${id}" data-route="${id}"><svg viewBox="0 0 24 24"><path d="${ICON[id]}"/></svg>${title}</a>`).join('')).join('');

const closeMenu = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); };
$('#menuBtn').onclick = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('open'); };
$('#scrim').onclick = closeMenu;
$('#nav').onclick = closeMenu;

let current = { actions: {}, changes: {} };
let settings = {};
let renderToken = 0;

async function refresh() {
  const id = location.hash.replace(/^#\//, '') || 'overview';
  const route = ROUTES[id] ? id : 'overview';
  if (current.leave && !current.leave(route)) { history.replaceState(null, '', '#/' + current.route); return; }
  const token = ++renderToken;
  closeMenu();
  document.querySelectorAll('#nav a').forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#pageTitle').textContent = ROUTES[route].title;
  $('#pageSub').textContent = ROUTES[route].sub;
  document.title = `${ROUTES[route].title} - Empire Studio AI`;
  try {
    const ov = await api('GET', 'overview');
    settings = ov.settings;
    const view = await VIEWS[route](ov);
    if (token !== renderToken) return; // a newer navigation happened while loading
    current = { actions: {}, changes: {}, ...view, route };
    $('#brandChannel').textContent = settings.channel_name;
    $('#demoBanner').hidden = !ov.has_demo;
    $('#pageActions').innerHTML = view.buttons || '';
    $('#view').innerHTML = view.html;
    if (view.mount) view.mount();
  } catch (err) {
    $('#view').innerHTML = `<div class="panel empty">Could not load this page: ${esc(err.message)}<br>Make sure the server is still running in your terminal.</div>`;
  }
}

function dispatch(e, map, attr) {
  const el = e.target.closest(`[data-${attr}]`);
  if (!el) return;
  const fn = current[map][el.dataset[attr]];
  if (fn) Promise.resolve(fn(el.dataset, el)).catch((err) => toast(err.message, true));
}
document.addEventListener('click', (e) => dispatch(e, 'actions', 'act'));
document.addEventListener('change', (e) => dispatch(e, 'changes', 'change'));
window.addEventListener('hashchange', refresh);

// ---------- views ----------
const VIEWS = {};

VIEWS.overview = async (ov) => {
  const s = ov.stats, m = ov.monetization;
  const stat = (label, value, note) => `<div class="panel stat"><div class="label">${label}</div><div class="value">${num(value)}</div><div class="note">${note}</div></div>`;
  const goal = (label, have, want, unit) => `<div class="goal"><div class="goal-head"><span>${label}</span><span><b>${num(have)}</b> <span class="muted">/ ${num(want)} ${unit}</span></span></div><div class="bar"><i style="width:${pct(have, want)}%"></i></div></div>`;
  return {
    html: `
    <section class="hero">
      <div>
        <div class="eyebrow">YouTube channel</div>
        <h2>${esc(settings.channel_name)}</h2>
        <p>${esc(settings.niche)}.</p>
      </div>
      <div class="hero-meta">
        <div>Documentaries<b>${esc(settings.main_publish_time)}</b></div>
        <div>Shorts<b>${esc(settings.shorts_publish_time)}</b></div>
        <div>Timezone<b>${esc(settings.timezone)}</b></div>
        <div>Target length<b>${esc(settings.video_duration_minutes)} min</b></div>
      </div>
    </section>
    <section class="grid stats">
      ${stat('Documentaries produced', s.documentaries_produced, 'Fully finished productions')}
      ${stat('Videos published', s.videos_published, 'Documentaries and Shorts')}
      ${stat('Awaiting approval', s.awaiting_approval, s.awaiting_approval ? '<a href="#/uploads">Review them</a>' : 'Nothing waiting')}
      ${stat('Upcoming scheduled', s.upcoming_scheduled, 'Approved and on the calendar')}
    </section>
    <section class="grid two" style="margin-top:16px">
      <div class="panel">
        <h2>Production progress <a href="#/production">Open production</a></h2>
        ${ov.production.length ? ov.production.map((j) => `<div class="progress-row"><div class="progress-head"><span>${esc(j.title)}${demo(j)}</span><span>${j.progress}%</span></div><div class="bar"><i style="width:${j.progress}%"></i></div></div>`).join('') : '<div class="empty">No videos in production. Approve a topic to start one.</div>'}
      </div>
      <div class="panel">
        <h2>Monetization progress <a href="#/monetization">Details</a></h2>
        ${goal('Subscribers', m.subscribers, m.subscribers_goal, '')}
        ${goal('Watch hours (last 12 months)', m.watch_hours_12m, m.watch_hours_goal, 'hrs')}
        <div class="goal-head" style="margin-top:18px"><span>Revenue recorded</span><b>${money(m.revenue_usd)}</b></div>
      </div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Publishing schedule <a href="#/calendar">Open calendar</a></h2>
      ${ov.schedule.length ? ov.schedule.map((p) => `<div class="schedule-item">
        <div class="date-chip"><span>${fmtDate(p.publish_date, { month: 'short' })}</span><b>${asDate(p.publish_date).getUTCDate()}</b></div>
        <div class="grow"><div>${esc(p.title)}${demo(p)}</div><div class="muted" style="font-size:13px">${fmtDate(p.publish_date, { weekday: 'long' })} at ${esc(p.publish_time)} &middot; ${nice(p.format)}</div></div>
        ${badge(p.status)}</div>`).join('') : '<div class="empty">Nothing on the schedule yet.</div>'}
    </section>`,
  };
};

VIEWS.topics = async () => {
  const [topics] = await load('topics');
  const map = byId(topics);
  const fields = [
    { name: 'title', label: 'Working title', required: true },
    { name: 'category', label: 'Category', type: 'select', options: ENUMS.category },
    { name: 'angle', label: 'Angle (what makes this story worth 45 minutes?)', type: 'textarea', rows: 3 },
    { name: 'potential_score', label: 'Potential score (0-100)', type: 'number', max: 100, value: 50, hint: 'Your own estimate of audience interest. Higher is better.' },
    { name: 'status', label: 'Status', type: 'select', options: ENUMS.topicStatus },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
  ];
  const draw = () => {
    const q = $('#topicSearch').value.toLowerCase(), st = $('#topicStatus').value;
    const rows = topics.filter((t) => (!st || t.status === st) && (t.title + ' ' + t.angle + ' ' + t.category).toLowerCase().includes(q));
    $('#topicRows').innerHTML = rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Topic</th><th>Category</th><th class="num">Score</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map((t) => `<tr><td><div>${esc(t.title)}${demo(t)}</div><div class="sub">${esc(t.angle)}</div></td>
        <td>${esc(t.category)}</td><td class="num">${t.potential_score}</td><td>${badge(t.status)}</td>
        <td><div class="row-actions">
          ${['idea', 'shortlisted'].includes(t.status) ? `<button class="btn small" data-act="approve" data-id="${t.id}">Approve</button>` : ''}
          ${t.status === 'approved' ? `<button class="btn small primary" data-act="produce" data-id="${t.id}">Start production</button>` : ''}
          <button class="btn small" data-act="edit" data-id="${t.id}">Edit</button>
          <button class="btn small danger" data-act="del" data-id="${t.id}">Delete</button>
        </div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No topics match. Add one with "New topic".</div>';
  };
  return {
    buttons: '<button class="btn primary" data-act="add">+ New topic</button>',
    html: `<div class="toolbar"><input id="topicSearch" type="search" placeholder="Search topics" aria-label="Search topics">
      <select id="topicStatus" aria-label="Filter by status"><option value="">All statuses</option>${ENUMS.topicStatus.map((s) => `<option value="${s}">${nice(s)}</option>`).join('')}</select>
      <span class="spacer"></span><span class="muted">${topics.length} topics</span></div>
      <div class="panel" id="topicRows"></div>`,
    mount() { draw(); $('#topicSearch').oninput = draw; $('#topicStatus').onchange = draw; },
    actions: {
      add: () => recordForm('topics', 'topic', fields),
      edit: (d) => recordForm('topics', 'topic', fields, map[d.id]),
      del: (d) => confirmDelete('topics', map[d.id], 'topic'),
      approve: async (d) => { await api('PUT', `topics/${d.id}`, { status: 'approved' }); toast('Topic approved'); refresh(); },
      produce: async (d) => {
        await api('POST', 'jobs', { topic_id: Number(d.id), title: map[d.id].title });
        await api('PUT', `topics/${d.id}`, { status: 'in_production' });
        toast('Production job created');
        location.hash = '#/production';
      },
    },
  };
};

function publishingFields(jobs) {
  return [
    { name: 'title', label: 'Video title', required: true },
    { name: 'format', label: 'Format', type: 'select', options: ENUMS.format },
    { name: 'publish_date', label: 'Publish date', type: 'date', required: true },
    { name: 'publish_time', label: `Publish time (${settings.timezone})`, type: 'time', required: true, value: settings.main_publish_time },
    { name: 'status', label: 'Status', type: 'select', options: ENUMS.pubStatus },
    { name: 'job_id', label: 'Linked production job', type: 'select', options: optionList(jobs, 'None') },
    { name: 'youtube_url', label: 'YouTube link (after you upload it yourself)', type: 'url' },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
  ];
}
// Switching between documentary and short swaps in that format's default publish time.
function formatTimeSync(target, form) {
  if (target.name !== 'format') return;
  form.elements.publish_time.value = target.value === 'short' ? settings.shorts_publish_time : settings.main_publish_time;
}
const pubForm = (jobs, row, preset = {}) => recordForm('publishing', 'schedule entry',
  publishingFields(jobs).map((f) => (preset[f.name] !== undefined ? { ...f, value: preset[f.name] } : f)), row, { onChange: formatTimeSync });

let calMonth = null;
VIEWS.calendar = async (ov) => {
  const [publishing, jobs] = await load('publishing', 'jobs');
  const map = byId(publishing);
  calMonth = calMonth || ov.today.slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let cells = dows.map((d) => `<div class="dow">${d}</div>`).join('') + '<div class="day out"></div>'.repeat(lead);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${calMonth}-${String(d).padStart(2, '0')}`;
    const evs = publishing.filter((p) => p.publish_date === date);
    cells += `<div class="day${date === ov.today ? ' today' : ''}${evs.length ? ' has-ev' : ''}" data-act="addOn" data-date="${date}" title="Click to schedule a video on ${fmtDate(date)}">
      <span class="n" data-dow="${dows[(lead + d - 1) % 7]}">${d}</span>
      ${evs.map((p) => `<button class="ev ${p.format} ${p.status}" data-act="edit" data-id="${p.id}" title="${esc(p.title)} - ${nice(p.status)}">${esc(p.publish_time)} ${p.is_demo ? '[DEMO] ' : ''}${esc(p.title)}</button>`).join('')}
    </div>`;
  }
  const shift = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); calMonth = d.toISOString().slice(0, 7); refresh(); };
  return {
    buttons: '<button class="btn primary" data-act="add">+ Schedule a video</button>',
    html: `<div class="cal-head"><button class="btn" data-act="prev" aria-label="Previous month">&larr;</button>
      <h2>${asDate(calMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
      <button class="btn" data-act="next" aria-label="Next month">&rarr;</button><button class="btn" data-act="now">Today</button></div>
      <div class="cal">${cells}</div>
      <div class="legend"><span><i style="background:var(--gold)"></i>Documentary (${esc(settings.main_publish_time)})</span><span><i style="background:var(--blue)"></i>Short (${esc(settings.shorts_publish_time)})</span><span><i style="background:var(--green)"></i>Published</span><span>Dashed edge = awaiting approval</span><span>All times ${esc(settings.timezone)}</span></div>`,
    actions: {
      prev: () => shift(-1), next: () => shift(1),
      now: () => { calMonth = ov.today.slice(0, 7); refresh(); },
      add: () => pubForm(jobs, null, { publish_date: ov.today }),
      addOn: (d) => pubForm(jobs, null, { publish_date: d.date }),
      edit: (d) => pubForm(jobs, map[d.id]),
    },
  };
};

VIEWS.research = async () => {
  const [research, topics] = await load('research', 'topics');
  const map = byId(research), tmap = byId(topics);
  const fields = [
    { name: 'title', label: 'Source title', required: true },
    { name: 'topic_id', label: 'Topic', type: 'select', options: optionList(topics, 'No topic') },
    { name: 'source_type', label: 'Type', type: 'select', options: ENUMS.sourceType },
    { name: 'source_url', label: 'Link', type: 'url' },
    { name: 'credibility', label: 'Credibility', type: 'select', options: ENUMS.credibility, value: 'unverified', hint: 'How much do you trust this source? Verify facts before scripting.' },
    { name: 'summary', label: 'Key facts and notes', type: 'textarea', rows: 6 },
  ];
  const draw = () => {
    const q = $('#resSearch').value.toLowerCase(), tid = $('#resTopic').value;
    const rows = research.filter((r) => (!tid || String(r.topic_id) === tid) && (r.title + ' ' + r.summary).toLowerCase().includes(q));
    $('#resCards').innerHTML = rows.length ? rows.map((r) => `<article class="panel card">
      <h3>${esc(r.title)}${demo(r)}</h3>
      <div class="muted" style="font-size:13px">${esc(tmap[r.topic_id]?.title || 'No topic')}</div>
      <div class="meta">${badge(r.source_type)}<span class="badge ${TONE[r.credibility] || ''}">Credibility: ${esc(r.credibility)}</span></div>
      <p>${esc(r.summary)}</p>
      <div class="row-actions">${/^https?:\/\//i.test(r.source_url) ? `<a class="btn small" href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">Open source</a>` : ''}
        <button class="btn small" data-act="edit" data-id="${r.id}">Edit</button><button class="btn small danger" data-act="del" data-id="${r.id}">Delete</button></div>
    </article>`).join('') : '<div class="panel empty" style="grid-column:1/-1">No research found. Add a source with "New source".</div>';
  };
  return {
    buttons: '<button class="btn primary" data-act="add">+ New source</button>',
    html: `<div class="toolbar"><input id="resSearch" type="search" placeholder="Search research" aria-label="Search research">
      <select id="resTopic" aria-label="Filter by topic"><option value="">All topics</option>${topics.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select></div>
      <div class="grid cards" id="resCards"></div>`,
    mount() { draw(); $('#resSearch').oninput = draw; $('#resTopic').onchange = draw; },
    actions: {
      add: () => recordForm('research', 'source', fields),
      edit: (d) => recordForm('research', 'source', fields, map[d.id]),
      del: (d) => confirmDelete('research', map[d.id], 'source'),
    },
  };
};

let scriptId = null;
VIEWS.scripts = async () => {
  const [scripts, topics] = await load('scripts', 'topics');
  const map = byId(scripts);
  if (!map[scriptId]) scriptId = scripts[0]?.id ?? null;
  const s = map[scriptId];
  const wpm = Number(settings.words_per_minute) || 150;
  const target = wpm * (Number(settings.video_duration_minutes) || 45);
  let dirty = false;
  const count = () => {
    const words = wordCount($('#scriptText').value);
    $('#scriptCount').innerHTML = `<b>${num(words)}</b> words &middot; about <b>${Math.round(words / wpm)}</b> min narrated &middot; target ${num(target)} words (${esc(settings.video_duration_minutes)} min)`;
    $('#scriptBar').style.width = pct(words, target) + '%';
  };
  const save = async () => {
    await api('PUT', `scripts/${s.id}`, { title: $('#scriptTitle').value, topic_id: $('#scriptTopic').value, status: $('#scriptStatus').value, content: $('#scriptText').value });
    dirty = false;
    toast('Script saved');
    refresh();
  };
  return {
    buttons: '<button class="btn primary" data-act="add">+ New script</button>',
    html: `<div class="split">
      <div class="panel script-list"><h2>Scripts</h2>
        ${scripts.length ? scripts.map((x) => `<button data-act="open" data-id="${x.id}" class="${x.id === scriptId ? 'active' : ''}"><span class="t">${esc(x.title)}</span>${badge(x.status)}${demo(x)} <span class="muted" style="font-size:12.5px">${num(wordCount(x.content))} words</span></button>`).join('') : '<div class="empty">No scripts yet.</div>'}
      </div>
      <div class="panel">${s ? `
        <div class="script-meta">
          <div><label for="scriptTitle">Title</label><input id="scriptTitle" value="${esc(s.title)}"></div>
          <div><label for="scriptTopic">Topic</label><select id="scriptTopic">${optionList(topics, 'No topic').map(([v, t]) => `<option value="${v}"${String(v) === String(s.topic_id ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
          <div><label for="scriptStatus">Status</label><select id="scriptStatus">${ENUMS.scriptStatus.map((v) => `<option value="${v}"${v === s.status ? ' selected' : ''}>${nice(v)}</option>`).join('')}</select></div>
        </div>
        <label for="scriptText">Narration script ${demo(s)}</label>
        <textarea id="scriptText" spellcheck="true">${esc(s.content)}</textarea>
        <div class="script-foot"><span id="scriptCount" class="muted"></span><div class="bar"><i id="scriptBar"></i></div></div>
        <div class="script-foot"><button class="btn primary" data-act="save">Save script</button><span id="scriptDirty" class="muted">All changes saved</span><span class="spacer" style="flex:1"></span><button class="btn danger" data-act="del">Delete script</button></div>
        <p class="hint">Narration: ${esc(settings.narration)}. Tip: press Ctrl+S (or Cmd+S on Mac) to save.</p>` : '<div class="empty">Create your first script with "New script".</div>'}
      </div></div>`,
    mount() {
      if (!s) return;
      count();
      const mark = () => { dirty = true; $('#scriptDirty').textContent = 'Unsaved changes'; };
      $('#scriptText').oninput = () => { count(); mark(); };
      ['scriptTitle', 'scriptTopic', 'scriptStatus'].forEach((id) => { $('#' + id).oninput = mark; });
      $('#scriptText').onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save().catch((err) => toast(err.message, true)); } };
    },
    leave: () => !dirty || confirm('You have unsaved changes in this script. Leave without saving?'),
    actions: {
      add: () => recordForm('scripts', 'script', [
        { name: 'title', label: 'Script title', required: true },
        { name: 'topic_id', label: 'Topic', type: 'select', options: optionList(topics, 'No topic') },
      ]),
      open: (d) => {
        if (dirty && !confirm('You have unsaved changes in this script. Switch without saving?')) return;
        dirty = false; scriptId = Number(d.id); refresh();
      },
      save,
      del: () => { dirty = false; confirmDelete('scripts', s, 'script'); },
    },
  };
};

// Voice Studio, Visual Studio and Thumbnail Studio share one layout: assets grouped by production job.
function assetView(kind, copy) {
  return async () => {
    const [assets, jobs] = await load('assets', 'jobs');
    const mine = assets.filter((a) => a.kind === kind), map = byId(mine), jmap = byId(jobs);
    const fields = [
      { name: 'job_id', label: 'Production job', type: 'select', options: jobs.map((j) => [j.id, j.title]), required: true },
      { name: 'name', label: copy.nameLabel, required: true },
      { name: 'details', label: copy.detailsLabel, type: 'textarea', rows: 4 },
      { name: 'status', label: 'Status', type: 'select', options: ENUMS.assetStatus },
    ];
    const groups = jobs.map((j) => [j, mine.filter((a) => a.job_id === j.id)]).filter(([, list]) => list.length);
    const add = () => (jobs.length ? recordForm('assets', copy.what, fields, null, { fixed: { kind } }) : toast('Create a production job first (Video Production).', true));
    return {
      buttons: `<button class="btn primary" data-act="add">+ New ${copy.what}</button>`,
      html: `<div class="panel" style="margin-bottom:16px"><span class="muted">${copy.intro(settings)}</span></div>` +
        (groups.length ? groups.map(([j, list]) => `<h2 class="group-title">${esc(j.title)} <span class="badge">${list.filter((a) => ['ready', 'approved'].includes(a.status)).length} / ${list.length} ready</span></h2>
          <div class="grid cards">${list.map((a) => `<article class="panel card">
            ${kind === 'thumbnail' ? `<div class="thumb" aria-hidden="true">${esc(a.name)}</div>` : ''}
            <h3>${esc(a.name)}${demo(a)}</h3><div class="meta">${badge(a.status)}</div><p>${esc(a.details)}</p>
            <div class="row-actions">
              ${a.status !== 'approved' ? `<button class="btn small" data-act="advance" data-id="${a.id}">Mark ${nice(ENUMS.assetStatus[ENUMS.assetStatus.indexOf(a.status) + 1]).toLowerCase()}</button>` : ''}
              <button class="btn small" data-act="edit" data-id="${a.id}">Edit</button><button class="btn small danger" data-act="del" data-id="${a.id}">Delete</button>
            </div></article>`).join('')}</div>`).join('') : `<div class="panel empty">Nothing here yet. Add your first ${copy.what}.</div>`),
      actions: {
        add,
        edit: (d) => recordForm('assets', copy.what, fields, map[d.id], { fixed: { kind } }),
        del: (d) => confirmDelete('assets', { ...map[d.id], title: map[d.id].name }, copy.what),
        advance: async (d) => {
          const next = ENUMS.assetStatus[ENUMS.assetStatus.indexOf(map[d.id].status) + 1];
          await api('PUT', `assets/${d.id}`, { status: next });
          toast(`Marked ${nice(next).toLowerCase()}`);
          refresh();
        },
      },
    };
  };
}
VIEWS.voice = assetView('voice', {
  what: 'narration segment', nameLabel: 'Segment name (e.g. Act 1 narration)', detailsLabel: 'Direction notes (tone, pace, pronunciation)',
  intro: (s) => `Channel voice: <b>${esc(s.narration)}</b>, in ${esc(s.language)}. Break each script into segments and track them here. No voice service is connected yet, so nothing is generated or charged.`,
});
VIEWS.visuals = assetView('visual', {
  what: 'scene', nameLabel: 'Scene name', detailsLabel: 'Visual description or image/video prompt',
  intro: (s) => `Visual style: <b>${esc(s.visual_style)}</b>. Plan each scene and its prompt here. No image or video generator is connected yet, so nothing is generated or charged.`,
});
VIEWS.thumbnails = assetView('thumbnail', {
  what: 'thumbnail concept', nameLabel: 'Headline text on the thumbnail', detailsLabel: 'Concept description',
  intro: () => 'Draft several thumbnail concepts per video and approve the strongest. The preview shows how your headline reads in a 16:9 frame; it is a mock-up, not a finished image.',
});

const STAGES = [['script_status', 'Script'], ['voice_status', 'Voice'], ['visuals_status', 'Visuals'], ['edit_status', 'Edit'], ['thumbnail_status', 'Thumbnail']];
VIEWS.production = async (ov) => {
  const [jobs, topics, publishing] = await load('jobs', 'topics', 'publishing');
  const map = byId(jobs);
  const queued = new Set(publishing.map((p) => p.job_id));
  const fields = [
    { name: 'title', label: 'Video title', required: true },
    { name: 'format', label: 'Format', type: 'select', options: ENUMS.format },
    { name: 'topic_id', label: 'Topic', type: 'select', options: optionList(topics, 'No topic') },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
  ];
  const card = (j) => `<article class="panel card">
    <h3>${esc(j.title)}${demo(j)}</h3>
    <div class="meta">${badge(j.format)}${j.progress === 100 ? '<span class="badge good">Complete</span>' : ''}${queued.has(j.id) ? '<span class="badge info">In Upload Manager</span>' : ''}</div>
    <div class="progress-head"><span class="muted">Progress</span><span>${j.progress}%</span></div><div class="bar"><i style="width:${j.progress}%"></i></div>
    <div class="stages">${STAGES.map(([f, label]) => `<div><label for="${f}${j.id}">${label}</label><select id="${f}${j.id}" class="${j[f]}" data-change="stage" data-id="${j.id}" data-field="${f}">${ENUMS.stage.map((v) => `<option value="${v}"${v === j[f] ? ' selected' : ''}>${nice(v)}</option>`).join('')}</select></div>`).join('')}</div>
    ${j.notes ? `<p>${esc(j.notes)}</p>` : ''}
    <div class="row-actions">
      ${j.progress === 100 && !queued.has(j.id) ? `<button class="btn small primary" data-act="send" data-id="${j.id}">Send for approval</button>` : ''}
      <button class="btn small" data-act="edit" data-id="${j.id}">Edit</button><button class="btn small danger" data-act="del" data-id="${j.id}">Delete</button>
    </div></article>`;
  const active = jobs.filter((j) => j.progress < 100), finished = jobs.filter((j) => j.progress === 100);
  return {
    buttons: '<button class="btn primary" data-act="add">+ New production job</button>',
    html: (jobs.length ? '' : '<div class="panel empty">No production jobs yet. Approve a topic in Topic Research, then press "Start production".</div>') +
      (active.length ? `<h2 class="group-title">In production <span class="badge">${active.length}</span></h2><div class="grid cards">${active.map(card).join('')}</div>` : '') +
      (finished.length ? `<h2 class="group-title">Finished <span class="badge">${finished.length}</span></h2><div class="grid cards">${finished.map(card).join('')}</div>` : ''),
    actions: {
      add: () => recordForm('jobs', 'production job', fields),
      edit: (d) => recordForm('jobs', 'production job', fields, map[d.id]),
      del: (d) => confirmDelete('jobs', map[d.id], 'production job'),
      send: async (d) => {
        const j = map[d.id];
        await api('POST', 'publishing', {
          job_id: j.id, title: j.title, format: j.format, status: 'awaiting_approval', publish_date: addDays(ov.today, 7),
          publish_time: j.format === 'short' ? settings.shorts_publish_time : settings.main_publish_time,
        });
        toast('Sent to Upload Manager for your approval');
        location.hash = '#/uploads';
      },
    },
    changes: {
      stage: async (d, el) => { await api('PUT', `jobs/${d.id}`, { [d.field]: el.value }); toast('Progress updated'); refresh(); },
    },
  };
};

VIEWS.uploads = async () => {
  const [publishing, jobs] = await load('publishing', 'jobs');
  const map = byId(publishing);
  const set = async (id, status, message) => { await api('PUT', `publishing/${id}`, { status }); toast(message); refresh(); };
  const table = (title, rows, emptyText) => `<section class="panel" style="margin-bottom:16px"><h2>${title} <span class="badge">${rows.length}</span></h2>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Video</th><th>Format</th><th>Publish time</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.map((p) => `<tr><td>${esc(p.title)}${demo(p)}${/^https?:\/\//i.test(p.youtube_url) ? `<div class="sub"><a href="${esc(p.youtube_url)}" target="_blank" rel="noopener noreferrer">View on YouTube</a></div>` : ''}</td>
      <td>${badge(p.format)}</td><td style="white-space:nowrap">${fmtDate(p.publish_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}<div class="sub">${esc(p.publish_time)}</div></td><td>${badge(p.status)}</td>
      <td><div class="row-actions">
        ${p.status === 'awaiting_approval' ? `<button class="btn small primary" data-act="approve" data-id="${p.id}">Approve &amp; schedule</button>` : ''}
        ${p.status === 'scheduled' ? `<button class="btn small" data-act="published" data-id="${p.id}">Mark as published</button><button class="btn small" data-act="unapprove" data-id="${p.id}">Back to approval</button>` : ''}
        <button class="btn small" data-act="edit" data-id="${p.id}">Edit</button><button class="btn small danger" data-act="del" data-id="${p.id}">Delete</button>
      </div></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${emptyText}</div>`}</section>`;
  const of = (s) => publishing.filter((p) => p.status === s);
  return {
    buttons: '<button class="btn primary" data-act="add">+ New upload record</button>',
    html: `<div class="panel" style="margin-bottom:16px"><b>YouTube is not connected.</b> <span class="muted">Nothing here uploads or publishes anything. This page is your approval queue and publishing record: approve a video, upload it to YouTube yourself, then press "Mark as published".</span></div>` +
      table('Awaiting your approval', of('awaiting_approval'), 'Nothing is waiting for approval.') +
      table('Scheduled', of('scheduled'), 'No scheduled videos.') +
      table('Published', of('published').reverse(), 'No published videos recorded yet.'),
    actions: {
      add: () => pubForm(jobs, null, {}),
      edit: (d) => pubForm(jobs, map[d.id]),
      del: (d) => confirmDelete('publishing', map[d.id], 'upload record'),
      approve: (d) => set(d.id, 'scheduled', 'Approved and scheduled'),
      unapprove: (d) => set(d.id, 'awaiting_approval', 'Moved back to approval'),
      published: (d) => openForm({
        title: 'Mark as published',
        message: 'Only do this after you have uploaded the video to YouTube yourself. This just records it here.',
        fields: [{ name: 'youtube_url', label: 'YouTube link (optional)', type: 'url', value: map[d.id].youtube_url }],
        submitLabel: 'Mark as published',
        onSubmit: async (v) => { await api('PUT', `publishing/${d.id}`, { status: 'published', youtube_url: v.youtube_url }); toast('Recorded as published'); refresh(); },
      }),
    },
  };
};

const metricFields = () => [
  { name: 'month', label: 'Month', type: 'month', required: true },
  { name: 'views', label: 'Views', type: 'number', value: 0 },
  { name: 'watch_hours', label: 'Watch hours', type: 'number', step: 'any', value: 0 },
  { name: 'subscribers_gained', label: 'Net subscribers gained', type: 'number', min: -100000000, value: 0 },
  { name: 'revenue_usd', label: 'Revenue (USD)', type: 'number', step: '0.01', value: 0 },
];
function metricActions(metrics) {
  const map = byId(metrics);
  return {
    add: () => recordForm('metrics', 'monthly record', metricFields()),
    edit: (d) => recordForm('metrics', 'monthly record', metricFields(), map[d.id]),
    del: (d) => confirmDelete('metrics', map[d.id], 'monthly record'),
  };
}
const metricTable = (metrics) => (metrics.length ? `<div class="table-wrap"><table><thead><tr><th>Month</th><th class="num">Views</th><th class="num">Watch hours</th><th class="num">Subscribers</th><th class="num">Revenue</th><th></th></tr></thead><tbody>
  ${[...metrics].reverse().map((r) => `<tr><td>${fmtMonth(r.month)}${demo(r)}</td><td class="num">${num(r.views)}</td><td class="num">${num(r.watch_hours)}</td><td class="num">${r.subscribers_gained > 0 ? '+' : ''}${num(r.subscribers_gained)}</td><td class="num">${money(r.revenue_usd)}</td>
  <td><div class="row-actions"><button class="btn small" data-act="edit" data-id="${r.id}">Edit</button><button class="btn small danger" data-act="del" data-id="${r.id}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No monthly records yet.</div>');
const manualNote = '<div class="panel" style="margin-bottom:16px"><b>YouTube is not connected.</b> <span class="muted">These numbers are typed in by hand. Once a month, copy them from YouTube Studio with "Add month".</span></div>';

VIEWS.analytics = async (ov) => {
  const [metrics] = await load('metrics');
  const m = ov.monetization, recent = metrics.slice(-12);
  const stat = (label, value) => `<div class="panel stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  return {
    buttons: '<button class="btn primary" data-act="add">+ Add month</button>',
    html: manualNote + `<section class="grid stats">${stat('Total views', num(m.total_views))}${stat('Watch hours (12 mo)', num(m.watch_hours_12m))}${stat('Subscribers', num(m.subscribers))}${stat('Videos published', num(ov.stats.videos_published))}</section>
      <section class="grid two" style="margin-top:16px"><div class="panel"><h2>Views by month</h2>${barChart(recent, 'views')}</div><div class="panel"><h2>Watch hours by month</h2>${barChart(recent, 'watch_hours')}</div></section>
      <section class="panel" style="margin-top:16px"><h2>Monthly records</h2>${metricTable(metrics)}</section>`,
    actions: metricActions(metrics),
  };
};

VIEWS.monetization = async (ov) => {
  const [metrics] = await load('metrics');
  const m = ov.monetization;
  const goal = (label, have, want, unit) => {
    const left = Math.max(0, want - have);
    return `<div class="goal"><div class="goal-head"><span>${label}</span><span><b>${num(have)}</b> <span class="muted">/ ${num(want)} ${unit}</span></span></div><div class="bar"><i style="width:${pct(have, want)}%"></i></div>
      <div class="hint">${left ? `${num(left)} ${unit} to go (${pct(have, want)}% there)` : 'Goal reached'}</div></div>`;
  };
  const ready = m.subscribers >= m.subscribers_goal && m.watch_hours_12m >= m.watch_hours_goal;
  return {
    buttons: '<button class="btn primary" data-act="add">+ Add month</button>',
    html: manualNote + `<section class="grid two">
      <div class="panel"><h2>Partner Program goals ${ready ? '<span class="badge good">Goals reached</span>' : '<span class="badge warn">In progress</span>'}</h2>
        ${goal('Subscribers', m.subscribers, m.subscribers_goal, 'subscribers')}
        ${goal('Public watch hours, last 12 months', m.watch_hours_12m, m.watch_hours_goal, 'hours')}
        <p class="hint">The goals are set to the commonly quoted YouTube Partner Program thresholds for full ad revenue (1,000 subscribers and 4,000 public watch hours in 12 months). YouTube can change its rules, so check the current requirements in YouTube Studio. You can edit both goals in <a href="#/settings">Settings</a>.</p>
      </div>
      <div class="panel stat"><div class="label">Revenue recorded</div><div class="value">${money(m.revenue_usd)}</div><div class="note">All months, all sources you have entered</div></div>
    </section>
    <section class="panel" style="margin-top:16px"><h2>Revenue by month</h2>${barChart(metrics.slice(-12), 'revenue_usd', (v) => '$' + num(Math.round(v)))}</section>
    <section class="panel" style="margin-top:16px"><h2>Monthly records</h2>${metricTable(metrics)}</section>`,
    actions: metricActions(metrics),
  };
};

VIEWS.settings = async (ov) => {
  const field = (name, label, type = 'text', wide = false, hint = '') => `<div class="field${wide ? ' wide' : ''}"><label for="s_${name}">${label}</label><input id="s_${name}" name="${name}" type="${type}" value="${esc(settings[name])}" required${type === 'number' ? ' min="1"' : ''}>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  return {
    html: `<form class="panel" id="settingsForm"><h2>Channel settings</h2><div class="settings-grid">
        ${field('channel_name', 'Channel name')}${field('language', 'Language')}
        ${field('niche', 'Niche', 'text', true)}
        ${field('narration', 'Narration')}${field('visual_style', 'Visual style')}
        ${field('video_duration_minutes', 'Target video length (minutes)', 'number')}${field('words_per_minute', 'Narration speed (words per minute)', 'number', false, 'Used by Script Studio to estimate running time.')}
        ${field('main_publish_time', 'Documentary publishing time', 'time')}${field('shorts_publish_time', 'Shorts publishing time', 'time')}
        ${field('timezone', 'Timezone', 'text', false, 'Example: Africa/Lagos')}${field('target', 'Business target')}
        ${field('subscribers_goal', 'Subscriber goal', 'number')}${field('watch_hours_goal', 'Watch-hours goal (12 months)', 'number')}
      </div><button class="btn primary" type="submit">Save settings</button></form>
      <section class="panel" style="margin-top:16px"><h2>Demo data</h2>
        <p class="muted" style="margin-top:0">${ov.has_demo ? 'The studio currently contains sample records marked <span class="badge demo">DEMO</span>. Removing them does not touch anything you created yourself.' : 'There is no demo data in the studio right now.'}</p>
        <div class="row-actions" style="justify-content:flex-start">${ov.has_demo ? '<button class="btn danger" data-act="clearDemo">Remove demo data</button>' : ''}<button class="btn" data-act="restoreDemo">${ov.has_demo ? 'Reset demo data' : 'Load demo data'}</button></div></section>
      <section class="panel" style="margin-top:16px"><h2>Connections</h2>
        <p class="muted" style="margin:0">YouTube: <b>not connected</b>. Paid AI services: <b>none</b>. Everything is stored on this computer in the file <code>empire-studio/data/empire.db</code>. Copy that file somewhere safe to back up your studio.</p></section>`,
    mount() {
      $('#settingsForm').onsubmit = async (e) => {
        e.preventDefault();
        try { await api('PUT', 'settings', Object.fromEntries(new FormData(e.target))); toast('Settings saved'); refresh(); } catch (err) { toast(err.message, true); }
      };
    },
    actions: {
      clearDemo: () => openForm({ title: 'Remove all demo data?', message: 'Every record marked DEMO will be deleted. Your own records stay.', submitLabel: 'Remove demo data', danger: true,
        onSubmit: async () => { await api('POST', 'demo/clear'); toast('Demo data removed'); refresh(); } }),
      restoreDemo: async () => { await api('POST', 'demo/restore'); toast('Demo data loaded'); refresh(); },
    },
  };
};

refresh();
