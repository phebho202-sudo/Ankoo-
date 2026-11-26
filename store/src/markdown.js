'use strict';
// Minimal, safe Markdown: input is escaped first, then a small set of patterns is converted.
const { esc, safeUrl } = require('./util');
const { videoEmbed } = require('./video');

function unesc(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function inline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
      const u = safeUrl(unesc(url));
      return u ? `<img src="${esc(u)}" alt="${alt}" loading="lazy" decoding="async">` : '';
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const u = safeUrl(unesc(url));
      if (!u) return text;
      const ext = /^https?:/i.test(u);
      return `<a href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

function markdown(src) {
  const blocks = String(src || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    const video = b.match(/^video:\s*(\S+)$/i);
    if (video) { const v = videoEmbed(video[1]); if (v) out.push(v); continue; }
    const e = esc(b);
    const lines = e.split('\n');
    let m;
    if ((m = e.match(/^(#{1,3})\s+(.+)$/))) { const l = m[1].length + 1; out.push(`<h${l}>${inline(m[2])}</h${l}>`); continue; }
    if (/^&gt;\s?/.test(e)) { out.push(`<blockquote><p>${inline(e.replace(/^&gt;\s?/gm, '')).replace(/\n/g, '<br>')}</p></blockquote>`); continue; }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`); continue;
    }
    if (lines.every((l) => /^\d+\.\s+/.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`); continue;
    }
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(e)) { out.push(`<figure>${inline(e)}</figure>`); continue; }
    out.push(`<p>${inline(e).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('\n');
}
function plain(src, max = 160) {
  const s = String(src || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^video:.*$/gim, '').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s;
}
module.exports = { markdown, plain };
