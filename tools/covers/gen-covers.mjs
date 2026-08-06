/* LimitlessPoster — Kategorie-Cover-Generator
   System "Open Frame Cartography": Carbon-Tafel, Felder wiederholter Marken,
   monumentale, an der Kante beschnittene Lettern, Mikro-Etiketten, ein
   Cobalt-Signal pro Blatt. 1600×2000, deterministisch. */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FONT = resolve(ROOT, '../poster3d-v4/fonts/SpaceGrotesk.ttf');
const W = 1600, H = 2000;
const CARBON = '#0B0B0C', PAPER = '#FCFBF7', IVORY = '#F4F1EA',
  COBALT = '#3157FF', GRAPHITE = '#55575C', WARM = '#CEC8BD';

let seed = 20260806;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function frame({ bg, fg, eyebrow, index, marks, display, accentNote }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.04 0"/>
      <feComposite operator="over" in2="SourceGraphic"/></filter>
    <radialGradient id="vig" cx="0.5" cy="0.42" r="0.9">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${bg === IVORY ? 0.05 : 0.32}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${bg}" filter="url(#grain)"/>
  ${marks}
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <text x="96" y="150" font-family="Space Grotesk" font-size="30" letter-spacing="10" fill="${fg}" opacity="0.92">${esc(eyebrow)}</text>
  <text x="${W - 96}" y="150" text-anchor="end" font-family="Space Grotesk" font-size="30" letter-spacing="8" fill="${fg}" opacity="0.55">${index} / 08</text>
  <line x1="96" y1="184" x2="${W - 96}" y2="184" stroke="${fg}" stroke-opacity="0.22" stroke-width="2"/>
  ${display}
  ${accentNote}
  <line x1="96" y1="${H - 150}" x2="${W - 96}" y2="${H - 150}" stroke="${fg}" stroke-opacity="0.22" stroke-width="2"/>
  <text x="96" y="${H - 96}" font-family="Space Grotesk" font-size="26" letter-spacing="7" fill="${fg}" opacity="0.6">LIMITLESSPOSTER</text>
  <text x="${W - 96}" y="${H - 96}" text-anchor="end" font-family="Space Grotesk" font-size="26" letter-spacing="7" fill="${fg}" opacity="0.6">KURATIERTE WANDKUNST</text>
</svg>`;
}

/* Monumentale Lettern: eine Solid-Zeile + optional eine Outline-Zeile (Markenmotiv),
   bewusst an der linken Kante beschnitten. */
function display2(fg, line1, line2, size, y, outlineSecond = true) {
  const common = `font-family="Space Grotesk" font-size="${size}" letter-spacing="${Math.round(size * 0.01)}"`;
  let s = `<text x="-14" y="${y}" ${common} fill="${fg}" stroke="${fg}" stroke-width="${size * 0.012}">${esc(line1)}</text>`;
  if (line2) {
    const y2 = y + size * 0.94;
    s += outlineSecond
      ? `<text x="-14" y="${y2}" ${common} fill="none" stroke="${fg}" stroke-width="${Math.max(2.4, size * 0.008)}">${esc(line2)}</text>`
      : `<text x="-14" y="${y2}" ${common} fill="${fg}" stroke="${fg}" stroke-width="${size * 0.012}">${esc(line2)}</text>`;
  }
  return s;
}

const covers = {};

/* 01 NEW DROP — Feld aus Plus-Marken, ein Cobalt-Plus fällt aus dem Raster */
covers['new-drop'] = () => {
  let m = '';
  const cols = 12, rows = 11, x0 = 96, y0 = 320, dx = (W - 192) / (cols - 1), dy = 96;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * dx, y = y0 + r * dy;
    const o = 0.10 + 0.5 * Math.pow(1 - r / rows, 1.6) * (0.55 + 0.45 * Math.sin(c * 1.7 + r));
    const s = 11;
    m += `<path d="M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}" stroke="${PAPER}" stroke-opacity="${o.toFixed(3)}" stroke-width="2.6"/>`;
  }
  const ax = x0 + 8.5 * dx, ay = y0 + 3 * dy + 48;
  m += `<circle cx="${ax}" cy="${ay}" r="46" fill="none" stroke="${COBALT}" stroke-width="2.4" stroke-dasharray="4 7"/>`;
  m += `<path d="M${ax - 22} ${ay}H${ax + 22}M${ax} ${ay - 22}V${ay + 22}" stroke="${COBALT}" stroke-width="6"/>`;
  return frame({
    bg: CARBON, fg: PAPER, eyebrow: 'DIE NEUESTEN MOTIVE', index: '01',
    marks: m,
    display: display2(PAPER, 'NEW', 'DROP', 330, 1500),
    accentNote: `<text x="${ax + 66}" y="${ay + 9}" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">JETZT</text>`,
  });
};

/* 02 APEX — Ideallinien-Bögen laufen auf einen vermessenen Scheitelpunkt zu */
covers['apex-motorsport-cars'] = () => {
  let m = '';
  const cx = 1320, cy = 760;
  for (let i = 0; i < 26; i++) {
    const r = 150 + i * 52 + (i * i) * 1.1;
    const o = 0.34 - i * 0.011;
    if (o <= 0.03) continue;
    m += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PAPER}" stroke-opacity="${o.toFixed(3)}" stroke-width="${i % 5 === 0 ? 2.6 : 1.4}"/>`;
  }
  m = `<clipPath id="apexclip"><rect x="0" y="230" width="${W}" height="${H - 230 - 440}"/></clipPath><g clip-path="url(#apexclip)">` + m + '</g>';
  m += `<line x1="${cx - 90}" y1="${cy}" x2="${cx + 90}" y2="${cy}" stroke="${COBALT}" stroke-width="2.4"/>`;
  m += `<line x1="${cx}" y1="${cy - 90}" x2="${cx}" y2="${cy + 90}" stroke="${COBALT}" stroke-width="2.4"/>`;
  m += `<circle cx="${cx}" cy="${cy}" r="14" fill="${COBALT}"/>`;
  m += `<circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="${COBALT}" stroke-width="2.4"/>`;
  return frame({
    bg: CARBON, fg: PAPER, eyebrow: 'MOTORSPORT & CARS', index: '02',
    marks: m,
    display: display2(PAPER, 'APEX', null, 430, 1620),
    accentNote: `<text x="${cx - 620}" y="${cy + 9}" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">SCHEITELPUNKT</text>`,
  });
};

/* 03 GRIT — radialer Schlag aus kurzen Strichen, ein Cobalt-Strich */
covers['grit-boxing-mma'] = () => {
  let m = '';
  const cx = 560, cy = 800;
  seed = 977;
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = 130 + rnd() * 620;
    const len = 26 + rnd() * 110 * (1 - r0 / 900);
    const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0;
    const x2 = cx + Math.cos(a) * (r0 + len), y2 = cy + Math.sin(a) * (r0 + len);
    if (y1 > H - 470 || y2 > H - 470) continue;
    const o = 0.12 + rnd() * 0.4;
    m += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${PAPER}" stroke-opacity="${o.toFixed(3)}" stroke-width="${(1.2 + rnd() * 2.4).toFixed(2)}"/>`;
  }
  m += `<line x1="${cx + 150}" y1="${cy - 100}" x2="${cx + 320}" y2="${cy - 213}" stroke="${COBALT}" stroke-width="5"/>`;
  m += `<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${PAPER}" stroke-width="2.4"/>`;
  return frame({
    bg: CARBON, fg: PAPER, eyebrow: 'BOXING & MMA', index: '03',
    marks: m,
    display: display2(PAPER, 'GRIT', null, 430, 1620),
    accentNote: `<text x="${cx + 340}" y="${cy - 228}" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">EINSCHLAG</text>`,
  });
};

/* 04 LEGENDS — aufsteigende Ranglisten-Striche, Stern am Gipfel */
covers['legends-sports-icons'] = () => {
  let m = '';
  const steps = 17;
  for (let i = 0; i < steps; i++) {
    const y = 1330 - i * 62;
    const wLine = 180 + i * 62;
    const x = 96;
    m += `<line x1="${x}" y1="${y}" x2="${x + wLine}" y2="${y}" stroke="${PAPER}" stroke-opacity="${(0.14 + i * 0.028).toFixed(3)}" stroke-width="${i === steps - 1 ? 3.4 : 2}"/>`;
    m += `<text x="${x + wLine + 22}" y="${y + 9}" font-family="Space Grotesk" font-size="22" letter-spacing="3" fill="${PAPER}" opacity="${(0.12 + i * 0.02).toFixed(3)}">${String(steps - i).padStart(2, '0')}</text>`;
  }
  const sx = 96 + 180 + (steps - 1) * 62 + 22 + 70, sy = 1330 - (steps - 1) * 62;
  const star = (cx, cy, R, r) => {
    let p = '';
    for (let k = 0; k < 10; k++) {
      const rad = k % 2 === 0 ? R : r, a = -Math.PI / 2 + k * Math.PI / 5;
      p += `${k ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`;
    }
    return p + 'Z';
  };
  m += `<path d="${star(sx, sy - 8, 40, 17)}" fill="none" stroke="${COBALT}" stroke-width="3"/>`;
  return frame({
    bg: CARBON, fg: PAPER, eyebrow: 'SPORTS ICONS', index: '04',
    marks: m,
    display: display2(PAPER, 'LEGENDS', null, 300, 1600),
    accentNote: `<text x="${sx - 210}" y="${sy - 76}" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">ERSTER PLATZ</text>`,
  });
};

/* 05 MINDSET — Balken-Treppe mit Bruchpunkt in Cobalt */
covers['mindset-words-ambition'] = () => {
  let m = '';
  const n = 30, x0 = 96, gap = (W - 192) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap + gap / 2;
    const hBar = 90 + Math.pow(i / n, 1.7) * 760;
    const y1 = 1300, y0b = y1 - hBar;
    const isAccent = i === 22;
    m += `<line x1="${x.toFixed(1)}" y1="${y0b.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y1}" stroke="${isAccent ? COBALT : PAPER}" stroke-opacity="${isAccent ? 1 : (0.16 + (i / n) * 0.5).toFixed(3)}" stroke-width="${isAccent ? 7 : 3}"/>`;
    if (i % 6 === 0) m += `<line x1="${x.toFixed(1)}" y1="1316" x2="${x.toFixed(1)}" y2="1330" stroke="${PAPER}" stroke-opacity="0.4" stroke-width="2"/>`;
  }
  m += `<line x1="${x0}" y1="1300" x2="${W - 96}" y2="1300" stroke="${PAPER}" stroke-opacity="0.35" stroke-width="2"/>`;
  const ax = x0 + 22 * gap + gap / 2;
  m += `<path d="M${ax - 14} ${1300 - 90 - Math.pow(22 / n, 1.7) * 760 - 44} l14 -26 l14 26" fill="none" stroke="${COBALT}" stroke-width="3"/>`;
  return frame({
    bg: CARBON, fg: PAPER, eyebrow: 'WORDS & AMBITION', index: '05',
    marks: m,
    display: display2(PAPER, 'MIND', 'SET', 330, 1500),
    accentNote: `<text x="${ax + 30}" y="${1300 - 90 - Math.pow(22 / n, 1.7) * 760 - 50}" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">WACHSTUM</text>`,
  });
};

/* 06 STILL — die Pause im Regal: Elfenbein, Bogen, Horizont */
covers['still-quiet-luxury'] = () => {
  let m = '';
  m += `<line x1="96" y1="1210" x2="${W - 96}" y2="1210" stroke="${CARBON}" stroke-opacity="0.5" stroke-width="2"/>`;
  for (let i = 0; i < 7; i++) {
    const r = 300 + i * 26;
    m += `<path d="M ${800 - r} 1210 A ${r} ${r} 0 0 1 ${800 + r} 1210" fill="none" stroke="${CARBON}" stroke-opacity="${(0.6 - i * 0.08).toFixed(2)}" stroke-width="${i === 0 ? 3 : 1.6}"/>`;
  }
  m += `<circle cx="800" cy="770" r="9" fill="${COBALT}"/>`;
  for (let i = 0; i < 24; i++) {
    const x = 96 + i * ((W - 192) / 23);
    m += `<line x1="${x.toFixed(1)}" y1="1210" x2="${x.toFixed(1)}" y2="1222" stroke="${CARBON}" stroke-opacity="0.35" stroke-width="1.6"/>`;
  }
  return frame({
    bg: IVORY, fg: CARBON, eyebrow: 'QUIET LUXURY', index: '06',
    marks: m,
    display: `<text x="-14" y="1620" font-family="Space Grotesk" font-size="430" letter-spacing="4" fill="none" stroke="${CARBON}" stroke-width="3">STILL</text>`,
    accentNote: `<text x="838" y="779" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">RUHEPUNKT</text>`,
  });
};

/* 07 HERITAGE — kannelierte Säulenlinien, geisterhafte Serifen-Ziffern */
covers['heritage-timeless-classics'] = () => {
  let m = '';
  const groups = [260, 620, 980, 1340];
  for (const gx of groups) {
    for (let i = -4; i <= 4; i++) {
      const bow = Math.sqrt(1 - Math.pow(i / 5.2, 2));
      const x = gx + i * 24;
      const o = 0.12 + bow * 0.3;
      m += `<line x1="${x}" y1="330" x2="${x}" y2="1290" stroke="${PAPER}" stroke-opacity="${o.toFixed(3)}" stroke-width="${(1 + bow * 1.6).toFixed(2)}"/>`;
    }
    m += `<line x1="${gx - 110}" y1="330" x2="${gx + 110}" y2="330" stroke="${PAPER}" stroke-opacity="0.5" stroke-width="3"/>`;
    m += `<line x1="${gx - 110}" y1="1290" x2="${gx + 110}" y2="1290" stroke="${PAPER}" stroke-opacity="0.5" stroke-width="3"/>`;
  }
  m += `<text x="96" y="560" font-family="Space Grotesk" font-size="150" letter-spacing="30" fill="${PAPER}" opacity="0.07">MCMLIV</text>`;
  m += `<line x1="620" y1="810" x2="980" y2="810" stroke="${COBALT}" stroke-width="2.6" stroke-dasharray="2 10"/>`;
  return frame({
    bg: CARBON, fg: PAPER, eyebrow: 'TIMELESS CLASSICS', index: '07',
    marks: m,
    display: display2(PAPER, 'HERI', 'TAGE', 330, 1500),
    accentNote: `<text x="1000" y="819" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">SEIT JEHER</text>`,
  });
};

/* 08 ICONS — Vinyl-Rillen mit Wellenform-Sektor, Cobalt-Nadel */
covers['icons-music-culture'] = () => {
  let m = '';
  const cx = 800, cy = 820;
  for (let i = 0; i < 30; i++) {
    const r = 90 + i * 22;
    if (cy + r > H - 480) break;
    m += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PAPER}" stroke-opacity="${(0.1 + (i % 4 === 0 ? 0.22 : 0.06)).toFixed(3)}" stroke-width="${i % 4 === 0 ? 2 : 1.2}"/>`;
  }
  seed = 424242;
  let wave = `M ${cx - 470} ${cy}`;
  for (let x = -470; x <= 470; x += 10) {
    const amp = Math.max(0, 1 - Math.abs(x) / 470) * (26 + rnd() * 130);
    wave += ` L ${cx + x} ${(cy + (x / 10 % 2 === 0 ? -amp : amp)).toFixed(1)}`;
  }
  m += `<path d="${wave}" fill="none" stroke="${PAPER}" stroke-opacity="0.75" stroke-width="2.2"/>`;
  m += `<line x1="${cx + 320}" y1="${cy - 420}" x2="${cx + 90}" y2="${cy - 60}" stroke="${COBALT}" stroke-width="3"/>`;
  m += `<circle cx="${cx + 90}" cy="${cy - 60}" r="10" fill="${COBALT}"/>`;
  m += `<circle cx="${cx}" cy="${cy}" r="14" fill="${PAPER}"/>`;
  return frame({
    bg: CARBON, fg: PAPER, eyebrow: 'MUSIC & CULTURE', index: '08',
    marks: m,
    display: display2(PAPER, 'ICONS', null, 400, 1620),
    accentNote: `<text x="${cx + 330}" y="${cy - 436}" font-family="Space Grotesk" font-size="26" letter-spacing="6" fill="${COBALT}">TONSPUR</text>`,
  });
};

mkdirSync(resolve(ROOT, 'out'), { recursive: true });
for (const [handle, gen] of Object.entries(covers)) {
  const svg = gen();
  const r = new Resvg(svg, {
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Space Grotesk' },
    fitTo: { mode: 'width', value: W },
  });
  const png = r.render().asPng();
  writeFileSync(resolve(ROOT, `out/lp-cover-${handle}.png`), png);
  console.log(`lp-cover-${handle}.png`, (png.length / 1024).toFixed(0) + 'K');
}
