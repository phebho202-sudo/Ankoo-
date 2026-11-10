'use strict';
// Automated checks. Run with: npm test
// Each run uses a throwaway database file, so your real studio data is never touched.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/server');

let app, base, dbPath;

async function call(method, route, body) {
  const res = await fetch(base + route, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function start() {
  app = createApp({ dbPath });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
}
async function stop() {
  await new Promise((r) => app.server.close(r));
  app.db.close();
}

test.before(async () => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'empire-test-')), 'test.db');
  await start();
});
test.after(async () => {
  await stop();
  fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
});

test('serves the dashboard page and its files', async () => {
  for (const file of ['/', '/app.js', '/styles.css', '/icon.svg']) {
    const res = await fetch(base + file);
    assert.equal(res.status, 200, file);
  }
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /Empire Studio/);
  assert.equal((await fetch(base + '/../src/db.js')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/src/db.js')).status, 404);
});

test('channel settings start with the Behind the Fortune defaults', async () => {
  const { data } = await call('GET', '/api/settings');
  assert.equal(data.channel_name, 'Behind the Fortune');
  assert.equal(data.main_publish_time, '19:00');
  assert.equal(data.shorts_publish_time, '17:00');
  assert.equal(data.timezone, 'Africa/Lagos');
  assert.equal(data.video_duration_minutes, '45');
});

test('first run loads demo data, all flagged as demo', async () => {
  for (const table of ['topics', 'research', 'scripts', 'jobs', 'assets', 'publishing', 'metrics']) {
    const { data } = await call('GET', `/api/${table}`);
    assert.ok(data.length > 0, `${table} has demo rows`);
    assert.ok(data.every((r) => r.is_demo === 1), `${table} rows are flagged demo`);
  }
});

test('overview reports the headline numbers', async () => {
  const { data } = await call('GET', '/api/overview');
  assert.equal(data.has_demo, true);
  assert.equal(data.stats.documentaries_produced, 2);
  assert.equal(data.stats.videos_published, 2);
  assert.equal(data.stats.awaiting_approval, 2);
  assert.equal(data.stats.upcoming_scheduled, 3);
  assert.equal(data.monetization.subscribers, 600);
  assert.equal(data.monetization.watch_hours_12m, 2605);
  assert.ok(data.production.every((j) => j.progress < 100));
  assert.ok(data.schedule.every((p) => p.publish_date >= data.today));
});

test('full workflow: topic -> production -> approval -> published', async () => {
  const topic = (await call('POST', '/api/topics', { title: 'Test topic', potential_score: 70 })).data;
  assert.equal(topic.is_demo, 0);
  assert.equal(topic.status, 'idea');

  const job = (await call('POST', '/api/jobs', { topic_id: topic.id, title: 'Test documentary' })).data;
  assert.equal(job.script_status, 'not_started');
  const before = (await call('GET', '/api/overview')).data.stats;

  await call('PUT', `/api/jobs/${job.id}`, { script_status: 'done', voice_status: 'done', visuals_status: 'done', edit_status: 'done', thumbnail_status: 'done' });
  const jobs = (await call('GET', '/api/jobs')).data;
  assert.equal(jobs.find((j) => j.id === job.id).progress, 100);

  const pub = (await call('POST', '/api/publishing', { job_id: job.id, title: 'Test documentary', publish_date: '2099-01-01', publish_time: '19:00' })).data;
  assert.equal(pub.status, 'awaiting_approval');
  await call('PUT', `/api/publishing/${pub.id}`, { status: 'scheduled' });
  let after = (await call('GET', '/api/overview')).data.stats;
  assert.equal(after.documentaries_produced, before.documentaries_produced + 1);
  assert.equal(after.upcoming_scheduled, before.upcoming_scheduled + 1);

  await call('PUT', `/api/publishing/${pub.id}`, { status: 'published' });
  after = (await call('GET', '/api/overview')).data.stats;
  assert.equal(after.videos_published, before.videos_published + 1);
});

test('rejects bad input with a clear message', async () => {
  const cases = [
    ['/api/topics', {}],
    ['/api/topics', { title: 'x', status: 'nonsense' }],
    ['/api/topics', { title: 'x', potential_score: 500 }],
    ['/api/publishing', { title: 'x', publish_date: 'tomorrow', publish_time: '19:00' }],
    ['/api/publishing', { title: 'x', publish_date: '2026-01-01', publish_time: '7pm' }],
    ['/api/research', { title: 'x', topic_id: 999999 }],
    ['/api/assets', { name: 'x', kind: 'hologram' }],
    ['/api/metrics', { month: '2026-13' }],
  ];
  for (const [route, body] of cases) {
    const res = await call('POST', route, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok(res.data.error);
  }
  assert.equal((await call('PUT', '/api/topics/999999', { title: 'x' })).status, 404);
  assert.equal((await call('DELETE', '/api/topics/999999')).status, 404);
  assert.equal((await call('GET', '/api/settings/extra')).status, 404);
  assert.equal((await call('GET', '/api/sqlite_master')).status, 404);
});

test('one metrics record per month', async () => {
  assert.equal((await call('POST', '/api/metrics', { month: '2001-01', views: 5 })).status, 201);
  const dup = await call('POST', '/api/metrics', { month: '2001-01', views: 9 });
  assert.equal(dup.status, 400);
});

test('settings can be changed and are validated', async () => {
  assert.equal((await call('PUT', '/api/settings', { main_publish_time: '25:00' })).status, 400);
  assert.equal((await call('PUT', '/api/settings', { timezone: 'Mars/Olympus' })).status, 400);
  const { data } = await call('PUT', '/api/settings', { main_publish_time: '20:00', not_a_setting: 'x' });
  assert.equal(data.main_publish_time, '20:00');
  assert.equal(data.not_a_setting, undefined);
});

test('data survives a restart (persistent database)', async () => {
  await call('POST', '/api/topics', { title: 'Persisted topic' });
  await stop();
  await start();
  const topics = (await call('GET', '/api/topics')).data;
  assert.ok(topics.some((t) => t.title === 'Persisted topic'));
  assert.equal((await call('GET', '/api/settings')).data.main_publish_time, '20:00');
  assert.ok(topics.filter((t) => t.is_demo).length === 9, 'demo data is not seeded twice');
});

test('removing demo data keeps your own records', async () => {
  await call('POST', '/api/demo/clear');
  const ov = (await call('GET', '/api/overview')).data;
  assert.equal(ov.has_demo, false);
  const topics = (await call('GET', '/api/topics')).data;
  assert.ok(topics.length >= 2);
  assert.ok(topics.every((t) => t.is_demo === 0));
  await call('POST', '/api/demo/restore');
  assert.equal((await call('GET', '/api/overview')).data.has_demo, true);
});

test('requests from other websites cannot change data', async () => {
  const res = await fetch(base + '/api/topics', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{"title":"x"}' });
  assert.equal(res.status, 403);
});
