import type { Wall, Vec2, Hall, Floor, Opening } from '@/types';
import {
  add, sub, scale, normalize, distance, dot, cross, closestPointOnSegment, lineIntersection, segmentIntersection,
  simplifyPolygon, polygonArea, EPS, perp, offsetPolygon, ensureClockwise, type BBox,
} from './polygon';
import { newId } from '@/utils/id';

/** Toleranz, innerhalb derer Wand-Endpunkte als gemeinsamer Knoten gelten (cm). */
export const WALL_NODE_TOL = 0.5;
/** Kanten kürzer als dieser Wert (cm) werden bei Teilung/Raumerkennung verworfen. */
export const WALL_MIN_LENGTH = 1;
/** Ab diesem Kosinus gelten zwei Richtungen als (gegenläufig) kollinear (≈ 0,25°). */
const COLLINEAR_COS = 0.99999;

/* ------------------------------------------------------------------ */
/* Grundfunktionen                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Räumliche Indizes (intern, aber exportiert für rooms.ts)            */
/* ------------------------------------------------------------------ */

/** Einfaches Zellraster für Punktabfragen (Nachbarschaftssuche in O(1) statt O(n)). */
export class PointGrid<T> {
  private readonly cells = new Map<string, T[]>();
  constructor(private readonly cell: number = 2) {}
  insert(p: Vec2, item: T): void {
    const k = `${Math.floor(p.x / this.cell)},${Math.floor(p.y / this.cell)}`;
    const arr = this.cells.get(k);
    if (arr) arr.push(item);
    else this.cells.set(k, [item]);
  }
  /** Alle Einträge aus Zellen, die das Quadrat [p−r, p+r] berühren (grobe Vorauswahl, exakt prüft der Aufrufer). */
  query(p: Vec2, r: number): T[] {
    const out: T[] = [];
    const x0 = Math.floor((p.x - r) / this.cell);
    const x1 = Math.floor((p.x + r) / this.cell);
    const y0 = Math.floor((p.y - r) / this.cell);
    const y1 = Math.floor((p.y + r) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(`${cx},${cy}`);
        if (arr) for (const it of arr) out.push(it);
      }
    }
    return out;
  }
}

/** Zellraster für Wandsegmente (Bounding-Box inkl. halber Stärke), Abfrage per Punkt. */
class SegGrid {
  private readonly cells = new Map<string, Wall[]>();
  constructor(private readonly cell: number = 200) {}
  insert(w: Wall): void {
    const m = w.thickness / 2 + WALL_NODE_TOL;
    const x0 = Math.floor((Math.min(w.start.x, w.end.x) - m) / this.cell);
    const x1 = Math.floor((Math.max(w.start.x, w.end.x) + m) / this.cell);
    const y0 = Math.floor((Math.min(w.start.y, w.end.y) - m) / this.cell);
    const y1 = Math.floor((Math.max(w.start.y, w.end.y) + m) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = `${cx},${cy}`;
        const arr = this.cells.get(k);
        if (arr) arr.push(w);
        else this.cells.set(k, [w]);
      }
    }
  }
  query(p: Vec2): Wall[] {
    return this.cells.get(`${Math.floor(p.x / this.cell)},${Math.floor(p.y / this.cell)}`) ?? [];
  }
}

interface EndRef {
  w: Wall;
  end: 0 | 1;
}
interface WallIndex {
  points: PointGrid<EndRef>;
  segs: SegGrid;
  /** Länge des indizierten Arrays – Schutz gegen in-place veränderte (nicht eingefrorene) Arrays. */
  size: number;
}

/** Index je Wand-Array, gecacht über die Array-Identität (Immer erzeugt bei Änderungen neue Arrays). */
const INDEX_CACHE = new WeakMap<Wall[], WallIndex>();

function buildIndex(walls: Wall[]): WallIndex {
  const points = new PointGrid<EndRef>(2);
  const segs = new SegGrid(200);
  for (const w of walls) {
    if (wallLength(w) < EPS) continue;
    points.insert(w.start, { w, end: 0 });
    points.insert(w.end, { w, end: 1 });
    segs.insert(w);
  }
  return { points, segs, size: walls.length };
}
function getIndex(walls: Wall[]): WallIndex {
  let idx = INDEX_CACHE.get(walls);
  if (!idx || idx.size !== walls.length) {
    idx = buildIndex(walls);
    INDEX_CACHE.set(walls, idx);
  }
  return idx;
}

/* ------------------------------------------------------------------ */
/* Knoten-Geometrie: „Arme“ an einem Knoten                            */
/* ------------------------------------------------------------------ */

/**
 * Ein Arm = eine vom Knoten weglaufende Wandachse.
 * `origin` liegt auf der tatsächlichen Achse (für Seitenlinien), `base` ist der Fußpunkt am Knoten (für Rechteck-Ecken).
 * Durchlaufende Wände (Knoten liegt mitten auf der Wand) liefern zwei virtuelle Arme (±Richtung).
 */
interface Arm {
  dir: Vec2;
  t: number;
  origin: Vec2;
  base: Vec2;
  angle: number;
  id: string;
  real: boolean;
}

function neg(v: Vec2): Vec2 {
  return { x: -v.x, y: -v.y };
}
/** Seite „plus“ = Richtung wachsender Winkel (−d.y, d.x), Seite „minus“ = (d.y, −d.x). */
function sideOffset(dir: Vec2, t: number, sign: 1 | -1): Vec2 {
  return sign > 0 ? { x: (-dir.y * t) / 2, y: (dir.x * t) / 2 } : { x: (dir.y * t) / 2, y: (-dir.x * t) / 2 };
}
function rectCorner(arm: Arm, sign: 1 | -1): Vec2 {
  return add(arm.base, sideOffset(arm.dir, arm.t, sign));
}
/**
 * Ecke zwischen zwei im Winkel benachbarten Armen (i vor j in aufsteigender Winkelreihenfolge):
 * Schnitt der Plus-Seitenlinie von i mit der Minus-Seitenlinie von j. null bei parallelen Armen oder
 * unplausibel langer Gehrung (sehr spitze Winkel) – dann Rechteck-Ecke verwenden.
 */
function cornerBetween(i: Arm, j: Arm, node: Vec2): Vec2 | null {
  if (Math.abs(cross(i.dir, j.dir)) < 1e-6) return null;
  const a = add(i.origin, sideOffset(i.dir, i.t, 1));
  const b = add(j.origin, sideOffset(j.dir, j.t, -1));
  const p = lineIntersection(a, add(a, i.dir), b, add(b, j.dir));
  if (!p) return null;
  if (distance(p, node) > 3 * Math.max(i.t, j.t) + 1) return null;
  return p;
}

/** Alle Arme am Punkt p (Wandenden innerhalb der Knotentoleranz + durchlaufende Wände), ohne Wand `excludeId`. */
function armsAt(index: WallIndex, p: Vec2, excludeId: string): Arm[] {
  const arms: Arm[] = [];
  const seen = new Set<string>();
  for (const ref of index.points.query(p, WALL_NODE_TOL)) {
    const w = ref.w;
    if (w.id === excludeId || seen.has(w.id)) continue;
    const q = ref.end ? w.end : w.start;
    if (distance(q, p) >= WALL_NODE_TOL) continue;
    const d = wallDirection(w);
    const dir = ref.end ? neg(d) : d;
    seen.add(w.id);
    arms.push({ dir, t: w.thickness, origin: q, base: q, angle: Math.atan2(dir.y, dir.x), id: w.id, real: true });
  }
  for (const w of index.segs.query(p)) {
    if (w.id === excludeId || seen.has(w.id)) continue;
    const len = wallLength(w);
    if (len < EPS) continue;
    const r = projectOntoWall(w, p);
    if (r.distance > w.thickness / 2 + WALL_NODE_TOL || r.offset <= WALL_NODE_TOL || r.offset >= len - WALL_NODE_TOL) continue;
    seen.add(w.id);
    const d = wallDirection(w);
    arms.push({ dir: d, t: w.thickness, origin: w.start, base: r.point, angle: Math.atan2(d.y, d.x), id: w.id, real: false });
    const nd = neg(d);
    arms.push({ dir: nd, t: w.thickness, origin: w.start, base: r.point, angle: Math.atan2(nd.y, nd.x), id: w.id, real: false });
  }
  return arms;
}

/** Ecken eines Wandendes: `plus` = Ecke auf der Plus-Seite der Armrichtung, `minus` entsprechend. null = Rechteck. */
function endCorners(w: Wall, end: 0 | 1, index: WallIndex): { plus: Vec2 | null; minus: Vec2 | null } | null {
  const p = end ? w.end : w.start;
  const d = wallDirection(w);
  const dir = end ? neg(d) : d;
  const own: Arm = { dir, t: w.thickness, origin: p, base: p, angle: Math.atan2(dir.y, dir.x), id: w.id, real: true };
  const others = armsAt(index, p, w.id);
  if (!others.length) return null;
  // Kollineare Kette (gegenläufiger Nachbar): Wand läuft einfach durch, Rechteck-Ende.
  for (const o of others) if (dot(o.dir, own.dir) < -COLLINEAR_COS) return null;
  const arms = [own, ...others].sort((a, b) => a.angle - b.angle);
  const m = arms.length;
  const k = arms.indexOf(own);
  return {
    plus: cornerBetween(own, arms[(k + 1) % m], p),
    minus: cornerBetween(arms[(k - 1 + m) % m], own, p),
  };
}

/**
 * Wandpolygon mit sauberen Verbindungen: An jedem Ende wird die Wand mit allen am Knoten anliegenden Wänden
 * (Ecken, T-Stöße, Kreuzungen, unterschiedliche Stärken) per Geradenschnitt der Seitenlinien verbunden.
 * Endet die Wand mitten auf einer anderen Wand, reicht sie exakt bis an deren Fläche.
 * Kollineare Nachbarn (Kette) laufen mit Rechteck-Ende durch.
 * Reihenfolge wie `wallRect`: start-a, end-a, end-b, start-b.
 * `all` darf `w` enthalten (typisch) oder nicht (z. B. Vorschau beim Zeichnen); der Index zu `all` wird gecacht.
 */
export function wallOutline(w: Wall, all: Wall[]): Vec2[] {
  const rect = wallRect(w);
  if (wallLength(w) < EPS) return rect;
  const index = getIndex(all);
  const s = endCorners(w, 0, index);
  if (s) {
    if (s.minus) rect[0] = s.minus;
    if (s.plus) rect[3] = s.plus;
  }
  const e = endCorners(w, 1, index);
  if (e) {
    if (e.plus) rect[1] = e.plus;
    if (e.minus) rect[2] = e.minus;
  }
  return rect;
}

/** Polygone aller Wände auf einmal (ein gemeinsamer Index). Schlüssel = Wand-ID. */
export function wallOutlines(walls: Wall[]): Map<string, Vec2[]> {
  const out = new Map<string, Vec2[]>();
  for (const w of walls) out.set(w.id, wallOutline(w, walls));
  return out;
}

/**
 * Zusätzliche Füllpolygone für Knoten mit 3+ Armen, an denen die Wandpolygone allein eine Lücke lassen
 * (Y-Stöße, Sternknoten, kollineare Paare unterschiedlicher Stärke). Knoten, an denen eine Wand
 * gleicher Stärke durchläuft (T-Stoß, Kreuz), sind bereits geschlossen und liefern nichts.
 */
export function wallJoinPolygons(walls: Wall[]): Vec2[][] {
  const index = getIndex(walls);
  const out: Vec2[][] = [];
  const done = new Set<string>();
  for (const w of walls) {
    if (wallLength(w) < EPS) continue;
    for (const end of [0, 1] as const) {
      if (done.has(`${w.id}:${end}`)) continue;
      const p = end ? w.end : w.start;
      for (const ref of index.points.query(p, WALL_NODE_TOL)) {
        if (distance(ref.end ? ref.w.end : ref.w.start, p) < WALL_NODE_TOL) done.add(`${ref.w.id}:${ref.end}`);
      }
      const arms = armsAt(index, p, '');
      let real = 0;
      for (const a of arms) if (a.real) real++;
      if (real < 2 || arms.length < 3) continue;
      let closed = false;
      for (let i = 0; i < arms.length && !closed; i++) {
        for (let j = i + 1; j < arms.length; j++) {
          if (dot(arms[i].dir, arms[j].dir) < -COLLINEAR_COS && Math.abs(arms[i].t - arms[j].t) < 1e-6) {
            closed = true;
            break;
          }
        }
      }
      if (closed) continue;
      arms.sort((a, b) => a.angle - b.angle);
      const poly: Vec2[] = [];
      for (let i = 0; i < arms.length; i++) {
        const j = (i + 1) % arms.length;
        const c = cornerBetween(arms[i], arms[j], p);
        if (c) poly.push(c);
        else poly.push(rectCorner(arms[i], 1), rectCorner(arms[j], -1));
      }
      const simple = simplifyPolygon(poly);
      if (simple.length >= 3 && polygonArea(simple) > 0.01) out.push(simple);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Teilen, Zusammenführen                                              */
/* ------------------------------------------------------------------ */

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

/** Achsensegment mit Stärke (Basis für die generische Teilung). */
export interface AxisSegment {
  a: Vec2;
  b: Vec2;
  t: number;
}
export interface SegmentPiece<S extends AxisSegment> {
  /** Ursprungssegment. */
  source: S;
  /** Index des Ursprungssegments im Eingabearray. */
  index: number;
  /** Laufende Nummer des Teilstücks (0 = erstes). */
  part: number;
  a: Vec2;
  b: Vec2;
}

/**
 * Teilt Achsensegmente an Kreuzungen und dort, wo ein Segmentende auf ein anderes Segment trifft
 * (Endpunkt innerhalb der halben Stärke + Toleranz um die Achse). Teilstücke kürzer als 1 cm entfallen.
 * `splittable` kann Segmente von der Teilung ausnehmen (sie teilen andere aber weiterhin).
 */
export function splitSegmentsAtIntersections<S extends AxisSegment>(
  segs: S[],
  opts: { splittable?: (s: S) => boolean } = {},
): SegmentPiece<S>[] {
  const n = segs.length;
  const boxes: BBox[] = [];
  const lens: number[] = [];
  for (const s of segs) {
    const m = s.t / 2 + WALL_NODE_TOL;
    boxes.push({
      minX: Math.min(s.a.x, s.b.x) - m,
      maxX: Math.max(s.a.x, s.b.x) + m,
      minY: Math.min(s.a.y, s.b.y) - m,
      maxY: Math.max(s.a.y, s.b.y) + m,
    });
    lens.push(distance(s.a, s.b));
  }
  const out: SegmentPiece<S>[] = [];
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    const len = lens[i];
    if (len < WALL_MIN_LENGTH) continue;
    const cuts: number[] = [];
    if (!opts.splittable || opts.splittable(s)) {
      const bi = boxes[i];
      for (let j = 0; j < n; j++) {
        if (j === i || lens[j] < EPS) continue;
        const bj = boxes[j];
        if (bi.minX > bj.maxX || bj.minX > bi.maxX || bi.minY > bj.maxY || bj.minY > bi.maxY) continue;
        const o = segs[j];
        const r = segmentIntersection(s.a, s.b, o.a, o.b, true);
        if (r) {
          const off = r.t * len;
          if (off > WALL_MIN_LENGTH && off < len - WALL_MIN_LENGTH) cuts.push(off);
        }
        const band = s.t / 2 + WALL_NODE_TOL;
        for (const p of [o.a, o.b]) {
          const c = closestPointOnSegment(p, s.a, s.b);
          if (distance(p, c.point) > band) continue;
          const off = c.t * len;
          if (off > WALL_MIN_LENGTH && off < len - WALL_MIN_LENGTH) cuts.push(off);
        }
      }
    }
    cuts.sort((x, y) => x - y);
    const dir = scale(sub(s.b, s.a), 1 / len);
    let prevOff = 0;
    let prevPt = s.a;
    let part = 0;
    for (const off of cuts) {
      if (off - prevOff < WALL_MIN_LENGTH) continue;
      const pt = add(s.a, scale(dir, off));
      out.push({ source: s, index: i, part: part++, a: prevPt, b: pt });
      prevOff = off;
      prevPt = pt;
    }
    if (len - prevOff >= WALL_MIN_LENGTH) out.push({ source: s, index: i, part, a: prevPt, b: s.b });
    else if (part > 0) out[out.length - 1] = { ...out[out.length - 1], b: s.b };
  }
  return out;
}

/**
 * Teilt Wände, die sich kreuzen oder deren Ende auf eine andere Wand trifft, an den Schnittpunkten.
 * Das erste Teilstück behält die ID, weitere erhalten neue IDs. Öffnungen wandern auf das passende Teilstück.
 * Virtuelle Hallenwände (`hall_*`) werden nicht geteilt, teilen aber andere Wände.
 */
export function splitWallsAtIntersectionsDetailed(walls: Wall[], openings: Opening[] = []): { walls: Wall[]; openings: Opening[] } {
  const segs = walls.map((w) => ({ a: w.start, b: w.end, t: w.thickness, wall: w }));
  const pieces = splitSegmentsAtIntersections(segs, { splittable: (s) => !isHallWallId(s.wall.id) });
  const byIndex = new Map<number, Wall[]>();
  for (const p of pieces) {
    const w = p.source.wall;
    const unchanged = p.part === 0 && p.a === w.start && p.b === w.end;
    const part: Wall = unchanged ? w : p.part === 0 ? { ...w, start: p.a, end: p.b } : { ...w, id: newId('w_'), start: p.a, end: p.b };
    const arr = byIndex.get(p.index);
    if (arr) arr.push(part);
    else byIndex.set(p.index, [part]);
  }
  const result: Wall[] = [];
  const byWallId = new Map<string, Wall[]>();
  walls.forEach((w, i) => {
    const parts = byIndex.get(i) ?? [w]; // zu kurze Wände bleiben unverändert erhalten
    byWallId.set(w.id, parts);
    for (const p of parts) result.push(p);
  });
  let outOpenings = openings;
  if (openings.length) {
    outOpenings = openings.map((o) => {
      const parts = byWallId.get(o.wallId);
      const orig = walls.find((w) => w.id === o.wallId);
      if (!parts || !orig || parts.length < 2) return o;
      const center = pointOnWall(orig, o.offset);
      let best = parts[0];
      let bestD = Infinity;
      for (const part of parts) {
        const d = projectOntoWall(part, center).distance;
        if (d < bestD) {
          bestD = d;
          best = part;
        }
      }
      return { ...o, wallId: best.id, offset: projectOntoWall(best, center).offset };
    });
  }
  return { walls: result, openings: outOpenings };
}
/** Wie `splitWallsAtIntersectionsDetailed`, nur die Wände. */
export function splitWallsAtIntersections(walls: Wall[]): Wall[] {
  return splitWallsAtIntersectionsDetailed(walls).walls;
}

function sameWallProps(a: Wall, b: Wall): boolean {
  return Math.abs(a.thickness - b.thickness) < 1e-6 && a.type === b.type && a.height === b.height && !!a.locked === !!b.locked && !!a.hidden === !!b.hidden;
}

/**
 * Verbindet kollineare Wände gleichen Typs/Stärke, die sich an einem Knoten mit genau zwei Wandenden treffen,
 * zu einer Wand. Die in der Liste zuerst stehende Wand behält ID und Orientierung. Öffnungen werden umgerechnet.
 */
export function mergeCollinearWallsDetailed(
  walls: Wall[],
  openings: Opening[] = [],
): { walls: Wall[]; openings: Opening[]; merged: { keptId: string; removedId: string }[] } {
  let cur = walls.slice();
  let ops = openings;
  const merged: { keptId: string; removedId: string }[] = [];
  for (let pass = 0; pass < walls.length; pass++) {
    const grid = new PointGrid<{ idx: number; end: 0 | 1 }>(2);
    cur.forEach((w, idx) => {
      if (wallLength(w) < WALL_MIN_LENGTH || isHallWallId(w.id)) return;
      grid.insert(w.start, { idx, end: 0 });
      grid.insert(w.end, { idx, end: 1 });
    });
    const assigned = new Set<string>();
    const touched = new Set<number>();
    const removed = new Set<number>();
    let changed = false;
    for (let idx = 0; idx < cur.length; idx++) {
      const w = cur[idx];
      if (wallLength(w) < WALL_MIN_LENGTH || isHallWallId(w.id)) continue;
      for (const end of [0, 1] as const) {
        if (assigned.has(`${idx}:${end}`)) continue;
        const p = end ? w.end : w.start;
        const cluster = grid.query(p, WALL_NODE_TOL).filter((r) => distance(r.end ? cur[r.idx].end : cur[r.idx].start, p) < WALL_NODE_TOL);
        for (const r of cluster) assigned.add(`${r.idx}:${r.end}`);
        if (cluster.length !== 2) continue;
        const [A, B] = cluster;
        if (A.idx === B.idx || touched.has(A.idx) || touched.has(B.idx)) continue;
        const wa = cur[A.idx];
        const wb = cur[B.idx];
        if (!sameWallProps(wa, wb)) continue;
        const da = A.end ? neg(wallDirection(wa)) : wallDirection(wa);
        const db = B.end ? neg(wallDirection(wb)) : wallDirection(wb);
        if (dot(da, db) > -COLLINEAR_COS) continue;
        const keep = A.idx < B.idx ? A : B;
        const other = keep === A ? B : A;
        const kw = cur[keep.idx];
        const ow = cur[other.idx];
        const far = other.end ? ow.start : ow.end;
        const nw: Wall = keep.end ? { ...kw, end: far } : { ...kw, start: far };
        if (ops.length) {
          ops = ops.map((o) => {
            if (o.wallId !== kw.id && o.wallId !== ow.id) return o;
            const src = o.wallId === kw.id ? kw : ow;
            const center = pointOnWall(src, o.offset);
            return { ...o, wallId: nw.id, offset: projectOntoWall(nw, center).offset };
          });
        }
        cur[keep.idx] = nw;
        removed.add(other.idx);
        touched.add(keep.idx);
        touched.add(other.idx);
        merged.push({ keptId: kw.id, removedId: ow.id });
        changed = true;
      }
    }
    if (!changed) break;
    cur = cur.filter((_, i) => !removed.has(i));
  }
  return { walls: cur, openings: ops, merged };
}
/** Wie `mergeCollinearWallsDetailed`, nur die Wände. */
export function mergeCollinearWalls(walls: Wall[]): Wall[] {
  return mergeCollinearWallsDetailed(walls).walls;
}

/** Bounding-Box aller Wände inkl. Wandstärke. Leer → Nullbox. */
export function wallsBoundingBox(walls: Wall[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    const h = w.thickness / 2;
    for (const p of [w.start, w.end]) {
      if (p.x - h < minX) minX = p.x - h;
      if (p.y - h < minY) minY = p.y - h;
      if (p.x + h > maxX) maxX = p.x + h;
      if (p.y + h > maxY) maxY = p.y + h;
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/* ------------------------------------------------------------------ */
/* Halle                                                               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Öffnungen                                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Verschieben                                                         */
/* ------------------------------------------------------------------ */

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
    if (distance(o.start, w.start) < WALL_NODE_TOL) start = ns;
    else if (distance(o.start, w.end) < WALL_NODE_TOL) start = ne;
    if (distance(o.end, w.start) < WALL_NODE_TOL) end = ns;
    else if (distance(o.end, w.end) < WALL_NODE_TOL) end = ne;
    return start === o.start && end === o.end ? o : { ...o, start, end };
  });
}
/** Verschiebt einen Wand-Endpunkt (und alle dort verbundenen Endpunkte). */
export function moveWallNode(walls: Wall[], node: Vec2, to: Vec2): Wall[] {
  return walls.map((o) => {
    const s = distance(o.start, node) < WALL_NODE_TOL;
    const e = distance(o.end, node) < WALL_NODE_TOL;
    if (!s && !e) return o;
    return { ...o, start: s ? to : o.start, end: e ? to : o.end };
  });
}
/** Alle Wand-Knoten (Endpunkte, dedupliziert). */
export function wallNodes(walls: Wall[]): Vec2[] {
  const nodes: Vec2[] = [];
  const grid = new PointGrid<Vec2>(2);
  for (const w of walls) {
    for (const p of [w.start, w.end]) {
      if (grid.query(p, WALL_NODE_TOL).some((n) => distance(n, p) < WALL_NODE_TOL)) continue;
      nodes.push(p);
      grid.insert(p, p);
    }
  }
  return nodes;
}
export { perp, EPS };
