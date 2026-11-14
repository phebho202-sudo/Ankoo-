// Browser test of rights management (Phase 4) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase4.e2e.cjs [screenshot-dir]
// Creates a uniquely named channel and licence, so it can be re-run. Development data only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium, devices } = require('playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set E2E_EMAIL and E2E_PASSWORD'); process.exit(2); }
const SP = process.argv[2] || os.tmpdir();
const results = [];
async function expectTrue(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('condition not met in time');
}
const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
const id = `e2e${Date.now()}`;
const REF = `LIC-${id}`;
const ymd = (d) => d.toISOString().slice(0, 10);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const SOURCE = 'today we explain how small traders should review their prices every month because inflation quietly eats the profit margin';

let failPage = null;
(async () => {
  const pdfPath = path.join(SP, `${id}.pdf`);
  fs.writeFileSync(pdfPath, PDF);
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

  // --- A research-only channel with episodes
  await page.click('nav a[href="/episodes"]');
  await page.waitForSelector('main h1:has-text("Episode catalogue")');
  await page.fill('input[name=reference]', '@' + id);
  await page.fill('textarea[name=note]', 'Public videos, studied for research only (e2e)');
  await page.click('button:has-text("Authorise channel")');
  const row = () => page.locator('li', { hasText: `[SAMPLE] ${id}` });
  await row().waitFor();
  await row().locator('button:has-text("Scan for new videos")').click();
  await row().locator('[role=status]:has-text("Finished.")').waitFor({ timeout: 30000 });
  await page.waitForFunction((h) => [...document.querySelectorAll('li')].some((li) => li.textContent.includes(h) && li.textContent.includes('6 videos')), `[SAMPLE] ${id}`);

  // --- Episode: no rights yet; add a transcript for the originality test
  await page.locator('tr', { hasText: `[SAMPLE] ${id}` }).first().locator('a').click();
  await page.waitForSelector('text=Back to episodes');
  const episodeUrl = page.url();
  await page.fill('textarea[name=text]', SOURCE);
  await page.selectOption('select[name=source]', 'licensor_provided');
  await page.fill('input[name=permission_reference]', `Supplied with ${REF}`);
  await page.click('button:has-text("Save transcript")');
  await page.waitForSelector('text=added by owner:');
  const rightsCard = page.locator('section', { hasText: 'Check' }).filter({ has: page.locator('h2:text-is("Rights management")') });
  await rightsCard.locator('button:has-text("Check")').click();
  await rightsCard.locator('text=Not allowed').waitFor();
  const denied = await rightsCard.textContent();
  check('no licence: adaptation refused', denied.includes('No licence covers this episode'));
  check('research-only channel named as a reason', denied.includes('authorised for research only'));

  // --- Switch the channel to licensed
  await page.goto(BASE + '/episodes');
  await row().locator('summary:has-text("Change basis")').click();
  await row().locator('input[name=note]').fill(`Licence ${REF} signed with the rights holder`);
  await row().locator('button:has-text("Change basis")').click();
  await page.waitForFunction((h) => [...document.querySelectorAll('li')].some((li) => li.textContent.includes(h) && li.textContent.includes('Licensed')), `[SAMPLE] ${id}`);
  check('channel basis changed to licensed', true);

  // --- Record a licence with one unclear right
  await page.click('nav a[href="/rights"]');
  await page.waitForSelector('main h1:has-text("Rights management")');
  check('legal disclaimer shown', (await page.textContent('main')).includes('Have a lawyer review'));
  await page.click('a:has-text("Record a licence")');
  await page.waitForSelector('main h1:has-text("Record a licence")');
  const today = new Date();
  await page.fill('input[name=licence_reference]', REF);
  await page.fill('input[name=licensor_name]', 'Rights Holder Ltd (e2e)');
  await page.fill('input[name=effective_from]', ymd(new Date(today.getTime() - 86400000)));
  await page.fill('input[name=expires_at]', ymd(new Date(today.getTime() + 365 * 86400000)));
  for (const [k, v] of [['translation', 'granted'], ['adaptation', 'granted'], ['commercial', 'unclear'], ['distribution', 'granted']]) {
    await page.selectOption(`select[name=${k}]`, v);
  }
  await page.check('input[name=permitted_platforms][value=youtube]');
  await page.click('button:has-text("Save licence")');
  await page.waitForSelector(`main h1:has-text("${REF}")`);
  const verifyCard = page.locator('section', { has: page.locator('h2:text-is("Verification")') });
  let v = await verifyCard.textContent();
  check('verification lists what is missing', v.includes('Upload the signed document') && v.includes('Choose the channel or episodes') && v.includes('Commercial rights are marked unclear'));
  check('verify button disabled while incomplete', await verifyCard.locator('button:has-text("Verify licence")').isDisabled());
  await page.screenshot({ path: `${SP}/p4-licence-draft-en.png`, fullPage: true });

  // --- Document, scope, fix the unclear right
  await page.setInputFiles('input[name=file]', pdfPath);
  await page.click('button:has-text("Upload")');
  await page.waitForSelector('text=Open document');
  const scopeCard = page.locator('section', { has: page.locator('h2:text-is("What this licence covers")') });
  const channelOption = await scopeCard.locator('select[name=channel_id] option', { hasText: `[SAMPLE] ${id}` }).getAttribute('value');
  await scopeCard.locator('select[name=channel_id]').selectOption(channelOption);
  await scopeCard.locator('button:has-text("Save coverage")').click();
  await scopeCard.locator('text=Saved.').waitFor();
  // Check the visible card, not document.body: the page also embeds the dictionary as data.
  const visibleProblem = (txt) => verifyCard.evaluate((el, t) => !el.innerText.includes(t), txt);
  await expectTrue(() => visibleProblem('Choose the channel or episodes it covers.'));
  await page.waitForFunction((v) => document.querySelector('select[name=channel_id]').value === v, channelOption);
  check('coverage saved and displayed', true);
  await page.selectOption('select[name=commercial]', 'granted');
  await page.click('button:has-text("Save licence")');
  await page.locator('section', { has: page.locator('h2:text-is("Licence details")') }).locator('text=Saved.').waitFor();
  await expectTrue(() => visibleProblem('Commercial rights are marked unclear'));
  // Regression: the form must show the value that was saved, not the value it was loaded with.
  await page.waitForFunction(() => document.querySelector('select[name=commercial]').value === 'granted');
  check('edited value is displayed after saving', true);
  v = await verifyCard.textContent();
  check('all problems resolved', !v.includes('Before this licence can be verified'));

  // --- Verify
  await verifyCard.locator('input[name=confirmed]').check();
  await verifyCard.locator('button:has-text("Verify licence")').click();
  await page.waitForSelector('text=Verified by owner:');
  check('licence verified and active', (await page.locator('main header').first().textContent()).includes('Active'));
  const docHref = await page.locator('a:has-text("Open document")').getAttribute('href');
  const doc = await page.request.get(BASE + docHref);
  check('stored document downloads unchanged', doc.ok() && Buffer.compare(await doc.body(), PDF) === 0);
  await page.screenshot({ path: `${SP}/p4-licence-verified-en.png`, fullPage: true });

  // --- Rights checks
  await page.goto(episodeUrl);
  await page.waitForSelector('text=Back to episodes');
  const card = page.locator('section').filter({ has: page.locator('h2:text-is("Rights management")') });
  await card.locator('button:has-text("Check")').click();
  await card.getByRole('status').filter({ hasText: `Allowed. Licence ${REF}` }).waitFor();
  check('adaptation allowed under the verified licence', true);
  await card.locator('select[name=purpose]').selectOption('publish');
  await card.locator('select[name=platform]').selectOption('youtube');
  await card.locator('button:has-text("Check")').click();
  await card.getByRole('status').filter({ hasText: 'Sample (test) episodes can never be published' }).waitFor();
  check('sample episode can never be published', true);
  await page.screenshot({ path: `${SP}/p4-episode-rights-en.png`, fullPage: true });

  // --- Originality
  await page.click('nav a[href="/rights"]');
  await page.waitForSelector('main h1:has-text("Rights management")');
  await page.fill('textarea[name=text]', 'In our lesson: ' + SOURCE.split(' ').slice(2, 18).join(' ') + '. Then we add our own Lagos example.');
  await page.click('button:has-text("Check originality")');
  await page.waitForSelector('text=Copied wording found');
  check('copied passage detected and quoted', (await page.textContent('main')).includes('how small traders should review their prices'));
  await page.screenshot({ path: `${SP}/p4-rights-en.png`, fullPage: true });

  // --- Revoke
  await page.click(`a:has-text("${REF}")`);
  await page.waitForSelector(`main h1:has-text("${REF}")`);
  await page.fill('input[name=reason]', 'Rights holder ended the agreement (e2e)');
  await page.click('button:has-text("Revoke licence")');
  await page.waitForSelector('text=Revoked by owner:');
  await page.goto(episodeUrl);
  const card2 = page.locator('section').filter({ has: page.locator('h2:text-is("Rights management")') });
  await card2.locator('button:has-text("Check")').click();
  await card2.getByRole('status').filter({ hasText: `Licence ${REF} was revoked` }).waitFor();
  check('revoked licence blocks adaptation', true);

  // --- Yoruba + mobile
  await page.click('button[name=lang][value=yo]');
  await page.click('nav a[href="/rights"]');
  await page.waitForSelector('main h1:has-text("Ìṣàkóso ẹ̀tọ́")');
  check('rights page in Yoruba', (await page.textContent('main')).includes('agbẹjọ́rò'));
  await page.screenshot({ path: `${SP}/p4-rights-yo.png`, fullPage: true });
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const p of ['/rights', '/rights/new']) {
    await mp.goto(BASE + p);
    await mp.waitForSelector('main h1');
    check(`mobile ${p}: no horizontal scroll`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await mp.screenshot({ path: `${SP}/p4-mobile-rights.png` });
  await m.close();
  await page.click('button[name=lang][value=en]');
  await page.waitForTimeout(500);

  check('no client-side JS errors', errors.length === 0);
  if (errors.length) console.log(errors);
  console.log(results.join('\n'));
  await browser.close();
  fs.unlinkSync(pdfPath);
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
})().catch(async (e) => {
  console.log(results.join('\n'));
  console.error('E2E ERROR', e.message);
  if (failPage) await failPage.screenshot({ path: `${SP}/p4-FAILURE.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
