// Browser test of monetisation and analytics (Phase 9) against a running stack in SAMPLE mode.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/phase9.e2e.cjs [screenshot-dir]
// Creates clearly named test records in the development database. No money moves.
const os = require('os');
const { chromium, devices, request } = require('playwright');
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set E2E_EMAIL and E2E_PASSWORD'); process.exit(2); }
const SP = process.argv[2] || os.tmpdir();
const results = [];
const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
let failPage = null;
const card = (page, title) => page.locator('section', { has: page.locator(`h2:text-is("${title}")`) });
const RUN = Date.now().toString(36);

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

  await page.click('nav a[href="/monetisation"]');
  await page.waitForSelector('main h1:text-is("Monetisation")');
  check('payments in test mode take no money', (await page.locator('[data-testid=payments]').textContent()).includes('no money can be taken'));
  check('YouTube monetisation not assumed', (await page.locator('main').textContent()).includes('YouTube monetisation is not assumed'));

  // --- Affiliate link
  const slug = `e2e-${RUN}`;
  const links = card(page, 'Affiliate links');
  await links.locator('summary:has-text("Add link")').click();
  const lf = page.locator('[data-testid=link-form]');
  await lf.locator('input[name=slug]').fill(slug);
  await lf.locator('input[name=name]').fill(`E2E savings ${RUN}`);
  await lf.locator('input[name=partner]').fill('Example Bank');
  await lf.locator('input[name=destination_url]').fill('https://partner.example/ref?id=oba');
  await lf.locator('textarea[name=disclosure_yo]').fill('Ìjápọ̀ ìpolówó ni èyí.');
  await lf.locator('textarea[name=disclosure_en]').fill('This is an affiliate link.');
  await lf.locator('button[type=submit]').click();
  await page.locator(`li[data-link="${slug}"]`).waitFor();
  check('affiliate link created with its public address', (await page.locator(`li[data-link="${slug}"]`).textContent()).includes(`/go/${slug}`));

  // A visitor (not logged in) follows the link: counted, then redirected.
  const anon = await request.newContext();
  const go = await anon.get(`${BASE}/go/${slug}?s=e2e`, { maxRedirects: 0 });
  check('public link redirects to the partner', go.status() === 302 && go.headers()['location'] === 'https://partner.example/ref?id=oba');
  check('unknown link is a plain 404', (await anon.get(`${BASE}/go/no-such-${RUN}`, { maxRedirects: 0 })).status() === 404);
  await anon.dispose();
  await page.reload();
  check('click counted', (await page.locator(`li[data-link="${slug}"]`).textContent()).includes('1 clicks'));

  // --- Revenue entry linked to the affiliate link
  const rf = page.locator('[data-testid=revenue-form]');
  await rf.locator('select[name=source]').selectOption('affiliate');
  await rf.locator('input[name=amount]').fill('5,000');
  await rf.locator('select[name=currency]').selectOption('NGN');
  await rf.locator('input[name=description]').fill(`Commission ${RUN}`);
  await rf.locator('input[name=reference]').fill(`E2E-${RUN}`);
  await rf.locator('select[name=link_id]').selectOption({ label: `E2E savings ${RUN}` });
  await rf.locator('button[type=submit]').click();
  await rf.locator('[role=status]:has-text("Recorded.")').waitFor();
  const revText = await page.locator('[data-testid=revenue-list]').textContent();
  check('revenue recorded in naira with who entered it', revText.includes(`Commission ${RUN}`) && revText.includes('₦5,000.00') && revText.includes(EMAIL));
  check('form cleared after saving', (await rf.locator('input[name=reference]').inputValue()) === '');
  await rf.locator('select[name=source]').selectOption('affiliate');  // the form resets after a save
  await rf.locator('input[name=amount]').fill('5,000');
  await rf.locator('input[name=reference]').fill(`E2E-${RUN}`);
  await rf.locator('button[type=submit]').click();
  await rf.locator('[role=alert]').waitFor();
  check('the same revenue reference cannot be entered twice', (await rf.locator('[role=alert]').textContent()).includes('already recorded'));

  // --- Product and simulated checkout
  await card(page, 'Digital products').locator('summary:has-text("Add product")').click();
  const pf = page.locator('[data-testid=product-form]');
  await pf.locator('input[name=name_yo]').fill(`Ìwé ìṣirò ${RUN}`);
  await pf.locator('input[name=name_en]').fill(`Cash book ${RUN}`);
  await pf.locator('select[name=status]').selectOption('active');
  await pf.locator('input[name=price]').fill('2,500');
  await pf.locator('button[type=submit]').click();
  const prod = page.locator('li[data-product]', { hasText: `Cash book ${RUN}` });
  await prod.waitFor();
  check('product listed with naira price', (await prod.textContent()).includes('₦2,500.00'));
  await prod.locator('input[name=email]').fill('buyer@example.ng');
  await prod.locator('button:has-text("Create payment link")').click();
  await prod.locator('[role=status]').waitFor();
  check('test-mode checkout is simulated, no payment link', (await prod.locator('[role=status]').textContent()).includes('no money taken'));

  // --- Sponsorship lifecycle
  await card(page, 'Sponsorships').locator('summary:has-text("Add sponsorship")').click();
  const sf = page.locator('[data-testid=sponsorship-form]');
  await sf.locator('input[name=sponsor_name]').fill(`Sponsor ${RUN}`);
  await sf.locator('input[name=value]').fill('150,000');
  await sf.locator('textarea[name=deliverables]').fill('One 30-second mention');
  await sf.locator('button[type=submit]').click();
  const spon = page.locator('li[data-sponsorship]', { hasText: `Sponsor ${RUN}` });
  await spon.waitFor();
  check('sponsorship starts as proposed', (await spon.getAttribute('data-sponsorship')) === 'proposed');
  await spon.locator('input[name=contract_reference]').fill(`AGR-${RUN}`);
  await spon.locator('button:has-text("Mark as Agreed")').click();
  await page.locator(`li[data-sponsorship=agreed]`, { hasText: `Sponsor ${RUN}` }).waitFor();
  await page.locator('li[data-sponsorship]', { hasText: `Sponsor ${RUN}` }).locator('button:has-text("Mark as Delivered")').click();
  await page.locator(`li[data-sponsorship=delivered]`, { hasText: `Sponsor ${RUN}` }).waitFor();
  await page.locator('li[data-sponsorship]', { hasText: `Sponsor ${RUN}` }).locator('button:has-text("Mark as Paid")').click();
  await page.locator(`li[data-sponsorship=paid]`, { hasText: `Sponsor ${RUN}` }).waitFor();
  check('paid sponsorship becomes revenue', (await page.locator('[data-testid=revenue-list]').textContent()).includes(`Sponsorship: Sponsor ${RUN}`));
  await page.screenshot({ path: `${SP}/p9-monetisation-en.png`, fullPage: true });

  // --- Analytics
  await page.click('nav a[href="/analytics"]');
  await page.waitForSelector('main h1:text-is("Analytics")');
  check('YouTube revenue shown as not reported', (await page.locator('[data-testid=tile-yt-revenue]').textContent()).includes('Not reported'));
  check('naira revenue total shown separately', (await page.locator('[data-testid=tile-revenue-NGN]').count()) === 1);
  const aff = page.locator(`tr[data-affiliate="${slug}"]`);
  const affText = await aff.textContent();
  check('affiliate clicks, sales and per-click earnings calculated', affText.includes('100.00%') && affText.includes('₦5,000.00'));
  check('no platform figures invented', (await page.locator('[data-testid=no-videos]').count()) === 1);
  await page.click('a:text-is("90 days")');
  await page.waitForURL(/days=90/);
  check('period can be changed', true);
  await page.screenshot({ path: `${SP}/p9-analytics-en.png`, fullPage: true });

  // --- Yoruba + mobile
  await page.click('button[name=lang][value=yo]');
  await page.waitForFunction(() => document.documentElement.lang === 'yo');
  await page.waitForSelector('main h1:text-is("Ìtúpalẹ̀ ìṣirò")');
  check('analytics in Yoruba', (await page.locator('main').textContent()).normalize('NFC').includes('A kò ròyìn rẹ̀'.normalize('NFC')));
  await page.click('nav a[href="/monetisation"]');
  await page.waitForFunction(() => document.querySelector('main h1')?.textContent?.includes('Ìpawówọlé'));
  check('monetisation in Yoruba', (await page.locator('main').textContent()).normalize('NFC').includes('Ìjápọ̀ ìpolówó alájọṣe'.normalize('NFC')));
  await page.screenshot({ path: `${SP}/p9-monetisation-yo.png`, fullPage: true });
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const p of ['/monetisation', '/analytics']) {
    await mp.goto(BASE + p);
    await mp.waitForSelector('main h1');
    check(`mobile ${p}: no horizontal scroll`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
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
  if (failPage) await failPage.screenshot({ path: `${SP}/p9-FAILURE.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
