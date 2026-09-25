import type { Floor, Project, ProjectSettings, LayerVisibility, Hall, Wall, Zone, PlacedItem, EquipmentDef, SafetyZone } from '@/types';
import { newId } from '@/utils/id';
import { rectPolygon } from '@/geometry/polygon';
import { isHallWallId } from '@/geometry/walls';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: ProjectSettings = {
  gridSize: 10,
  showGrid: true,
  snapEnabled: true,
  floorLoadLimitKgM2: 500,
  m2PerPerson: 9,
  minEscapeRouteCm: 120,
  defaultSafetyZoneCm: 60,
  showLowerFloor: true,
  lowerFloorOpacity: 0.3,
};

export const DEFAULT_LAYERS: LayerVisibility = {
  grid: true,
  walls: true,
  rooms: true,
  items: true,
  safetyZones: true,
  dimensions: true,
  labels: true,
  furniture: true,
  lowerFloor: true,
  openings: true,
  annotations: true,
  voids: true,
};

export const DEFAULT_CEILING_HEIGHT = 350;
export const DEFAULT_OUTER_WALL_THICKNESS = 24;
export const DEFAULT_WALL_THICKNESS = 12.5;

export function createFloor(partial: Partial<Floor> = {}): Floor {
  return {
    id: newId('f_'),
    name: 'EG',
    order: 0,
    ceilingHeight: DEFAULT_CEILING_HEIGHT,
    hall: null,
    walls: [],
    zones: [],
    roomMeta: {},
    openings: [],
    items: [],
    groups: [],
    voids: [],
    annotations: [],
    ...partial,
  };
}

export function createHall(widthCm: number, depthCm: number, opts: Partial<Hall> = {}): Hall {
  return {
    polygon: rectPolygon({ x: 0, y: 0 }, { x: widthCm, y: depthCm }),
    wallThickness: DEFAULT_OUTER_WALL_THICKNESS,
    floorCovering: 'Gummiboden',
    ...opts,
  };
}

export function createWall(partial: Partial<Wall> & Pick<Wall, 'start' | 'end'>): Wall {
  return {
    id: newId('w_'),
    thickness: DEFAULT_WALL_THICKNESS,
    type: 'Trockenbau',
    height: null,
    ...partial,
  };
}

export function createZone(partial: Partial<Zone> & Pick<Zone, 'polygon'>): Zone {
  return {
    id: newId('z_'),
    name: 'Zone',
    type: 'Sonstiges',
    ...partial,
  };
}

export function zoneFromDef(def: EquipmentDef): SafetyZone {
  return { ...def.sicherheitszone_cm };
}

/** Erzeugt ein platziertes Objekt aus einer Bibliotheksdefinition. */
export function createItemFromDef(def: EquipmentDef, x: number, y: number, partial: Partial<PlacedItem> = {}): PlacedItem {
  const kind: PlacedItem['kind'] = def.bereich === 'Bauelemente'
    ? ((def.params?.kind as PlacedItem['kind']) ?? 'equipment')
    : 'equipment';
  return {
    id: newId('i_'),
    kind,
    defId: def.id,
    x,
    y,
    rotation: 0,
    width: def.breite_cm,
    depth: def.tiefe_cm,
    height: def.hoehe_cm,
    safetyZone: zoneFromDef(def),
    safetyZoneEnabled: true,
    ...(def.params ? { params: { ...def.params } } : {}),
    ...partial,
  };
}

export function createEmptyProject(name = 'Neues Projekt'): Project {
  const floor = createFloor({ name: 'EG', order: 0 });
  const now = new Date().toISOString();
  return {
    id: newId('p_'),
    schemaVersion: SCHEMA_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS },
    layers: { ...DEFAULT_LAYERS },
    floors: [floor],
    activeFloorId: floor.id,
    customEquipment: [],
    favorites: [],
    priceOverrides: {},
  };
}

/** Tiefe Kopie (strukturiert) – für Duplizieren/Varianten. */
export function cloneDeep<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}

/** Dupliziert ein Stockwerk mit neuen IDs (inkl. Referenzen innerhalb des Stockwerks). */
export function duplicateFloor(src: Floor, name: string): Floor {
  const f = cloneDeep(src);
  const idMap = new Map<string, string>();
  const remap = (old: string, prefix: string) => {
    if (!idMap.has(old)) idMap.set(old, newId(prefix));
    return idMap.get(old)!;
  };
  // Virtuelle Hallen-Außenwände (hall_<i>) sind je Stockwerk gleich benannt und werden nicht umbenannt.
  const remapWall = (id: string) => (isHallWallId(id) ? id : remap(id, 'w_'));
  f.id = newId('f_');
  f.name = name;
  f.walls = f.walls.map((w) => ({ ...w, id: remap(w.id, 'w_') }));
  f.zones = f.zones.map((z) => ({ ...z, id: remap(z.id, 'z_') }));
  f.openings = f.openings.map((o) => ({ ...o, id: remap(o.id, 'o_'), wallId: remapWall(o.wallId) }));
  f.groups = f.groups.map((g) => ({ ...g, id: remap(g.id, 'g_'), itemIds: g.itemIds.map((i) => remap(i, 'i_')) }));
  f.items = f.items.map((it) => {
    // Optionale Referenzen nur setzen, wenn vorhanden (keine expliziten undefined-Eigenschaften).
    const { groupId, dockedTo, wallId, linkedFloorIds: _linked, ...rest } = it;
    const copy: PlacedItem = { ...rest, id: remap(it.id, 'i_') };
    if (groupId) copy.groupId = remap(groupId, 'g_');
    if (dockedTo) copy.dockedTo = remap(dockedTo, 'i_');
    if (wallId) copy.wallId = remapWall(wallId);
    return copy;
  });
  f.voids = f.voids.map((v) => ({ ...v, id: remap(v.id, 'v_') }));
  f.annotations = f.annotations.map((a) => ({ ...a, id: remap(a.id, 'a_') }));
  return f;
}
