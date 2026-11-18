// Browser test of operations features (Phase 10) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase10.e2e.cjs [screenshot-dir]
// Needs at least one rendered video (run phase7.e2e.cjs first). Development data only.
const os = require('os');
const { chromium, devices } = require('playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set E2E_EMAIL and E2E_PASSWORD'); process.exit(2); }
const SP = process.argv[2] || os.tmpdir();
const results = [];
const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
let failPage = null;

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

  // --- Overview: system health checks
  const health = page.locator('[data-testid=health-checks]');
  await health.waitFor();
  const text = await health.textContent();
  check('system health checks shown on the overview', text.includes('All checks pass.') || (await health.locator('li[data-level]').count()) > 0);
  check('alert channel status explained', text.includes('ALERT_WEBHOOK_URL') || text.includes('alert channel'));
  // In development no scheduler runs, so the worker heartbeat is honestly reported missing.
  const levels = await health.locator('li[data-level]').allTextContents();
  check('a missing scheduler heartbeat is reported, not hidden', levels.some((l) => l.includes('Worker and scheduler')));
  await page.screenshot({ path: `${SP}/p10-overview-en.png`, fullPage: true });

  // --- API is not reachable from the browser directly (only through the dashboard server)
  const direct = await page.request.get(BASE + '/api/v1/system/health');
  check('the dashboard does not expose the private API', direct.status() === 404);

  // --- Cost of a video
  await page.click('nav a[href="/video"]');
  await page.waitForSelector('main h1:text-is("Video production")');
  await page.locator('li[data-video] a').first().click();
  await page.waitForSelector('[data-testid=video-cost]');
  const cost = await page.locator('[data-testid=video-cost]').textContent();
  check('actual cost per video shown (script, voice, rendering, total)', cost.includes('Script writing (AI)') && cost.includes('Total') && cost.includes('$0.00'));

  // --- Yoruba + mobile
  await page.click('button[name=lang][value=yo]');
  await page.waitForFunction(() => document.documentElement.lang === 'yo');
  await page.click('nav a[href="/"]');
  await page.waitForSelector('[data-testid=health-checks]');
  const yo = (await page.locator('[data-testid=health-checks]').textContent()).normalize('NFC');
  check('health card in Yoruba', yo.includes('Òṣìṣẹ́ àti olùṣètò'.normalize('NFC')));
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(BASE + '/');
  await mp.waitForSelector('main h1');
  check('mobile overview: no horizontal scroll', await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
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
  if (failPage) await failPage.screenshot({ path: `${SP}/p10-FAILURE.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
