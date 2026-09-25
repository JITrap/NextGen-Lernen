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
  store: ProjectState;
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
