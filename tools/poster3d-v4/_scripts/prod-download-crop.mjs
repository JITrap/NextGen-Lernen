import fs from 'node:fs';
import path from 'node:path';
import { detectArtwork } from '../detect-artwork.mjs';
import sharp from 'sharp';

const products = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/products.json', 'utf8'));
const PROD_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/prodimg';
const ART_DIR = '/home/user/NextGen-Lernen/tools/poster3d-v4/out/art';
fs.mkdirSync(PROD_DIR, { recursive: true });
fs.mkdirSync(ART_DIR, { recursive: true });

const warnings = [];
let i = 0;
for (const p of products) {
  i++;
  const res = await fetch(p.image, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) { warnings.push({ handle: p.handle, error: `download failed ${res.status}` }); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const prodFile = path.join(PROD_DIR, `${p.handle}.jpg`);
  fs.writeFileSync(prodFile, buf);

  const artFile = path.join(ART_DIR, `${p.handle}.jpg`);
  try {
    const det = await detectArtwork(buf);
    const { x0, y0, x1, y1 } = det.art;
    const w = Math.round(x1 - x0), h = Math.round(y1 - y0);
    if (w < 10 || h < 10) throw new Error('degenerate crop');
    await sharp(buf).extract({ left: Math.round(x0), top: Math.round(y0), width: w, height: h }).jpeg({ quality: 92 }).toFile(artFile);
    if (det.warn) warnings.push({ handle: p.handle, warn: det.warn });
  } catch (e) {
    await sharp(buf).jpeg({ quality: 92 }).toFile(artFile);
    warnings.push({ handle: p.handle, error: `detectArtwork failed: ${e.message}, used full image` });
  }
  if (i % 20 === 0) console.log(`processed ${i}/${products.length}`);
}

fs.writeFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/prod-crop-warnings.json', JSON.stringify(warnings, null, 2));
console.log('DONE. total:', products.length, 'warnings/errors:', warnings.length);
console.log(JSON.stringify(warnings, null, 2));
