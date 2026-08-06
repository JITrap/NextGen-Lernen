/* Druckt die fertigen metafieldsSet-Variablen für ein Produkt.
   Nutzung: node make-metafield.mjs <handle> [<handle2> ...]
   Erwartet out/batch-manifest.json und out/urls/<handle>.json (Datei→CDN-URL). */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'out/batch-manifest.json'), 'utf8'));

const metafields = [];
for (const handle of process.argv.slice(2)) {
  const m = manifest[handle];
  if (!m || m.status !== 'built') throw new Error(`${handle}: nicht gebaut (${m && m.status})`);
  const urls = JSON.parse(readFileSync(resolve(ROOT, `out/urls/${handle}.json`), 'utf8'));
  const v = { default: m.default, orientation: m.orientation, sizes: m.sizeMap, black: {}, white: {} };
  for (const g of m.glbs) {
    const u = urls[g.file];
    if (!u) throw new Error(`${handle}: URL fehlt für ${g.file}`);
    v[g.color][g.cls] = u;
  }
  metafields.push({ ownerId: m.id, namespace: 'custom', key: 'poster_3d_v4', type: 'json', value: JSON.stringify(v) });
}
console.log(JSON.stringify({ metafields }));
