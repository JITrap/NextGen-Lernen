/**
 * Planungs-Warnungen (Abschnitt 6 der Spezifikation). Jede Warnung hat eine stabile ID
 * (Art + beteiligte IDs), Schweregrad, deutschen Text und ein Ziel zum Hinspringen.
 *
 * Tür-Schwenkflächen: wird `doorSwingPolygon(door, wall)` aus geometry/collision exportiert und liefert
 * ein (konvexes) Polygon, wird es verwendet; sonst eigener Viertelkreis-Sektor aus openingPlacement.
 * Laufwege: eigene Heuristik – Objektpaare (und Objekt/Wand) mit achsenparallelem Abstand zwischen
 * der Standard-Sicherheitszone (Aufstellabstand) und settings.minEscapeRouteCm bei überlappender Projektion.
 */
import type { Project, PlanningWarning, WarningKind, Vec2, Door, Wall, PlacedItem, Room, Selection, Id, Floor } from '@/types';
import * as col from '@/geometry/collision';
import { findCollisions } from '@/geometry/collision';
import { allWalls, findWall, openingPlacement, wallRect, wallMidpoint } from '@/geometry/walls';
import { itemFootprint } from '@/geometry/transform';
import { bbox, centroid, distance, distanceToSegment, offsetPolygon, pointInPolygon, type BBox } from '@/geometry/polygon';
import { formatCm, formatKgM2 } from '@/geometry/units';
import { DOOR_TYPE_MAP } from '@/data/wallTypes';
import { analysisContext, memoByProject, itemName, itemHeight, hasFootprint, symbolOf, visibleItems, type FloorContext, type AnalysisContext } from './common';
import { floorLoad } from './floorLoad';
import { capacity } from './capacity';
import { isConvex } from './clip';

export const SEVERITY_RANK: Record<PlanningWarning['severity'], number> = { error: 0, warning: 1, info: 2 };
export const WARNING_KINDS: WarningKind[] = [
  'collision', 'door-swing', 'emergency-exit', 'escape-route', 'ceiling-height', 'floor-load',
  'changing-room', 'wellness', 'outside-hall', 'unverified', 'rack-module', 'capacity',
];
export const WARNING_KIND_LABELS: Record<WarningKind, string> = {
  'collision': 'Kollision',
  'door-swing': 'Tür-Schwenkfläche',
  'emergency-exit': 'Notausgang',
  'escape-route': 'Laufweg/Fluchtweg',
  'ceiling-height': 'Deckenhöhe',
  'floor-load': 'Bodenlast',
  'changing-room': 'Umkleide',
  'wellness': 'Wellness',
  'outside-hall': 'Außerhalb der Halle',
  'unverified': 'Maße ungeprüft',
  'rack-module': 'Rack-Modul',
  'capacity': 'Kapazität',
};
export const SEVERITY_LABELS: Record<PlanningWarning['severity'], string> = { error: 'Fehler', warning: 'Warnung', info: 'Hinweis' };

/** Max. Entfernung (cm) für „in der Nähe“ (Umkleide ↔ Dusche/WC, Sauna ↔ Ruhebereich/Dusche). */
export const NEARBY_CM = 1500;
/** Mindestlänge (cm) der überlappenden Projektion, damit eine Lücke als Laufweg gilt. */
const MIN_CORRIDOR_OVERLAP_CM = 60;
/** Tiefe (cm) der Freihaltefläche vor einem Notausgang (mind. Fluchtwegbreite). */
const EMERGENCY_CLEAR_MIN_CM = 150;
/** Toleranz (cm) beim Hallen-Rand. */
const HALL_TOLERANCE_CM = 2;

const q = (s: string) => `„${s}“`;
const neg = (v: Vec2): Vec2 => ({ x: -v.x, y: -v.y });

/* ------------------------------------------------------------------ */
/* Tür-Schwenkflächen                                                  */
/* ------------------------------------------------------------------ */

function isPolygon(v: unknown): v is Vec2[] {
  return Array.isArray(v) && v.length >= 3 && v.every((p) => p && typeof p === 'object' && typeof (p as Vec2).x === 'number' && typeof (p as Vec2).y === 'number');
}

/** Nutzt eine externe doorSwingPolygon-Implementierung, falls vorhanden und brauchbar. */
function externalDoorSwing(door: Door, wall: Wall): Vec2[][] | null {
  const fn = (col as unknown as Record<string, unknown>).doorSwingPolygon;
  if (typeof fn !== 'function') return null;
  try {
    const r = (fn as (d: Door, w: Wall) => unknown)(door, wall);
    if (isPolygon(r)) return isConvex(r) ? [r] : null;
    if (Array.isArray(r) && r.length && r.every(isPolygon)) return (r as Vec2[][]).every(isConvex) ? (r as Vec2[][]) : null;
  } catch {
    /* eigene Implementierung verwenden */
  }
  return null;
}

/** Viertelkreis-Sektor: Zentrum c, von Richtung u (geschlossen) nach v (offen), Radius r. */
function sectorPolygon(c: Vec2, u: Vec2, v: Vec2, r: number, steps = 8): Vec2[] {
  const pts: Vec2[] = [c];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    const cs = Math.cos(t);
    const sn = Math.sin(t);
    pts.push({ x: c.x + (u.x * cs + v.x * sn) * r, y: c.y + (u.y * cs + v.y * sn) * r });
  }
  return pts;
}

/** Schwenkflächen einer Tür (ein oder zwei Flügel) in Weltkoordinaten. */
export function doorSwingPolygons(door: Door, wall: Wall): Vec2[][] {
  const info = DOOR_TYPE_MAP[door.doorType];
  if (info && !info.swings) return [];
  const ext = externalDoorSwing(door, wall);
  if (ext) return ext;
  const pl = openingPlacement(door, wall);
  const side = door.swingSide === 'a' ? pl.normal : neg(pl.normal);
  if (info?.leaves === 2) {
    const r = door.width / 2;
    return [sectorPolygon(pl.a, pl.dir, side, r), sectorPolygon(pl.b, neg(pl.dir), side, r)];
  }
  return door.hinge === 'left' ? [sectorPolygon(pl.a, pl.dir, side, door.width)] : [sectorPolygon(pl.b, neg(pl.dir), side, door.width)];
}

/** Freihalteflächen vor einem Notausgang (beide Wandseiten). */
export function emergencyExitPolygons(door: Door, wall: Wall, depthCm: number): Vec2[][] {
  const pl = openingPlacement(door, wall);
  const out: Vec2[][] = [];
  for (const n of [pl.normal, neg(pl.normal)]) {
    const off = { x: n.x * depthCm, y: n.y * depthCm };
    out.push([pl.a, pl.b, { x: pl.b.x + off.x, y: pl.b.y + off.y }, { x: pl.a.x + off.x, y: pl.a.y + off.y }]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helfer                                                              */
/* ------------------------------------------------------------------ */

function distanceToPolygon(p: Vec2, poly: Vec2[]): number {
  if (poly.length < 3) return Infinity;
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const d = distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]);
    if (d < best) best = d;
  }
  return best;
}

function roomTarget(room: Room): PlanningWarning['target'] {
  return { kind: room.source === 'zone' ? 'zone' : 'room', id: room.id };
}

interface ItemGeo {
  item: PlacedItem;
  name: string;
  fp: Vec2[];
  box: BBox;
}

function itemGeos(items: PlacedItem[], ctx: AnalysisContext): ItemGeo[] {
  const out: ItemGeo[] = [];
  for (const it of items) {
    if (it.hidden) continue;
    const def = ctx.def(it.defId);
    if (!hasFootprint(def)) continue;
    const fp = itemFootprint(it);
    out.push({ item: it, name: itemName(it, def), fp, box: bbox(fp) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Einzelprüfungen                                                     */
/* ------------------------------------------------------------------ */

function collisionWarnings(fc: FloorContext, items: PlacedItem[], walls: Wall[], ctx: AnalysisContext, out: PlanningWarning[]) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const nameOf = (id: Id) => { const it = byId.get(id); return it ? itemName(it, ctx.def(it.defId)) : id; };
  for (const c of findCollisions(items, { walls, includeZones: true })) {
    const floorId = fc.floor.id;
    const id = `collision:${floorId}:${c.a}:${c.b}`;
    const target = { kind: 'item' as const, id: c.a };
    if (c.kind === 'item-item') out.push({ id, kind: 'collision', severity: 'error', message: `${q(nameOf(c.a))} überlappt ${q(nameOf(c.b))}.`, floorId, target });
    else if (c.kind === 'item-zone') out.push({ id, kind: 'collision', severity: 'warning', message: `Sicherheitszone von ${q(nameOf(c.a))} überlappt ${q(nameOf(c.b))}.`, floorId, target });
    else if (c.kind === 'item-wall') out.push({ id, kind: 'collision', severity: 'error', message: `${q(nameOf(c.a))} steht in einer Wand.`, floorId, target });
    else out.push({ id, kind: 'collision', severity: 'warning', message: `Sicherheitszonen von ${q(nameOf(c.a))} und ${q(nameOf(c.b))} überlappen sich.`, floorId, target });
  }
}

function doorWarnings(fc: FloorContext, geos: ItemGeo[], minEscape: number, out: PlanningWarning[]) {
  const floor = fc.floor;
  const clearDepth = Math.max(EMERGENCY_CLEAR_MIN_CM, minEscape);
  for (const o of floor.openings) {
    if (o.kind !== 'door' || o.hidden) continue;
    const wall = findWall(floor, o.wallId);
    if (!wall) continue;
    const isEmergency = o.doorType === 'Notausgang' || !!DOOR_TYPE_MAP[o.doorType]?.emergency;
    const swings = doorSwingPolygons(o, wall).map((p) => ({ p, box: bbox(p) }));
    const clears = isEmergency ? emergencyExitPolygons(o, wall, clearDepth).map((p) => ({ p, box: bbox(p) })) : [];
    if (!swings.length && !clears.length) continue;
    for (const g of geos) {
      if (g.item.wallId === wall.id) continue;
      if (clears.some((c) => c.box && col.convexPolygonsOverlap(g.fp, c.p))) {
        out.push({ id: `emergency-exit:${o.id}:${g.item.id}`, kind: 'emergency-exit', severity: 'error', message: `${q(g.name)} steht vor dem Notausgang (${formatCm(clearDepth)} freihalten).`, floorId: floor.id, target: { kind: 'item', id: g.item.id } });
        continue;
      }
      if (swings.some((s) => col.convexPolygonsOverlap(g.fp, s.p))) {
        out.push({ id: `door-swing:${o.id}:${g.item.id}`, kind: 'door-swing', severity: 'warning', message: `${q(g.name)} steht in der Schwenkfläche einer Tür (${o.doorType}, ${formatCm(o.width)}).`, floorId: floor.id, target: { kind: 'item', id: g.item.id } });
      }
    }
  }
}

/** Lücke zwischen zwei achsenparallelen Boxen als Laufweg bewerten. */
function corridorGap(A: BBox, B: BBox, lower: number, min: number): { gap: number; point: Vec2 } | null {
  const gapX = Math.max(B.minX - A.maxX, A.minX - B.maxX);
  const gapY = Math.max(B.minY - A.maxY, A.minY - B.maxY);
  const overlapY = Math.min(A.maxY, B.maxY) - Math.max(A.minY, B.minY);
  const overlapX = Math.min(A.maxX, B.maxX) - Math.max(A.minX, B.minX);
  if (gapX > lower && gapX < min && overlapY >= MIN_CORRIDOR_OVERLAP_CM) {
    const x = A.maxX <= B.minX ? (A.maxX + B.minX) / 2 : (B.maxX + A.minX) / 2;
    const y = (Math.max(A.minY, B.minY) + Math.min(A.maxY, B.maxY)) / 2;
    return { gap: gapX, point: { x, y } };
  }
  if (gapY > lower && gapY < min && overlapX >= MIN_CORRIDOR_OVERLAP_CM) {
    const y = A.maxY <= B.minY ? (A.maxY + B.minY) / 2 : (B.maxY + A.minY) / 2;
    const x = (Math.max(A.minX, B.minX) + Math.min(A.maxX, B.maxX)) / 2;
    return { gap: gapY, point: { x, y } };
  }
  return null;
}

function escapeRouteWarnings(fc: FloorContext, geos: ItemGeo[], walls: Wall[], project: Project, out: PlanningWarning[]) {
  const min = project.settings.minEscapeRouteCm;
  if (!Number.isFinite(min) || min <= 0) return;
  const lower = Math.max(0, Math.min(project.settings.defaultSafetyZoneCm, min - 1));
  const floorId = fc.floor.id;
  const sorted = [...geos].sort((a, b) => a.box.minX - b.box.minX);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b.box.minX - a.box.maxX >= min) break; // weiter rechts kann keine zu schmale Lücke mehr folgen
      if (a.item.dockedTo === b.item.id || b.item.dockedTo === a.item.id) continue;
      const g = corridorGap(a.box, b.box, lower, min);
      if (!g) continue;
      out.push({
        id: `escape-route:${floorId}:${a.item.id}:${b.item.id}`,
        kind: 'escape-route',
        severity: 'warning',
        message: `Laufweg zwischen ${q(a.name)} und ${q(b.name)} nur ${formatCm(Math.round(g.gap))} (min. ${formatCm(min)}).`,
        floorId,
        target: { point: g.point },
      });
    }
  }
  // Objekt ↔ achsenparallele Wand
  const wallBoxes = walls
    .filter((w) => !w.hidden && (Math.abs(w.end.x - w.start.x) < 1 || Math.abs(w.end.y - w.start.y) < 1))
    .map((w) => ({ w, box: bbox(wallRect(w)) }));
  for (const g of geos) {
    for (const wb of wallBoxes) {
      if (g.item.wallId === wb.w.id) continue;
      const r = corridorGap(g.box, wb.box, lower, min);
      if (!r) continue;
      out.push({
        id: `escape-route:${floorId}:${g.item.id}:${wb.w.id}`,
        kind: 'escape-route',
        severity: 'warning',
        message: `Laufweg zwischen ${q(g.name)} und Wand nur ${formatCm(Math.round(r.gap))} (min. ${formatCm(min)}).`,
        floorId,
        target: { point: r.point },
      });
    }
  }
}

function ceilingWarnings(fc: FloorContext, ctx: AnalysisContext, out: PlanningWarning[]) {
  const floor = fc.floor;
  const ceiling = floor.ceilingHeight;
  if (!Number.isFinite(ceiling) || ceiling <= 0) return;
  for (const it of fc.items) {
    if (it.hidden) continue;
    const def = ctx.def(it.defId);
    const h = itemHeight(it, def);
    if (h != null && h > ceiling) {
      out.push({
        id: `ceiling-height:${it.id}`,
        kind: 'ceiling-height',
        severity: 'error',
        message: `${q(itemName(it, def))} ist ${formatCm(h)} hoch – Deckenhöhe ${floor.name}: ${formatCm(ceiling)}.`,
        floorId: floor.id,
        target: { kind: 'item', id: it.id },
      });
    }
  }
  for (const w of floor.walls) {
    if (w.hidden || w.height == null) continue;
    if (w.height > ceiling) {
      out.push({
        id: `ceiling-height:${w.id}`,
        kind: 'ceiling-height',
        severity: 'warning',
        message: `Wand (${w.type}) ist ${formatCm(w.height)} hoch – Deckenhöhe ${floor.name}: ${formatCm(ceiling)}.`,
        floorId: floor.id,
        target: { kind: 'wall', id: w.id },
      });
    }
  }
}

function floorLoadWarnings(project: Project, ctx: AnalysisContext, out: PlanningWarning[]) {
  const load = floorLoad(project);
  const limit = project.settings.floorLoadLimitKgM2;
  load.floors.forEach((fl, i) => {
    const fc = ctx.floors[i];
    if (fl.exceeded && fl.kgM2 != null) {
      const point = fc.inner ? centroid(fc.inner) : fc.items[0] ? { x: fc.items[0].x, y: fc.items[0].y } : { x: 0, y: 0 };
      out.push({
        id: `floor-load:${fl.floorId}`,
        kind: 'floor-load',
        severity: 'error',
        message: `Bodenlast ${fl.floorName}: ${formatKgM2(fl.kgM2)} überschreitet den Grenzwert von ${formatKgM2(limit)}.`,
        floorId: fl.floorId,
        target: { point },
      });
    }
    fl.rooms.forEach((rl, r) => {
      if (!rl.exceeded || rl.kgM2 == null) return;
      out.push({
        id: `floor-load:${fl.floorId}:${rl.roomId}`,
        kind: 'floor-load',
        severity: 'warning',
        message: `Bodenlast in ${q(rl.roomName)} (${fl.floorName}): ${formatKgM2(rl.kgM2)} überschreitet den Grenzwert von ${formatKgM2(limit)}.`,
        floorId: fl.floorId,
        target: roomTarget(fc.rooms[r]),
      });
    });
  });
}

interface Facility { point?: Vec2; poly?: Vec2[] }
function nearAny(p: Vec2, list: Facility[], maxCm: number): boolean {
  for (const f of list) {
    if (f.poly && distanceToPolygon(p, f.poly) <= maxCm) return true;
    if (f.point && distance(p, f.point) <= maxCm) return true;
  }
  return false;
}

function facilityWarnings(fc: FloorContext, ctx: AnalysisContext, out: PlanningWarning[]) {
  const showers: Facility[] = [];
  const wcs: Facility[] = [];
  const rest: Facility[] = [];
  for (const r of fc.rooms) {
    if (r.type === 'Duschen') showers.push({ poly: r.polygon });
    else if (r.type === 'WC') wcs.push({ poly: r.polygon });
    else if (r.type === 'Ruheraum') rest.push({ poly: r.polygon });
  }
  const saunas: { item: PlacedItem; name: string }[] = [];
  for (const it of fc.items) {
    if (it.hidden) continue;
    const def = ctx.def(it.defId);
    const p = { x: it.x, y: it.y };
    switch (symbolOf(def)) {
      case 'shower':
      case 'shower-row':
        showers.push({ point: p });
        break;
      case 'shower-experience':
        showers.push({ point: p });
        break;
      case 'toilet':
      case 'urinal':
        wcs.push({ point: p });
        break;
      case 'lounger':
      case 'waterbed':
        rest.push({ point: p });
        break;
      case 'sauna':
      case 'steam':
      case 'infrared':
        saunas.push({ item: it, name: itemName(it, def) });
        break;
      default:
        break;
    }
  }
  const showerOnly = showers.filter((s) => s.poly || s.point);
  for (const r of fc.rooms) {
    if (!r.type.startsWith('Umkleide')) continue;
    const c = r.centroid;
    if (!nearAny(c, showerOnly, NEARBY_CM)) {
      out.push({ id: `changing-room:${r.id}:shower`, kind: 'changing-room', severity: 'warning', message: `Umkleide ${q(r.name)}: keine Dusche in der Nähe (≤ 15 m).`, floorId: fc.floor.id, target: roomTarget(r) });
    }
    if (!nearAny(c, wcs, NEARBY_CM)) {
      out.push({ id: `changing-room:${r.id}:wc`, kind: 'changing-room', severity: 'warning', message: `Umkleide ${q(r.name)}: kein WC in der Nähe (≤ 15 m).`, floorId: fc.floor.id, target: roomTarget(r) });
    }
  }
  for (const s of saunas) {
    const c = { x: s.item.x, y: s.item.y };
    const missing: string[] = [];
    if (!nearAny(c, rest, NEARBY_CM)) missing.push('kein Ruhebereich');
    if (!nearAny(c, showerOnly, NEARBY_CM)) missing.push('keine Dusche');
    if (missing.length) {
      out.push({ id: `wellness:${s.item.id}`, kind: 'wellness', severity: 'warning', message: `${q(s.name)}: ${missing.join(' und ')} in der Nähe (≤ 15 m).`, floorId: fc.floor.id, target: { kind: 'item', id: s.item.id } });
    }
  }
}

function outsideHallWarnings(fc: FloorContext, geos: ItemGeo[], ctx: AnalysisContext, out: PlanningWarning[]) {
  if (!fc.inner || !fc.outer) return;
  const innerTol = offsetPolygon(fc.inner, -HALL_TOLERANCE_CM);
  const outerTol = offsetPolygon(fc.outer, -HALL_TOLERANCE_CM);
  const innerBox = bbox(innerTol);
  for (const g of geos) {
    const def = ctx.def(g.item.defId);
    const poly = def?.wandmontage || g.item.wallId ? outerTol : innerTol;
    // schneller Vorfilter über die Bounding-Box
    if (g.box.minX >= innerBox.minX && g.box.maxX <= innerBox.maxX && g.box.minY >= innerBox.minY && g.box.maxY <= innerBox.maxY && isConvex(innerTol)) continue;
    const outsideCorners = g.fp.filter((c) => !pointInPolygon(c, poly)).length;
    if (!outsideCorners) continue;
    const centerOutside = !pointInPolygon({ x: g.item.x, y: g.item.y }, poly);
    out.push({
      id: `outside-hall:${g.item.id}`,
      kind: 'outside-hall',
      severity: centerOutside ? 'error' : 'warning',
      message: centerOutside ? `${q(g.name)} steht außerhalb der Halle.` : `${q(g.name)} ragt über die Hallenwand hinaus.`,
      floorId: fc.floor.id,
      target: { kind: 'item', id: g.item.id },
    });
  }
}

function libraryWarnings(ctx: AnalysisContext, out: PlanningWarning[]) {
  const unverified = new Map<string, { name: string; count: number; floorId: Id; itemId: Id }>();
  const unknown = new Map<string, { count: number; floorId: Id; itemId: Id }>();
  for (const fc of ctx.floors) {
    for (const it of fc.items) {
      if (it.hidden) continue;
      const def = ctx.def(it.defId);
      if (!def) {
        const u = unknown.get(it.defId) ?? { count: 0, floorId: fc.floor.id, itemId: it.id };
        u.count += 1;
        unknown.set(it.defId, u);
        continue;
      }
      if (def.verifiziert === false) {
        const u = unverified.get(def.id) ?? { name: def.name, count: 0, floorId: fc.floor.id, itemId: it.id };
        u.count += 1;
        unverified.set(def.id, u);
      }
      if (def.nur_an_rack) {
        const docked = it.dockedTo && fc.items.some((o) => o.id === it.dockedTo);
        if (!docked) {
          out.push({
            id: `rack-module:${it.id}`,
            kind: 'rack-module',
            severity: 'warning',
            message: `Rack-Modul ${q(itemName(it, def))} ist an kein Rack angedockt.`,
            floorId: fc.floor.id,
            target: { kind: 'item', id: it.id },
          });
        }
      }
    }
  }
  for (const [defId, u] of unverified) {
    out.push({
      id: `unverified:${defId}`,
      kind: 'unverified',
      severity: 'info',
      message: `Maße ungeprüft: ${q(u.name)} (${u.count}×) – vor dem Kauf beim Hersteller bestätigen.`,
      floorId: u.floorId,
      target: { kind: 'item', id: u.itemId },
    });
  }
  for (const [defId, u] of unknown) {
    out.push({
      id: `unverified:unknown:${defId}`,
      kind: 'unverified',
      severity: 'warning',
      message: `Bibliothekseintrag ${q(defId)} nicht gefunden (${u.count}×) – Maße und Gewicht unbekannt.`,
      floorId: u.floorId,
      target: { kind: 'item', id: u.itemId },
    });
  }
}

function capacityWarnings(project: Project, out: PlanningWarning[]) {
  const cap = capacity(project);
  for (const c of cap.counters) {
    if (c.status !== 'danger' || !c.hint) continue;
    out.push({ id: `capacity:${c.key}`, kind: 'capacity', severity: 'warning', message: c.hint, floorId: project.activeFloorId });
  }
}

/* ------------------------------------------------------------------ */
/* Öffentliche API                                                     */
/* ------------------------------------------------------------------ */

/** Sortiert nach Schweregrad, Art und Text. */
export function sortWarnings(list: PlanningWarning[]): PlanningWarning[] {
  return [...list].sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    || WARNING_KINDS.indexOf(a.kind) - WARNING_KINDS.indexOf(b.kind)
    || a.message.localeCompare(b.message, 'de'));
}

/** Alle Planungs-Warnungen des Projekts (memoisiert am Projekt-Objekt). */
export const warnings: (project: Project) => PlanningWarning[] = memoByProject((project) => {
  const ctx = analysisContext(project);
  const out: PlanningWarning[] = [];
  for (const fc of ctx.floors) {
    const items = visibleItems(fc.floor, project.floors);
    const walls = allWalls(fc.floor);
    const geos = itemGeos(items, ctx);
    collisionWarnings(fc, items, walls, ctx, out);
    doorWarnings(fc, geos, project.settings.minEscapeRouteCm, out);
    escapeRouteWarnings(fc, geos, walls, project, out);
    ceilingWarnings(fc, ctx, out);
    facilityWarnings(fc, ctx, out);
    outsideHallWarnings(fc, geos.filter((g) => !g.item.params?.__linkedFrom), ctx, out);
  }
  floorLoadWarnings(project, ctx, out);
  libraryWarnings(ctx, out);
  capacityWarnings(project, out);
  return sortWarnings(out);
});

export interface WarningCounts { error: number; warning: number; info: number; total: number }
export function countWarnings(list: PlanningWarning[]): WarningCounts {
  const c: WarningCounts = { error: 0, warning: 0, info: 0, total: list.length };
  for (const w of list) c[w.severity] += 1;
  return c;
}

/** Löst das Ziel einer Warnung in einen Weltpunkt (+ optionale Auswahl) auf. */
export function warningFocus(project: Project, w: PlanningWarning): { point: Vec2; selection?: Selection } | null {
  const ctx = analysisContext(project);
  const fc = ctx.floors.find((f) => f.floor.id === w.floorId);
  const t = w.target;
  if (t && 'point' in t) return { point: t.point };
  if (t && 'kind' in t) {
    const sel: Selection = { kind: t.kind, id: t.id };
    if (t.kind === 'item') {
      const it = findItem(project.floors, t.id);
      if (it) return { point: { x: it.x, y: it.y }, selection: sel };
    } else if ((t.kind === 'zone' || t.kind === 'room') && fc) {
      const r = fc.rooms.find((x) => x.id === t.id);
      if (r) return { point: r.centroid, selection: sel };
    } else if (t.kind === 'wall' && fc) {
      const wall = findWall(fc.floor, t.id);
      if (wall) return { point: wallMidpoint(wall), selection: sel };
    } else if (t.kind === 'opening' && fc) {
      const o = fc.floor.openings.find((x) => x.id === t.id);
      const wall = o ? findWall(fc.floor, o.wallId) : undefined;
      if (o && wall) return { point: openingPlacement(o, wall).center, selection: sel };
    }
  }
  if (fc?.inner) return { point: centroid(fc.inner) };
  if (fc?.items[0]) return { point: { x: fc.items[0].x, y: fc.items[0].y } };
  return null;
}

function findItem(floors: Floor[], id: Id): PlacedItem | undefined {
  for (const f of floors) {
    const it = f.items.find((x) => x.id === id);
    if (it) return it;
  }
  return undefined;
}
