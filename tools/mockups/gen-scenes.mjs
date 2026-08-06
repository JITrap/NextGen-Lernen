/* Zwei Marken-Raumszenen (2048²) als Basis für Produkt-Mockups.
   Editorial-Illustrationsstil mit realistischem Licht — bewusst "styled set",
   kein Fake-Foto. Szene 1: Wohnbeispiel (warm) · Szene 2: Studio (kühl). */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const S = 2048;

const grain = `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.028 0"/>
  <feComposite operator="over" in2="SourceGraphic"/></filter>`;

/* Szene 1 — Wohnbeispiel: warme Wand, Eichenboden, Sideboard + Vase */
const wohn = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs>
    ${grain}
    <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F3EFE6"/><stop offset="0.55" stop-color="#ECE7DC"/><stop offset="1" stop-color="#E3DDD0"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C9AF8C"/><stop offset="1" stop-color="#B89C77"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.38" cy="0.3" r="0.75">
      <stop offset="0" stop-color="#FFFDF7" stop-opacity="0.5"/><stop offset="1" stop-color="#FFFDF7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#20211F"/><stop offset="1" stop-color="#141513"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="1560" fill="url(#wall)" filter="url(#grain)"/>
  <rect width="${S}" height="1560" fill="url(#glow)"/>
  <rect y="1500" width="${S}" height="60" fill="#F7F4EC"/>
  <rect y="1554" width="${S}" height="8" fill="#00000022"/>
  <rect y="1560" width="${S}" height="${S - 1560}" fill="url(#floor)"/>
  ${[0.14, 0.32, 0.5, 0.68, 0.86].map(f => `<line x1="${f * S}" y1="1560" x2="${(f - 0.06) * S}" y2="${S}" stroke="#00000018" stroke-width="3"/>`).join('')}
  <!-- Sideboard -->
  <g>
    <rect x="1210" y="1620" width="700" height="26" rx="6" fill="#0000002e" transform="skewX(-8)"/>
    <rect x="1150" y="1120" width="720" height="420" rx="10" fill="url(#sb)"/>
    <line x1="1150" y1="1330" x2="1870" y2="1330" stroke="#FCFBF733" stroke-width="2"/>
    <circle cx="1510" cy="1225" r="7" fill="#CEC8BD"/>
    <circle cx="1510" cy="1435" r="7" fill="#CEC8BD"/>
    <rect x="1178" y="1540" width="22" height="82" fill="#141513"/>
    <rect x="1820" y="1540" width="22" height="82" fill="#141513"/>
  </g>
  <!-- Vase mit Zweig -->
  <g stroke="#3A3B38" fill="none" stroke-width="7" stroke-linecap="round">
    <path d="M1620 1120 c-36 -10 -36 -110 0 -122 26 -8 60 -8 86 0 36 12 36 112 0 122 -26 8 -60 8 -86 0 Z" fill="#D8D2C4" stroke-width="5"/>
    <path d="M1663 1000 v-88 m0 30 c-40 -34 -60 -80 -52 -128 m52 96 c30 -30 48 -66 44 -110"/>
  </g>
  <!-- Bücher -->
  <g>
    <rect x="1268" y="1078" width="150" height="20" rx="3" fill="#8A8C91"/>
    <rect x="1284" y="1054" width="118" height="20" rx="3" fill="#B0526B"/>
    <rect x="1300" y="1030" width="86" height="20" rx="3" fill="#2E3A6E"/>
  </g>
  <rect width="${S}" height="${S}" fill="#0B0B0C" opacity="0.02"/>
</svg>`;

/* Szene 2 — Studio: Papierwand, Betonboden, Spot, Hocker + Pflanze */
const studio = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs>
    ${grain}
    <linearGradient id="wall2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F4F2ED"/><stop offset="1" stop-color="#E8E6E0"/>
    </linearGradient>
    <linearGradient id="floor2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C9C7C2"/><stop offset="1" stop-color="#B5B3AE"/>
    </linearGradient>
    <radialGradient id="spot" cx="0.42" cy="0.34" r="0.55">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.65"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="1600" fill="url(#wall2)" filter="url(#grain)"/>
  <ellipse cx="860" cy="700" rx="1150" ry="900" fill="url(#spot)"/>
  <rect y="1592" width="${S}" height="10" fill="#00000026"/>
  <rect y="1600" width="${S}" height="${S - 1600}" fill="url(#floor2)"/>
  <!-- Hocker -->
  <g>
    <ellipse cx="1600" cy="1930" rx="240" ry="30" fill="#00000024"/>
    <path d="M1440 1420 h320 a14 14 0 0 1 14 16 l-10 44 h-328 l-10 -44 a14 14 0 0 1 14 -16 Z" fill="#C79A62"/>
    <g stroke="#2A2B29" stroke-width="16" stroke-linecap="round">
      <line x1="1478" y1="1480" x2="1430" y2="1904"/>
      <line x1="1722" y1="1480" x2="1770" y2="1904"/>
      <line x1="1600" y1="1480" x2="1600" y2="1910"/>
    </g>
  </g>
  <!-- Pflanze links -->
  <g>
    <ellipse cx="360" cy="1962" rx="190" ry="26" fill="#00000022"/>
    <path d="M270 1720 h180 l-22 220 h-136 Z" fill="#373835"/>
    <g stroke="#3E4A3B" stroke-width="10" fill="none" stroke-linecap="round">
      <path d="M360 1720 c-10 -160 -80 -220 -150 -260"/>
      <path d="M360 1720 c0 -190 40 -260 120 -310"/>
      <path d="M360 1720 c20 -140 90 -180 170 -190"/>
      <path d="M355 1720 c-30 -120 -110 -140 -170 -140"/>
    </g>
  </g>
  <rect width="${S}" height="${S}" fill="#0B0B0C" opacity="0.02"/>
</svg>`;

mkdirSync(resolve(ROOT, 'scenes'), { recursive: true });
for (const [name, svg] of [['wohnbeispiel', wohn], ['studio', studio]]) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: S } });
  writeFileSync(resolve(ROOT, `scenes/${name}.png`), r.render().asPng());
  console.log(`scenes/${name}.png`);
}
