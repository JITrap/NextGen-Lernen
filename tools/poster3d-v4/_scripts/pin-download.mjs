import fs from 'node:fs';
import path from 'node:path';

const OUTDIR = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad';
const PINS_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/pins';
fs.mkdirSync(PINS_DIR, { recursive: true });

const raw = JSON.parse(fs.readFileSync(`${OUTDIR}/pin-raw-collected.json`, 'utf8'));

function originalsCandidate(url) {
  return url.replace(/\/(\d+x(?:_[A-Za-z]+)?|\d+x\d+(?:_[A-Za-z]+)?)\//, '/originals/');
}

async function fetchOk(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

const results = [];
let i = 0;
for (const p of raw) {
  i++;
  let url = p.url;
  let buf = null;
  if (!url.includes('/originals/')) {
    const cand = originalsCandidate(url);
    buf = await fetchOk(cand);
    if (buf) url = cand;
  }
  if (!buf) buf = await fetchOk(url);
  if (!buf) { console.log('FAILED', p.id, url); continue; }
  const ext = url.match(/\.(jpg|jpeg|png|gif|webp)(?:$|\?)/i)?.[1]?.toLowerCase() || 'jpg';
  const outExt = ext === 'jpeg' ? 'jpg' : ext;
  const file = path.join(PINS_DIR, `${p.id}.${outExt}`);
  fs.writeFileSync(file, buf);
  results.push({ id: p.id, imageUrl: url, file: `out/pins/${p.id}.${outExt}` });
  if (i % 20 === 0) console.log(`downloaded ${i}/${raw.length}`);
}

fs.writeFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/pinterest-pins.json', JSON.stringify(results.map(r => ({ id: r.id, imageUrl: r.imageUrl })), null, 2));
fs.writeFileSync(`${OUTDIR}/pin-download-results.json`, JSON.stringify(results, null, 2));
console.log('DONE. total:', raw.length, 'downloaded:', results.length);
