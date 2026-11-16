// Browser test of the Yoruba content engine (Phase 5) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase5.e2e.cjs [screenshot-dir]
// Creates a uniquely named reviewer, topic and script. Development data only.
const os = require('os');
const { chromium, devices } = require('playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set E2E_EMAIL and E2E_PASSWORD'); process.exit(2); }
const SP = process.argv[2] || os.tmpdir();
const results = [];
const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
const id = `e2e${Date.now()}`;
const REVIEWER = `${id}@review.test`;
let failPage = null;

async function login(page, email, password) {
  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.click('button[type=submit]');
  await page.waitForSelector('main h1');
}
const card = (page, title) => page.locator('section', { has: page.locator(`h2:text-is("${title}")`) });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await ctx.newPage();
  failPage = page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // --- Owner: add a reviewer
  await login(page, EMAIL, PASSWORD);
  await page.click('button[name=lang][value=en]');
  await page.waitForSelector('text=Spend this month');
  await page.click('nav a[href="/settings"]');
  const team = card(page, 'Language reviewers');
  await team.locator('input[name=display_name]').fill('E2E Reviewer');
  await team.locator('input[name=email]').fill(REVIEWER);
  await team.locator('button:has-text("Add reviewer")').click();
  const tempText = await team.getByRole('status').filter({ hasText: 'Temporary password' }).textContent();
  const tempPassword = tempText.match(/: (\S+) \(shown once/)[1];
  check('reviewer created with one-time password', !!tempPassword);

  // --- Owner: research a subject and approve a topic
  await page.click('nav a[href="/research"]');
  await page.fill('input[name=subject]', `Record keeping for tailors ${id}`);
  await page.click('button:has-text("Start research")');
  await page.locator('[role=status]:has-text("Finished.")').waitFor({ timeout: 30000 });
  await page.click(`a:has-text("Record keeping for tailors ${id}")`);
  await page.waitForSelector('text=Back to research');
  await page.locator('article').first().locator('button:has-text("Approve")').click();
  await page.waitForFunction(() => document.querySelector('article')?.innerText.includes('Approved by'));

  // --- Owner: write a script from it
  await page.click('nav a[href="/scripts"]');
  await page.waitForSelector('main h1:has-text("Yoruba scripts")');
  await page.click('button:has-text("Write script")');
  await page.waitForURL(/\/scripts\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const scriptUrl = page.url();
  await page.waitForSelector('text=Version 1 of 1', { timeout: 30000 });
  check('script written and shown as version 1', true);
  const quality = await card(page, 'Automated checks').innerText();
  check('automated checks pass and carry the disclaimer', quality.includes('No problems found') && quality.includes('cannot judge tone accuracy'));
  check('sample output labelled', (await page.locator('main').innerText()).includes('Sample output'));

  const srt = await page.request.get(scriptUrl + '/download?type=srt-yo');
  const srtText = await srt.text();
  check('Yoruba SRT downloads with timings', srt.ok() && /^1\n00:00:00,000 --> 00:00:\d\d,\d{3}\n/.test(srtText) && srtText.includes('Ọ̀rọ̀ àpẹẹrẹ'));

  // --- Owner: edit, then submit
  await page.click('button:has-text("Edit script")');
  await page.locator('textarea[lang=yo]').first().fill('Ẹ káàbọ̀ sí ẹ̀kọ́ wa lónìí, ẹ̀yin oníṣòwò.');
  await page.getByLabel('What did you change?').fill('Warmer welcome');
  await page.click('button:has-text("Save as new version")');
  await page.waitForSelector('text=Version 2 of 2');
  check('edit saved as version 2 (version 1 kept)', (await card(page, 'Versions').innerText()).includes('Edited by a person'));
  await page.click('button:has-text("Send for language review")');
  await page.waitForSelector('text=In language review');
  check('sent for language review', true);
  await page.click('button:has-text("Log out")');
  await page.waitForSelector('input[name=password]');

  // --- Reviewer: limited access
  await login(page, REVIEWER, tempPassword);
  check('reviewer lands on scripts', page.url().endsWith('/scripts'));
  const navLinks = await page.locator('nav[aria-label=Main] a').allInnerTexts();
  check('reviewer menu shows only Yoruba scripts', navLinks.length === 1 && navLinks[0].includes('Yoruba scripts'));
  await page.goto(BASE + '/rights');
  check('owner page refused for reviewer', (await page.locator('main h1').innerText()).includes('Not available'));

  // --- Reviewer: review
  await page.goto(scriptUrl);
  await page.waitForSelector('text=Version 2 of 2');
  const review = card(page, 'Language review');
  await review.locator('input[name=checklist]').first().check();
  await review.locator('button:has-text("Approve this version")').click();
  await review.locator('[role=alert]').waitFor();
  check('approval refused with incomplete checklist', (await review.locator('[role=alert]').innerText()).includes('checklist'));
  for (const box of await review.locator('input[name=checklist]').all()) await box.check();
  await review.locator('textarea[name=comments]').fill('Ó dára gan-an.');
  await review.locator('button:has-text("Approve this version")').click();
  await page.waitForSelector('text=Ready for voice production');
  check('reviewer approved version 2', (await page.locator('main').innerText()).includes(`Version 2 approved by reviewer:${REVIEWER}`));
  await page.screenshot({ path: `${SP}/p5-script-approved-en.png`, fullPage: true });

  // --- Reviewer: vocabulary and pronunciation
  await page.goto(BASE + '/scripts/dictionary');
  await page.waitForSelector('main h1:has-text("Vocabulary & pronunciation")');
  const gl = card(page, 'Business vocabulary');
  await gl.locator('input[name=english]').fill(`stock ${id}`);
  await gl.locator('input[name=yoruba]').fill('ọjà inú ṣọ́ọ̀bù');
  await gl.locator('button:has-text("Add")').click();
  const termRow = gl.locator('li', { hasText: `stock ${id}` });
  await termRow.waitFor();
  check('new term needs approval', (await termRow.innerText()).includes('Needs approval'));
  await termRow.locator('button:has-text("Approve")').click();
  await page.waitForFunction((t) => [...document.querySelectorAll('li')].some((li) => li.innerText.includes(t) && li.innerText.includes('Approved')), `stock ${id}`);
  const pr = card(page, 'Pronunciation dictionary');
  const written = `POS${id.slice(-5)}`;
  await pr.locator('input[name=written]').fill(written);
  await pr.locator('input[name=spoken]').fill('pí-ó-ẹ́sì');
  await pr.locator('button:has-text("Add")').click();
  const pRow = pr.locator('li', { hasText: written });
  await pRow.waitFor();
  await pRow.locator('button:has-text("Approve")').click();
  await page.waitForFunction((t) => [...document.querySelectorAll('li')].some((li) => li.innerText.includes(t) && li.innerText.includes('Approved')), written);
  const pls = await page.request.get(BASE + '/scripts/dictionary/lexicon');
  check('approved pronunciation exported in the PLS lexicon', pls.ok() && (await pls.text()).includes(`<grapheme>${written}</grapheme>`));
  await page.screenshot({ path: `${SP}/p5-dictionary-en.png`, fullPage: true });

  // --- Reviewer: change password
  await page.goto(BASE + '/account');
  await page.fill('input[name=current]', tempPassword);
  await page.fill('input[name=next]', 'Reviewer-Pass-2026');
  await page.click('button:has-text("Change password")');
  await page.waitForSelector('text=Password changed');
  check('reviewer changed temporary password', true);

  // --- Yoruba + mobile
  await page.click('button[name=lang][value=yo]');
  await page.waitForFunction(() => document.documentElement.lang === 'yo');
  await page.goto(scriptUrl);
  await page.waitForSelector('text=Ẹ̀dà 2 nínú 2');
  // textContent, not innerText: card titles are upper-cased by CSS.
  const yoText = await page.locator('main').textContent();
  check('script page in Yoruba, disclaimer included', yoText.includes('Àyẹ̀wò ẹ̀rọ') && yoText.includes('Kò lè dájọ́ bóyá ohùn tọ̀nà'));
  await page.screenshot({ path: `${SP}/p5-script-yo.png`, fullPage: true });
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const p of [scriptUrl.replace(BASE, ''), '/scripts', '/scripts/dictionary']) {
    await mp.goto(BASE + p);
    await mp.waitForSelector('main h1');
    check(`mobile ${p.length > 20 ? '/scripts/[id]' : p}: no horizontal scroll`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
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
  if (failPage) await failPage.screenshot({ path: `${SP}/p5-FAILURE.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
