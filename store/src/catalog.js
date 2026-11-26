'use strict';
// Read-side catalogue queries shared by the storefront, SEO and admin.

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'ONE SIZE', 'BESPOKE'];
function sizeRank(s) {
  const u = String(s).toUpperCase();
  const i = SIZE_ORDER.indexOf(u);
  if (i >= 0) return i;
  const n = parseFloat(u);
  return Number.isFinite(n) ? 100 + n : 1000;
}
function sortSizes(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));
}

function mediaUrl(m, small = false) {
  if (!m) return '';
  if (m.url) return m.url;
  const f = small && m.file_sm ? m.file_sm : m.file;
  return f ? `/media/${f}` : '';
}
function getMedia(db, id) {
  return id ? db.prepare('SELECT * FROM media WHERE id = ?').get(id) || null : null;
}

function imagesFor(db, productIds) {
  const map = new Map();
  if (!productIds.length) return map;
  const rows = db.prepare(`SELECT pi.product_id, m.* FROM product_images pi JOIN media m ON m.id = pi.media_id
    WHERE pi.product_id IN (${productIds.map(() => '?').join(',')}) ORDER BY pi.position, pi.id`).all(...productIds);
  for (const r of rows) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push(r);
  }
  return map;
}
function stockFor(db, productIds) {
  const map = new Map();
  if (!productIds.length) return map;
  const rows = db.prepare(`SELECT product_id, SUM(CASE WHEN stock > 0 THEN stock ELSE 0 END) AS stock, COUNT(*) AS n
    FROM variants WHERE active = 1 AND product_id IN (${productIds.map(() => '?').join(',')}) GROUP BY product_id`).all(...productIds);
  for (const r of rows) map.set(r.product_id, r.stock);
  return map;
}
function decorate(db, products) {
  const ids = products.map((p) => p.id);
  const imgs = imagesFor(db, ids);
  const stock = stockFor(db, ids);
  return products.map((p) => ({ ...p, images: imgs.get(p.id) || [], stock: stock.get(p.id) || 0 }));
}

function availability(p, lowThreshold = 3) {
  if (p.made_to_order) return { key: 'made', label: 'Made to order' };
  if (p.stock <= 0) return { key: 'out', label: 'Sold out' };
  if (p.stock <= lowThreshold) return { key: 'low', label: `Only ${p.stock} left` };
  return { key: 'in', label: 'In stock' };
}

function listProducts(db, opts = {}) {
  const where = ["p.status = 'active'"];
  const args = [];
  if (opts.collection) {
    where.push('p.id IN (SELECT pc.product_id FROM product_collections pc JOIN collections c ON c.id = pc.collection_id WHERE c.slug = ?)');
    args.push(opts.collection);
  }
  if (opts.size) { where.push('p.id IN (SELECT product_id FROM variants WHERE active = 1 AND size = ?)'); args.push(opts.size); }
  if (opts.colour) { where.push('p.id IN (SELECT product_id FROM variants WHERE active = 1 AND colour = ? COLLATE NOCASE)'); args.push(opts.colour); }
  if (Number.isFinite(opts.minKobo)) { where.push('p.price_kobo >= ?'); args.push(opts.minKobo); }
  if (Number.isFinite(opts.maxKobo)) { where.push('p.price_kobo <= ?'); args.push(opts.maxKobo); }
  if (opts.inStock) where.push('(p.made_to_order = 1 OR p.id IN (SELECT product_id FROM variants WHERE active = 1 AND stock > 0))');
  if (opts.featured) where.push('p.featured = 1');
  if (opts.q) {
    where.push("(p.name LIKE ? ESCAPE '\\' OR p.subtitle LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    const like = `%${String(opts.q).replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    args.push(like, like, like);
  }
  if (opts.excludeId) { where.push('p.id != ?'); args.push(opts.excludeId); }
  const order = {
    'price-asc': 'p.price_kobo ASC', 'price-desc': 'p.price_kobo DESC', newest: 'p.created_at DESC',
  }[opts.sort] || 'p.sort ASC, p.created_at DESC';
  const sqlWhere = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${sqlWhere}`).get(...args).n;
  const rows = db.prepare(`SELECT p.* FROM products p WHERE ${sqlWhere} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...args, opts.limit || 24, opts.offset || 0);
  return { total, products: decorate(db, rows) };
}

function bestsellers(db, limit = 8) {
  const rows = db.prepare(`SELECT p.*, COALESCE(s.units, 0) AS units FROM products p
    LEFT JOIN (SELECT oi.product_id, SUM(oi.qty) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.paid_at IS NOT NULL AND o.status != 'cancelled' GROUP BY oi.product_id) s ON s.product_id = p.id
    WHERE p.status = 'active' AND (p.bestseller = 1 OR s.units > 0)
    ORDER BY p.bestseller DESC, units DESC LIMIT ?`).all(limit);
  return decorate(db, rows);
}

function getProduct(db, { slug, id, includeDraft = false }) {
  const p = slug ? db.prepare('SELECT * FROM products WHERE slug = ?').get(slug) : db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p || (!includeDraft && p.status !== 'active')) return null;
  const [d] = decorate(db, [p]);
  d.variants = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY id').all(p.id);
  d.sizes = sortSizes(d.variants.filter((v) => v.active).map((v) => v.size));
  d.colours = [...new Set(d.variants.filter((v) => v.active && v.colour).map((v) => v.colour))];
  d.collections = db.prepare(`SELECT c.* FROM collections c JOIN product_collections pc ON pc.collection_id = c.id
    WHERE pc.product_id = ? ORDER BY c.sort`).all(p.id);
  return d;
}

function related(db, product, limit = 4) {
  const ids = product.collections.map((c) => c.id);
  let rows = [];
  if (ids.length) {
    rows = db.prepare(`SELECT DISTINCT p.* FROM products p JOIN product_collections pc ON pc.product_id = p.id
      WHERE p.status = 'active' AND p.id != ? AND pc.collection_id IN (${ids.map(() => '?').join(',')})
      ORDER BY p.featured DESC, p.created_at DESC LIMIT ?`).all(product.id, ...ids, limit);
  }
  if (rows.length < limit) {
    const have = [product.id, ...rows.map((r) => r.id)];
    rows = rows.concat(db.prepare(`SELECT * FROM products WHERE status = 'active' AND id NOT IN (${have.map(() => '?').join(',')})
      ORDER BY featured DESC, created_at DESC LIMIT ?`).all(...have, limit - rows.length));
  }
  return decorate(db, rows);
}

function facets(db, collection) {
  const scope = collection
    ? `AND p.id IN (SELECT pc.product_id FROM product_collections pc JOIN collections c ON c.id = pc.collection_id WHERE c.slug = ?)`
    : '';
  const args = collection ? [collection] : [];
  const vs = db.prepare(`SELECT DISTINCT v.size, v.colour FROM variants v JOIN products p ON p.id = v.product_id
    WHERE p.status = 'active' AND v.active = 1 ${scope}`).all(...args);
  const range = db.prepare(`SELECT MIN(price_kobo) AS min, MAX(price_kobo) AS max FROM products p WHERE p.status = 'active' ${scope}`).get(...args);
  return {
    sizes: sortSizes(vs.map((v) => v.size)),
    colours: [...new Set(vs.map((v) => v.colour).filter(Boolean))].sort(),
    min: range.min || 0, max: range.max || 0,
  };
}

function collections(db, { navOnly = false } = {}) {
  return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM product_collections pc JOIN products p ON p.id = pc.product_id
      WHERE pc.collection_id = c.id AND p.status = 'active') AS product_count
    FROM collections c WHERE c.active = 1 ${navOnly ? 'AND c.show_in_nav = 1' : ''} ORDER BY c.sort, c.name`).all();
}

module.exports = { listProducts, bestsellers, getProduct, related, facets, collections, availability, mediaUrl, getMedia, sortSizes, decorate };
