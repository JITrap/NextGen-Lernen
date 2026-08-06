/* Batch: baut für alle Produkte aus products.json die v4-GLBs (je Aspect-Klasse
   × Farbe), das Label und 2 Mockup-Szenen. Manifest-gesteuert und resumierbar.
   Nutzung: node batch-build.mjs [--limit N] [--only h1,h2] [--force] */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectArtwork } from './detect-artwork.mjs';
import { bakeArtwork, bakeLabel, buildGlb, classForSize } from './build-glb.mjs';
import { composeMockups } from '../mockups/compose.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(ROOT, 'out/batch');
const MANIFEST = resolve(ROOT, 'out/batch-manifest.json');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const argVal = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const LIMIT = parseInt(argVal('--limit') || '0', 10);
const ONLY = (argVal('--only') || '').split(',').filter(Boolean);
const FORCE = args.includes('--force');

const products = JSON.parse(readFileSync(resolve(ROOT, 'products.json'), 'utf8'));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));

function parseSize(s) {
  const nums = String(s).match(/\d+(?:\.\d+)?/g);
  return nums && nums.length >= 2 ? [parseFloat(nums[0]), parseFloat(nums[1])] : null;
}

let done = 0, skipped = 0, failed = 0;
const queue = products.filter(p => (!ONLY.length || ONLY.includes(p.handle)));

for (const p of queue) {
  if (LIMIT && done >= LIMIT) break;
  const m = manifest[p.handle];
  if (m && m.status === 'built' && !FORCE) { skipped++; continue; }
  if (!p.image || !p.sizes || !p.sizes.length) {
    manifest[p.handle] = { id: p.id, status: 'skipped', reason: !p.image ? 'kein Bild' : 'keine Größen' };
    save(); skipped++; continue;
  }
  const t0 = Date.now();
  try {
    const res = await fetch(p.image);
    if (!res.ok) throw new Error('fetch ' + res.status);
    const src = Buffer.from(await res.arrayBuffer());
    const det = await detectArtwork(src);
    if (det.warn) throw new Error('Erkennung unplausibel: ' + JSON.stringify({ artAspect: det.artAspect, frameRatio: det.frameRatio }));
    const orientation = det.artAspect < 1 ? 'portrait' : 'landscape';
    const sizeMap = {};
    for (const s of p.sizes) {
      const wh = parseSize(s);
      sizeMap[s] = wh ? classForSize(wh[0], wh[1]) : 'c23';
    }
    const classes = [...new Set(Object.values(sizeMap))];
    const label = bakeLabel(p.title);
    const entry = {
      id: p.id, title: p.title, orientation, default: sizeMap[p.sizes[0]],
      sizeMap, classes, artPx: det.artPx, glbs: [], mockups: [], status: 'building',
    };
    for (const cls of classes) {
      const art = await bakeArtwork(src, det.art, cls, orientation);
      for (const color of ['black', 'white']) {
        const file = `lp4-${p.handle}-${color}-${cls}.glb`;
        const r = await buildGlb({ outPath: resolve(OUT, file), artworkJpeg: art, labelPng: label, color, classKey: cls, orientation });
        entry.glbs.push({ file, color, cls, bytes: r.bytes });
      }
    }
    // Mockups aus dem Default-Klasse-GLB (schwarz)
    const defGlb = resolve(OUT, `lp4-${p.handle}-black-${entry.default}.glb`);
    const mocks = await composeMockups(defGlb, p.handle, orientation);
    entry.mockups = mocks.map(f => f.split('/').pop());
    entry.status = 'built';
    manifest[p.handle] = entry;
    save();
    done++;
    console.log(`[${done + skipped + failed}/${queue.length}] ${p.handle}: ${entry.glbs.length} GLBs + 2 Mockups (${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) {
    manifest[p.handle] = { id: p.id, status: 'failed', reason: String(e.message || e).slice(0, 200) };
    save(); failed++;
    console.log(`FEHLER ${p.handle}: ${String(e.message || e).slice(0, 160)}`);
  }
}
console.log(`\nFertig: ${done} gebaut, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
