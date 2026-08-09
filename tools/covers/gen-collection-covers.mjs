/* Kollektions-Cover für die /collections-Übersicht: Artwork-Crop eines
   Hero-Produkts, 1200×1500 cover-gefüllt, dezenter Bodenscrim — OHNE Text
   (den Titel legt das Theme selbst über die Karte). */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ART = resolve(ROOT, '../poster3d-v4/out/art');
const OUT = resolve(ROOT, 'out-collections');
mkdirSync(OUT, { recursive: true });
const W = 1200, H = 1500;

const COLS = [
  ['new-drop', 'framed-poster-focus-on-you-black-panther-wall-art-vertical'],
  ['apex-motorsport-cars', 'ferrari-scuderia-formula-1-vertical-framed-poster'],
  ['grit-boxing-mma', 'sacrifice-today-own-tomorrow-framed-motivational-boxing-poster'],
  ['legends-sports-icons', 'framed-poster-messi-black-white-portrait-wall-art'],
  ['mindset-words-ambition', 'motivational-poster-no-excuses-just-results-vertical-wall-art'],
  ['still-quiet-luxury', 'leopard-on-branch-framed-poster-minimalist-wildlife-wall-art'],
  ['heritage-timeless-classics', 'no-risk-no-porsche-framed-poster-retro-palm-springs-wall-art'],
  ['icons-music-culture', 'framed-poster-crystal-gloved-hand-ok-sign-wall-art'],
  ['queens-feminine-energy', 'roaring-jaguar-floral-poster'],
  ['sports', 'discipline-motivational-poster-gym-wall-art'],
  ['statements', 'money-follows-value-framed-poster-motivational-office-wall-art'],
  ['film-series', 'self-respect-framed-poster-vintage-godfather-quote-wall-art'],
];

const scrim = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0.55" x2="0" y2="1">
    <stop offset="0" stop-color="#0B0B0C" stop-opacity="0"/>
    <stop offset="1" stop-color="#0B0B0C" stop-opacity="0.55"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`);

for (const [handle, hero] of COLS) {
  const src = resolve(ART, `${hero}.jpg`);
  if (!existsSync(src)) { console.log(handle, 'FEHLT:', hero); continue; }
  await sharp(src)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .composite([{ input: scrim }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(resolve(OUT, `lp-col-${handle}.jpg`));
  console.log(handle, 'ok');
}
