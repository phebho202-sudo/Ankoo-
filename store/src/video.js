'use strict';
const { esc } = require('./util');

// Turns a YouTube / Vimeo / TikTok / Instagram / direct video URL into an embed.
function parseVideo(url) {
  const u = String(url || '').trim();
  let m;
  if ((m = u.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i))) {
    return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1`, ratio: '16/9', thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  }
  if ((m = u.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/i))) {
    return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?dnt=1`, ratio: '16/9' };
  }
  if ((m = u.match(/^https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/i))) {
    return { type: 'iframe', src: `https://www.tiktok.com/embed/v2/${m[1]}`, ratio: '9/16' };
  }
  if ((m = u.match(/^https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([\w-]+)/i))) {
    return { type: 'iframe', src: `https://www.instagram.com/${m[1]}/${m[2]}/embed`, ratio: '4/5' };
  }
  if (/^(https?:\/\/\S+|\/media\/\S+)\.(mp4|webm|mov)(\?\S*)?$/i.test(u)) return { type: 'video', src: u, ratio: '16/9' };
  return null;
}
function videoEmbed(url, title = 'ANKOO video') {
  const v = parseVideo(url);
  if (!v) return '';
  if (v.type === 'video') return `<div class="video" style="aspect-ratio:${v.ratio}"><video src="${esc(v.src)}" controls playsinline preload="metadata"></video></div>`;
  return `<div class="video" style="aspect-ratio:${v.ratio}"><iframe src="${esc(v.src)}" title="${esc(title)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}
module.exports = { parseVideo, videoEmbed };
