/**
 * Geräte-Statistik: Anzahl je Bereich/Muskelgruppe/Hersteller/Serie, Grundflächen und freie Restfläche je Raum.
 * Hinweis: „inkl. Sicherheitszonen“ summiert die Zonenpolygone je Objekt – überlappende Zonen werden NICHT
 * abgezogen (die Summe kann daher größer sein als die tatsächlich belegte Fläche).
 */
import type { Project, Id, RoomType, Room } from '@/types';
import { polygonArea } from '@/geometry/polygon';
import { itemSafetyPolygon, zoneIsEmpty } from '@/geometry/transform';
import { analysisContext, memoByProject, footprintM2, hasFootprint, libraryAreaColor, muscleGroupColor, paletteColor, CM2_PER_M2, type FloorContext, type AnalysisContext } from './common';
import { ALL_FLOORS_ID } from './areaBalance';

export interface CountEntry {
  key: string;
  label: string;
  count: number;
  color: string;
}
export interface RoomFreeArea {
  floorId: Id;
  floorName: string;
  roomId: Id;
  roomName: string;
  roomType: RoomType;
  source: Room['source'];
  /** Geometrische Raumfläche (wie im Plan angezeigt). */
  roomM2: number;
  /** Grundflächen der Objekte, deren Mittelpunkt im Raum liegt. */
  itemsM2: number;
  freeM2: number;
  itemCount: number;
}
export interface FloorEquipmentStats {
  floorId: Id;
  floorName: string;
  itemCount: number;
  /** Mengenpositionen ohne Stellfläche (zählen nicht zur Grundfläche). */
  noFootprintCount: number;
  unknownDefCount: number;
  byArea: CountEntry[];
  byMuscle: CountEntry[];
  byManufacturer: CountEntry[];
  bySeries: CountEntry[];
  /** Summe reine Grundfläche (Breite × Tiefe). */
  footprintM2: number;
  /** Summe Grundfläche inkl. aktiver Sicherheitszonen (Überlappungen nicht abgezogen). */
  withZonesM2: number;
  freeByRoom: RoomFreeArea[];
}
export interface EquipmentStats {
  floors: FloorEquipmentStats[];
  total: FloorEquipmentStats;
}

type Counter = Map<string, { label: string; count: number }>;
function inc(map: Counter, key: string, label: string) {
  const cur = map.get(key);
  if (cur) cur.count += 1;
  else map.set(key, { label, count: 1 });
}
function toEntries(map: Counter, color: (key: string, i: number) => string): CountEntry[] {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label, 'de'))
    .map(([key, v], i) => ({ key, label: v.label, count: v.count, color: color(key, i) }));
}

function statsOfFloor(fc: FloorContext, ctx: AnalysisContext, manufacturerIndex: Map<string, number>): FloorEquipmentStats {
  const byArea: Counter = new Map();
  const byMuscle: Counter = new Map();
  const byManufacturer: Counter = new Map();
  const bySeries: Counter = new Map();
  let footprint = 0;
  let withZones = 0;
  let noFootprintCount = 0;
  let unknownDefCount = 0;
  const roomItems = fc.rooms.map(() => ({ m2: 0, count: 0 }));

  fc.items.forEach((it, idx) => {
    const def = ctx.def(it.defId);
    if (!def) unknownDefCount += 1;
    const area = def?.bereich ?? (it.kind === 'equipment' ? 'Eigene' : 'Bauelemente');
    inc(byArea, area, area);
    if (def?.muskelgruppe) inc(byMuscle, def.muskelgruppe, def.muskelgruppe);
    const man = def?.hersteller ?? 'Unbekannt';
    inc(byManufacturer, man, man);
    const serie = def?.serie ? `${man} – ${def.serie}` : `${man} – ohne Serie`;
    inc(bySeries, serie, serie);
    if (!hasFootprint(def)) { noFootprintCount += 1; return; }
    const fp = footprintM2(it);
    footprint += fp;
    withZones += it.safetyZoneEnabled && !zoneIsEmpty(it.safetyZone) ? polygonArea(itemSafetyPolygon(it, it.safetyZone)) / CM2_PER_M2 : fp;
    for (const r of fc.itemRooms[idx]) { roomItems[r].m2 += fp; roomItems[r].count += 1; }
  });

  const freeByRoom: RoomFreeArea[] = fc.rooms.map((room, i) => ({
    floorId: fc.floor.id,
    floorName: fc.floor.name,
    roomId: room.id,
    roomName: room.name,
    roomType: room.type,
    source: room.source,
    roomM2: room.areaM2,
    itemsM2: roomItems[i].m2,
    freeM2: Math.max(0, room.areaM2 - roomItems[i].m2),
    itemCount: roomItems[i].count,
  }));

  return {
    floorId: fc.floor.id,
    floorName: fc.floor.name,
    itemCount: fc.items.length,
    noFootprintCount,
    unknownDefCount,
    byArea: toEntries(byArea, (k) => libraryAreaColor(k)),
    byMuscle: toEntries(byMuscle, (k) => muscleGroupColor(k)),
    byManufacturer: toEntries(byManufacturer, (k) => paletteColor(manufacturerIndex.get(k) ?? 0)),
    bySeries: toEntries(bySeries, (k) => paletteColor(manufacturerIndex.get(k.split(' – ')[0]) ?? 0)),
    footprintM2: footprint,
    withZonesM2: withZones,
    freeByRoom,
  };
}

function mergeEntries(lists: CountEntry[][]): CountEntry[] {
  const map = new Map<string, CountEntry>();
  for (const list of lists) {
    for (const e of list) {
      const cur = map.get(e.key);
      if (cur) cur.count += e.count;
      else map.set(e.key, { ...e });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de'));
}

/** Summiert Stockwerks-Statistiken. */
export function sumEquipmentStats(floors: FloorEquipmentStats[], floorId = ALL_FLOORS_ID, floorName = 'Alle Stockwerke'): FloorEquipmentStats {
  return {
    floorId,
    floorName,
    itemCount: floors.reduce((s, f) => s + f.itemCount, 0),
    noFootprintCount: floors.reduce((s, f) => s + f.noFootprintCount, 0),
    unknownDefCount: floors.reduce((s, f) => s + f.unknownDefCount, 0),
    byArea: mergeEntries(floors.map((f) => f.byArea)),
    byMuscle: mergeEntries(floors.map((f) => f.byMuscle)),
    byManufacturer: mergeEntries(floors.map((f) => f.byManufacturer)),
    bySeries: mergeEntries(floors.map((f) => f.bySeries)),
    footprintM2: floors.reduce((s, f) => s + f.footprintM2, 0),
    withZonesM2: floors.reduce((s, f) => s + f.withZonesM2, 0),
    freeByRoom: floors.flatMap((f) => f.freeByRoom),
  };
}

/** Geräte-Statistik des Projekts (memoisiert am Projekt-Objekt). */
export const equipmentStats: (project: Project) => EquipmentStats = memoByProject((project) => {
  const ctx = analysisContext(project);
  // Stabile Farben je Hersteller (alphabetisch über das ganze Projekt).
  const manufacturers = new Set<string>();
  for (const fc of ctx.floors) for (const it of fc.items) manufacturers.add(ctx.def(it.defId)?.hersteller ?? 'Unbekannt');
  const manufacturerIndex = new Map([...manufacturers].sort((a, b) => a.localeCompare(b, 'de')).map((m, i) => [m, i]));
  const floors = ctx.floors.map((fc) => statsOfFloor(fc, ctx, manufacturerIndex));
  return { floors, total: sumEquipmentStats(floors) };
});
