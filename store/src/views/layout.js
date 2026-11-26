'use strict';
const { html, raw, esc, naira, safeUrl } = require('../util');
const catalog = require('../catalog');
const whatsapp = require('../whatsapp');
const config = require('../config');

// ---- Icons (inline SVG, 1.25 stroke) ----
const I = (d, extra = '') => raw(`<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`);
const icons = {
  bag: I('<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  heart: I('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  menu: I('<path d="M3 7h18M3 12h18M3 17h18"/>'),
  close: I('<path d="M5 5l14 14M19 5 5 19"/>'),
  arrow: I('<path d="M4 12h16M14 6l6 6-6 6"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  minus: I('<path d="M5 12h14"/>'),
  whatsapp: raw('<svg class="i" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>'),
  instagram: I('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>'),
  facebook: I('<path d="M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2.5H8V14h2.5v6.5H14V14h2.5l.5-3.5h-3V8.6c0-.4.2-.6.5-.6Z"/>'),
  tiktok: I('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.7"/>'),
  youtube: I('<rect x="2.5" y="5.5" width="19" height="13" rx="3.5"/><path d="m10 9 5 3-5 3V9Z"/>'),
  play: raw('<svg class="i" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M8 5v14l11-7L8 5Z"/></svg>'),
  pin: I('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  mail: I('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/>'),
};

// ---- Price formatting with optional approximate foreign currency (display only; charged in NGN) ----
function price(ctx, kobo) {
  const cur = String(ctx.cookies.cur || '').toUpperCase();
  const rate = Number((ctx.settings.currency_rates || {})[cur]);
  const approx = cur && cur !== 'NGN' && rate > 0
    ? html`<span class="approx">≈ ${new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(kobo / 100 / rate)}</span>` : '';
  return html`<span class="price">${naira(kobo)}</span>${approx}`;
}

function picture(m, { alt = '', sizes = '100vw', cls = '', eager = false, small = false } = {}) {
  if (!m) return '';
  const lg = catalog.mediaUrl(m);
  const sm = m.file_sm ? catalog.mediaUrl(m, true) : '';
  const srcset = sm ? `${sm} 900w, ${lg} ${m.width || 2000}w` : '';
  return html`<img class="${cls}" src="${small && sm ? sm : lg}" ${srcset ? raw(`srcset="${esc(srcset)}" sizes="${esc(sizes)}"`) : ''} alt="${alt || m.alt || ''}" ${m.width ? raw(`width="${m.width}" height="${m.height}"`) : ''} ${eager ? raw('fetchpriority="high"') : raw('loading="lazy"')} decoding="async">`;
}

function logo(ctx, cls = '') {
  const m = catalog.getMedia(ctx.db, ctx.settings.logo_media_id);
  if (m) return html`<img class="logo-img ${cls}" src="${catalog.mediaUrl(m)}" alt="${ctx.settings.brand_name || 'ANKOO'}">`;
  return html`<span class="wordmark ${cls}">${ctx.settings.brand_name || 'ANKOO'}</span>`;
}

function productCard(ctx, p, { sizes = '(min-width: 1000px) 25vw, 50vw' } = {}) {
  const a = catalog.availability(p, ctx.settings.low_stock_threshold);
  const [img1, img2] = p.images;
  return html`<article class="card">
  <a href="/product/${p.slug}" class="card-media" aria-label="${p.name}">
    ${img1 ? picture(img1, { alt: p.name, sizes, small: true }) : html`<span class="card-placeholder">${ctx.settings.brand_name}</span>`}
    ${img2 ? picture(img2, { alt: '', sizes, cls: 'alt', small: true }) : ''}
    ${a.key !== 'in' ? html`<span class="tag tag-${a.key}">${a.label}</span>` : ''}
  </a>
  <div class="card-body">
    <h3 class="card-title"><a href="/product/${p.slug}">${p.name}</a></h3>
    ${p.subtitle ? html`<p class="card-sub">${p.subtitle}</p>` : ''}
    <p class="card-price">${price(ctx, p.price_kobo)}${p.compare_at_kobo > p.price_kobo ? html` <s>${naira(p.compare_at_kobo)}</s>` : ''}</p>
  </div>
</article>`;
}

function flash(ctx) {
  if (!ctx.flash) return '';
  return html`<div class="flash flash-${ctx.flash.type}" role="status">${ctx.flash.message}</div>`;
}
const csrf = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.csrf}">`;
const old = (ctx, k, d = '') => (ctx.old && ctx.old[k] !== undefined ? ctx.old[k] : d);

function socialLinks(s) {
  const links = [
    ['instagram', s.instagram_url, 'Instagram'], ['facebook', s.facebook_url, 'Facebook'],
    ['tiktok', s.tiktok_url, 'TikTok'], ['youtube', s.youtube_url, 'YouTube'],
  ].filter(([, u]) => safeUrl(u));
  return links.map(([k, u, label]) => html`<a href="${safeUrl(u)}" target="_blank" rel="noopener" aria-label="${label}">${icons[k]}</a>`);
}

function analytics(ctx) {
  const s = ctx.settings;
  const ga = s.ga_id || config.gaId;
  const px = s.meta_pixel_id || config.metaPixelId;
  if (!ga && !px) return '';
  const cfg = JSON.stringify({ ga: /^G-[A-Z0-9]+$/i.test(ga) ? ga : '', px: /^\d{5,20}$/.test(px) ? px : '', consent: s.require_consent !== false });
  return html`<script nonce="${ctx.nonce}" id="analytics-config" type="application/json">${raw(cfg.replace(/</g, '\\u003c'))}</script>`;
}

function layout(ctx, o) {
  const s = ctx.settings;
  const brand = s.brand_name || 'ANKOO';
  const title = o.title ? `${o.title} | ${brand}` : (s.seo_title || brand);
  const description = o.description || s.seo_description || '';
  const canonical = `${ctx.site}${o.canonical || ctx.path}`;
  const ogMedia = o.image || (s.og_media_id ? catalog.mediaUrl(catalog.getMedia(ctx.db, s.og_media_id)) : '');
  const ogImage = ogMedia ? (ogMedia.startsWith('http') ? ogMedia : `${ctx.site}${ogMedia}`) : `${ctx.site}/assets/img/ankoo-studio-mural.webp`;
  const nav = catalog.collections(ctx.db, { navOnly: true });
  const count = ctx.cartCount();
  const wa = whatsapp.link(s, o.waText || `Hello ANKOO, I have an enquiry${ctx.path !== '/' ? ` about ${ctx.site}${ctx.path}` : ''}.`);
  const gsc = s.gsc_verification || config.gscVerification;
  const jsonld = [].concat(o.jsonld || []);
  const rates = Object.entries(s.currency_rates || {}).filter(([, r]) => Number(r) > 0).map(([c]) => c);

  return html`<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
${o.noindex ? raw('<meta name="robots" content="noindex, nofollow">') : ''}
<meta name="theme-color" content="#16301F">
<meta property="og:site_name" content="${brand}">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${o.title || s.seo_title || brand}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:locale" content="en_NG">
<meta name="twitter:card" content="summary_large_image">
${o.ogExtra || ''}
${gsc ? html`<meta name="google-site-verification" content="${gsc}">` : ''}
<link rel="icon" href="/assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/icon-180.png">
<link rel="manifest" href="/assets/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${ctx.asset('css/site.css')}">
${jsonld.map((j) => html`<script type="application/ld+json" nonce="${ctx.nonce}">${raw(JSON.stringify(j).replace(/</g, '\\u003c'))}</script>`)}
${analytics(ctx)}
${o.track ? html`<script nonce="${ctx.nonce}" id="track-data" type="application/json">${raw(JSON.stringify(o.track).replace(/</g, '\\u003c'))}</script>` : ''}
</head>
<body class="${o.bodyClass || ''}${o.overlayHeader ? ' overlay-header' : ''}">
<a class="skip" href="#main">Skip to content</a>
${s.announcement ? html`<div class="announce">${s.announcement}</div>` : ''}
<header class="site-header" id="top">
  <div class="header-inner">
    <div class="header-left">
      <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-controls="mobile-menu" aria-expanded="false" data-menu-open>${icons.menu}</button>
      <nav class="primary-nav" aria-label="Main">
        <div class="nav-item has-panel">
          <a href="/shop">Shop</a>
          <div class="nav-panel">
            <div class="nav-panel-inner">
              <ul>
                <li><a href="/shop">All pieces</a></li>
                ${nav.map((c) => html`<li><a href="/collections/${c.slug}">${c.name}</a></li>`)}
              </ul>
            </div>
          </div>
        </div>
        <a href="/journal">Journal</a>
        <a href="/about">The House</a>
      </nav>
    </div>
    <a class="brand" href="/" aria-label="${brand} home">${logo(ctx)}</a>
    <div class="header-right">
      <button class="icon-btn" type="button" aria-label="Search" data-search-open>${icons.search}</button>
      <a class="icon-btn hide-sm" href="${ctx.user ? '/account' : '/login'}" aria-label="Account">${icons.user}</a>
      <a class="icon-btn hide-sm" href="/account/wishlist" aria-label="Wishlist">${icons.heart}</a>
      <a class="icon-btn bag" href="/cart" aria-label="Shopping bag, ${count} items">${icons.bag}<span class="bag-count" data-bag-count ${count ? '' : raw('hidden')}>${count}</span></a>
    </div>
  </div>
  <form class="search-bar" action="/shop" method="get" role="search" hidden data-search>
    <label class="sr" for="q">Search ANKOO</label>
    <input id="q" name="q" type="search" placeholder="Search the collection" autocomplete="off">
    <button class="icon-btn" type="button" aria-label="Close search" data-search-close>${icons.close}</button>
  </form>
</header>

<div class="mobile-menu" id="mobile-menu" hidden>
  <div class="mobile-menu-head">
    <span class="wordmark">${brand}</span>
    <button class="icon-btn" type="button" aria-label="Close menu" data-menu-close>${icons.close}</button>
  </div>
  <nav aria-label="Mobile">
    <a class="mm-lg" href="/shop">Shop all</a>
    ${nav.map((c) => html`<a class="mm-lg" href="/collections/${c.slug}">${c.name}</a>`)}
    <hr>
    <a href="/journal">Journal</a>
    <a href="/about">The House</a>
    <a href="/contact">Contact</a>
    <a href="${ctx.user ? '/account' : '/login'}">${ctx.user ? 'My account' : 'Sign in'}</a>
    <a href="/account/wishlist">Wishlist</a>
    <a href="/track">Track an order</a>
  </nav>
  ${wa ? html`<a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener">${icons.whatsapp} Chat with us on WhatsApp</a>` : ''}
</div>

<main id="main">
${flash(ctx)}
${o.body}
</main>

<footer class="site-footer">
  <div class="footer-top">
    <div class="footer-brand">
      ${logo(ctx, 'footer-logo')}
      <p>African heritage, quiet luxury and contemporary expression, from Akure and Lagos.</p>
      <div class="social">${socialLinks(s)}</div>
    </div>
    <div class="footer-cols">
      <div><h4>Shop</h4><ul><li><a href="/shop">All pieces</a></li>${nav.map((c) => html`<li><a href="/collections/${c.slug}">${c.name}</a></li>`)}</ul></div>
      <div><h4>The House</h4><ul><li><a href="/about">Our story</a></li><li><a href="/journal">Journal</a></li><li><a href="/journal?category=itan-ankoo">ÌTÀN ÀNKÓÒ</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Client Care</h4><ul><li><a href="/track">Track an order</a></li><li><a href="/pages/shipping">Delivery</a></li><li><a href="/pages/returns">Returns</a></li><li><a href="/pages/size-guide">Size guide</a></li><li><a href="/pages/privacy">Privacy</a></li><li><a href="/pages/terms">Terms</a></li></ul></div>
    </div>
    <div class="footer-news">
      <h4>The ANKOO Letter</h4>
      <p>New collections, stories from ÌTÀN ÀNKÓÒ and private previews.</p>
      <form class="news-form" method="post" action="/newsletter">
        ${csrf(ctx)}<input type="hidden" name="source" value="footer">
        <label class="sr" for="news-email">Email address</label>
        <input id="news-email" type="email" name="email" placeholder="Email address" required autocomplete="email">
        <button type="submit" aria-label="Subscribe">${icons.arrow}</button>
      </form>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© ${new Date().getFullYear()} ${brand}. Akure · Lagos, Nigeria.</span>
    ${rates.length ? html`<form class="currency" method="post" action="/currency">${csrf(ctx)}<label for="cur">Show prices in</label>
      <select id="cur" name="cur" data-autosubmit><option value="NGN">₦ NGN</option>${rates.map((c) => html`<option value="${c}" ${ctx.cookies.cur === c ? raw('selected') : ''}>${c} (approx.)</option>`)}</select></form>` : ''}
  </div>
</footer>

${wa ? html`<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="Chat with ANKOO on WhatsApp">${icons.whatsapp}<span>Chat with us</span></a>` : ''}
<div class="consent" hidden data-consent>
  <p>We use cookies to understand how our site is used and to improve your experience. <a href="/pages/privacy">Privacy policy</a></p>
  <div><button class="btn btn-sm btn-ghost" type="button" data-consent-no>Decline</button><button class="btn btn-sm" type="button" data-consent-yes>Accept</button></div>
</div>
<script src="${ctx.asset('js/site.js')}" defer></script>
</body>
</html>`;
}

function errorPage(ctx, status, message) {
  return layout(ctx, {
    title: status === 404 ? 'Page not found' : 'Something went wrong',
    noindex: true,
    body: html`<section class="narrow center pad-xl">
      <p class="eyebrow">${status === 404 ? 'Error 404' : `Error ${status}`}</p>
      <h1 class="display">${status === 404 ? 'This page could not be found' : message}</h1>
      ${status === 404 ? html`<p class="lede">The piece or page you are looking for may have moved.</p>` : ''}
      <p><a class="btn" href="/shop">Explore the collection</a></p>
    </section>`,
  });
}

module.exports = { layout, errorPage, productCard, picture, price, icons, csrf, old, flash, logo, socialLinks };
