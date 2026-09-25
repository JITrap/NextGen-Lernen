import type { Wall, Vec2, Hall, Floor, Opening } from '@/types';
import { add, sub, scale, normalize, distance, closestPointOnSegment, lineIntersection, EPS, perp, offsetPolygon, ensureClockwise } from './polygon';
import { newId } from '@/utils/id';

export function wallLength(w: Pick<Wall, 'start' | 'end'>): number {
  return distance(w.start, w.end);
}
export function wallDirection(w: Pick<Wall, 'start' | 'end'>): Vec2 {
  return normalize(sub(w.end, w.start));
}
/** Normale zur Wandrichtung (Seite „a“ = links der Richtung start→end in Bildschirmkoordinaten). */
export function wallNormal(w: Pick<Wall, 'start' | 'end'>): Vec2 {
  const d = wallDirection(w);
  return { x: d.y, y: -d.x };
}
export function wallMidpoint(w: Pick<Wall, 'start' | 'end'>): Vec2 {
  return { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
}
export function wallAngleDeg(w: Pick<Wall, 'start' | 'end'>): number {
  return (Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x) * 180) / Math.PI;
}
/** Punkt auf der Wandachse bei Abstand `offset` (cm) vom Anfang. */
export function pointOnWall(w: Pick<Wall, 'start' | 'end'>, offset: number): Vec2 {
  return add(w.start, scale(wallDirection(w), offset));
}
/** Projiziert p auf die Wandachse; liefert Abstand ab Wandanfang und Distanz zur Achse. */
export function projectOntoWall(w: Pick<Wall, 'start' | 'end'>, p: Vec2): { offset: number; distance: number; point: Vec2 } {
  const { point, t } = closestPointOnSegment(p, w.start, w.end);
  return { offset: t * wallLength(w), distance: distance(p, point), point };
}
/** Nächste Wand zu einem Punkt (innerhalb maxDist, gemessen zur Wandmitte-Achse + halbe Stärke). */
export function nearestWall(walls: Wall[], p: Vec2, maxDist = Infinity): { wall: Wall; offset: number; distance: number; point: Vec2 } | null {
  let best: { wall: Wall; offset: number; distance: number; point: Vec2 } | null = null;
  for (const w of walls) {
    const r = projectOntoWall(w, p);
    const d = Math.max(0, r.distance - w.thickness / 2);
    if (d <= maxDist && (!best || d < best.distance)) best = { wall: w, ...r, distance: d };
  }
  return best;
}
/** Einfaches Rechteck-Polygon der Wand (ohne Gehrung). Reihenfolge: start-a, end-a, end-b, start-b. */
export function wallRect(w: Pick<Wall, 'start' | 'end' | 'thickness'>): Vec2[] {
  const n = scale(wallNormal(w), w.thickness / 2);
  return [add(w.start, n), add(w.end, n), sub(w.end, n), sub(w.start, n)];
}

/**
 * Wandpolygon mit Gehrung: An jedem Ende wird die Wand mit angrenzenden Wänden (gemeinsamer Endpunkt)
 * per Geradenschnitt sauber verbunden (Ecken und T-Stöße).
 * Standardimplementierung: Gehrung bei genau zwei Wänden am Knoten, sonst Rechteck.
 */
export function wallOutline(w: Wall, all: Wall[]): Vec2[] {
  const rect = wallRect(w);
  const n = scale(wallNormal(w), w.thickness / 2);
  const dir = wallDirection(w);
  const result = [...rect];
  const ends: Array<{ idx: 0 | 1; point: Vec2; corners: [number, number] }> = [
    { idx: 0, point: w.start, corners: [0, 3] },
    { idx: 1, point: w.end, corners: [1, 2] },
  ];
  for (const e of ends) {
    const neighbors = all.filter((o) => o.id !== w.id && (distance(o.start, e.point) < 0.5 || distance(o.end, e.point) < 0.5));
    if (neighbors.length !== 1) continue;
    const o = neighbors[0];
    // Nachbar so orientieren, dass er am gemeinsamen Punkt beginnt
    const oStart = distance(o.start, e.point) < 0.5 ? o.start : o.end;
    const oEnd = distance(o.start, e.point) < 0.5 ? o.end : o.start;
    const od = normalize(sub(oEnd, oStart));
    if (Math.abs(dir.x * od.x + dir.y * od.y) > 0.999) continue; // kollinear
    const on = scale({ x: od.y, y: -od.x }, o.thickness / 2);
    // Für beide Seiten (+n / -n) Schnitt der versetzten Geraden
    for (const sign of [1, -1] as const) {
      const a1 = add(w.start, scale(n, sign));
      const a2 = add(w.end, scale(n, sign));
      // Seite des Nachbarn wählen: die Seite, die zur gleichen Halbebene zeigt
      const cornerIdx = sign === 1 ? e.corners[0] : e.corners[1];
      let bestP: Vec2 | null = null;
      let bestD = Infinity;
      for (const osign of [1, -1] as const) {
        const b1 = add(oStart, scale(on, osign));
        const b2 = add(oEnd, scale(on, osign));
        const p = lineIntersection(a1, a2, b1, b2);
        if (!p) continue;
        const d = distance(p, rect[cornerIdx]);
        if (d < bestD) { bestD = d; bestP = p; }
      }
      if (bestP && bestD < Math.max(w.thickness, o.thickness) * 2) result[cornerIdx] = bestP;
    }
  }
  return result;
}

/** Teilt eine Wand am nächsten Punkt zu p in zwei Wände (neue IDs für die zweite Hälfte). */
export function splitWall(w: Wall, p: Vec2): [Wall, Wall] | null {
  const { offset } = projectOntoWall(w, p);
  const len = wallLength(w);
  if (offset < 1 || offset > len - 1) return null;
  const mid = pointOnWall(w, offset);
  return [
    { ...w, end: mid },
    { ...w, id: newId('w_'), start: mid },
  ];
}
/** Verteilt Öffnungen nach dem Teilen auf die passende Hälfte. */
export function reassignOpeningsAfterSplit(openings: Opening[], original: Wall, parts: [Wall, Wall]): Opening[] {
  const firstLen = wallLength(parts[0]);
  return openings.map((o) => {
    if (o.wallId !== original.id) return o;
    if (o.offset <= firstLen) return o;
    return { ...o, wallId: parts[1].id, offset: o.offset - firstLen };
  });
}

/**
 * Innenkante der Halle (Außenwand-Stärke abgezogen).
 */
export function hallInnerPolygon(hall: Hall): Vec2[] {
  return offsetPolygon(hall.polygon, hall.wallThickness);
}
/** Außenkante normalisiert (Uhrzeigersinn). */
export function hallOuterPolygon(hall: Hall): Vec2[] {
  return ensureClockwise(hall.polygon);
}
/**
 * Außenwände der Halle als virtuelle Wände (Achse = Mitte der Außenwand).
 * IDs sind stabil („hall_<index>“), damit Türen/Fenster daran hängen können.
 */
export function hallWalls(hall: Hall): Wall[] {
  const outer = hallOuterPolygon(hall);
  const mid = offsetPolygon(outer, hall.wallThickness / 2);
  const out: Wall[] = [];
  for (let i = 0; i < mid.length; i++) {
    out.push({ id: `hall_${i}`, start: mid[i], end: mid[(i + 1) % mid.length], thickness: hall.wallThickness, type: 'Außenwand', height: null });
  }
  return out;
}
export function isHallWallId(id: string): boolean {
  return id.startsWith('hall_');
}
/** Alle Wände inkl. virtueller Hallen-Außenwände. */
export function allWalls(floor: Pick<Floor, 'walls' | 'hall'>): Wall[] {
  return floor.hall ? [...hallWalls(floor.hall), ...floor.walls] : floor.walls;
}
export function findWall(floor: Pick<Floor, 'walls' | 'hall'>, id: string): Wall | undefined {
  if (isHallWallId(id)) return floor.hall ? hallWalls(floor.hall).find((w) => w.id === id) : undefined;
  return floor.walls.find((w) => w.id === id);
}

/** Position/Ausrichtung einer Öffnung in Weltkoordinaten. */
export function openingPlacement(o: Opening, wall: Wall): { center: Vec2; dir: Vec2; normal: Vec2; angle: number; a: Vec2; b: Vec2 } {
  const dir = wallDirection(wall);
  const normal = wallNormal(wall);
  const center = pointOnWall(wall, o.offset);
  const half = scale(dir, o.width / 2);
  return { center, dir, normal, angle: wallAngleDeg(wall), a: sub(center, half), b: add(center, half) };
}
/** Begrenzt den Öffnungs-Offset auf die Wandlänge. */
export function clampOpeningOffset(offset: number, width: number, wall: Pick<Wall, 'start' | 'end'>): number {
  const len = wallLength(wall);
  const half = width / 2;
  if (len <= width) return len / 2;
  return Math.min(Math.max(offset, half), len - half);
}

/** Verschiebt eine Wand parallel um dx/dy; angrenzende Wände (gemeinsame Endpunkte) folgen mit ihren Endpunkten. */
export function moveWallWithNeighbors(walls: Wall[], id: string, dx: number, dy: number): Wall[] {
  const w = walls.find((x) => x.id === id);
  if (!w) return walls;
  const ns = add(w.start, { x: dx, y: dy });
  const ne = add(w.end, { x: dx, y: dy });
  return walls.map((o) => {
    if (o.id === id) return { ...o, start: ns, end: ne };
    let start = o.start;
    let end = o.end;
    if (distance(o.start, w.start) < 0.5) start = ns;
    else if (distance(o.start, w.end) < 0.5) start = ne;
    if (distance(o.end, w.start) < 0.5) end = ns;
    else if (distance(o.end, w.end) < 0.5) end = ne;
    return start === o.start && end === o.end ? o : { ...o, start, end };
  });
}
/** Verschiebt einen Wand-Endpunkt (und alle dort verbundenen Endpunkte). */
export function moveWallNode(walls: Wall[], node: Vec2, to: Vec2): Wall[] {
  return walls.map((o) => {
    const s = distance(o.start, node) < 0.5;
    const e = distance(o.end, node) < 0.5;
    if (!s && !e) return o;
    return { ...o, start: s ? to : o.start, end: e ? to : o.end };
  });
}
/** Alle Wand-Knoten (Endpunkte, dedupliziert). */
export function wallNodes(walls: Wall[]): Vec2[] {
  const nodes: Vec2[] = [];
  for (const w of walls) {
    for (const p of [w.start, w.end]) {
      if (!nodes.some((n) => distance(n, p) < 0.5)) nodes.push(p);
    }
  }
  return nodes;
}
export { perp, EPS };
