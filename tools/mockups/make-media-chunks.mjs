/* Teilt den R4-Medien-Tausch in Chunks für Sub-Agenten.
   Nutzung: node make-media-chunks.mjs [chunkgröße=15] */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const products = JSON.parse(readFileSync(resolve(ROOT, '../poster3d-v4/products.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'out-photo/manifest.json'), 'utf8'));
const SIZE = parseInt(process.argv[2] || '15', 10);
mkdirSync(resolve(ROOT, 'out-photo/chunks'), { recursive: true });

const done = products.filter(p => manifest[p.handle] && manifest[p.handle].status === 'done')
  .map(p => ({
    handle: p.handle,
    id: p.id,
    title: p.title,
    wohnbeispiel: `${p.handle}-wohnbeispiel.jpg`,
    studio: `${p.handle}-studio.jpg`,
  }));

let n = 0;
for (let i = 0; i < done.length; i += SIZE) {
  n++;
  writeFileSync(resolve(ROOT, `out-photo/chunks/media-chunk-${n}.json`), JSON.stringify({
    imgDir: resolve(ROOT, 'out-photo'),
    products: done.slice(i, i + SIZE),
  }, null, 1));
}
console.log(`${done.length} Produkte → ${n} Chunks (out-photo/chunks/media-chunk-N.json)`);
