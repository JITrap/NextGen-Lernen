import fs from 'node:fs';
import sharp from 'sharp';

const PINS_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/pins';
const ART_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/art';
const rows = JSON.parse(fs.readFileSync('/tmp/check-rows.json', 'utf8'));
const pinFiles = fs.readdirSync(PINS_DIR);
function findPinFile(id) { return pinFiles.find(f => f.startsWith(id + '.')); }

const CELL = 380;
const composites = [];
let y = 0;
for (const r of rows) {
  const pf = findPinFile(r.pinId);
  const pinBuf = await sharp(`${PINS_DIR}/${pf}`).resize(CELL, CELL, { fit: 'inside' }).jpeg().toBuffer();
  composites.push({ input: pinBuf, left: 0, top: y });
  const artBuf = await sharp(`${ART_DIR}/${r.handle}.jpg`).resize(CELL, CELL, { fit: 'inside' }).jpeg().toBuffer();
  composites.push({ input: artBuf, left: CELL + 20, top: y });
  y += CELL + 10;
}
const bg = sharp({ create: { width: CELL * 2 + 20, height: y, channels: 3, background: '#222' } });
await bg.composite(composites).jpeg({ quality: 88 }).toFile('/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad/pairs-check.jpg');
console.log('done, rows:', rows.length);
rows.forEach((r,i)=>console.log(i, r.pinId, r.handle, r.dHash, r.aHash));
