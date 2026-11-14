const { chromium, devices } = require('playwright');
// Browser smoke test of the admin dashboard against a running stack.
//   E2E_EMAIL=... E2E_PASSWORD=... node frontend/e2e/dashboard.e2e.cjs [screenshot-dir]
// Needs Playwright with Chromium. It changes the monthly limit (40 -> 70) and the owner's
// language, so run it against a development database only.
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set E2E_EMAIL and E2E_PASSWORD'); process.exit(2); }
const SP = process.argv[2] || require('os').tmpdir();
const results = [];
const waitLimit = (page, v) => page.waitForFunction((v) => {
  const f = [...document.querySelectorAll('form')].find(f => f.querySelector('input[value="budget.monthly_limit_usd"]'));
  return f && f.querySelector('input[name=value]').value === v;
}, v);
const check = (name, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/settings');
  check('unauthenticated visit redirects to login', page.url().endsWith('/login'));

  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', 'Wrong-Password-1');
  await page.click('button[type=submit]');
  await page.waitForSelector('form [role=alert]');
  check('wrong password shows generic error', (await page.textContent('form [role=alert]')).includes('Incorrect email or password'));
  await page.screenshot({ path: `${SP}/p2-login-en.png` });

  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(BASE + '/', { waitUntil: 'commit' });
  await page.waitForSelector('main h1');
  await page.click('button[name=lang][value=en]');
  await page.waitForSelector('text=Spend this month');
  check('login lands on overview', true);
  const cookies = await ctx.cookies();
  const sc = cookies.find(c => c.name === 'omoluabi_session');
  check('session cookie is httpOnly', !!sc && sc.httpOnly);
  check('overview shows real spend $0.00', (await page.textContent('main')).includes('$0.00'));
  check('overview shows sample mode', (await page.textContent('main')).includes('SAMPLE'));
  await page.screenshot({ path: `${SP}/p2-overview-en.png`, fullPage: true });

  // Settings: raise without confirmation -> blocked
  await page.click('nav a[href="/settings"]');
  await page.waitForSelector('text=Monthly spending limit');
  const row = page.locator('form', { has: page.locator('input[value="budget.monthly_limit_usd"]') });
  await row.locator('input[name=value]').fill('40');
  await row.locator('button[type=submit]').click();
  await waitLimit(page, '40.00');
  const rowL = page.locator('form', { has: page.locator('input[value="budget.monthly_limit_usd"]') });
  check('lowering a limit saves without approval', (await rowL.locator('input[name=value]').inputValue()) === '40.00');
  await rowL.locator('input[name=value]').fill('70');
  await rowL.locator('button[type=submit]').click();
  await rowL.locator('[role=alert]').waitFor();
  check('raising limit without approval is blocked', (await rowL.locator('[role=alert]').textContent()).includes('explicit approval'));
  await page.screenshot({ path: `${SP}/p2-settings-blocked.png` });

  await rowL.locator('input[name=value]').fill('70');
  await rowL.locator('input[name=confirm_increase]').check();
  await rowL.locator('button[type=submit]').click();
  await waitLimit(page, '70.00');
  check('new value persisted', true);
  const auditTop = await page.locator('#audit tbody tr').first().textContent();
  check('approved increase audited as budget approval', auditTop.includes('budget.limit_increase_approved') && auditTop.includes('40.00 → 70.00'));

  const ap = page.locator('form', { has: page.locator('input[value="publishing.auto_publish_enabled"]') });
  await ap.locator('select[name=value]').selectOption('true');
  await ap.locator('button[type=submit]').click();
  await ap.locator('[role=alert]').waitFor();
  check('auto-publish cannot be enabled', (await ap.locator('[role=alert]').textContent()).includes('first 10 videos'));
  await page.screenshot({ path: `${SP}/p2-settings-en.png`, fullPage: true });

  // Switch to Yoruba
  await page.click('button[name=lang][value=yo]');
  await page.waitForSelector('text=Ètò sístẹ́mù');
  check('language switch to Yoruba', (await page.getAttribute('html', 'lang')) === 'yo');
  await page.screenshot({ path: `${SP}/p2-settings-yo.png`, fullPage: true });
  await page.click('nav a[href="/"]');
  await page.waitForSelector('main h1:has-text("Àkópọ̀")');
  check('overview in Yoruba shows new limit', (await page.textContent('main')).includes('70.00'));
  await page.screenshot({ path: `${SP}/p2-overview-yo.png`, fullPage: true });
  await page.click('nav a[href="/scripts"]');  // still a placeholder (Phase 5)
  await page.waitForSelector('main h1:has-text("Àkọsílẹ̀ Yorùbá")');
  check('placeholder page shows no fake data', (await page.textContent('main')).includes('A kò fi dátà àpẹẹrẹ hàn'));
  await page.screenshot({ path: `${SP}/p2-placeholder-yo.png` });

  // Mobile
  const m = await browser.newContext({ ...devices['iPhone 13'], storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(BASE + '/');
  await mp.waitForSelector('text=Ìnáwó oṣù yìí');
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('mobile: no horizontal scroll', sw);
  await mp.screenshot({ path: `${SP}/p2-mobile-overview.png` });
  await mp.click('button[aria-controls=sidebar]');
  await mp.waitForTimeout(300);
  await mp.screenshot({ path: `${SP}/p2-mobile-menu.png` });
  await m.close();

  // Logout revokes the session
  await page.click('button:has-text("Jáde")');
  await page.waitForSelector('input[name=password]');
  check('logout returns to login', true);
  await ctx.addCookies([{ ...sc, value: sc.value }]);
  await page.goto(BASE + '/');
  check('old session token no longer works', page.url().includes('/login'));
  await page.screenshot({ path: `${SP}/p2-login-yo.png` });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForSelector('main h1');
  check('next login restores saved Yoruba preference', (await page.getAttribute('html', 'lang')) === 'yo');

  check('no client-side JS errors', errors.length === 0);
  if (errors.length) console.log(errors);
  console.log(results.join('\n'));
  await browser.close();
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(results.join('\n')); console.error('E2E ERROR', e.message); process.exit(1); });
