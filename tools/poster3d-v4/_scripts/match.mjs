import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PINS_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/pins';
const ART_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/art';

async function dHash(file) {
  const { data } = await sharp(file).greyscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits = new Uint8Array(256);
  let k = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const left = data[y * 17 + x];
      const right = data[y * 17 + x + 1];
      bits[k++] = left < right ? 1 : 0;
    }
  }
  return bits;
}

async function aHash(file) {
  const { data } = await sharp(file).greyscale().resize(16, 16, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;
  const bits = new Uint8Array(256);
  for (let i = 0; i < data.length; i++) bits[i] = data[i] > mean ? 1 : 0;
  return bits;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

const pinsMeta = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/pinterest-pins.json', 'utf8'));
const pinFiles = fs.readdirSync(PINS_DIR);
const products = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/products.json', 'utf8'));

function findFileForId(id) {
  return pinFiles.find(f => f.startsWith(id + '.'));
}

console.log('Hashing pins...');
const pinHashes = [];
for (const p of pinsMeta) {
  const f = findFileForId(p.id);
  if (!f) { console.log('no file for pin', p.id); continue; }
  const full = path.join(PINS_DIR, f);
  try {
    const dh = await dHash(full);
    const ah = await aHash(full);
    pinHashes.push({ id: p.id, dh, ah });
  } catch (e) { console.log('hash fail pin', p.id, e.message); }
}
console.log('pin hashes:', pinHashes.length);

console.log('Hashing artworks...');
const artHashes = [];
for (const pr of products) {
  const full = path.join(ART_DIR, `${pr.handle}.jpg`);
  if (!fs.existsSync(full)) { console.log('no art file for', pr.handle); continue; }
  try {
    const dh = await dHash(full);
    const ah = await aHash(full);
    artHashes.push({ handle: pr.handle, dh, ah });
  } catch (e) { console.log('hash fail art', pr.handle, e.message); }
}
console.log('art hashes:', artHashes.length);

// For each pin, find best (lowest) dHash distance among all artworks, also record aHash distance for that pair.
const results = [];
for (const p of pinHashes) {
  let best = null;
  for (const a of artHashes) {
    const dd = hamming(p.dh, a.dh);
    if (!best || dd < best.dd) {
      const ad = hamming(p.ah, a.ah);
      best = { handle: a.handle, dd, ad };
    }
  }
  results.push({ pinId: p.id, handle: best.handle, dHash: best.dd, aHash: best.ad });
}

// Distribution of best-match distances, for threshold calibration
const sorted = [...results].sort((x, y) => x.dHash - y.dHash);
fs.writeFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/match-distance-distribution.json', JSON.stringify(sorted, null, 2));

console.log('\nDistance distribution (sorted, dHash):');
console.log(sorted.map(r => r.dHash).join(','));

// Histogram buckets of width 10
const hist = {};
for (const r of sorted) {
  const bucket = Math.floor(r.dHash / 10) * 10;
  hist[bucket] = (hist[bucket] || 0) + 1;
}
console.log('\nHistogram (bucket:count):', JSON.stringify(hist));
