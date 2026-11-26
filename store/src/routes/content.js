'use strict';
const { html, raw, str, int, HttpError, email, phone, token, now, fmtDate, safeUrl } = require('../util');
const catalog = require('../catalog');
const seo = require('../seo');
const mailer = require('../mailer');
const whatsapp = require('../whatsapp');
const auth = require('../auth');
const config = require('../config');
const { markdown, plain } = require('../markdown');
const { parseVideo, videoEmbed } = require('../video');

const JOURNAL_CATEGORIES = [
  ['itan-ankoo', 'ÌTÀN ÀNKÓÒ'],
  ['documentaries', 'Documentaries'],
  ['behind-the-scenes', 'Behind the Scenes'],
  ['campaigns', 'Campaigns'],
  ['collaborations', 'Collaborations'],
  ['culture', 'Culture & Stories'],
];
const catName = (k) => (JOURNAL_CATEGORIES.find(([c]) => c === k) || [k, k])[1];

function cover(ctx, a) {
  const m = catalog.getMedia(ctx.db, a.cover_media_id);
  if (m) return { url: catalog.mediaUrl(m, true), media: m };
  const v = parseVideo(a.video_url);
  return v && v.thumb ? { url: v.thumb } : null;
}

function articleCard(ctx, a) {
  // Lazily required to avoid a circular import with the layout module.
  const { picture, icons } = require('../views/layout');
  const c = cover(ctx, a);
  const isVideo = Boolean(a.video_url || a.video_media_id);
  return html`<article class="article-card">
  <a class="article-media" href="/journal/${a.slug}">
    ${c ? (c.media ? picture(c.media, { alt: a.title, sizes: '(min-width: 900px) 33vw, 100vw', small: true }) : html`<img src="${c.url}" alt="${a.title}" loading="lazy">`) : html`<span class="card-placeholder">${catName(a.category)}</span>`}
    ${isVideo ? html`<span class="play">${icons.play}</span>` : ''}
  </a>
  <p class="eyebrow">${catName(a.category)}${a.episode ? html` · ${a.episode}` : ''}</p>
  <h3 class="article-title"><a href="/journal/${a.slug}">${a.title}</a></h3>
  ${a.excerpt ? html`<p class="muted">${a.excerpt}</p>` : ''}
</article>`;
}

function locationsBlock(ctx) {
  const { icons } = require('../views/layout');
  const locs = ctx.settings.locations || [];
  return html`<div class="locations">${locs.map((l) => html`<div class="location">
    <p class="eyebrow">${icons.pin} ${l.region || ''}</p>
    <h3 class="h3">${l.city}</h3>
    ${l.address ? html`<p>${l.address}</p>` : ''}
    ${l.hours ? html`<p class="muted">${l.hours}</p>` : ''}
    ${safeUrl(l.map_url) ? html`<p><a class="link-arrow" href="${safeUrl(l.map_url)}" target="_blank" rel="noopener">Get directions</a></p>` : ''}
  </div>`)}</div>`;
}

module.exports = function register(app) {
  const { layout, picture, icons, csrf, old } = require('../views/layout');

  app.get('/about', (ctx) => {
    const page = ctx.db.prepare("SELECT * FROM pages WHERE slug = 'about'").get();
    const m = catalog.getMedia(ctx.db, ctx.settings.about_media_id);
    const episodes = ctx.db.prepare("SELECT * FROM articles WHERE status = 'published' AND category = 'itan-ankoo' ORDER BY published_at DESC LIMIT 6").all();
    ctx.html(layout(ctx, {
      title: 'About ANKOO',
      description: page.seo_description || plain(page.body),
      image: m ? catalog.mediaUrl(m) : undefined,
      jsonld: [seo.organization(ctx), seo.breadcrumbs(ctx, [['About', '/about']])],
      overlayHeader: true,
      body: html`
<section class="about-hero">
  <div class="about-hero-media">${m ? picture(m, { alt: 'ANKOO', eager: true }) : html`<img src="/assets/img/ankoo-studio-mural.webp" alt="Mural inside the ANKOO space: men in agbada in forest green and gold" width="1000" height="1778" fetchpriority="high">`}</div>
  <div class="about-hero-text">
    <p class="eyebrow">The House</p>
    <h1 class="display-xl">${page.title}</h1>
  </div>
</section>
<section class="editorial">${raw(markdown(page.body))}</section>
<section class="itan">
  <div class="narrow center">
    <p class="eyebrow">The storytelling series</p>
    <h2 class="display">ÌTÀN ÀNKÓÒ</h2>
    ${episodes.length ? '' : html`<p class="lede">New episodes of ÌTÀN ÀNKÓÒ will appear here.</p>`}
  </div>
  ${episodes.length ? html`<div class="articles">${episodes.map((a) => articleCard(ctx, a))}</div>
  <p class="center"><a class="btn btn-outline-light" href="/journal?category=itan-ankoo">All episodes</a></p>` : ''}
</section>
<section class="section"><div class="section-head"><div><p class="eyebrow">Visit us</p><h2 class="h2">Akure &amp; Lagos</h2></div><a class="link-arrow" href="/contact">Contact ${icons.arrow}</a></div>${locationsBlock(ctx)}</section>`,
    }));
  });

  app.get('/journal', (ctx) => {
    const cat = JOURNAL_CATEGORIES.some(([c]) => c === ctx.query.category) ? ctx.query.category : '';
    const rows = ctx.db.prepare(`SELECT * FROM articles WHERE status = 'published' ${cat ? 'AND category = ?' : ''} ORDER BY featured DESC, published_at DESC LIMIT 60`).all(...(cat ? [cat] : []));
    const [lead, ...rest] = rows;
    const leadCover = lead ? cover(ctx, lead) : null;
    ctx.html(layout(ctx, {
      title: cat ? `${catName(cat)}: ANKOO Journal` : 'The ANKOO Journal',
      description: 'Stories, films and campaigns from ANKOO, including the ÌTÀN ÀNKÓÒ storytelling series, behind-the-scenes and African fashion and culture.',
      canonical: cat ? `/journal?category=${cat}` : '/journal',
      body: html`
<section class="page-head"><div class="page-head-inner">
  <p class="eyebrow">Stories · Films · Campaigns</p>
  <h1 class="display">${cat ? catName(cat) : 'The Journal'}</h1>
</div></section>
<nav class="chips" aria-label="Journal categories"><a href="/journal" class="${cat ? '' : 'on'}">All</a>${JOURNAL_CATEGORIES.map(([k, n]) => html`<a href="/journal?category=${k}" class="${cat === k ? 'on' : ''}">${n}</a>`)}</nav>
${lead ? html`<section class="section">
  <a class="lead-story" href="/journal/${lead.slug}">
    <div class="lead-media">${leadCover ? (leadCover.media ? picture(leadCover.media, { alt: lead.title, eager: true }) : html`<img src="${leadCover.url}" alt="${lead.title}">`) : html`<span class="card-placeholder">${catName(lead.category)}</span>`}${lead.video_url || lead.video_media_id ? html`<span class="play">${icons.play}</span>` : ''}</div>
    <div class="lead-text"><p class="eyebrow">${catName(lead.category)}${lead.episode ? html` · ${lead.episode}` : ''}</p><h2 class="display">${lead.title}</h2>${lead.excerpt ? html`<p class="lede">${lead.excerpt}</p>` : ''}<span class="link-arrow">${lead.video_url || lead.video_media_id ? 'Watch' : 'Read'} ${icons.arrow}</span></div>
  </a>
  ${rest.length ? html`<div class="articles">${rest.map((a) => articleCard(ctx, a))}</div>` : ''}
</section>` : html`<div class="empty narrow center"><h2 class="h2">Stories are coming soon</h2><p>Follow ANKOO for the first episodes of ÌTÀN ÀNKÓÒ, our films and campaigns.</p></div>`}`,
    }));
  });

  app.get('/journal/:slug', (ctx) => {
    const a = ctx.db.prepare("SELECT * FROM articles WHERE slug = ? AND status = 'published'").get(ctx.params.slug);
    if (!a) throw new HttpError(404, 'Page not found');
    const c = catalog.getMedia(ctx.db, a.cover_media_id);
    const vid = catalog.getMedia(ctx.db, a.video_media_id);
    const more = ctx.db.prepare("SELECT * FROM articles WHERE status = 'published' AND id != ? ORDER BY (category = ?) DESC, published_at DESC LIMIT 3").all(a.id, a.category);
    const embed = vid ? `<div class="video"><video src="${catalog.mediaUrl(vid)}" controls playsinline preload="metadata" ${c ? `poster="${catalog.mediaUrl(c)}"` : ''}></video></div>` : videoEmbed(a.video_url, a.title);
    ctx.html(layout(ctx, {
      title: a.seo_title || a.title,
      description: a.seo_description || a.excerpt || plain(a.body),
      image: c ? catalog.mediaUrl(c) : (parseVideo(a.video_url) || {}).thumb,
      ogType: 'article',
      jsonld: [seo.article(ctx, a, c), seo.breadcrumbs(ctx, [['Journal', '/journal'], [a.title, `/journal/${a.slug}`]])],
      body: html`
<article class="story-article">
  <header class="article-head narrow center">
    <p class="eyebrow"><a href="/journal?category=${a.category}">${catName(a.category)}</a>${a.episode ? html` · ${a.episode}` : ''}</p>
    <h1 class="display">${a.title}</h1>
    ${a.excerpt ? html`<p class="lede">${a.excerpt}</p>` : ''}
    <p class="muted small">${fmtDate(a.published_at)}</p>
  </header>
  ${embed ? html`<div class="article-video">${raw(embed)}</div>` : (c ? html`<figure class="article-cover">${picture(c, { alt: a.title, eager: true })}</figure>` : '')}
  <div class="editorial">${raw(markdown(a.body))}</div>
</article>
${more.length ? html`<section class="section"><div class="section-head"><div><p class="eyebrow">Continue reading</p><h2 class="h2">More from the Journal</h2></div></div><div class="articles">${more.map((m) => articleCard(ctx, m))}</div></section>` : ''}`,
    }));
  });

  app.get('/contact', (ctx) => {
    const s = ctx.settings;
    const wa = whatsapp.link(s, 'Hello ANKOO, I have an enquiry.');
    const subjects = ['General enquiry', 'Product enquiry', 'Bespoke order', 'Sizing', 'Delivery', 'Order follow-up', 'Press & collaborations'];
    const channels = [
      wa && ['whatsapp', 'WhatsApp', wa, 'Chat with our team'],
      s.business_email && ['mail', 'Email', `mailto:${s.business_email}`, s.business_email],
      safeUrl(s.instagram_url) && ['instagram', 'Instagram', safeUrl(s.instagram_url), s.instagram_handle ? `@${String(s.instagram_handle).replace(/^@/, '')}` : 'Follow us'],
      safeUrl(s.facebook_url) && ['facebook', 'Facebook', safeUrl(s.facebook_url), 'ANKOO on Facebook'],
      safeUrl(s.tiktok_url) && ['tiktok', 'TikTok', safeUrl(s.tiktok_url), 'ANKOO on TikTok'],
    ].filter(Boolean);
    ctx.html(layout(ctx, {
      title: 'Contact ANKOO',
      description: 'Contact ANKOO in Akure and Lagos: WhatsApp, email, Instagram, Facebook and TikTok. Product enquiries, bespoke orders, sizing and delivery.',
      jsonld: [seo.organization(ctx)],
      body: html`
<section class="page-head"><div class="page-head-inner"><p class="eyebrow">Client care</p><h1 class="display">Contact us</h1><p class="lede">For product enquiries, bespoke commissions, sizing and delivery, our team is here to help.</p></div></section>
<div class="contact">
  <div class="contact-info">
    ${channels.length ? html`<ul class="channels">${channels.map(([ic, label, href, text]) => html`<li><a href="${href}" ${href.startsWith('http') ? raw('target="_blank" rel="noopener"') : ''}>${icons[ic]}<span><b>${label}</b>${text}</span></a></li>`)}</ul>` : ''}
    ${locationsBlock(ctx)}
  </div>
  <form class="form contact-form" method="post" action="/contact">
    ${csrf(ctx)}
    <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" required maxlength="120" autocomplete="name" value="${old(ctx, 'name', ctx.user ? ctx.user.name : '')}"></div>
    <div class="field-row">
      <div class="field"><label for="c-email">Email</label><input id="c-email" type="email" name="email" required autocomplete="email" value="${old(ctx, 'email', ctx.user ? ctx.user.email : '')}"></div>
      <div class="field"><label for="c-phone">Phone number</label><input id="c-phone" type="tel" name="phone" autocomplete="tel" value="${old(ctx, 'phone', ctx.user ? ctx.user.phone : '')}"></div>
    </div>
    <div class="field"><label for="c-subject">Subject</label><select id="c-subject" name="subject">${subjects.map((x) => html`<option ${old(ctx, 'subject', ctx.query.subject) === x ? raw('selected') : ''}>${x}</option>`)}</select></div>
    <div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required maxlength="5000">${old(ctx, 'message')}</textarea></div>
    <button class="btn" type="submit">Send message</button>
  </form>
</div>`,
    }));
  });

  app.post('/contact', (ctx) => {
    const b = ctx.body;
    if (b.website) return ctx.redirect('/contact', { type: 'success', message: 'Thank you. Your message has been sent.' });
    if (auth.rateLimited(`contact:${ctx.ip}`, 5, 60 * 60 * 1000)) throw new HttpError(429, 'Too many messages. Please try again later or reach us on WhatsApp.');
    const m = {
      name: str(b.name, 120), email: email(b.email), phone: phone(b.phone, false),
      subject: str(b.subject, 120), message: str(b.message, 5000),
    };
    if (!m.name || !m.message) throw new HttpError(400, 'Please enter your name and message.');
    ctx.db.prepare('INSERT INTO messages (name, email, phone, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(m.name, m.email, m.phone, m.subject, m.message, now());
    mailer.contactMessage(ctx.db, ctx.site, ctx.settings.business_email || config.orderNotifyEmail, m);
    ctx.redirect('/contact', { type: 'success', message: 'Thank you. Your message has been sent and our team will reply soon.' });
  });

  app.get('/pages/:slug', (ctx) => {
    if (ctx.params.slug === 'about') return ctx.redirect('/about');
    const p = ctx.db.prepare('SELECT * FROM pages WHERE slug = ?').get(ctx.params.slug);
    if (!p) throw new HttpError(404, 'Page not found');
    ctx.html(layout(ctx, {
      title: p.title, description: p.seo_description || plain(p.body),
      body: html`<section class="page-head page-head-sm"><div class="page-head-inner"><h1 class="display">${p.title}</h1></div></section>
<div class="prose page-prose">${raw(markdown(p.body))}<p class="muted small">Last updated ${fmtDate(p.updated_at)}</p></div>`,
    }));
  });

  app.post('/newsletter', (ctx) => {
    if (auth.rateLimited(`news:${ctx.ip}`, 10, 60 * 60 * 1000)) throw new HttpError(429, 'Please try again later.');
    const e = email(ctx.body.email);
    const ex = ctx.db.prepare('SELECT * FROM subscribers WHERE email = ?').get(e);
    if (ex) ctx.db.prepare('UPDATE subscribers SET unsubscribed_at = NULL WHERE id = ?').run(ex.id);
    else ctx.db.prepare('INSERT INTO subscribers (email, token, source, created_at) VALUES (?, ?, ?, ?)').run(e, token(18), str(ctx.body.source, 40), now());
    if (ctx.isJson) return ctx.json({ ok: true });
    const ref = String(ctx.req.headers.referer || '/');
    let back = '/';
    try { const u = new URL(ref); if (u.host === ctx.req.headers.host) back = u.pathname + u.search; } catch { /* default */ }
    ctx.redirect(back, { type: 'success', message: 'Thank you for subscribing to the ANKOO Letter.' });
  });
  app.get('/unsubscribe', (ctx) => {
    const t = str(ctx.query.t, 64);
    if (t) ctx.db.prepare('UPDATE subscribers SET unsubscribed_at = ? WHERE token = ? AND unsubscribed_at IS NULL').run(now(), t);
    ctx.html(layout(ctx, { title: 'Unsubscribed', noindex: true, body: html`<section class="narrow center pad-xl"><h1 class="display">You have been unsubscribed</h1><p class="lede">You will no longer receive the ANKOO Letter.</p></section>` }));
  });

  app.get('/track', (ctx) => {
    ctx.html(layout(ctx, {
      title: 'Track your order', noindex: true,
      body: html`<section class="page-head page-head-sm"><div class="page-head-inner"><h1 class="display">Track your order</h1><p class="lede">Enter your order number and the email address used at checkout.</p></div></section>
<form class="form narrow-form" method="post" action="/track">${csrf(ctx)}
  <div class="field"><label for="t-num">Order number</label><input id="t-num" name="number" placeholder="ANK-XXXXXX" required autocapitalize="characters" value="${old(ctx, 'number')}"></div>
  <div class="field"><label for="t-email">Email</label><input id="t-email" type="email" name="email" required value="${old(ctx, 'email')}"></div>
  <button class="btn btn-block" type="submit">Track order</button>
  ${ctx.user ? html`<p class="center"><a href="/account">View all your orders</a></p>` : ''}
</form>`,
    }));
  });
  app.post('/track', (ctx) => {
    if (auth.rateLimited(`track:${ctx.ip}`, 20)) throw new HttpError(429, 'Too many attempts. Please try again later.');
    const number = str(ctx.body.number, 20).toUpperCase();
    const e = email(ctx.body.email);
    const o = ctx.db.prepare('SELECT number, access_key FROM orders WHERE number = ? AND email = ?').get(number, e);
    if (!o) throw new HttpError(400, 'We could not find an order with those details.');
    ctx.redirect(`/order/${o.number}?k=${o.access_key}`);
  });

  app.get('/sitemap.xml', (ctx) => ctx.send(200, seo.sitemap(ctx), { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }));
  app.get('/robots.txt', (ctx) => ctx.send(200, seo.robots(ctx), { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }));
  app.get('/feeds/products.csv', (ctx) => ctx.send(200, seo.productFeed(ctx), { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=1800' }));
  app.get('/healthz', (ctx) => { ctx.db.prepare('SELECT 1').get(); ctx.send(200, 'ok', { 'Content-Type': 'text/plain' }); });
};
module.exports.articleCard = articleCard;
module.exports.JOURNAL_CATEGORIES = JOURNAL_CATEGORIES;
module.exports.catName = catName;
