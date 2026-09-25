/**
 * Gemeinsamer Analyse-Kontext: Räume, Hallen-Polygone, Netto-Flächen und Objekt→Raum-Zuordnung
 * je Stockwerk. Wird per WeakMap am (immutablen) Project-Objekt gecacht, damit alle Analyse-Funktionen
 * rein bleiben (gleiche Eingabe → gleiche Ausgabe) und trotzdem nicht mehrfach rechnen.
 *
 * Flächen-Regeln (siehe areaBalance):
 * - brutto  = Hallen-Außenpolygon
 * - netto   = Hallen-Innenpolygon (Wandstärke abgezogen) minus Lufträume
 * - Räume werden auf das Innenpolygon beschnitten und um Lufträume reduziert; Löcher (Raum im Raum: Außenkante
 *   des inneren Wandzugs) zählen nicht zur Fläche des äußeren Raums.
 * - Automatisch erkannte Räume OHNE roomMeta-Eintrag (z. B. die leere Halle als ein großer Raum) haben keinen
 *   vom Nutzer gewählten Typ und zählen in der Bilanz als „nicht zugeordnet“ (bleiben aber als Räume für
 *   Objekt-Zuordnung, Bodenlast und Restfläche erhalten).
 * - Überlappungen: der KLEINERE (spezifischere) Raum gewinnt. Zonen haben Vorrang vor automatisch
 *   erkannten Räumen. Reihenfolge: Zonen aufsteigend nach Fläche, dann Auto-Räume aufsteigend; jeder
 *   Raum bekommt seine Fläche abzüglich der Schnittflächen mit allen vorher verarbeiteten Räumen.
 *   Dreifach-Überlappungen werden dabei näherungsweise (ggf. mehrfach) abgezogen – in der Praxis selten.
 */
import type { Project, Floor, Room, PlacedItem, EquipmentDef, Vec2, LibraryArea, MuscleGroup, SymbolKind } from '@/types';
import { getDef } from '@/data/equipment';
import { floorRooms } from '@/geometry/rooms';
import { hallInnerPolygon, hallOuterPolygon } from '@/geometry/walls';
import { polygonArea, pointInPolygon, bbox, bboxOverlap, type BBox } from '@/geometry/polygon';
import { ROOM_TYPE_MAP, roomColor, type AreaClass } from '@/data/roomTypes';
import { polygonIntersectionArea } from './clip';

export const CM2_PER_M2 = 10000;

export interface RoomArea {
  room: Room;
  areaClass: AreaClass;
  color: string;
  /** Fläche in der Bilanz (m²): beschnitten auf die Halle, ohne Lufträume, ohne Überlappung mit kleineren Räumen. */
  effectiveM2: number;
  /** Zone oder Auto-Raum mit gesetzten Metadaten (Typ vom Nutzer gewählt). Untypisierte Auto-Räume zählen als „nicht zugeordnet“. */
  typed: boolean;
}

export interface FloorContext {
  floor: Floor;
  /** Räume des Stockwerks (automatisch erkannte + Zonen, ohne ausgeblendete Zonen). */
  rooms: Room[];
  roomAreas: RoomArea[];
  /** Anzahl Räume mit gewähltem Typ (Zonen + Auto-Räume mit roomMeta). */
  typedRoomCount: number;
  roomBoxes: BBox[];
  /** Innenpolygon der Halle (Wandstärke abgezogen) bzw. null ohne Halle. */
  inner: Vec2[] | null;
  outer: Vec2[] | null;
  hasHall: boolean;
  bruttoM2: number;
  innerM2: number;
  voidM2: number;
  nettoM2: number;
  /** Eigene Objekte des Stockwerks (verlinkte Treppen anderer Stockwerke zählen auf ihrem Ursprungsstockwerk). */
  items: PlacedItem[];
  /** Je Objekt (Index in `items`) die Indizes der Räume, in deren Polygon der Mittelpunkt liegt. */
  itemRooms: number[][];
}

export interface AnalysisContext {
  project: Project;
  /** Stockwerke sortiert nach `order`. */
  floors: FloorContext[];
  def: (id: string) => EquipmentDef | undefined;
}

export function sortedFloors(project: Project): Floor[] {
  return [...project.floors].sort((a, b) => a.order - b.order);
}

export function areaClassOf(room: Pick<Room, 'type'>): AreaClass {
  return ROOM_TYPE_MAP[room.type]?.areaClass ?? 'Nebenfläche';
}

/** Hat der Raum einen vom Nutzer gesetzten Typ (Zone oder Auto-Raum mit roomMeta-Eintrag)? */
export function isTypedRoom(room: Room, floor: Pick<Floor, 'roomMeta'>): boolean {
  if (room.source === 'zone') return true;
  return room.loopKey != null && floor.roomMeta[room.loopKey] != null;
}

/** Liegt der Punkt im Raum (Polygon, aber nicht in einem Loch)? */
export function pointInRoom(p: Vec2, room: Room): boolean {
  if (!pointInPolygon(p, room.polygon)) return false;
  if (room.holes) for (const h of room.holes) if (pointInPolygon(p, h)) return false;
  return true;
}

/** Schnittfläche (cm²) der Region „`poly` ohne `holes`“ mit dem Polygon `other` (Löcher liegen vollständig in `poly`). */
function regionIntersectionArea(poly: Vec2[], holes: Vec2[][], other: Vec2[]): number {
  let a = polygonIntersectionArea(poly, other);
  for (const h of holes) a -= polygonIntersectionArea(h, other);
  return a;
}
/** Schnittfläche (cm²) zweier Regionen (Polygon minus Löcher). */
function regionsIntersectionArea(poly: Vec2[], holes: Vec2[][], other: Vec2[], otherHoles: Vec2[][]): number {
  let a = regionIntersectionArea(poly, holes, other);
  for (const h of otherHoles) a -= regionIntersectionArea(poly, holes, h);
  return a;
}

function buildFloorContext(floor: Floor): FloorContext {
  const rooms = floorRooms(floor);
  const hasHall = !!floor.hall && floor.hall.polygon.length >= 3;
  const outer = hasHall && floor.hall ? hallOuterPolygon(floor.hall) : null;
  const inner = hasHall && floor.hall ? hallInnerPolygon(floor.hall) : null;
  const bruttoM2 = outer ? polygonArea(outer) / CM2_PER_M2 : 0;
  const innerM2 = inner ? polygonArea(inner) / CM2_PER_M2 : 0;
  const voids = floor.voids.filter((v) => v.polygon.length >= 3);
  let voidCm2 = 0;
  for (const v of voids) voidCm2 += inner ? polygonIntersectionArea(v.polygon, inner) : polygonArea(v.polygon);
  const voidM2 = voidCm2 / CM2_PER_M2;

  // Effektive Raumflächen: kleinere Räume zuerst, Zonen vor Auto-Räumen.
  const order = rooms
    .map((room, index) => ({ room, index, area: polygonArea(room.polygon) }))
    .sort((a, b) => (a.room.source === b.room.source ? a.area - b.area : a.room.source === 'zone' ? -1 : 1));
  const effective = new Array<number>(rooms.length).fill(0);
  const processed: { poly: Vec2[]; holes: Vec2[][]; box: BBox }[] = [];
  for (const { room, index, area } of order) {
    const poly = room.polygon;
    if (poly.length < 3) continue;
    const box = bbox(poly);
    const holes = room.holes ?? [];
    let cm2 = inner ? regionIntersectionArea(poly, holes, inner) : area - holes.reduce((s, h) => s + polygonArea(h), 0);
    for (const v of voids) cm2 -= regionIntersectionArea(poly, holes, v.polygon);
    for (const p of processed) if (bboxOverlap(box, p.box)) cm2 -= regionsIntersectionArea(poly, holes, p.poly, p.holes);
    effective[index] = Math.max(0, cm2) / CM2_PER_M2;
    processed.push({ poly, holes, box });
  }
  const roomAreas: RoomArea[] = rooms.map((room, i) => ({
    room,
    areaClass: areaClassOf(room),
    color: roomColor(room.type, room.color),
    effectiveM2: effective[i],
    typed: isTypedRoom(room, floor),
  }));
  const roomBoxes = rooms.map((r) => bbox(r.polygon));
  const typedRoomCount = roomAreas.filter((r) => r.typed).length;

  // Ohne Halle: Netto = Summe der Räume (damit Prozentwerte sinnvoll bleiben).
  const nettoM2 = hasHall ? Math.max(0, innerM2 - voidM2) : roomAreas.reduce((s, r) => s + r.effectiveM2, 0);

  const items = floor.items;
  const itemRooms: number[][] = items.map((it) => {
    const out: number[] = [];
    for (let r = 0; r < rooms.length; r++) {
      const b = roomBoxes[r];
      if (it.x < b.minX || it.x > b.maxX || it.y < b.minY || it.y > b.maxY) continue;
      if (pointInRoom({ x: it.x, y: it.y }, rooms[r])) out.push(r);
    }
    return out;
  });

  return { floor, rooms, roomAreas, typedRoomCount, roomBoxes, inner, outer, hasHall, bruttoM2, innerM2, voidM2, nettoM2, items, itemRooms };
}

const contextCache = new WeakMap<Project, AnalysisContext>();

/** Analyse-Kontext für ein Projekt (gecacht am Projekt-Objekt). */
export function analysisContext(project: Project): AnalysisContext {
  const cached = contextCache.get(project);
  if (cached) return cached;
  const defCache = new Map<string, EquipmentDef | undefined>();
  const def = (id: string) => {
    if (defCache.has(id)) return defCache.get(id);
    const d = getDef(id, project);
    defCache.set(id, d);
    return d;
  };
  const ctx: AnalysisContext = { project, floors: sortedFloors(project).map(buildFloorContext), def };
  contextCache.set(project, ctx);
  return ctx;
}

/** Memoisiert eine reine Projekt-Funktion am Projekt-Objekt (immutabler Store → sicher). */
export function memoByProject<T>(fn: (project: Project) => T): (project: Project) => T {
  const cache = new WeakMap<Project, T>();
  return (project) => {
    const c = cache.get(project);
    if (c !== undefined) return c;
    const v = fn(project);
    cache.set(project, v);
    return v;
  };
}

/* ------------------------------------------------------------------ */
/* Objekt-Helfer                                                       */
/* ------------------------------------------------------------------ */

export function itemName(item: PlacedItem, def: EquipmentDef | undefined): string {
  return item.label?.trim() || def?.name || item.defId;
}
export function itemHeight(item: PlacedItem, def: EquipmentDef | undefined): number | null {
  return item.height ?? def?.hoehe_cm ?? null;
}
export function itemWeightKg(def: EquipmentDef | undefined): number | null {
  const w = def?.gewicht_kg;
  return typeof w === 'number' && Number.isFinite(w) ? w : null;
}
export function hasFootprint(def: EquipmentDef | undefined): boolean {
  return !def?.ohne_stellflaeche;
}
/** Reine Grundfläche (Breite × Tiefe) in m². */
export function footprintM2(item: PlacedItem): number {
  return (item.width * item.depth) / CM2_PER_M2;
}
export function symbolOf(def: EquipmentDef | undefined): SymbolKind {
  return def?.symbol ?? 'generic';
}
/** Numerischer Parameter (Objekt überschreibt Bibliothek). */
export function numParam(item: PlacedItem, def: EquipmentDef | undefined, key: string): number | null {
  const raw = item.params?.[key] ?? def?.params?.[key];
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export function isLinkedCopy(item: PlacedItem): boolean {
  return item.params?.__linkedFrom != null;
}
/** Sichtbare Objekte eines Stockwerks inkl. verlinkter Treppen/Aufzüge anderer Stockwerke (wie selectors.floorVisibleItems). */
export function visibleItems(floor: Floor, all: Floor[]): PlacedItem[] {
  const linked: PlacedItem[] = [];
  for (const f of all) {
    if (f.id === floor.id) continue;
    for (const it of f.items) if (it.linkedFloorIds?.includes(floor.id)) linked.push({ ...it, locked: true, params: { ...(it.params ?? {}), __linkedFrom: f.id } });
  }
  return linked.length ? [...floor.items, ...linked] : floor.items;
}

/* ------------------------------------------------------------------ */
/* Farben für Diagramme                                                */
/* ------------------------------------------------------------------ */

export const AREA_CLASS_COLORS: Record<AreaClass, string> = {
  'Trainingsfläche': '#3b82f6',
  'Wellness': '#f97316',
  'Umkleide/Sanitär': '#06b6d4',
  'Nebenfläche': '#a855f7',
  'Verkehrsfläche': '#94a3b8',
};
/** Farbe für „nicht zugeordnet“ (Theme-abhängig über CSS-Variable). */
export const UNASSIGNED_COLOR = 'var(--gp-border)';

export const LIBRARY_AREA_COLORS: Record<LibraryArea, string> = {
  'Kraftgeräte': '#3b82f6',
  'Freihantel-Zubehör': '#6366f1',
  'Cardio': '#ef4444',
  'Functional': '#22c55e',
  'Empfang & Lounge': '#14b8a6',
  'Umkleide': '#0ea5e9',
  'Sanitär': '#38bdf8',
  'Wellness': '#f97316',
  'Kursraum': '#a855f7',
  'Büro & Personal': '#94a3b8',
  'Lager & Technik': '#78716c',
  'Ausstattung': '#84cc16',
  'Bauelemente': '#64748b',
  'Eigene': '#ec4899',
};
export const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  'Beine': '#f59e0b',
  'Brust': '#ef4444',
  'Rücken': '#3b82f6',
  'Schultern': '#8b5cf6',
  'Arme': '#ec4899',
  'Rumpf': '#14b8a6',
  'Kabel/Functional': '#22c55e',
  'Racks': '#64748b',
  'Bänke': '#a78bfa',
  'Plattformen': '#78716c',
  'Ablagen': '#94a3b8',
};
export function libraryAreaColor(area: string): string {
  return LIBRARY_AREA_COLORS[area as LibraryArea] ?? '#94a3b8';
}
export function muscleGroupColor(group: string): string {
  return MUSCLE_GROUP_COLORS[group as MuscleGroup] ?? '#94a3b8';
}

/** Feste Farbpalette für Hersteller/Serien (stabil über Index). */
export const PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#ec4899', '#6366f1', '#84cc16', '#f97316', '#06b6d4', '#8b5cf6'];
export function paletteColor(i: number): string {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
