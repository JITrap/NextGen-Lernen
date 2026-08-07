/* R4 — Fotorealistische Mockups: gerendertes Rahmen-PNG wird per Homographie
   (CSS matrix3d in Chromium) in echte Raumfotos gesetzt. Pro Produkt 2 Szenen:
   Kategorie-Raum ("Wohnbeispiel") + Zweitraum ("Studio").
   Nutzung: node compose-photo.mjs [--limit N] [--only h1,h2] [--force] */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPosterPng } from './compose.mjs';
import { SCENES, quadFor, resolveScene, CATEGORY_SCENES, FALLBACK_SCENE } from './scenes-photo.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const P3D = resolve(ROOT, '../poster3d-v4');
const OUT = resolve(ROOT, 'out-photo');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const argVal = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const LIMIT = parseInt(argVal('--limit') || '0', 10);
const ONLY = (argVal('--only') || '').split(',').filter(Boolean);
const FORCE = args.includes('--force');

const products = JSON.parse(readFileSync(resolve(P3D, 'products.json'), 'utf8'));
const buildManifest = JSON.parse(readFileSync(resolve(P3D, 'out/batch-manifest.json'), 'utf8'));
const assignments = JSON.parse(readFileSync(resolve(P3D, 'out/assignments.json'), 'utf8'));
const MANIFEST = resolve(OUT, 'manifest.json');
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));

/* Produkt-GID → Szene nach Kategorie-Priorität */
const idToHandle = new Map(products.map(p => [p.id, p.handle]));
const handleScene = new Map();
for (const [col, scene] of CATEGORY_SCENES) {
  const a = assignments[col];
  if (!a) continue;
  for (const gid of a.productIds) {
    const h = idToHandle.get(gid);
    if (h && !handleScene.has(h)) handleScene.set(h, scene);
  }
}

/* Homographie: Einheitsrechteck (w,h) → Quad. Standard-2D-Projektion. */
function homography(w, h, q) {
  const [x0, y0] = q.tl, [x1, y1] = q.tr, [x2, y2] = q.br, [x3, y3] = q.bl;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - sy * dx2) / den;
  const hh = (dx1 * sy - dy1 * sx) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  // Spaltenweise matrix3d; Quelle wird über (w,h) normiert.
  return [
    a / w, d / w, 0, g / w,
    b / h, e / h, 0, hh / h,
    0, 0, 1, 0,
    c, f, 0, 1,
  ];
}

const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html' };
let posterBuf = null;
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/poster.png') { res.writeHead(200, { 'content-type': 'image/png' }); res.end(posterBuf); return; }
  const p = join(ROOT, path);
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function composeScene(sceneKey, ratio, outPath) {
  const s = SCENES[sceneKey];
  const meta = await sharp(resolve(ROOT, s.file)).metadata();
  const scale = Math.min(1, 2000 / meta.width);
  const W = Math.round(meta.width * scale), H = Math.round(meta.height * scale);
  const q0 = quadFor(s, ratio);
  const q = Object.fromEntries(Object.entries(q0).map(([k, [x, y]]) => [k, [x * scale, y * scale]]));
  const m = homography(1000, Math.round(1000 / ratio), q);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0}
  #stage{position:relative;width:${W}px;height:${H}px;overflow:hidden}
  #room{position:absolute;inset:0;width:100%;height:100%}
  #poster{position:absolute;left:0;top:0;width:1000px;height:${Math.round(1000 / ratio)}px;
    transform-origin:0 0;transform:matrix3d(${m.map(n => n.toPrecision(8)).join(',')});
    filter:${s.light} drop-shadow(${s.shadow});}
  </style></head><body>
  <div id="stage">
    <img id="room" src="/${s.file}">
    <img id="poster" src="/poster.png">
  </div>
  <script>window.ready=Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=r;i.onerror=r})))</script>
  </body></html>`;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.route('**/page.html', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`http://127.0.0.1:${PORT}/page.html`);
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(120);
  const shot = await page.screenshot({ type: 'jpeg', quality: 90 });
  await page.close();
  await sharp(shot).jpeg({ quality: 86, mozjpeg: true }).toFile(outPath);
}

let done = 0, skipped = 0, failed = 0;
const queue = products.filter(p => (!ONLY.length || ONLY.includes(p.handle)));
for (const p of queue) {
  if (LIMIT && done >= LIMIT) break;
  const bm = buildManifest[p.handle];
  if (!bm || bm.status !== 'built') { skipped++; continue; }
  const m = manifest[p.handle];
  if (m && m.status === 'done' && !FORCE) { skipped++; continue; }
  const t0 = Date.now();
  try {
    const glb = resolve(P3D, `out/batch/lp5-${p.handle}-black-${bm.default}.glb`);
    posterBuf = await renderPosterPng(glb, bm.orientation);
    const pm = await sharp(posterBuf).metadata();
    const ratio = pm.width / pm.height;
    const primary = resolveScene(handleScene.get(p.handle) || FALLBACK_SCENE, ratio);
    let second = primary === 'living-minimal' ? 'office' : 'living-minimal';
    second = resolveScene(second, ratio);
    const outA = resolve(OUT, `${p.handle}-wohnbeispiel.jpg`);
    const outB = resolve(OUT, `${p.handle}-studio.jpg`);
    await composeScene(primary, ratio, outA);
    await composeScene(second, ratio, outB);
    manifest[p.handle] = { status: 'done', primary, second, files: [`${p.handle}-wohnbeispiel.jpg`, `${p.handle}-studio.jpg`] };
    save(); done++;
    console.log(`[${done + skipped + failed}/${queue.length}] ${p.handle}: ${primary} + ${second} (${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) {
    manifest[p.handle] = { status: 'failed', reason: String(e.message || e).slice(0, 160) };
    save(); failed++;
    console.log(`FEHLER ${p.handle}: ${String(e.message || e).slice(0, 160)}`);
  }
}
await browser.close(); server.close();
console.log(`\nFertig: ${done} gebaut, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
