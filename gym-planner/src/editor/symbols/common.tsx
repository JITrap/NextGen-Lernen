/**
 * Gemeinsame Typen, Farben und Zeichenhelfer des Symbolsystems.
 *
 * Alle Renderer zeichnen in LOKALEN Objektkoordinaten (cm): Ursprung = Objektmitte,
 * Breite entlang x, Tiefe entlang y, „vorne“ = +y (bei Rotation 0 unten).
 * Rotation und Translation übernimmt die aufrufende Konva-Group.
 * Strichbreiten/Griffe werden mit `px` (= 1 / scale) multipliziert, damit sie auf dem Bildschirm konstant bleiben.
 */
import type { ReactElement } from 'react';
import { Circle, Line, Rect } from 'react-konva';
import type { EquipmentDef, LibraryArea, PlacedItem, SymbolKind } from '@/types';

/* ------------------------------------------------------------------ */
/* Typen                                                               */
/* ------------------------------------------------------------------ */

export interface ItemSymbolProps {
  item: PlacedItem;
  /** Bibliotheksdefinition (undefined, wenn unbekannt → generisches Symbol). */
  def: EquipmentDef | undefined;
  /** Pixel pro cm (viewport.scale, gern auf 2 Nachkommastellen gerundet). */
  scale: number;
  dark: boolean;
  selected: boolean;
  colliding: boolean;
  hovered: boolean;
}

/** Props, die jeder Symbol-Renderer bekommt (Farben bereits nach Zustand aufgelöst). */
export interface SymbolRenderProps extends ItemSymbolProps {
  kind: SymbolKind;
  /** Breite (x) und Tiefe (y) in cm. */
  w: number;
  d: number;
  /** Flächenfarbe und Umriss (inkl. Kollision/Sperre/Auswahl). */
  fill: string;
  stroke: string;
  /** Farbe für Detail-Linien innerhalb der Silhouette. */
  ink: string;
  /** Hellere Detailfläche (Polster, Sitz, Ablage) und dunklere Detailfläche (Rahmen, Turm). */
  light: string;
  shade: string;
  /** Umriss-Strichbreite (cm, Bildschirm-konstant) und Detail-Strichbreite. */
  sw: number;
  lw: number;
  /** 1 / scale: ein Bildschirm-Pixel in cm. */
  px: number;
}

export type SymbolRenderer = (p: SymbolRenderProps) => ReactElement;

/* ------------------------------------------------------------------ */
/* Farben                                                              */
/* ------------------------------------------------------------------ */

export interface AreaColor {
  fill: string;
  stroke: string;
}

/** Farben je Bibliotheks-Bereich (Hellmodus). */
export const SYMBOL_COLORS: Record<LibraryArea, AreaColor> = {
  'Kraftgeräte': { fill: '#c7d2e3', stroke: '#475569' },
  'Freihantel-Zubehör': { fill: '#d9e0ea', stroke: '#526175' },
  'Cardio': { fill: '#fdd0bf', stroke: '#c2410c' },
  'Functional': { fill: '#bbf0cb', stroke: '#15803d' },
  'Empfang & Lounge': { fill: '#e7e2dc', stroke: '#78716c' },
  'Umkleide': { fill: '#a8eef7', stroke: '#0e7490' },
  'Sanitär': { fill: '#cbf6fb', stroke: '#0891b2' },
  'Wellness': { fill: '#fdd6a8', stroke: '#c2410c' },
  'Kursraum': { fill: '#e6d3fb', stroke: '#7e22ce' },
  'Büro & Personal': { fill: '#e4e6ea', stroke: '#6b7280' },
  'Lager & Technik': { fill: '#d9d4d0', stroke: '#57534e' },
  'Ausstattung': { fill: '#e2e8f0', stroke: '#64748b' },
  'Bauelemente': { fill: '#94a3b8', stroke: '#1e293b' },
  'Eigene': { fill: '#c9d1fb', stroke: '#4338ca' },
};

/** Farben je Bibliotheks-Bereich (Dunkelmodus). */
export const SYMBOL_COLORS_DARK: Record<LibraryArea, AreaColor> = {
  'Kraftgeräte': { fill: '#3b4a63', stroke: '#a3b1c6' },
  'Freihantel-Zubehör': { fill: '#3a4557', stroke: '#9aa8bd' },
  'Cardio': { fill: '#6b2f1c', stroke: '#fb923c' },
  'Functional': { fill: '#1b4d2e', stroke: '#4ade80' },
  'Empfang & Lounge': { fill: '#4a443f', stroke: '#b5aca4' },
  'Umkleide': { fill: '#164e63', stroke: '#67e8f9' },
  'Sanitär': { fill: '#155e75', stroke: '#22d3ee' },
  'Wellness': { fill: '#733b17', stroke: '#fdba74' },
  'Kursraum': { fill: '#4c1d80', stroke: '#d8b4fe' },
  'Büro & Personal': { fill: '#3b4250', stroke: '#a1a8b5' },
  'Lager & Technik': { fill: '#48423e', stroke: '#b3aaa4' },
  'Ausstattung': { fill: '#334155', stroke: '#94a3b8' },
  'Bauelemente': { fill: '#5b6b82', stroke: '#e2e8f0' },
  'Eigene': { fill: '#33307a', stroke: '#a5b4fc' },
};

/** Symbole mit fester Signalfarbe (unabhängig vom Bereich). */
const SPECIAL_COLORS: Partial<Record<SymbolKind, { light: AreaColor; dark: AreaColor }>> = {
  'extinguisher': { light: { fill: '#ef4444', stroke: '#991b1b' }, dark: { fill: '#dc2626', stroke: '#fecaca' } },
  'first-aid': { light: { fill: '#22c55e', stroke: '#166534' }, dark: { fill: '#16a34a', stroke: '#bbf7d0' } },
  'aed': { light: { fill: '#22c55e', stroke: '#166534' }, dark: { fill: '#16a34a', stroke: '#bbf7d0' } },
  'exit-sign': { light: { fill: '#16a34a', stroke: '#14532d' }, dark: { fill: '#15803d', stroke: '#bbf7d0' } },
};

export function areaColors(area: LibraryArea | undefined, dark: boolean): AreaColor {
  const table = dark ? SYMBOL_COLORS_DARK : SYMBOL_COLORS;
  return (area && table[area]) || table['Eigene'];
}

/** Grundfarben eines Symbols: Signalfarbe (Feuerlöscher, AED …) vor Bereichsfarbe. */
export function symbolColors(kind: SymbolKind, area: LibraryArea | undefined, dark: boolean): AreaColor {
  const special = SPECIAL_COLORS[kind];
  if (special) return dark ? special.dark : special.light;
  return areaColors(area, dark);
}

export interface StatePalette {
  danger: string;
  dangerFill: string;
  accent: string;
  hover: string;
  /** Mischfarbe für gesperrte Objekte (entsättigen). */
  lockedMix: string;
  /** Text- und Marker-Farben. */
  text: string;
  warn: string;
  water: string;
}

export function statePalette(dark: boolean): StatePalette {
  return dark
    ? { danger: '#f87171', dangerFill: '#b91c1c', accent: '#60a5fa', hover: '#93c5fd', lockedMix: '#475569', text: '#f1f5f9', warn: '#fbbf24', water: '#38bdf8' }
    : { danger: '#dc2626', dangerFill: '#ef4444', accent: '#2563eb', hover: '#3b82f6', lockedMix: '#cbd5e1', text: '#0f172a', warn: '#d97706', water: '#7dd3fc' };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mischt zwei Hex-Farben; t = Anteil von b (0..1). Ungültige Eingaben liefern a. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const k = Math.max(0, Math.min(1, t));
  return toHex(ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k);
}

/** Hex-Farbe als rgba() mit Alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, alpha))})`;
}

/* ------------------------------------------------------------------ */
/* Zeichenhelfer (je genau ein Konva-Node)                             */
/* ------------------------------------------------------------------ */

/** Grundfläche als Rechteck um den Ursprung. */
export function Body({ w, d, fill, stroke, sw, r = 0, opacity }: { w: number; d: number; fill: string; stroke: string; sw: number; r?: number; opacity?: number }) {
  return <Rect x={-w / 2} y={-d / 2} width={w} height={d} fill={fill} stroke={stroke} strokeWidth={sw} cornerRadius={r} opacity={opacity} listening={false} perfectDrawEnabled={false} />;
}

/** Grundfläche als Kreis (Durchmesser = 2r) um den Ursprung. */
export function Disc({ r, fill, stroke, sw, x = 0, y = 0, dash }: { r: number; fill?: string; stroke?: string; sw: number; x?: number; y?: number; dash?: number[] }) {
  return <Circle x={x} y={y} radius={Math.max(0.1, r)} fill={fill} stroke={stroke} strokeWidth={sw} dash={dash} listening={false} perfectDrawEnabled={false} />;
}

/** Abgerundetes Rechteck mit Mittelpunkt (x, y). */
export function Pad({ x, y, w, h, fill, stroke, sw = 0, r }: { x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; r?: number }) {
  const rr = r ?? Math.min(w, h) * 0.2;
  return <Rect x={x - w / 2} y={y - h / 2} width={Math.max(0.1, w)} height={Math.max(0.1, h)} fill={fill} stroke={stroke} strokeWidth={sw} cornerRadius={rr} listening={false} perfectDrawEnabled={false} />;
}

/** Rechteck mit linker oberer Ecke (x, y). */
export function Box({ x, y, w, h, fill, stroke, sw = 0, r = 0, dash }: { x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; r?: number; dash?: number[] }) {
  return <Rect x={x} y={y} width={Math.max(0.1, w)} height={Math.max(0.1, h)} fill={fill} stroke={stroke} strokeWidth={sw} cornerRadius={r} dash={dash} listening={false} perfectDrawEnabled={false} />;
}

/** Polylinie/Polygon; `pts` flach [x0, y0, x1, y1, …]. */
export function Poly({ pts, fill, stroke, sw = 0, closed = false, tension, dash, cap }: { pts: number[]; fill?: string; stroke?: string; sw?: number; closed?: boolean; tension?: number; dash?: number[]; cap?: 'butt' | 'round' | 'square' }) {
  return <Line points={pts} fill={fill} stroke={stroke} strokeWidth={sw} closed={closed} tension={tension} dash={dash} lineCap={cap} lineJoin="round" listening={false} perfectDrawEnabled={false} />;
}

/**
 * Parallele Balken als EIN Konva-Node: eine dicke gestrichelte Linie entlang `axis`.
 * axis 'x': Linie von `from` bis `to` bei y = `at`, jeder Strich ist ein senkrechter Balken der Breite `bar`
 * und Höhe `thickness`, Abstand `step`. axis 'y' entsprechend gedreht (waagerechte Balken).
 */
export function Bars({ axis, from, to, at, thickness, step, bar, color, offset = 0 }: { axis: 'x' | 'y'; from: number; to: number; at: number; thickness: number; step: number; bar: number; color: string; offset?: number }) {
  const s = Math.max(step, bar + 0.01);
  const pts = axis === 'x' ? [from, at, to, at] : [at, from, at, to];
  return <Line points={pts} stroke={color} strokeWidth={Math.max(0.1, thickness)} dash={[Math.max(0.01, bar), s - bar]} dashOffset={-offset} listening={false} perfectDrawEnabled={false} />;
}

/** Punktreihe als EIN Konva-Node (gestrichelte Linie mit runden Enden und 0-Länge-Strichen). */
export function Dots({ axis, from, to, at, step, size, color }: { axis: 'x' | 'y'; from: number; to: number; at: number; step: number; size: number; color: string }) {
  const pts = axis === 'x' ? [from, at, to, at] : [at, from, at, to];
  return <Line points={pts} stroke={color} strokeWidth={Math.max(0.1, size)} dash={[0.01, Math.max(0.02, step - 0.01)]} lineCap="round" listening={false} perfectDrawEnabled={false} />;
}

/** Ganzzahl im Bereich [lo, hi]. */
export function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Numerischer Parameter aus item.params oder def.params. */
export function numParam(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined, key: string): number | null {
  const raw = item.params?.[key] ?? def?.params?.[key];
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** String-Parameter aus item.params oder def.params (leer, wenn nicht gesetzt). */
export function strParam(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined, key: string): string {
  const raw = item.params?.[key] ?? def?.params?.[key];
  return raw == null ? '' : String(raw);
}

/** Stöcke (Fächer übereinander) einer Spindreihe: params.stoeckig, 1–4 (Standard 1). */
export function lockerTiers(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined): number {
  const n = numParam(item, def, 'stoeckig');
  return n != null && n >= 1 ? clampInt(n, 1, 4) : 1;
}
/**
 * Abteile (Spalten) einer Spindreihe = Fächer ÷ Stöcke (aufgerundet); ohne params.faecher aus der Breite:
 * Breite / Abteilbreite (params.abteilbreite, sonst 40 cm). Die Breite der Reihe ist Abteile × Abteilbreite.
 */
export function lockerColumns(item: Pick<PlacedItem, 'params' | 'width'>, def: EquipmentDef | undefined): number {
  const n = numParam(item, def, 'faecher');
  if (n != null && n >= 1) return clampInt(Math.ceil(n / lockerTiers(item, def)), 1, 200);
  const ab = numParam(item, def, 'abteilbreite');
  return clampInt(item.width / (ab != null && ab >= 5 ? ab : 40), 1, 200);
}
/** Anzahl Fächer einer Spindreihe (Kapazität): params.faecher, sonst Abteile × Stöcke. */
export function lockerCount(item: Pick<PlacedItem, 'params' | 'width'>, def: EquipmentDef | undefined): number {
  const n = numParam(item, def, 'faecher');
  if (n != null && n >= 1) return clampInt(n, 1, 200);
  return clampInt(lockerColumns(item, def) * lockerTiers(item, def), 1, 200);
}
