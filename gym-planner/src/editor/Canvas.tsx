import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group } from 'react-konva';
import type Konva from 'konva';
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
import { bbox } from '@/geometry/polygon';
import { itemFootprint } from '@/geometry/transform';
import {
  GridLayer, LowerFloorLayer, HallLayer, RoomsLayer, WallsLayer, OpeningsLayer, ItemsLayer,
  AnnotationsLayer, DimensionsLayer, SelectionLayer,
} from './layers';
import { Rulers } from './overlays/Rulers';
import { ScaleBar } from './overlays/ScaleBar';
import { Minimap } from './overlays/Minimap';
import { SnapGuides } from './overlays/SnapGuides';
import { useDropFromLibrary } from './useDropFromLibrary';
import './tools'; // registriert alle Werkzeuge

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

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const dark = useIsDark();

  const project = useProjectStore((s) => s.project);
  const store = useProjectStore();
  const ui = useUiStore();
  const floor = useActiveFloor();
  const lowerFloor = useLowerFloor();
  const walls = useFloorWalls(floor);
  const rooms = useFloorRooms(floor);
  const items = useFloorVisibleItems(floor);
  const viewport = useUiStore((s) => s.viewport);
  const setViewport = useUiStore((s) => s.setViewport);
  const tool = useUiStore((s) => s.tool);
  const selection = useUiStore((s) => s.selection);
  const hoverId = useUiStore((s) => s.hoverId);
  const presentation = useUiStore((s) => s.presentationMode);
  const fitRequest = useUiStore((s) => s.fitRequest);
  const focusRequest = useUiStore((s) => s.focusRequest);
  const snapOverride = useUiStore((s) => s.snapOverride);
  const layers = project.layers;
  const settings = project.settings;

  // Größe beobachten
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.max(50, Math.floor(r.width)), height: Math.max(50, Math.floor(r.height)) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ width: Math.max(50, Math.floor(r.width)), height: Math.max(50, Math.floor(r.height)) });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setStage(stageRef.current);
    return () => setStage(null);
  }, []);

  // Alles einpassen
  useEffect(() => {
    if (fitRequest === 0 && floor.hall === null) return;
    setViewport(fitToBounds(floorBounds(floor), size.width, size.height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);
  // Beim ersten Anzeigen einpassen
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current || size.width <= 50) return;
    didInitialFit.current = true;
    setViewport(fitToBounds(floorBounds(floor), size.width, size.height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);
  // Fokus-Anfrage (z. B. aus Warnungsliste)
  useEffect(() => {
    if (!focusRequest) return;
    const { point, selection: sel } = focusRequest;
    setViewport((v) => ({ scale: Math.max(v.scale, 0.5), x: size.width / 2 - point.x * Math.max(v.scale, 0.5), y: size.height / 2 - point.y * Math.max(v.scale, 0.5) }));
    if (sel) ui.setSelection([sel]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce]);

  // Kollisionen (memoisiert)
  const colliding = useMemo(() => {
    if (!layers.items) return new Set<string>();
    const wallMountedIds = new Set(items.filter((it) => getDef(it.defId, project)?.wandmontage).map((it) => it.id));
    return collidingIds(findCollisions(items, { includeZones: layers.safetyZones, walls, wallMountedIds }));
  }, [items, walls, layers.items, layers.safetyZones, project]);

  const pxToWorld = useCallback((px: number) => px / viewport.scale, [viewport.scale]);

  const altDown = useRef(false);
  const spaceDown = useRef(false);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { altDown.current = true; ui.setSnapOverride(true); }
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { spaceDown.current = true; e.preventDefault(); }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { altDown.current = false; ui.setSnapOverride(false); }
      if (e.code === 'Space') spaceDown.current = false;
    };
    const blur = () => { altDown.current = false; spaceDown.current = false; ui.setSnapOverride(false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const ctx: ToolContext = useMemo(
    () => ({ project, floor, walls, rooms, items, viewport, store, ui, snap, pxToWorld, stageSize: size }),
    [project, floor, walls, rooms, items, viewport, store, ui, snap, pxToWorld, size],
  );
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const handler = getTool(tool);
  // Werkzeugwechsel → vorheriges abbrechen
  const prevTool = useRef(tool);
  useEffect(() => {
    if (prevTool.current !== tool) {
      getTool(prevTool.current)?.onCancel?.(ctxRef.current);
      prevTool.current = tool;
    }
    getTool(tool)?.onActivate?.(ctxRef.current);
    ui.setStatusHint(getTool(tool)?.hint ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Pan-Zustand
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const lastPointerRef = useRef<Vec2 | null>(null);
  const [panning, setPanning] = useState(false);
  // Pinch-Zoom
  const pinchRef = useRef<{ dist: number; center: Vec2 } | null>(null);

  const toToolEvent = (e: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>): ToolEvent | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const evt = e.evt as PointerEvent;
    return {
      world: screenToWorld(pos, viewport),
      screen: pos,
      shift: !!evt.shiftKey,
      alt: !!evt.altKey,
      ctrl: !!evt.ctrlKey,
      meta: !!evt.metaKey,
      button: (evt as PointerEvent).button ?? 0,
      pointerType: (evt as PointerEvent).pointerType ?? 'mouse',
      evt: e,
      target: e.target,
    };
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    if (e.evt.ctrlKey || e.evt.metaKey || !e.evt.shiftKey) {
      const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1;
      setViewport((v) => zoomAt(v, pos, factor));
    } else {
      setViewport((v) => ({ ...v, x: v.x - e.evt.deltaY, y: v.y - e.evt.deltaX }));
    }
  };

  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    ui.setContextMenu(null);
    const isMiddle = e.evt.button === 1;
    if (isMiddle || spaceDown.current || tool === 'pan') {
      e.evt.preventDefault();
      panRef.current = { startX: pos.x, startY: pos.y, vx: viewport.x, vy: viewport.y };
      setPanning(true);
      return;
    }
    if (e.evt.button === 2) return; // Kontextmenü separat
    const te = toToolEvent(e);
    if (te) handler?.onPointerDown?.(te, ctxRef.current);
  };
  const onPointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    lastPointerRef.current = pos;
    ui.setCursorWorld(screenToWorld(pos, viewport));
    if (panRef.current) {
      const p = panRef.current;
      setViewport((v) => ({ ...v, x: p.vx + (pos.x - p.startX), y: p.vy + (pos.y - p.startY) }));
      return;
    }
    const te = toToolEvent(e);
    if (te) handler?.onPointerMove?.(te, ctxRef.current);
  };
  const onPointerUp = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (panRef.current) { panRef.current = null; setPanning(false); return; }
    const te = toToolEvent(e);
    if (te) handler?.onPointerUp?.(te, ctxRef.current);
  };
  const onDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const te = toToolEvent(e);
    if (te) handler?.onDoubleClick?.(te, ctxRef.current);
  };
  const onContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos || !containerRef.current) return;
    const te = toToolEvent(e);
    if (te && handler?.onContextMenu?.(te, ctxRef.current)) return;
    const rect = containerRef.current.getBoundingClientRect();
    const world = screenToWorld(pos, viewport);
    ui.setContextMenu({ x: rect.left + pos.x, y: rect.top + pos.y, world });
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

  // Tastatur an Werkzeug weiterreichen (globale Kürzel in useKeyboardShortcuts)
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const h = getTool(useUiStore.getState().tool);
      if (h?.onKeyDown?.(e, ctxRef.current)) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', kd, { capture: true });
    return () => window.removeEventListener('keydown', kd, { capture: true });
  }, []);

  const drop = useDropFromLibrary(containerRef, viewport, ctxRef);

  const cursor = panning ? 'grabbing' : tool === 'pan' ? 'grab' : typeof handler?.cursor === 'function' ? handler.cursor(ctx) : handler?.cursor ?? 'default';

  const layerProps = { project, floor, walls, rooms, items, viewport, selection, hoverId, dark, lowerFloor, collidingIds: colliding, presentation, stageSize: size };
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
      <Stage
        ref={stageRef}
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
          {layers.lowerFloor && settings.showLowerFloor && lowerFloor && <LowerFloorLayer {...layerProps} />}
          <HallLayer {...layerProps} />
          {layers.rooms && <RoomsLayer {...layerProps} />}
          {layers.walls && <WallsLayer {...layerProps} />}
          {layers.openings && <OpeningsLayer {...layerProps} />}
        </Layer>
        <Layer>
          {layers.items && <ItemsLayer {...layerProps} />}
          {layers.annotations && <AnnotationsLayer {...layerProps} />}
          {layers.dimensions && !presentation && <DimensionsLayer {...layerProps} />}
        </Layer>
        <Layer>
          {!presentation && <SelectionLayer {...layerProps} />}
          <Group>{Overlay && <Overlay ctx={ctx} />}</Group>
          <SnapGuides viewport={viewport} />
          {drop.preview}
        </Layer>
      </Stage>
      {!presentation && ui.showRulers && <Rulers viewport={viewport} width={size.width} height={size.height} />}
      <ScaleBar viewport={viewport} />
      {!presentation && ui.showMinimap && <Minimap floor={floor} viewport={viewport} width={size.width} height={size.height} />}
      {HtmlOverlay && <HtmlOverlay ctx={ctx} />}
    </div>
  );
}
