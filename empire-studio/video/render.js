'use strict';
/* Step 2 of the video pipeline: draw every frame and encode the picture track.

   Usage:  node render.js <timeline.json> <out_dir> [--from seconds --to seconds] [--still seconds,seconds,...]

   Opens stage.html in a hidden browser, asks it to draw each moment in time (24 per second),
   photographs the result, and feeds the photos to ffmpeg to make an .mp4 without sound.
   Four browsers work in parallel on separate parts of the timeline, and the parts are joined at the end.
   Needs: Node.js, Playwright with Chromium, and ffmpeg. */

const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const FPS = 24, WORKERS = 4;
const [timelinePath, outDir] = process.argv.slice(2);
const flag = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const stageHtml = fs.readFileSync(path.join(__dirname, 'stage.html'), 'utf8')
  .replace("<script>\n'use strict';", `<script>window.TIMELINE = ${JSON.stringify(timeline)};</script>\n<script>\n'use strict';`);

async function openStage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('Stage error:', e.message); process.exit(1); });
  await page.setContent(stageHtml);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function renderPart(browser, index, firstFrame, lastFrame) {
  const file = path.join(outDir, `part${index}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))));
  const page = await openStage(browser);
  for (let f = firstFrame; f < lastFrame; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (index === 0 && (f - firstFrame) % 240 === 0) process.stdout.write(`\r  ${Math.round(((f - firstFrame) / (lastFrame - firstFrame)) * 100)}%`);
  }
  ff.stdin.end();
  await done;
  await page.close();
  return file;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();

  if (flag('--still')) { // quick preview pictures instead of a video
    const page = await openStage(browser);
    for (const t of flag('--still').split(',').map(Number)) {
      await page.evaluate((x) => window.seek(x), t);
      await page.screenshot({ path: path.join(outDir, `still-${String(t).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 90 });
    }
    await browser.close();
    return;
  }

  const first = Math.floor(Number(flag('--from') || 0) * FPS);
  const last = Math.ceil(Number(flag('--to') || timeline.duration) * FPS);
  const size = Math.ceil((last - first) / WORKERS);
  const started = Date.now();
  console.log(`Rendering ${last - first} frames (${((last - first) / FPS / 60).toFixed(1)} minutes of video)...`);
  const parts = await Promise.all(Array.from({ length: WORKERS }, (_, i) =>
    renderPart(browser, i, first + i * size, Math.min(last, first + (i + 1) * size))));
  await browser.close();

  const list = path.join(outDir, 'parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(p)}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(outDir, 'picture.mp4')]);
  parts.forEach((p) => fs.unlinkSync(p));
  fs.unlinkSync(list);
  console.log(`\nPicture track written in ${Math.round((Date.now() - started) / 1000)} seconds.`);
})().catch((err) => { console.error(err); process.exit(1); });
