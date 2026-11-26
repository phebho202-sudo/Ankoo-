'use strict';
const { html, raw, naira, int, str, HttpError, safeUrl, toKobo } = require('../util');
const catalog = require('../catalog');
const commerce = require('../commerce');
const whatsapp = require('../whatsapp');
const seo = require('../seo');
const instagram = require('../instagram');
const { markdown, plain } = require('../markdown');
const { layout, productCard, picture, price, icons, csrf } = require('../views/layout');
const { articleCard } = require('./content');

const PER_PAGE = 24;

function rail(ctx, title, products, href, eyebrow) {
  if (!products.length) return '';
  return html`<section class="section">
  <div class="section-head">
    <div>${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}<h2 class="h2">${title}</h2></div>
    ${href ? html`<a class="link-arrow" href="${href}">View all ${icons.arrow}</a>` : ''}
  </div>
  <div class="rail">${products.map((p) => productCard(ctx, p, { sizes: '(min-width: 1000px) 25vw, 70vw' }))}</div>
</section>`;
}

function hero(ctx) {
  const s = ctx.settings;
  const slide = ctx.db.prepare('SELECT * FROM slides WHERE active = 1 ORDER BY sort, id LIMIT 1').get();
  const h = slide || {
    eyebrow: s.hero_eyebrow, title: s.hero_title, subtitle: s.hero_text,
    cta1_label: s.hero_cta1_label, cta1_url: s.hero_cta1_url, cta2_label: s.hero_cta2_label, cta2_url: s.hero_cta2_url,
  };
  const img = slide ? catalog.getMedia(ctx.db, slide.media_id) : null;
  const mob = slide ? catalog.getMedia(ctx.db, slide.mobile_media_id) : null;
  const vid = slide ? catalog.getMedia(ctx.db, slide.video_media_id) : null;
  const hasMedia = Boolean(img || vid);
  return html`<section class="hero ${hasMedia ? 'hero-media' : 'hero-plain'}">
  ${hasMedia ? html`<div class="hero-bg">
    ${vid ? html`<video autoplay muted loop playsinline preload="metadata" ${img ? raw(`poster="${catalog.mediaUrl(img)}"`) : ''} src="${catalog.mediaUrl(vid)}"></video>`
      : html`<picture>${mob ? html`<source media="(max-width: 700px)" srcset="${catalog.mediaUrl(mob)}">` : ''}${picture(img, { alt: '', eager: true })}</picture>`}
  </div>` : ''}
  <div class="hero-content">
    ${h.eyebrow ? html`<p class="eyebrow">${h.eyebrow}</p>` : ''}
    <h1 class="hero-title">${h.title}</h1>
    ${h.subtitle ? html`<p class="hero-text">${h.subtitle}</p>` : ''}
    <div class="hero-ctas">
      ${h.cta1_label && safeUrl(h.cta1_url) ? html`<a class="btn btn-light" href="${safeUrl(h.cta1_url)}">${h.cta1_label}</a>` : ''}
      ${h.cta2_label && safeUrl(h.cta2_url) ? html`<a class="btn btn-outline-light" href="${safeUrl(h.cta2_url)}">${h.cta2_label}</a>` : ''}
    </div>
  </div>
  <a class="hero-scroll" href="#discover" aria-label="Scroll to discover"><span></span></a>
</section>`;
}

function collectionTiles(ctx) {
  const cols = catalog.collections(ctx.db, { navOnly: true });
  if (!cols.length) return '';
  return html`<section class="section" id="discover">
  <div class="section-head"><div><p class="eyebrow">The Collections</p><h2 class="h2">Shop the house</h2></div><a class="link-arrow" href="/shop">Shop all ${icons.arrow}</a></div>
  <div class="tiles">
    ${cols.map((c, i) => {
      const m = catalog.getMedia(ctx.db, c.media_id);
      return html`<a class="tile ${m ? 'tile-img' : `tile-plain tone-${i % 3}`}" href="/collections/${c.slug}">
        ${m ? picture(m, { alt: c.name, sizes: '(min-width: 900px) 33vw, 50vw', small: true }) : ''}
        <span class="tile-label"><span class="tile-name">${c.name}</span><span class="tile-cta">Discover</span></span>
      </a>`;
    })}
  </div>
</section>`;
}

function storyIntro(ctx) {
  const s = ctx.settings;
  const m = catalog.getMedia(ctx.db, s.story_media_id);
  return html`<section class="story">
  <div class="story-media">${m ? picture(m, { alt: s.story_title, sizes: '(min-width: 900px) 50vw, 100vw' }) : html`<img src="/assets/img/ankoo-studio-mural.webp" alt="Mural inside the ANKOO space: men in agbada in forest green and gold" loading="lazy" width="1000" height="1778">`}</div>
  <div class="story-text">
    <p class="eyebrow">The House of ANKOO</p>
    <h2 class="display">${s.story_title}</h2>
    <p class="lede">${s.story_text}</p>
    <a class="btn btn-outline" href="/about">Discover our story</a>
  </div>
</section>`;
}

function testimonials(ctx) {
  const rows = ctx.db.prepare('SELECT * FROM testimonials WHERE active = 1 ORDER BY sort, id LIMIT 6').all();
  if (!rows.length) return '';
  return html`<section class="section testimonials">
  <p class="eyebrow center">In their words</p>
  <div class="quotes">${rows.map((t) => html`<figure class="quote"><blockquote>“${t.quote}”</blockquote><figcaption>${t.name}${t.location ? html`<span>${t.location}</span>` : ''}</figcaption></figure>`)}</div>
</section>`;
}

async function instagramSection(ctx) {
  const posts = await instagram.posts(ctx.db);
  const s = ctx.settings;
  const handle = String(s.instagram_handle || '').replace(/^@/, '');
  const profile = safeUrl(s.instagram_url) || (handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : '');
  if (!posts.length && !profile) return '';
  return html`<section class="section insta">
  <div class="section-head"><div><p class="eyebrow">Instagram</p><h2 class="h2">${handle ? `@${handle}` : 'Follow ANKOO'}</h2></div>
  ${profile ? html`<a class="link-arrow" href="${profile}" target="_blank" rel="noopener">Follow us ${icons.arrow}</a>` : ''}</div>
  ${posts.length ? html`<div class="insta-grid">${posts.slice(0, 6).map((p) => html`<a href="${safeUrl(p.permalink) || profile || '#'}" target="_blank" rel="noopener" class="insta-item">
    <img src="${p.image}" alt="${p.caption ? plain(p.caption, 90) : 'ANKOO on Instagram'}" loading="lazy"></a>`)}</div>` : ''}
</section>`;
}

function newsletterBand(ctx) {
  return html`<section class="newsletter">
  <div class="narrow center">
    <p class="eyebrow">The ANKOO Letter</p>
    <h2 class="display">Be the first to know</h2>
    <p class="lede">New collections, private previews and stories from ÌTÀN ÀNKÓÒ, delivered with care.</p>
    <form class="news-form news-form-lg" method="post" action="/newsletter">${csrf(ctx)}<input type="hidden" name="source" value="home">
      <label class="sr" for="news-home">Email address</label>
      <input id="news-home" type="email" name="email" placeholder="Your email address" required autocomplete="email">
      <button class="btn btn-light" type="submit">Subscribe</button>
    </form>
  </div>
</section>`;
}

async function home(ctx) {
  const db = ctx.db;
  const featured = catalog.listProducts(db, { featured: true, limit: 8 }).products;
  let arrivals = catalog.listProducts(db, { collection: 'new-arrivals', limit: 8 }).products;
  if (!arrivals.length) arrivals = catalog.listProducts(db, { sort: 'newest', limit: 8 }).products;
  const best = catalog.bestsellers(db, 8);
  const articles = db.prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY featured DESC, published_at DESC LIMIT 3").all();
  const anyProducts = db.prepare("SELECT 1 FROM products WHERE status = 'active' LIMIT 1").get();
  const wa = whatsapp.link(ctx.settings, 'Hello ANKOO, I would like to know about your current pieces.');

  ctx.html(layout(ctx, {
    overlayHeader: true,
    canonical: '/',
    jsonld: [seo.organization(ctx), seo.website(ctx)],
    body: html`
${hero(ctx)}
<section class="manifesto"><p class="eyebrow">African heritage · Quiet luxury · Timeless elegance</p>
<p class="manifesto-text">Contemporary African fashion, shaped by premium craftsmanship and told through the stories of the culture that inspires it.</p></section>
${collectionTiles(ctx)}
${featured.length ? html`<section class="section">
  <div class="section-head"><div><p class="eyebrow">Featured</p><h2 class="h2">Signature pieces</h2></div><a class="link-arrow" href="/shop">Shop all ${icons.arrow}</a></div>
  <div class="grid">${featured.slice(0, 8).map((p) => productCard(ctx, p))}</div></section>` : ''}
${!anyProducts ? html`<section class="section arriving"><div class="narrow center">
  <p class="eyebrow">The Collection</p><h2 class="display">Our pieces are arriving online</h2>
  <p class="lede">While we prepare the online collection, our team is available for enquiries and bespoke commissions.</p>
  <p>${wa ? html`<a class="btn" href="${wa}" target="_blank" rel="noopener">${icons.whatsapp} Enquire on WhatsApp</a>` : html`<a class="btn" href="/contact">Contact us</a>`}</p></div></section>` : ''}
${rail(ctx, 'New arrivals', arrivals, '/collections/new-arrivals', 'Just in')}
${storyIntro(ctx)}
${articles.length ? html`<section class="section">
  <div class="section-head"><div><p class="eyebrow">The Journal</p><h2 class="h2">Stories from the house</h2></div><a class="link-arrow" href="/journal">Read the journal ${icons.arrow}</a></div>
  <div class="articles">${articles.map((a) => articleCard(ctx, a))}</div></section>` : ''}
${rail(ctx, 'Bestsellers', best, '/shop', 'Most loved')}
${testimonials(ctx)}
${await instagramSection(ctx)}
${newsletterBand(ctx)}`,
  }));
}

function filtersForm(ctx, { collection, f, facets, cols }) {
  const sel = (a, b) => (String(a) === String(b) ? raw('selected') : '');
  const chk = (a, b) => (String(a) === String(b) ? raw('checked') : '');
  const action = collection ? `/collections/${collection.slug}` : '/shop';
  return html`<form class="filters" method="get" action="${action}" data-filters>
  ${f.q ? html`<input type="hidden" name="q" value="${f.q}">` : ''}
  ${!collection && cols.length ? html`<fieldset><legend>Category</legend>
    <label class="opt"><input type="radio" name="category" value="" ${chk(f.category, '')}> All</label>
    ${cols.map((c) => html`<label class="opt"><input type="radio" name="category" value="${c.slug}" ${chk(f.category, c.slug)}> ${c.name}</label>`)}
  </fieldset>` : ''}
  ${facets.sizes.length ? html`<fieldset><legend>Size</legend><div class="pills">
    <label class="pill"><input type="radio" name="size" value="" ${chk(f.size, '')}><span>All</span></label>
    ${facets.sizes.map((s) => html`<label class="pill"><input type="radio" name="size" value="${s}" ${chk(f.size, s)}><span>${s}</span></label>`)}
  </div></fieldset>` : ''}
  ${facets.colours.length ? html`<fieldset><legend>Colour</legend>
    <label class="opt"><input type="radio" name="colour" value="" ${chk(f.colour, '')}> All</label>
    ${facets.colours.map((c) => html`<label class="opt"><input type="radio" name="colour" value="${c}" ${chk(f.colour, c)}> ${c}</label>`)}
  </fieldset>` : ''}
  <fieldset><legend>Price (₦)</legend><div class="price-range">
    <label><span class="sr">Minimum price</span><input type="number" inputmode="numeric" name="min" min="0" placeholder="Min" value="${f.min}"></label>
    <span>to</span>
    <label><span class="sr">Maximum price</span><input type="number" inputmode="numeric" name="max" min="0" placeholder="Max" value="${f.max}"></label>
  </div></fieldset>
  <fieldset><legend>Availability</legend><label class="opt"><input type="checkbox" name="instock" value="1" ${chk(f.instock, '1')}> In stock or made to order</label></fieldset>
  <fieldset><legend>Sort by</legend><select name="sort" aria-label="Sort by">
    <option value="" ${sel(f.sort, '')}>Curated</option><option value="newest" ${sel(f.sort, 'newest')}>Newest</option>
    <option value="price-asc" ${sel(f.sort, 'price-asc')}>Price: low to high</option><option value="price-desc" ${sel(f.sort, 'price-desc')}>Price: high to low</option>
  </select></fieldset>
  <div class="filter-actions"><button class="btn btn-block" type="submit">Apply</button><a class="btn btn-ghost btn-block" href="${action}">Clear</a></div>
</form>`;
}

function listing(ctx, collection) {
  const q = ctx.query;
  const f = {
    q: str(q.q, 80), category: collection ? collection.slug : str(q.category, 80), size: str(q.size, 40),
    colour: str(q.colour, 40), min: str(q.min, 12).replace(/\D/g, ''), max: str(q.max, 12).replace(/\D/g, ''),
    sort: str(q.sort, 20), instock: q.instock === '1' ? '1' : '',
  };
  const page = int(q.page, 1, 1, 500);
  const { total, products } = catalog.listProducts(ctx.db, {
    collection: f.category || undefined, size: f.size || undefined, colour: f.colour || undefined,
    minKobo: f.min ? Number(f.min) * 100 : undefined, maxKobo: f.max ? Number(f.max) * 100 : undefined,
    q: f.q || undefined, sort: f.sort, inStock: f.instock === '1', limit: PER_PAGE, offset: (page - 1) * PER_PAGE,
  });
  const facets = catalog.facets(ctx.db, collection ? collection.slug : undefined);
  const cols = catalog.collections(ctx.db);
  const pages = Math.ceil(total / PER_PAGE);
  const active = [f.size, f.colour, f.min, f.max, f.instock, !collection && f.category].filter(Boolean).length;
  const title = collection ? collection.name : (f.q ? `Search: ${f.q}` : 'The Collection');
  const banner = collection ? catalog.getMedia(ctx.db, collection.media_id) : null;
  const pageLink = (n) => { const u = new URLSearchParams({ ...ctx.query, page: n }); return `${ctx.path}?${u}`; };
  const wa = whatsapp.link(ctx.settings, `Hello ANKOO, I would like to ask about ${collection ? `the ${collection.name} collection` : 'your collection'}.`);
  const filtered = active > 0 || f.q || page > 1;

  ctx.html(layout(ctx, {
    title: collection ? (collection.seo_title || `${collection.name} Collection`) : (f.q ? `Search results for “${f.q}”` : 'Shop the Collection'),
    description: collection ? (collection.seo_description || plain(collection.description) || `Shop the ANKOO ${collection.name} collection.`) : 'Shop ANKOO: contemporary African luxury fashion, ready-to-wear and bespoke pieces, from Akure and Lagos.',
    canonical: collection ? `/collections/${collection.slug}` : '/shop',
    noindex: Boolean(f.q) || active > 0,
    image: banner ? catalog.mediaUrl(banner) : undefined,
    jsonld: [seo.breadcrumbs(ctx, [['Shop', '/shop'], ...(collection ? [[collection.name, `/collections/${collection.slug}`]] : [])]),
      ...(products.length ? [seo.itemList(ctx, products)] : [])],
    body: html`
<section class="page-head ${banner ? 'page-head-img' : ''}">
  ${banner ? html`<div class="page-head-bg">${picture(banner, { alt: '', eager: true })}</div>` : ''}
  <div class="page-head-inner">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>${collection ? html`<a href="/shop">Shop</a><span>/</span><span>${collection.name}</span>` : html`<span>Shop</span>`}</nav>
    <h1 class="display">${title}</h1>
    ${collection && collection.description ? html`<div class="lede">${raw(markdown(collection.description))}</div>` : ''}
  </div>
</section>
<div class="shop">
  <aside class="shop-aside">
    <details class="filter-toggle" ${raw('data-filter-details')}>
      <summary><span>Filter &amp; sort${active ? html` <b>(${active})</b>` : ''}</span><span class="count">${total} ${total === 1 ? 'piece' : 'pieces'}</span></summary>
      ${filtersForm(ctx, { collection, f, facets, cols })}
    </details>
  </aside>
  <div class="shop-main">
    ${products.length ? html`<div class="grid">${products.map((p) => productCard(ctx, p))}</div>
    ${pages > 1 ? html`<nav class="pager" aria-label="Pages">${page > 1 ? html`<a href="${pageLink(page - 1)}" rel="prev">Previous</a>` : ''}<span>Page ${page} of ${pages}</span>${page < pages ? html`<a href="${pageLink(page + 1)}" rel="next">Next</a>` : ''}</nav>` : ''}`
      : html`<div class="empty">
        <h2 class="h2">${filtered ? 'No pieces match your selection' : 'This collection is being prepared'}</h2>
        <p>${filtered ? 'Try removing a filter, or speak with us about a bespoke piece.' : 'New pieces are on their way. Our team can help with enquiries and bespoke commissions in the meantime.'}</p>
        <p>${filtered ? html`<a class="btn btn-outline" href="${ctx.path}">Clear filters</a> ` : ''}${wa ? html`<a class="btn" href="${wa}" target="_blank" rel="noopener">${icons.whatsapp} Ask on WhatsApp</a>` : ''}</p>
      </div>`}
  </div>
</div>`,
  }));
}

function productPage(ctx) {
  const db = ctx.db;
  const p = catalog.getProduct(db, { slug: ctx.params.slug });
  if (!p) throw new HttpError(404, 'Page not found');
  const a = catalog.availability(p, ctx.settings.low_stock_threshold);
  const rel = catalog.related(db, p, 4);
  const inWish = ctx.user && db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?').get(ctx.user.id, p.id);
  const variants = p.variants.filter((v) => v.active).map((v) => ({ id: v.id, size: v.size, colour: v.colour, stock: v.stock }));
  const waText = `Hello ANKOO, I am interested in "${p.name}" (${ctx.site}/product/${p.slug}).`;
  const wa = whatsapp.link(ctx.settings, waText);
  const soldOut = a.key === 'out';
  const ship = ctx.db.prepare('SELECT body FROM pages WHERE slug = ?').get('shipping');
  const primaryCol = p.collections.find((c) => c.slug !== 'new-arrivals') || p.collections[0];

  ctx.html(layout(ctx, {
    title: p.seo_title || p.name,
    description: p.seo_description || plain(p.description) || `${p.name} by ANKOO. ${naira(p.price_kobo)}.`,
    image: p.images[0] ? catalog.mediaUrl(p.images[0]) : undefined,
    ogType: 'product',
    ogExtra: html`<meta property="product:price:amount" content="${(p.price_kobo / 100).toFixed(2)}"><meta property="product:price:currency" content="NGN"><meta property="product:availability" content="${soldOut ? 'out of stock' : 'in stock'}"><meta property="product:retailer_item_id" content="${String(p.id)}">`,
    jsonld: [seo.product(ctx, p, a), seo.breadcrumbs(ctx, [['Shop', '/shop'], ...(primaryCol ? [[primaryCol.name, `/collections/${primaryCol.slug}`]] : []), [p.name, `/product/${p.slug}`]])],
    track: { event: 'ViewContent', id: p.id, name: p.name, value: p.price_kobo / 100, currency: 'NGN' },
    waText,
    bodyClass: 'pdp-page',
    body: html`
<nav class="crumbs crumbs-pdp" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/shop">Shop</a>${primaryCol ? html`<span>/</span><a href="/collections/${primaryCol.slug}">${primaryCol.name}</a>` : ''}<span>/</span><span>${p.name}</span></nav>
<div class="pdp">
  <div class="gallery" data-gallery>
    <div class="gallery-track">
      ${p.images.length ? p.images.map((m, i) => html`<figure class="gallery-item">${picture(m, { alt: m.alt || `${p.name}, view ${i + 1}`, sizes: '(min-width: 900px) 55vw, 100vw', eager: i === 0 })}</figure>`)
        : html`<figure class="gallery-item"><span class="card-placeholder">${ctx.settings.brand_name}</span></figure>`}
    </div>
    ${p.images.length > 1 ? html`<div class="gallery-dots" aria-hidden="true">${p.images.map((m, i) => html`<span class="${i === 0 ? 'on' : ''}"></span>`)}</div>` : ''}
  </div>
  <div class="pdp-info">
    <div class="pdp-sticky">
      ${primaryCol ? html`<p class="eyebrow"><a href="/collections/${primaryCol.slug}">${primaryCol.name}</a></p>` : ''}
      <h1 class="pdp-title">${p.name}</h1>
      ${p.subtitle ? html`<p class="pdp-sub">${p.subtitle}</p>` : ''}
      <p class="pdp-price">${price(ctx, p.price_kobo)}${p.compare_at_kobo > p.price_kobo ? html` <s>${naira(p.compare_at_kobo)}</s>` : ''}</p>
      <p class="avail avail-${a.key}" data-avail>${a.label}</p>

      <form class="buy" method="post" action="/cart/add" data-buy>
        ${csrf(ctx)}<input type="hidden" name="product_id" value="${p.id}">
        <script type="application/json" nonce="${ctx.nonce}" data-variants>${raw(JSON.stringify({ made: !!p.made_to_order, variants }).replace(/</g, '\\u003c'))}</script>
        ${p.colours.length ? html`<fieldset class="opt-group"><legend>Colour <span data-colour-label></span></legend><div class="pills">
          ${p.colours.map((c, i) => html`<label class="pill"><input type="radio" name="colour" value="${c}" ${p.colours.length === 1 || i === 0 ? raw('checked') : ''} required><span>${c}</span></label>`)}
        </div></fieldset>` : html`<input type="hidden" name="colour" value="">`}
        ${p.sizes.length && p.sizes.some(Boolean) ? html`<fieldset class="opt-group"><legend>Size <a class="size-guide" href="/pages/size-guide">Size guide</a></legend><div class="pills">
          ${p.sizes.map((s) => html`<label class="pill"><input type="radio" name="size" value="${s}" ${p.sizes.length === 1 ? raw('checked') : ''} required><span>${s}</span></label>`)}
        </div></fieldset>` : html`<input type="hidden" name="size" value="">`}
        <div class="qty-row">
          <div class="qty" data-qty><button type="button" aria-label="Decrease quantity" data-step="-1">${icons.minus}</button><input type="number" name="qty" value="1" min="1" max="${commerce.MAX_QTY}" inputmode="numeric" aria-label="Quantity"><button type="button" aria-label="Increase quantity" data-step="1">${icons.plus}</button></div>
          <button class="btn btn-block btn-add" type="submit" ${soldOut ? raw('disabled') : ''} data-add>${soldOut ? 'Sold out' : 'Add to bag'}</button>
        </div>
        <p class="form-msg" data-buy-msg role="status" aria-live="polite"></p>
      </form>
      <div class="pdp-secondary">
        <form method="post" action="/wishlist/${p.id}">${csrf(ctx)}<button class="btn btn-ghost btn-block" type="submit">${icons.heart} ${inWish ? 'Saved to wishlist' : 'Save to wishlist'}</button></form>
        ${wa ? html`<a class="btn btn-ghost btn-block" href="${wa}" target="_blank" rel="noopener">${icons.whatsapp} ${p.made_to_order ? 'Discuss a bespoke fitting' : 'Ask about this piece'}</a>` : ''}
      </div>
      <div class="accordion">
        ${p.description ? html`<details open><summary>Description</summary><div class="prose">${raw(markdown(p.description))}</div></details>` : ''}
        ${p.details ? html`<details><summary>Fabric &amp; details</summary><div class="prose">${raw(markdown(p.details))}</div></details>` : ''}
        ${p.care ? html`<details><summary>Care</summary><div class="prose">${raw(markdown(p.care))}</div></details>` : ''}
        <details><summary>Delivery</summary><div class="prose">${raw(markdown(ship ? ship.body : ''))}<p><a href="/pages/shipping">Delivery information</a></p></div></details>
        <details><summary>Returns</summary><div class="prose"><p>${ctx.settings.returns_policy}</p><p><a href="/pages/returns">Returns policy</a></p></div></details>
      </div>
    </div>
  </div>
</div>
${rel.length ? html`<section class="section"><div class="section-head"><div><p class="eyebrow">You may also like</p><h2 class="h2">Complete the look</h2></div></div>
<div class="grid">${rel.map((r) => productCard(ctx, r))}</div></section>` : ''}
<div class="mobile-buy" data-mobile-buy><span>${p.name}<b>${naira(p.price_kobo)}</b></span><button class="btn" type="button" data-scroll-buy ${soldOut ? raw('disabled') : ''}>${soldOut ? 'Sold out' : 'Add to bag'}</button></div>`,
  }));
}

function cartPage(ctx) {
  const cart = commerce.loadCart(ctx.db, ctx.cartId);
  const q = commerce.quote(ctx.db, cart);
  const lines = cart.items.map((i) => `• ${i.name}${i.size ? ` (${i.size})` : ''}${i.colour ? ` ${i.colour}` : ''} × ${i.qty}: ${naira(i.line_kobo)}`).join('\n');
  const wa = cart.items.length ? whatsapp.link(ctx.settings, `Hello ANKOO, I would like to order:\n${lines}\nSubtotal: ${naira(cart.subtotal)}`) : '';
  ctx.html(layout(ctx, {
    title: 'Your bag', noindex: true,
    body: html`<section class="page-head page-head-sm"><div class="page-head-inner"><h1 class="display">Your bag</h1></div></section>
${cart.items.length ? html`<div class="cart">
  <div class="cart-items">
    ${cart.items.map((i) => html`<div class="cart-line">
      <a class="cart-thumb" href="/product/${i.slug}">${i.image ? picture(i.image, { alt: i.name, sizes: '120px', small: true }) : ''}</a>
      <div class="cart-info">
        <a class="cart-name" href="/product/${i.slug}">${i.name}</a>
        <p class="muted">${[i.size && `Size ${i.size}`, i.colour].filter(Boolean).join(' · ')}${i.made_to_order ? ' · Made to order' : ''}</p>
        ${i.issue ? html`<p class="error-text">${i.issue}</p>` : ''}
        <div class="cart-actions">
          <form method="post" action="/cart/update" class="qty-form">${csrf(ctx)}<input type="hidden" name="item" value="${i.item_id}">
            <label class="sr" for="q${i.item_id}">Quantity</label>
            <select id="q${i.item_id}" name="qty" data-autosubmit>${Array.from({ length: Math.max(i.qty, i.made_to_order ? 10 : Math.min(10, Math.max(1, i.stock))) }, (_, n) => n + 1).map((n) => html`<option value="${n}" ${n === i.qty ? raw('selected') : ''}>${n}</option>`)}</select>
            <noscript><button class="link" type="submit">Update</button></noscript>
          </form>
          <form method="post" action="/cart/update">${csrf(ctx)}<input type="hidden" name="item" value="${i.item_id}"><input type="hidden" name="qty" value="0"><button class="link" type="submit">Remove</button></form>
        </div>
      </div>
      <div class="cart-price">${naira(i.line_kobo)}</div>
    </div>`)}
  </div>
  <aside class="summary">
    <h2 class="h3">Summary</h2>
    <form class="discount-form" method="post" action="/cart/discount">${csrf(ctx)}
      <label for="code">Discount code</label>
      <div class="inline-field"><input id="code" name="code" value="${cart.discount_code || ''}" autocomplete="off" autocapitalize="characters"><button class="btn btn-outline btn-sm" type="submit">Apply</button></div>
      ${q.discountError && cart.discount_code ? html`<p class="error-text">${q.discountError}</p>` : ''}
    </form>
    <dl class="totals">
      <div><dt>Subtotal</dt><dd>${naira(q.subtotal)}</dd></div>
      ${q.discountKobo ? html`<div><dt>Discount (${q.discount.code})</dt><dd>−${naira(q.discountKobo)}</dd></div>` : ''}
      ${q.discount && q.discount.kind === 'free_shipping' ? html`<div><dt>Delivery</dt><dd>Free (${q.discount.code})</dd></div>` : html`<div><dt>Delivery</dt><dd class="muted">Calculated at checkout</dd></div>`}
      <div class="total"><dt>Estimated total</dt><dd>${naira(q.subtotal - q.discountKobo)}</dd></div>
    </dl>
    <a class="btn btn-block" href="/checkout">Proceed to checkout</a>
    ${wa ? html`<a class="btn btn-ghost btn-block" href="${wa}" target="_blank" rel="noopener">${icons.whatsapp} Order via WhatsApp</a>` : ''}
    <p class="fine">Secure payment by Paystack. ${ctx.settings.returns_policy}</p>
  </aside>
</div>` : html`<div class="empty narrow center"><h2 class="h2">Your bag is empty</h2><p>Discover pieces shaped by heritage and made with care.</p><p><a class="btn" href="/shop">Explore the collection</a></p></div>`}`,
  }));
}

function resolveVariant(db, productId, size, colour) {
  return db.prepare('SELECT * FROM variants WHERE product_id = ? AND size = ? AND colour = ? AND active = 1').get(productId, size, colour)
    || null;
}

module.exports = function register(app) {
  app.get('/', home);
  app.get('/shop', listing);
  app.get('/collections/:slug', (ctx) => {
    const c = ctx.db.prepare('SELECT * FROM collections WHERE slug = ? AND active = 1').get(ctx.params.slug);
    if (!c) throw new HttpError(404, 'Page not found');
    listing(ctx, c);
  });
  app.get('/product/:slug', productPage);
  app.get('/cart', cartPage);

  app.post('/cart/add', (ctx) => {
    const b = ctx.body;
    const productId = int(b.product_id);
    let v = null;
    if (b.variant_id) v = ctx.db.prepare('SELECT * FROM variants WHERE id = ? AND product_id = ?').get(int(b.variant_id), productId);
    else v = resolveVariant(ctx.db, productId, str(b.size, 40), str(b.colour, 40));
    if (!v) {
      const p = catalog.getProduct(ctx.db, { id: productId });
      if (!p) throw new HttpError(400, 'This piece is not available.');
      throw new HttpError(400, p.sizes.some(Boolean) && !b.size ? 'Please choose a size.' : 'This option is not available.');
    }
    const cartId = ctx.ensureCart();
    commerce.addItem(ctx.db, cartId, v.id, int(b.qty, 1, 1, commerce.MAX_QTY));
    const p = ctx.db.prepare('SELECT name, price_kobo FROM products WHERE id = ?').get(productId);
    if (ctx.isJson) return ctx.json({ ok: true, count: ctx.cartCount(), message: `${p.name} has been added to your bag.`, track: { id: productId, value: p.price_kobo / 100 } });
    ctx.redirect('/cart', { type: 'success', message: `${p.name} has been added to your bag.` });
  });
  app.post('/cart/update', (ctx) => {
    if (ctx.cartId) commerce.setQty(ctx.db, ctx.cartId, int(ctx.body.item), int(ctx.body.qty, 0, 0, commerce.MAX_QTY));
    ctx.redirect('/cart');
  });
  app.post('/cart/discount', (ctx) => {
    const code = str(ctx.body.code, 40).toUpperCase();
    const cartId = ctx.ensureCart();
    if (!code) { ctx.db.prepare('UPDATE carts SET discount_code = NULL WHERE id = ?').run(cartId); return ctx.redirect('/cart'); }
    const cart = commerce.loadCart(ctx.db, cartId);
    const r = commerce.checkDiscount(ctx.db, code, cart.subtotal);
    if (r.error) return ctx.redirect('/cart', { type: 'error', message: r.error });
    ctx.db.prepare('UPDATE carts SET discount_code = ? WHERE id = ?').run(r.discount.code, cartId);
    ctx.redirect('/cart', { type: 'success', message: `Code ${r.discount.code} applied.` });
  });
  app.post('/wishlist/:id', (ctx) => {
    if (!ctx.user) return ctx.redirect(`/login?next=${encodeURIComponent('/account/wishlist')}`, { type: 'info', message: 'Sign in to save pieces to your wishlist.' });
    const pid = int(ctx.params.id);
    const p = ctx.db.prepare('SELECT slug FROM products WHERE id = ?').get(pid);
    if (!p) throw new HttpError(404, 'Page not found');
    const has = ctx.db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?').get(ctx.user.id, pid);
    if (has) ctx.db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(ctx.user.id, pid);
    else ctx.db.prepare('INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, ?)').run(ctx.user.id, pid, new Date().toISOString());
    const back = ctx.body.back === 'wishlist' ? '/account/wishlist' : `/product/${p.slug}`;
    ctx.redirect(back, { type: 'success', message: has ? 'Removed from your wishlist.' : 'Saved to your wishlist.' });
  });
  app.post('/currency', (ctx) => {
    const cur = str(ctx.body.cur, 3).toUpperCase();
    ctx.setCookie('cur', /^[A-Z]{3}$/.test(cur) ? cur : 'NGN', { maxAge: 60 * 60 * 24 * 365, httpOnly: false });
    const ref = String(ctx.req.headers.referer || '/');
    let back = '/';
    try { const u = new URL(ref); if (u.host === ctx.req.headers.host) back = u.pathname + u.search; } catch { /* default */ }
    ctx.redirect(back);
  });
};
