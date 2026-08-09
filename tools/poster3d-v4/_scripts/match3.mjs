import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PINS_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/pins';
const ART_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/art';

async function dHash(file) {
  const { data } = await sharp(file).greyscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits = new Uint8Array(256); let k = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits[k++] = data[y * 17 + x] < data[y * 17 + x + 1] ? 1 : 0;
  return bits;
}
async function aHash(file) {
  const { data } = await sharp(file).greyscale().resize(16, 16, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;
  const bits = new Uint8Array(256);
  for (let i = 0; i < data.length; i++) bits[i] = data[i] > mean ? 1 : 0;
  return bits;
}
function hamming(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }

const pinsMeta = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/pinterest-pins.json', 'utf8'));
const pinFiles = fs.readdirSync(PINS_DIR);
const products = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/products.json', 'utf8'));
function findFileForId(id) { return pinFiles.find(f => f.startsWith(id + '.')); }

const pinHashes = [];
for (const p of pinsMeta) { const f = findFileForId(p.id); if (!f) continue; const full = path.join(PINS_DIR, f); pinHashes.push({ id: p.id, dh: await dHash(full), ah: await aHash(full) }); }
const artHashes = [];
for (const pr of products) { const full = path.join(ART_DIR, `${pr.handle}.jpg`); if (!fs.existsSync(full)) continue; artHashes.push({ handle: pr.handle, dh: await dHash(full), ah: await aHash(full) }); }

const pairs = [];
for (let i = 0; i < pinHashes.length; i++) {
  for (let j = 0; j < artHashes.length; j++) {
    pairs.push({ i, j, dd: hamming(pinHashes[i].dh, artHashes[j].dh), ad: hamming(pinHashes[i].ah, artHashes[j].ah) });
  }
}
pairs.sort((a, b) => a.dd - b.dd || a.ad - b.ad);

const usedPin = new Set(), usedArt = new Set();
const assigned = [];
for (const p of pairs) {
  if (usedPin.has(p.i) || usedArt.has(p.j)) continue;
  usedPin.add(p.i); usedArt.add(p.j);
  assigned.push({ pinId: pinHashes[p.i].id, handle: artHashes[p.j].handle, dHash: p.dd, aHash: p.ad });
}
assigned.sort((a, b) => a.dHash - b.dHash);
fs.writeFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/match-greedy.json', JSON.stringify(assigned, null, 2));
console.log('assigned pairs (1 pin <-> 1 handle, greedy by ascending distance):', assigned.length);
console.log(assigned.map(r => `d=${r.dHash} a=${r.aHash} ${r.pinId} -> ${r.handle}`).join('\n'));
