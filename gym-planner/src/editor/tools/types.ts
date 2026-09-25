import type { ComponentType } from 'react';
import type Konva from 'konva';
import type { Floor, Project, Tool, Vec2, Wall, PlacedItem, Room } from '@/types';
import type { ProjectState } from '@/store/projectStore';
import type { UiState, Viewport } from '@/store/uiStore';
import type { SnapContext, SnapResult } from '@/geometry/snap';

export interface ToolEvent {
  /** Weltkoordinaten (cm), ungesnappt. */
  world: Vec2;
  /** Bildschirmkoordinaten relativ zur Stage (px). */
  screen: Vec2;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  button: number;
  /** Aktuell gedrückte Tasten (PointerEvent.buttons); undefined = unbekannt (z. B. Touch, Tests). 0 = keine Taste gedrückt. */
  buttons?: number;
  pointerType: string;
  evt: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>;
  /** Konva-Target (für Hit-Tests auf gerenderte Nodes). */
  target: Konva.Node;
}

export interface ToolContext {
  project: Project;
  floor: Floor;
  /** Alle Wände inkl. Hallen-Außenwände. */
  walls: Wall[];
  rooms: Room[];
  /** Sichtbare Objekte (inkl. verlinkter Treppen). */
  items: PlacedItem[];
  viewport: Viewport;
  /** Projekt-Store-Zustand (Momentaufnahme beim Ereignis; Aktionen sind stabil). */
  store: ProjectState;
  /** UI-Store-Zustand (Momentaufnahme beim Ereignis; Aktionen sind stabil). Für spätere Lesezugriffe useUiStore.getState() nutzen. */
  ui: UiState;
  /** Snapping mit Kontext (berücksichtigt Alt-Taste & Einstellungen). */
  snap: (p: Vec2, overrides?: Partial<SnapContext>) => SnapResult;
  /** Bildschirm-Pixel → Welt-cm für Schwellwerte. */
  pxToWorld: (px: number) => number;
  stageSize: { width: number; height: number };
}

export interface ToolHandler {
  id: Tool;
  /** CSS-Cursor über dem Canvas. */
  cursor?: string | ((ctx: ToolContext) => string);
  onPointerDown?: (e: ToolEvent, ctx: ToolContext) => void;
  onPointerMove?: (e: ToolEvent, ctx: ToolContext) => void;
  onPointerUp?: (e: ToolEvent, ctx: ToolContext) => void;
  onDoubleClick?: (e: ToolEvent, ctx: ToolContext) => void;
  /** Rechtsklick; true = verarbeitet, Kontextmenü wird nicht geöffnet. */
  onContextMenu?: (e: ToolEvent, ctx: ToolContext) => boolean | void;
  /** true = Ereignis verarbeitet (keine globale Weiterverarbeitung). */
  onKeyDown?: (e: KeyboardEvent, ctx: ToolContext) => boolean | void;
  /** Esc / Werkzeugwechsel. */
  onCancel?: (ctx: ToolContext) => void;
  onActivate?: (ctx: ToolContext) => void;
  /** Konva-Overlay (in der Overlay-Ebene gerendert, Weltkoordinaten). */
  Overlay?: ComponentType<{ ctx: ToolContext }>;
  /** HTML-Overlay über dem Canvas (z. B. numerische Eingabe). */
  HtmlOverlay?: ComponentType<{ ctx: ToolContext }>;
  /** Hinweistext für die Statusleiste. */
  hint?: string;
}

/** Bis zu diesem Bildschirmabstand (px) gelten zwei aufeinanderfolgende Klicks als Doppelklick. */
export const DBLCLICK_MAX_PX = 4;

export interface ClickTracker {
  /** Bei jedem Pointer-Down mit der Bildschirmposition aufrufen. */
  down: (screen: Vec2) => void;
  /** true, wenn die letzten beiden Pointer-Downs nahe beieinander lagen (echter Doppelklick, kein schneller Klick an anderer Stelle). */
  isDoubleClick: () => boolean;
  reset: () => void;
}

/**
 * Konva meldet `dblclick` rein zeitbasiert (zwei Klicks < 400 ms), auch an weit entfernten Punkten. Werkzeuge mit
 * Klick-Ketten (Wand, Hallen-/Zonen-Polygon) prüfen damit zusätzlich den Abstand der letzten beiden Klicks.
 */
export function createClickTracker(maxPx = DBLCLICK_MAX_PX): ClickTracker {
  let prev: Vec2 | null = null;
  let last: Vec2 | null = null;
  return {
    down: (screen) => {
      prev = last;
      last = screen;
    },
    isDoubleClick: () => !!prev && !!last && Math.hypot(prev.x - last.x, prev.y - last.y) <= maxPx,
    reset: () => {
      prev = null;
      last = null;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Koordinaten runden                                                  */
/* ------------------------------------------------------------------ */

/** Rundet eine Koordinate/Länge auf 4 Nachkommastellen (kein Gleitkomma-Rauschen wie 1000.0000000000001 im Projekt). */
export function roundCoord(v: number): number {
  const r = Math.round(v * 1e4) / 1e4;
  return r === 0 ? 0 : r;
}
/** Punkt gerundet; liefert dasselbe Objekt zurück, wenn nichts zu runden ist (keine unnötigen Store-Änderungen). */
export function roundVec(p: Vec2): Vec2 {
  const x = roundCoord(p.x);
  const y = roundCoord(p.y);
  return x === p.x && y === p.y ? p : { x, y };
}
/** Polygon gerundet; liefert dasselbe Array zurück, wenn kein Punkt geändert wurde. */
export function roundPolygon(poly: Vec2[]): Vec2[] {
  let changed = false;
  const out = poly.map((p) => {
    const q = roundVec(p);
    if (q !== p) changed = true;
    return q;
  });
  return changed ? out : poly;
}
