import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group } from 'react-konva';
import type Konva from 'konva';
import { useShallow } from 'zustand/react/shallow';
import type { Vec2 } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { useActiveFloor, useFloorRooms, useFloorWalls, useFloorVisibleItems, useLowerFloor } from '@/store/selectors';
import { useIsDark } from '@/hooks/useTheme';
import { screenToWorld, zoomAt, fitToBounds, MIN_SCALE, MAX_SCALE } from './viewport';
import { setStage } from './stageRegistry';
import { getTool } from './tools/registry';
import type { ToolContext, ToolEvent } from './tools/types';
import { snapPoint, type SnapContext } from '@/geometry/snap';
import { findCollisions, collidingIds } from '@/geometry/collision';
import { getDef } from '@/data/equipment';
import { FURNITURE_AREAS, scaleBucket } from './layers/ItemsLayer';
import { bbox, type BBox } from '@/geometry/polygon';
import { itemFootprint } from '@/geometry/transform';
import {
  GridLayer, LowerFloorLayer, HallLayer, RoomsLayer, WallsLayer, OpeningsLayer, ItemsLayer,
  AnnotationsLayer, DimensionsLayer, SelectionLayer, DragPreviewLayer,
} from './layers';
import { useDragPreview, sameIdSet } from './dragPreview';
import { Rulers } from './overlays/Rulers';
import { ScaleBar } from './overlays/ScaleBar';
import { Minimap } from './overlays/Minimap';
import { SnapGuides } from './overlays/SnapGuides';
import { useDropFromLibrary } from './useDropFromLibrary';
import './tools'; // registriert alle Werkzeuge
import { useSelectTool } from './tools/selectTool';
import { pruneSelection } from './actions';

/** Berechnet die Welt-Bounding-Box des Stockwerks (Halle, Wände, Objekte). */
export function floorBounds(floor: ReturnType<typeof useActiveFloor>) {
  const pts: Vec2[] = [];
  if (floor.hall) pts.push(...floor.hall.polygon);
  for (const w of floor.walls) pts.push(w.start, w.end);
  for (const it of floor.items) pts.push(...itemFootprint(it));
  for (const z of floor.zones) pts.push(...z.polygon);
  if (!pts.length) return { minX: -500, minY: -500, maxX: 2500, maxY: 2000 };
  return bbox(pts);
}

interface StageSize {
  width: number;
  height: number;
}
const NO_SIZE: StageSize = { width: 0, height: 0 };

/**
 * Zoom-Geste: Ebenen rendern erst neu, wenn der Maßstab um mehr als diesen Faktor vom zuletzt gerenderten abweicht
 * (Linienbreiten/Schriften weichen dazwischen bis zu ±25 % ab); ZOOM_SETTLE_MS nach dem letzten Zoomschritt wird der
 * genaue Maßstab (Bucket 0,01) gesetzt.
 */
export const ZOOM_RERENDER_RATIO = 1.25;
export const ZOOM_SETTLE_MS = 120;
/** Rand des Culling-Bereichs (Anteil der Ansichtsgröße) – Objekte außerhalb werden nicht gerendert. */
const CULL_MARGIN = 0.5;
/** Beim Pan wird der Culling-Bereich erst neu bestimmt, wenn die Ansicht (plus dieser Mindestrand) ihn verlässt. */
const CULL_MIN_MARGIN = 0.12;
/**
 * Pan-Geste (Maßnahme 5): die statischen Ebenen (Halle/Räume/Wände/Öffnungen und Objekte/Anmerkungen/Maße) werden als
 * Bitmap gecacht (Konva Group.cache in Bildschirmauflösung, Bereich = Culling-Rechteck) – je Frame wird dann nur die
 * Bitmap verschoben statt ≈ 3 000 Shapes neu gezeichnet. Der Cache wird nach dem React-Commit aufgebaut und erneuert,
 * wenn sich Culling-Bereich, Maßstab oder Inhalt ändern; nach der Geste wird er gelöscht. Beim Zoom ohne Pan wird nicht
 * gecacht (Unschärfe). Obergrenze der Bitmap-Größe je Ebene (Pixel), darüber wird die Auflösung reduziert.
 */
const PAN_CACHE_MAX_PX = 8e6;

/** Auflösung (Konva pixelRatio) des Pan-Caches für einen Bereich. */
export function panCachePixelRatio(region: BBox, scale: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  let pixelRatio = scale * dpr;
  const px = (region.maxX - region.minX) * (region.maxY - region.minY) * pixelRatio * pixelRatio;
  if (px > PAN_CACHE_MAX_PX) pixelRatio *= Math.sqrt(PAN_CACHE_MAX_PX / px);
  return pixelRatio;
}

/** Gerasterter Ebenen-Maßstab (siehe ZOOM_RERENDER_RATIO). */
export function nextRenderScale(prev: number, scale: number, settled: boolean): number {
  if (settled) return scaleBucket(scale);
  const ratio = scale / prev;
  return ratio > ZOOM_RERENDER_RATIO || ratio < 1 / ZOOM_RERENDER_RATIO ? scaleBucket(scale) : prev;
}

/** Sichtbarer Weltbereich der Ansicht. */
function visibleWorldRect(viewport: { scale: number; x: number; y: number }, size: StageSize): BBox {
  const s = viewport.scale;
  return { minX: -viewport.x / s, minY: -viewport.y / s, maxX: (size.width - viewport.x) / s, maxY: (size.height - viewport.y) / s };
}
function expandRect(r: BBox, fx: number, fy: number): BBox {
  return { minX: r.minX - fx, minY: r.minY - fy, maxX: r.maxX + fx, maxY: r.maxY + fy };
}
function rectContains(outer: BBox, inner: BBox): boolean {
  return inner.minX >= outer.minX && inner.minY >= outer.minY && inner.maxX <= outer.maxX && inner.maxY <= outer.maxY;
}
function rectArea(r: BBox): number {
  return Math.max(0, r.maxX - r.minX) * Math.max(0, r.maxY - r.minY);
}
/**
 * Culling-Bereich mit Hysterese: bleibt beim Pan/Zoom erhalten, solange er die Ansicht plus Mindestrand enthält und
 * nicht mehr als das Vierfache davon umfasst – dann rendert die Objekt-Ebene nicht je Frame neu.
 */
export function nextCullRect(prev: BBox | null, viewport: { scale: number; x: number; y: number }, size: StageSize): BBox | null {
  if (!(size.width > 0) || !(size.height > 0) || !(viewport.scale > 0)) return null;
  const vis = visibleWorldRect(viewport, size);
  const w = vis.maxX - vis.minX;
  const h = vis.maxY - vis.minY;
  const required = expandRect(vis, w * CULL_MIN_MARGIN, h * CULL_MIN_MARGIN);
  if (prev && rectContains(prev, required) && rectArea(prev) <= 4 * rectArea(required)) return prev;
  return expandRect(vis, w * CULL_MARGIN, h * CULL_MARGIN);
}

/** Laufende Zeigergeste auf der Stage (bis Pointer-Up/-Cancel/Fensterwechsel). */
interface Gesture {
  kind: 'pan' | 'tool';
  pointerId: number;
  pointerType: string;
}

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Modaler Dialog offen (Modal.tsx setzt role="dialog" + aria-modal)? Dann erreichen Tasten die Werkzeuge nicht. */
function modalOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const setStageRef = useCallback((s: Konva.Stage | null) => {
    stageRef.current = s;
    setStage(s);
  }, []);
  // Größe erst nach der ersten Messung bekannt – bis dahin keine Stage (kein Einpassen auf Platzhaltermaße).
  const [size, setSize] = useState<StageSize | null>(null);
  const dark = useIsDark();

  const project = useProjectStore((s) => s.project);
  const floor = useActiveFloor();
  const lowerFloor = useLowerFloor();
  const walls = useFloorWalls(floor);
  const rooms = useFloorRooms(floor);
  const allItems = useFloorVisibleItems(floor);
  // Ebene „Möbel“ blendet Empfang/Büro/Ausstattung aus – dann auch nicht klickbar/kollidierend.
  const furnitureVisible = useProjectStore((s) => s.project.layers.furniture);
  const items = useMemo(
    () => (furnitureVisible ? allItems : allItems.filter((it) => { const d = getDef(it.defId, project); return !d || !FURNITURE_AREAS.has(d.bereich); })),
    [allItems, furnitureVisible, project],
  );
  const viewport = useUiStore((s) => s.viewport);
  const setViewport = useUiStore((s) => s.setViewport);
  // Nur die benötigten UI-Slices abonnieren (cursorWorld/Toasts/Statushinweis rendern den Canvas nicht neu).
  const { tool, selection, hoverId, presentation, fitRequest, focusNonce, snapOverride, toolOptions, showRulers, showMinimap } = useUiStore(
    useShallow((s) => ({
      tool: s.tool,
      selection: s.selection,
      hoverId: s.hoverId,
      presentation: s.presentationMode,
      fitRequest: s.fitRequest,
      focusNonce: s.focusRequest?.nonce ?? 0,
      snapOverride: s.snapOverride,
      toolOptions: s.toolOptions,
      showRulers: s.showRulers,
      showMinimap: s.showMinimap,
    })),
  );
  // Cursor des Auswahl-Werkzeugs (Hover/Griffe) reaktiv halten
  const selectCursor = useSelectTool((s) => s.cursor);
  const layers = project.layers;
  const settings = project.settings;
  const floorRef = useRef(floor);
  floorRef.current = floor;

  // Größe beobachten (synchron vor dem ersten Zeichnen, damit Einpassen mit echten Maßen rechnet)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { width: Math.max(50, Math.floor(r.width)), height: Math.max(50, Math.floor(r.height)) };
      setSize((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Einpassen: beim ersten Anzeigen eines Projekts (nicht beim Remount, z. B. nach der 3D-Ansicht – der Viewport
  // liegt im uiStore) und bei jeder neuen Anfrage (fitRequest) – jeweils erst mit gemessener Stage-Größe.
  useEffect(() => {
    if (!size) return;
    const ui = useUiStore.getState();
    const initial = ui.viewportInitialized !== project.id;
    const requested = ui.fitApplied !== fitRequest;
    if (!initial && !requested) return;
    setViewport(fitToBounds(floorBounds(floorRef.current), size.width, size.height));
    ui.setViewportInitialized(project.id);
    ui.setFitApplied(fitRequest);
  }, [size, fitRequest, project.id, setViewport]);
  // Fokus-Anfrage (z. B. aus Warnungsliste) – wird nach dem Ausführen verbraucht, überlebt daher auch einen Remount.
  useEffect(() => {
    if (!size) return;
    const ui = useUiStore.getState();
    const req = ui.focusRequest;
    if (!req) return;
    const { point, selection: sel } = req;
    setViewport((v) => {
      const scale = Math.max(v.scale, 0.5);
      return { scale, x: size.width / 2 - point.x * scale, y: size.height / 2 - point.y * scale };
    });
    if (sel) ui.setSelection([sel]);
    ui.clearFocusRequest();
  }, [size, focusNonce, setViewport]);

  // Auswahl bereinigen, wenn gewählte Elemente nicht mehr existieren, ausgeblendet wurden oder ihre Ebene aus ist
  // (Undo einer Anlage, „Ausblenden“, Stockwerkswechsel, Ebenen-Schalter) – sonst blieben Griffe/Statusleiste stehen.
  useEffect(() => {
    const ui = useUiStore.getState();
    const roomIds = new Set(rooms.map((r) => r.id));
    const next = pruneSelection(ui.selection, { floor, items, walls, roomIds, layers });
    if (next !== ui.selection) ui.setSelection(next);
  }, [floor, items, walls, rooms, layers]);

  // Kollisionen (memoisiert). Beim transienten Ziehen (dragPreview) bleiben für die statischen Ebenen nur Kollisionen
  // ohne Beteiligung gezogener Objekte übrig – die Kollisionsvorschau (gezogene Objekte + berührte Partner) zeichnet
  // DragPreviewLayer im Overlay, damit sich in der großen Objekt-Ebene während des Ziehens nichts ändert.
  // Die Set-Instanz bleibt bei gleichem Inhalt erhalten (Ebenen-Memo).
  const previewIds = useDragPreview((s) => s.ids);
  const baseCollisions = useMemo(() => {
    if (!layers.items) return [];
    const wallMountedIds = new Set(items.filter((it) => getDef(it.defId, project)?.wandmontage).map((it) => it.id));
    return findCollisions(items, { includeZones: layers.safetyZones, walls, wallMountedIds });
  }, [items, walls, layers.items, layers.safetyZones, project]);
  const collidingRef = useRef<Set<string>>(new Set());
  const colliding = useMemo(() => {
    let next: Set<string>;
    if (!previewIds) next = collidingIds(baseCollisions);
    else {
      next = new Set<string>();
      for (const c of baseCollisions) {
        if (previewIds.has(c.a) || previewIds.has(c.b)) continue;
        next.add(c.a);
        next.add(c.b);
      }
    }
    return sameIdSet(next, collidingRef.current) ? collidingRef.current : next;
  }, [baseCollisions, previewIds]);
  collidingRef.current = colliding;

  // Ebenen-Maßstab: beim Pan konstant, beim Zoom gerastert (Hysterese) und nach der Geste exakt (siehe nextRenderScale)
  const [settledScale, setSettledScale] = useState(viewport.scale);
  useEffect(() => {
    if (settledScale === viewport.scale) return;
    const t = window.setTimeout(() => setSettledScale(viewport.scale), ZOOM_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [viewport.scale, settledScale]);
  const renderScaleRef = useRef(scaleBucket(viewport.scale));
  const renderScale = nextRenderScale(renderScaleRef.current, viewport.scale, settledScale === viewport.scale);
  renderScaleRef.current = renderScale;
  const layerViewport = useMemo(() => ({ scale: renderScale, x: 0, y: 0 }), [renderScale]);
  // Culling-Bereich der Objekt-Ebene (Hysterese, siehe nextCullRect)
  const cullRef = useRef<BBox | null>(null);
  const cullRect = size ? nextCullRect(cullRef.current, viewport, size) : null;
  cullRef.current = cullRect;

  const pxToWorld = useCallback((px: number) => px / viewport.scale, [viewport.scale]);

  const altDown = useRef(false);
  const spaceDown = useRef(false);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { altDown.current = true; useUiStore.getState().setSnapOverride(true); }
      if (e.code === 'Space' && !isEditableTarget(e.target)) {
        spaceDown.current = true;
        // Standardaktion nur unterdrücken, wenn kein Bedienelement (Button, Schalter, Tab …) den Fokus hat –
        // sonst wären Buttons/Schalter per Leertaste nicht mehr bedienbar.
        const t = e.target as HTMLElement | null;
        if (!t || t === document.body || containerRef.current?.contains(t)) e.preventDefault();
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { altDown.current = false; useUiStore.getState().setSnapOverride(false); }
      if (e.code === 'Space') spaceDown.current = false;
    };
    const blur = () => { altDown.current = false; spaceDown.current = false; useUiStore.getState().setSnapOverride(false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, []);

  const snap = useCallback(
    (p: Vec2, overrides?: Partial<SnapContext>) => {
      const ctx: SnapContext = {
        gridSize: settings.gridSize,
        enabled: settings.snapEnabled && !snapOverride && !altDown.current,
        threshold: 8 / viewport.scale,
        walls,
        items,
        hall: floor.hall,
        ...overrides,
      };
      return snapPoint(p, ctx);
    },
    [settings.gridSize, settings.snapEnabled, snapOverride, viewport.scale, walls, items, floor.hall],
  );

  const stageSize = size ?? NO_SIZE;
  // Kontext für Overlays (memoisiert). ui/store sind Momentaufnahmen; die relevanten UI-Slices sind in den
  // Abhängigkeiten, Ereignis-Handler erhalten über eventCtx() stets den frischen Store-Zustand.
  const ctx: ToolContext = useMemo(
    () => ({ project, floor, walls, rooms, items, viewport, store: useProjectStore.getState(), ui: useUiStore.getState(), snap, pxToWorld, stageSize }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, floor, walls, rooms, items, viewport, snap, pxToWorld, stageSize, tool, selection, hoverId, snapOverride, toolOptions],
  );
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const eventCtx = useCallback((): ToolContext => ({ ...ctxRef.current, store: useProjectStore.getState(), ui: useUiStore.getState() }), []);

  const handler = getTool(tool);
  // Werkzeugwechsel → vorheriges abbrechen
  const prevTool = useRef(tool);
  useEffect(() => {
    if (prevTool.current !== tool) {
      getTool(prevTool.current)?.onCancel?.(eventCtx());
      prevTool.current = tool;
    }
    getTool(tool)?.onActivate?.(eventCtx());
    useUiStore.getState().setStatusHint(getTool(tool)?.hint ?? '');
  }, [tool, eventCtx]);

  // Pan-Zustand
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const lastPointerRef = useRef<Vec2 | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [panning, setPanning] = useState(false);
  // Pan-Cache der statischen Ebenen (siehe PAN_CACHE_MAX_PX): nach jedem Commit, der Inhalt/Bereich/Maßstab ändert, neu aufbauen
  const staticGroupRef = useRef<Konva.Group | null>(null);
  const itemsGroupRef = useRef<Konva.Group | null>(null);
  const panCacheActive = useRef(false);
  useLayoutEffect(() => {
    const groups = [staticGroupRef.current, itemsGroupRef.current];
    if (!panning || !cullRect) {
      if (panCacheActive.current) {
        panCacheActive.current = false;
        for (const g of groups) g?.clearCache();
      }
      return;
    }
    const pixelRatio = panCachePixelRatio(cullRect, viewport.scale);
    for (const g of groups) {
      if (!g) continue;
      g.clearCache();
      g.cache({ x: cullRect.minX, y: cullRect.minY, width: cullRect.maxX - cullRect.minX, height: cullRect.maxY - cullRect.minY, pixelRatio });
    }
    panCacheActive.current = true;
    // Abhängigkeiten: Bereich/Maßstab sowie alle Props, die die statischen Ebenen erhalten (siehe layerProps)
  }, [panning, cullRect, viewport.scale, renderScale, project, floor, walls, rooms, items, selection, hoverId, dark, lowerFloor, colliding, presentation, previewIds]);
  // Pinch-Zoom
  const pinchRef = useRef<{ dist: number; center: Vec2 } | null>(null);

  // Cursorposition für die Statusleiste höchstens einmal je Frame in den Store schreiben
  const cursorRaf = useRef<number | null>(null);
  const pendingCursor = useRef<Vec2 | null>(null);
  const scheduleCursor = useCallback((w: Vec2) => {
    pendingCursor.current = w;
    if (cursorRaf.current != null) return;
    cursorRaf.current = requestAnimationFrame(() => {
      cursorRaf.current = null;
      if (pendingCursor.current) useUiStore.getState().setCursorWorld(pendingCursor.current);
    });
  }, []);
  useEffect(() => () => { if (cursorRaf.current != null) cancelAnimationFrame(cursorRaf.current); }, []);

  const toToolEvent = (e: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>, at?: Vec2): ToolEvent | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = at ?? stage.getPointerPosition();
    if (!pos) return null;
    const evt = e.evt as PointerEvent;
    return {
      world: screenToWorld(pos, viewport),
      screen: pos,
      shift: !!evt.shiftKey,
      alt: !!evt.altKey,
      ctrl: !!evt.ctrlKey,
      meta: !!evt.metaKey,
      button: evt.button ?? 0,
      buttons: typeof evt.buttons === 'number' ? evt.buttons : undefined,
      pointerType: evt.pointerType ?? 'mouse',
      evt: e,
      target: e.target,
    };
  };

  const endPan = () => {
    panRef.current = null;
    setPanning(false);
  };

  // Radschritte je Frame zusammenfassen: höchstens ein Viewport-Update (und damit ein Neuzeichnen) je Frame
  const wheelRaf = useRef<number | null>(null);
  const wheelAcc = useRef<{ steps: number; pos: Vec2; dx: number; dy: number }>({ steps: 0, pos: { x: 0, y: 0 }, dx: 0, dy: 0 });
  const flushWheel = useCallback(() => {
    wheelRaf.current = null;
    const acc = wheelAcc.current;
    const { steps, pos, dx, dy } = acc;
    acc.steps = 0;
    acc.dx = 0;
    acc.dy = 0;
    setViewport((v) => {
      let next = v;
      if (steps) next = zoomAt(next, pos, Math.pow(1.1, steps));
      if (dx || dy) next = { ...next, x: next.x - dx, y: next.y - dy };
      return next;
    });
  }, [setViewport]);
  useEffect(() => () => { if (wheelRaf.current != null) cancelAnimationFrame(wheelRaf.current); }, []);
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const acc = wheelAcc.current;
    if (e.evt.ctrlKey || e.evt.metaKey || !e.evt.shiftKey) {
      acc.steps += e.evt.deltaY < 0 ? 1 : -1;
      acc.pos = pos;
    } else {
      acc.dx += e.evt.deltaY;
      acc.dy += e.evt.deltaX;
    }
    if (wheelRaf.current == null) wheelRaf.current = requestAnimationFrame(flushWheel);
  };

  /** Pointer an die Stage binden: Bewegungen und Loslassen außerhalb des Canvas kommen weiterhin an. */
  const capturePointer = (e: PointerEvent) => {
    const stage = stageRef.current;
    if (!stage || typeof e.pointerId !== 'number') return;
    try {
      stage.content.setPointerCapture(e.pointerId);
    } catch {
      /* synthetische Ereignisse / Pointer nicht aktiv */
    }
  };

  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    useUiStore.getState().setContextMenu(null);
    const isMiddle = e.evt.button === 1;
    if (isMiddle || spaceDown.current || tool === 'pan') {
      e.evt.preventDefault();
      capturePointer(e.evt);
      panRef.current = { startX: pos.x, startY: pos.y, vx: viewport.x, vy: viewport.y };
      gestureRef.current = { kind: 'pan', pointerId: e.evt.pointerId, pointerType: e.evt.pointerType ?? 'mouse' };
      setPanning(true);
      return;
    }
    if (e.evt.button === 2) return; // Kontextmenü separat
    const te = toToolEvent(e);
    if (!te) return;
    capturePointer(e.evt);
    lastPointerRef.current = pos;
    gestureRef.current = { kind: 'tool', pointerId: e.evt.pointerId, pointerType: te.pointerType };
    handler?.onPointerDown?.(te, eventCtx());
  };
  const onPointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    lastPointerRef.current = pos;
    scheduleCursor(screenToWorld(pos, viewport));
    if (panRef.current) {
      const p = panRef.current;
      setViewport((v) => ({ ...v, x: p.vx + (pos.x - p.startX), y: p.vy + (pos.y - p.startY) }));
      return;
    }
    const te = toToolEvent(e);
    if (te) handler?.onPointerMove?.(te, eventCtx());
  };
  const onPointerUp = (e: Konva.KonvaEventObject<PointerEvent>) => {
    gestureRef.current = null;
    if (panRef.current) { endPan(); return; }
    const te = toToolEvent(e);
    if (te) handler?.onPointerUp?.(te, eventCtx());
  };
  const onDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const te = toToolEvent(e);
    if (te) handler?.onDoubleClick?.(te, eventCtx());
  };
  const onContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos || !containerRef.current) return;
    const te = toToolEvent(e);
    if (te && handler?.onContextMenu?.(te, eventCtx())) return;
    const rect = containerRef.current.getBoundingClientRect();
    const world = screenToWorld(pos, viewport);
    useUiStore.getState().setContextMenu({ x: rect.left + pos.x, y: rect.top + pos.y, world });
  };
  // Touch: Pinch-Zoom & Zwei-Finger-Pan
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2 || !containerRef.current) return;
    e.evt.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const p1 = { x: t[0].clientX - rect.left, y: t[0].clientY - rect.top };
    const p2 = { x: t[1].clientX - rect.left, y: t[1].clientY - rect.top };
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (!pinchRef.current) { pinchRef.current = { dist, center }; return; }
    const prev = pinchRef.current;
    const factor = dist / prev.dist;
    setViewport((v) => {
      const z = zoomAt(v, prev.center, Math.min(MAX_SCALE / v.scale, Math.max(MIN_SCALE / v.scale, factor)));
      return { ...z, x: z.x + (center.x - prev.center.x), y: z.y + (center.y - prev.center.y) };
    });
    pinchRef.current = { dist, center };
  };
  const onTouchEnd = () => { pinchRef.current = null; };

  // Geste robust beenden, wenn das Loslassen nicht auf der Stage ankommt (Pointer-Capture verloren, pointercancel,
  // Fensterwechsel per Alt+Tab): Werkzeug erhält ein Pointer-Up an der letzten bekannten Position, Pan endet.
  const finishGestureRef = useRef<(evt: PointerEvent | MouseEvent | null) => void>(() => {});
  finishGestureRef.current = (evt) => {
    const g = gestureRef.current;
    if (!g) return;
    gestureRef.current = null;
    if (g.kind === 'pan') { endPan(); return; }
    const stage = stageRef.current;
    const pos = lastPointerRef.current;
    const h = getTool(useUiStore.getState().tool);
    if (!stage || !pos || !h) return;
    const native: PointerEvent | MouseEvent = evt
      ?? (typeof PointerEvent === 'function' ? new PointerEvent('pointerup', { pointerId: g.pointerId, pointerType: g.pointerType, bubbles: true }) : new MouseEvent('pointerup', { bubbles: true }));
    const konvaEvt: Konva.KonvaEventObject<PointerEvent | MouseEvent> = { type: 'pointerup', target: stage, currentTarget: stage, evt: native, cancelBubble: false, pointerId: g.pointerId };
    const te = toToolEvent(konvaEvt, pos);
    if (te) h.onPointerUp?.(te, eventCtx());
  };
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (g && g.pointerId === e.pointerId) finishGestureRef.current(e);
    };
    const onBlur = () => finishGestureRef.current(null);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  // Unmount (z. B. Wechsel in die 3D-Ansicht): laufende Geste/Werkzeugaktion abbrechen, damit keine Transaktion offen bleibt.
  useEffect(
    () => () => {
      gestureRef.current = null;
      panRef.current = null;
      getTool(useUiStore.getState().tool)?.onCancel?.(eventCtx());
      useUiStore.getState().setDragging(false);
    },
    [eventCtx],
  );

  // Tastatur an Werkzeug weiterreichen (globale Kürzel in useKeyboardShortcuts)
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (modalOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body && typeof t.closest === 'function' && t.closest('[role="dialog"], [role="menu"]')) return;
      const h = getTool(useUiStore.getState().tool);
      if (h?.onKeyDown?.(e, eventCtx())) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', kd, { capture: true });
    return () => window.removeEventListener('keydown', kd, { capture: true });
  }, [eventCtx]);

  const drop = useDropFromLibrary(containerRef, viewport, ctxRef);

  const cursor = panning ? 'grabbing' : tool === 'pan' ? 'grab' : tool === 'select' ? selectCursor : typeof handler?.cursor === 'function' ? handler.cursor(ctx) : handler?.cursor ?? 'default';

  const layerProps = { project, floor, walls, rooms, items, viewport: layerViewport, selection, hoverId, dark, lowerFloor, collidingIds: colliding, presentation, stageSize, cullRect, previewIds };
  const Overlay = handler?.Overlay;
  const HtmlOverlay = handler?.HtmlOverlay;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden touch-none select-none"
      style={{ background: 'var(--gp-canvas)', cursor }}
      onDragOver={drop.onDragOver}
      onDrop={drop.onDrop}
      onDragLeave={drop.onDragLeave}
    >
      {size && (
        <Stage
          ref={setStageRef}
          width={size.width}
          height={size.height}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          x={viewport.x}
          y={viewport.y}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDblClick={onDblClick}
          onContextMenu={onContextMenu}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <GridLayer viewport={viewport} width={size.width} height={size.height} gridSize={settings.gridSize} visible={settings.showGrid && layers.grid && !presentation} />
          <Layer>
            <Group ref={staticGroupRef} listening={false}>
              {layers.lowerFloor && settings.showLowerFloor && lowerFloor && <LowerFloorLayer {...layerProps} />}
              <HallLayer {...layerProps} />
              {(layers.rooms || layers.voids) && <RoomsLayer {...layerProps} />}
              {layers.walls && <WallsLayer {...layerProps} />}
              {layers.openings && <OpeningsLayer {...layerProps} />}
            </Group>
          </Layer>
          <Layer>
            <Group ref={itemsGroupRef} listening={false}>
              {layers.items && <ItemsLayer {...layerProps} />}
              {layers.annotations && <AnnotationsLayer {...layerProps} />}
              {layers.dimensions && !presentation && <DimensionsLayer {...layerProps} />}
            </Group>
          </Layer>
          <Layer>
            {layers.items && <DragPreviewLayer {...layerProps} />}
            {!presentation && <SelectionLayer {...layerProps} />}
            <Group>{Overlay && <Overlay ctx={ctx} />}</Group>
            <SnapGuides viewport={viewport} />
            {drop.preview}
          </Layer>
        </Stage>
      )}
      {size && !presentation && showRulers && <Rulers viewport={viewport} width={size.width} height={size.height} />}
      <ScaleBar viewport={viewport} />
      {size && !presentation && showMinimap && <Minimap floor={floor} viewport={viewport} width={size.width} height={size.height} />}
      {size && HtmlOverlay && <HtmlOverlay ctx={ctx} />}
    </div>
  );
}
