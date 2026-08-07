/* Lilie aus dem Floral-Poster: Weißpunkt-Angleich an Seitenpapier (#FCFBF7)
   + weiche Verlaufskanten statt Freisteller. */
import sharp from 'sharp';
const S = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad';

const crop = { left: 900, top: 1075, width: 700, height: 635 };
const { data, info } = await sharp(`${S}/floral.jpg`).extract(crop).raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;

// Hintergrund im Crop messen (linke obere Ecke = freie Fläche)
const bg = [data[0], data[1], data[2]];
const target = [0xFC, 0xFB, 0xF7];
const gain = [target[0] / bg[0], target[1] / bg[1], target[2] / bg[2]];

const rgba = Buffer.alloc(w * h * 4);
const FADE = 150;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = y * w + x;
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.min(255, Math.round(data[i * 3 + c] * gain[c]));
    const ax = Math.min(1, x / FADE);  // linke Kante weich
    const ay = Math.min(1, y / FADE);  // obere Kante weich (nach Flip = unten)
    rgba[i * 4 + 3] = Math.round(255 * Math.min(ax, ay));
  }
}
// Für oben-rechts: vertikal spiegeln (harte Kanten dann oben+rechts)
await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).flip().png().toFile(`${S}/lily-topright.png`);
// Vorschau auf Seitenpapier mit fake H1
const lily = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).flip().resize(480).png().toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#FCFBF7"/><text x="90" y="210" font-family="sans-serif" font-size="52" font-weight="bold" fill="#0B0B0C">QUEENS — Feminine Energy</text><rect x="90" y="238" width="64" height="4" fill="#E4A7B6"/></svg>`;
await sharp(Buffer.from(svg)).composite([{ input: lily, left: 1200 - 480, top: 0 }]).jpeg({ quality: 90 }).toFile(`${S}/lily-preview.jpg`);
console.log('ok');
