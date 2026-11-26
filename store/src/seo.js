'use strict';
// Structured data (schema.org JSON-LD), sitemap, robots.txt and the Meta/Google product feed.
const catalog = require('./catalog');
const { plain } = require('./markdown');
const { csv } = require('./util');

const abs = (ctx, u) => (u ? (u.startsWith('http') ? u : `${ctx.site}${u}`) : undefined);

function sameAs(s) {
  return [s.instagram_url, s.facebook_url, s.tiktok_url, s.youtube_url].filter((u) => /^https?:\/\//.test(u || ''));
}
function organization(ctx) {
  const s = ctx.settings;
  const logo = catalog.getMedia(ctx.db, s.logo_media_id);
  const o = {
    '@context': 'https://schema.org', '@type': 'ClothingStore', name: s.brand_name || 'ANKOO', url: ctx.site,
    description: s.seo_description, sameAs: sameAs(s),
    address: (s.locations || []).map((l) => ({ '@type': 'PostalAddress', addressLocality: l.city, streetAddress: l.address || undefined, addressCountry: 'NG' })),
    currenciesAccepted: 'NGN',
  };
  if (logo) o.logo = abs(ctx, catalog.mediaUrl(logo));
  if (s.business_email) o.email = s.business_email;
  return o;
}
function website(ctx) {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: ctx.settings.brand_name || 'ANKOO', url: ctx.site,
    potentialAction: { '@type': 'SearchAction', target: `${ctx.site}/shop?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
}
function breadcrumbs(ctx, items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'], ...items].map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(ctx, url) })),
  };
}
function product(ctx, p, availability) {
  const avail = { in: 'InStock', low: 'LimitedAvailability', out: 'OutOfStock', made: 'MadeToOrder' }[availability.key];
  return {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, description: plain(p.description, 5000) || p.name,
    image: p.images.map((m) => abs(ctx, catalog.mediaUrl(m))),
    sku: String(p.id), productID: String(p.id),
    brand: { '@type': 'Brand', name: ctx.settings.brand_name || 'ANKOO' },
    category: p.collections.map((c) => c.name).join(', ') || undefined,
    color: p.colours.length ? p.colours.join(', ') : undefined,
    size: p.sizes.filter(Boolean).length ? p.sizes.join(', ') : undefined,
    offers: {
      '@type': 'Offer', url: `${ctx.site}/product/${p.slug}`, priceCurrency: 'NGN', price: (p.price_kobo / 100).toFixed(2),
      availability: `https://schema.org/${avail}`, itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: ctx.settings.brand_name || 'ANKOO' },
    },
  };
}
function itemList(ctx, products) {
  return {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ctx.site}/product/${p.slug}` })),
  };
}
function article(ctx, a, cover) {
  return {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.excerpt || plain(a.body),
    datePublished: a.published_at, dateModified: a.updated_at, image: cover ? [abs(ctx, catalog.mediaUrl(cover))] : undefined,
    author: { '@type': 'Organization', name: ctx.settings.brand_name || 'ANKOO' },
    publisher: { '@type': 'Organization', name: ctx.settings.brand_name || 'ANKOO' },
    mainEntityOfPage: `${ctx.site}/journal/${a.slug}`,
  };
}

function sitemap(ctx) {
  const db = ctx.db;
  const urls = [['/', null, '1.0'], ['/shop', null, '0.9'], ['/about', null, '0.7'], ['/journal', null, '0.7'], ['/contact', null, '0.5']];
  for (const c of db.prepare('SELECT slug FROM collections WHERE active = 1').all()) urls.push([`/collections/${c.slug}`, null, '0.8']);
  for (const p of db.prepare("SELECT slug, updated_at FROM products WHERE status = 'active'").all()) urls.push([`/product/${p.slug}`, p.updated_at, '0.8']);
  for (const a of db.prepare("SELECT slug, updated_at FROM articles WHERE status = 'published'").all()) urls.push([`/journal/${a.slug}`, a.updated_at, '0.6']);
  for (const pg of db.prepare("SELECT slug, updated_at FROM pages WHERE slug != 'about'").all()) urls.push([`/pages/${pg.slug}`, pg.updated_at, '0.3']);
  const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, mod, pr]) => `  <url><loc>${x(ctx.site + u)}</loc>${mod ? `<lastmod>${mod.slice(0, 10)}</lastmod>` : ''}<priority>${pr}</priority></url>`).join('\n')}
</urlset>`;
}
function robots(ctx) {
  return `User-agent: *
Disallow: /admin
Disallow: /account
Disallow: /cart
Disallow: /checkout
Disallow: /order/
Disallow: /login
Disallow: /register
Disallow: /*?*q=
Allow: /

Sitemap: ${ctx.site}/sitemap.xml
`;
}

// Product catalogue feed for Meta Commerce Manager (Instagram/Facebook shops, dynamic ads) and Google Merchant Center.
function productFeed(ctx) {
  const db = ctx.db;
  const rows = db.prepare("SELECT * FROM products WHERE status = 'active' ORDER BY id").all();
  const products = catalog.decorate(db, rows);
  const out = [['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'additional_image_link', 'brand', 'item_group_id', 'size', 'color', 'product_type']];
  for (const p of products) {
    const cols = db.prepare('SELECT c.name FROM collections c JOIN product_collections pc ON pc.collection_id = c.id WHERE pc.product_id = ? ORDER BY c.sort').all(p.id).map((c) => c.name);
    const variants = db.prepare('SELECT * FROM variants WHERE product_id = ? AND active = 1').all(p.id);
    const img = p.images[0] ? abs(ctx, catalog.mediaUrl(p.images[0])) : '';
    if (!img) continue; // Meta and Google reject items without an image
    const extra = p.images.slice(1, 10).map((m) => abs(ctx, catalog.mediaUrl(m))).join(',');
    for (const v of variants) {
      const inStock = p.made_to_order || v.stock > 0;
      out.push([
        `${p.id}-${v.id}`, p.name, plain(p.description, 4900) || p.name, inStock ? 'in stock' : 'out of stock', 'new',
        `${(p.price_kobo / 100).toFixed(2)} NGN`, `${ctx.site}/product/${p.slug}`, img, extra, ctx.settings.brand_name || 'ANKOO',
        String(p.id), v.size, v.colour, cols.join(' > '),
      ]);
    }
  }
  return csv(out);
}

module.exports = { organization, website, breadcrumbs, product, itemList, article, sitemap, robots, productFeed };
