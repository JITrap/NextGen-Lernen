import type { Vec2, Wall, PlacedItem, Hall } from '@/types';
import { distance } from './polygon';
import { itemFootprint } from './transform';
import { wallMidpoint } from './walls';

export type SnapKind = 'none' | 'grid' | 'wall-end' | 'wall-mid' | 'item-edge' | 'angle' | 'hall-vertex';

export interface SnapGuide {
  /** Hilfslinie (Weltkoordinaten) zur Anzeige. */
  from: Vec2;
  to: Vec2;
  kind: SnapKind;
}

export interface SnapResult {
  point: Vec2;
  kind: SnapKind;
  guides: SnapGuide[];
}

export interface SnapContext {
  gridSize: number;
  enabled: boolean;
  /** Fangradius in Weltkoordinaten (cm), typischerweise 8 px / scale. */
  threshold: number;
  walls?: Wall[];
  items?: PlacedItem[];
  hall?: Hall | null;
  /** Bezugspunkt für Winkel-Snapping (90°/45°), z. B. Wandanfang. */
  angleFrom?: Vec2 | null;
  /** IDs, die ignoriert werden (das gezogene Objekt selbst). */
  ignoreIds?: Set<string>;
  /** Welche Ziele erlaubt sind. */
  targets?: Partial<Record<Exclude<SnapKind, 'none'>, boolean>>;
}

export function snapToGrid(p: Vec2, grid: number): Vec2 {
  if (grid <= 0) return p;
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}

export function snapAngle(from: Vec2, to: Vec2, stepDeg = 45): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return to;
  const ang = Math.atan2(dy, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
}

/** Rundet einen Winkel auf das nächste Vielfache von step (z. B. 15°). */
export function snapRotation(deg: number, step = 15): number {
  return Math.round(deg / step) * step;
}

/**
 * Fängt einen Punkt an Wandenden, Wandmitten, Objektkanten, Winkeln und Raster (in dieser Priorität).
 * Basisimplementierung: Raster + Wandenden/-mitten + Winkel.
 */
export function snapPoint(p: Vec2, ctx: SnapContext): SnapResult {
  if (!ctx.enabled) return { point: p, kind: 'none', guides: [] };
  const t = ctx.threshold;
  const allow = (k: Exclude<SnapKind, 'none'>) => ctx.targets?.[k] ?? true;
  let best: SnapResult | null = null;
  const consider = (cand: Vec2, kind: SnapKind, guides: SnapGuide[] = []) => {
    const d = distance(p, cand);
    if (d <= t && (!best || d < distance(p, best.point))) best = { point: cand, kind, guides };
  };
  if (ctx.walls) {
    for (const w of ctx.walls) {
      if (ctx.ignoreIds?.has(w.id)) continue;
      if (allow('wall-end')) { consider(w.start, 'wall-end'); consider(w.end, 'wall-end'); }
      if (allow('wall-mid')) consider(wallMidpoint(w), 'wall-mid');
    }
  }
  if (ctx.hall && allow('hall-vertex')) for (const v of ctx.hall.polygon) consider(v, 'hall-vertex');
  if (ctx.items && allow('item-edge')) {
    for (const it of ctx.items) {
      if (ctx.ignoreIds?.has(it.id)) continue;
      for (const c of itemFootprint(it)) consider(c, 'item-edge');
    }
  }
  if (best) return best;
  if (ctx.angleFrom && allow('angle')) {
    const a = snapAngle(ctx.angleFrom, p, 45);
    if (distance(a, p) <= t * 2) {
      const g = allow('grid') ? snapToGridAlongRay(ctx.angleFrom, a, ctx.gridSize) : a;
      return { point: g, kind: 'angle', guides: [{ from: ctx.angleFrom, to: g, kind: 'angle' }] };
    }
  }
  if (allow('grid')) return { point: snapToGrid(p, ctx.gridSize), kind: 'grid', guides: [] };
  return { point: p, kind: 'none', guides: [] };
}

/** Rastet die Länge entlang eines Strahls auf das Raster ein (Winkel bleibt erhalten). */
export function snapToGridAlongRay(from: Vec2, to: Vec2, grid: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0 || grid <= 0) return to;
  const l = Math.round(len / grid) * grid;
  return { x: from.x + (dx / len) * l, y: from.y + (dy / len) * l };
}

/**
 * Snapping für ein ganzes Objekt (Mittelpunkt): richtet Kanten/Zentrum an anderen Objekten und Wänden aus.
 * Basisimplementierung: Rasterfang des Mittelpunkts.
 */
export function snapItemPosition(
  item: Pick<PlacedItem, 'id' | 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  desired: Vec2,
  ctx: SnapContext,
): SnapResult {
  if (!ctx.enabled) return { point: desired, kind: 'none', guides: [] };
  const r = snapPoint(desired, { ...ctx, walls: undefined, items: undefined, hall: null, angleFrom: null, ignoreIds: new Set([item.id, ...(ctx.ignoreIds ?? [])]) });
  return r;
}
