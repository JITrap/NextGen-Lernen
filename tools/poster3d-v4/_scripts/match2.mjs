import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PINS_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/pins';
const ART_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/art';

async function dHash(file) {
  const { data } = await sharp(file).greyscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits = new Uint8Array(256);
  let k = 0;
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
for (const p of pinsMeta) {
  const f = findFileForId(p.id); if (!f) continue;
  const full = path.join(PINS_DIR, f);
  pinHashes.push({ id: p.id, dh: await dHash(full), ah: await aHash(full) });
}
const artHashes = [];
for (const pr of products) {
  const full = path.join(ART_DIR, `${pr.handle}.jpg`);
  if (!fs.existsSync(full)) continue;
  artHashes.push({ handle: pr.handle, dh: await dHash(full), ah: await aHash(full) });
}

// full distance matrix
const matrix = []; // matrix[i][j] = {dd, ad} for pin i, art j
for (const p of pinHashes) {
  const row = [];
  for (const a of artHashes) row.push({ dd: hamming(p.dh, a.dh), ad: hamming(p.ah, a.ah) });
  matrix.push(row);
}

// best art per pin
const bestForPin = pinHashes.map((p, i) => {
  let bi = 0;
  for (let j = 1; j < artHashes.length; j++) if (matrix[i][j].dd < matrix[i][bi].dd) bi = j;
  return { pinIdx: i, artIdx: bi, dd: matrix[i][bi].dd, ad: matrix[i][bi].ad };
});
// best pin per art
const bestForArt = artHashes.map((a, j) => {
  let bi = 0;
  for (let i = 1; i < pinHashes.length; i++) if (matrix[i][j].dd < matrix[bi][j].dd) bi = i;
  return { artIdx: j, pinIdx: bi, dd: matrix[bi][j].dd, ad: matrix[bi][j].ad };
});

const mutual = [];
for (const bp of bestForPin) {
  const ba = bestForArt[bp.artIdx];
  const isMutual = ba.pinIdx === bp.pinIdx;
  mutual.push({
    pinId: pinHashes[bp.pinIdx].id,
    handle: artHashes[bp.artIdx].handle,
    dHash: bp.dd, aHash: bp.ad,
    mutualNN: isMutual,
  });
}
mutual.sort((a, b) => a.dHash - b.dHash);
fs.writeFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/match-mutual.json', JSON.stringify(mutual, null, 2));
console.log(mutual.map(m => `${m.mutualNN ? 'MNN' : '   '} d=${m.dHash} a=${m.aHash} ${m.pinId} -> ${m.handle}`).join('\n'));
