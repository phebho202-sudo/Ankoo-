// Browser test of discovery and research (Phase 3) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase3.e2e.cjs [screenshot-dir]
// Creates a uniquely named sample channel, so it can be re-run. Development data only.
const { chromium, devices } = require('playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set E2E_EMAIL and E2E_PASSWORD'); process.exit(2); }
const SP = process.argv[2] || require('os').tmpdir();
const results = [];
const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
const handle = `e2e${Date.now()}`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForSelector('main h1');
  await page.click('button[name=lang][value=en]');
  await page.waitForSelector('text=Spend this month');

  // --- Authorise a channel
  await page.click('nav a[href="/episodes"]');
  await page.waitForSelector('main h1:has-text("Episode catalogue")');
  check('sample-mode banner is shown', (await page.textContent('main')).includes('invented test data'));
  await page.fill('input[name=reference]', '@' + handle);
  await page.fill('textarea[name=note]', 'Public videos, studied for research only (e2e)');
  await page.click('button:has-text("Authorise channel")');
  await page.waitForSelector('text=Channel authorised.');
  const row = page.locator('li', { hasText: `[SAMPLE] ${handle}` });
  await row.waitFor();
  check('channel authorised and listed with its note', (await row.textContent()).includes('research only (e2e)'));

  // --- Scan twice: 6 new, then no duplicates
  await row.locator('button:has-text("Scan for new videos")').click();
  await row.locator('[role=status]:has-text("Finished.")').waitFor({ timeout: 30000 });
  await page.waitForFunction((h) => [...document.querySelectorAll('li')].some((li) => li.textContent.includes(h) && li.textContent.includes('6 videos')), `[SAMPLE] ${handle}`, { timeout: 15000 });
  check('scan found 6 sample videos', true);
  await page.locator('li', { hasText: `[SAMPLE] ${handle}` }).locator('button:has-text("Scan for new videos")').click();
  await page.locator('li', { hasText: `[SAMPLE] ${handle}` }).locator('[role=status]:has-text("Finished.")').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  check('re-scan adds no duplicates', (await page.locator('li', { hasText: `[SAMPLE] ${handle}` }).textContent()).includes('6 videos'));
  await page.screenshot({ path: `${SP}/p3-episodes-en.png`, fullPage: true });

  // --- Open one of this channel's episodes
  const epRow = page.locator('tr', { hasText: `[SAMPLE] ${handle}` }).first();
  await epRow.locator('a').click();
  await page.waitForSelector('text=Back to episodes');
  check('episode page shows sample badge', (await page.textContent('main')).includes('SAMPLE'));

  await page.fill('textarea[name=text]', 'In this lesson we discuss pricing, value and customer loyalty for small shops.');
  await page.selectOption('select[name=source]', 'owner_entered');
  await page.fill('input[name=permission_reference]', 'My own notes from watching it');
  await page.click('button:has-text("Save transcript")');
  // After saving, the form folds away and the green "held" box is the confirmation.
  await page.waitForSelector('text=added by owner:');
  check('permitted transcript saved with its source', (await page.textContent('main')).includes('My own notes or material'));

  await page.click('button:has-text("Generate research report")');
  await page.locator('[role=status]:has-text("Finished.")').waitFor({ timeout: 30000 });
  await page.waitForSelector('main li a[href^="/research/"]');
  check('research report completed', (await page.textContent('main')).includes('Completed'));
  await page.screenshot({ path: `${SP}/p3-episode-en.png`, fullPage: true });

  // --- Report page: originality check + approve a topic
  await page.click('main li a[href^="/research/"]');
  await page.waitForSelector('text=Back to research');
  const body = await page.textContent('main');
  check('report labelled as sample output', body.includes('Sample output'));
  check('originality check shown', body.includes('Originality check passed'));
  check('report says it used the transcript', body.includes('Based on the permitted transcript'));
  const firstTopic = page.locator('article').first();
  const topicTitle = (await firstTopic.locator('h3').textContent()).trim();
  await firstTopic.locator('input[name=note]').fill('Good fit for traders');
  await firstTopic.locator('button:has-text("Approve")').click();
  await page.waitForFunction((t) => [...document.querySelectorAll('article')].some((a) => a.querySelector('h3')?.textContent.trim() === t && a.textContent.includes('Approved by')), topicTitle);
  check('topic approved and attributed', true);
  await page.screenshot({ path: `${SP}/p3-report-en.png`, fullPage: true });

  // --- Research page
  await page.click('nav a[href="/research"]');
  await page.waitForSelector('main h1:has-text("Research")');
  const approvedCard = page.locator('section', { hasText: 'Approved topics' });
  check('approved topic listed', (await approvedCard.textContent()).includes(topicTitle));
  await page.fill('input[name=subject]', `Cash flow for market traders ${handle}`);
  await page.click('button:has-text("Start research")');
  await page.locator('[role=status]:has-text("Finished.")').waitFor({ timeout: 30000 });
  await page.waitForSelector(`text=Cash flow for market traders ${handle}`);
  check('independent research completed', true);
  await page.screenshot({ path: `${SP}/p3-research-en.png`, fullPage: true });

  // --- Yoruba
  await page.click('button[name=lang][value=yo]');
  await page.waitForSelector('main h1:has-text("Ìwádìí")');
  check('research page in Yoruba', (await page.textContent('main')).includes('Àwọn kókó tí a fọwọ́ sí'));
  await page.screenshot({ path: `${SP}/p3-research-yo.png`, fullPage: true });
  await page.click('nav a[href="/episodes"]');
  await page.waitForSelector('main h1:has-text("Àkójọ àwọn ìpín")');
  check('episodes page in Yoruba', (await page.textContent('main')).includes('Àwọn ikanni orísun tí a fún láṣẹ'));
  await page.screenshot({ path: `${SP}/p3-episodes-yo.png` });

  // --- Mobile
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const path of ['/episodes', '/research']) {
    await mp.goto(BASE + path);
    await mp.waitForSelector('main h1');
    check(`mobile ${path}: no horizontal scroll`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await mp.screenshot({ path: `${SP}/p3-mobile-research.png` });
  await m.close();

  // reset language for other tests
  await page.click('button[name=lang][value=en]');
  await page.waitForTimeout(500);
  check('no client-side JS errors', errors.length === 0);
  if (errors.length) console.log(errors);
  console.log(results.join('\n'));
  await browser.close();
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
})().catch((e) => { console.log(results.join('\n')); console.error('E2E ERROR', e.message); process.exit(1); });
