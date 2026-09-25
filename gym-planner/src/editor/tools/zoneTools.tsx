/**
 * Zonen-Werkzeuge: 'zone-rect' (Rechteck aufziehen oder Klick–Klick) und 'zone-polygon' (Eckpunkte klicken,
 * Schließen per Klick auf den Startpunkt / Enter / Doppelklick). Beide zeigen Fläche (m²), Umfang und Maße live.
 *
 * Außerdem gemeinsame Helfer für alle Zeichen-Werkzeuge:
 * - `OverlayLabel`: bildschirm-konstantes Etikett in Weltkoordinaten (Konva)
 * - `makeRectDrawTool` / `useRectDraw` / `RectDrawDims`: Rechteck-Zeichenlogik (nutzt auch das Luftraum-Werkzeug)
 * - `measureTextPx`: Textbreite in Pixeln (Canvas-Messung)
 */
import { memo } from 'react';
import { Group, Line, Rect, Circle, Text } from 'react-konva';
import type { Vec2, Tool, RoomType } from '@/types';
import { createClickTracker, type ToolContext, type ToolHandler } from './types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import { useSnapGuides } from '../overlays/SnapGuides';
import { transaction } from '@/store/projectStore';
import { createZone } from '@/store/factories';
import { ROOM_TYPE_MAP, roomColor } from '@/data/roomTypes';
import { rectPolygon, polygonArea, perimeter, centroid, distance, flatten, simplifyPolygon } from '@/geometry/polygon';
import { formatM2, formatLength, cm2ToM2 } from '@/geometry/units';
import { useIsDark } from '@/hooks/useTheme';

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Mindestfläche einer Zone / eines Luftraums in cm² (10 × 10 cm). */
export const MIN_ZONE_AREA_CM2 = 100;
/** Ab dieser Bildschirm-Distanz (px) gilt ein Pointer-Down/-Up als Ziehen statt Klick. */
const DRAG_PX = 5;
/** Fangradius (px) um den Startpunkt zum Schließen eines Polygons. */
const CLOSE_PX = 10;

/* ------------------------------------------------------------------ */
/* Textmessung & Etiketten                                             */
/* ------------------------------------------------------------------ */

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Breite eines Textes in Pixeln (Canvas-Messung; ohne Canvas grobe Schätzung). */
export function measureTextPx(text: string, fontPx: number, bold = false): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      measureCtx = null;
    }
  }
  if (measureCtx) {
    try {
      measureCtx.font = `${bold ? '600 ' : ''}${fontPx}px ${FONT}`;
      const w = measureCtx.measureText(text).width;
      if (Number.isFinite(w) && w > 0) return w;
    } catch {
      /* Fallback unten */
    }
  }
  return text.length * fontPx * 0.58;
}

/** Wo das Etikett relativ zum Ankerpunkt sitzt. */
export type LabelAnchor = 'center' | 'above' | 'below' | 'leftOf' | 'rightOf';
export type LabelTone = 'default' | 'accent' | 'danger' | 'measure' | 'void';

export interface OverlayLabelProps {
  x: number;
  y: number;
  text: string;
  scale: number;
  dark: boolean;
  anchor?: LabelAnchor;
  tone?: LabelTone;
  fontPx?: number;
}

function labelColors(tone: LabelTone, dark: boolean): { bg: string; fg: string; border: string } {
  switch (tone) {
    case 'accent':
      return { bg: dark ? '#3b82f6' : '#2563eb', fg: '#ffffff', border: 'transparent' };
    case 'danger':
      return { bg: '#dc2626', fg: '#ffffff', border: 'transparent' };
    case 'measure':
      return { bg: dark ? '#c2410c' : '#ea580c', fg: '#ffffff', border: 'transparent' };
    case 'void':
      return { bg: dark ? '#1d4ed8' : '#3b82f6', fg: '#ffffff', border: 'transparent' };
    default:
      return dark ? { bg: 'rgba(17,26,46,0.92)', fg: '#e2e8f0', border: '#1f2a44' } : { bg: 'rgba(255,255,255,0.94)', fg: '#0f172a', border: '#e2e8f0' };
  }
}

/** Bildschirm-konstantes Etikett (mehrzeilig per \n) an einem Weltpunkt. */
export const OverlayLabel = memo(function OverlayLabel({ x, y, text, scale, dark, anchor = 'center', tone = 'default', fontPx = 12 }: OverlayLabelProps) {
  const s = 1 / scale;
  const lines = text.split('\n');
  const padX = 6;
  const padY = 3;
  const lh = 1.25;
  let wPx = 0;
  for (const l of lines) wPx = Math.max(wPx, measureTextPx(l, fontPx));
  wPx += padX * 2;
  const hPx = lines.length * fontPx * lh + padY * 2;
  const gap = 7;
  let ox: number;
  let oy: number;
  switch (anchor) {
    case 'below':
      ox = -wPx / 2;
      oy = gap;
      break;
    case 'above':
      ox = -wPx / 2;
      oy = -hPx - gap;
      break;
    case 'rightOf':
      ox = gap;
      oy = -hPx / 2;
      break;
    case 'leftOf':
      ox = -wPx - gap;
      oy = -hPx / 2;
      break;
    default:
      ox = -wPx / 2;
      oy = -hPx / 2;
  }
  const c = labelColors(tone, dark);
  return (
    <Group x={x + ox * s} y={y + oy * s} listening={false}>
      <Rect width={wPx * s} height={hPx * s} fill={c.bg} stroke={c.border} strokeWidth={1 * s} cornerRadius={3 * s} />
      <Text x={padX * s} y={padY * s} text={text} fontSize={fontPx * s} lineHeight={lh} fill={c.fg} fontFamily={FONT} />
    </Group>
  );
});

/* ------------------------------------------------------------------ */
/* Rechteck aufziehen (Zone, Luftraum)                                 */
/* ------------------------------------------------------------------ */

export interface RectDrawState {
  start: Vec2 | null;
  current: Vec2 | null;
  /** Bildschirmposition des Pointer-Down (Klick-vs-Ziehen). */
  downScreen: Vec2 | null;
  /** Klick–Klick-Modus: erster Klick gesetzt, zweiter Klick schließt ab. */
  armed: boolean;
}

/** Transienter Zustand des Rechteck-Zeichnens (von Zone und Luftraum gemeinsam genutzt – nie gleichzeitig aktiv). */
export const useRectDraw = createToolStore<RectDrawState>({ start: null, current: null, downScreen: null, armed: false });

export function resetRectDraw() {
  useRectDraw.getState().reset();
  useSnapGuides.getState().set(null);
}

function snapCorner(ctx: ToolContext, p: Vec2): Vec2 {
  const r = ctx.snap(p, { angleFrom: null });
  useSnapGuides.getState().set(r);
  return r.point;
}

export interface RectDrawSpec {
  id: Tool;
  hint: string;
  /** Mindestfläche in cm² (Standard MIN_ZONE_AREA_CM2). */
  minArea?: number;
  /** Hinweis, wenn das Rechteck zu klein ist. */
  tooSmall: string;
  /** Legt das Element an (Polygon im Uhrzeigersinn, 4 Ecken). */
  commit: (polygon: Vec2[], ctx: ToolContext) => void;
  Overlay: ToolHandler['Overlay'];
}

function finishRect(spec: RectDrawSpec, start: Vec2, end: Vec2, ctx: ToolContext) {
  resetRectDraw();
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  if (w < 1 || h < 1 || w * h < (spec.minArea ?? MIN_ZONE_AREA_CM2)) {
    ctx.ui.toast(spec.tooSmall, 'info');
    return;
  }
  spec.commit(rectPolygon(start, end), ctx);
}

/**
 * Werkzeug „Rechteck aufziehen“: Pointer-Down setzt die erste Ecke, Ziehen + Loslassen schließt ab.
 * Ein Klick ohne Ziehen wechselt in den Klick–Klick-Modus (zweiter Klick = gegenüberliegende Ecke).
 * Esc bricht ab (bei leerem Zustand wird Esc nicht verbraucht → globaler Wechsel auf „Auswahl“).
 */
export function makeRectDrawTool(spec: RectDrawSpec): ToolHandler {
  return {
    id: spec.id,
    cursor: 'crosshair',
    hint: spec.hint,
    Overlay: spec.Overlay,
    onPointerDown: (e, ctx) => {
      if (e.button !== 0) return;
      const st = useRectDraw.getState();
      const p = snapCorner(ctx, e.world);
      if (st.start && st.armed) {
        finishRect(spec, st.start, p, ctx);
        return;
      }
      st.patch({ start: p, current: p, downScreen: e.screen, armed: false });
    },
    onPointerMove: (e, ctx) => {
      const p = snapCorner(ctx, e.world);
      const st = useRectDraw.getState();
      if (st.start) st.patch({ current: p });
    },
    onPointerUp: (e, ctx) => {
      const st = useRectDraw.getState();
      if (!st.start || st.armed || !st.downScreen) return;
      if (distance(e.screen, st.downScreen) <= DRAG_PX) {
        st.patch({ armed: true });
        return;
      }
      finishRect(spec, st.start, snapCorner(ctx, e.world), ctx);
    },
    onKeyDown: (e) => {
      if (e.key === 'Escape' && useRectDraw.getState().start) {
        resetRectDraw();
        return true;
      }
      return false;
    },
    onCancel: () => resetRectDraw(),
  };
}

/** Live-Maße eines Rechtecks: Breite oben, Tiefe links, Text in der Mitte. */
export const RectDrawDims = memo(function RectDrawDims({ start, end, scale, dark, centerText, tone = 'default' }: { start: Vec2; end: Vec2; scale: number; dark: boolean; centerText: string; tone?: LabelTone }) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return (
    <>
      <OverlayLabel x={(minX + maxX) / 2} y={minY} text={formatLength(maxX - minX)} anchor="above" scale={scale} dark={dark} />
      <OverlayLabel x={minX} y={(minY + maxY) / 2} text={formatLength(maxY - minY)} anchor="leftOf" scale={scale} dark={dark} />
      <OverlayLabel x={(minX + maxX) / 2} y={(minY + maxY) / 2} text={centerText} anchor="center" scale={scale} dark={dark} tone={tone} />
    </>
  );
});

/* ------------------------------------------------------------------ */
/* Zonen                                                               */
/* ------------------------------------------------------------------ */

/** Raumtyp aus den Werkzeug-Optionen (Werkzeugleiste setzt `roomType`). */
export function zoneTypeFromOptions(opts: ToolContext['ui']['toolOptions']): RoomType {
  const t = opts.roomType;
  return typeof t === 'string' && t in ROOM_TYPE_MAP ? (t as RoomType) : 'Trainingsfläche Freihantel';
}

/** Legt eine Zone an (ein Undo-Schritt), wählt sie aus, öffnet das Eigenschaften-Panel und wechselt auf „Auswahl“. */
export function commitZone(polygon: Vec2[], ctx: ToolContext): string {
  const zone = createZone({ polygon, name: 'Zone', type: zoneTypeFromOptions(ctx.ui.toolOptions) });
  transaction(() => ctx.store.addZone(ctx.floor.id, zone));
  ctx.ui.setSelection([{ kind: 'zone', id: zone.id }]);
  ctx.ui.setRightPanel('properties');
  ctx.ui.setTool('select');
  if (!ctx.project.layers.rooms) ctx.ui.toast('Ebene „Räume“ ist ausgeblendet – die neue Zone ist nicht sichtbar', 'info');
  return zone.id;
}

function zoneSummary(type: RoomType, poly: Vec2[]): string {
  return `${type}\n${formatM2(cm2ToM2(polygonArea(poly)))} · Umfang ${formatLength(perimeter(poly))}`;
}

const ZoneRectOverlay = memo(function ZoneRectOverlay({ ctx }: { ctx: ToolContext }) {
  const start = useRectDraw((s) => s.start);
  const current = useRectDraw((s) => s.current);
  const dark = useIsDark();
  if (!start || !current) return null;
  const type = zoneTypeFromOptions(ctx.ui.toolOptions);
  const color = roomColor(type);
  const poly = rectPolygon(start, current);
  const pts = flatten(poly);
  const s = 1 / ctx.viewport.scale;
  return (
    <Group listening={false}>
      <Line points={pts} closed fill={color} opacity={0.3} />
      <Line points={pts} closed stroke={color} strokeWidth={1.5 * s} dash={[8 * s, 4 * s]} />
      <RectDrawDims start={start} end={current} scale={ctx.viewport.scale} dark={dark} centerText={zoneSummary(type, poly)} />
    </Group>
  );
});

registerTool(
  makeRectDrawTool({
    id: 'zone-rect',
    hint: 'Zone als Rechteck aufziehen (oder Klick–Klick) · Esc: abbrechen',
    tooSmall: 'Zone zu klein – bitte ein größeres Rechteck aufziehen',
    commit: commitZone,
    Overlay: ZoneRectOverlay,
  }),
);

/* ------------------------------------------------------------------ */
/* Polygon-Zone                                                        */
/* ------------------------------------------------------------------ */

export interface PolyDrawState {
  points: Vec2[];
  cursor: Vec2 | null;
  /** Cursor liegt über dem Startpunkt (Klick schließt). */
  closable: boolean;
}

export const usePolyDraw = createToolStore<PolyDrawState>({ points: [], cursor: null, closable: false });
/** Letzte Klickpositionen: Doppelklick nur bei zwei Klicks an derselben Stelle (Konva prüft nur die Zeit). */
const polyClicks = createClickTracker();

function resetPoly() {
  usePolyDraw.getState().reset();
  useSnapGuides.getState().set(null);
  polyClicks.reset();
}

function snapVertex(ctx: ToolContext, p: Vec2, last: Vec2 | null): Vec2 {
  const r = ctx.snap(p, { angleFrom: last });
  useSnapGuides.getState().set(r);
  return r.point;
}

function closePolygon(ctx: ToolContext) {
  const st = usePolyDraw.getState();
  if (st.points.length < 3) {
    ctx.ui.toast('Mindestens 3 Eckpunkte nötig', 'info');
    return;
  }
  const poly = simplifyPolygon(st.points);
  if (poly.length < 3 || polygonArea(poly) < MIN_ZONE_AREA_CM2) {
    ctx.ui.toast('Zone zu klein oder ohne Fläche – weitere Eckpunkte setzen', 'info');
    return;
  }
  resetPoly();
  commitZone(poly, ctx);
}

const ZonePolyOverlay = memo(function ZonePolyOverlay({ ctx }: { ctx: ToolContext }) {
  const points = usePolyDraw((s) => s.points);
  const cursor = usePolyDraw((s) => s.cursor);
  const closable = usePolyDraw((s) => s.closable);
  const dark = useIsDark();
  if (!points.length) return null;
  const type = zoneTypeFromOptions(ctx.ui.toolOptions);
  const color = roomColor(type);
  const scale = ctx.viewport.scale;
  const s = 1 / scale;
  const last = points[points.length - 1];
  const rubberTo = closable ? points[0] : cursor;
  const preview = rubberTo && !closable ? [...points, rubberTo] : points;
  const showArea = preview.length >= 3;
  const c = showArea ? centroid(preview) : null;
  const dotFill = dark ? '#0f172a' : '#ffffff';
  return (
    <Group listening={false}>
      {showArea && <Line points={flatten(preview)} closed fill={color} opacity={0.25} />}
      {points.length > 1 && <Line points={flatten(points)} stroke={color} strokeWidth={2 * s} lineJoin="round" />}
      {rubberTo && <Line points={[last.x, last.y, rubberTo.x, rubberTo.y]} stroke={color} strokeWidth={1.5 * s} dash={[8 * s, 4 * s]} />}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={(i === 0 && closable ? 6 : 3.5) * s} fill={i === 0 && closable ? color : dotFill} stroke={color} strokeWidth={1.5 * s} />
      ))}
      {rubberTo && !closable && distance(last, rubberTo) >= 1 && (
        <OverlayLabel x={(last.x + rubberTo.x) / 2} y={(last.y + rubberTo.y) / 2} text={formatLength(distance(last, rubberTo))} anchor="above" scale={scale} dark={dark} />
      )}
      {closable && <OverlayLabel x={points[0].x} y={points[0].y} text="Klicken zum Schließen" anchor="above" tone="accent" scale={scale} dark={dark} />}
      {c && <OverlayLabel x={c.x} y={c.y} text={zoneSummary(type, preview)} anchor="center" scale={scale} dark={dark} />}
    </Group>
  );
});

registerTool({
  id: 'zone-polygon',
  cursor: 'crosshair',
  hint: 'Eckpunkte klicken · Klick auf Startpunkt / Enter / Doppelklick: schließen · Rücktaste: letzter Punkt · Esc: abbrechen',
  Overlay: ZonePolyOverlay,
  onPointerDown: (e, ctx) => {
    if (e.button !== 0) return;
    polyClicks.down(e.screen);
    const st = usePolyDraw.getState();
    const last = st.points.length ? st.points[st.points.length - 1] : null;
    if (st.points.length >= 3 && distance(e.world, st.points[0]) <= ctx.pxToWorld(CLOSE_PX)) {
      closePolygon(ctx);
      return;
    }
    const p = snapVertex(ctx, e.world, last);
    if (last && distance(last, p) < 1) return;
    st.patch({ points: [...st.points, p], cursor: p, closable: false });
  },
  onPointerMove: (e, ctx) => {
    const st = usePolyDraw.getState();
    const last = st.points.length ? st.points[st.points.length - 1] : null;
    const closable = st.points.length >= 3 && distance(e.world, st.points[0]) <= ctx.pxToWorld(CLOSE_PX);
    if (closable) {
      useSnapGuides.getState().set(null);
      st.patch({ cursor: st.points[0], closable: true });
      return;
    }
    st.patch({ cursor: snapVertex(ctx, e.world, last), closable: false });
  },
  onDoubleClick: (_e, ctx) => {
    // Zwei schnelle Klicks an verschiedenen Stellen sind zwei Eckpunkte, kein Doppelklick.
    if (!polyClicks.isDoubleClick()) return;
    const st = usePolyDraw.getState();
    if (st.points.length < 3) return;
    // Der zweite Klick des Doppelklicks hat ggf. einen fast identischen Punkt angehängt → entfernen.
    const n = st.points.length;
    if (n >= 4 && distance(st.points[n - 1], st.points[n - 2]) <= ctx.pxToWorld(6)) st.patch({ points: st.points.slice(0, -1) });
    closePolygon(ctx);
  },
  onKeyDown: (e, ctx) => {
    const st = usePolyDraw.getState();
    if (!st.points.length) return false;
    if (e.key === 'Enter') {
      closePolygon(ctx);
      return true;
    }
    if (e.key === 'Escape') {
      resetPoly();
      return true;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      st.patch({ points: st.points.slice(0, -1), closable: false });
      return true;
    }
    return false;
  },
  onCancel: () => resetPoly(),
});
