/**
 * Snapping (reine Funktionen, cm). Prioritäten für Punkte:
 * Wandenden > Wandmitten > Hallen-Ecken > Objektecken > Winkel (90°/45°, mit Achsen-Schnitt) > Achsen-Ausrichtung > Raster.
 * Innerhalb der Schwelle gewinnt das nächstgelegene Ziel gleicher Priorität. Jedes Ergebnis liefert Hilfslinien.
 */
import type { Vec2, Wall, PlacedItem, Hall } from '@/types';
import { distance, bbox, EPS, type BBox } from './polygon';
import { rectCorners } from './transform';
import { wallMidpoint, wallLength, wallNormal, wallDirection, pointOnWall, hallInnerPolygon, hallOuterPolygon } from './walls';
import { normalizeAngle } from './units';
import { itemIndexFor, wallIndexFor, expandBox } from './spatialHash';
import { polygonExtentInBand } from './collision';

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
  /** IDs, die ignoriert werden (das gezogene Objekt selbst, Wände in Bearbeitung). */
  ignoreIds?: Set<string>;
  /**
   * Welche Ziele erlaubt sind. 'item-edge' steuert Objektecken und Achsen-Ausrichtung an Objekten,
   * 'wall-end' zusätzlich Wandflächen/-knoten bei der Ausrichtung, 'hall-vertex' Hallen-Ecken/-Innenkanten.
   */
  targets?: Partial<Record<Exclude<SnapKind, 'none'>, boolean>>;
}

/** Umkreis (cm), in dem Objekte/Wände für die Achsen-Ausrichtung berücksichtigt werden. */
export const ALIGN_RANGE = 1500;

const NONE = (p: Vec2): SnapResult => ({ point: p, kind: 'none', guides: [] });

export function snapToGrid(p: Vec2, grid: number): Vec2 {
  if (!(grid > 0)) return p;
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}

export function snapAngle(from: Vec2, to: Vec2, stepDeg = 45): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0 || !(stepDeg > 0)) return to;
  const ang = Math.atan2(dy, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
}

/** Rundet einen Winkel auf das nächste Vielfache von step (z. B. 15°). */
export function snapRotation(deg: number, step = 15): number {
  if (!(step > 0)) return deg;
  return Math.round(deg / step) * step;
}

/** Rastet die Länge entlang eines Strahls auf das Raster ein (Winkel bleibt erhalten). */
export function snapToGridAlongRay(from: Vec2, to: Vec2, grid: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0 || !(grid > 0)) return to;
  const l = Math.round(len / grid) * grid;
  return { x: from.x + (dx / len) * l, y: from.y + (dy / len) * l };
}

/* ------------------------------------------------------------------ */
/* Hilfslinien                                                         */
/* ------------------------------------------------------------------ */

/** Kleines Kreuz als Marker (Größe = Fangradius, damit es auf dem Bildschirm konstant bleibt). */
function crossGuides(p: Vec2, size: number, kind: SnapKind): SnapGuide[] {
  const s = Math.max(size, 1);
  return [
    { from: { x: p.x - s, y: p.y - s }, to: { x: p.x + s, y: p.y + s }, kind },
    { from: { x: p.x - s, y: p.y + s }, to: { x: p.x + s, y: p.y - s }, kind },
  ];
}

function vLine(x: number, y0: number, y1: number, kind: SnapKind): SnapGuide {
  return { from: { x, y: Math.min(y0, y1) }, to: { x, y: Math.max(y0, y1) }, kind };
}
function hLine(y: number, x0: number, x1: number, kind: SnapKind): SnapGuide {
  return { from: { x: Math.min(x0, x1), y }, to: { x: Math.max(x0, x1), y }, kind };
}

/* ------------------------------------------------------------------ */
/* Achsen-Kandidaten                                                   */
/* ------------------------------------------------------------------ */

/** Kandidat für die Ausrichtung einer Achse: Koordinate + Ausdehnung der Quelle entlang der anderen Achse. */
interface AxisCand {
  v: number;
  lo: number;
  hi: number;
}

interface AxisBest {
  x: AxisCand | null;
  dx: number;
  y: AxisCand | null;
  dy: number;
}

function newAxisBest(): AxisBest {
  return { x: null, dx: Infinity, y: null, dy: Infinity };
}
function offerX(b: AxisBest, target: number, v: number, lo: number, hi: number, t: number): void {
  const d = Math.abs(v - target);
  if (d <= t && d < b.dx) { b.dx = d; b.x = { v, lo, hi }; }
}
function offerY(b: AxisBest, target: number, v: number, lo: number, hi: number, t: number): void {
  const d = Math.abs(v - target);
  if (d <= t && d < b.dy) { b.dy = d; b.y = { v, lo, hi }; }
}

/** Sammelt Achsen-Kandidaten (Wandknoten, Hallen-Ecken, Objektzentren/-kanten, angleFrom) für einen Punkt. */
function collectPointAxisCandidates(p: Vec2, ctx: SnapContext, t: number, allow: (k: Exclude<SnapKind, 'none'>) => boolean): AxisBest {
  const b = newAxisBest();
  const ignore = ctx.ignoreIds;
  if (ctx.walls && allow('wall-end')) {
    for (const w of ctx.walls) {
      if (w.hidden || ignore?.has(w.id)) continue;
      offerX(b, p.x, w.start.x, w.start.y, w.start.y, t);
      offerX(b, p.x, w.end.x, w.end.y, w.end.y, t);
      offerY(b, p.y, w.start.y, w.start.x, w.start.x, t);
      offerY(b, p.y, w.end.y, w.end.x, w.end.x, t);
    }
  }
  if (ctx.hall && ctx.hall.polygon.length >= 3 && allow('hall-vertex')) {
    for (const poly of [hallOuterPolygon(ctx.hall), hallInnerPolygon(ctx.hall)]) {
      for (const v of poly) {
        offerX(b, p.x, v.x, v.y, v.y, t);
        offerY(b, p.y, v.y, v.x, v.x, t);
      }
    }
  }
  if (ctx.items && ctx.items.length && allow('item-edge')) {
    const idx = itemIndexFor(ctx.items);
    const q: BBox = { minX: p.x - ALIGN_RANGE, minY: p.y - ALIGN_RANGE, maxX: p.x + ALIGN_RANGE, maxY: p.y + ALIGN_RANGE };
    idx.hash.forEachIn(q, (i) => {
      const it = idx.items[i];
      if (ignore?.has(it.id)) return;
      const bx = idx.boxes[i];
      offerX(b, p.x, bx.minX, bx.minY, bx.maxY, t);
      offerX(b, p.x, bx.maxX, bx.minY, bx.maxY, t);
      offerX(b, p.x, it.x, it.y, it.y, t);
      offerY(b, p.y, bx.minY, bx.minX, bx.maxX, t);
      offerY(b, p.y, bx.maxY, bx.minX, bx.maxX, t);
      offerY(b, p.y, it.y, it.x, it.x, t);
    });
  }
  if (ctx.angleFrom) {
    offerX(b, p.x, ctx.angleFrom.x, ctx.angleFrom.y, ctx.angleFrom.y, t);
    offerY(b, p.y, ctx.angleFrom.y, ctx.angleFrom.x, ctx.angleFrom.x, t);
  }
  return b;
}

/* ------------------------------------------------------------------ */
/* Punkt-Snapping                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fängt einen Punkt an Wandenden, Wandmitten, Hallen-Ecken, Objektecken, Winkeln (relativ zu angleFrom),
 * Achsen (Figma-artige Ausrichtung, Kind 'item-edge') und Raster – in dieser Priorität.
 */
export function snapPoint(p: Vec2, ctx: SnapContext): SnapResult {
  if (!ctx.enabled || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return NONE(p);
  const t = Math.max(0, ctx.threshold || 0);
  const allow = (k: Exclude<SnapKind, 'none'>) => ctx.targets?.[k] ?? true;
  const ignore = ctx.ignoreIds;

  let best: Vec2 | null = null;
  let bestD = Infinity;
  let bestGuides: SnapGuide[] = [];
  const consider = (c: Vec2, guides: () => SnapGuide[]) => {
    const d = distance(p, c);
    if (d <= t && d < bestD) { bestD = d; best = c; bestGuides = guides(); }
  };
  const finish = (kind: SnapKind): SnapResult | null => {
    if (!best) return null;
    const pt = best as Vec2;
    return { point: { x: pt.x, y: pt.y }, kind, guides: bestGuides };
  };

  // 1) Wandenden
  if (ctx.walls && allow('wall-end')) {
    for (const w of ctx.walls) {
      if (w.hidden || ignore?.has(w.id)) continue;
      consider(w.start, () => crossGuides(w.start, t, 'wall-end'));
      consider(w.end, () => crossGuides(w.end, t, 'wall-end'));
    }
    const r = finish('wall-end');
    if (r) return r;
  }
  // 2) Wandmitten
  if (ctx.walls && allow('wall-mid')) {
    for (const w of ctx.walls) {
      if (w.hidden || ignore?.has(w.id)) continue;
      const m = wallMidpoint(w);
      consider(m, () => [{ from: w.start, to: w.end, kind: 'wall-mid' }, ...crossGuides(m, t, 'wall-mid')]);
    }
    const r = finish('wall-mid');
    if (r) return r;
  }
  // 3) Hallen-Ecken (außen und innen)
  if (ctx.hall && ctx.hall.polygon.length >= 3 && allow('hall-vertex')) {
    for (const poly of [hallOuterPolygon(ctx.hall), hallInnerPolygon(ctx.hall)]) {
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const v = poly[i];
        consider(v, () => [
          { from: poly[(i - 1 + n) % n], to: v, kind: 'hall-vertex' },
          { from: v, to: poly[(i + 1) % n], kind: 'hall-vertex' },
        ]);
      }
    }
    const r = finish('hall-vertex');
    if (r) return r;
  }
  // 4) Objektecken
  if (ctx.items && ctx.items.length && allow('item-edge')) {
    const idx = itemIndexFor(ctx.items);
    const q: BBox = { minX: p.x - t, minY: p.y - t, maxX: p.x + t, maxY: p.y + t };
    idx.hash.forEachIn(q, (i) => {
      const it = idx.items[i];
      if (ignore?.has(it.id)) return;
      const fp = idx.footprints[i];
      for (let k = 0; k < 4; k++) {
        const c = fp[k];
        consider(c, () => [
          { from: fp[(k + 3) % 4], to: c, kind: 'item-edge' },
          { from: c, to: fp[(k + 1) % 4], kind: 'item-edge' },
        ]);
      }
    });
    const r = finish('item-edge');
    if (r) return r;
  }

  const axes = collectPointAxisCandidates(p, ctx, t, allow);

  // 5) Winkel (90°/45°) – mit Schnitt des Strahls an Ausrichtungslinien
  if (ctx.angleFrom && allow('angle')) {
    const from = ctx.angleFrom;
    const len = distance(from, p);
    if (len > EPS) {
      const a = snapAngle(from, p, 45);
      if (distance(a, p) <= t * 2) {
        const ux = (a.x - from.x) / len;
        const uy = (a.y - from.y) / len;
        let q: Vec2 | null = null;
        let qd = Infinity;
        let extra: SnapGuide | null = null;
        if (axes.x && Math.abs(ux) > 1e-9) {
          const s = (axes.x.v - from.x) / ux;
          if (s > 0) {
            const c = { x: axes.x.v, y: from.y + uy * s };
            const d = distance(c, p);
            if (d <= t && d < qd) { qd = d; q = c; extra = vLine(axes.x.v, Math.min(axes.x.lo, c.y), Math.max(axes.x.hi, c.y), 'item-edge'); }
          }
        }
        if (axes.y && Math.abs(uy) > 1e-9) {
          const s = (axes.y.v - from.y) / uy;
          if (s > 0) {
            const c = { x: from.x + ux * s, y: axes.y.v };
            const d = distance(c, p);
            if (d <= t && d < qd) { q = c; extra = hLine(axes.y.v, Math.min(axes.y.lo, c.x), Math.max(axes.y.hi, c.x), 'item-edge'); }
          }
        }
        if (q) {
          const guides: SnapGuide[] = [{ from, to: q, kind: 'angle' }];
          if (extra) guides.push(extra);
          return { point: q, kind: 'angle', guides };
        }
        const g = allow('grid') ? snapToGridAlongRay(from, a, ctx.gridSize) : a;
        return { point: g, kind: 'angle', guides: [{ from, to: g, kind: 'angle' }] };
      }
    }
  }

  // 6) Achsen-Ausrichtung (nur die getroffene Achse wird gefangen, die andere bleibt frei bzw. Raster)
  if (axes.x || axes.y) {
    const grid = allow('grid') ? snapToGrid(p, ctx.gridSize) : p;
    const pt = { x: axes.x ? axes.x.v : grid.x, y: axes.y ? axes.y.v : grid.y };
    const guides: SnapGuide[] = [];
    if (axes.x) guides.push(vLine(axes.x.v, Math.min(axes.x.lo, pt.y), Math.max(axes.x.hi, pt.y), 'item-edge'));
    if (axes.y) guides.push(hLine(axes.y.v, Math.min(axes.y.lo, pt.x), Math.max(axes.y.hi, pt.x), 'item-edge'));
    return { point: pt, kind: 'item-edge', guides };
  }

  // 7) Raster
  if (allow('grid') && ctx.gridSize > 0) return { point: snapToGrid(p, ctx.gridSize), kind: 'grid', guides: [] };
  return NONE(p);
}

/* ------------------------------------------------------------------ */
/* Objekt-Snapping                                                     */
/* ------------------------------------------------------------------ */

type ItemGeom = Pick<PlacedItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>;

/** Achsenparallele Bounding-Box der (gedrehten) Grundfläche. */
export function itemBounds(item: ItemGeom): BBox {
  return bbox(rectCorners(item.x, item.y, item.width, item.depth, item.rotation));
}

/**
 * Snapping für ein ganzes Objekt (Mittelpunkt): die vier Kanten der Bounding-Box an Kanten anderer Objekte,
 * Wandflächen (Innenseiten axialer Wände) und Hallen-Innenkanten; Zentrum an Zentren anderer Objekte;
 * sonst Raster für den Mittelpunkt. Objekte in ignoreIds (und das Objekt selbst) werden ausgeschlossen.
 * Rückgabe: neuer Mittelpunkt + Hilfslinien entlang der gefangenen Kanten.
 */
export function snapItemPosition(item: Pick<PlacedItem, 'id' | 'x' | 'y' | 'width' | 'depth' | 'rotation'>, desired: Vec2, ctx: SnapContext): SnapResult {
  if (!ctx.enabled || !Number.isFinite(desired.x) || !Number.isFinite(desired.y)) return NONE(desired);
  const t = Math.max(0, ctx.threshold || 0);
  const allow = (k: Exclude<SnapKind, 'none'>) => ctx.targets?.[k] ?? true;
  const ignore = ctx.ignoreIds;
  const box = itemBounds({ x: desired.x, y: desired.y, width: item.width, depth: item.depth, rotation: item.rotation });
  const b = newAxisBest();
  // offerX/offerY merken Ziel-Koordinate + Spanne (Hilfslinie); zusätzlich halten wir fest, welche eigene
  // Kante (bzw. das Zentrum) gefangen wurde, um den Versatz des Mittelpunkts zu berechnen.
  let refX = 0;
  let refY = 0;
  const tryX = (myEdge: number, v: number, lo: number, hi: number) => {
    const before = b.dx;
    offerX(b, myEdge, v, lo, hi, t);
    if (b.dx !== before) refX = myEdge;
  };
  const tryY = (myEdge: number, v: number, lo: number, hi: number) => {
    const before = b.dy;
    offerY(b, myEdge, v, lo, hi, t);
    if (b.dy !== before) refY = myEdge;
  };

  // Objekte
  if (ctx.items && ctx.items.length && allow('item-edge')) {
    const idx = itemIndexFor(ctx.items);
    idx.hash.forEachIn(expandBox(box, ALIGN_RANGE), (i) => {
      const it = idx.items[i];
      if (it.id === item.id || ignore?.has(it.id)) return;
      const nb = idx.boxes[i];
      for (const v of [nb.minX, nb.maxX]) { tryX(box.minX, v, nb.minY, nb.maxY); tryX(box.maxX, v, nb.minY, nb.maxY); }
      for (const v of [nb.minY, nb.maxY]) { tryY(box.minY, v, nb.minX, nb.maxX); tryY(box.maxY, v, nb.minX, nb.maxX); }
      tryX(desired.x, it.x, it.y, it.y);
      tryY(desired.y, it.y, it.x, it.x);
    });
  }
  // Wandflächen (nur achsenparallele Wände)
  if (ctx.walls && ctx.walls.length && allow('wall-end')) {
    const widx = wallIndexFor(ctx.walls);
    widx.hash.forEachIn(expandBox(box, ALIGN_RANGE), (wi) => {
      const w = widx.walls[wi];
      if (ignore?.has(w.id)) return;
      const wb = widx.boxes[wi];
      const half = w.thickness / 2;
      if (Math.abs(w.start.x - w.end.x) < 1e-6) {
        for (const v of [w.start.x - half, w.start.x + half]) { tryX(box.minX, v, wb.minY, wb.maxY); tryX(box.maxX, v, wb.minY, wb.maxY); }
      } else if (Math.abs(w.start.y - w.end.y) < 1e-6) {
        for (const v of [w.start.y - half, w.start.y + half]) { tryY(box.minY, v, wb.minX, wb.maxX); tryY(box.maxY, v, wb.minX, wb.maxX); }
      }
    });
  }
  // Hallen-Innenkanten
  if (ctx.hall && ctx.hall.polygon.length >= 3 && allow('hall-vertex')) {
    const inner = hallInnerPolygon(ctx.hall);
    const n = inner.length;
    for (let i = 0; i < n; i++) {
      const p0 = inner[i];
      const p1 = inner[(i + 1) % n];
      if (Math.abs(p0.x - p1.x) < 1e-6) {
        tryX(box.minX, p0.x, p0.y, p1.y); tryX(box.maxX, p0.x, p0.y, p1.y);
      } else if (Math.abs(p0.y - p1.y) < 1e-6) {
        tryY(box.minY, p0.y, p0.x, p1.x); tryY(box.maxY, p0.y, p0.x, p1.x);
      }
    }
  }

  const gridOn = allow('grid') && ctx.gridSize > 0;
  const grid = gridOn ? snapToGrid(desired, ctx.gridSize) : desired;
  const dx = b.x ? b.x.v - refX : 0;
  const dy = b.y ? b.y.v - refY : 0;
  const point = { x: b.x ? desired.x + dx : grid.x, y: b.y ? desired.y + dy : grid.y };
  if (!b.x && !b.y) return gridOn ? { point, kind: 'grid', guides: [] } : NONE(desired);
  const guides: SnapGuide[] = [];
  const shiftX = point.x - desired.x;
  const shiftY = point.y - desired.y;
  if (b.x) guides.push(vLine(b.x.v, Math.min(b.x.lo, box.minY + shiftY), Math.max(b.x.hi, box.maxY + shiftY), 'item-edge'));
  if (b.y) guides.push(hLine(b.y.v, Math.min(b.y.lo, box.minX + shiftX), Math.max(b.y.hi, box.maxX + shiftX), 'item-edge'));
  return { point, kind: 'item-edge', guides };
}

/* ------------------------------------------------------------------ */
/* Wandmontage                                                         */
/* ------------------------------------------------------------------ */

export interface WallSideSnap {
  x: number;
  y: number;
  rotation: number;
  wallId: string;
}

/** Drehung, bei der die Objekt-Rückseite (lokal −y) gegen die Richtung `n` (Wand → Objekt) zeigt. */
function rotationFacingAwayFrom(n: Vec2): number {
  const deg = (Math.atan2(-n.x, n.y) * 180) / Math.PI;
  // Auf 1/1000° runden (Float-Rauschen), 360 → 0, kein -0.
  return ((Math.round(normalizeAngle(deg) * 1000) / 1000) % 360) + 0;
}

/**
 * Richtet ein Objekt mit der Rückseite (lokal −y) bündig an der nächsten Wandfläche aus und dreht es passend
 * (für Wandmontage-Objekte, Spinde, Spiegel …). Abstand = Lücke zwischen Objekt-Rückseite und Wandfläche
 * (plus seitlicher Überstand über das Wandende). Ergebnis bleibt seitlich innerhalb der Wandlänge.
 */
export function snapToWallSide(item: ItemGeom, walls: Wall[], maxDist = 40): WallSideSnap | null {
  let best: WallSideSnap | null = null;
  let bestD = Infinity;
  const c = { x: item.x, y: item.y };
  for (const w of walls) {
    if (w.hidden) continue;
    const len = wallLength(w);
    if (len < EPS) continue;
    const n = wallNormal(w);
    const dir = wallDirection(w);
    const rel = { x: c.x - w.start.x, y: c.y - w.start.y };
    const side = rel.x * n.x + rel.y * n.y >= 0 ? 1 : -1;
    const sideDist = Math.abs(rel.x * n.x + rel.y * n.y);
    const gap = Math.max(0, sideDist - w.thickness / 2 - item.depth / 2);
    const along = rel.x * dir.x + rel.y * dir.y;
    const halfW = item.width / 2;
    const clamped = len >= item.width ? Math.min(Math.max(along, halfW), len - halfW) : len / 2;
    const overshoot = Math.abs(along - clamped);
    const d = Math.hypot(gap, overshoot);
    if (d > maxDist || d >= bestD) continue;
    const ns = { x: n.x * side, y: n.y * side };
    const base = pointOnWall(w, clamped);
    const off = w.thickness / 2 + item.depth / 2;
    bestD = d;
    best = { x: base.x + ns.x * off, y: base.y + ns.y * off, rotation: rotationFacingAwayFrom(ns), wallId: w.id };
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Rack-Module                                                         */
/* ------------------------------------------------------------------ */

export type RackSide = 'left' | 'right' | 'back';

export interface DockResult {
  x: number;
  y: number;
  rotation: number;
  dockedTo: string;
  side: RackSide;
}

/**
 * Dockt ein Rack-Modul (nur_an_rack) bündig an die nächstgelegene Seite (links/rechts/hinten) eines Racks an.
 * Die Modul-Rückseite (lokal −y) liegt an der Rackseite, das Modul ragt nach außen; seitlich bleibt es innerhalb
 * der Rackseite. `racks` ist die Kandidatenliste (z. B. Objekte mit symbol 'rack'/'half-rack').
 * null, wenn kein Rack näher als maxDist (Abstand Modulmittelpunkt → Andockposition).
 */
export function dockToRack(module: Pick<PlacedItem, 'id' | 'x' | 'y' | 'width' | 'depth' | 'rotation'>, racks: PlacedItem[], maxDist = 150): DockResult | null {
  let best: DockResult | null = null;
  let bestD = Infinity;
  for (const rack of racks) {
    if (rack.hidden || rack.id === module.id) continue;
    const r = (rack.rotation * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const ex = { x: cos, y: sin }; // lokale +x
    const ey = { x: -sin, y: cos }; // lokale +y (vorne)
    const rel = { x: module.x - rack.x, y: module.y - rack.y };
    const sides: { side: RackSide; n: Vec2; half: number; tangent: Vec2; len: number }[] = [
      { side: 'left', n: { x: -ex.x, y: -ex.y }, half: rack.width / 2, tangent: ey, len: rack.depth },
      { side: 'right', n: ex, half: rack.width / 2, tangent: ey, len: rack.depth },
      { side: 'back', n: { x: -ey.x, y: -ey.y }, half: rack.depth / 2, tangent: ex, len: rack.width },
    ];
    for (const s of sides) {
      const maxT = Math.max(0, s.len / 2 - module.width / 2);
      const tRaw = rel.x * s.tangent.x + rel.y * s.tangent.y;
      const tt = Math.min(Math.max(tRaw, -maxT), maxT);
      const off = s.half + module.depth / 2;
      const x = rack.x + s.n.x * off + s.tangent.x * tt;
      const y = rack.y + s.n.y * off + s.tangent.y * tt;
      const d = Math.hypot(x - module.x, y - module.y);
      if (d < bestD) {
        bestD = d;
        best = { x, y, rotation: rotationFacingAwayFrom(s.n), dockedTo: rack.id, side: s.side };
      }
    }
  }
  return best && bestD <= maxDist ? best : null;
}

/* ------------------------------------------------------------------ */
/* Abstände                                                            */
/* ------------------------------------------------------------------ */

export type DistanceSide = 'left' | 'right' | 'top' | 'bottom';

export interface NearestDistance {
  side: DistanceSide;
  /** Lichter Abstand in cm. */
  distance: number;
  /** Endpunkte der Maßlinie (from am Hindernis, to am Objekt). */
  from: Vec2;
  to: Vec2;
  /** ID des Hindernisses (Objekt, Wand oder `hall_<i>` für Hallenkanten). */
  targetId: string;
}

export interface NearestDistanceOptions {
  /** Hallen-Innenpolygon (Innenkanten als Hindernis). */
  hallInner?: Vec2[] | null;
  /** Maximale Messdistanz (Standard 2000 cm). */
  maxDist?: number;
  /** Weitere zu ignorierende Objekt-IDs (z. B. gesamte gezogene Auswahl). */
  ignoreIds?: Set<string>;
}

/**
 * Abstände (links/rechts/oben/unten in Weltachsen) von der Bounding-Box eines Objekts zum nächsten Hindernis
 * (Objekt, Wandfläche, Hallen-Innenkante), das sich in der jeweiligen Richtung mit dem Objekt überlappt.
 * Für die Anzeige „Abstand zum nächsten Objekt beim Ziehen“. Höchstens ein Eintrag je Seite, max. `maxDist`.
 */
export function nearestDistances(item: Pick<PlacedItem, 'id' | 'x' | 'y' | 'width' | 'depth' | 'rotation'>, others: PlacedItem[], walls: Wall[], opts: NearestDistanceOptions = {}): NearestDistance[] {
  const maxDist = opts.maxDist ?? 2000;
  const box = itemBounds(item);
  const best: Record<DistanceSide, NearestDistance | null> = { left: null, right: null, top: null, bottom: null };
  const q = expandBox(box, maxDist);

  const offerPoly = (id: string, poly: Vec2[], pb: BBox) => {
    // Horizontal (links/rechts): Hindernis im y-Band des Objekts
    if (pb.maxY > box.minY + EPS && pb.minY < box.maxY - EPS) {
      const lo = Math.max(box.minY, pb.minY);
      const hi = Math.min(box.maxY, pb.maxY);
      const ext = polygonExtentInBand(poly, 'x', lo, hi);
      if (ext) {
        const mid = (lo + hi) / 2;
        if (ext.max <= box.minX + EPS) {
          const d = box.minX - ext.max;
          if (d > 0 && d <= maxDist && (!best.left || d < best.left.distance)) best.left = { side: 'left', distance: d, from: { x: ext.max, y: mid }, to: { x: box.minX, y: mid }, targetId: id };
        }
        if (ext.min >= box.maxX - EPS) {
          const d = ext.min - box.maxX;
          if (d > 0 && d <= maxDist && (!best.right || d < best.right.distance)) best.right = { side: 'right', distance: d, from: { x: ext.min, y: mid }, to: { x: box.maxX, y: mid }, targetId: id };
        }
      }
    }
    // Vertikal (oben/unten): Hindernis im x-Band des Objekts
    if (pb.maxX > box.minX + EPS && pb.minX < box.maxX - EPS) {
      const lo = Math.max(box.minX, pb.minX);
      const hi = Math.min(box.maxX, pb.maxX);
      const ext = polygonExtentInBand(poly, 'y', lo, hi);
      if (ext) {
        const mid = (lo + hi) / 2;
        if (ext.max <= box.minY + EPS) {
          const d = box.minY - ext.max;
          if (d > 0 && d <= maxDist && (!best.top || d < best.top.distance)) best.top = { side: 'top', distance: d, from: { x: mid, y: ext.max }, to: { x: mid, y: box.minY }, targetId: id };
        }
        if (ext.min >= box.maxY - EPS) {
          const d = ext.min - box.maxY;
          if (d > 0 && d <= maxDist && (!best.bottom || d < best.bottom.distance)) best.bottom = { side: 'bottom', distance: d, from: { x: mid, y: ext.min }, to: { x: mid, y: box.maxY }, targetId: id };
        }
      }
    }
  };

  if (others.length) {
    const idx = itemIndexFor(others);
    idx.hash.forEachIn(q, (i) => {
      const it = idx.items[i];
      if (it.id === item.id || opts.ignoreIds?.has(it.id)) return;
      offerPoly(it.id, idx.footprints[i], idx.boxes[i]);
    });
  }
  if (walls.length) {
    const widx = wallIndexFor(walls);
    widx.hash.forEachIn(q, (wi) => offerPoly(widx.walls[wi].id, widx.rects[wi], widx.boxes[wi]));
  }
  const inner = opts.hallInner;
  if (inner && inner.length >= 3) {
    const n = inner.length;
    for (let i = 0; i < n; i++) {
      const seg = [inner[i], inner[(i + 1) % n]];
      offerPoly(`hall_${i}`, seg, bbox(seg));
    }
  }
  const out: NearestDistance[] = [];
  for (const side of ['left', 'right', 'top', 'bottom'] as const) if (best[side]) out.push(best[side]!);
  return out;
}
