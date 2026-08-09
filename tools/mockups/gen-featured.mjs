/* T11 — Hauptbilder: gerahmtes Poster (Front-Render) freigestellt auf
   Shop-Creme (#F6F3EE) mit weichem Schatten, 1600×2000. Ersetzt die weißen
   Printify-Kacheln als Featured Image. */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPosterPng } from './compose.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const P3D = resolve(ROOT, '../poster3d-v4');
const OUT = resolve(ROOT, 'out-featured');
mkdirSync(OUT, { recursive: true });

const products = JSON.parse(readFileSync(resolve(P3D, 'products.json'), 'utf8'));
const bm = JSON.parse(readFileSync(resolve(P3D, 'out/batch-manifest.json'), 'utf8'));
const MANIFEST = resolve(OUT, 'manifest.json');
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

const S_W = 1600, S_H = 2000, pad = 150;

let done = 0, skipped = 0, failed = 0;
for (const p of products) {
  const m = bm[p.handle];
  if (!m || m.status !== 'built') { skipped++; continue; }
  if (manifest[p.handle] === 'done' && !process.argv.includes('--force')) { skipped++; continue; }
  try {
    const glb = resolve(P3D, `out/batch/lp5-${p.handle}-black-${m.default}.glb`);
    const buf = await renderPosterPng(glb, m.orientation);
    const meta = await sharp(buf).metadata();
    const scale = Math.min((S_W - 2 * pad) / meta.width, (S_H - 2 * pad) / meta.height);
    const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
    const small = await sharp(buf).resize(w, h).toBuffer();
    const shadow = await sharp(small).ensureAlpha()
      .composite([{ input: Buffer.from([20, 18, 16, 110]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'in' }])
      .blur(22).toBuffer();
    await sharp({ create: { width: S_W, height: S_H, channels: 3, background: '#F6F3EE' } })
      .composite([
        { input: shadow, left: Math.round((S_W - w) / 2) + 10, top: Math.round((S_H - h) / 2) + 26 },
        { input: small, left: Math.round((S_W - w) / 2), top: Math.round((S_H - h) / 2) },
      ]).jpeg({ quality: 88, mozjpeg: true }).toFile(resolve(OUT, `${p.handle}-hero.jpg`));
    manifest[p.handle] = 'done';
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
    done++;
    console.log(`[${done}] ${p.handle}`);
  } catch (e) {
    manifest[p.handle] = 'failed: ' + String(e.message || e).slice(0, 120);
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
    failed++;
    console.log('FEHLER', p.handle, String(e.message || e).slice(0, 120));
  }
}
console.log(`\nFertig: ${done} gebaut, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
