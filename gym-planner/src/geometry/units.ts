/**
 * Einheiten & Formatierung. Intern: 1 Einheit = 1 cm.
 * Anzeige mit Komma als Dezimaltrennzeichen (de-DE).
 */

const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nfFlex = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

export const CM_PER_M = 100;
export const CM_PER_INCH = 2.54;

export function cmToM(cm: number): number {
  return cm / CM_PER_M;
}
export function mToCm(m: number): number {
  return m * CM_PER_M;
}
export function inchToCm(inch: number): number {
  return inch * CM_PER_INCH;
}
export function cmToInch(cm: number): number {
  return cm / CM_PER_INCH;
}
export function lbsToKg(lbs: number): number {
  return lbs * 0.45359237;
}
/** cm² → m² */
export function cm2ToM2(cm2: number): number {
  return cm2 / (CM_PER_M * CM_PER_M);
}

/** Rundet auf n Nachkommastellen (numerisch stabil für Anzeige, symmetrisch für negative Werte, nie −0). */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  const r = Math.round((Math.abs(value) + Number.EPSILON) * f) / f;
  return r === 0 ? 0 : value < 0 ? -r : r;
}

/** „12,45 m²“ */
export function formatM2(m2: number): string {
  return `${nf2.format(round(m2, 2))} m²`;
}
/** Fläche aus cm² formatiert in m². */
export function formatAreaCm2(cm2: number): string {
  return formatM2(cm2ToM2(cm2));
}
/** „3,50 m“ */
export function formatM(cm: number): string {
  return `${nf2.format(round(cmToM(cm), 2))} m`;
}
/** „350 cm“ oder „12,5 cm“ */
export function formatCm(cm: number): string {
  return `${nfFlex.format(round(cm, 2))} cm`;
}
/** Automatisch: unter 100 cm in cm, sonst in m. */
export function formatLength(cm: number): string {
  return Math.abs(cm) < 100 ? formatCm(cm) : formatM(cm);
}
/** „B × T × H“, z. B. „165 × 203 × 246 cm“ */
export function formatDims(w: number, d: number, h: number | null | undefined): string {
  const parts = [nfFlex.format(round(w, 1)), nfFlex.format(round(d, 1))];
  if (h != null) parts.push(nfFlex.format(round(h, 1)));
  return `${parts.join(' × ')} cm`;
}
export function formatKg(kg: number): string {
  return `${nf0.format(Math.round(kg))} kg`;
}
export function formatKgM2(v: number): string {
  return `${nf1.format(round(v, 1))} kg/m²`;
}
export function formatEur(v: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}
export function formatPercent(v: number): string {
  return `${nf1.format(round(v, 1))} %`;
}
export function formatDegrees(v: number): string {
  return `${nfFlex.format(round(v, 1))}°`;
}
export function formatNumber(v: number, decimals = 2): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: decimals }).format(round(v, decimals));
}

/**
 * Normalisiert eine Zahl in Nutzerschreibweise auf JS-Syntax: Komma als Dezimaltrennzeichen („3,5“ – mit Ziffern
 * nach dem Komma, „3,“ ist eine unfertige Eingabe), Punkt als Dezimaltrennzeichen („3.5“, „.5“, „5.“),
 * Tausenderpunkte („1.000“, „12.500,5“ → Punkt vor genau drei Ziffern ohne Komma), Vorzeichen („+5“) und
 * Exponent („1e2“). null bei ungültiger Schreibweise.
 */
function normalizeNumber(s: string): string | null {
  if (s.includes(',')) {
    if (!/^[+-]?(?:\d[\d.]*)?,\d+(?:e[+-]?\d+)?$/.test(s)) return null;
    return s.replace(/\./g, '').replace(',', '.');
  }
  if (!/^[+-]?(?:\d[\d.]*|\.\d+)(?:e[+-]?\d+)?$/.test(s)) return null;
  if (/^[+-]?[1-9]\d{0,2}(?:\.\d{3})+(?:e[+-]?\d+)?$/.test(s)) return s.replace(/\./g, '');
  if ((s.match(/\./g) ?? []).length > 1) return null;
  return s;
}

/**
 * Parst Nutzereingaben wie „3,5 m“, „350“, „3.5m“, „12,5 cm“, „.5“, „+5“, „1e2“, „1.000“ (= 1000) → cm.
 * Ohne Einheit wird `defaultUnit` angenommen.
 */
export function parseLength(input: string, defaultUnit: 'cm' | 'm' = 'cm'): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^(.+?)(mm|cm|m)?$/);
  if (!m) return null;
  const num = normalizeNumber(m[1]);
  if (num == null) return null;
  const value = Number(num);
  if (!Number.isFinite(value)) return null;
  const unit = (m[2] ?? defaultUnit) as 'mm' | 'cm' | 'm';
  switch (unit) {
    case 'mm':
      return value / 10;
    case 'm':
      return value * CM_PER_M;
    default:
      return value;
  }
}

/** Parst eine Dezimalzahl mit Komma oder Punkt (auch „.5“, „+5“, „1e2“, „1.000“ = 1000). */
export function parseNumber(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const num = normalizeNumber(s);
  if (num == null) return null;
  const v = Number(num);
  return Number.isFinite(v) ? v : null;
}

/** Normalisiert Winkel auf [0, 360). */
export function normalizeAngle(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
