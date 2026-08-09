import fs from 'node:fs';
import sharp from 'sharp';

const PINS_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/pins';
const ART_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/art';
const d = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/match-distance-distribution.json', 'utf8'));

const lo = parseInt(process.argv[2] || '54');
const hi = parseInt(process.argv[3] || '90');
const outFile = process.argv[4] || '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad/sheet.jpg';

const rows = d.filter(r => r.dHash >= lo && r.dHash <= hi);
console.log('rows in range:', rows.length);

const pinFiles = fs.readdirSync(PINS_DIR);
function findPinFile(id) { return pinFiles.find(f => f.startsWith(id + '.')); }

const CELL = 200;
const LABELH = 28;
const rowH = CELL + LABELH;
const canvasW = CELL * 2 + 20;
const canvasH = rowH * rows.length;

const composites = [];
let y = 0;
for (const r of rows) {
  const pf = findPinFile(r.pinId);
  const pinPath = pf ? `${PINS_DIR}/${pf}` : null;
  const artPath = `${ART_DIR}/${r.handle}.jpg`;
  try {
    const pinBuf = await sharp(pinPath).resize(CELL, CELL, { fit: 'inside' }).jpeg().toBuffer();
    composites.push({ input: pinBuf, left: 0, top: y });
  } catch {}
  try {
    const artBuf = await sharp(artPath).resize(CELL, CELL, { fit: 'inside' }).jpeg().toBuffer();
    composites.push({ input: artBuf, left: CELL + 20, top: y });
  } catch {}
  y += rowH;
}

const bg = sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: '#222' } });
await bg.composite(composites).jpeg({ quality: 85 }).toFile(outFile);

// write a text index alongside
const idx = rows.map((r, i) => `${i}: pinId=${r.pinId} handle=${r.handle} dHash=${r.dHash} aHash=${r.aHash}`).join('\n');
fs.writeFileSync(outFile.replace(/\.jpg$/, '.txt'), idx);
console.log('wrote', outFile, 'rows=', rows.length);
