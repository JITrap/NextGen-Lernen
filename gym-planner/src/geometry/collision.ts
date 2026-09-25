import type { Vec2, PlacedItem, Wall, SafetyZone } from '@/types';
import { bbox, bboxOverlap, dot } from './polygon';
import { itemFootprint, itemSafetyPolygon, zoneIsEmpty } from './transform';
import { wallRect } from './walls';

/** Trennachsen-Test (SAT) für konvexe Polygone. Berührung an der Kante gilt nicht als Überlappung. */
export function convexPolygonsOverlap(a: Vec2[], b: Vec2[], tolerance = 0.01): boolean {
  if (!bboxOverlap(bbox(a), bbox(b), -tolerance)) return false;
  for (const poly of [a, b]) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      const axis = { x: -(q.y - p.y), y: q.x - p.x };
      let minA = Infinity; let maxA = -Infinity; let minB = Infinity; let maxB = -Infinity;
      for (const v of a) { const d = dot(v, axis); if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const v of b) { const d = dot(v, axis); if (d < minB) minB = d; if (d > maxB) maxB = d; }
      const len = Math.hypot(axis.x, axis.y) || 1;
      if (maxA / len <= minB / len + tolerance || maxB / len <= minA / len + tolerance) return false;
    }
  }
  return true;
}

export type CollisionKind = 'item-item' | 'item-zone' | 'zone-zone' | 'item-wall' | 'zone-wall';

export interface Collision {
  a: string;
  b: string;
  kind: CollisionKind;
}

export interface CollisionOptions {
  /** Sicherheitszonen berücksichtigen. */
  includeZones?: boolean;
  /** Wände berücksichtigen. */
  walls?: Wall[];
  /** Nur diese IDs prüfen (z. B. beim Ziehen). */
  onlyIds?: Set<string>;
}

function effectiveZone(it: PlacedItem): SafetyZone | null {
  if (!it.safetyZoneEnabled || zoneIsEmpty(it.safetyZone)) return null;
  return it.safetyZone;
}

/**
 * Findet alle Überlappungen zwischen Objekten (Grundflächen), Sicherheitszonen und Wänden.
 * Basisimplementierung O(n²) mit Bounding-Box-Vorfilter.
 */
export function findCollisions(items: PlacedItem[], opts: CollisionOptions = {}): Collision[] {
  const out: Collision[] = [];
  const visible = items.filter((i) => !i.hidden);
  const fps = visible.map((i) => itemFootprint(i));
  const zones = visible.map((i) => { const z = effectiveZone(i); return z ? itemSafetyPolygon(i, z) : null; });
  const boxes = fps.map((f, i) => bbox(zones[i] ?? f));
  const includeZones = opts.includeZones ?? true;
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const A = visible[i]; const B = visible[j];
      if (opts.onlyIds && !opts.onlyIds.has(A.id) && !opts.onlyIds.has(B.id)) continue;
      if (A.dockedTo === B.id || B.dockedTo === A.id) continue;
      if (!bboxOverlap(boxes[i], boxes[j])) continue;
      if (convexPolygonsOverlap(fps[i], fps[j])) { out.push({ a: A.id, b: B.id, kind: 'item-item' }); continue; }
      if (!includeZones) continue;
      const zi = zones[i]; const zj = zones[j];
      if (zi && convexPolygonsOverlap(zi, fps[j])) { out.push({ a: A.id, b: B.id, kind: 'item-zone' }); continue; }
      if (zj && convexPolygonsOverlap(zj, fps[i])) { out.push({ a: B.id, b: A.id, kind: 'item-zone' }); continue; }
    }
  }
  if (opts.walls) {
    const wallPolys = opts.walls.map((w) => ({ w, poly: wallRect(w), box: bbox(wallRect(w)) }));
    for (let i = 0; i < visible.length; i++) {
      const A = visible[i];
      if (opts.onlyIds && !opts.onlyIds.has(A.id)) continue;
      if (A.kind !== 'equipment') continue;
      for (const wp of wallPolys) {
        if (A.wallId === wp.w.id) continue;
        if (!bboxOverlap(bbox(fps[i]), wp.box)) continue;
        if (convexPolygonsOverlap(fps[i], wp.poly)) { out.push({ a: A.id, b: wp.w.id, kind: 'item-wall' }); break; }
      }
    }
  }
  return out;
}

/** Menge aller Objekt-IDs, die an einer Kollision beteiligt sind. */
export function collidingIds(cols: Collision[]): Set<string> {
  const s = new Set<string>();
  for (const c of cols) { s.add(c.a); s.add(c.b); }
  return s;
}

export function itemsOverlap(a: PlacedItem, b: PlacedItem): boolean {
  return convexPolygonsOverlap(itemFootprint(a), itemFootprint(b));
}
