/* T12 — Thematisierte Kollektions-Templates nach dem Queens-Muster:
   Akzentfarben, Farbwäsche, Geistermotiv (Kollektionsbild, maskiert),
   Hero (Titel + Beschreibung) und identisches Produkt-Grid wie Queens. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = resolve(ROOT, '../../theme-v3/current/templates');

const queensRaw = readFileSync(resolve(TPL_DIR, 'collection.queens.json'), 'utf8');
const queens = JSON.parse(queensRaw.replace(/^\/\*[\s\S]*?\*\/\s*/, ''));

const CATS = [
  ['grit',        'GRIT',      '#B3382F', '#E06A5A', 'rgba(224,106,90,'],
  ['apex',        'APEX',      '#D5001C', '#FF6B5A', 'rgba(255,107,90,'],
  ['legends',     'LEGENDS',   '#2F6DB3', '#7FB2E8', 'rgba(127,178,232,'],
  ['icons',       'ICONS',     '#6E4FD1', '#B49CF2', 'rgba(180,156,242,'],
  ['heritage',    'HERITAGE',  '#A87A2E', '#E0BC77', 'rgba(224,188,119,'],
  ['still',       'STILL',     '#6F7D6A', '#AEC0A6', 'rgba(174,192,166,'],
  ['mindset',     'MINDSET',   '#2B2B2E', '#8E8E96', 'rgba(142,142,150,'],
  ['new-drop',    'NEW DROP',  '#3157FF', '#8FA4FF', 'rgba(143,164,255,'],
  ['sports',      'SPORTS',    '#1F7A4D', '#63C892', 'rgba(99,200,146,'],
  ['statements',  'STATEMENTS','#8A4B2F', '#D89B77', 'rgba(216,155,119,'],
  ['film-series', 'FILM',      '#5A4632', '#B39877', 'rgba(179,152,119,'],
];

function css(suffix, accent, bright, washRgba) {
  const M = `main[data-template="collection.${suffix}"]`;
  return `<style>
  /* — ${suffix.toUpperCase()}: Themen-Akzente — */
  ${M} { --lp-cobalt: ${accent}; --lp-cobalt-bright: ${bright}; }
  ${M} .price { color: ${accent}; }
  ${M} h1 { position: relative; z-index: 1; }
  ${M} h1::after { content: ""; display: block; width: 64px; height: 4px; background: ${bright}; margin-top: 12px; }
  ${M} product-card:hover .card-gallery,
  ${M} product-card:hover .product-card__gallery { box-shadow: 0 0 0 1px ${washRgba}0.55), 0 18px 36px rgba(11, 11, 12, 0.12); }
  ${M} a:hover { color: ${accent}; }
  ${M} :is(a, button, summary, select, input):focus-visible { outline-color: ${accent}; }
  ${M} .section,
  ${M} .section-background { background-color: transparent; }
  ${M} .lpcat-decor { position: absolute; pointer-events: none; z-index: -1; }
  ${M} .lpcat-ghost {
    top: 0; right: 0; width: min(420px, 34vw); height: auto; opacity: 0.10;
    -webkit-mask-image: linear-gradient(215deg, #000 30%, transparent 78%);
    mask-image: linear-gradient(215deg, #000 30%, transparent 78%);
  }
  ${M} .lpcat-wash {
    top: 60px; right: 0; width: min(880px, 96vw); height: 680px;
    background: radial-gradient(ellipse 62% 36% at 84% 38%, ${washRgba}0.12) 0%, ${washRgba}0.06) 45%, ${washRgba}0.02) 66%, ${washRgba}0) 82%);
  }
  @media (max-width: 749px) {
    ${M} .lpcat-ghost { width: 220px; }
    ${M} .lpcat-wash { top: 30px; height: 500px; }
  }
</style>
{% if collection.image %}<img class="lpcat-decor lpcat-ghost" src="{{ collection.image | image_url: width: 900 }}" alt="" aria-hidden="true" loading="lazy" width="900" height="1125">{% endif %}
<div class="lpcat-decor lpcat-wash" aria-hidden="true"></div>`;
}

for (const [suffix, , accent, bright, washRgba] of CATS) {
  const tpl = JSON.parse(JSON.stringify(queens));
  const style = tpl.sections['queens_style'];
  delete tpl.sections['queens_style'];
  style.settings.custom_liquid = css(suffix, accent, bright, washRgba);
  const key = suffix.replace(/-/g, '_') + '_style';
  tpl.sections = { [key]: style, ...tpl.sections };
  tpl.order = [key, ...tpl.order.filter(o => o !== 'queens_style')];
  writeFileSync(resolve(TPL_DIR, `collection.${suffix}.json`), JSON.stringify(tpl, null, 2));
  console.log(`collection.${suffix}.json ok`);
}
