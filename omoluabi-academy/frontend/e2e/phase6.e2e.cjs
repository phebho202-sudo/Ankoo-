// Browser test of voice & presenter (Phase 6) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase6.e2e.cjs [screenshot-dir]
// Needs at least one approved script (run phase5.e2e.cjs first). Development data only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
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
  // A real (decodable) portrait made with FFmpeg: a navy card with a gold disc.
  const portrait = path.join(SP, `portrait-${Date.now()}.png`);
  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x0B1F3A:s=800x800:d=1',
    '-vf', 'drawbox=x=250:y=250:w=300:h=300:color=0xC9A227:t=fill', '-frames:v', '1', portrait]);
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

  // --- Presenter
  await page.click('nav a[href="/voice"]');
  await page.waitForSelector('main h1:has-text("Voice production")');
  const pres = card(page, 'Presenter');
  await pres.locator('input[name=name]').fill('Olùkọ́ Adéwálé');
  await pres.locator('input[name=voice_id]').fill('sample-voice-1');
  await pres.locator('input[name=stability]').fill('0.5');
  for (const n of ['decl_voice', 'decl_portrait', 'decl_person']) await pres.locator(`input[name=${n}]`).check();
  await pres.locator('button:has-text("Save presenter")').click();
  await pres.locator('text=Saved.').waitFor();
  check('presenter saved with declarations', true);

  await page.setInputFiles('input[name=file]', portrait);
  await page.click('button:has-text("Upload")');
  await page.waitForSelector('img[alt="Olùkọ́ Adéwálé"]');
  const img = await page.request.get(BASE + (await page.locator('img[alt="Olùkọ́ Adéwálé"]').getAttribute('src')));
  check('portrait uploaded and served', img.ok() && (await img.body()).subarray(1, 4).toString() === 'PNG');

  // --- Pronunciation test
  await page.click('button:has-text("Record a test")');
  await page.locator('[role=status]:has-text("Finished.")').waitFor({ timeout: 60000 });
  const tests = card(page, 'Pronunciation tests');
  const first = tests.locator('li.rounded-md').first();
  await first.locator('audio').waitFor();
  const src = await first.locator('audio').getAttribute('src');
  const full = await page.request.get(BASE + src);
  const part = await page.request.get(BASE + src, { headers: { Range: 'bytes=0-1023' } });
  check('test audio plays (MP3) and can seek (206)', full.ok() && full.headers()['content-type'] === 'audio/mpeg' && part.status() === 206 && (await part.body()).length === 1024);
  check('test passage includes tone pairs and naira', (await first.textContent()).includes('ọwọ́') && (await first.textContent()).includes('₦12,500'));
  for (const box of await first.locator('input[name=ok]').all()) await box.check();
  await first.locator('button:has-text("Save rating")').click();
  await page.waitForFunction(() => document.querySelector('main section li.rounded-md')?.innerText.includes('Passed'));
  check('pronunciation test passed by a person', true);

  // --- Approve presenter
  const approveBtn = page.locator('button:has-text("Approve presenter")');
  if (await approveBtn.count()) {
    await approveBtn.click();
    await page.waitForSelector('text=Approved by');
  }
  check('presenter approved', (await page.locator('main header').textContent()).includes('Approved'));
  await page.screenshot({ path: `${SP}/p6-voice-en.png`, fullPage: true });

  // --- Produce narration for an approved script
  await card(page, 'Approved scripts').locator('button:has-text("Produce narration")').first().click();
  await page.waitForURL(/\/voice\/runs\/[0-9a-f-]{36}$/);
  await page.waitForSelector('text=Cost of this run', { timeout: 120000 });
  check('production run completed', (await page.locator('main header').textContent()).includes('Completed'));
  const video = await page.locator('video').getAttribute('src');
  const v = await page.request.get(BASE + video, { headers: { Range: 'bytes=0-15' } });
  check('presenter clip is MP4 and seekable', v.status() === 206 && (await v.body()).subarray(4, 8).toString() === 'ftyp');
  const slides = await card(page, 'Slides').locator('img').count();
  const segs = await card(page, 'Segments').locator('audio').count();
  check('one slide and one audio file per segment', slides > 0 && slides === segs);
  const capHref = await card(page, 'Captions (timed to the narration)').locator('a').first().getAttribute('href');
  const cap = await (await page.request.get(BASE + capHref)).text();
  check('captions timed to the recorded narration', /^1\n00:00:00,000 --> /.test(cap));
  check('cost recorded ($0.00 in sample mode)', (await card(page, 'Cost of this run').textContent()).includes('US$0.00'));
  await page.screenshot({ path: `${SP}/p6-run-en.png`, fullPage: true });
  const runUrl = page.url();

  // --- Yoruba + mobile
  await page.click('button[name=lang][value=yo]');
  await page.waitForFunction(() => document.documentElement.lang === 'yo');
  await page.click('nav a[href="/voice"]');
  await page.waitForURL(BASE + '/voice');  // the run page's heading also starts "Ìṣẹ̀dá ohùn"
  await page.waitForSelector('main h1:text-is("Ìṣẹ̀dá ohùn")');
  // Compare in NFC: tone marks can be composed differently in this file and on the page.
  const yoText = (await page.locator('main').textContent()).normalize('NFC');
  check('voice page in Yoruba', yoText.includes('Àyẹ̀wò ìpè'.normalize('NFC')));
  await page.screenshot({ path: `${SP}/p6-voice-yo.png`, fullPage: true });
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const p of ['/voice', runUrl.replace(BASE, '')]) {
    await mp.goto(BASE + p);
    await mp.waitForSelector('main h1');
    check(`mobile ${p.startsWith('/voice/runs') ? '/voice/runs/[id]' : p}: no horizontal scroll`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await m.close();
  await page.click('button[name=lang][value=en]');
  await page.waitForTimeout(400);

  check('no client-side JS errors', errors.length === 0);
  if (errors.length) console.log(errors);
  console.log(results.join('\n'));
  await browser.close();
  fs.unlinkSync(portrait);
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
})().catch(async (e) => {
  console.log(results.join('\n'));
  console.error('E2E ERROR', e.message);
  if (failPage) await failPage.screenshot({ path: `${SP}/p6-FAILURE.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
