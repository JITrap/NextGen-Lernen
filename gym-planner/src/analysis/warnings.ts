/**
 * Planungs-Warnungen (Abschnitt 6 der Spezifikation). Jede Warnung hat eine stabile ID
 * (Art + beteiligte IDs), Schweregrad, deutschen Text und ein Ziel zum Hinspringen.
 *
 * Geometrie kommt aus src/geometry/collision.ts: findCollisions (Objekte, Sicherheitszonen, Wände),
 * itemsInDoorSwing / emergencyExitClearanceRects (Türen), escapeRouteBottlenecks (Laufwege, inkl. aktiver
 * Sicherheitszonen als Objektausdehnung), itemInsideHall (Halle). Lücken unter MIN_CORRIDOR_CM gelten als
 * Aufstellabstand und nicht als (zu schmaler) Laufweg.
 *
 * Laufweg-Heuristik: Es zählen nur Paare, an denen mindestens ein Trainingsgerät (TRAINING_AREAS) beteiligt ist;
 * Objekte in Nebenräumen (ESCAPE_ROUTE_EXCLUDED_ROOM_TYPES: Umkleiden, Duschen, WC, Büro, Lager …) bleiben außen vor.
 * Die Engpässe werden je Raum (kleinster Raum am Engpass, Zonen vor Auto-Räumen) zu einer Warnung gebündelt.
 */
import type { Project, PlanningWarning, WarningKind, Vec2, Wall, PlacedItem, Room, Selection, Id, Floor, Door, LibraryArea, RoomType } from '@/types';
import {
  findCollisions, convexPolygonsOverlap, itemsInDoorSwing, emergencyExitClearanceRects, escapeRouteBottlenecks, itemInsideHall, type Bottleneck,
} from '@/geometry/collision';
import { allWalls, findWall, openingPlacement, wallMidpoint, isHallWallId } from '@/geometry/walls';
import { itemFootprint } from '@/geometry/transform';
import { centroid, distance, distanceToSegment, pointInPolygon } from '@/geometry/polygon';
import { formatCm, formatKgM2 } from '@/geometry/units';
import { DOOR_TYPE_MAP } from '@/data/wallTypes';
import { analysisContext, memoByProject, itemName, itemHeight, hasFootprint, symbolOf, visibleItems, isLinkedCopy, isTypedRoom, pointInRoom, type FloorContext, type AnalysisContext } from './common';
import { floorLoad } from './floorLoad';
import { capacity } from './capacity';

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
/** Lücken ab dieser Breite (cm) gelten als Laufweg; schmalere sind Aufstellabstand zwischen Geräten. */
export const MIN_CORRIDOR_CM = 40;
/** Tiefe (cm) der Freihaltefläche vor einem Notausgang (mind. Fluchtwegbreite). */
export const EMERGENCY_CLEAR_MIN_CM = 150;
/** Toleranz (cm) am Hallen-Rand. */
const HALL_TOLERANCE_CM = 2;
/** Bibliotheksbereiche, die in der Laufweg-Heuristik als Trainingsgeräte gelten (eigene Geräte eingeschlossen). */
export const TRAINING_AREAS: ReadonlySet<LibraryArea> = new Set<LibraryArea>(['Kraftgeräte', 'Cardio', 'Functional', 'Freihantel-Zubehör', 'Eigene']);
/** Raumtypen, deren Objekte (Möbel, Sanitär, Spinde …) nicht in die Laufweg-Heuristik eingehen. */
export const ESCAPE_ROUTE_EXCLUDED_ROOM_TYPES: ReadonlySet<RoomType> = new Set<RoomType>([
  'Umkleide Damen', 'Umkleide Herren', 'Umkleide Divers', 'Duschen', 'WC', 'Büro', 'Lager', 'Technik/Lüftung', 'Putzraum', 'Personalraum',
]);
/** Höchstens so viele Namen in der gebündelten „Maße ungeprüft“-Warnung. */
const UNVERIFIED_LIST_MAX = 8;

const q = (s: string) => `„${s}“`;

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

/** Indizes der Räume, in denen der Punkt liegt (Bounding-Box-Vorprüfung, Löcher ausgenommen). */
function roomIndicesAt(p: Vec2, fc: FloorContext): number[] {
  const out: number[] = [];
  for (let r = 0; r < fc.rooms.length; r++) {
    const b = fc.roomBoxes[r];
    if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) continue;
    if (pointInRoom(p, fc.rooms[r])) out.push(r);
  }
  return out;
}

/** Kleinster Raum mit gesetztem Typ am Punkt (Zonen vor Auto-Räumen – wie in der Flächenbilanz); null ohne Raum. */
function typedRoomAt(p: Vec2, fc: FloorContext): Room | null {
  let best: Room | null = null;
  for (const r of roomIndicesAt(p, fc)) {
    const room = fc.rooms[r];
    if (!isTypedRoom(room, fc.floor)) continue;
    if (!best || (room.source === best.source ? room.areaM2 < best.areaM2 : room.source === 'zone')) best = room;
  }
  return best;
}

/** Sichtbare Objekte mit Stellfläche eines Stockwerks, nach ID. */
interface FloorItems {
  all: PlacedItem[];
  byId: Map<Id, PlacedItem>;
  name: (id: Id) => string;
  /** Objekte mit Stellfläche, nicht ausgeblendet. */
  solid: PlacedItem[];
}
function floorItems(fc: FloorContext, project: Project, ctx: AnalysisContext): FloorItems {
  const all = visibleItems(fc.floor, project.floors);
  const byId = new Map(all.map((it) => [it.id, it]));
  const name = (id: Id) => {
    const it = byId.get(id);
    return it ? itemName(it, ctx.def(it.defId)) : id;
  };
  const solid = all.filter((it) => !it.hidden && hasFootprint(ctx.def(it.defId)));
  return { all, byId, name, solid };
}

/* ------------------------------------------------------------------ */
/* Einzelprüfungen                                                     */
/* ------------------------------------------------------------------ */

function collisionWarnings(fc: FloorContext, fi: FloorItems, walls: Wall[], ctx: AnalysisContext, out: PlanningWarning[]) {
  const wallMountedIds = new Set<string>();
  for (const it of fi.all) if (ctx.def(it.defId)?.wandmontage) wallMountedIds.add(it.id);
  const floorId = fc.floor.id;
  for (const c of findCollisions(fi.all, { walls, includeZones: true, wallMountedIds })) {
    // Symmetrische Arten (Objekt–Objekt, Zone–Zone): ID unabhängig von der Reihenfolge der Beteiligten.
    const symmetric = c.kind === 'item-item' || c.kind === 'zone-zone';
    const id = symmetric && c.b < c.a ? `collision:${floorId}:${c.b}:${c.a}` : `collision:${floorId}:${c.a}:${c.b}`;
    const target = { kind: 'item' as const, id: c.a };
    switch (c.kind) {
      case 'item-item':
        out.push({ id, kind: 'collision', severity: 'error', message: `${q(fi.name(c.a))} überlappt ${q(fi.name(c.b))}.`, floorId, target });
        break;
      case 'item-zone':
        out.push({ id, kind: 'collision', severity: 'warning', message: `Sicherheitszone von ${q(fi.name(c.a))} überlappt ${q(fi.name(c.b))}.`, floorId, target });
        break;
      case 'zone-zone':
        out.push({ id, kind: 'collision', severity: 'warning', message: `Sicherheitszonen von ${q(fi.name(c.a))} und ${q(fi.name(c.b))} überlappen sich.`, floorId, target });
        break;
      case 'item-wall':
        out.push({ id, kind: 'collision', severity: 'error', message: `${q(fi.name(c.a))} steht in einer Wand.`, floorId, target });
        break;
      case 'zone-wall':
        out.push({ id, kind: 'collision', severity: 'info', message: `Sicherheitszone von ${q(fi.name(c.a))} reicht in eine Wand.`, floorId, target });
        break;
      default:
        break;
    }
  }
}

function doorWarnings(fc: FloorContext, fi: FloorItems, walls: Wall[], minEscape: number, out: PlanningWarning[]) {
  const floor = fc.floor;
  const doors = floor.openings.filter((o): o is Door => o.kind === 'door' && !o.hidden);
  if (!doors.length || !fi.solid.length) return;
  const clearDepth = Math.max(EMERGENCY_CLEAR_MIN_CM, minEscape);
  const solidIds = new Set(fi.solid.map((it) => it.id));
  const blocked = new Set<string>(); // `${itemId}|${doorId}` vor Notausgang
  const footprints = new Map(fi.solid.map((it) => [it.id, itemFootprint(it)]));
  for (const d of doors) {
    const isEmergency = d.doorType === 'Notausgang' || !!DOOR_TYPE_MAP[d.doorType]?.emergency;
    if (!isEmergency) continue;
    const wall = findWall(floor, d.wallId);
    if (!wall) continue;
    const rects = emergencyExitClearanceRects(d, wall, clearDepth);
    for (const it of fi.solid) {
      if (it.wallId === wall.id) continue;
      const fp = footprints.get(it.id)!;
      if (rects.some((r) => convexPolygonsOverlap(fp, r, 0.5))) {
        blocked.add(`${it.id}|${d.id}`);
        out.push({
          id: `emergency-exit:${d.id}:${it.id}`,
          kind: 'emergency-exit',
          severity: 'error',
          message: `${q(fi.name(it.id))} steht vor dem Notausgang (${formatCm(clearDepth)} freihalten).`,
          floorId: floor.id,
          target: { kind: 'item', id: it.id },
        });
      }
    }
  }
  const doorById = new Map(doors.map((d) => [d.id, d]));
  for (const hit of itemsInDoorSwing(fi.all, doors, walls)) {
    if (!solidIds.has(hit.itemId) || blocked.has(`${hit.itemId}|${hit.doorId}`)) continue;
    const d = doorById.get(hit.doorId);
    if (!d) continue;
    const it = fi.byId.get(hit.itemId);
    if (it?.wallId === d.wallId) continue;
    const swings = DOOR_TYPE_MAP[d.doorType]?.swings ?? true;
    out.push({
      id: `door-swing:${d.id}:${hit.itemId}`,
      kind: 'door-swing',
      severity: 'warning',
      message: swings
        ? `${q(fi.name(hit.itemId))} steht in der Schwenkfläche einer Tür (${d.doorType}, ${formatCm(d.width)}).`
        : `${q(fi.name(hit.itemId))} steht im Öffnungsbereich einer Tür (${d.doorType}, ${formatCm(d.width)}).`,
      floorId: floor.id,
      target: { kind: 'item', id: hit.itemId },
    });
  }
}

/**
 * Zu schmale Laufwege: nur Paare mit mindestens einem Trainingsgerät, Objekte in Nebenräumen ausgenommen,
 * gebündelt je Raum („Raum X: n Engpässe, schmalster b cm …“, Ziel = schmalster Punkt). Engpässe außerhalb typisierter
 * Räume werden je Stockwerk zusammengefasst.
 */
function escapeRouteWarnings(fc: FloorContext, fi: FloorItems, project: Project, ctx: AnalysisContext, out: PlanningWarning[]) {
  const min = project.settings.minEscapeRouteCm;
  if (!Number.isFinite(min) || min <= 0) return;
  const floorId = fc.floor.id;
  const solidIds = new Set(fi.solid.map((it) => it.id));
  const subjects = new Set<Id>();
  const excluded = new Set<Id>();
  fi.all.forEach((it, i) => {
    // fi.all beginnt mit den eigenen Objekten des Stockwerks (Index wie fc.items); verlinkte Kopien folgen.
    const rooms = i < fc.items.length && fc.items[i] === it ? fc.itemRooms[i] : roomIndicesAt({ x: it.x, y: it.y }, fc);
    if (rooms.some((r) => ESCAPE_ROUTE_EXCLUDED_ROOM_TYPES.has(fc.rooms[r].type))) {
      excluded.add(it.id);
      return;
    }
    const def = ctx.def(it.defId);
    if (def && TRAINING_AREAS.has(def.bereich) && solidIds.has(it.id)) subjects.add(it.id);
  });
  if (!subjects.size) return;
  const obstacleName = (id: Id) => {
    if (fi.byId.has(id)) return q(fi.name(id));
    return isHallWallId(id) ? 'Hallenwand' : 'Wand';
  };
  interface Group { room: Room | null; count: number; narrowest: Bottleneck }
  const groups = new Map<string, Group>();
  for (const b of escapeRouteBottlenecks(fi.all, fc.floor.walls, fc.inner, min, { includeZones: true, subjectIds: subjects, excludeIds: excluded })) {
    if (b.width < MIN_CORRIDOR_CM) continue;
    const aItem = fi.byId.has(b.a);
    const bItem = fi.byId.has(b.b);
    if (!aItem && !bItem) continue;
    if ((aItem && !solidIds.has(b.a)) || (bItem && !solidIds.has(b.b))) continue;
    const room = typedRoomAt(b.point, fc);
    const key = room ? room.id : '';
    const g = groups.get(key);
    if (!g) groups.set(key, { room, count: 1, narrowest: b });
    else {
      g.count += 1;
      if (b.width < g.narrowest.width) g.narrowest = b;
    }
  }
  for (const [key, g] of groups) {
    const b = g.narrowest;
    const where = g.room ? `Raum ${q(g.room.name)}` : `Stockwerk ${q(fc.floor.name)}`;
    const pair = `zwischen ${obstacleName(b.a)} und ${obstacleName(b.b)}`;
    out.push({
      id: `escape-route:${floorId}:${key || 'floor'}`,
      kind: 'escape-route',
      severity: 'warning',
      message: g.count === 1
        ? `${where}: Laufweg ${pair} nur ${formatCm(Math.round(b.width))} (min. ${formatCm(min)}).`
        : `${where}: ${g.count} Engpässe, schmalster ${formatCm(Math.round(b.width))} ${pair} (min. ${formatCm(min)}).`,
      floorId,
      target: { point: b.point },
    });
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
  for (const r of fc.rooms) {
    if (!r.type.startsWith('Umkleide')) continue;
    const c = r.centroid;
    if (!nearAny(c, showers, NEARBY_CM)) {
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
    if (!nearAny(c, showers, NEARBY_CM)) missing.push('keine Dusche');
    if (missing.length) {
      out.push({ id: `wellness:${s.item.id}`, kind: 'wellness', severity: 'warning', message: `${q(s.name)}: ${missing.join(' und ')} in der Nähe (≤ 15 m).`, floorId: fc.floor.id, target: { kind: 'item', id: s.item.id } });
    }
  }
}

function outsideHallWarnings(fc: FloorContext, fi: FloorItems, ctx: AnalysisContext, out: PlanningWarning[]) {
  if (!fc.inner || !fc.outer) return;
  for (const it of fi.solid) {
    if (isLinkedCopy(it)) continue;
    const def = ctx.def(it.defId);
    const poly = def?.wandmontage || it.wallId ? fc.outer : fc.inner;
    if (itemInsideHall(it, poly, HALL_TOLERANCE_CM)) continue;
    const centerOutside = !pointInPolygon({ x: it.x, y: it.y }, poly);
    const name = itemName(it, def);
    out.push({
      id: `outside-hall:${it.id}`,
      kind: 'outside-hall',
      severity: centerOutside ? 'error' : 'warning',
      message: centerOutside ? `${q(name)} steht außerhalb der Halle.` : `${q(name)} ragt über die Hallenwand hinaus.`,
      floorId: fc.floor.id,
      target: { kind: 'item', id: it.id },
    });
  }
}

/** „Maße ungeprüft“: eine Info-Warnung je Stockwerk mit Gesamtzahl und den häufigsten Objekten; unbekannte IDs je Definition. */
function libraryWarnings(ctx: AnalysisContext, out: PlanningWarning[]) {
  interface UnverifiedFloor { floorName: string; total: number; firstItemId: Id; byDef: Map<string, { name: string; count: number }> }
  const unverified = new Map<Id, UnverifiedFloor>();
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
      if (def.verifiziert === false && def.bereich !== 'Bauelemente') {
        let u = unverified.get(fc.floor.id);
        if (!u) {
          u = { floorName: fc.floor.name, total: 0, firstItemId: it.id, byDef: new Map() };
          unverified.set(fc.floor.id, u);
        }
        u.total += 1;
        const d = u.byDef.get(def.id) ?? { name: def.name, count: 0 };
        d.count += 1;
        u.byDef.set(def.id, d);
      }
      if (def.nur_an_rack) {
        const docked = !!it.dockedTo && fc.items.some((o) => o.id === it.dockedTo);
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
  const multiFloor = ctx.floors.length > 1;
  for (const [floorId, u] of unverified) {
    const entries = [...u.byDef.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
    const shown = entries.slice(0, UNVERIFIED_LIST_MAX);
    const rest = entries.length - shown.length;
    const list = shown.map((e) => (e.count > 1 ? `${e.name} (${e.count}×)` : e.name)).join(', ') + (rest > 0 ? ` … (+${rest} weitere)` : '');
    out.push({
      id: `unverified:${floorId}`,
      kind: 'unverified',
      severity: 'info',
      message: `${multiFloor ? `${u.floorName}: ` : ''}${u.total} Objekt${u.total === 1 ? '' : 'e'} mit ungeprüften Maßen (generische Bibliothek): ${list} – vor dem Kauf beim Hersteller bestätigen.`,
      floorId,
      target: { kind: 'item', id: u.firstItemId },
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
    const fi = floorItems(fc, project, ctx);
    const walls = allWalls(fc.floor);
    collisionWarnings(fc, fi, walls, ctx, out);
    doorWarnings(fc, fi, walls, project.settings.minEscapeRouteCm, out);
    escapeRouteWarnings(fc, fi, project, ctx, out);
    ceilingWarnings(fc, ctx, out);
    facilityWarnings(fc, ctx, out);
    outsideHallWarnings(fc, fi, ctx, out);
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
