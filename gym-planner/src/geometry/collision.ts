/**
 * Kollisions- und Sicherheitsprüfungen (reine Funktionen, cm).
 * Broadphase über SpatialHash, Narrowphase per Trennachsen-Test (konvex) bzw. Kantenschnitt + Punkt-in-Polygon (beliebig).
 */
import type { Vec2, PlacedItem, Wall, SafetyZone, Door } from '@/types';
import { bbox, bboxOverlap, add, scale, pointInPolygon, distanceToSegment, segmentIntersection, signedArea, EPS, type BBox } from './polygon';
import { itemFootprint, itemSafetyPolygon, zoneIsEmpty } from './transform';
import { openingPlacement } from './walls';
import { itemIndexFor, wallIndexFor, expandBox, SpatialHash } from './spatialHash';
import { DOOR_TYPE_MAP } from '@/data/wallTypes';

/** Trennende Achse entlang der Kanten von `edges` gesucht (SAT-Hälfte, ohne Allokationen). */
function separatedByEdgesOf(edges: Vec2[], a: Vec2[], b: Vec2[], tolerance: number): boolean {
  const n = edges.length;
  const na = a.length;
  const nb = b.length;
  for (let i = 0; i < n; i++) {
    const p = edges[i];
    const q = edges[i + 1 < n ? i + 1 : 0];
    let ax = -(q.y - p.y);
    let ay = q.x - p.x;
    const len = Math.hypot(ax, ay);
    if (len < EPS) continue;
    ax /= len;
    ay /= len;
    let minA = Infinity; let maxA = -Infinity;
    for (let k = 0; k < na; k++) { const d = a[k].x * ax + a[k].y * ay; if (d < minA) minA = d; if (d > maxA) maxA = d; }
    let minB = Infinity; let maxB = -Infinity;
    for (let k = 0; k < nb; k++) { const d = b[k].x * ax + b[k].y * ay; if (d < minB) minB = d; if (d > maxB) maxB = d; }
    if (maxA <= minB + tolerance || maxB <= minA + tolerance) return true;
  }
  return false;
}

/** SAT ohne Bounding-Box-Vorprüfung (Aufrufer hat sie bereits gemacht). */
function satOverlap(a: Vec2[], b: Vec2[], tolerance: number): boolean {
  if (a.length < 3 || b.length < 3) return false;
  return !separatedByEdgesOf(a, a, b, tolerance) && !separatedByEdgesOf(b, a, b, tolerance);
}

/** Trennachsen-Test (SAT) für konvexe Polygone. Berührung an der Kante gilt nicht als Überlappung. */
export function convexPolygonsOverlap(a: Vec2[], b: Vec2[], tolerance = 0.01): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (!bboxOverlap(bbox(a), bbox(b), -tolerance)) return false;
  return satOverlap(a, b, tolerance);
}

/** Punkt strikt innerhalb (nicht auf dem Rand, Toleranz `tol`). */
function pointStrictlyInside(p: Vec2, poly: Vec2[], tol: number): boolean {
  if (!pointInPolygon(p, poly)) return false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) if (distanceToSegment(p, poly[i], poly[j]) <= tol) return false;
  return true;
}

/**
 * Überlappung beliebiger einfacher Polygone (auch konkav): echter Kantenschnitt oder ein Punkt des einen
 * strikt im anderen. Reine Berührung (gemeinsame Kante/Ecke) zählt nicht. `tolerance` in cm.
 */
export function polygonsOverlap(a: Vec2[], b: Vec2[], tolerance = 0.01): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (!bboxOverlap(bbox(a), bbox(b), -tolerance)) return false;
  const na = a.length;
  const nb = b.length;
  for (let i = 0; i < na; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % na];
    const la = Math.hypot(a2.x - a1.x, a2.y - a1.y);
    if (la < EPS) continue;
    for (let j = 0; j < nb; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % nb];
      const lb = Math.hypot(b2.x - b1.x, b2.y - b1.y);
      if (lb < EPS) continue;
      const hit = segmentIntersection(a1, a2, b1, b2, false);
      if (!hit) continue;
      // Schnittpunkt muss echt im Inneren beider Strecken liegen (nicht innerhalb der Toleranz an einem Ende).
      const ta = tolerance / la;
      const tb = tolerance / lb;
      if (hit.t > ta && hit.t < 1 - ta && hit.u > tb && hit.u < 1 - tb) return true;
    }
  }
  for (const p of a) if (pointStrictlyInside(p, b, tolerance)) return true;
  for (const p of b) if (pointStrictlyInside(p, a, tolerance)) return true;
  // Deckungsgleiche / gemeinsame Kanten (z. B. identische Polygone, auch konkav): Kantenmitten leicht
  // nach innen versetzt prüfen – liegt so ein Punkt strikt im anderen Polygon, überlappen sie.
  const probe = Math.max(tolerance * 2, 1e-4);
  for (const p of interiorProbes(a, probe)) if (pointStrictlyInside(p, b, tolerance)) return true;
  for (const p of interiorProbes(b, probe)) if (pointStrictlyInside(p, a, tolerance)) return true;
  return false;
}

/** Kantenmitten, um `d` ins Innere des Polygons versetzt (Orientierung wird berücksichtigt). */
function interiorProbes(poly: Vec2[], d: number): Vec2[] {
  const n = poly.length;
  const cw = signedArea(poly) > 0;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    // Innennormale bei Uhrzeigersinn (y nach unten): (-dy, dx)
    const nx = (cw ? -dy : dy) / len;
    const ny = (cw ? dx : -dx) / len;
    out.push({ x: (p.x + q.x) / 2 + nx * d, y: (p.y + q.y) / 2 + ny * d });
  }
  return out;
}

/**
 * Ausdehnung eines Polygons (oder einer Strecke aus 2 Punkten) entlang `axis`, beschränkt auf das Band
 * [lo, hi] der jeweils anderen Achse. null, wenn das Polygon das Band nicht berührt.
 * Für Abstandsmessung: „Wie weit reicht das Hindernis in x, im y-Bereich des Objekts?“
 */
export function polygonExtentInBand(poly: Vec2[], axis: 'x' | 'y', lo: number, hi: number): { min: number; max: number } | null {
  const n = poly.length;
  if (n === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  const take = (v: number) => { if (v < min) min = v; if (v > max) max = v; };
  const along = (p: Vec2) => (axis === 'x' ? p.x : p.y);
  const across = (p: Vec2) => (axis === 'x' ? p.y : p.x);
  const edges = n === 2 ? 1 : n;
  for (let i = 0; i < edges; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const pc = across(p);
    const qc = across(q);
    if (pc >= lo - EPS && pc <= hi + EPS) take(along(p));
    if (n === 2 && qc >= lo - EPS && qc <= hi + EPS) take(along(q));
    const dc = qc - pc;
    if (Math.abs(dc) < EPS) continue;
    for (const bound of [lo, hi]) {
      const t = (bound - pc) / dc;
      if (t > 0 && t < 1) take(along(p) + (along(q) - along(p)) * t);
    }
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/* ------------------------------------------------------------------ */
/* Kollisionen                                                         */
/* ------------------------------------------------------------------ */

export type CollisionKind = 'item-item' | 'item-zone' | 'zone-zone' | 'item-wall' | 'zone-wall';

export interface Collision {
  /** Bei item-zone: a = Besitzer der Sicherheitszone, b = das darin stehende Objekt. Bei *-wall: b = Wand-ID. */
  a: string;
  b: string;
  kind: CollisionKind;
}

export interface CollisionOptions {
  /** Sicherheitszonen berücksichtigen (Standard true). */
  includeZones?: boolean;
  /** Wände berücksichtigen. */
  walls?: Wall[];
  /** Nur Paare prüfen, an denen mindestens eine dieser IDs beteiligt ist (z. B. beim Ziehen). */
  onlyIds?: Set<string>;
  /** IDs von Wandmontage-Objekten (dürfen ihre Wand mit 1 cm Toleranz berühren). */
  wallMountedIds?: Set<string>;
  /** Sicherheitszonen auch gegen Wände prüfen (Standard false – Geräte stehen oft an Wänden). */
  zonesAgainstWalls?: boolean;
}

/** Bauelemente, die nicht gegen Wände geprüft werden. */
const NO_WALL_CHECK: ReadonlySet<PlacedItem['kind']> = new Set(['column', 'radiator', 'vent']);
/** Toleranz beim Berühren der eigenen Wand (Wandmontage / wallId). */
const WALL_TOUCH_TOLERANCE = 1;

/** Aktive Sicherheitszone eines Objekts (null, wenn deaktiviert oder überall 0). */
export function effectiveZone(it: PlacedItem): SafetyZone | null {
  if (!it.safetyZoneEnabled || !it.safetyZone || zoneIsEmpty(it.safetyZone)) return null;
  return it.safetyZone;
}

/** Polygon der aktiven Sicherheitszone (null, wenn keine) – für Ebenen und Analyse. */
export function itemZonePolygon(it: PlacedItem): Vec2[] | null {
  const z = effectiveZone(it);
  return z ? itemSafetyPolygon(it, z) : null;
}

/**
 * Findet alle Überlappungen zwischen Objekten (Grundflächen), Sicherheitszonen und Wänden.
 * Broadphase: SpatialHash (gecacht je Array), Narrowphase: SAT. Pro Objektpaar höchstens eine Kollision
 * (Priorität item-item > item-zone > zone-zone). Versteckte Objekte/Wände werden ignoriert, angedockte
 * Module nicht gegen ihr Rack geprüft, Objekte derselben Gruppe sehr wohl.
 */
export function findCollisions(items: PlacedItem[], opts: CollisionOptions = {}): Collision[] {
  const out: Collision[] = [];
  const includeZones = opts.includeZones ?? true;
  const idx = itemIndexFor(items);
  const { footprints: fps, boxes, zones, zoneBoxes, hash } = idx;
  const only = opts.onlyIds;
  const n = items.length;

  const pairChecked = (i: number, j: number): boolean => {
    // Jedes Paar genau einmal: ohne onlyIds über i<j; mit onlyIds über das erste beteiligte Element.
    if (!only) return j > i;
    const jIn = only.has(items[j].id);
    return !jIn || j > i;
  };

  for (let i = 0; i < n; i++) {
    const A = items[i];
    if (A.hidden) continue;
    if (only && !only.has(A.id)) continue;
    const zA = includeZones ? zones[i] : null;
    const queryBox = zA && zoneBoxes[i] ? unionBoxes(boxes[i], zoneBoxes[i]!) : boxes[i];
    hash.forEachIn(queryBox, (j) => {
      if (j === i || !pairChecked(i, j)) return;
      const B = items[j];
      if (B.hidden) return;
      if (A.dockedTo === B.id || B.dockedTo === A.id) return;
      if (bboxOverlap(boxes[i], boxes[j], -0.01) && satOverlap(fps[i], fps[j], 0.01)) {
        out.push({ a: A.id, b: B.id, kind: 'item-item' });
        return;
      }
      if (!includeZones) return;
      const zB = zones[j];
      if (zA && zoneBoxes[i] && bboxOverlap(zoneBoxes[i]!, boxes[j], -0.01) && satOverlap(zA, fps[j], 0.01)) {
        out.push({ a: A.id, b: B.id, kind: 'item-zone' });
        return;
      }
      if (zB && zoneBoxes[j] && bboxOverlap(zoneBoxes[j]!, boxes[i], -0.01) && satOverlap(zB, fps[i], 0.01)) {
        out.push({ a: B.id, b: A.id, kind: 'item-zone' });
        return;
      }
      if (zA && zB && zoneBoxes[i] && zoneBoxes[j] && bboxOverlap(zoneBoxes[i]!, zoneBoxes[j]!, -0.01) && satOverlap(zA, zB, 0.01)) {
        out.push({ a: A.id, b: B.id, kind: 'zone-zone' });
      }
    });
  }

  if (opts.walls && opts.walls.length) {
    const widx = wallIndexFor(opts.walls);
    const zonesVsWalls = includeZones && (opts.zonesAgainstWalls ?? false);
    for (let i = 0; i < n; i++) {
      const A = items[i];
      if (A.hidden || NO_WALL_CHECK.has(A.kind)) continue;
      if (only && !only.has(A.id)) continue;
      const mounted = !!A.wallId || (opts.wallMountedIds?.has(A.id) ?? false);
      const zA = zonesVsWalls ? zones[i] : null;
      const queryBox = zA && zoneBoxes[i] ? unionBoxes(boxes[i], zoneBoxes[i]!) : boxes[i];
      let hitWall: string | null = null;
      let hitZoneWall: string | null = null;
      widx.hash.forEachIn(queryBox, (wi) => {
        if (hitWall) return;
        const w = widx.walls[wi];
        const rect = widx.rects[wi];
        const own = A.wallId === w.id;
        const tol = mounted || own ? WALL_TOUCH_TOLERANCE : 0.01;
        if (bboxOverlap(boxes[i], widx.boxes[wi], -tol) && satOverlap(fps[i], rect, tol)) {
          hitWall = w.id;
          return;
        }
        if (zA && !hitZoneWall && !own && zoneBoxes[i] && bboxOverlap(zoneBoxes[i]!, widx.boxes[wi], -tol) && satOverlap(zA, rect, tol)) hitZoneWall = w.id;
      });
      if (hitWall) out.push({ a: A.id, b: hitWall, kind: 'item-wall' });
      else if (hitZoneWall) out.push({ a: A.id, b: hitZoneWall, kind: 'zone-wall' });
    }
  }
  return out;
}

function unionBoxes(a: BBox, b: BBox): BBox {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
}

/** Menge aller Objekt-IDs, die an einer Kollision beteiligt sind (Wand-IDs eingeschlossen). */
export function collidingIds(cols: Collision[]): Set<string> {
  const s = new Set<string>();
  for (const c of cols) { s.add(c.a); s.add(c.b); }
  return s;
}

export function itemsOverlap(a: PlacedItem, b: PlacedItem): boolean {
  return convexPolygonsOverlap(itemFootprint(a), itemFootprint(b));
}

/* ------------------------------------------------------------------ */
/* Halle                                                               */
/* ------------------------------------------------------------------ */

/** Alle vier Ecken der Grundfläche innerhalb des Hallen-Innenpolygons (Toleranz 0,5 cm). Leeres Polygon → true. */
export function itemInsideHall(item: Pick<PlacedItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>, hallInnerPolygon: Vec2[], tolerance = 0.5): boolean {
  if (hallInnerPolygon.length < 3) return true;
  const n = hallInnerPolygon.length;
  for (const c of itemFootprint(item)) {
    if (pointInPolygon(c, hallInnerPolygon)) continue;
    let near = false;
    for (let i = 0, j = n - 1; i < n && !near; j = i++) if (distanceToSegment(c, hallInnerPolygon[i], hallInnerPolygon[j]) <= tolerance) near = true;
    if (!near) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Türen                                                               */
/* ------------------------------------------------------------------ */

/** Tiefe des Freihaltebereichs vor Schiebetüren/Rolltoren (cm). */
export const SLIDING_DOOR_CLEARANCE = 60;

function signedNormal(door: Door, normal: Vec2): Vec2 {
  return door.swingSide === 'b' ? { x: -normal.x, y: -normal.y } : normal;
}

/** Kreissektor um `center` von Richtung `fromDir` nach `toDir` (kürzester Weg, 90°), Radius r. */
function sector(center: Vec2, fromDir: Vec2, toDir: Vec2, r: number, segments: number): Vec2[] {
  const a0 = Math.atan2(fromDir.y, fromDir.x);
  let a1 = Math.atan2(toDir.y, toDir.x);
  let sweep = a1 - a0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  a1 = a0 + sweep;
  const pts: Vec2[] = [{ x: center.x, y: center.y }];
  const steps = Math.max(2, segments);
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
  }
  return pts;
}

/**
 * Einzelne Schwenk-Sektoren einer Tür (1 oder 2), jeweils konvex. Für Schiebetür/Rolltor ein Rechteck
 * (Öffnungsbreite × 60 cm vor der Tür). Basis ist die Wandfläche auf der Seite `swingSide`;
 * Anschlag `hinge` 'left' = Türseite Richtung Wandanfang, 'right' = Richtung Wandende.
 */
export function doorSwingSectors(door: Door, wall: Wall, segments = 12): Vec2[][] {
  const pl = openingPlacement(door, wall);
  const info = DOOR_TYPE_MAP[door.doorType];
  const n = signedNormal(door, pl.normal);
  const face = scale(n, wall.thickness / 2);
  const a = add(pl.a, face);
  const b = add(pl.b, face);
  const w = Math.max(0, door.width);
  if (w <= 0) return [];
  if (info && !info.swings) {
    const depth = scale(n, SLIDING_DOOR_CLEARANCE);
    return [[a, b, add(b, depth), add(a, depth)]];
  }
  const dir = pl.dir;
  const back = { x: -dir.x, y: -dir.y };
  if (info?.leaves === 2) {
    return [sector(a, dir, n, w / 2, segments), sector(b, back, n, w / 2, segments)];
  }
  return door.hinge === 'right' ? [sector(b, back, n, w, segments)] : [sector(a, dir, n, w, segments)];
}

/**
 * Schwenkbereich einer Tür als ein Polygon (bei zwei Flügeln die Vereinigung beider Sektoren, konkav).
 * Leeres Array bei Breite 0.
 */
export function doorSwingPolygon(door: Door, wall: Wall, segments = 12): Vec2[] {
  const secs = doorSwingSectors(door, wall, segments);
  if (secs.length === 0) return [];
  if (secs.length === 1) return secs[0];
  // Vereinigung: a → b → Bogen 2 rückwärts (bis Mitte) → Bogen 1 rückwärts (Mitte → a + n·w/2)
  const s1 = secs[0];
  const s2 = secs[1];
  const arc1 = s1.slice(1); // von Mitte (Richtung dir) zu a + n·r
  const arc2 = s2.slice(1); // von Mitte (Richtung back) zu b + n·r
  const out: Vec2[] = [s1[0], s2[0]];
  for (let i = arc2.length - 1; i >= 1; i--) out.push(arc2[i]);
  out.push(arc2[0]); // Mitte
  for (let i = 1; i < arc1.length; i++) out.push(arc1[i]);
  return out;
}

/** Objekte, die nicht als Hindernis in Türbereichen zählen (Bauelemente in der Wand). */
const NOT_DOOR_OBSTACLE: ReadonlySet<PlacedItem['kind']> = new Set(['column', 'radiator', 'vent']);

/** Objekte, deren Grundfläche in einer Tür-Schwenkfläche steht. */
export function itemsInDoorSwing(items: PlacedItem[], doors: Door[], walls: Wall[]): { itemId: string; doorId: string }[] {
  const out: { itemId: string; doorId: string }[] = [];
  if (!items.length || !doors.length) return out;
  const idx = itemIndexFor(items);
  const wallById = new Map<string, Wall>();
  for (const w of walls) wallById.set(w.id, w);
  const seen = new Set<string>();
  for (const d of doors) {
    if (d.hidden) continue;
    const w = wallById.get(d.wallId);
    if (!w) continue;
    const secs = doorSwingSectors(d, w);
    for (const poly of secs) {
      if (poly.length < 3) continue;
      const pb = bbox(poly);
      idx.hash.forEachIn(pb, (i) => {
        const it = items[i];
        if (it.hidden || NOT_DOOR_OBSTACLE.has(it.kind)) return;
        const key = `${it.id}|${d.id}`;
        if (seen.has(key)) return;
        if (bboxOverlap(idx.boxes[i], pb, -0.5) && satOverlap(idx.footprints[i], poly, 0.5)) {
          seen.add(key);
          out.push({ itemId: it.id, doorId: d.id });
        }
      });
    }
  }
  return out;
}

/** Freihaltezonen vor einer Tür (beide Wandseiten): Rechteck Türbreite × clearance ab Wandfläche. */
export function emergencyExitClearanceRects(door: Door, wall: Wall, clearance = 150): Vec2[][] {
  const pl = openingPlacement(door, wall);
  const half = wall.thickness / 2;
  const out: Vec2[][] = [];
  for (const sgn of [1, -1] as const) {
    const n = scale(pl.normal, sgn);
    const a = add(pl.a, scale(n, half));
    const b = add(pl.b, scale(n, half));
    const d = scale(n, clearance);
    out.push([a, b, add(b, d), add(a, d)]);
  }
  return out;
}

/** true, wenn ein sichtbares Objekt im Freihaltebereich (Türbreite × clearance, beide Wandseiten) steht. */
export function emergencyExitBlocked(items: PlacedItem[], door: Door, wall: Wall, clearance = 150): boolean {
  if (!items.length) return false;
  const idx = itemIndexFor(items);
  let blocked = false;
  for (const rect of emergencyExitClearanceRects(door, wall, clearance)) {
    const rb = bbox(rect);
    idx.hash.forEachIn(rb, (i) => {
      if (blocked) return;
      const it = items[i];
      if (it.hidden || NOT_DOOR_OBSTACLE.has(it.kind)) return;
      if (bboxOverlap(idx.boxes[i], rb, -0.5) && satOverlap(idx.footprints[i], rect, 0.5)) blocked = true;
    });
    if (blocked) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Laufwege / Engpässe                                                 */
/* ------------------------------------------------------------------ */

export interface Bottleneck {
  /** IDs der beiden Hindernisse (Objekt-, Wand- oder Hallenkanten-ID `hall_<i>`). */
  a: string;
  b: string;
  /** Lichte Weite des Durchgangs in cm. */
  width: number;
  /** Mittelpunkt des Durchgangs. */
  point: Vec2;
  /** Endpunkte der Maßlinie. */
  from: Vec2;
  to: Vec2;
  axis: 'x' | 'y';
}

export interface BottleneckOptions {
  /** Aktive Sicherheitszonen als Objektausdehnung verwenden (Standard true). */
  includeZones?: boolean;
  /** Abstände ≤ dieser Wert gelten als Berührung/Kollision, nicht als Engpass (Standard 1 cm). */
  touchTolerance?: number;
  /**
   * Nur Paare werten, an denen mindestens eines dieser Objekte beteiligt ist (z. B. Trainingsgeräte); bei
   * Objekt–Wand/Hallenkante muss das Objekt selbst dazugehören. Ohne Angabe zählen alle Objekte.
   */
  subjectIds?: ReadonlySet<string>;
  /** Objekte, die weder als Beteiligte noch als Hindernis zählen (z. B. Möbel in Nebenräumen). */
  excludeIds?: ReadonlySet<string>;
}

interface Shape {
  id: string;
  poly: Vec2[];
  box: BBox;
}

/** Mindest-Überlappung der Projektionen (cm), damit ein Spalt zwischen zwei Formen als Laufweg zählt. */
export const MIN_BOTTLENECK_OVERLAP_CM = 60;

/** Anteil des Bands [lo, hi] quer zum Spalt, den fremde Objekte belegen dürfen, bevor der Spalt nicht mehr als Laufweg zählt. */
export const MAX_BLOCKED_BAND_RATIO = 0.5;

interface AxisGap {
  width: number;
  from: Vec2;
  to: Vec2;
  aIsLeft: boolean;
  /** Spalt entlang der Achse: [gapLo, gapHi]; Band quer dazu: [lo, hi]. */
  gapLo: number;
  gapHi: number;
  lo: number;
  hi: number;
}

/** Achsenparalleler Spalt zwischen zwei Formen (nur wenn sich ihre Projektionen um mindestens 60 cm überlappen). */
function axisGap(A: Shape, B: Shape, axis: 'x' | 'y'): AxisGap | null {
  const lo = axis === 'x' ? Math.max(A.box.minY, B.box.minY) : Math.max(A.box.minX, B.box.minX);
  const hi = axis === 'x' ? Math.min(A.box.maxY, B.box.maxY) : Math.min(A.box.maxX, B.box.maxX);
  if (hi - lo < MIN_BOTTLENECK_OVERLAP_CM - EPS) return null;
  const ea = polygonExtentInBand(A.poly, axis, lo, hi);
  const eb = polygonExtentInBand(B.poly, axis, lo, hi);
  if (!ea || !eb) return null;
  let left: { min: number; max: number };
  let right: { min: number; max: number };
  let aIsLeft: boolean;
  if (ea.max <= eb.min + EPS) { left = ea; right = eb; aIsLeft = true; } else if (eb.max <= ea.min + EPS) { left = eb; right = ea; aIsLeft = false; } else return null;
  const width = right.min - left.max;
  const mid = (lo + hi) / 2;
  const from = axis === 'x' ? { x: left.max, y: mid } : { x: mid, y: left.max };
  const to = axis === 'x' ? { x: right.min, y: mid } : { x: mid, y: right.min };
  return { width, from, to, aIsLeft, gapLo: left.max, gapHi: right.min, lo, hi };
}

/** Rechteck des Spalts (Spalt entlang `axis`, Band quer dazu). */
function gapBox(g: AxisGap, axis: 'x' | 'y'): BBox {
  return axis === 'x'
    ? { minX: g.gapLo, minY: g.lo, maxX: g.gapHi, maxY: g.hi }
    : { minX: g.lo, minY: g.gapLo, maxX: g.hi, maxY: g.gapHi };
}

/** Länge der Vereinigung von Intervallen (bereits auf [lo, hi] beschnitten). */
function unionLength(intervals: { min: number; max: number }[]): number {
  if (!intervals.length) return 0;
  intervals.sort((a, b) => a.min - b.min);
  let total = 0;
  let cur = { ...intervals[0] };
  for (let i = 1; i < intervals.length; i++) {
    const iv = intervals[i];
    if (iv.min <= cur.max) cur.max = Math.max(cur.max, iv.max);
    else { total += cur.max - cur.min; cur = { ...iv }; }
  }
  return total + (cur.max - cur.min);
}

/** Zeigt die Rückseite des Objekts (lokal −y) in Richtung `dir` (Weltkoordinaten, Toleranz ≈ ±41°)? */
function backFaces(it: Pick<PlacedItem, 'rotation'>, dir: Vec2): boolean {
  const r = (it.rotation * Math.PI) / 180;
  // lokal (0, −1) gedreht um r (im Uhrzeigersinn, y nach unten)
  const back = { x: Math.sin(r), y: -Math.cos(r) };
  return back.x * dir.x + back.y * dir.y > 0.75;
}

/**
 * Heuristik für zu schmale Laufwege: Für Objektpaare (inkl. aktiver Sicherheitszonen), Objekt–Wand und
 * Objekt–Hallenkante mit achsenparallelem Abstand 0 < d < minWidth, deren Projektionen sich um mindestens
 * 60 cm überlappen (also wirklich ein Durchgang dazwischen liegt). Kein Laufweg ist der Spalt
 * - zwischen der Rückseite eines Objekts (lokal −y) und einer Wand/Hallenkante (Gerät steht mit dem Rücken zur Wand),
 * - zwischen zwei Objekten, die sich beide mit der Rückseite zuwenden (Reihen Rücken an Rücken),
 * - der zu mehr als MAX_BLOCKED_BAND_RATIO von weiteren Objekten oder Wänden belegt ist (z. B. Ständer zwischen
 *   zwei Racks, Wand zwischen zwei Räumen) – die Durchgänge zu diesem Objekt werden als eigene Paare geprüft.
 * Paare werden dedupliziert (kleinster Abstand gewinnt); Berührung/Überlappung (d ≤ 1 cm) ist Kollision, kein Engpass.
 * `walls` sollte die realen Wände enthalten, die Halle wird über `hallInner` (Innenpolygon) abgedeckt – doppelte
 * Hallen-Außenwände werden dedupliziert. Mit `subjectIds` werden nur Paare mit mindestens einem dieser Objekte
 * gewertet, `excludeIds` nimmt Objekte ganz aus der Prüfung.
 */
export function escapeRouteBottlenecks(items: PlacedItem[], walls: Wall[], hallInner: Vec2[] | null | undefined, minWidth: number, opts: BottleneckOptions = {}): Bottleneck[] {
  const out: Bottleneck[] = [];
  if (!(minWidth > 0)) return out;
  const includeZones = opts.includeZones ?? true;
  const touch = opts.touchTolerance ?? 1;
  const subjects = opts.subjectIds;
  const excluded = opts.excludeIds;
  const isSubject = (id: string) => !subjects || subjects.has(id);
  const idx = itemIndexFor(items);
  const shapes: Shape[] = [];
  const shapeItems: PlacedItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.hidden || excluded?.has(it.id)) continue;
    const z = includeZones ? idx.zones[i] : null;
    const poly = z ?? idx.footprints[i];
    shapes.push({ id: it.id, poly, box: z ? idx.zoneBoxes[i]! : idx.boxes[i] });
    shapeItems.push(it);
  }
  const best = new Map<string, Bottleneck>();
  // Broadphase über eigenen Hash der Formen (um minWidth erweitert); Wände für Objekt–Wand und als Spalt-Blocker.
  const sh = new SpatialHash<number>();
  for (let s = 0; s < shapes.length; s++) sh.insert(s, shapes[s].box);
  const widx = walls.length ? wallIndexFor(walls) : null;
  const shapeIndex = new Map<string, number>();
  for (let s = 0; s < shapes.length; s++) shapeIndex.set(shapes[s].id, s);

  /** Anteil des Bands quer zum Spalt, den andere Objekte oder Wände belegen. */
  const blockedRatio = (g: AxisGap, axis: 'x' | 'y', A: Shape, B: Shape): number => {
    const band = g.hi - g.lo;
    if (band <= EPS || g.gapHi - g.gapLo <= EPS) return 0;
    const across = axis === 'x' ? 'y' : 'x';
    const box = gapBox(g, axis);
    const covered: { min: number; max: number }[] = [];
    const take = (poly: Vec2[]) => {
      const e = polygonExtentInBand(poly, across, g.gapLo, g.gapHi);
      if (!e) return;
      const min = Math.max(e.min, g.lo);
      const max = Math.min(e.max, g.hi);
      if (max - min > EPS) covered.push({ min, max });
    };
    sh.forEachIn(box, (t) => {
      const S = shapes[t];
      if (S.id === A.id || S.id === B.id || !bboxOverlap(S.box, box)) return;
      take(S.poly);
    });
    widx?.hash.forEachIn(box, (wi) => {
      if (widx.walls[wi].id === A.id || widx.walls[wi].id === B.id || !bboxOverlap(widx.boxes[wi], box)) return;
      take(widx.rects[wi]);
    });
    return unionLength(covered) / band;
  };

  /**
   * `itemA`/`itemB`: Objekte zu den Formen (B ohne Objekt = Wand/Hallenkante). Rückseite zur Wand bzw. beide
   * Rückseiten zueinander → kein Laufweg; ebenso ein überwiegend belegter Spalt.
   */
  const record = (A: Shape, B: Shape, itemA?: PlacedItem, itemB?: PlacedItem) => {
    for (const axis of ['x', 'y'] as const) {
      const g = axisGap(A, B, axis);
      if (!g) continue;
      if (g.width <= touch || g.width >= minWidth) continue;
      if (itemA) {
        const sign = g.aIsLeft ? 1 : -1;
        const dirA = axis === 'x' ? { x: sign, y: 0 } : { x: 0, y: sign };
        const aBack = backFaces(itemA, dirA);
        if (itemB) {
          if (aBack && backFaces(itemB, { x: -dirA.x, y: -dirA.y })) continue;
        } else if (aBack) continue;
      }
      if (blockedRatio(g, axis, A, B) > MAX_BLOCKED_BAND_RATIO) continue;
      const key = A.id < B.id ? `${A.id}|${B.id}` : `${B.id}|${A.id}`;
      const prev = best.get(key);
      if (prev && prev.width <= g.width) continue;
      best.set(key, { a: A.id, b: B.id, width: g.width, point: { x: (g.from.x + g.to.x) / 2, y: (g.from.y + g.to.y) / 2 }, from: g.from, to: g.to, axis });
    }
  };

  // Objekt–Objekt
  for (let s = 0; s < shapes.length; s++) {
    const sIsSubject = isSubject(shapes[s].id);
    sh.forEachIn(expandBox(shapes[s].box, minWidth), (t) => {
      if (t > s && (sIsSubject || isSubject(shapes[t].id))) record(shapes[s], shapes[t], shapeItems[s], shapeItems[t]);
    });
  }
  // Objekt–Wand
  if (widx) {
    for (let s = 0; s < shapes.length; s++) {
      if (!isSubject(shapes[s].id)) continue;
      widx.hash.forEachIn(expandBox(shapes[s].box, minWidth), (wi) => {
        record(shapes[s], { id: widx.walls[wi].id, poly: widx.rects[wi], box: widx.boxes[wi] }, shapeItems[s]);
      });
    }
  }
  // Objekt–Hallenkante
  if (hallInner && hallInner.length >= 3) {
    const edges: Shape[] = [];
    for (let i = 0; i < hallInner.length; i++) {
      const seg = [hallInner[i], hallInner[(i + 1) % hallInner.length]];
      edges.push({ id: `hall_${i}`, poly: seg, box: bbox(seg) });
    }
    for (let s = 0; s < shapes.length; s++) {
      if (!isSubject(shapes[s].id)) continue;
      const qb = expandBox(shapes[s].box, minWidth);
      for (const e of edges) if (bboxOverlap(e.box, qb)) record(shapes[s], e, shapeItems[s]);
    }
  }
  for (const b of best.values()) out.push(b);
  out.sort((p, q) => p.width - q.width);
  return out;
}

