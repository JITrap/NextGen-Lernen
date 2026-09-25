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

/** Rundet auf n Nachkommastellen (numerisch stabil für Anzeige). */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
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
 * Parst Nutzereingaben wie „3,5 m“, „350“, „3.5m“, „12,5 cm“ → cm.
 * Ohne Einheit wird `defaultUnit` angenommen.
 */
export function parseLength(input: string, defaultUnit: 'cm' | 'm' = 'cm'): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)(mm|cm|m)?$/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
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

/** Parst eine Dezimalzahl mit Komma oder Punkt. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '').replace(',', '.');
  if (!s) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Normalisiert Winkel auf [0, 360). */
export function normalizeAngle(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
