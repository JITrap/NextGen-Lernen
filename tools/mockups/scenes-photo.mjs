/* R4 — Fotoszenen-Konfiguration für die Mockup-Pipeline.
   Alle Koordinaten in Original-Pixeln der Dateien in rooms/.
   Quad-Modell: vertikale Kanten bleiben vertikal (Kamera in Waage);
   slope kippt Ober-/Unterkante, taper verjüngt die ferne Kante. */

export const SCENES = {
  'living-cozy': {
    file: 'rooms-frontal/living-cozy.jpg',
    mode: 'bottom', cx: 895, bottomY: 1290, ppm: 410,
    wPortrait: 0.75, wLandscape: 1.0,
    slope: 0, taper: 0,
    light: 'brightness(1.0)',
    shadow: '0 14px 26px rgba(60,45,30,0.30)',
  },
  office: {
    file: 'rooms/office.jpg',
    mode: 'top', cx: 1100, topY: 228, ppm: 870,
    wPortrait: 0.47, wLandscape: 0.66,
    slope: 0, taper: 0,
    light: 'brightness(1.0)',
    shadow: '0 16px 30px rgba(11,11,12,0.22)',
  },
  'living-minimal': {
    file: 'rooms/living-minimal.jpg',
    mode: 'bottom', cx: 1450, bottomY: 555, ppm: 590,
    wPortrait: 0.55, wLandscape: 0.85,
    slope: 0, taper: 0,
    light: 'brightness(1.0)',
    shadow: '0 14px 26px rgba(11,11,12,0.24)',
  },
  'living-warm': {
    file: 'rooms/living-warm.jpg',
    mode: 'cover',
    rect: { x0: 985, y0: 385, x1: 1305, y1: 805 },
    margin: 14,
    slope: 0, taper: 0,
    light: 'brightness(0.97)',
    shadow: '0 14px 26px rgba(11,11,12,0.30)',
  },
  'gym-frontal': {
    file: 'rooms-frontal/gym-frontal.jpg',
    mode: 'cover',
    rect: { x0: 129, y0: 838, x1: 492, y1: 1191 },
    margin: 16,
    slope: 0, taper: 0,
    light: 'brightness(0.94)',
    shadow: '0 12px 22px rgba(0,0,0,0.45)',
  },
  'loft-frontal': {
    file: 'rooms-frontal/loft-frontal.jpg',
    mode: 'center', cx: 775, cy: 335, ppm: 460,
    wPortrait: 0.61, wLandscape: 1.0,
    slope: 0, taper: 0,
    light: 'brightness(0.92)',
    shadow: '0 14px 26px rgba(0,0,0,0.5)',
  },
  'bedroom-feminine': {
    file: 'rooms-frontal/bedroom-feminine.jpg',
    mode: 'bottom', cx: 1700, bottomY: 1100, ppm: 750,
    wPortrait: 0.61, wLandscape: 0.61,
    slope: 0, taper: 0,
    light: 'brightness(1.03)',
    shadow: '0 16px 30px rgba(90,70,60,0.28)',
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
  ['grit-boxing-mma', 'gym-frontal'],
  ['apex-motorsport-cars', 'loft-frontal'],
  ['icons-music-culture', 'loft-frontal'],
  ['heritage-timeless-classics', 'living-cozy'],
  ['still-quiet-luxury', 'living-minimal'],
  ['legends-sports-icons', 'gym-frontal'],
  ['mindset-words-ambition', 'office'],
  ['film-series', 'loft-frontal'],
  ['artists', 'loft-frontal'],
  ['sports', 'gym-frontal'],
  ['statements', 'office'],
  ['quotes', 'office'],
];
export const FALLBACK_SCENE = 'living-cozy';

/* Sonderfälle: Szenen, die bestimmte Formate nicht tragen. */
export function resolveScene(sceneKey, ratio) {
  if (ratio >= 1 && sceneKey === 'bedroom-feminine') return 'living-cozy';
  if (ratio >= 1 && sceneKey === 'gym-frontal') return 'loft-frontal';
  return sceneKey;
}
