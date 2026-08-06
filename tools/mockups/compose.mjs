/* Rendert ein GLB frontal (transparent) und komponiert es in die Szenen.
   Nutzung: node compose.mjs <glbPfad> <handle> [portrait|landscape] */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const P3D = resolve(ROOT, '../poster3d-v4');

export async function renderPosterPng(glbPath, orientation = 'portrait') {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<script type="module" src="/vendor-model-viewer.min.js"></script>
<style>html,body{margin:0;background:transparent}model-viewer{width:1400px;height:1400px;--poster-color:transparent;background:transparent}</style>
</head><body>
<model-viewer id="mv" src="/GLB" environment-image="/shared/studio.hdr" tone-mapping="neutral" exposure="1.02"
  shadow-intensity="0" camera-orbit="0deg 88deg 102%" interaction-prompt="none" disable-zoom></model-viewer>
<script>window.mvReady=new Promise(r=>{document.getElementById('mv').addEventListener('load',()=>setTimeout(r,700))});</script>
</body></html>`;
  const MIME = { '.html': 'text/html', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.js': 'text/javascript' };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    if (path === '/GLB') { res.writeHead(200, { 'content-type': 'model/gltf-binary' }); res.end(readFileSync(glbPath)); return; }
    const p = join(P3D, path);
    if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(readFileSync(p));
  });
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/page.html`, { timeout: 30000 });
  await page.evaluate(() => window.mvReady);
  const buf = await page.screenshot({ omitBackground: true });
  await browser.close(); server.close();
  return sharp(buf).trim().png().toBuffer();
}

export async function composeMockups(glbPath, handle, orientation = 'portrait') {
  const poster = await renderPosterPng(glbPath, orientation);
  const meta = await sharp(poster).metadata();
  mkdirSync(resolve(ROOT, 'out'), { recursive: true });
  const results = [];

  // Platzierung: [Szene, Zielhöhe px, Mitte x, Unterkante y]
  const placements = {
    wohnbeispiel: { file: 'scenes/wohnbeispiel.png', h: orientation === 'landscape' ? 640 : 900, cx: 700, by: 1190 },
    studio: { file: 'scenes/studio.png', h: orientation === 'landscape' ? 700 : 980, cx: 900, by: 1300 },
  };

  for (const [scene, pl] of Object.entries(placements)) {
    const scale = pl.h / meta.height;
    const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
    const px = Math.round(pl.cx - w / 2), py = Math.round(pl.by - h);
    const small = await sharp(poster).resize(w, h).toBuffer();
    // weicher Schlagschatten aus der Alpha-Maske
    const shadow = await sharp(small).ensureAlpha()
      .composite([{ input: Buffer.from([11, 11, 12, 200]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'in' }])
      .blur(18).toBuffer();
    const out = resolve(ROOT, `out/${handle}-${scene}.jpg`);
    await sharp(resolve(ROOT, pl.file))
      .composite([
        { input: shadow, left: px + 16, top: py + 26 },
        { input: small, left: px, top: py },
      ])
      .jpeg({ quality: 88, mozjpeg: true }).toFile(out);
    results.push(out);
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [glb, handle, ori] = process.argv.slice(2);
  const res = await composeMockups(glb, handle, ori || 'portrait');
  console.log(res.join('\n'));
}
