// Browser test of video production (Phase 7) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase7.e2e.cjs [screenshot-dir]
// Needs a completed narration run whose lesson has no video yet (run phase5 and phase6 first).
// Development data only.
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

  // --- Video list
  await page.click('nav a[href="/video"]');
  await page.waitForSelector('main h1:text-is("Video production")');
  const unlockBefore = await page.locator('[data-testid=unlock]').textContent();
  check('approval progress toward automatic publishing shown', /\d+ of \d+ real videos approved/.test(unlockBefore));
  const ready = card(page, 'Ready to render');
  const cand = ready.locator('li[data-candidate]').first();
  await cand.waitFor();
  const candId = await cand.getAttribute('data-candidate');
  check('candidate passes the educational value gate', (await cand.textContent()).includes('Passes'));
  await cand.locator('summary').click();
  check('gate lists original-content check', await cand.locator('[data-check=original_content][data-ok=true]').count() === 1);
  check('substance check reported but not enforced for sample content',
    (await cand.locator('[data-check=enough_substance]').textContent()).includes('not enforced for sample content'));
  await page.screenshot({ path: `${SP}/p7-video-en.png`, fullPage: true });

  // --- Render
  await cand.locator('button:has-text("Render videos")').click();
  await page.waitForURL(/\/video\/[0-9a-f-]{36}$/, { waitUntil: 'commit' });
  const renderUrl = page.url();
  await page.waitForSelector('main header :text("Waiting for your approval")', { timeout: 240000 });
  check('render finished and waits for owner approval', true);
  const long = page.locator('[data-testid=video-long]');
  const vert = page.locator('[data-testid=video-vertical]');
  check('16:9 lesson and 9:16 vertical shown', (await long.count()) === 1 && (await vert.count()) === 1);
  const lv = await page.request.get(BASE + (await long.getAttribute('src')), { headers: { Range: 'bytes=0-1023' } });
  check('lesson video is MP4 and seekable', lv.status() === 206 && (await lv.body()).subarray(4, 8).toString() === 'ftyp');
  const vv = await page.request.get(BASE + (await vert.getAttribute('src')), { headers: { Range: 'bytes=0-1023' } });
  check('vertical video is MP4 and seekable', vv.status() === 206 && (await vv.body()).subarray(4, 8).toString() === 'ftyp');
  const thumbs = card(page, 'Thumbnails').locator('img');
  check('two thumbnails', (await thumbs.count()) === 2);
  const thumb = await page.request.get(BASE + (await thumbs.first().getAttribute('src')));
  check('thumbnail is a PNG', thumb.ok() && (await thumb.body()).subarray(1, 4).toString() === 'PNG');
  const capHref = await card(page, 'Caption files').locator('a:has-text("Lesson · Yoruba")').getAttribute('href');
  const cap = await (await page.request.get(BASE + capHref)).text();
  check('lesson captions start after the 4 s intro', /^1\n00:00:04,000 --> /.test(cap));
  check('fits YouTube and TikTok', (await page.locator('[data-platform=youtube]').getAttribute('data-fits')) === 'true'
    && (await page.locator('[data-platform=tiktok]').getAttribute('data-fits')) === 'true');
  check('automated video checks all pass', (await card(page, 'Automated video checks').locator('[data-ok=false]').count()) === 0
    && (await card(page, 'Automated video checks').locator('[data-ok=true]').count()) === 8);
  check('sample video is labelled', (await page.locator('main').textContent()).includes('never counts toward automatic publishing'));
  await page.screenshot({ path: `${SP}/p7-render-en.png`, fullPage: true });

  // --- Owner decision
  const review = card(page, 'Your review');
  await review.locator('input[name=ok]').first().check();
  await review.locator('button:has-text("Approve video")').click();
  await review.locator('[role=alert]').waitFor();
  check('approval refused until every point is confirmed', (await review.locator('[role=alert] li').count()) === 5);
  check('ticked boxes kept after an error', (await review.locator('input[name=ok]:checked').count()) === 1);
  for (const box of await review.locator('input[name=ok]').all()) await box.check();
  await review.locator('button:has-text("Approve video")').click();
  await page.waitForSelector('main header :text("Approved")');
  check('owner approved the video', (await page.locator('main').textContent()).includes('decided on'));

  await page.click('nav a[href="/video"]');
  await page.waitForSelector('main h1:text-is("Video production")');
  const unlockAfter = await page.locator('[data-testid=unlock]').textContent();
  check('sample approval does not count toward the unlock', unlockAfter === unlockBefore);
  check('the rendered lesson is no longer offered', (await page.locator(`li[data-candidate="${candId}"]`).count()) === 0);

  // --- Yoruba + mobile
  await page.click('button[name=lang][value=yo]');
  await page.waitForFunction(() => document.documentElement.lang === 'yo');
  await page.waitForSelector('main h1:text-is("Ìṣẹ̀dá fídíò")');
  const yoText = (await page.locator('main').textContent()).normalize('NFC');
  check('video page in Yoruba', yoText.includes('Àwọn fídíò'.normalize('NFC')) && yoText.includes('fídíò gidi'.normalize('NFC')));
  await page.screenshot({ path: `${SP}/p7-video-yo.png`, fullPage: true });
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const p of ['/video', renderUrl.replace(BASE, '')]) {
    await mp.goto(BASE + p);
    await mp.waitForSelector('main h1');
    check(`mobile ${p.startsWith('/video/') ? '/video/[id]' : p}: no horizontal scroll`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await mp.screenshot({ path: `${SP}/p7-render-mobile.png`, fullPage: true });
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
  if (failPage) await failPage.screenshot({ path: `${SP}/p7-FAILURE.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
