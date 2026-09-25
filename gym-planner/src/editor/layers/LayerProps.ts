import type { Floor, Room, Wall, PlacedItem, Project, Selection } from '@/types';
import type { Viewport } from '@/store/uiStore';

/** Gemeinsame Props aller Ebenen. Ebenen rendern eine Konva-<Group> in Weltkoordinaten (Stage ist bereits skaliert). */
export interface LayerProps {
  project: Project;
  floor: Floor;
  /** Alle Wände inkl. Hallen-Außenwände. */
  walls: Wall[];
  rooms: Room[];
  /** Sichtbare Objekte (inkl. verlinkter Treppen/Aufzüge). */
  items: PlacedItem[];
  viewport: Viewport;
  selection: Selection[];
  hoverId: string | null;
  dark: boolean;
  /** Darunterliegendes Stockwerk (für LowerFloorLayer). */
  lowerFloor?: Floor | null;
  /** IDs kollidierender Objekte (rot markieren). */
  collidingIds: Set<string>;
  /** Präsentationsmodus: keine Hilfslinien/Griffe. */
  presentation: boolean;
  /** Größe der Stage in Pixeln. */
  stageSize?: { width: number; height: number };
}
