/**
 * Koordinaten der 3D-Vorschau.
 * 1 three-Einheit = 1 m (Welt-cm / 100). y zeigt nach oben.
 * Welt-x → x, Welt-y (Plan, nach unten) → z.
 */
import type { Floor, Vec2 } from '@/types';

export const CM_PER_UNIT = 100;
/** Deckenstärke zwischen zwei Stockwerken (m). */
export const SLAB_M = 0.3;
/** Deckenhöhe, falls ein Stockwerk keine gültige hat (cm). */
export const FALLBACK_CEILING_CM = 300;

/** cm → three-Einheiten (m). */
export function cm(v: number): number {
  return v / CM_PER_UNIT;
}

/** Weltpunkt (cm) + Höhe (cm) → three-Vektor [x, y, z]. */
export function toScene(p: Vec2, heightCm = 0): [number, number, number] {
  return [p.x / CM_PER_UNIT, heightCm / CM_PER_UNIT, p.y / CM_PER_UNIT];
}

/** Drehung im Plan (Grad, im Uhrzeigersinn bei y nach unten) → Rotation um die three-y-Achse (rad). */
export function rotationY(deg: number): number {
  return (-deg * Math.PI) / 180;
}

/** Gültige Deckenhöhe eines Stockwerks in cm. */
export function ceilingCmOf(floor: Pick<Floor, 'ceilingHeight'>): number {
  const h = floor.ceilingHeight;
  return Number.isFinite(h) && h > 0 ? h : FALLBACK_CEILING_CM;
}

export interface FloorLevel {
  floor: Floor;
  /** Position in der sortierten Liste (0 = unterstes gerendertes Stockwerk). */
  index: number;
  /** Fußbodenoberkante (m). */
  level: number;
  /** Lichte Deckenhöhe (m). */
  ceiling: number;
  /** Deckenunterkante = level + ceiling (m). */
  top: number;
}

/**
 * Vertikale Anordnung der Stockwerke (sortiert nach order):
 * Versatz = Summe der Deckenhöhen darunter + je 0,3 m Decke. Unterstes Stockwerk liegt auf 0.
 */
export function floorLevels(floors: Floor[]): FloorLevel[] {
  const sorted = [...floors].sort((a, b) => a.order - b.order);
  let level = 0;
  return sorted.map((floor, index) => {
    const ceiling = cm(ceilingCmOf(floor));
    const entry: FloorLevel = { floor, index, level, ceiling, top: level + ceiling };
    level += ceiling + SLAB_M;
    return entry;
  });
}
