/* Ersetzt die Sektion collection_list_lp in templates/index.json (v3-Spiegel)
   durch die neue Sektion limitless-collection-tiles mit den 8 Cover-Kacheln. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(ROOT, '../../theme-v3/current/templates/index.json');

const HANDLES = [
  'new-drop',
  'apex-motorsport-cars',
  'grit-boxing-mma',
  'legends-sports-icons',
  'mindset-words-ambition',
  'still-quiet-luxury',
  'heritage-timeless-classics',
  'icons-music-culture',
];

const uploaded = JSON.parse(readFileSync(resolve(ROOT, 'out/uploaded-covers.json'), 'utf8'));
// shopify://shop_images/<basename> aus der CDN-URL ableiten (Query-String weg)
const shopImage = handle => {
  const key = Object.keys(uploaded).find(k => k.includes(handle));
  if (!key) throw new Error('kein Cover für ' + handle);
  const base = uploaded[key].split('/').pop().split('?')[0];
  return 'shopify://shop_images/' + base;
};

const raw = readFileSync(FILE, 'utf8');
const bannerEnd = raw.startsWith('/*') ? raw.indexOf('*/') + 2 : 0;
const banner = raw.slice(0, bannerEnd);
const data = JSON.parse(raw.slice(bannerEnd));

const old = data.sections['collection_list_lp'];
if (!old) throw new Error('collection_list_lp nicht gefunden');

const blocks = {};
const block_order = [];
HANDLES.forEach((h, i) => {
  const id = 'tile_' + h.replace(/[^a-z0-9]+/g, '_');
  blocks[id] = { type: 'tile', settings: { collection: h, cover: shopImage(h) } };
  block_order.push(id);
});

data.sections['collection_list_lp'] = {
  type: 'limitless-collection-tiles',
  blocks,
  block_order,
  settings: {
    eyebrow: 'ACHT KOLLEKTIONEN',
    heading: 'Finde deinen Stil',
    columns: 4,
    color_scheme: 'scheme-1',
    'padding-block-start': 64,
    'padding-block-end': 48,
  },
};

writeFileSync(FILE, banner + '\n' + JSON.stringify(data, null, 2) + '\n');
console.log('index.json gepatcht — Sektion collection_list_lp → limitless-collection-tiles mit', block_order.length, 'Kacheln');
