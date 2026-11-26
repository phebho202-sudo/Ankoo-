'use strict';
// Instagram section: live posts through the Instagram API (with INSTAGRAM_ACCESS_TOKEN),
// otherwise posts curated in Admin → Instagram.
const config = require('./config');
const catalog = require('./catalog');

let cache = { at: 0, posts: [] };

async function live() {
  if (!config.instagramToken) return [];
  if (Date.now() - cache.at < 60 * 60 * 1000) return cache.posts;
  try {
    const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=12&access_token=${encodeURIComponent(config.instagramToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ? json.error.message : res.status);
    cache = {
      at: Date.now(),
      posts: (json.data || []).map((m) => ({ image: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url, permalink: m.permalink, caption: m.caption || '' }))
        .filter((p) => p.image),
    };
  } catch (e) {
    console.error('Instagram feed unavailable:', e.message);
    cache = { at: Date.now() - 50 * 60 * 1000, posts: cache.posts }; // retry in ~10 minutes
  }
  return cache.posts;
}

async function posts(db) {
  const l = await live();
  if (l.length) return l;
  return db.prepare('SELECT ip.*, m.file, m.file_sm FROM instagram_posts ip JOIN media m ON m.id = ip.media_id WHERE ip.active = 1 ORDER BY ip.sort, ip.id DESC LIMIT 12').all()
    .map((r) => ({ image: catalog.mediaUrl(r, true), permalink: r.permalink, caption: r.caption }));
}

module.exports = { posts };
