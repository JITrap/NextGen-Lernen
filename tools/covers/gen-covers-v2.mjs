/* LimitlessPoster — Kategorie-Cover v2: erkennbares Beispielprodukt statt
   abstrakter Grafik. Pro Kategorie wird das Artwork eines Hero-Produkts
   freigestellt (detectArtwork-Crop), auf 1600×2000 cover-gefüllt und mit
   Carbon-Scrim + Kategoriename (Space Grotesk) versehen.
   Unten bleiben ~190px textfrei (dort liegt der Hover-CTA der Kachel). */
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectArtwork } from '../poster3d-v4/detect-artwork.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FONT = resolve(ROOT, '../poster3d-v4/fonts/SpaceGrotesk.ttf');
const W = 1600, H = 2000;
const PAPER = '#FCFBF7', COBALT = '#3157FF';

const products = JSON.parse(readFileSync(resolve(ROOT, '../poster3d-v4/products.json'), 'utf8'));
const ovPath = resolve(ROOT, '../poster3d-v4/out/overrides.json');
const overrides = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, 'utf8')) : {};

const CATS = [
  { handle: 'new-drop', hero: 'framed-poster-focus-on-you-black-panther-wall-art-vertical', eyebrow: 'DIE NEUESTEN MOTIVE', name: 'NEW DROP', index: '01' },
  { handle: 'apex-motorsport-cars', hero: 'ferrari-scuderia-formula-1-vertical-framed-poster', eyebrow: 'MOTORSPORT & CARS', name: 'APEX', index: '02' },
  { handle: 'grit-boxing-mma', hero: 'sacrifice-today-own-tomorrow-framed-motivational-boxing-poster', eyebrow: 'BOXING & MMA', name: 'GRIT', index: '03' },
  { handle: 'legends-sports-icons', hero: 'framed-poster-messi-black-white-portrait-wall-art', eyebrow: 'SPORTS ICONS', name: 'LEGENDS', index: '04' },
  { handle: 'mindset-words-ambition', hero: 'motivational-poster-no-excuses-just-results-vertical-wall-art', eyebrow: 'WORDS & AMBITION', name: 'MINDSET', index: '05' },
  { handle: 'still-quiet-luxury', hero: 'leopard-on-branch-framed-poster-minimalist-wildlife-wall-art', eyebrow: 'QUIET LUXURY', name: 'STILL', index: '06' },
  { handle: 'heritage-timeless-classics', hero: 'no-risk-no-porsche-framed-poster-retro-palm-springs-wall-art', eyebrow: 'TIMELESS CLASSICS', name: 'HERITAGE', index: '07' },
  { handle: 'icons-music-culture', hero: 'framed-poster-crystal-gloved-hand-ok-sign-wall-art', eyebrow: 'MUSIC & CULTURE', name: 'ICONS', index: '08' },
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function overlaySvg({ eyebrow, name, index }) {
  // Displayschrift füllt die Breite, bleibt aber gedeckelt; unten 190px frei.
  const size = Math.min(300, Math.round((W - 176) / (name.length * 0.62)));
  const yName = H - 210;
  const yEyebrow = yName - size - 46;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0B0B0C" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#0B0B0C" stop-opacity="0.66"/>
      <stop offset="1" stop-color="#0B0B0C" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${H - 980}" width="${W}" height="980" fill="url(#scrim)"/>
  <g>
    <rect x="88" y="${yEyebrow - 30}" width="46" height="4" fill="${COBALT}"/>
    <text x="88" y="${yEyebrow + 26}" font-family="Space Grotesk" font-size="30" letter-spacing="9" fill="${PAPER}" opacity="0.9">${esc(eyebrow)}</text>
    <text x="82" y="${yName}" font-family="Space Grotesk" font-size="${size}" letter-spacing="${Math.round(size * 0.008)}" fill="${PAPER}" stroke="${PAPER}" stroke-width="${(size * 0.012).toFixed(1)}">${esc(name)}</text>
  </g>
</svg>`;
}

mkdirSync(resolve(ROOT, 'out'), { recursive: true });

for (const cat of CATS) {
  const p = products.find(x => x.handle === cat.hero);
  if (!p || !p.image) { console.log(`FEHLT: ${cat.handle} → ${cat.hero}`); continue; }
  const res = await fetch(p.image);
  if (!res.ok) { console.log(`FETCH ${res.status}: ${cat.hero}`); continue; }
  const src = Buffer.from(await res.arrayBuffer());

  let art;
  if (overrides[cat.hero]) art = overrides[cat.hero].art;
  else {
    const det = await detectArtwork(src);
    if (det.warn) { console.log(`WARN Erkennung ${cat.hero}:`, det.artAspect); }
    art = det.art;
  }
  const cut = await sharp(src)
    .extract({ left: art.x0, top: art.y0, width: art.x1 - art.x0, height: art.y1 - art.y0 })
    .toBuffer();

  const base = await sharp(cut)
    .resize(W, H, { fit: 'cover', position: sharp.strategy.attention })
    .modulate({ brightness: 0.99, saturation: 1.04 })
    .toBuffer();

  const overlay = new Resvg(overlaySvg(cat), {
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Space Grotesk' },
    fitTo: { mode: 'width', value: W },
  }).render().asPng();

  const out = resolve(ROOT, `out/lp-tile-${cat.handle}.jpg`);
  await sharp(base)
    .composite([{ input: overlay }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(out);
  console.log(`lp-tile-${cat.handle}.jpg ok (Hero: ${cat.hero})`);
}
