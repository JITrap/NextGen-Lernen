/**
 * Flächenbilanz je Stockwerk und gesamt.
 * Regeln siehe common.ts (Beschnitt auf Halle, Lufträume, „kleinerer Raum gewinnt“).
 */
import type { Project, RoomType, Id } from '@/types';
import { AREA_CLASSES, ROOM_TYPE_MAP, type AreaClass } from '@/data/roomTypes';
import { analysisContext, memoByProject, AREA_CLASS_COLORS, type FloorContext } from './common';

export interface AreaByType {
  type: RoomType;
  m2: number;
  /** Anteil an der Nettofläche in %. */
  percent: number;
  color: string;
  /** Anzahl Räume/Zonen dieses Typs. */
  count: number;
}
export interface AreaByClass {
  areaClass: AreaClass;
  m2: number;
  percent: number;
  color: string;
}
export interface FloorAreaBalance {
  floorId: Id;
  floorName: string;
  hasHall: boolean;
  /** Hallen-Außenpolygon. */
  bruttoM2: number;
  /** Halle innen minus Lufträume (ohne Halle: Summe der Räume). */
  nettoM2: number;
  voidM2: number;
  /** Flächenklasse „Trainingsfläche“. */
  trainingM2: number;
  byType: AreaByType[];
  byClass: AreaByClass[];
  /** Netto minus Summe aller typisierten Räume (min 0); enthält Auto-Räume ohne gewählten Typ. */
  unassignedM2: number;
  unassignedPercent: number;
  /** Alle Räume/Zonen (inkl. untypisierter Auto-Räume). */
  roomCount: number;
  /** Auto-Räume ohne gewählten Typ. */
  untypedRoomCount: number;
}
export interface AreaBalance {
  floors: FloorAreaBalance[];
  /** Summe über alle Stockwerke (floorId 'all'). */
  total: FloorAreaBalance;
}

export const ALL_FLOORS_ID = 'all';

function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function balanceOfFloor(fc: FloorContext): FloorAreaBalance {
  const byTypeMap = new Map<RoomType, { m2: number; count: number; color: string }>();
  const byClassMap = new Map<AreaClass, number>();
  for (const ra of fc.roomAreas) {
    if (!ra.typed) continue; // untypisierte Auto-Räume → „nicht zugeordnet“
    const t = byTypeMap.get(ra.room.type) ?? { m2: 0, count: 0, color: ROOM_TYPE_MAP[ra.room.type]?.color ?? ra.color };
    t.m2 += ra.effectiveM2;
    t.count += 1;
    byTypeMap.set(ra.room.type, t);
    byClassMap.set(ra.areaClass, (byClassMap.get(ra.areaClass) ?? 0) + ra.effectiveM2);
  }
  const netto = fc.nettoM2;
  const assigned = fc.roomAreas.reduce((s, r) => s + (r.typed ? r.effectiveM2 : 0), 0);
  const unassignedM2 = Math.max(0, netto - assigned);
  const byType: AreaByType[] = [...byTypeMap.entries()]
    .map(([type, v]) => ({ type, m2: v.m2, percent: pct(v.m2, netto), color: v.color, count: v.count }))
    .sort((a, b) => b.m2 - a.m2);
  const byClass: AreaByClass[] = AREA_CLASSES.map((areaClass) => {
    const m2 = byClassMap.get(areaClass) ?? 0;
    return { areaClass, m2, percent: pct(m2, netto), color: AREA_CLASS_COLORS[areaClass] };
  });
  return {
    floorId: fc.floor.id,
    floorName: fc.floor.name,
    hasHall: fc.hasHall,
    bruttoM2: fc.bruttoM2,
    nettoM2: netto,
    voidM2: fc.voidM2,
    trainingM2: byClassMap.get('Trainingsfläche') ?? 0,
    byType,
    byClass,
    unassignedM2,
    unassignedPercent: pct(unassignedM2, netto),
    roomCount: fc.rooms.length,
    untypedRoomCount: fc.rooms.length - fc.typedRoomCount,
  };
}

/** Summiert mehrere Stockwerks-Bilanzen (Prozentwerte werden neu auf die Gesamt-Nettofläche bezogen). */
export function sumAreaBalances(floors: FloorAreaBalance[], floorId = ALL_FLOORS_ID, floorName = 'Alle Stockwerke'): FloorAreaBalance {
  const byTypeMap = new Map<RoomType, { m2: number; count: number; color: string }>();
  const byClassMap = new Map<AreaClass, number>();
  let brutto = 0;
  let netto = 0;
  let voids = 0;
  let unassigned = 0;
  let rooms = 0;
  let untyped = 0;
  let hasHall = false;
  for (const f of floors) {
    brutto += f.bruttoM2;
    netto += f.nettoM2;
    voids += f.voidM2;
    unassigned += f.unassignedM2;
    rooms += f.roomCount;
    untyped += f.untypedRoomCount;
    hasHall = hasHall || f.hasHall;
    for (const t of f.byType) {
      const cur = byTypeMap.get(t.type) ?? { m2: 0, count: 0, color: t.color };
      cur.m2 += t.m2;
      cur.count += t.count;
      byTypeMap.set(t.type, cur);
    }
    for (const c of f.byClass) byClassMap.set(c.areaClass, (byClassMap.get(c.areaClass) ?? 0) + c.m2);
  }
  const byType: AreaByType[] = [...byTypeMap.entries()]
    .map(([type, v]) => ({ type, m2: v.m2, percent: pct(v.m2, netto), color: v.color, count: v.count }))
    .sort((a, b) => b.m2 - a.m2);
  const byClass: AreaByClass[] = AREA_CLASSES.map((areaClass) => {
    const m2 = byClassMap.get(areaClass) ?? 0;
    return { areaClass, m2, percent: pct(m2, netto), color: AREA_CLASS_COLORS[areaClass] };
  });
  return {
    floorId,
    floorName,
    hasHall,
    bruttoM2: brutto,
    nettoM2: netto,
    voidM2: voids,
    trainingM2: byClassMap.get('Trainingsfläche') ?? 0,
    byType,
    byClass,
    unassignedM2: unassigned,
    unassignedPercent: pct(unassigned, netto),
    roomCount: rooms,
    untypedRoomCount: untyped,
  };
}

/** Flächenbilanz des Projekts (memoisiert am Projekt-Objekt). */
export const areaBalance: (project: Project) => AreaBalance = memoByProject((project) => {
  const ctx = analysisContext(project);
  const floors = ctx.floors.map(balanceOfFloor);
  return { floors, total: sumAreaBalances(floors) };
});
