/**
 * Teilt eine Wand um ihre Öffnungen in massive Segmente (ohne CSG).
 * Alle Werte in cm: start/end entlang der Wandachse ab Wandanfang, bottom/top über dem Fußboden.
 */
import type { Opening, Wall } from '@/types';
import { wallLength } from '@/geometry/walls';

export interface WallSegment {
  /** Abstand ab Wandanfang (cm). */
  start: number;
  end: number;
  /** Unterkante über Fußboden (cm). */
  bottom: number;
  /** Oberkante über Fußboden (cm). */
  top: number;
}

const MIN_SIZE = 0.01;

/** Effektive Wandhöhe in cm (null/ungültig = Deckenhöhe). */
export function wallHeightOf(wall: Pick<Wall, 'height'>, ceiling: number): number {
  const h = wall.height;
  if (h != null && Number.isFinite(h) && h > 0) return h;
  return Number.isFinite(ceiling) && ceiling > 0 ? ceiling : 0;
}

interface Cut {
  a: number;
  b: number;
  bottom: number;
  top: number;
}

/**
 * Reine Funktion: Wand → Segmente.
 * - Links/rechts der Öffnung volle Höhe.
 * - Tür: Sturz von door.height bis Wandhöhe.
 * - Fenster: Brüstung von 0 bis sillHeight, Sturz ab sillHeight + height.
 * - Spiegel erzeugen keine Aussparung.
 * Öffnungen werden auf die Wandlänge begrenzt; überlappende Öffnungen werden horizontal zusammengefasst.
 */
export function wallSegments(wall: Pick<Wall, 'start' | 'end' | 'height'>, openings: Opening[], ceiling: number): WallSegment[] {
  const len = wallLength(wall);
  const height = wallHeightOf(wall, ceiling);
  if (len <= MIN_SIZE || height <= MIN_SIZE) return [];

  const cuts: Cut[] = [];
  for (const o of openings) {
    if (o.kind === 'mirror') continue;
    if (!(o.width > 0)) continue;
    const a = Math.max(0, o.offset - o.width / 2);
    const b = Math.min(len, o.offset + o.width / 2);
    const bottom = o.kind === 'window' ? Math.max(0, o.sillHeight) : 0;
    const top = Math.min(height, bottom + Math.max(0, o.height));
    if (b - a <= MIN_SIZE || top - bottom <= MIN_SIZE) continue;
    cuts.push({ a, b, bottom, top });
  }
  cuts.sort((p, q) => p.a - q.a);

  const out: WallSegment[] = [];
  let cursor = 0;
  for (const c of cuts) {
    const a = Math.max(c.a, cursor);
    if (c.b - a <= MIN_SIZE) continue; // liegt vollständig in einer vorherigen Öffnung
    if (a - cursor > MIN_SIZE) out.push({ start: cursor, end: a, bottom: 0, top: height });
    if (c.bottom > MIN_SIZE) out.push({ start: a, end: c.b, bottom: 0, top: c.bottom });
    if (height - c.top > MIN_SIZE) out.push({ start: a, end: c.b, bottom: c.top, top: height });
    cursor = c.b;
  }
  if (len - cursor > MIN_SIZE) out.push({ start: cursor, end: len, bottom: 0, top: height });
  return out;
}
