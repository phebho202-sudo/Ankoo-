// Browser test of publishing (Phase 8) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase8.e2e.cjs [screenshot-dir]
// Needs a newly approved sample video (run phase7.e2e.cjs first). Nothing leaves the server:
// sample accounts only simulate uploads. Development data only.
const os = require('os');
const { chromium, devices } = require('playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set E2E_EMAIL and E2E_PASSWORD'); process.exit(2); }
const SP = process.argv[2] || os.tmpdir();
const results = [];
const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
let failPage = null;
const card = (page, title) => page.locator('section', { has: page.locator(`h2:text-is("${title}")`) });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  failPage = page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForSelector('main h1');
  await page.click('button[name=lang][value=en]');
  await page.waitForSelector('text=Spend this month');

  // --- Accounts (sample mode)
  await page.click('nav a[href="/accounts"]');
  await page.waitForSelector('main h1:text-is("Social accounts")');
  check('test mode explained; real sign-in off', (await page.locator('main').textContent()).includes('real sign-in is switched off'));
  for (const name of ['YouTube', 'TikTok']) {
    const btn = page.locator(`button:has-text("Add a sample account: ${name}")`);
    await btn.click();
    await page.locator(`li[data-account="${name.toLowerCase()}"]`).first().waitFor();
  }
  const yt = page.locator('li[data-account=youtube]').first();
  check('sample YouTube account connected and labelled', (await yt.textContent()).includes('Connected') && (await yt.textContent()).includes('Sample'));
  check('no token is ever shown', !(await page.content()).includes('access_token'));
  await page.screenshot({ path: `${SP}/p8-accounts-en.png`, fullPage: true });

  // --- Calendar
  await page.click('nav a[href="/calendar"]');
  await page.waitForSelector('main h1:text-is("Publishing calendar")');
  check('publishing running', (await page.locator('[data-testid=publishing-state]').textContent()).includes('Publishing is running'));
  check('trial period shown', (await page.locator('[data-testid=trial-state]').textContent()).includes('Trial period'));
  const form = page.locator('[data-testid=schedule-form]');
  await form.locator('select[name=destination]').selectOption('youtube');
  const vis = await form.locator('select[name=visibility] option').allTextContents();
  check('YouTube trial visibility is private or unlisted only', JSON.stringify(vis) === '["Private","Unlisted"]');
  check('caption includes the AI disclosure', (await form.locator('textarea[name=description]').inputValue()).includes('AI-generated'));
  await form.locator('select[name=destination]').selectOption('instagram_reel');
  await form.locator('[data-testid=unavailable]').waitFor();
  check('Instagram unavailable during the trial', await form.locator('button[type=submit]').isDisabled());

  await form.locator('select[name=destination]').selectOption('youtube');
  await form.locator('button:has-text("Schedule")').click();
  await form.locator('[role=status]:has-text("Scheduled.")').waitFor();
  check('YouTube upload scheduled', (await card(page, 'Upcoming').locator('li[data-status=scheduled]').count()) >= 1);
  await form.locator('button:has-text("Schedule")').click();
  await form.locator('[role=alert]').waitFor();
  check('same video cannot be scheduled twice to the same place', (await form.locator('[role=alert]').textContent()).includes('already scheduled or published'));

  await form.locator('select[name=destination]').selectOption('tiktok');
  check('TikTok is draft only', JSON.stringify(await form.locator('select[name=visibility] option').allTextContents()) === '["Draft"]');
  await form.locator('button:has-text("Schedule")').click();
  await page.waitForFunction(() => document.querySelectorAll('li[data-status=scheduled]').length >= 2);
  check('TikTok draft scheduled', true);
  await page.screenshot({ path: `${SP}/p8-calendar-scheduled.png`, fullPage: true });

  // --- Send now (simulated)
  await page.locator('button:has-text("Send due uploads now")').click();
  await page.locator('[role=status]:has-text("Started.")').waitFor();
  let simulated = 0;
  for (let i = 0; i < 20 && simulated < 2; i++) {
    await page.waitForTimeout(1500);
    await page.reload();
    simulated = await card(page, 'History').locator('li[data-status=simulated]').count();
  }
  check('uploads simulated (nothing sent from a sample account)', simulated >= 2);
  await card(page, 'History').locator('li[data-status=simulated] a').first().click();
  await page.waitForSelector('[data-testid=log]');
  const log = await page.locator('[data-testid=log]').textContent();
  check('publishing log records the attempt', log.includes('Attempt 1') && log.includes('nothing was sent'));
  check('not shown as a confirmed upload', !(await page.locator('main header').textContent()).includes('confirmed'));
  const detailUrl = page.url();
  await page.screenshot({ path: `${SP}/p8-publication-en.png`, fullPage: true });

  // --- Pause / resume
  await page.click('nav a[href="/calendar"]');
  await page.waitForSelector('main h1:text-is("Publishing calendar")');
  await page.locator('button:has-text("Pause publishing")').click();
  await page.locator('[data-testid=publishing-state]:has-text("Publishing is paused")').waitFor();
  check('owner can pause; reason shown', (await page.locator('[data-testid=publishing-state]').textContent()).includes('Paused by the owner'));
  await page.locator('button:has-text("Resume publishing")').click();
  await page.locator('[data-testid=publishing-state]:has-text("Publishing is running")').waitFor();
  check('owner can resume', true);

  // --- Yoruba + mobile
  await page.click('button[name=lang][value=yo]');
  await page.waitForFunction(() => document.documentElement.lang === 'yo');
  await page.waitForSelector('main h1:text-is("Kàlẹ́ńdà ìtẹ̀jáde")');
  const yo = (await page.locator('main').textContent()).normalize('NFC');
  check('calendar in Yoruba', yo.includes('Àkókò ìdánwò'.normalize('NFC')) && yo.includes('Ṣètò ìgbéjáde kan'.normalize('NFC')));
  await page.screenshot({ path: `${SP}/p8-calendar-yo.png`, fullPage: true });
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const p of ['/calendar', '/accounts', detailUrl.replace(BASE, '')]) {
    await mp.goto(BASE + p);
    await mp.waitForSelector('main h1');
    check(`mobile ${p.startsWith('/calendar/') ? '/calendar/[id]' : p}: no horizontal scroll`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await m.close();
  await page.click('button[name=lang][value=en]');
  await page.waitForTimeout(400);

  check('no client-side JS errors', errors.length === 0);
  if (errors.length) console.log(errors);
  console.log(results.join('\n'));
  await browser.close();
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
})().catch(async (e) => {
  console.log(results.join('\n'));
  console.error('E2E ERROR', e.message);
  if (failPage) await failPage.screenshot({ path: `${SP}/p8-FAILURE.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
