import { create } from 'zustand';
import { temporal } from 'zundo';
import { produce, type Draft } from 'immer';
import type {
  Project, Floor, Wall, Zone, Opening, PlacedItem, VoidArea, Annotation, RoomMeta,
  Id, Hall, ProjectSettings, LayerVisibility, EquipmentDef, Vec2,
} from '@/types';
import { createEmptyProject, createFloor, duplicateFloor, cloneDeep } from './factories';
import { newId } from '@/utils/id';

/** Zeitstempel-Update ohne eigenen Undo-Schritt zu erzeugen: wird bei jeder Mutation gesetzt. */
function touch(p: Draft<Project>) {
  p.updatedAt = new Date().toISOString();
}

export interface ProjectState {
  project: Project;
  /* ---- Projekt ---- */
  setProject: (p: Project) => void;
  updateProject: (fn: (p: Draft<Project>) => void) => void;
  renameProject: (name: string) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  updateLayers: (patch: Partial<LayerVisibility>) => void;
  /* ---- Stockwerke ---- */
  setActiveFloor: (id: Id) => void;
  addFloor: (partial?: Partial<Floor>) => Id;
  renameFloor: (id: Id, name: string) => void;
  updateFloor: (id: Id, fn: (f: Draft<Floor>) => void) => void;
  duplicateFloor: (id: Id) => Id | null;
  deleteFloor: (id: Id) => void;
  moveFloor: (id: Id, direction: -1 | 1) => void;
  setFloorCeilingHeight: (id: Id, cm: number) => void;
  /* ---- Halle ---- */
  setHall: (floorId: Id, hall: Hall | null) => void;
  updateHall: (floorId: Id, fn: (h: Draft<Hall>) => void) => void;
  /* ---- Wände ---- */
  addWall: (floorId: Id, wall: Wall) => void;
  addWalls: (floorId: Id, walls: Wall[]) => void;
  updateWall: (floorId: Id, id: Id, patch: Partial<Wall>) => void;
  deleteWalls: (floorId: Id, ids: Id[]) => void;
  /** Ersetzt Wände (z. B. nach Teilen) atomar. */
  replaceWalls: (floorId: Id, removeIds: Id[], add: Wall[]) => void;
  /* ---- Zonen / Räume ---- */
  addZone: (floorId: Id, zone: Zone) => void;
  updateZone: (floorId: Id, id: Id, patch: Partial<Zone>) => void;
  deleteZones: (floorId: Id, ids: Id[]) => void;
  setRoomMeta: (floorId: Id, loopKey: string, patch: Partial<RoomMeta>) => void;
  /* ---- Öffnungen ---- */
  addOpening: (floorId: Id, opening: Opening) => void;
  updateOpening: (floorId: Id, id: Id, patch: Partial<Opening>) => void;
  deleteOpenings: (floorId: Id, ids: Id[]) => void;
  /* ---- Objekte ---- */
  addItem: (floorId: Id, item: PlacedItem) => void;
  addItems: (floorId: Id, items: PlacedItem[]) => void;
  updateItem: (floorId: Id, id: Id, patch: Partial<PlacedItem>) => void;
  updateItems: (floorId: Id, ids: Id[], fn: (it: Draft<PlacedItem>) => void) => void;
  moveItems: (floorId: Id, ids: Id[], dx: number, dy: number) => void;
  deleteItems: (floorId: Id, ids: Id[]) => void;
  /* ---- Gruppen ---- */
  groupItems: (floorId: Id, ids: Id[]) => Id | null;
  ungroupItems: (floorId: Id, groupIds: Id[]) => void;
  /* ---- Luftraum / Anmerkungen ---- */
  addVoid: (floorId: Id, v: VoidArea) => void;
  updateVoid: (floorId: Id, id: Id, patch: Partial<VoidArea>) => void;
  deleteVoids: (floorId: Id, ids: Id[]) => void;
  addAnnotation: (floorId: Id, a: Annotation) => void;
  updateAnnotation: (floorId: Id, id: Id, patch: Partial<Annotation>) => void;
  deleteAnnotations: (floorId: Id, ids: Id[]) => void;
  /* ---- Bibliothek ---- */
  addCustomEquipment: (def: EquipmentDef) => void;
  updateCustomEquipment: (id: string, patch: Partial<EquipmentDef>) => void;
  deleteCustomEquipment: (id: string) => void;
  toggleFavorite: (defId: string) => void;
  setPriceOverride: (defId: string, price: number | null) => void;
  /* ---- Sammelaktionen ---- */
  deleteSelection: (floorId: Id, sel: { kind: string; id: Id }[]) => void;
}

function floorOf(p: Draft<Project>, id: Id): Draft<Floor> | undefined {
  return p.floors.find((f) => f.id === id);
}

export const useProjectStore = create<ProjectState>()(
  temporal(
    (set, get) => {
      const mutate = (fn: (p: Draft<Project>) => void) =>
        set((s) => ({ project: produce(s.project, (d) => { fn(d); touch(d); }) }));
      const mutateFloor = (floorId: Id, fn: (f: Draft<Floor>, p: Draft<Project>) => void) =>
        mutate((p) => { const f = floorOf(p, floorId); if (f) fn(f, p); });

      return {
        project: createEmptyProject(),

        setProject: (project) => set({ project }),
        updateProject: (fn) => mutate(fn),
        renameProject: (name) => mutate((p) => { p.name = name; }),
        updateSettings: (patch) => mutate((p) => { Object.assign(p.settings, patch); }),
        updateLayers: (patch) => mutate((p) => { Object.assign(p.layers, patch); }),

        setActiveFloor: (id) => set((s) => (s.project.floors.some((f) => f.id === id) ? { project: { ...s.project, activeFloorId: id } } : s)),
        addFloor: (partial) => {
          const floors = get().project.floors;
          const maxOrder = floors.reduce((m, f) => Math.max(m, f.order), -1);
          const f = createFloor({ name: `OG ${Math.max(1, floors.filter((x) => x.order > 0).length + 1)}`, order: maxOrder + 1, ...partial });
          mutate((p) => { p.floors.push(f); p.activeFloorId = f.id; });
          return f.id;
        },
        renameFloor: (id, name) => mutate((p) => { const f = floorOf(p, id); if (f) f.name = name; }),
        updateFloor: (id, fn) => mutateFloor(id, (f) => fn(f)),
        duplicateFloor: (id) => {
          const src = get().project.floors.find((f) => f.id === id);
          if (!src) return null;
          const copy = duplicateFloor(src, `${src.name} (Kopie)`);
          mutate((p) => {
            const idx = p.floors.findIndex((f) => f.id === id);
            for (const f of p.floors) if (f.order > src.order) f.order += 1;
            copy.order = src.order + 1;
            p.floors.splice(idx + 1, 0, copy);
            p.activeFloorId = copy.id;
          });
          return copy.id;
        },
        deleteFloor: (id) => mutate((p) => {
          if (p.floors.length <= 1) return;
          p.floors = p.floors.filter((f) => f.id !== id);
          for (const f of p.floors) {
            for (const it of f.items) if (it.linkedFloorIds) it.linkedFloorIds = it.linkedFloorIds.filter((x) => x !== id);
          }
          if (p.activeFloorId === id) p.activeFloorId = p.floors[0].id;
        }),
        moveFloor: (id, direction) => mutate((p) => {
          const sorted = [...p.floors].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex((f) => f.id === id);
          const j = idx + direction;
          if (idx < 0 || j < 0 || j >= sorted.length) return;
          const a = sorted[idx];
          const b = sorted[j];
          const tmp = a.order;
          a.order = b.order;
          b.order = tmp;
        }),
        setFloorCeilingHeight: (id, cm) => mutate((p) => { const f = floorOf(p, id); if (f) f.ceilingHeight = cm; }),

        setHall: (floorId, hall) => mutateFloor(floorId, (f) => { f.hall = hall; }),
        updateHall: (floorId, fn) => mutateFloor(floorId, (f) => { if (f.hall) fn(f.hall); }),

        addWall: (floorId, wall) => mutateFloor(floorId, (f) => { f.walls.push(wall); }),
        addWalls: (floorId, walls) => mutateFloor(floorId, (f) => { f.walls.push(...walls); }),
        updateWall: (floorId, id, patch) => mutateFloor(floorId, (f) => { const w = f.walls.find((x) => x.id === id); if (w) Object.assign(w, patch); }),
        deleteWalls: (floorId, ids) => mutateFloor(floorId, (f) => {
          const set = new Set(ids);
          f.walls = f.walls.filter((w) => !set.has(w.id));
          f.openings = f.openings.filter((o) => !set.has(o.wallId));
          for (const it of f.items) if (it.wallId && set.has(it.wallId)) it.wallId = undefined;
        }),
        replaceWalls: (floorId, removeIds, add) => mutateFloor(floorId, (f) => {
          const set = new Set(removeIds);
          f.walls = f.walls.filter((w) => !set.has(w.id));
          f.walls.push(...add);
          f.openings = f.openings.filter((o) => !set.has(o.wallId) || add.some((w) => w.id === o.wallId));
        }),

        addZone: (floorId, zone) => mutateFloor(floorId, (f) => { f.zones.push(zone); }),
        updateZone: (floorId, id, patch) => mutateFloor(floorId, (f) => { const z = f.zones.find((x) => x.id === id); if (z) Object.assign(z, patch); }),
        deleteZones: (floorId, ids) => mutateFloor(floorId, (f) => { const set = new Set(ids); f.zones = f.zones.filter((z) => !set.has(z.id)); }),
        setRoomMeta: (floorId, loopKey, patch) => mutateFloor(floorId, (f) => {
          const cur = f.roomMeta[loopKey] ?? { name: 'Raum', type: 'Sonstiges' };
          f.roomMeta[loopKey] = { ...cur, ...patch };
        }),

        addOpening: (floorId, o) => mutateFloor(floorId, (f) => { f.openings.push(o); }),
        updateOpening: (floorId, id, patch) => mutateFloor(floorId, (f) => { const o = f.openings.find((x) => x.id === id); if (o) Object.assign(o, patch); }),
        deleteOpenings: (floorId, ids) => mutateFloor(floorId, (f) => { const set = new Set(ids); f.openings = f.openings.filter((o) => !set.has(o.id)); }),

        addItem: (floorId, item) => mutateFloor(floorId, (f) => { f.items.push(item); }),
        addItems: (floorId, items) => mutateFloor(floorId, (f) => { f.items.push(...items); }),
        updateItem: (floorId, id, patch) => mutateFloor(floorId, (f) => { const it = f.items.find((x) => x.id === id); if (it) Object.assign(it, patch); }),
        updateItems: (floorId, ids, fn) => mutateFloor(floorId, (f) => { const set = new Set(ids); for (const it of f.items) if (set.has(it.id)) fn(it); }),
        moveItems: (floorId, ids, dx, dy) => mutateFloor(floorId, (f) => {
          const set = new Set(ids);
          for (const it of f.items) if (set.has(it.id) && !it.locked) { it.x += dx; it.y += dy; }
        }),
        deleteItems: (floorId, ids) => mutateFloor(floorId, (f) => {
          const set = new Set(ids);
          f.items = f.items.filter((it) => !set.has(it.id));
          for (const it of f.items) if (it.dockedTo && set.has(it.dockedTo)) it.dockedTo = undefined;
          for (const g of f.groups) g.itemIds = g.itemIds.filter((i) => !set.has(i));
          f.groups = f.groups.filter((g) => g.itemIds.length > 1);
        }),

        groupItems: (floorId, ids) => {
          if (ids.length < 2) return null;
          const gid = newId('g_');
          mutateFloor(floorId, (f) => {
            const set = new Set(ids);
            // aus alten Gruppen entfernen
            for (const g of f.groups) g.itemIds = g.itemIds.filter((i) => !set.has(i));
            f.groups = f.groups.filter((g) => g.itemIds.length > 1);
            f.groups.push({ id: gid, itemIds: [...ids] });
            for (const it of f.items) if (set.has(it.id)) it.groupId = gid;
          });
          return gid;
        },
        ungroupItems: (floorId, groupIds) => mutateFloor(floorId, (f) => {
          const set = new Set(groupIds);
          f.groups = f.groups.filter((g) => !set.has(g.id));
          for (const it of f.items) if (it.groupId && set.has(it.groupId)) it.groupId = undefined;
        }),

        addVoid: (floorId, v) => mutateFloor(floorId, (f) => { f.voids.push(v); }),
        updateVoid: (floorId, id, patch) => mutateFloor(floorId, (f) => { const v = f.voids.find((x) => x.id === id); if (v) Object.assign(v, patch); }),
        deleteVoids: (floorId, ids) => mutateFloor(floorId, (f) => { const set = new Set(ids); f.voids = f.voids.filter((v) => !set.has(v.id)); }),
        addAnnotation: (floorId, a) => mutateFloor(floorId, (f) => { f.annotations.push(a); }),
        updateAnnotation: (floorId, id, patch) => mutateFloor(floorId, (f) => { const a = f.annotations.find((x) => x.id === id); if (a) Object.assign(a, patch as object); }),
        deleteAnnotations: (floorId, ids) => mutateFloor(floorId, (f) => { const set = new Set(ids); f.annotations = f.annotations.filter((a) => !set.has(a.id)); }),

        addCustomEquipment: (def) => mutate((p) => { p.customEquipment.push({ ...def, benutzerdefiniert: true }); }),
        updateCustomEquipment: (id, patch) => mutate((p) => { const d = p.customEquipment.find((x) => x.id === id); if (d) Object.assign(d, patch); }),
        deleteCustomEquipment: (id) => mutate((p) => { p.customEquipment = p.customEquipment.filter((x) => x.id !== id); }),
        toggleFavorite: (defId) => mutate((p) => {
          const i = p.favorites.indexOf(defId);
          if (i >= 0) p.favorites.splice(i, 1); else p.favorites.push(defId);
        }),
        setPriceOverride: (defId, price) => mutate((p) => {
          if (price == null) delete p.priceOverrides[defId]; else p.priceOverrides[defId] = price;
        }),

        deleteSelection: (floorId, sel) => mutateFloor(floorId, (f) => {
          const by = (k: string) => new Set(sel.filter((s) => s.kind === k).map((s) => s.id));
          const items = by('item');
          const walls = by('wall');
          const zones = by('zone');
          const openings = by('opening');
          const anns = by('annotation');
          const voids = by('void');
          if (items.size) {
            f.items = f.items.filter((it) => !items.has(it.id) || it.locked);
            for (const g of f.groups) g.itemIds = g.itemIds.filter((i) => !items.has(i));
            f.groups = f.groups.filter((g) => g.itemIds.length > 1);
          }
          if (walls.size) {
            f.walls = f.walls.filter((w) => !walls.has(w.id) || w.locked);
            f.openings = f.openings.filter((o) => !walls.has(o.wallId));
          }
          if (zones.size) f.zones = f.zones.filter((z) => !zones.has(z.id) || z.locked);
          if (openings.size) f.openings = f.openings.filter((o) => !openings.has(o.id) || o.locked);
          if (anns.size) f.annotations = f.annotations.filter((a) => !anns.has(a.id) || a.locked);
          if (voids.size) f.voids = f.voids.filter((v) => !voids.has(v.id));
        }),
      };
    },
    {
      limit: 200,
      partialize: (s) => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
    },
  ),
);

/** Undo/Redo-Zugriff (zundo). */
export const useTemporalStore = <T,>(selector: (s: ReturnType<typeof useProjectStore.temporal.getState>) => T) =>
  useTemporalSelector(selector);

import { useStoreWithEqualityFn } from 'zustand/traditional';
function useTemporalSelector<T>(selector: (s: ReturnType<typeof useProjectStore.temporal.getState>) => T): T {
  return useStoreWithEqualityFn(useProjectStore.temporal, selector);
}

export const undo = () => useProjectStore.temporal.getState().undo();
export const redo = () => useProjectStore.temporal.getState().redo();
export const clearHistory = () => useProjectStore.temporal.getState().clear();

/**
 * Fasst mehrere Mutationen zu einem Undo-Schritt zusammen (z. B. während eines Drags).
 * beginTransaction pausiert die Historie; endTransaction nimmt sie wieder auf und
 * legt genau einen Eintrag an.
 */
let txDepth = 0;
let txSnapshot: Project | null = null;
export function beginTransaction() {
  if (txDepth === 0) {
    txSnapshot = useProjectStore.getState().project;
    useProjectStore.temporal.getState().pause();
  }
  txDepth++;
}
export function endTransaction() {
  txDepth = Math.max(0, txDepth - 1);
  if (txDepth === 0) {
    const temporal = useProjectStore.temporal.getState();
    temporal.resume();
    const cur = useProjectStore.getState().project;
    if (txSnapshot && txSnapshot !== cur) {
      // Einen Historieneintrag erzeugen: kurz auf den Snapshot zurück und dann den Endzustand setzen.
      useProjectStore.setState({ project: txSnapshot });
      useProjectStore.setState({ project: cur });
    }
    txSnapshot = null;
  }
}
/** Führt fn als einen Undo-Schritt aus. */
export function transaction(fn: () => void) {
  beginTransaction();
  try { fn(); } finally { endTransaction(); }
}

/** Projekt laden und Historie leeren. */
export function loadProject(p: Project) {
  useProjectStore.setState({ project: p });
  clearHistory();
}
export function getActiveFloor(): Floor {
  const p = useProjectStore.getState().project;
  return p.floors.find((f) => f.id === p.activeFloorId) ?? p.floors[0];
}
export function newProjectFrom(p: Project, name: string, asVariant = false): Project {
  const c = cloneDeep(p);
  c.id = newId('p_');
  c.name = name;
  c.createdAt = new Date().toISOString();
  c.updatedAt = c.createdAt;
  if (asVariant) { c.parentId = p.parentId ?? p.id; c.variantName = name; } else { delete c.parentId; delete c.variantName; }
  return c;
}
export type { Vec2 };
