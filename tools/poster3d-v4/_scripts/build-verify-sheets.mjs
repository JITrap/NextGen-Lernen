import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = '/home/user/NextGen-Lernen/tools/poster3d-v4';
const matches = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/pinterest-match.json'), 'utf8'));
const pinFiles = fs.readdirSync(path.join(ROOT, 'out/pins'));
const outDir = path.join(ROOT, 'out/verify');
fs.mkdirSync(outDir, { recursive: true });
// clean old sheet files from previous runs
for (const f of fs.readdirSync(outDir)) {
  if (/^sheet-\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(outDir, f));
}

const ROW_H = 300;
const GAP = 12;
const LABEL_H = 26;
const PAD = 10;
const MAX_W = 1300; // cap per-image width so pairs fit side by side reasonably

async function loadResized(p, targetH) {
  const img = sharp(p);
  const meta = await img.metadata();
  let w = Math.round((meta.width / meta.height) * targetH);
  if (w > MAX_W) w = MAX_W;
  const buf = await sharp(p).resize({ height: targetH, width: w, fit: 'inside' }).jpeg().toBuffer();
  const finalMeta = await sharp(buf).metadata();
  return { buf, w: finalMeta.width, h: finalMeta.height };
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CHUNK = 5;
const chunks = [];
for (let i = 0; i < matches.length; i += CHUNK) chunks.push(matches.slice(i, i + CHUNK));

const manifest = [];

for (let ci = 0; ci < chunks.length; ci++) {
  const chunk = chunks[ci];
  const rows = [];
  for (const m of chunk) {
    const pinFile = pinFiles.find(f => f.startsWith(m.pinId + '.'));
    const pinPath = path.join(ROOT, 'out/pins', pinFile);
    const artPath = path.join(ROOT, 'out/art', m.handle + '.jpg');
    const left = await loadResized(pinPath, ROW_H);
    const right = await loadResized(artPath, ROW_H);
    rows.push({ m, left, right });
  }

  const imgBasedW = Math.max(...rows.map(r => PAD * 3 + r.left.w + r.right.w)) + PAD;
  const labelBasedW = Math.max(...rows.map(r =>
    PAD * 2 + (`pinId ${r.m.pinId}  |  distanz ${r.m.distanz}  |  ${r.m.handle}`.length * 9.5)
  ));
  const sheetW = Math.ceil(Math.max(imgBasedW, labelBasedW));
  let y = PAD;
  const rowLayouts = [];
  for (const r of rows) {
    const rowH = LABEL_H + Math.max(r.left.h, r.right.h);
    rowLayouts.push({ ...r, y, rowH });
    y += rowH + GAP;
  }
  const sheetH = y + PAD;

  const composites = [];
  const svgLabels = [];
  for (const rl of rowLayouts) {
    const labelY = rl.y;
    const imgY = rl.y + LABEL_H;
    const rowW = rl.left.w + rl.right.w + PAD;
    const rowLeft = Math.max(PAD, Math.round((sheetW - rowW) / 2));
    composites.push({ input: rl.left.buf, left: rowLeft, top: imgY });
    composites.push({ input: rl.right.buf, left: rowLeft + rl.left.w + PAD, top: imgY });
    svgLabels.push(
      `<text x="${PAD}" y="${labelY + 18}" font-family="monospace" font-size="18" fill="#00ff00">pinId ${escapeXml(rl.m.pinId)}  |  distanz ${rl.m.distanz}  |  ${escapeXml(rl.m.handle)}</text>`
    );
    svgLabels.push(
      `<rect x="${rowLeft - 2}" y="${imgY - 2}" width="${rowW + 4}" height="${Math.max(rl.left.h, rl.right.h) + 4}" fill="none" stroke="#444" stroke-width="1"/>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
    ${svgLabels.join('\n')}
  </svg>`;

  composites.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const outPath = path.join(outDir, `sheet-${ci + 1}.jpg`);
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: '#111111' } })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(outPath);

  manifest.push({ sheet: `sheet-${ci + 1}.jpg`, pairs: chunk.map(c => ({ pinId: c.pinId, handle: c.handle })) });
  console.log('wrote', outPath, 'pairs', chunk.length);
}

fs.writeFileSync(path.join(outDir, 'sheet-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('TOTAL SHEETS', chunks.length, 'TOTAL PAIRS', matches.length);
