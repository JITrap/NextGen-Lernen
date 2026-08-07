/* R4 — Fotoszenen-Konfiguration für die Mockup-Pipeline.
   Alle Koordinaten in Original-Pixeln der Dateien in rooms/.
   Quad-Modell: vertikale Kanten bleiben vertikal (Kamera in Waage);
   slope kippt Ober-/Unterkante, taper verjüngt die ferne Kante. */

export const SCENES = {
  'living-warm': {
    file: 'rooms/living-warm.jpg',
    // Ersetzt den vorhandenen Rahmen an der Wand: Quad muss ihn überdecken.
    mode: 'cover',
    rect: { x0: 985, y0: 385, x1: 1305, y1: 805 },
    margin: 14,
    slope: 0, taper: 0,
    light: 'brightness(0.97)',
    shadow: '0 14px 26px rgba(11,11,12,0.30)',
  },
  office: {
    file: 'rooms/office.jpg',
    mode: 'top',                       // Oberkante fix (deckt den mittleren Bestandsrahmen ab)
    cx: 1100, topY: 228, ppm: 870,
    wPortrait: 0.47, wLandscape: 0.66,
    slope: 0, taper: 0,
    light: 'brightness(1.0)',
    shadow: '0 16px 30px rgba(11,11,12,0.22)',
  },
  'living-minimal': {
    file: 'rooms/living-minimal.jpg',
    mode: 'bottom',                    // Unterkante fix über dem Sofa
    cx: 1450, bottomY: 555, ppm: 590,
    wPortrait: 0.55, wLandscape: 0.85,
    slope: 0, taper: 0,
    light: 'brightness(1.0)',
    shadow: '0 14px 26px rgba(11,11,12,0.24)',
  },
  gym: {
    file: 'rooms/gym.jpg',
    mode: 'center',
    cx: 1080, cy: 570, ppm: 300,
    wPortrait: 0.57, wLandscape: 0.66,
    slope: 0.02, taper: 0.0002,
    light: 'brightness(0.96)',
    shadow: '0 10px 20px rgba(11,11,12,0.30)',
  },
  loft: {
    file: 'rooms/loft.jpg',
    mode: 'bottom',
    cx: 1360, bottomY: 1860, ppm: 450,
    wPortrait: 0.70, wLandscape: 1.05,
    slope: 0, taper: 0,
    light: 'brightness(0.84) saturate(0.97)',
    shadow: '0 18px 34px rgba(0,0,0,0.45)',
  },
  'bedroom-feminine': {
    file: 'rooms/bedroom-feminine.jpg',
    mode: 'center',
    cx: 535, cy: 600, ppm: 300,
    wPortrait: 0.61, wLandscape: 0.61,  // Landscape wird ohnehin umgeleitet
    slope: 0.02, taper: -0.0007,
    light: 'brightness(1.04)',
    shadow: '10px 12px 24px rgba(120,90,90,0.35)',
  },
};

/* Liefert das Ziel-Quad {tl,tr,br,bl} (je [x,y]) für ein Poster mit
   Seitenverhältnis ratio (Breite/Höhe der gerenderten PNG). */
export function quadFor(scene, ratio) {
  const s = scene;
  let w, h, cx, cy;
  if (s.mode === 'cover') {
    const needW = s.rect.x1 - s.rect.x0 + 2 * s.margin;
    const needH = s.rect.y1 - s.rect.y0 + 2 * s.margin;
    w = needW; h = w / ratio;
    if (h < needH) { h = needH; w = h * ratio; }
    cx = (s.rect.x0 + s.rect.x1) / 2; cy = (s.rect.y0 + s.rect.y1) / 2;
  } else {
    const wM = ratio < 1 ? s.wPortrait : s.wLandscape;
    w = wM * s.ppm; h = w / ratio;
    cx = s.cx;
    if (s.mode === 'top') cy = s.topY + h / 2;
    else if (s.mode === 'bottom') cy = s.bottomY - h / 2;
    else cy = s.cy;
  }
  const halfW = w / 2;
  const hL = h * (1 - (s.taper || 0) * halfW);
  const hR = h * (1 + (s.taper || 0) * halfW);
  const midYL = cy - (s.slope || 0) * halfW;
  const midYR = cy + (s.slope || 0) * halfW;
  return {
    tl: [cx - halfW, midYL - hL / 2],
    tr: [cx + halfW, midYR - hR / 2],
    br: [cx + halfW, midYR + hR / 2],
    bl: [cx - halfW, midYL + hL / 2],
  };
}

/* Kategorie→Szene. Priorität, falls ein Produkt in mehreren Kollektionen ist. */
export const CATEGORY_SCENES = [
  ['queens-feminine-energy', 'bedroom-feminine'],
  ['grit-boxing-mma', 'gym'],
  ['apex-motorsport-cars', 'loft'],
  ['icons-music-culture', 'loft'],
  ['heritage-timeless-classics', 'living-warm'],
  ['still-quiet-luxury', 'living-minimal'],
  ['legends-sports-icons', 'gym'],
  ['mindset-words-ambition', 'office'],
  ['film-series', 'loft'],
  ['artists', 'loft'],
  ['sports', 'gym'],
  ['statements', 'office'],
  ['quotes', 'office'],
];
export const FALLBACK_SCENE = 'living-warm';

/* Sonderfälle: Szenen, die bestimmte Formate nicht tragen. */
export function resolveScene(sceneKey, ratio) {
  if (ratio >= 1 && sceneKey === 'bedroom-feminine') return 'living-minimal';
  if (ratio >= 1 && sceneKey === 'gym') return 'loft';
  return sceneKey;
}
