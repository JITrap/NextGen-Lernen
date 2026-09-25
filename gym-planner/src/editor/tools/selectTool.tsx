/**
 * Auswahl-/Bearbeitungswerkzeug.
 * - Klick/Shift+Klick/Marquee (Rahmen), Gruppen-Auswahl, Doppelklick
 * - Ziehen von Objekten (Snapping, Rack-Andocken, Wandmontage, Abstandsanzeige), Drehen (Griff, 15°),
 *   Skalieren (nur skalierbare Objekte), Hallen-Ecken/-Kanten, Wände (parallel + Nachbarn, Endknoten),
 *   Öffnungen entlang der Wand (inkl. Umhängen), Zonen-/Luftraum-Ecken, Anmerkungen, Messlinien-Enden
 * - Numerische Längeneingabe (Hallenkante/Wand) und Inline-Textbearbeitung als HTML-Overlay
 *
 * Griffe werden nicht über Konva-Events erkannt, sondern per Abstand zum Weltpunkt (`handleAt`), die
 * Griffpositionen liefert `selectionHandles` aus der Auswahl-Ebene. Alle Änderungen laufen über den Store;
 * ein Zieh-Vorgang ist genau ein Undo-Schritt (beginTransaction … endTransaction).
 */
import { useEffect, useRef, useState } from 'react';
import { Group, Line, Rect } from 'react-konva';
import type { Vec2, PlacedItem, Wall, Selection, Floor, Annotation, Opening, Project, MeasureLine } from '@/types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import type { ToolContext, ToolEvent } from './types';
import { hitTest } from '../hitTest';
import { selectionHandles, selectedItemsOf, itemsBounds, isItemScalable, type Handle } from '../layers/SelectionLayer';
import { DimensionLine, DimText, dimPalette } from '../layers/DimensionsLayer';
import { worldToScreen } from '../viewport';
import { useSnapGuides } from '../overlays/SnapGuides';
import { useProjectStore, beginTransaction, endTransaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { useIsDark } from '@/hooks/useTheme';
import { getDef } from '@/data/equipment';
import {
  snapItemPosition, snapToWallSide, dockToRack, nearestDistances, snapRotation, type SnapContext, type NearestDistance,
} from '@/geometry/snap';
import { itemFootprint, worldToLocal, localToWorld } from '@/geometry/transform';
import { pointInPolygon, translatePolygon, rotateAround, distance, sub, type BBox } from '@/geometry/polygon';
import { convexPolygonsOverlap } from '@/geometry/collision';
import {
  moveWallWithNeighbors, moveWallNode, projectOntoWall, nearestWall, clampOpeningOffset, findWall, isHallWallId, wallLength,
  hallInnerPolygon, hallWalls, WALL_NODE_TOL, wallMidpoint,
} from '@/geometry/walls';
import { formatDegrees, formatLength, parseLength, normalizeAngle } from '@/geometry/units';
import { setWallLength, setHallEdgeLength, clampOpeningsOnWalls, setTextAnnotation } from '../actions';

/* ------------------------------------------------------------------ */
/* Konstanten                                                          */
/* ------------------------------------------------------------------ */

/** Ab dieser Bewegung (px) beginnt ein Zieh-Vorgang bzw. ein Rahmen. */
export const DRAG_THRESHOLD_PX = 4;
/** Drehgriff: Winkelschritt (Grad), Shift = frei. */
export const ROTATE_STEP_DEG = 15;
/** Kleinste Kantenlänge beim Skalieren (cm). */
export const MIN_SCALE_SIZE_CM = 10;
/** Öffnung wird auf eine andere Wand umgehängt, wenn der Cursor weiter als so viele cm von der eigenen Achse entfernt ist … */
export const OPENING_DETACH_CM = 30;
/** … und die nächste andere Wand innerhalb dieses Abstands (cm) liegt. */
export const OPENING_ATTACH_CM = 30;
/** Fangradius für Wandmontage-Objekte (cm). */
export const WALL_MOUNT_RANGE_CM = 40;
/** Fangradius für Rack-Module (cm). */
export const RACK_DOCK_RANGE_CM = 150;

/* ------------------------------------------------------------------ */
/* Reine Hilfsfunktionen (testbar)                                     */
/* ------------------------------------------------------------------ */

export type MarqueeMode = 'contain' | 'touch';

/** Rechteck aus zwei Punkten (beliebige Reihenfolge). */
export function marqueeRect(a: Vec2, b: Vec2): BBox {
  return { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
}
/** Von links nach rechts aufgezogen: nur vollständig enthaltene Objekte; von rechts nach links: Berührung reicht. */
export function marqueeMode(start: Vec2, end: Vec2): MarqueeMode {
  return end.x < start.x ? 'touch' : 'contain';
}
/** IDs der (sichtbaren) Objekte, die der Rahmen wählt. */
export function marqueeSelect(rect: BBox, items: PlacedItem[], mode: MarqueeMode): string[] {
  const out: string[] = [];
  if (!(rect.maxX > rect.minX) && !(rect.maxY > rect.minY)) return out;
  const poly: Vec2[] = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];
  for (const it of items) {
    if (it.hidden) continue;
    const fp = itemFootprint(it);
    if (mode === 'contain') {
      if (fp.every((p) => p.x >= rect.minX - 1e-6 && p.x <= rect.maxX + 1e-6 && p.y >= rect.minY - 1e-6 && p.y <= rect.maxY + 1e-6)) out.push(it.id);
    } else if (convexPolygonsOverlap(fp, poly, -1e-6) || fp.some((p) => pointInPolygon(p, poly)) || poly.some((p) => pointInPolygon(p, fp))) out.push(it.id);
  }
  return out;
}

/** Nächster Griff innerhalb der Toleranz (Weltkoordinaten); Drehgriff gewinnt bei Gleichstand. */
export function handleAt(world: Vec2, handles: Handle[], tolerance: number): Handle | null {
  let best: Handle | null = null;
  let bestD = Infinity;
  for (const h of handles) {
    const d = distance(world, h);
    const limit = Math.max(h.r * 1.5, tolerance);
    if (d > limit) continue;
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && h.kind === 'rotate')) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

export function isSelected(selection: Selection[], s: Selection): boolean {
  return selection.some((x) => x.kind === s.kind && x.id === s.id);
}
/** Vereinigt Auswahlen ohne Duplikate (Reihenfolge bleibt). */
export function mergeSelection(current: Selection[], add: Selection[]): Selection[] {
  const out = current.slice();
  for (const s of add) if (!isSelected(out, s)) out.push(s);
  return out;
}
export function removeFromSelection(current: Selection[], s: Selection): Selection[] {
  return current.filter((x) => !(x.kind === s.kind && x.id === s.id));
}

/** Auswahl beim Klick auf ein Objekt: alle Mitglieder seiner Gruppe (sichtbar) oder das Objekt allein. */
export function groupMembers(itemId: string, floor: Pick<Floor, 'groups'>, items: PlacedItem[]): Selection[] {
  const it = items.find((x) => x.id === itemId);
  if (!it) return [{ kind: 'item', id: itemId }];
  if (!it.groupId) return [{ kind: 'item', id: it.id }];
  const g = floor.groups.find((x) => x.id === it.groupId);
  if (!g) return [{ kind: 'item', id: it.id }];
  const visible = new Set(items.filter((x) => !x.hidden).map((x) => x.id));
  const sel: Selection[] = g.itemIds.filter((id) => visible.has(id)).map((id) => ({ kind: 'item', id }) as Selection);
  return isSelected(sel, { kind: 'item', id: it.id }) ? sel : [...sel, { kind: 'item', id: it.id }];
}

/** Drehwinkel (Grad) zwischen Start- und aktuellem Zeiger um ein Zentrum, optional auf `step` gerastert. */
export function rotationDelta(center: Vec2, start: Vec2, current: Vec2, snap: boolean, step = ROTATE_STEP_DEG): number {
  const a0 = Math.atan2(start.y - center.y, start.x - center.x);
  const a1 = Math.atan2(current.y - center.y, current.x - center.x);
  let deg = ((a1 - a0) * 180) / Math.PI;
  if (deg > 180) deg -= 360;
  if (deg < -180) deg += 360;
  return snap ? snapRotation(deg, step) : deg;
}

/** Dreht ein Objekt um `center` (Position + Drehung) – reine Funktion für Mehrfachdrehung. */
export function rotatedItem<T extends Pick<PlacedItem, 'x' | 'y' | 'rotation'>>(orig: T, center: Vec2, deg: number): { x: number; y: number; rotation: number } {
  const p = rotateAround({ x: orig.x, y: orig.y }, center, deg);
  return { x: p.x, y: p.y, rotation: normalizeAngle(orig.rotation + deg) };
}

type ItemGeom = Pick<PlacedItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>;

/**
 * Neue Maße/Position beim Ziehen eines Skaliergriffs: die gegenüberliegende Kante bleibt fest,
 * `local` = Zeigerposition in lokalen Objektkoordinaten (relativ zum ursprünglichen Objekt).
 * `grid` > 0 rastert die Maße; Mindestmaß `minSize`.
 */
export function scaleFromHandle(orig: ItemGeom, sx: -1 | 0 | 1, sy: -1 | 0 | 1, local: Vec2, minSize = MIN_SCALE_SIZE_CM, grid = 0): ItemGeom {
  const hw = orig.width / 2;
  const hd = orig.depth / 2;
  let width = orig.width;
  let depth = orig.depth;
  let cx = 0;
  let cy = 0;
  const round = (v: number) => (grid > 0 ? Math.round(v / grid) * grid : v);
  if (sx) {
    const fixed = -sx * hw;
    width = Math.max(minSize, round(sx * (local.x - fixed)));
    cx = fixed + (sx * width) / 2;
  }
  if (sy) {
    const fixed = -sy * hd;
    depth = Math.max(minSize, round(sy * (local.y - fixed)));
    cy = fixed + (sy * depth) / 2;
  }
  const c = localToWorld({ x: cx, y: cy }, orig);
  return { x: c.x, y: c.y, width, depth, rotation: orig.rotation };
}

/** Verschiebung senkrecht zu einer Kante (Anteil von `delta` entlang der Kantennormalen). */
export function normalShift(a: Vec2, b: Vec2, delta: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: delta.x, y: delta.y };
  const nx = -dy / len;
  const ny = dx / len;
  const t = delta.x * nx + delta.y * ny;
  return { x: nx * t, y: ny * t };
}

/** Neuer Wandbezug einer Öffnung beim Ziehen: eigene Wand oder – weit genug entfernt – die nächste andere Wand. */
export function openingDragTarget(
  world: Vec2,
  opening: Pick<Opening, 'wallId' | 'width'>,
  walls: Wall[],
  detachCm = OPENING_DETACH_CM,
  attachCm = OPENING_ATTACH_CM,
): { wallId: string; offset: number } | null {
  const own = walls.find((w) => w.id === opening.wallId);
  if (!own) return null;
  const pr = projectOntoWall(own, world);
  if (pr.distance > detachCm) {
    const other = nearestWall(walls.filter((w) => w.id !== own.id && !w.hidden), world, attachCm);
    if (other && wallLength(other.wall) >= 1) return { wallId: other.wall.id, offset: clampOpeningOffset(other.offset, opening.width, other.wall) };
  }
  return { wallId: own.id, offset: clampOpeningOffset(pr.offset, opening.width, own) };
}

/** Wände, die einen Endpunkt an `node` haben (für ignoreIds beim Snapping). */
export function wallsAtNode(walls: Wall[], node: Vec2): Set<string> {
  const out = new Set<string>();
  for (const w of walls) if (distance(w.start, node) < WALL_NODE_TOL || distance(w.end, node) < WALL_NODE_TOL) out.add(w.id);
  return out;
}

/** Bewegbar per Ziehen (Cursor „move“)? */
export function isMovableHit(hit: Selection, floor: Floor, items: PlacedItem[]): boolean {
  switch (hit.kind) {
    case 'item': {
      const it = items.find((x) => x.id === hit.id);
      return !!it && !it.locked;
    }
    case 'wall': {
      const w = floor.walls.find((x) => x.id === hit.id);
      return !!w && !w.locked;
    }
    case 'zone': {
      const z = floor.zones.find((x) => x.id === hit.id);
      return !!z && !z.locked;
    }
    case 'opening': {
      const o = floor.openings.find((x) => x.id === hit.id);
      return !!o && !o.locked;
    }
    case 'annotation': {
      const a = floor.annotations.find((x) => x.id === hit.id);
      return !!a && !a.locked;
    }
    case 'void':
    case 'hallVertex':
    case 'hallEdge':
      return true;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Transienter Zustand (reaktiv für Overlays)                          */
/* ------------------------------------------------------------------ */

export interface LengthInputState {
  kind: 'hallEdge' | 'wall';
  id: string;
  /** Weltposition des Eingabefelds (Kantenmitte). */
  world: Vec2;
  initial: string;
}
export interface TextEditState {
  id: string;
  world: Vec2;
  initial: string;
  fontSize: number;
}
interface SelectToolState {
  marquee: { start: Vec2; end: Vec2 } | null;
  distances: NearestDistance[];
  rotate: { center: Vec2; angle: number; radiusCm: number } | null;
  lengthInput: LengthInputState | null;
  textEdit: TextEditState | null;
  cursor: string;
  dragging: boolean;
}
export const useSelectTool = createToolStore<SelectToolState>({
  marquee: null,
  distances: [],
  rotate: null,
  lengthInput: null,
  textEdit: null,
  cursor: 'default',
  dragging: false,
});

type DragMode =
  | 'none' | 'marquee' | 'move' | 'rotate' | 'scale' | 'hallVertex' | 'hallEdge' | 'wallMove' | 'wallNode'
  | 'opening' | 'zoneVertex' | 'voidVertex' | 'measureEnd';

interface DragState {
  mode: DragMode;
  startWorld: Vec2;
  startScreen: Vec2;
  active: boolean;
  tx: boolean;
  floorId: string;
  /** Projektstand vor dem Ziehen (für Abbruch per Esc). */
  snapshot: Project | null;
  /** Shift-Klick auf bereits gewähltes Element: beim Loslassen ohne Bewegung abwählen. */
  toggleOff?: Selection;
  /* move */
  primary?: PlacedItem;
  itemOrig?: Map<string, PlacedItem>;
  polyOrig?: Map<string, Vec2[]>;
  voidOrigs?: Map<string, Vec2[]>;
  annOrig?: Map<string, Annotation>;
  ignoreIds?: Set<string>;
  /* rotate / scale */
  center?: Vec2;
  rotOrig?: Map<string, PlacedItem>;
  handle?: Handle;
  scaleOrig?: PlacedItem;
  /* Halle */
  hallOrig?: Vec2[];
  index?: number;
  /* Wände */
  wallsOrig?: Wall[];
  wallId?: string;
  node?: Vec2;
  floorAtStart?: Floor;
  /* Öffnung */
  openingOrig?: Opening;
  /* Polygon-Ecke / Messlinie */
  polyId?: string;
  vertexOrig?: Vec2[];
  measureOrig?: MeasureLine;
}

let drag: DragState | null = null;

/** Nur für Tests: aktueller Zieh-Zustand (Modus/aktiv). */
export function debugDragState(): { mode: DragMode; active: boolean } | null {
  return drag ? { mode: drag.mode, active: drag.active } : null;
}

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

function snapCtxFor(ctx: ToolContext, e: ToolEvent, ignoreIds?: Set<string>, extra: Partial<SnapContext> = {}): SnapContext {
  const settings = ctx.project.settings;
  return {
    gridSize: settings.gridSize,
    enabled: settings.snapEnabled && !ctx.ui.snapOverride && !e.alt,
    threshold: ctx.pxToWorld(8),
    walls: ctx.walls,
    items: ctx.items,
    hall: ctx.floor.hall,
    ignoreIds,
    ...extra,
  };
}

function hitAt(e: ToolEvent, ctx: ToolContext, tol: number): Selection | null {
  return hitTest(e.world, { floor: ctx.floor, walls: ctx.walls, rooms: ctx.rooms, items: ctx.items, tolerance: tol, layers: ctx.project.layers });
}

function handlesFor(ctx: ToolContext, selection: Selection[]): Handle[] {
  return selectionHandles(selection, { floor: ctx.floor, items: ctx.items, project: ctx.project }, ctx.viewport.scale);
}

function toleranceFor(e: ToolEvent, ctx: ToolContext): number {
  return ctx.pxToWorld(e.pointerType === 'touch' ? 14 : 6);
}

/** Echte Wände des Stockwerks (ohne Hallenwände) – für Abstände/Snapping. */
function realWalls(ctx: ToolContext): Wall[] {
  return ctx.floor.walls;
}

function currentFloor(): Floor {
  const p = useProjectStore.getState().project;
  return p.floors.find((f) => f.id === p.activeFloorId) ?? p.floors[0];
}

function beginDragTx() {
  if (!drag || drag.tx) return;
  drag.snapshot = useProjectStore.getState().project;
  beginTransaction();
  drag.tx = true;
  useSelectTool.getState().patch({ dragging: true });
}

function finishDrag(commit: boolean) {
  if (!drag) return;
  if (drag.tx) {
    if (!commit && drag.snapshot) useProjectStore.setState({ project: drag.snapshot });
    endTransaction();
  }
  drag = null;
  useSnapGuides.getState().set(null);
  useSelectTool.getState().patch({ marquee: null, distances: [], rotate: null, dragging: false, cursor: 'default' });
}

function racksOf(ctx: ToolContext, exclude: Set<string>): PlacedItem[] {
  const out: PlacedItem[] = [];
  for (const it of ctx.items) {
    if (it.hidden || exclude.has(it.id)) continue;
    const sym = getDef(it.defId, ctx.project)?.symbol;
    if (sym === 'rack' || sym === 'half-rack') out.push(it);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pointer down                                                        */
/* ------------------------------------------------------------------ */

function baseDrag(e: ToolEvent, ctx: ToolContext, mode: DragMode): DragState {
  return { mode, startWorld: e.world, startScreen: e.screen, active: false, tx: false, floorId: ctx.floor.id, snapshot: null };
}

function startHandleDrag(h: Handle, e: ToolEvent, ctx: ToolContext) {
  const floor = ctx.floor;
  const selection = ctx.ui.selection;
  switch (h.kind) {
    case 'rotate': {
      const items = selectedItemsOf(selection, ctx.items).filter((it) => !it.locked && floor.items.some((x) => x.id === it.id));
      if (!items.length) return;
      const all = selectedItemsOf(selection, ctx.items);
      const box = itemsBounds(all);
      if (!box) return;
      const center = items.length === 1 && all.length === 1 ? { x: items[0].x, y: items[0].y } : { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
      const d = baseDrag(e, ctx, 'rotate');
      d.center = center;
      d.rotOrig = new Map(items.map((it) => [it.id, it]));
      drag = d;
      return;
    }
    case 'scale': {
      const it = floor.items.find((x) => x.id === h.id);
      if (!it || it.locked || !isItemScalable(it, ctx.project)) return;
      const d = baseDrag(e, ctx, 'scale');
      d.handle = h;
      d.scaleOrig = it;
      drag = d;
      return;
    }
    case 'wallNode': {
      const w = floor.walls.find((x) => x.id === h.id);
      if (!w || w.locked) return;
      const d = baseDrag(e, ctx, 'wallNode');
      d.wallsOrig = floor.walls;
      d.node = h.index ? w.end : w.start;
      d.floorAtStart = floor;
      drag = d;
      return;
    }
    case 'hallVertex': {
      if (!floor.hall) return;
      const d = baseDrag(e, ctx, 'hallVertex');
      d.hallOrig = floor.hall.polygon;
      d.index = h.index;
      drag = d;
      return;
    }
    case 'zoneVertex':
    case 'voidVertex': {
      const poly = h.kind === 'zoneVertex' ? floor.zones.find((x) => x.id === h.id)?.polygon : floor.voids.find((x) => x.id === h.id)?.polygon;
      if (!poly) return;
      const d = baseDrag(e, ctx, h.kind);
      d.polyId = h.id;
      d.index = h.index;
      d.vertexOrig = poly;
      drag = d;
      return;
    }
    case 'measureEnd': {
      const a = floor.annotations.find((x) => x.id === h.id);
      if (!a || a.kind !== 'measure' || a.locked) return;
      const d = baseDrag(e, ctx, 'measureEnd');
      d.measureOrig = a;
      d.index = h.index;
      drag = d;
      return;
    }
    default:
      return;
  }
}

/** Bereitet das Verschieben der (frischen) Auswahl vor: Objekte, Zonen, Lufträume, Anmerkungen. */
function prepareMoveDrag(e: ToolEvent, ctx: ToolContext, hit: Selection) {
  const floor = ctx.floor;
  const selection = ctx.ui.selection;
  const d = baseDrag(e, ctx, 'move');
  const itemOrig = new Map<string, PlacedItem>();
  const polyOrig = new Map<string, Vec2[]>();
  const voidOrigs = new Map<string, Vec2[]>();
  const annOrig = new Map<string, Annotation>();
  const ownIds = new Set(floor.items.map((it) => it.id));
  for (const s of selection) {
    switch (s.kind) {
      case 'item': {
        const it = ctx.items.find((x) => x.id === s.id);
        if (it && !it.locked && ownIds.has(it.id)) itemOrig.set(it.id, it);
        break;
      }
      case 'zone': {
        const z = floor.zones.find((x) => x.id === s.id);
        if (z && !z.locked) polyOrig.set(z.id, z.polygon);
        break;
      }
      case 'void': {
        const v = floor.voids.find((x) => x.id === s.id);
        if (v) voidOrigs.set(v.id, v.polygon);
        break;
      }
      case 'annotation': {
        const a = floor.annotations.find((x) => x.id === s.id);
        if (a && !a.locked) annOrig.set(a.id, a);
        break;
      }
      default:
        break;
    }
  }
  // Angedockte Rack-Module folgen ihrem Rack
  if (itemOrig.size) {
    for (const it of floor.items) {
      if (it.dockedTo && !it.locked && !itemOrig.has(it.id) && itemOrig.has(it.dockedTo)) itemOrig.set(it.id, it);
    }
  }
  if (!itemOrig.size && !polyOrig.size && !voidOrigs.size && !annOrig.size) {
    d.mode = 'none';
    drag = d;
    return d;
  }
  const primary = hit.kind === 'item' ? itemOrig.get(hit.id) : undefined;
  d.primary = primary ?? (itemOrig.size ? itemOrig.values().next().value : undefined);
  d.itemOrig = itemOrig;
  d.polyOrig = polyOrig;
  d.voidOrigs = voidOrigs;
  d.annOrig = annOrig;
  d.ignoreIds = new Set(itemOrig.keys());
  drag = d;
  return d;
}

function onPointerDown(e: ToolEvent, ctx: ToolContext) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const st = useSelectTool.getState();
  if (st.lengthInput || st.textEdit) st.patch({ lengthInput: null, textEdit: null });
  if (drag) finishDrag(true);
  const ui = ctx.ui;
  const floor = ctx.floor;
  const tol = toleranceFor(e, ctx);

  // 1) Griffe der aktuellen Auswahl
  const h = handleAt(e.world, handlesFor(ctx, ui.selection), tol);
  if (h) {
    startHandleDrag(h, e, ctx);
    if (drag) return;
  }

  // 2) Treffer unter dem Zeiger
  const hit = hitAt(e, ctx, tol);
  if (!hit) {
    if (!e.shift) ui.clearSelection();
    drag = baseDrag(e, ctx, 'marquee');
    return;
  }
  const target: Selection[] = hit.kind === 'item' ? groupMembers(hit.id, floor, ctx.items) : [hit];
  const already = isSelected(ui.selection, hit);
  let toggleOff: Selection | undefined;
  if (e.shift) {
    if (already) toggleOff = hit;
    else ui.setSelection(mergeSelection(ui.selection, target));
  } else if (!already) {
    ui.setSelection(target);
  }
  // Frische Auswahl (setSelection ist synchron, ctx.ui.selection kann noch alt sein)
  const freshCtx: ToolContext = { ...ctx, ui: { ...ctx.ui, selection: freshSelection() } };

  let d: DragState;
  switch (hit.kind) {
    case 'item':
    case 'zone':
    case 'void':
    case 'annotation':
      d = prepareMoveDrag(e, freshCtx, hit);
      break;
    case 'wall': {
      const w = floor.walls.find((x) => x.id === hit.id);
      d = baseDrag(e, ctx, w && !w.locked && !isHallWallId(w.id) ? 'wallMove' : 'none');
      if (d.mode === 'wallMove') {
        d.wallId = hit.id;
        d.wallsOrig = floor.walls;
        d.floorAtStart = floor;
      }
      break;
    }
    case 'opening': {
      const o = floor.openings.find((x) => x.id === hit.id);
      d = baseDrag(e, ctx, o && !o.locked ? 'opening' : 'none');
      d.openingOrig = o;
      break;
    }
    case 'hallVertex':
    case 'hallEdge': {
      const idx = Number(hit.id);
      const ok = !!floor.hall && Number.isInteger(idx) && idx >= 0 && idx < floor.hall.polygon.length;
      d = baseDrag(e, ctx, ok ? hit.kind : 'none');
      d.hallOrig = floor.hall?.polygon;
      d.index = idx;
      break;
    }
    default:
      d = baseDrag(e, ctx, 'none');
  }
  d.toggleOff = toggleOff;
  drag = d;
}

/** Aktuelle Auswahl direkt aus dem UI-Store (nach setSelection im selben Tick). */
function freshSelection(): Selection[] {
  return useUiStore.getState().selection;
}

/* ------------------------------------------------------------------ */
/* Pointer move                                                        */
/* ------------------------------------------------------------------ */

function updateHover(e: ToolEvent, ctx: ToolContext) {
  const st = useSelectTool.getState();
  const tol = toleranceFor(e, ctx);
  let cursor = 'default';
  let hover: string | null = null;
  const h = handleAt(e.world, handlesFor(ctx, ctx.ui.selection), tol);
  if (h) cursor = h.cursor;
  else {
    const hit = hitAt(e, ctx, tol);
    if (hit) {
      if (hit.kind === 'item') hover = hit.id;
      if (isMovableHit(hit, ctx.floor, ctx.items)) cursor = 'move';
    }
  }
  if (e.pointerType !== 'touch' && ctx.ui.hoverId !== hover) ctx.ui.setHover(hover);
  if (st.cursor !== cursor) st.patch({ cursor });
}

function moveSelection(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const s = useProjectStore.getState();
  const fid = d.floorId;
  let dx = e.world.x - d.startWorld.x;
  let dy = e.world.y - d.startWorld.y;
  const primary = d.primary;
  const ignore = d.ignoreIds ?? new Set<string>();
  let primaryPatch: Partial<PlacedItem> | null = null;
  if (primary) {
    const desired = { x: primary.x + dx, y: primary.y + dy };
    const sctx = snapCtxFor(ctx, e, ignore);
    const res = snapItemPosition(primary, desired, sctx);
    useSnapGuides.getState().set(res);
    dx = res.point.x - primary.x;
    dy = res.point.y - primary.y;
    // Einzelnes Objekt: Rack-Modul andocken / Wandmontage
    if (d.itemOrig && d.itemOrig.size === 1) {
      const def = getDef(primary.defId, ctx.project);
      if (def?.nur_an_rack) {
        const dock = dockToRack({ ...primary, x: res.point.x, y: res.point.y }, racksOf(ctx, ignore), RACK_DOCK_RANGE_CM);
        primaryPatch = dock ? { x: dock.x, y: dock.y, rotation: dock.rotation, dockedTo: dock.dockedTo } : { dockedTo: undefined };
      } else if (def?.wandmontage) {
        const ws = snapToWallSide({ ...primary, x: res.point.x, y: res.point.y }, ctx.walls, WALL_MOUNT_RANGE_CM);
        primaryPatch = ws ? { x: ws.x, y: ws.y, rotation: ws.rotation, wallId: ws.wallId } : { wallId: undefined };
      }
    }
  } else if (ctx.project.settings.snapEnabled && !ctx.ui.snapOverride && !e.alt) {
    const g = ctx.project.settings.gridSize;
    if (g > 0) {
      dx = Math.round(dx / g) * g;
      dy = Math.round(dy / g) * g;
    }
  }
  if (d.itemOrig?.size) {
    const orig = d.itemOrig;
    s.updateItems(fid, [...orig.keys()], (it) => {
      const o = orig.get(it.id);
      if (!o) return;
      it.x = o.x + dx;
      it.y = o.y + dy;
      if (primaryPatch && primary && it.id === primary.id) {
        if (primaryPatch.x != null && primaryPatch.y != null) {
          it.x = primaryPatch.x;
          it.y = primaryPatch.y;
        }
        if (primaryPatch.rotation != null) it.rotation = primaryPatch.rotation;
        if ('dockedTo' in primaryPatch) it.dockedTo = primaryPatch.dockedTo;
        if ('wallId' in primaryPatch) it.wallId = primaryPatch.wallId;
      }
    });
  }
  if (d.polyOrig) for (const [id, poly] of d.polyOrig) s.updateZone(fid, id, { polygon: translatePolygon(poly, dx, dy) });
  if (d.voidOrigs) for (const [id, poly] of d.voidOrigs) s.updateVoid(fid, id, { polygon: translatePolygon(poly, dx, dy) });
  if (d.annOrig) {
    for (const [id, a] of d.annOrig) {
      if (a.kind === 'text') s.updateAnnotation(fid, id, { x: a.x + dx, y: a.y + dy });
      else s.updateAnnotation(fid, id, { start: { x: a.start.x + dx, y: a.start.y + dy }, end: { x: a.end.x + dx, y: a.end.y + dy } });
    }
  }
  // Abstände zum nächsten Hindernis (für das primäre Objekt)
  if (primary) {
    const now = primaryPatch && primaryPatch.x != null && primaryPatch.y != null
      ? { ...primary, x: primaryPatch.x, y: primaryPatch.y, rotation: primaryPatch.rotation ?? primary.rotation }
      : { ...primary, x: primary.x + dx, y: primary.y + dy };
    const hall = ctx.floor.hall;
    const dist = nearestDistances(now, ctx.items, realWalls(ctx), { hallInner: hall ? hallInnerPolygon(hall) : null, ignoreIds: ignore, maxDist: 1500 });
    useSelectTool.getState().patch({ distances: dist });
  }
}

function rotateDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  if (!d.center || !d.rotOrig) return;
  const deg = rotationDelta(d.center, d.startWorld, e.world, !e.shift);
  const s = useProjectStore.getState();
  const orig = d.rotOrig;
  const single = orig.size === 1;
  s.updateItems(d.floorId, [...orig.keys()], (it) => {
    const o = orig.get(it.id);
    if (!o) return;
    if (single) it.rotation = normalizeAngle(o.rotation + deg);
    else {
      const r = rotatedItem(o, d.center!, deg);
      it.x = r.x;
      it.y = r.y;
      it.rotation = r.rotation;
    }
  });
  const box = itemsBounds([...orig.values()]);
  const radius = box ? Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2 : 0;
  useSelectTool.getState().patch({ rotate: { center: d.center, angle: deg, radiusCm: radius + ctx.pxToWorld(36) } });
}

function scaleDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const h = d.handle;
  const o = d.scaleOrig;
  if (!h || !o || h.sx === undefined || h.sy === undefined) return;
  const local = worldToLocal(e.world, o);
  const snapOn = ctx.project.settings.snapEnabled && !ctx.ui.snapOverride && !e.alt;
  const g = snapOn ? ctx.project.settings.gridSize : 0;
  const r = scaleFromHandle(o, h.sx, h.sy, local, MIN_SCALE_SIZE_CM, g);
  useProjectStore.getState().updateItem(d.floorId, o.id, { x: r.x, y: r.y, width: r.width, depth: r.depth });
}

function hallVertexDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const poly = d.hallOrig;
  const idx = d.index;
  if (!poly || idx == null || !ctx.floor.hall) return;
  const others = poly.filter((_, i) => i !== idx);
  const res = ctx.snap(e.world, { hall: others.length >= 3 ? { ...ctx.floor.hall, polygon: others } : null, ignoreIds: new Set(poly.map((_, i) => `hall_${i}`)) });
  useSnapGuides.getState().set(res);
  const next = poly.map((p, i) => (i === idx ? res.point : p));
  applyHallPolygon(ctx, d, next);
}

/** Setzt das Hallenpolygon und hält Öffnungen an den (virtuellen) Außenwänden innerhalb der neuen Kantenlängen. */
function applyHallPolygon(ctx: ToolContext, d: DragState, polygon: Vec2[]) {
  const hall = ctx.floor.hall;
  if (!hall) return;
  useProjectStore.getState().updateHall(d.floorId, (h) => { h.polygon = polygon; });
  clampOpeningsOnWalls(ctx.floor, hallWalls({ ...hall, polygon }));
}

function hallEdgeDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const poly = d.hallOrig;
  const idx = d.index;
  if (!poly || idx == null || !ctx.floor.hall) return;
  const n = poly.length;
  const a = poly[idx];
  const b = poly[(idx + 1) % n];
  const shift = normalShift(a, b, sub(e.world, d.startWorld));
  // Rastern: verschobenen Anfangspunkt fangen (ohne die Halle selbst), dann Verschiebung erneut auf die Normale projizieren
  const res = ctx.snap({ x: a.x + shift.x, y: a.y + shift.y }, { hall: null, angleFrom: null, ignoreIds: new Set(poly.map((_, i) => `hall_${i}`)), targets: { 'wall-mid': false, 'item-edge': false } });
  useSnapGuides.getState().set(res.kind === 'grid' ? null : res);
  const fin = normalShift(a, b, sub(res.point, a));
  const next = poly.map((p, i) => (i === idx || i === (idx + 1) % n ? { x: p.x + fin.x, y: p.y + fin.y } : p));
  applyHallPolygon(ctx, d, next);
}

function wallMoveDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const walls = d.wallsOrig;
  const id = d.wallId;
  if (!walls || !id) return;
  const w = walls.find((x) => x.id === id);
  if (!w) return;
  const shift = normalShift(w.start, w.end, sub(e.world, d.startWorld));
  const ignore = new Set<string>([id, ...wallsAtNode(walls, w.start), ...wallsAtNode(walls, w.end)]);
  const res = ctx.snap({ x: w.start.x + shift.x, y: w.start.y + shift.y }, { ignoreIds: ignore, angleFrom: null, targets: { 'wall-mid': false } });
  useSnapGuides.getState().set(res.kind === 'grid' ? null : res);
  const fin = normalShift(w.start, w.end, sub(res.point, w.start));
  const next = moveWallWithNeighbors(walls, id, fin.x, fin.y);
  const s = useProjectStore.getState();
  s.updateFloor(d.floorId, (f) => { f.walls = next; });
  if (d.floorAtStart) clampOpeningsOnWalls(d.floorAtStart, next);
}

function wallNodeDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const walls = d.wallsOrig;
  const node = d.node;
  if (!walls || !node) return;
  const ignore = wallsAtNode(walls, node);
  const res = ctx.snap(e.world, { ignoreIds: ignore, angleFrom: null });
  useSnapGuides.getState().set(res);
  const next = moveWallNode(walls, node, res.point);
  const s = useProjectStore.getState();
  s.updateFloor(d.floorId, (f) => { f.walls = next; });
  if (d.floorAtStart) clampOpeningsOnWalls(d.floorAtStart, next);
}

function openingDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const o = d.openingOrig;
  if (!o) return;
  const cur = currentFloor().openings.find((x) => x.id === o.id) ?? o;
  const target = openingDragTarget(e.world, cur, ctx.walls);
  if (!target) return;
  let offset = target.offset;
  const snapOn = ctx.project.settings.snapEnabled && !ctx.ui.snapOverride && !e.alt;
  const g = ctx.project.settings.gridSize;
  const wall = findWall(ctx.floor, target.wallId);
  if (snapOn && g > 0 && wall) offset = clampOpeningOffset(Math.round(offset / g) * g, cur.width, wall);
  useProjectStore.getState().updateOpening(d.floorId, o.id, { wallId: target.wallId, offset });
}

function vertexDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const poly = d.vertexOrig;
  const idx = d.index;
  const id = d.polyId;
  if (!poly || idx == null || !id) return;
  const res = ctx.snap(e.world, { angleFrom: null });
  useSnapGuides.getState().set(res);
  const next = poly.map((p, i) => (i === idx ? res.point : p));
  const s = useProjectStore.getState();
  if (d.mode === 'zoneVertex') s.updateZone(d.floorId, id, { polygon: next });
  else s.updateVoid(d.floorId, id, { polygon: next });
}

function measureEndDrag(e: ToolEvent, ctx: ToolContext, d: DragState) {
  const m = d.measureOrig;
  if (!m || d.index == null) return;
  const res = ctx.snap(e.world, { angleFrom: d.index ? m.start : m.end });
  useSnapGuides.getState().set(res);
  useProjectStore.getState().updateAnnotation(d.floorId, m.id, d.index ? { end: res.point } : { start: res.point });
}

function onPointerMove(e: ToolEvent, ctx: ToolContext) {
  const d = drag;
  if (!d) {
    updateHover(e, ctx);
    return;
  }
  if (!d.active) {
    if (d.mode === 'none') return;
    const moved = Math.hypot(e.screen.x - d.startScreen.x, e.screen.y - d.startScreen.y);
    if (moved < DRAG_THRESHOLD_PX) return;
    d.active = true;
    if (d.mode === 'marquee') useSelectTool.getState().patch({ cursor: 'crosshair' });
    else {
      beginDragTx();
      useSelectTool.getState().patch({ cursor: d.mode === 'rotate' ? 'grabbing' : d.mode === 'scale' ? (d.handle?.cursor ?? 'move') : 'move' });
    }
  }
  switch (d.mode) {
    case 'marquee':
      useSelectTool.getState().patch({ marquee: { start: d.startWorld, end: e.world } });
      break;
    case 'move': moveSelection(e, ctx, d); break;
    case 'rotate': rotateDrag(e, ctx, d); break;
    case 'scale': scaleDrag(e, ctx, d); break;
    case 'hallVertex': hallVertexDrag(e, ctx, d); break;
    case 'hallEdge': hallEdgeDrag(e, ctx, d); break;
    case 'wallMove': wallMoveDrag(e, ctx, d); break;
    case 'wallNode': wallNodeDrag(e, ctx, d); break;
    case 'opening': openingDrag(e, ctx, d); break;
    case 'zoneVertex':
    case 'voidVertex': vertexDrag(e, ctx, d); break;
    case 'measureEnd': measureEndDrag(e, ctx, d); break;
    default: break;
  }
}

/* ------------------------------------------------------------------ */
/* Pointer up, Doppelklick, Tastatur                                   */
/* ------------------------------------------------------------------ */

function onPointerUp(e: ToolEvent, ctx: ToolContext) {
  const d = drag;
  if (!d) return;
  if (d.mode === 'marquee' && d.active) {
    const rect = marqueeRect(d.startWorld, e.world);
    const ids = marqueeSelect(rect, ctx.items, marqueeMode(d.startWorld, e.world));
    const add: Selection[] = ids.map((id) => ({ kind: 'item', id }) as Selection);
    ctx.ui.setSelection(e.shift ? mergeSelection(freshSelection(), add) : add);
  } else if (!d.active && d.toggleOff) {
    ctx.ui.setSelection(removeFromSelection(freshSelection(), d.toggleOff));
  }
  finishDrag(true);
  if (e.pointerType !== 'touch') updateHover(e, ctx);
}

function onDoubleClick(e: ToolEvent, ctx: ToolContext) {
  if (drag) finishDrag(true);
  const ui = ctx.ui;
  const floor = ctx.floor;
  const hit = hitAt(e, ctx, toleranceFor(e, ctx));
  if (!hit) return;
  const st = useSelectTool.getState();
  switch (hit.kind) {
    case 'item':
      ui.setSelection([hit]);
      ui.setRightPanel('properties');
      return;
    case 'hallEdge': {
      const poly = floor.hall?.polygon;
      const i = Number(hit.id);
      if (!poly || !Number.isInteger(i) || i < 0 || i >= poly.length) return;
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      ui.setSelection([hit]);
      st.patch({ lengthInput: { kind: 'hallEdge', id: hit.id, world: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, initial: formatCmValue(distance(a, b)) } });
      return;
    }
    case 'wall': {
      const w = floor.walls.find((x) => x.id === hit.id);
      if (!w) return;
      ui.setSelection([hit]);
      if (w.locked) {
        ui.setRightPanel('properties');
        return;
      }
      st.patch({ lengthInput: { kind: 'wall', id: w.id, world: wallMidpoint(w), initial: formatCmValue(wallLength(w)) } });
      return;
    }
    case 'annotation': {
      const a = floor.annotations.find((x) => x.id === hit.id);
      if (!a) return;
      ui.setSelection([hit]);
      if (a.kind === 'text' && !a.locked) st.patch({ textEdit: { id: a.id, world: { x: a.x, y: a.y }, initial: a.text, fontSize: a.fontSize } });
      else ui.setRightPanel('properties');
      return;
    }
    default:
      ui.setSelection([hit]);
      ui.setRightPanel('properties');
  }
}

/** Zahl in cm ohne Einheit, Komma als Dezimaltrennzeichen (für das Eingabefeld). */
function formatCmValue(cm: number): string {
  const v = Math.round(cm * 10) / 10;
  return String(v).replace('.', ',');
}

function onKeyDown(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') {
    const st = useSelectTool.getState();
    if (st.lengthInput || st.textEdit) {
      st.patch({ lengthInput: null, textEdit: null });
      return true;
    }
    if (drag && drag.active) {
      finishDrag(false);
      return true;
    }
  }
  return false;
}

function onCancel(ctx: ToolContext) {
  if (drag) finishDrag(false);
  useSelectTool.getState().reset();
  useSnapGuides.getState().set(null);
  if (ctx.ui.hoverId) ctx.ui.setHover(null);
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

/** Konva-Overlay: Auswahlrahmen, Abstände beim Ziehen, Live-Winkel beim Drehen. */
function SelectOverlay({ ctx }: { ctx: ToolContext }) {
  const marquee = useSelectTool((s) => s.marquee);
  const distances = useSelectTool((s) => s.distances);
  const rotate = useSelectTool((s) => s.rotate);
  const dark = useIsDark();
  const s = 1 / ctx.viewport.scale;
  const pal = dimPalette(dark);
  const accent = pal.accent;
  const nodes: React.ReactNode[] = [];
  if (marquee) {
    const r = marqueeRect(marquee.start, marquee.end);
    const touch = marqueeMode(marquee.start, marquee.end) === 'touch';
    nodes.push(
      <Rect
        key="marquee"
        x={r.minX}
        y={r.minY}
        width={r.maxX - r.minX}
        height={r.maxY - r.minY}
        fill={dark ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.10)'}
        stroke={accent}
        strokeWidth={1 * s}
        dash={touch ? [5 * s, 3 * s] : undefined}
        listening={false}
      />,
    );
  }
  for (const d of distances) {
    nodes.push(<DimensionLine key={`dist:${d.side}`} from={d.from} to={d.to} label={formatLength(d.distance)} s={s} color={pal.accent} textColor={pal.text} bg={pal.bg} dashed />);
  }
  if (rotate) {
    nodes.push(
      <Group key="rot" listening={false}>
        <Line points={[rotate.center.x - 6 * s, rotate.center.y, rotate.center.x + 6 * s, rotate.center.y]} stroke={accent} strokeWidth={1 * s} />
        <Line points={[rotate.center.x, rotate.center.y - 6 * s, rotate.center.x, rotate.center.y + 6 * s]} stroke={accent} strokeWidth={1 * s} />
        <DimText x={rotate.center.x} y={rotate.center.y - rotate.radiusCm} text={formatDegrees(rotate.angle)} s={s} color={pal.text} bg={pal.bg} bold />
      </Group>,
    );
  }
  return <Group listening={false}>{nodes}</Group>;
}

function stopKeys(e: React.KeyboardEvent) {
  e.stopPropagation();
}

/** Numerische Längeneingabe (Hallenkante / Wand) an der Kantenmitte. */
function LengthInputBox({ ctx, state }: { ctx: ToolContext; state: LengthInputState }) {
  const [value, setValue] = useState(state.initial);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setValue(state.initial);
    setError(null);
    const t = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [state]);
  const close = () => useSelectTool.getState().patch({ lengthInput: null });
  const commit = () => {
    const cm = parseLength(value, 'cm');
    if (cm == null || !(cm >= 1)) {
      setError('Bitte eine Länge ≥ 1 cm eingeben (z. B. 350 oder 3,5 m).');
      return;
    }
    const ok = state.kind === 'hallEdge' ? setHallEdgeLength(Number(state.id), cm, ctx.floor) : setWallLength(state.id, cm, ctx.floor);
    if (!ok) {
      ctx.ui.toast('Länge konnte nicht gesetzt werden', 'warning');
      close();
      return;
    }
    close();
  };
  const p = worldToScreen(state.world, ctx.viewport);
  return (
    <div
      className="gp-panel absolute z-20 rounded-lg border p-2 shadow-lg"
      style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)', minWidth: 190 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="gp-label block pb-1">{state.kind === 'hallEdge' ? 'Kantenlänge (Außenmaß)' : 'Wandlänge (Achsmaß)'}</label>
      <div className="flex items-center gap-1.5">
        <input
          ref={ref}
          className="gp-input"
          value={value}
          inputMode="decimal"
          aria-label="Länge"
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            stopKeys(e);
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
          }}
        />
        <span className="gp-muted text-xs whitespace-nowrap">cm / m</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="gp-muted text-[11px]">Enter = übernehmen · Esc = abbrechen</span>
        <button type="button" className="gp-btn gp-btn-primary py-0.5 text-xs" onClick={commit}>OK</button>
      </div>
      {error && <div className="gp-danger mt-1 text-[11px]">{error}</div>}
    </div>
  );
}

/** Inline-Bearbeitung einer Textanmerkung. */
function TextEditBox({ ctx, state }: { ctx: ToolContext; state: TextEditState }) {
  const [value, setValue] = useState(state.initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setValue(state.initial);
    const t = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [state]);
  const close = () => useSelectTool.getState().patch({ textEdit: null });
  const commit = () => {
    const text = value.replace(/\s+$/, '');
    if (text && text !== state.initial) setTextAnnotation(state.id, { text }, ctx.floor);
    close();
  };
  const p = worldToScreen(state.world, ctx.viewport);
  const fontPx = Math.max(12, Math.min(48, state.fontSize * ctx.viewport.scale));
  return (
    <div className="absolute z-20" style={{ left: p.x - 4, top: p.y - 4 }} onPointerDown={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        className="gp-input resize-none shadow-lg"
        style={{ fontSize: fontPx, lineHeight: 1.3, minWidth: 180, width: Math.max(180, value.split('\n').reduce((m, l) => Math.max(m, l.length), 0) * fontPx * 0.62 + 24), minHeight: fontPx * 1.3 + 12 }}
        rows={Math.max(1, value.split('\n').length)}
        value={value}
        aria-label="Text bearbeiten"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          stopKeys(e);
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); close(); }
        }}
      />
      <div className="gp-muted mt-1 text-[11px]">Enter = übernehmen · Shift+Enter = Zeilenumbruch · Esc = abbrechen</div>
    </div>
  );
}

function SelectHtmlOverlay({ ctx }: { ctx: ToolContext }) {
  const lengthInput = useSelectTool((s) => s.lengthInput);
  const textEdit = useSelectTool((s) => s.textEdit);
  if (lengthInput) return <LengthInputBox ctx={ctx} state={lengthInput} />;
  if (textEdit) return <TextEditBox ctx={ctx} state={textEdit} />;
  return null;
}

/* ------------------------------------------------------------------ */
/* Registrierung                                                       */
/* ------------------------------------------------------------------ */

registerTool({
  id: 'select',
  hint: 'Klicken: auswählen · Shift+Klick: mehrfach · Ziehen: verschieben/Rahmen · Doppelklick: Eigenschaften/Länge · R: drehen',
  cursor: () => useSelectTool.getState().cursor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onKeyDown: (e) => onKeyDown(e),
  onCancel,
  onActivate: () => useSelectTool.getState().patch({ cursor: 'default' }),
  Overlay: SelectOverlay,
  HtmlOverlay: SelectHtmlOverlay,
});
