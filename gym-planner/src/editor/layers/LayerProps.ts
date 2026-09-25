import type { Floor, Room, Wall, PlacedItem, Project, Selection } from '@/types';
import type { Viewport } from '@/store/uiStore';
import type { BBox } from '@/geometry/polygon';

/** Gemeinsame Props aller Ebenen. Ebenen rendern eine Konva-<Group> in Weltkoordinaten (Stage ist bereits skaliert). */
export interface LayerProps {
  project: Project;
  floor: Floor;
  /** Alle Wände inkl. Hallen-Außenwände. */
  walls: Wall[];
  rooms: Room[];
  /** Sichtbare Objekte (inkl. verlinkter Treppen/Aufzüge). */
  items: PlacedItem[];
  /**
   * Maßstab für bildschirm-konstante Linienbreiten/Schriften (`1 / viewport.scale`). Der Canvas übergibt hier einen
   * gerasterten Maßstab (`renderScale`), der sich beim Pan gar nicht und beim Zoom nur in Stufen ändert, damit die
   * memoisierten Ebenen nicht je Frame neu rendern; x/y sind darin 0 – Ebenen zeichnen in Weltkoordinaten auf der
   * bereits verschobenen Stage und dürfen den Versatz nicht verwenden.
   */
  viewport: Viewport;
  selection: Selection[];
  hoverId: string | null;
  dark: boolean;
  /** Darunterliegendes Stockwerk (für LowerFloorLayer). */
  lowerFloor?: Floor | null;
  /** IDs kollidierender Objekte (rot markieren) – inkl. Kollisionsvorschau beim Ziehen. */
  collidingIds: Set<string>;
  /** Präsentationsmodus: keine Hilfslinien/Griffe. */
  presentation: boolean;
  /** Größe der Stage in Pixeln. */
  stageSize?: { width: number; height: number };
  /** Sichtbarer Weltbereich mit Rand (Culling der Objekt-Ebene); fehlt/null = alles rendern. */
  cullRect?: BBox | null;
  /** IDs transient gezogener Objekte (zeichnet `DragPreviewLayer`) – statische Ebenen lassen sie aus. */
  previewIds?: ReadonlySet<string> | null;
}
