/**
 * Werkzeuge „Halle“: Rechteck aufziehen (Live-Maße, Shift = Quadrat, alternativ Maße eintippen) und
 * Polygon zeichnen (Klick-Kette mit 90°/45°-Snapping, Schließen per Klick auf den Startpunkt,
 * Enter oder Doppelklick). Ergebnis wird über store.setHall angelegt (ein Undo-Schritt).
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Group, Line, Circle } from 'react-konva';
import { Check, Undo2, X } from 'lucide-react';
import type { Floor, Hall, Id, Opening, Vec2 } from '@/types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import { createClickTracker, roundPolygon, type ToolContext, type ToolEvent } from './types';
import { MeasureLabel } from './wallTool';
import { useSnapGuides } from '../overlays/SnapGuides';
import { transaction } from '@/store/projectStore';
import { DEFAULT_OUTER_WALL_THICKNESS } from '@/store/factories';
import { useIsDark } from '@/hooks/useTheme';
import { hallWalls, isHallWallId, nearestWall, pointOnWall, clampOpeningOffset, wallLength } from '@/geometry/walls';
import {
  rectPolygon, bbox, flatten, distance, polygonArea, polygonAreaM2, ensureClockwise, simplifyPolygon, segmentIntersection, centroid,
} from '@/geometry/polygon';
import { formatM, formatM2, formatLength, parseNumber, formatNumber } from '@/geometry/units';

/* ------------------------------------------------------------------ */
/* Konstanten & Zustand                                                */
/* ------------------------------------------------------------------ */

/** Mindest-Seitenlänge der Halle (cm) beim Aufziehen. */
export const MIN_HALL_SIDE_CM = 100;
/** Mindestfläche der Halle (cm²) = 1 m². */
export const MIN_HALL_AREA_CM2 = 10000;
/** Klick-Radius (px) um den Startpunkt, der das Polygon schließt. */
const CLOSE_PX = 12;
/** Bis zu diesem Abstand (cm) werden Öffnungen der alten Außenwand beim Neuzeichnen der Halle an die nächste neue Außenwand gehängt. */
export const HALL_OPENING_REATTACH_CM = 100;

export interface HallToolState {
  /** Rechteck: Start- und aktueller Punkt beim Ziehen (gesnappt). */
  dragStart: Vec2 | null;
  dragCurrent: Vec2 | null;
  /** Polygon: gesetzte Eckpunkte. */
  points: Vec2[];
  /** Gesnappter Cursor (Polygon-Vorschau). */
  cursor: Vec2 | null;
  /** Cursor liegt über dem Startpunkt (Schließen möglich). */
  nearStart: boolean;
}

const INITIAL: HallToolState = { dragStart: null, dragCurrent: null, points: [], cursor: null, nearStart: false };

/** Transienter Zustand der Hallenwerkzeuge (reaktiv für Overlays). */
export const useHallTool = createToolStore<HallToolState>(INITIAL);

/* ------------------------------------------------------------------ */
/* Reine Helfer                                                        */
/* ------------------------------------------------------------------ */

/** Gegenüberliegende Ecke beim Aufziehen; `square` erzwingt gleiche Seitenlängen (größere gewinnt). */
export function dragCorner(start: Vec2, current: Vec2, square: boolean): Vec2 {
  let dx = current.x - start.x;
  let dy = current.y - start.y;
  if (square) {
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * m;
    dy = (dy < 0 ? -1 : 1) * m;
  }
  return { x: start.x + dx, y: start.y + dy };
}

/** Rechteck aus Start- und aktuellem Punkt (Polygon im Uhrzeigersinn). */
export function rectFromDrag(start: Vec2, current: Vec2, square: boolean): Vec2[] {
  return rectPolygon(start, dragCorner(start, current, square));
}

/** Prüft, ob sich nicht benachbarte Kanten eines geschlossenen Polygons echt schneiden. */
export function polygonSelfIntersects(poly: Vec2[]): boolean {
  const n = poly.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      if (segmentIntersection(a1, a2, b1, b2, false)) return true;
    }
  }
  return false;
}

/** Halle aus Polygon und Werkzeugoptionen (wallThickness, floorCovering); Polygon wird vereinfacht und im Uhrzeigersinn normalisiert. */
export function hallFromPolygon(polygon: Vec2[], opts: Record<string, string | number | boolean>): Hall {
  const t = Number(opts.wallThickness);
  const covering = typeof opts.floorCovering === 'string' && opts.floorCovering.trim() ? opts.floorCovering : 'Gummiboden';
  return {
    polygon: roundPolygon(ensureClockwise(simplifyPolygon(polygon))),
    wallThickness: Number.isFinite(t) && t > 0 ? t : DEFAULT_OUTER_WALL_THICKNESS,
    floorCovering: covering,
  };
}

/** Grund, warum ein Polygon (noch) keine gültige Halle ist – null = gültig. */
export function hallPolygonProblem(polygon: Vec2[]): string | null {
  const pts = simplifyPolygon(polygon);
  if (pts.length < 3) return 'Mindestens drei Eckpunkte nötig.';
  if (polygonSelfIntersects(pts)) return 'Der Umriss überschneidet sich selbst – bitte Punkte korrigieren (Backspace entfernt den letzten Punkt).';
  if (polygonArea(pts) < MIN_HALL_AREA_CM2) return 'Die Halle muss mindestens 1 m² groß sein.';
  return null;
}

function floorHasContent(floor: Floor): boolean {
  return floor.walls.length > 0 || floor.items.length > 0 || floor.zones.length > 0 || floor.openings.length > 0 || floor.voids.length > 0;
}

export interface HallReattachPlan {
  /** Öffnungen, die an eine neue Außenwand wandern. */
  update: { id: Id; wallId: Id; offset: number }[];
  /** Öffnungen ohne passende neue Außenwand (werden gelöscht). */
  remove: Id[];
}

/**
 * Öffnungen an den alten Hallen-Außenwänden (`hall_<i>`) beim Ersetzen des Hallenumrisses umhängen (rein):
 * Jede Öffnung wird über ihre Weltposition an die nächste neue Außenwand innerhalb `maxDist` gehängt (Offset projiziert
 * und auf die Wandlänge begrenzt); gibt es keine, wird sie entfernt. Öffnungen an echten Wänden bleiben unberührt.
 */
export function reattachHallOpenings(openings: Opening[], oldHall: Hall | null, newHall: Hall, maxDist = HALL_OPENING_REATTACH_CM): HallReattachPlan {
  const plan: HallReattachPlan = { update: [], remove: [] };
  const oldWalls = new Map((oldHall ? hallWalls(oldHall) : []).map((w) => [w.id, w]));
  const newWalls = hallWalls(newHall).filter((w) => wallLength(w) >= 1);
  for (const o of openings) {
    if (!isHallWallId(o.wallId)) continue;
    const oldWall = oldWalls.get(o.wallId);
    if (!oldWall) {
      plan.remove.push(o.id);
      continue;
    }
    const center = pointOnWall(oldWall, o.offset);
    const hit = nearestWall(newWalls, center, maxDist);
    if (!hit) {
      plan.remove.push(o.id);
      continue;
    }
    const offset = clampOpeningOffset(hit.offset, o.width, hit.wall);
    if (hit.wall.id !== o.wallId || Math.abs(offset - o.offset) > 1e-6) plan.update.push({ id: o.id, wallId: hit.wall.id, offset });
  }
  return plan;
}

/** Legt die Halle an (ersetzt eine vorhandene nach Rückfrage), wechselt zur Auswahl und passt die Ansicht ein. */
function commitHall(ctx: ToolContext, polygon: Vec2[]): boolean {
  const problem = hallPolygonProblem(polygon);
  if (problem) {
    ctx.ui.toast(problem, 'warning');
    return false;
  }
  const floor = ctx.floor;
  if (floor.hall && floorHasContent(floor)) {
    const ok = window.confirm(
      'Auf diesem Stockwerk gibt es bereits eine Halle mit Wänden oder Objekten.\nSoll der Hallenumriss ersetzt werden? Wände und Objekte bleiben erhalten, liegen danach aber möglicherweise außerhalb. Türen und Fenster in der Außenwand werden auf die nächstliegende neue Außenwand übernommen oder – ohne passende Wand in der Nähe – entfernt.',
    );
    if (!ok) return false;
  }
  const hall = hallFromPolygon(polygon, ctx.ui.toolOptions);
  const plan = reattachHallOpenings(floor.openings, floor.hall, hall);
  const store = ctx.store;
  transaction(() => {
    store.setHall(floor.id, hall);
    for (const u of plan.update) store.updateOpening(floor.id, u.id, { wallId: u.wallId, offset: u.offset });
    if (plan.remove.length) store.deleteOpenings(floor.id, plan.remove);
  });
  useHallTool.getState().reset();
  useSnapGuides.getState().set(null);
  clicks.reset();
  ctx.ui.toast(`Halle angelegt · ${formatM2(polygonAreaM2(hall.polygon))}`, 'success');
  if (plan.remove.length) {
    ctx.ui.toast(
      plan.remove.length === 1 ? '1 Öffnung der alten Außenwand entfernt – keine neue Außenwand in der Nähe' : `${plan.remove.length} Öffnungen der alten Außenwand entfernt – keine neue Außenwand in der Nähe`,
      'warning',
    );
  }
  ctx.ui.setTool('select');
  ctx.ui.requestFit();
  return true;
}

/** Letzte Klickpositionen (Polygon-Werkzeug): Doppelklick nur bei zwei Klicks an derselben Stelle. */
const clicks = createClickTracker();

function cancelHallTool(): void {
  useHallTool.getState().reset();
  useSnapGuides.getState().set(null);
  clicks.reset();
}

function snapAt(e: ToolEvent, ctx: ToolContext, angleFrom: Vec2 | null) {
  return ctx.snap(e.world, { angleFrom, targets: { 'item-edge': false } });
}

/* ------------------------------------------------------------------ */
/* Rechteck                                                            */
/* ------------------------------------------------------------------ */

registerTool({
  id: 'hall-rect',
  cursor: 'crosshair',
  hint: 'Rechteck aufziehen (Shift: Quadrat) oder Maße oben links eingeben · Esc: abbrechen',
  onActivate: cancelHallTool,
  onCancel: cancelHallTool,
  onPointerDown: (e, ctx) => {
    if (e.button !== 0) return;
    const r = snapAt(e, ctx, null);
    useSnapGuides.getState().set(r);
    useHallTool.getState().patch({ dragStart: r.point, dragCurrent: r.point });
  },
  onPointerMove: (e, ctx) => {
    const st = useHallTool.getState();
    const r = snapAt(e, ctx, null);
    useSnapGuides.getState().set(r);
    if (!st.dragStart) return;
    // Maus außerhalb des Canvas losgelassen → Ziehen abbrechen (Touch meldet keine buttons)
    if (e.pointerType !== 'touch' && e.buttons === 0) {
      st.patch({ dragStart: null, dragCurrent: null });
      return;
    }
    const cur = dragCorner(st.dragStart, r.point, e.shift);
    if (!st.dragCurrent || st.dragCurrent.x !== cur.x || st.dragCurrent.y !== cur.y) st.patch({ dragCurrent: cur });
  },
  onPointerUp: (e, ctx) => {
    const st = useHallTool.getState();
    if (!st.dragStart) return;
    const start = st.dragStart;
    const r = snapAt(e, ctx, null);
    const poly = rectFromDrag(start, r.point, e.shift);
    st.patch({ dragStart: null, dragCurrent: null });
    const b = bbox(poly);
    const w = b.maxX - b.minX;
    const d = b.maxY - b.minY;
    if (w < ctx.pxToWorld(3) && d < ctx.pxToWorld(3)) return; // Klick ohne Ziehen → Eingabefelder nutzen
    if (w < MIN_HALL_SIDE_CM || d < MIN_HALL_SIDE_CM) {
      ctx.ui.toast('Halle mindestens 1 × 1 m groß aufziehen.', 'warning');
      return;
    }
    commitHall(ctx, poly);
  },
  onKeyDown: (e) => {
    const st = useHallTool.getState();
    if (e.key === 'Escape' && st.dragStart) {
      st.patch({ dragStart: null, dragCurrent: null });
      return true;
    }
    return false;
  },
  Overlay: HallRectOverlay,
  HtmlOverlay: HallRectHtmlOverlay,
});

function HallRectOverlay({ ctx }: { ctx: ToolContext }) {
  const dragStart = useHallTool((s) => s.dragStart);
  const dragCurrent = useHallTool((s) => s.dragCurrent);
  const dark = useIsDark();
  const s = 1 / ctx.viewport.scale;
  if (!dragStart || !dragCurrent) return null;
  const poly = rectPolygon(dragStart, dragCurrent);
  const b = bbox(poly);
  const w = b.maxX - b.minX;
  const d = b.maxY - b.minY;
  const tooSmall = w < MIN_HALL_SIDE_CM || d < MIN_HALL_SIDE_CM;
  const accent = tooSmall ? (dark ? '#fbbf24' : '#d97706') : dark ? '#60a5fa' : '#2563eb';
  const soft = tooSmall ? 'rgba(217,119,6,0.12)' : dark ? 'rgba(96,165,250,0.14)' : 'rgba(37,99,235,0.10)';
  return (
    <Group listening={false}>
      <Line points={flatten(poly)} closed fill={soft} stroke={accent} strokeWidth={1.5 * s} dash={[8 * s, 4 * s]} />
      {w > 0 && <MeasureLabel x={(b.minX + b.maxX) / 2} y={b.minY - 6 * s} text={formatM(w)} s={s} dark={dark} anchorY={1} />}
      {d > 0 && <MeasureLabel x={b.minX - 6 * s} y={(b.minY + b.maxY) / 2} text={formatM(d)} s={s} dark={dark} anchorX={1} />}
      {w > 0 && d > 0 && (
        <MeasureLabel x={(b.minX + b.maxX) / 2} y={(b.minY + b.maxY) / 2} text={`${formatM(w)} × ${formatM(d)}\n${formatM2(polygonAreaM2(poly))}`} s={s} dark={dark} fontSize={13} accent={!tooSmall} />
      )}
    </Group>
  );
}

function hallDims(hall: Hall | null): { w: string; d: string } {
  if (!hall || hall.polygon.length < 3) return { w: '20', d: '12' };
  const b = bbox(hall.polygon);
  return { w: formatNumber((b.maxX - b.minX) / 100, 2), d: formatNumber((b.maxY - b.minY) / 100, 2) };
}

/** Eingabefelder „Breite/Tiefe (m)“ oben links: legt die Halle mit Ursprung (0,0) ohne Ziehen an. */
function HallRectHtmlOverlay({ ctx }: { ctx: ToolContext }) {
  const initial = useMemo(() => hallDims(ctx.floor.hall), [ctx.floor.hall]);
  const [w, setW] = useState(initial.w);
  const [d, setD] = useState(initial.d);
  useEffect(() => {
    setW(initial.w);
    setD(initial.d);
  }, [initial]);
  const dragStart = useHallTool((s) => s.dragStart);
  const dragCurrent = useHallTool((s) => s.dragCurrent);
  const wm = parseNumber(w);
  const dm = parseNumber(d);
  const valid = wm != null && dm != null && wm >= 1 && dm >= 1 && wm <= 1000 && dm <= 1000;
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!valid || wm == null || dm == null) {
      ctx.ui.toast('Bitte Breite und Tiefe zwischen 1 m und 1000 m angeben.', 'warning');
      return;
    }
    commitHall(ctx, rectPolygon({ x: 0, y: 0 }, { x: Math.round(wm * 100), y: Math.round(dm * 100) }));
  };
  // Beim Aufziehen zeigen Felder und Flächenvorschau die Zieh-Maße (nicht die zuletzt getippten Werte).
  let live: string | null = null;
  let shownW = w;
  let shownD = d;
  let areaM2 = valid && wm != null && dm != null ? wm * dm : null;
  if (dragStart && dragCurrent) {
    const b = bbox(rectPolygon(dragStart, dragCurrent));
    const lw = b.maxX - b.minX;
    const ld = b.maxY - b.minY;
    live = `${formatM(lw)} × ${formatM(ld)} · ${formatM2((lw * ld) / 10000)}`;
    shownW = formatNumber(lw / 100, 2);
    shownD = formatNumber(ld / 100, 2);
    areaM2 = (lw * ld) / 10000;
  }
  return (
    <form className="absolute left-8 top-8 z-10 flex w-[240px] flex-col gap-2 rounded-md border p-3 text-xs shadow-md gp-panel" onSubmit={submit} onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Halle anlegen</span>
        <kbd className="gp-kbd">H</kbd>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="gp-label">Breite (m)</span>
          <input className="gp-input" inputMode="decimal" value={shownW} readOnly={!!live} onChange={(e) => setW(e.target.value)} aria-label="Breite in Metern" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="gp-label">Tiefe (m)</span>
          <input className="gp-input" inputMode="decimal" value={shownD} readOnly={!!live} onChange={(e) => setD(e.target.value)} aria-label="Tiefe in Metern" />
        </label>
      </div>
      {areaM2 != null && <span className="gp-muted">Fläche: {formatM2(areaM2)}</span>}
      <button type="submit" className="gp-btn gp-btn-primary justify-center" disabled={!valid}>
        <Check size={14} /> Halle anlegen
      </button>
      <p className="gp-muted leading-snug">{live ? <span className="font-medium" style={{ color: 'var(--gp-text)' }}>{live}</span> : 'Oder Rechteck im Plan aufziehen – Shift erzwingt ein Quadrat.'}</p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Polygon                                                             */
/* ------------------------------------------------------------------ */

function closePolygon(ctx: ToolContext): void {
  const st = useHallTool.getState();
  if (st.points.length < 3) {
    ctx.ui.toast('Mindestens drei Eckpunkte setzen, dann schließen.', 'info');
    return;
  }
  commitHall(ctx, st.points);
}

function removeLastPoint(): boolean {
  const st = useHallTool.getState();
  if (!st.points.length) return false;
  st.patch({ points: st.points.slice(0, -1), nearStart: false });
  return true;
}

registerTool({
  id: 'hall-polygon',
  cursor: 'crosshair',
  hint: 'Klick: Eckpunkt setzen · Klick auf Startpunkt / Enter / Doppelklick: schließen · Backspace: letzter Punkt · Esc: abbrechen',
  onActivate: cancelHallTool,
  onCancel: cancelHallTool,
  onPointerDown: (e, ctx) => {
    if (e.button !== 0) return;
    clicks.down(e.screen);
    const st = useHallTool.getState();
    const pts = st.points;
    if (pts.length >= 3 && distance(e.world, pts[0]) <= ctx.pxToWorld(CLOSE_PX)) {
      closePolygon(ctx);
      return;
    }
    const last = pts.length ? pts[pts.length - 1] : null;
    const r = snapAt(e, ctx, last);
    useSnapGuides.getState().set(r);
    if (last && distance(last, r.point) < Math.max(1, ctx.pxToWorld(3))) return; // Doppelklick-Zweitklick / Wackler
    st.patch({ points: [...pts, r.point], cursor: r.point, nearStart: false });
  },
  onPointerMove: (e, ctx) => {
    const st = useHallTool.getState();
    const pts = st.points;
    const last = pts.length ? pts[pts.length - 1] : null;
    const nearStart = pts.length >= 3 && distance(e.world, pts[0]) <= ctx.pxToWorld(CLOSE_PX);
    const r = nearStart ? { point: pts[0], kind: 'wall-end' as const, guides: [] } : snapAt(e, ctx, last);
    useSnapGuides.getState().set(r);
    if (!st.cursor || st.cursor.x !== r.point.x || st.cursor.y !== r.point.y || st.nearStart !== nearStart) st.patch({ cursor: r.point, nearStart });
  },
  onDoubleClick: (_e, ctx) => {
    // Zwei schnelle Klicks an verschiedenen Stellen sind zwei Eckpunkte, kein Doppelklick.
    if (!clicks.isDoubleClick()) return;
    if (useHallTool.getState().points.length >= 3) closePolygon(ctx);
  },
  onKeyDown: (e, ctx) => {
    const st = useHallTool.getState();
    if (e.ctrlKey || e.metaKey) return false;
    if (e.key === 'Escape') {
      if (!st.points.length) return false;
      cancelHallTool();
      return true;
    }
    if (e.key === 'Enter') {
      if (!st.points.length) return false;
      closePolygon(ctx);
      return true;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') return removeLastPoint();
    return false;
  },
  Overlay: HallPolygonOverlay,
  HtmlOverlay: HallPolygonHtmlOverlay,
});

function HallPolygonOverlay({ ctx }: { ctx: ToolContext }) {
  const points = useHallTool((s) => s.points);
  const cursor = useHallTool((s) => s.cursor);
  const nearStart = useHallTool((s) => s.nearStart);
  const dark = useIsDark();
  const s = 1 / ctx.viewport.scale;
  const accent = dark ? '#60a5fa' : '#2563eb';
  const soft = dark ? 'rgba(96,165,250,0.14)' : 'rgba(37,99,235,0.10)';
  const preview = useMemo(() => (cursor && points.length ? [...points, cursor] : points), [points, cursor]);
  if (!points.length) return null;
  const last = points[points.length - 1];
  const showArea = preview.length >= 3;
  const area = showArea ? polygonAreaM2(preview) : 0;
  const c = showArea ? centroid(preview) : null;
  const segLen = cursor ? distance(last, cursor) : 0;
  const mid = cursor ? { x: (last.x + cursor.x) / 2, y: (last.y + cursor.y) / 2 } : null;
  return (
    <Group listening={false}>
      {showArea && <Line points={flatten(preview)} closed fill={soft} stroke={accent} strokeWidth={1 * s} dash={[8 * s, 4 * s]} />}
      <Line points={flatten(points)} stroke={accent} strokeWidth={2 * s} lineJoin="round" />
      {cursor && !nearStart && <Line points={[last.x, last.y, cursor.x, cursor.y]} stroke={accent} strokeWidth={1.5 * s} dash={[6 * s, 4 * s]} />}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? 5 : 3.5) * s} fill={i === 0 && nearStart ? accent : dark ? '#0f172a' : '#ffffff'} stroke={accent} strokeWidth={1.5 * s} />
      ))}
      {nearStart && <Circle x={points[0].x} y={points[0].y} radius={10 * s} stroke={accent} strokeWidth={1.5 * s} dash={[3 * s, 3 * s]} />}
      {mid && !nearStart && segLen >= 1 && <MeasureLabel x={mid.x} y={mid.y - 8 * s} text={formatLength(segLen)} s={s} dark={dark} anchorY={1} />}
      {c && <MeasureLabel x={c.x} y={c.y} text={`${formatM2(area)}${points.length < 3 ? '\n(noch offen)' : ''}`} s={s} dark={dark} fontSize={13} accent={points.length >= 3} />}
    </Group>
  );
}

/** Status und Schaltflächen (Schließen / Punkt zurück / Abbrechen) – auch für Touch ohne Tastatur. */
function HallPolygonHtmlOverlay({ ctx }: { ctx: ToolContext }) {
  const points = useHallTool((s) => s.points);
  const cursor = useHallTool((s) => s.cursor);
  const preview = cursor && points.length ? [...points, cursor] : points;
  const area = preview.length >= 3 ? polygonAreaM2(preview) : null;
  return (
    <div className="absolute left-8 top-8 z-10 flex w-[240px] flex-col gap-2 rounded-md border p-3 text-xs shadow-md gp-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Halle als Polygon</span>
        <span className="gp-muted">
          {points.length} {points.length === 1 ? 'Punkt' : 'Punkte'}
        </span>
      </div>
      {area != null && (
        <span>
          Fläche: <strong className="font-semibold">{formatM2(area)}</strong>
        </span>
      )}
      {points.length === 0 ? (
        <p className="gp-muted leading-snug">Eckpunkte nacheinander anklicken. Winkel rasten bei 90°/45° ein, Alt schaltet das Snapping aus.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="gp-btn gp-btn-primary px-2 py-1" disabled={points.length < 3} onClick={() => closePolygon(ctx)} title="Polygon schließen (Enter)">
            <Check size={14} /> Schließen
          </button>
          <button type="button" className="gp-btn px-2 py-1" onClick={() => removeLastPoint()} title="Letzten Punkt entfernen (Backspace)">
            <Undo2 size={14} /> Punkt
          </button>
          <button type="button" className="gp-btn px-2 py-1" onClick={() => cancelHallTool()} title="Abbrechen (Esc)">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
