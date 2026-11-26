'use strict';
// Request plumbing: routing, cookies, sessions, CSRF, security headers, compression, static files.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const config = require('./config');
const { HttpError, Safe, token, safeEqual, jsonParse } = require('./util');
const { getSettings } = require('./db');
const auth = require('./auth');
const commerce = require('./commerce');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mov': 'video/quicktime', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest)|image\/svg)/;

// Asset fingerprints for cache busting (?v=hash).
const assetVersions = new Map();
function asset(p) {
  if (!assetVersions.has(p)) {
    try { assetVersions.set(p, crypto.createHash('md5').update(fs.readFileSync(path.join(PUBLIC_DIR, p))).digest('hex').slice(0, 8)); } catch { assetVersions.set(p, '0'); }
  }
  return `/assets/${p}?v=${assetVersions.get(p)}`;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore */ } }
  }
  return out;
}
function cookie(name, value, { maxAge, httpOnly = true } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
  if (httpOnly) c += '; HttpOnly';
  if (config.production) c += '; Secure';
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'That upload is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function parseForm(buf) {
  const sp = new URLSearchParams(buf.toString('utf8'));
  const out = {};
  for (const key of new Set(sp.keys())) out[key] = key.endsWith('[]') ? sp.getAll(key) : sp.get(key);
  return out;
}

function clientIp(req) {
  if (config.trustProxy) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return req.socket.remoteAddress || '';
}

function siteUrl(req) {
  if (config.baseUrl) return config.baseUrl;
  const proto = config.trustProxy && req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : 'http';
  return `${proto}://${req.headers.host || 'localhost'}`;
}

function securityHeaders(nonce) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://connect.facebook.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net",
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.tiktok.com https://www.instagram.com https://www.facebook.com',
    "form-action 'self' https://checkout.paystack.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  const h = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.paystack.com")',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (config.production) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

function sendBody(req, res, status, body, headers) {
  const type = headers['Content-Type'] || '';
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  if (buf.length > 1024 && COMPRESSIBLE.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
    buf = zlib.gzipSync(buf, { level: 6 });
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}

// ---- Static files ----
const staticCache = new Map();
function serveFile(req, res, file, { immutable = false, sandbox = false } = {}) {
  let st;
  try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Last-Modified': st.mtime.toUTCString(),
  };
  if (sandbox) headers['Content-Security-Policy'] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
  if (type.startsWith('video/')) return streamRange(req, res, file, st, headers);
  if (st.size < 2e6) {
    const key = `${file}:${st.mtimeMs}`;
    let buf = staticCache.get(key);
    if (!buf) { buf = fs.readFileSync(file); if (staticCache.size > 300) staticCache.clear(); staticCache.set(key, buf); }
    sendBody(req, res, 200, buf, headers);
    return true;
  }
  headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  return true;
}
function streamRange(req, res, file, st, headers) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  headers['Accept-Ranges'] = 'bytes';
  if (range) {
    let start = range[1] === '' ? st.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : st.size - 1;
    start = Math.max(0, start); end = Math.min(end, st.size - 1);
    if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return true; }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  return true;
}

// ---- Router ----
function createApp(db) {
  const routes = [];
  const app = {
    db,
    route(method, pattern, handler, opts = {}) {
      const keys = [];
      const re = new RegExp(`^${pattern.replace(/\/:(\w+)/g, (m, k) => { keys.push(k); return '/([^/]+)'; })}/?$`);
      routes.push({ method, re, keys, handler, opts });
    },
    get(p, h, o) { app.route('GET', p, h, o); },
    post(p, h, o) { app.route('POST', p, h, o); },
    errorPage: null, // set by views: (ctx, status, message) => Safe
    handle: (req, res) => handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) { res.writeHead(500); res.end('Server error'); } }),
  };

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const p = decodeURIComponent(url.pathname).replace(/\0/g, '');

    if ((req.method === 'GET' || req.method === 'HEAD') && p.startsWith('/assets/')) {
      const file = path.resolve(PUBLIC_DIR, `.${p.slice(7)}`);
      if (file.startsWith(PUBLIC_DIR + path.sep) && serveFile(req, res, file, { immutable: url.searchParams.has('v') })) return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && p.startsWith('/media/')) {
      const name = path.basename(p);
      if (/^[\w.-]+$/.test(name) && serveFile(req, res, path.join(config.uploadDir, name), { immutable: true, sandbox: name.endsWith('.svg') })) return;
    }

    const nonce = crypto.randomBytes(16).toString('base64');
    const cookies = parseCookies(req.headers.cookie);
    const setCookies = [];
    const ctx = {
      req, res, db, url, path: p, query: Object.fromEntries(url.searchParams), params: {}, cookies, nonce,
      ip: clientIp(req), site: siteUrl(req), settings: getSettings(db), body: {}, rawBody: null, asset,
      user: auth.userFromToken(db, cookies.sid),
      isJson: /application\/json/.test(String(req.headers.accept || '')) || req.headers['x-requested-with'] === 'fetch',
      setCookie(name, value, opts) { setCookies.push(cookie(name, value, opts)); },
      flash: null, old: {},
    };
    // CSRF token (double-submit cookie).
    ctx.csrf = cookies.csrf && /^[\w-]{20,}$/.test(cookies.csrf) ? cookies.csrf : token(24);
    if (ctx.csrf !== cookies.csrf) ctx.setCookie('csrf', ctx.csrf, { maxAge: 60 * 60 * 24 * 365 });
    if (cookies.flash) {
      const f = jsonParse(cookies.flash, null);
      if (f) { ctx.flash = f.m ? { type: f.t || 'info', message: f.m } : null; ctx.old = f.o || {}; }
      ctx.setCookie('flash', '', { maxAge: 0 });
    }
    // Cart: users have a persistent cart; guests carry a cart cookie.
    ctx.cartId = cookies.cart || null;
    if (ctx.user) {
      const uc = commerce.userCart(db, ctx.user.id);
      if (ctx.cartId && (!uc || uc.id !== ctx.cartId)) {
        const guest = commerce.findCart(db, ctx.cartId);
        if (guest && !guest.user_id) ctx.cartId = commerce.mergeIntoUser(db, ctx.cartId, ctx.user.id);
        else ctx.cartId = uc ? uc.id : null;
      } else if (!ctx.cartId && uc) ctx.cartId = uc.id;
    } else if (ctx.cartId && !commerce.findCart(db, ctx.cartId)) ctx.cartId = null;
    ctx.ensureCart = () => {
      if (!ctx.cartId || !commerce.findCart(db, ctx.cartId)) {
        ctx.cartId = commerce.createCart(db, ctx.user ? ctx.user.id : null);
      }
      ctx.setCookie('cart', ctx.cartId, { maxAge: 60 * 60 * 24 * 60 });
      return ctx.cartId;
    };
    ctx.cartCount = () => {
      if (!ctx.cartId) return 0;
      return db.prepare('SELECT COALESCE(SUM(qty),0) AS n FROM cart_items WHERE cart_id = ?').get(ctx.cartId).n;
    };

    const base = securityHeaders(nonce);
    ctx.send = (status, body, headers = {}) => {
      const h = { ...base, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers };
      if (setCookies.length) h['Set-Cookie'] = setCookies;
      sendBody(req, res, status, body instanceof Safe ? body.s : body, h);
    };
    ctx.html = (body, status = 200, headers = {}) => ctx.send(status, body, headers);
    ctx.json = (obj, status = 200) => ctx.send(status, JSON.stringify(obj), { 'Content-Type': 'application/json' });
    ctx.redirect = (to, flash, old) => {
      if (flash) ctx.setCookie('flash', JSON.stringify({ t: flash.type || 'info', m: flash.message, o: old || undefined }).slice(0, 3500), { maxAge: 60 });
      const h = { ...base, Location: to, 'Cache-Control': 'no-store' };
      if (setCookies.length) h['Set-Cookie'] = setCookies;
      res.writeHead(303, h); res.end();
    };

    const method = req.method === 'HEAD' ? 'GET' : req.method;
    let match = null;
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(p);
      if (m) { match = r; r.keys.forEach((k, i) => { ctx.params[k] = m[i + 1]; }); break; }
    }

    try {
      if (!match) throw new HttpError(404, 'Page not found');
      if (method === 'POST') {
        const limit = match.opts.bodyLimit || 1e6;
        if (match.opts.stream) {
          // Handler reads the request stream itself (large uploads).
        } else {
          ctx.rawBody = await readBody(req, limit);
          const type = String(req.headers['content-type'] || '');
          if (type.includes('application/json')) ctx.body = jsonParse(ctx.rawBody.toString('utf8'), {});
          else if (type.includes('application/x-www-form-urlencoded')) ctx.body = parseForm(ctx.rawBody);
        }
        if (!match.opts.noCsrf) {
          const origin = req.headers.origin;
          let originHost = null;
          try { originHost = origin && origin !== 'null' ? new URL(origin).host : null; } catch { originHost = 'invalid'; }
          if (originHost && originHost !== req.headers.host) throw new HttpError(403, 'Cross-site request blocked');
          const sent = ctx.body._csrf || req.headers['x-csrf-token'];
          if (!cookies.csrf || !sent || !safeEqual(sent, cookies.csrf)) throw new HttpError(403, 'Your session expired. Please refresh the page and try again.');
        }
      }
      if (match.opts.auth && !ctx.user) {
        if (method === 'GET') return ctx.redirect(`/login?next=${encodeURIComponent(p + url.search)}`);
        throw new HttpError(401, 'Please sign in');
      }
      if (match.opts.admin && (!ctx.user || ctx.user.role !== 'admin')) {
        if (!ctx.user && method === 'GET') return ctx.redirect(`/login?next=${encodeURIComponent(p + url.search)}`);
        throw new HttpError(404, 'Page not found');
      }
      await match.handler(ctx);
    } catch (e) {
      if (res.headersSent) { console.error(e); return; }
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) console.error(e);
      const message = status >= 500 ? 'Something went wrong on our side. Please try again.' : e.message;
      if (ctx.isJson || match?.opts.api) return ctx.json({ error: message }, status);
      if (method === 'POST' && status < 500 && status !== 404) {
        const ref = String(req.headers.referer || '');
        let back = '/';
        try { const r = new URL(ref); if (r.host === req.headers.host) back = r.pathname + r.search; } catch { /* default */ }
        const old = {};
        for (const [k, v] of Object.entries(ctx.body || {})) if (!/password|_csrf/i.test(k) && typeof v === 'string') old[k] = v.slice(0, 400);
        return ctx.redirect(back, { type: 'error', message }, old);
      }
      ctx.html(app.errorPage ? app.errorPage(ctx, status, message) : message, status);
    }
  }
  return app;
}

module.exports = { createApp, readBody, asset, PUBLIC_DIR };
