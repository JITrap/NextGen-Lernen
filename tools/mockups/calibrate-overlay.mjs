/* Zeichnet die Ziel-Quads (Portrait 2:3 rot, Landscape 3:2 blau) in jede Szene —
   zur visuellen Kalibrierung der Wandflächen. Ausgabe: out-calib/<szene>.jpg */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, quadFor, resolveScene } from './scenes-photo.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(ROOT, 'out-calib'), { recursive: true });

for (const [key, s] of Object.entries(SCENES)) {
  const img = sharp(resolve(ROOT, s.file));
  const { width, height } = await img.metadata();
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  for (const [ratio, color] of [[0.667, '#E5484D'], [1.5, '#3157FF']]) {
    if (resolveScene(key, ratio) !== key) continue;
    const q = quadFor(s, ratio);
    const pts = [q.tl, q.tr, q.br, q.bl].map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="6"/>`;
  }
  svg += '</svg>';
  const full = await img.composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  await sharp(full).resize({ width: 1400 }).jpeg({ quality: 80 }).toFile(resolve(ROOT, `out-calib/${key}.jpg`));
  console.log(key, 'ok');
}
