import { useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Floor, Project, Room, PlacedItem, Wall } from '@/types';
import { useProjectStore } from './projectStore';
import { useUiStore } from './uiStore';
import { floorRooms } from '@/geometry/rooms';
import { allWalls } from '@/geometry/walls';

export function useProject() {
  return useProjectStore((s) => s.project);
}
export function useActiveFloor(): Floor {
  return useProjectStore((s) => s.project.floors.find((f) => f.id === s.project.activeFloorId) ?? s.project.floors[0]);
}
/**
 * Projekt für teure Panels (Analysen, Eigenschaften): während eines Zieh-Vorgangs (ui.dragging) bleibt der zuletzt
 * gesehene Stand eingefroren – Store-Änderungen je Bewegung (Wände, Öffnungen, Zonen …) lösen dann kein Rendern aus;
 * nach dem Loslassen kommt der aktuelle Stand. Objekte werden ohnehin transient gezogen (editor/dragPreview.ts).
 */
export function useProjectFrozenWhileDragging(): Project {
  const dragging = useUiStore((s) => s.dragging);
  const frozen = useRef<Project | null>(null);
  const project = useProjectStore((s) => (dragging && frozen.current ? frozen.current : s.project));
  if (!dragging) frozen.current = project;
  return project;
}
export function activeFloorOf(project: Project): Floor {
  return project.floors.find((f) => f.id === project.activeFloorId) ?? project.floors[0];
}
export function useSortedFloors(): Floor[] {
  return useProjectStore(useShallow((s) => [...s.project.floors].sort((a, b) => a.order - b.order)));
}
/** Stockwerk direkt unter dem aktiven (nach order). */
export function useLowerFloor(): Floor | null {
  return useProjectStore((s) => {
    const active = s.project.floors.find((f) => f.id === s.project.activeFloorId);
    if (!active) return null;
    const below = s.project.floors.filter((f) => f.order < active.order).sort((a, b) => b.order - a.order);
    return below[0] ?? null;
  });
}
export function useSettings() {
  return useProjectStore((s) => s.project.settings);
}
export function useLayers() {
  return useProjectStore((s) => s.project.layers);
}
/** Räume eines Stockwerks (memoisiert über Wände/Zonen/Halle/Meta). */
export function useFloorRooms(floor: Floor): Room[] {
  // Bewusst nur die geometrie-relevanten Felder als Abhängigkeiten (Objekte/Anmerkungen ändern keine Räume).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => floorRooms(floor), [floor.walls, floor.zones, floor.hall, floor.roomMeta]);
}
/** Alle Wände inkl. Hallen-Außenwände (memoisiert). */
export function useFloorWalls(floor: Floor): Wall[] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => allWalls(floor), [floor.walls, floor.hall]);
}
/**
 * Objekte, die auf diesem Stockwerk sichtbar sind: eigene + Treppen/Aufzüge anderer Stockwerke,
 * die mit diesem verbunden sind (linkedFloorIds).
 */
export function floorVisibleItems(floor: Floor, all: Floor[]): PlacedItem[] {
  const own = floor.items;
  const linked: PlacedItem[] = [];
  for (const f of all) {
    if (f.id === floor.id) continue;
    for (const it of f.items) if (it.linkedFloorIds?.includes(floor.id)) linked.push({ ...it, locked: true, params: { ...(it.params ?? {}), __linkedFrom: f.id } });
  }
  return linked.length ? [...own, ...linked] : own;
}
export function useFloorVisibleItems(floor: Floor): PlacedItem[] {
  const floors = useProjectStore((s) => s.project.floors);
  return useMemo(() => floorVisibleItems(floor, floors), [floor, floors]);
}
