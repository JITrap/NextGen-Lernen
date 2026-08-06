/* Teilt gebaute Produkte in Upload-Chunks für Sub-Agenten.
   Nutzung: node make-chunks.mjs [chunkgröße=7] */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'out/batch-manifest.json'), 'utf8'));
const SIZE = parseInt(process.argv[2] || '7', 10);
mkdirSync(resolve(ROOT, 'out/chunks'), { recursive: true });
mkdirSync(resolve(ROOT, 'out/urls'), { recursive: true });

// Pilotprodukte haben ihr Metafield schon — trotzdem aufnehmen, falls sie im
// Batch neu gebaut wurden; sonst überspringen (status !== 'built').
const built = Object.entries(manifest).filter(([, m]) => m.status === 'built');
const chunks = [];
for (let i = 0; i < built.length; i += SIZE) {
  chunks.push(built.slice(i, i + SIZE).map(([handle, m]) => ({
    handle,
    id: m.id,
    title: m.title,
    glbs: m.glbs.map(g => g.file),
    mockups: m.mockups,
  })));
}
chunks.forEach((c, i) => {
  writeFileSync(resolve(ROOT, `out/chunks/chunk-${i + 1}.json`), JSON.stringify({
    glbDir: resolve(ROOT, 'out/batch'),
    mockupDir: resolve(ROOT, '../mockups/out'),
    products: c,
  }, null, 1));
});
console.log(`${built.length} Produkte → ${chunks.length} Chunks à ≤${SIZE} (out/chunks/chunk-N.json)`);
