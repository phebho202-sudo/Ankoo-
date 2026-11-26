'use strict';
const { html, raw, str, int, email, phone, HttpError, naira, now, token, sha256, fmtDate, jsonParse } = require('../util');
const auth = require('../auth');
const config = require('../config');
const catalog = require('../catalog');
const commerce = require('../commerce');
const mailer = require('../mailer');
const { layout, productCard, csrf, old, icons } = require('../views/layout');

function safeNext(n) {
  const s = String(n || '');
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : '/account';
}

function signIn(ctx, user) {
  const t = auth.createSession(ctx.db, user.id);
  ctx.setCookie('sid', t, { maxAge: auth.SESSION_DAYS * 864e2 });
  if (ctx.cartId) {
    const merged = commerce.mergeIntoUser(ctx.db, ctx.cartId, user.id);
    if (merged) ctx.setCookie('cart', merged, { maxAge: 60 * 60 * 24 * 60 });
  }
}

function authShell(ctx, title, inner) {
  return layout(ctx, {
    title, noindex: true,
    body: html`<section class="auth"><div class="auth-card"><h1 class="display">${title}</h1>${inner}</div></section>`,
  });
}

function accountNav(active) {
  const items = [['/account', 'Orders'], ['/account/wishlist', 'Wishlist'], ['/account/profile', 'Profile']];
  return html`<nav class="chips" aria-label="Account">${items.map(([h, l]) => html`<a href="${h}" class="${active === h ? 'on' : ''}">${l}</a>`)}</nav>`;
}

module.exports = function register(app) {
  app.get('/login', (ctx) => {
    if (ctx.user) return ctx.redirect(safeNext(ctx.query.next));
    ctx.html(authShell(ctx, 'Sign in', html`
<form class="form" method="post" action="/login">${csrf(ctx)}<input type="hidden" name="next" value="${safeNext(ctx.query.next)}">
  <div class="field"><label for="l-email">Email</label><input id="l-email" type="email" name="email" required autocomplete="email" value="${old(ctx, 'email')}"></div>
  <div class="field"><label for="l-pw">Password</label><input id="l-pw" type="password" name="password" required autocomplete="current-password"></div>
  <button class="btn btn-block" type="submit">Sign in</button>
  <p class="auth-links"><a href="/forgot">Forgot your password?</a></p>
</form>
<div class="auth-alt"><p>New to ANKOO?</p><a class="btn btn-outline btn-block" href="/register?next=${encodeURIComponent(safeNext(ctx.query.next))}">Create an account</a></div>`));
  });

  app.post('/login', (ctx) => {
    if (auth.rateLimited(`login:${ctx.ip}`, 10)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.');
    const e = email(ctx.body.email);
    const u = ctx.db.prepare('SELECT * FROM users WHERE email = ?').get(e);
    if (!u || !auth.verifyPassword(String(ctx.body.password || ''), u.password_hash)) throw new HttpError(400, 'Incorrect email or password.');
    if (config.adminEmails.includes(u.email.toLowerCase()) && u.role !== 'admin') {
      ctx.db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(u.id);
      u.role = 'admin';
    }
    signIn(ctx, u);
    const next = safeNext(ctx.body.next);
    ctx.redirect(u.role === 'admin' && next === '/account' ? '/admin' : next);
  });

  app.get('/register', (ctx) => {
    if (ctx.user) return ctx.redirect('/account');
    ctx.html(authShell(ctx, 'Create an account', html`
<p class="muted">Track your orders, save pieces to your wishlist and check out faster.</p>
<form class="form" method="post" action="/register">${csrf(ctx)}<input type="hidden" name="next" value="${safeNext(ctx.query.next)}">
  <div class="field"><label for="r-name">Full name</label><input id="r-name" name="name" required maxlength="120" autocomplete="name" value="${old(ctx, 'name')}"></div>
  <div class="field"><label for="r-email">Email</label><input id="r-email" type="email" name="email" required autocomplete="email" value="${old(ctx, 'email')}"></div>
  <div class="field"><label for="r-phone">Phone number</label><input id="r-phone" type="tel" name="phone" autocomplete="tel" placeholder="+234" value="${old(ctx, 'phone')}"></div>
  <div class="field"><label for="r-pw">Password</label><input id="r-pw" type="password" name="password" required minlength="8" autocomplete="new-password"><small>At least 8 characters.</small></div>
  <label class="check"><input type="checkbox" name="marketing" value="1"> Send me the ANKOO Letter: new collections and private previews.</label>
  <button class="btn btn-block" type="submit">Create account</button>
  <p class="fine">By creating an account you agree to our <a href="/pages/terms">terms</a> and <a href="/pages/privacy">privacy policy</a>.</p>
</form>
<div class="auth-alt"><p>Already have an account?</p><a class="btn btn-outline btn-block" href="/login">Sign in</a></div>`));
  });

  app.post('/register', (ctx) => {
    if (auth.rateLimited(`register:${ctx.ip}`, 10, 60 * 60 * 1000)) throw new HttpError(429, 'Too many attempts. Please try again later.');
    const b = ctx.body;
    const e = email(b.email);
    const name = str(b.name, 120);
    if (!name) throw new HttpError(400, 'Please enter your name.');
    const pw = auth.validatePassword(b.password);
    if (ctx.db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) throw new HttpError(400, 'An account with this email already exists. Please sign in.');
    const role = config.adminEmails.includes(e) ? 'admin' : 'customer';
    const r = ctx.db.prepare('INSERT INTO users (email, password_hash, name, phone, role, marketing_opt_in, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(e, auth.hashPassword(pw), name, phone(b.phone, false), role, b.marketing ? 1 : 0, now());
    if (b.marketing && !ctx.db.prepare('SELECT 1 FROM subscribers WHERE email = ?').get(e)) {
      ctx.db.prepare('INSERT INTO subscribers (email, token, source, created_at) VALUES (?, ?, ?, ?)').run(e, token(18), 'register', now());
    }
    signIn(ctx, ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid)));
    ctx.redirect(role === 'admin' ? '/admin' : safeNext(b.next), { type: 'success', message: `Welcome to ANKOO, ${name.split(' ')[0]}.` });
  });

  app.post('/logout', (ctx) => {
    auth.destroySession(ctx.db, ctx.cookies.sid);
    ctx.setCookie('sid', '', { maxAge: 0 });
    ctx.setCookie('cart', '', { maxAge: 0 });
    ctx.redirect('/');
  });

  app.get('/forgot', (ctx) => {
    ctx.html(authShell(ctx, 'Reset your password', html`
<p class="muted">Enter your email and we will send you a link to choose a new password.</p>
<form class="form" method="post" action="/forgot">${csrf(ctx)}
  <div class="field"><label for="f-email">Email</label><input id="f-email" type="email" name="email" required autocomplete="email"></div>
  <button class="btn btn-block" type="submit">Send reset link</button>
</form>`));
  });
  app.post('/forgot', (ctx) => {
    if (auth.rateLimited(`forgot:${ctx.ip}`, 5, 60 * 60 * 1000)) throw new HttpError(429, 'Too many attempts. Please try again later.');
    const e = email(ctx.body.email);
    const u = ctx.db.prepare('SELECT * FROM users WHERE email = ?').get(e);
    if (u) {
      const t = token(32);
      ctx.db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(t), u.id, new Date(Date.now() + 3600e3).toISOString());
      mailer.passwordReset(ctx.db, ctx.site, u, `${ctx.site}/reset?t=${t}`);
    }
    // Same answer either way, so the form cannot be used to discover accounts.
    ctx.redirect('/login', { type: 'success', message: 'If an account exists for that email, a reset link is on its way.' });
  });
  app.get('/reset', (ctx) => {
    const t = str(ctx.query.t, 100);
    ctx.html(authShell(ctx, 'Choose a new password', html`
<form class="form" method="post" action="/reset">${csrf(ctx)}<input type="hidden" name="t" value="${t}">
  <div class="field"><label for="n-pw">New password</label><input id="n-pw" type="password" name="password" required minlength="8" autocomplete="new-password"></div>
  <button class="btn btn-block" type="submit">Save password</button>
</form>`));
  });
  app.post('/reset', (ctx) => {
    const t = str(ctx.body.t, 100);
    const pw = auth.validatePassword(ctx.body.password);
    const r = ctx.db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?').get(sha256(t), now());
    if (!r) throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
    ctx.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(pw), r.user_id);
    ctx.db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(r.token_hash);
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(r.user_id);
    ctx.redirect('/login', { type: 'success', message: 'Your password has been changed. Please sign in.' });
  });

  app.get('/account', (ctx) => {
    const orders = ctx.db.prepare('SELECT * FROM orders WHERE user_id = ? OR (user_id IS NULL AND email = ?) ORDER BY created_at DESC LIMIT 100').all(ctx.user.id, ctx.user.email);
    ctx.html(layout(ctx, {
      title: 'My account', noindex: true,
      body: html`<section class="page-head page-head-sm"><div class="page-head-inner"><p class="eyebrow">My account</p><h1 class="display">Welcome, ${ctx.user.name.split(' ')[0]}</h1></div></section>
<div class="account">
${accountNav('/account')}
${ctx.user.role === 'admin' ? html`<p class="center"><a class="btn btn-outline" href="/admin">Open the admin dashboard</a></p>` : ''}
${orders.length ? html`<div class="table-wrap"><table class="table">
  <thead><tr><th>Order</th><th>Date</th><th>Status</th><th class="num">Total</th></tr></thead>
  <tbody>${orders.map((o) => html`<tr><td><a href="/order/${o.number}?k=${o.access_key}">${o.number}</a></td><td>${fmtDate(o.created_at)}</td><td><span class="status s-${o.status}">${commerce.STATUSES[o.status] || o.status}</span></td><td class="num">${naira(o.total_kobo)}</td></tr>`)}</tbody>
</table></div>` : html`<div class="empty center"><p>You have not placed any orders yet.</p><p><a class="btn" href="/shop">Explore the collection</a></p></div>`}
<form method="post" action="/logout" class="center">${csrf(ctx)}<button class="link" type="submit">Sign out</button></form>
</div>`,
    }));
  }, { auth: true });

  app.get('/account/wishlist', (ctx) => {
    const rows = ctx.db.prepare(`SELECT p.* FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? AND p.status = 'active' ORDER BY w.created_at DESC`).all(ctx.user.id);
    const products = catalog.decorate(ctx.db, rows);
    ctx.html(layout(ctx, {
      title: 'Wishlist', noindex: true,
      body: html`<section class="page-head page-head-sm"><div class="page-head-inner"><p class="eyebrow">My account</p><h1 class="display">Wishlist</h1></div></section>
<div class="account">${accountNav('/account/wishlist')}
${products.length ? html`<div class="grid">${products.map((p) => html`<div>${productCard(ctx, p)}<form method="post" action="/wishlist/${p.id}">${csrf(ctx)}<input type="hidden" name="back" value="wishlist"><button class="link" type="submit">Remove</button></form></div>`)}</div>`
  : html`<div class="empty center"><p>Save pieces you love with the ${icons.heart} button on any product.</p><p><a class="btn" href="/shop">Explore the collection</a></p></div>`}
</div>`,
    }));
  }, { auth: true });

  app.get('/account/profile', (ctx) => {
    const u = ctx.user;
    const addr = jsonParse(u.address_json, {});
    ctx.html(layout(ctx, {
      title: 'Profile', noindex: true,
      body: html`<section class="page-head page-head-sm"><div class="page-head-inner"><p class="eyebrow">My account</p><h1 class="display">Profile</h1></div></section>
<div class="account">${accountNav('/account/profile')}
<div class="two-col">
<form class="form" method="post" action="/account/profile">${csrf(ctx)}
  <h2 class="h3">Your details</h2>
  <div class="field"><label for="p-name">Full name</label><input id="p-name" name="name" required value="${u.name}"></div>
  <div class="field"><label for="p-phone">Phone number</label><input id="p-phone" type="tel" name="phone" value="${u.phone}"></div>
  <div class="field"><label for="p-addr">Delivery address</label><input id="p-addr" name="line" value="${addr.line || ''}"></div>
  <div class="field-row"><div class="field"><label for="p-city">City</label><input id="p-city" name="city" value="${addr.city || ''}"></div>
  <div class="field"><label for="p-state">State / region</label><input id="p-state" name="state" value="${addr.state || ''}"></div></div>
  <label class="check"><input type="checkbox" name="marketing" value="1" ${u.marketing_opt_in ? raw('checked') : ''}> Receive the ANKOO Letter</label>
  <button class="btn" type="submit">Save</button>
</form>
<form class="form" method="post" action="/account/password">${csrf(ctx)}
  <h2 class="h3">Change password</h2>
  <div class="field"><label for="p-cur">Current password</label><input id="p-cur" type="password" name="current" required autocomplete="current-password"></div>
  <div class="field"><label for="p-new">New password</label><input id="p-new" type="password" name="password" required minlength="8" autocomplete="new-password"></div>
  <button class="btn btn-outline" type="submit">Update password</button>
</form>
</div></div>`,
    }));
  }, { auth: true });
  app.post('/account/profile', (ctx) => {
    const b = ctx.body;
    const name = str(b.name, 120);
    if (!name) throw new HttpError(400, 'Please enter your name.');
    const addr = jsonParse(ctx.user.address_json, {});
    Object.assign(addr, { line: str(b.line, 300), city: str(b.city, 100), state: str(b.state, 100) });
    ctx.db.prepare('UPDATE users SET name = ?, phone = ?, address_json = ?, marketing_opt_in = ? WHERE id = ?')
      .run(name, phone(b.phone, false), JSON.stringify(addr), b.marketing ? 1 : 0, ctx.user.id);
    ctx.redirect('/account/profile', { type: 'success', message: 'Your details have been saved.' });
  }, { auth: true });
  app.post('/account/password', (ctx) => {
    if (!auth.verifyPassword(String(ctx.body.current || ''), ctx.user.password_hash)) throw new HttpError(400, 'Your current password is incorrect.');
    const pw = auth.validatePassword(ctx.body.password);
    ctx.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(pw), ctx.user.id);
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(ctx.user.id, sha256(ctx.cookies.sid));
    ctx.redirect('/account/profile', { type: 'success', message: 'Your password has been updated.' });
  }, { auth: true });
};
module.exports.signIn = signIn;
