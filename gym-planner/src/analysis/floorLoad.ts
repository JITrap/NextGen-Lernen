/**
 * Gewicht & Bodenlast: Gesamtgewicht je Raum/Stockwerk, kg/m² gegen settings.floorLoadLimitKgM2,
 * Punktlast-Hinweis für Geräte über 400 kg. Gewicht = gewicht_kg der Bibliotheksdefinition
 * (fehlend → 0 und Zähler „ohne Gewichtsangabe“).
 */
import type { Project, Id, RoomType, Room } from '@/types';
import { analysisContext, memoByProject, itemName, itemWeightKg, type FloorContext, type AnalysisContext } from './common';
import { ALL_FLOORS_ID } from './areaBalance';

/** Ab diesem Eigengewicht wird ein Gerät als Punktlast gelistet. */
export const POINT_LOAD_THRESHOLD_KG = 400;

export interface HeavyItem {
  itemId: Id;
  floorId: Id;
  floorName: string;
  name: string;
  weightKg: number;
  roomName: string | null;
}
export interface RoomLoad {
  floorId: Id;
  floorName: string;
  roomId: Id;
  roomName: string;
  roomType: RoomType;
  source: Room['source'];
  /** Geometrische Raumfläche. */
  areaM2: number;
  weightKg: number;
  /** null, wenn keine Fläche. */
  kgM2: number | null;
  exceeded: boolean;
  itemCount: number;
  missingWeightCount: number;
}
export interface FloorLoad {
  floorId: Id;
  floorName: string;
  /** Bezugsfläche = Nettofläche des Stockwerks. */
  nettoM2: number;
  weightKg: number;
  kgM2: number | null;
  exceeded: boolean;
  itemCount: number;
  missingWeightCount: number;
  rooms: RoomLoad[];
  heavyItems: HeavyItem[];
}
export interface FloorLoadResult {
  limitKgM2: number;
  pointLoadThresholdKg: number;
  floors: FloorLoad[];
  total: FloorLoad;
  heavyItems: HeavyItem[];
}

function effectiveLimit(project: Project): number {
  const l = project.settings.floorLoadLimitKgM2;
  return Number.isFinite(l) && l > 0 ? l : Infinity;
}

function loadOfFloor(fc: FloorContext, ctx: AnalysisContext, limit: number): FloorLoad {
  let weight = 0;
  let missing = 0;
  const roomAcc = fc.rooms.map(() => ({ kg: 0, count: 0, missing: 0 }));
  const heavy: HeavyItem[] = [];
  fc.items.forEach((it, idx) => {
    const def = ctx.def(it.defId);
    const w = itemWeightKg(def);
    if (w == null) missing += 1;
    const kg = w ?? 0;
    weight += kg;
    for (const r of fc.itemRooms[idx]) {
      roomAcc[r].kg += kg;
      roomAcc[r].count += 1;
      if (w == null) roomAcc[r].missing += 1;
    }
    if (kg > POINT_LOAD_THRESHOLD_KG) {
      const firstRoom = fc.itemRooms[idx][0];
      heavy.push({ itemId: it.id, floorId: fc.floor.id, floorName: fc.floor.name, name: itemName(it, def), weightKg: kg, roomName: firstRoom != null ? fc.rooms[firstRoom].name : null });
    }
  });
  heavy.sort((a, b) => b.weightKg - a.weightKg);
  const rooms: RoomLoad[] = fc.rooms.map((room, i) => {
    const kgM2 = room.areaM2 > 0 ? roomAcc[i].kg / room.areaM2 : null;
    return {
      floorId: fc.floor.id,
      floorName: fc.floor.name,
      roomId: room.id,
      roomName: room.name,
      roomType: room.type,
      source: room.source,
      areaM2: room.areaM2,
      weightKg: roomAcc[i].kg,
      kgM2,
      exceeded: kgM2 != null && kgM2 > limit,
      itemCount: roomAcc[i].count,
      missingWeightCount: roomAcc[i].missing,
    };
  });
  const kgM2 = fc.nettoM2 > 0 ? weight / fc.nettoM2 : null;
  return {
    floorId: fc.floor.id,
    floorName: fc.floor.name,
    nettoM2: fc.nettoM2,
    weightKg: weight,
    kgM2,
    exceeded: kgM2 != null && kgM2 > limit,
    itemCount: fc.items.length,
    missingWeightCount: missing,
    rooms,
    heavyItems: heavy,
  };
}

/** Summiert Stockwerks-Lasten (kg/m² bezogen auf die Gesamt-Nettofläche). */
export function sumFloorLoads(floors: FloorLoad[], limit: number, floorId = ALL_FLOORS_ID, floorName = 'Alle Stockwerke'): FloorLoad {
  const netto = floors.reduce((s, f) => s + f.nettoM2, 0);
  const weight = floors.reduce((s, f) => s + f.weightKg, 0);
  const kgM2 = netto > 0 ? weight / netto : null;
  return {
    floorId,
    floorName,
    nettoM2: netto,
    weightKg: weight,
    kgM2,
    exceeded: floors.some((f) => f.exceeded) || (kgM2 != null && kgM2 > limit),
    itemCount: floors.reduce((s, f) => s + f.itemCount, 0),
    missingWeightCount: floors.reduce((s, f) => s + f.missingWeightCount, 0),
    rooms: floors.flatMap((f) => f.rooms),
    heavyItems: floors.flatMap((f) => f.heavyItems).sort((a, b) => b.weightKg - a.weightKg),
  };
}

/** Bodenlast-Auswertung des Projekts (memoisiert am Projekt-Objekt). */
export const floorLoad: (project: Project) => FloorLoadResult = memoByProject((project) => {
  const ctx = analysisContext(project);
  const limit = effectiveLimit(project);
  const floors = ctx.floors.map((fc) => loadOfFloor(fc, ctx, limit));
  const total = sumFloorLoads(floors, limit);
  return { limitKgM2: project.settings.floorLoadLimitKgM2, pointLoadThresholdKg: POINT_LOAD_THRESHOLD_KG, floors, total, heavyItems: total.heavyItems };
});
