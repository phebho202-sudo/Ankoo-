import { en, yo } from "../src/lib/i18n/dictionaries.ts";
const leaves = (o, p = "") => typeof o === "string" ? [[p, o]] : Array.isArray(o) ? o.flatMap((v, i) => leaves(v, `${p}[${i}]`)) : Object.entries(o).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k));
const y = new Map(leaves(yo));
const esc = (s) => s.replace(/\|/g, "\\|");
let out = `# Yoruba interface text: language review

The dashboard's Yoruba text was written with full tone marks, but it has **not yet been
reviewed by a fluent Nigerian Yoruba speaker**. Please have a reviewer go through the table
below and mark corrections in the "Reviewer correction" column (or send them back in any form).

Points worth special attention:
* Terms chosen for new concepts: *ìpín* (episode), *ìtẹ̀jáde* (publishing), *àkọsílẹ̀
  àyẹ̀wò* (audit trail), *ìpawówọlé* (monetisation), *ọ̀rọ̀ aṣínà* (password), *ìkànnì
  àjọlò* (social media), *aládàáṣe* (automatic), *ìpele* (phase).
* Tone and register: it should read as natural, respectful Nigerian Yoruba for a business
  owner, not a word-for-word translation.
* Technical words left in English on purpose: API, Redis, FFmpeg, TTS, avatar, affiliate,
  YouTube, TikTok, Meta, USD.

Source of truth: \`frontend/src/lib/i18n/dictionaries.ts\`. Regenerate this file after edits with
\`cd frontend && npm run -s i18n:review > ../docs/YORUBA_UI_REVIEW.md\`.

| Key | English | Yorùbá | Reviewer correction |
|---|---|---|---|
`;
for (const [k, v] of leaves(en)) out += `| \`${k}\` | ${esc(v)} | ${esc(y.get(k))} | |\n`;
process.stdout.write(out);
