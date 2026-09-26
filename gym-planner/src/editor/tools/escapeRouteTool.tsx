/**
 * Werkzeug „Fluchtweg“ ('escape-route'): Klicks setzen die Punkte einer Polylinie (Snapping wie Messlinie, Shift = 45°),
 * die Bewegung zeigt Linie und laufende Länge. Doppelklick oder Enter beendet (≥ 2 Punkte), Rücktaste entfernt den
 * letzten Punkt, Esc bricht ab. Ein Klick in der Nähe (≤ EXIT_SNAP_CM) einer Notausgangstür rastet auf die Türmitte
 * und beendet den Fluchtweg automatisch. Das Ergebnis ist eine Anmerkung `EscapeRoute` (ein Undo-Schritt), Label
 * „Fluchtweg n“; danach ist die Anmerkung gewählt und das Auswahl-Werkzeug aktiv.
 */
import { memo } from 'react';
import { Group, Line, Circle, Arrow } from 'react-konva';
import type { Vec2, Floor } from '@/types';
import { createClickTracker, roundVec, type ToolContext, type ToolEvent } from './types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import { useSnapGuides } from '../overlays/SnapGuides';
import { transaction } from '@/store/projectStore';
import { newId } from '@/utils/id';
import { snapMeasurePoint } from './measureTool';
import { distance } from '@/geometry/polygon';
import { formatLength } from '@/geometry/units';
import { emergencyExitsOf, exitSnap, polylineLength, type EmergencyExit } from '@/geometry/escapeRoutes';
import { useIsDark } from '@/hooks/useTheme';
import { OverlayLabel } from './zoneTools';

/** Fangabstand (cm) zur Türmitte einer Notausgangstür – Klick rastet ein und beendet. */
export const EXIT_SNAP_CM = 60;
/** Mindestabstand (cm) zweier aufeinanderfolgender Punkte. */
const MIN_STEP_CM = 1;

export interface EscapeRouteState {
  points: Vec2[];
  cursor: Vec2 | null;
  /** Cursor rastet auf diesen Notausgang (Klick beendet). */
  exit: EmergencyExit | null;
}

export const useEscapeRoute = createToolStore<EscapeRouteState>({ points: [], cursor: null, exit: null });
const clicks = createClickTracker();

function resetRoute() {
  useEscapeRoute.getState().reset();
  useSnapGuides.getState().set(null);
  clicks.reset();
}

/** Nächste freie Nummer für „Fluchtweg n“ (n = Anzahl vorhandener Fluchtwege + 1). */
export function nextRouteLabel(floor: Pick<Floor, 'annotations'>): string {
  const n = floor.annotations.filter((a) => a.kind === 'escape-route').length + 1;
  return `Fluchtweg ${n}`;
}

/**
 * Zielpunkt für einen Klick/eine Bewegung: in Reichweite einer Notausgangstür deren Türmitte (Snap auf die Tür),
 * sonst das normale Punkt-Snapping (mit Shift 45° vom letzten Punkt).
 */
export function resolveRoutePoint(ctx: ToolContext, e: Pick<ToolEvent, 'world' | 'shift'>, last: Vec2 | null, exits: EmergencyExit[] = emergencyExitsOf(ctx.floor)): { point: Vec2; exit: EmergencyExit | null } {
  const exit = exitSnap(e.world, exits, EXIT_SNAP_CM);
  if (exit) return { point: exit.center, exit };
  const r = snapMeasurePoint(ctx, e, last);
  useSnapGuides.getState().set(r);
  return { point: r.point, exit: null };
}

/** Legt die Fluchtweg-Anmerkung an (ein Undo-Schritt), wählt sie aus und wechselt auf „Auswahl“. */
export function commitRoute(points: Vec2[], ctx: ToolContext): string | null {
  resetRoute();
  const pts = points.map(roundVec);
  if (pts.length < 2 || polylineLength(pts) < MIN_STEP_CM) {
    ctx.ui.toast('Mindestens 2 Punkte nötig – Klicks setzen Punkte, Doppelklick/Enter beendet', 'info');
    return null;
  }
  const id = newId('a_');
  const label = nextRouteLabel(ctx.floor);
  transaction(() => ctx.store.addAnnotation(ctx.floor.id, { id, kind: 'escape-route', points: pts, label }));
  ctx.ui.setSelection([{ kind: 'annotation', id }]);
  ctx.ui.setRightPanel('properties');
  ctx.ui.setTool('select');
  if (!ctx.project.layers.annotations) ctx.ui.toast('Ebene „Anmerkungen“ ist ausgeblendet – der Fluchtweg ist nicht sichtbar', 'info');
  return id;
}

function finish(ctx: ToolContext) {
  const st = useEscapeRoute.getState();
  if (st.points.length < 2) {
    ctx.ui.toast('Mindestens 2 Punkte nötig', 'info');
    return;
  }
  commitRoute(st.points, ctx);
}

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

const EscapeRouteOverlay = memo(function EscapeRouteOverlay({ ctx }: { ctx: ToolContext }) {
  const points = useEscapeRoute((s) => s.points);
  const cursor = useEscapeRoute((s) => s.cursor);
  const exit = useEscapeRoute((s) => s.exit);
  const dark = useIsDark();
  const scale = ctx.viewport.scale;
  const s = 1 / scale;
  const color = dark ? '#4ade80' : '#16a34a';
  const dotFill = dark ? '#0f172a' : '#ffffff';
  const exitColor = dark ? '#60a5fa' : '#2563eb';
  const nodes: React.ReactNode[] = [];
  if (exit) {
    nodes.push(<Circle key="exit" x={exit.center.x} y={exit.center.y} radius={10 * s} stroke={exitColor} strokeWidth={2 * s} dash={[4 * s, 3 * s]} />);
    nodes.push(<OverlayLabel key="exitlabel" x={exit.center.x} y={exit.center.y} text={points.length ? 'Klick: am Notausgang beenden' : 'Notausgang – Startpunkt woanders setzen'} anchor="below" tone="accent" fontPx={11} scale={scale} dark={dark} />);
  }
  if (!points.length) {
    return <Group listening={false}>{nodes}</Group>;
  }
  const last = points[points.length - 1];
  const rubber = cursor && distance(last, cursor) >= 0.5 ? cursor : null;
  const flat: number[] = [];
  for (const p of points) flat.push(p.x, p.y);
  const total = polylineLength(points);
  const seg = rubber ? distance(last, rubber) : 0;
  return (
    <Group listening={false}>
      {points.length > 1 && <Line points={flat} stroke={color} strokeWidth={2.5 * s} lineJoin="round" lineCap="round" dash={[12 * s, 6 * s]} />}
      {rubber && <Arrow points={[last.x, last.y, rubber.x, rubber.y]} stroke={color} fill={color} strokeWidth={2 * s} dash={[8 * s, 4 * s]} pointerLength={10 * s} pointerWidth={9 * s} />}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? 5 : 3.5) * s} fill={i === 0 ? color : dotFill} stroke={color} strokeWidth={1.5 * s} />
      ))}
      {rubber && seg >= 1 && <OverlayLabel x={(last.x + rubber.x) / 2} y={(last.y + rubber.y) / 2} text={formatLength(seg)} anchor="above" scale={scale} dark={dark} />}
      {rubber && (
        <OverlayLabel
          x={rubber.x}
          y={rubber.y}
          text={`Gesamt ${formatLength(total + seg)} · ${points.length} Punkt${points.length === 1 ? '' : 'e'}\n${points.length >= 2 ? 'Doppelklick/Enter: beenden · ' : ''}Klick am Notausgang: beenden`}
          anchor="below"
          fontPx={11}
          scale={scale}
          dark={dark}
        />
      )}
      {!rubber && <OverlayLabel x={last.x} y={last.y} text="Nächsten Punkt klicken" anchor="below" fontPx={11} scale={scale} dark={dark} />}
      {nodes}
    </Group>
  );
});

/* ------------------------------------------------------------------ */
/* Registrierung                                                       */
/* ------------------------------------------------------------------ */

registerTool({
  id: 'escape-route',
  cursor: 'crosshair',
  hint: 'Fluchtweg: Klicks setzen Punkte · Shift: 45° · Klick am Notausgang / Doppelklick / Enter: beenden · Rücktaste: letzter Punkt · Esc: abbrechen',
  Overlay: EscapeRouteOverlay,
  onPointerDown: (e, ctx) => {
    if (e.button !== 0) return;
    clicks.down(e.screen);
    const st = useEscapeRoute.getState();
    const last = st.points.length ? st.points[st.points.length - 1] : null;
    const { point, exit } = resolveRoutePoint(ctx, e, last);
    if (last && distance(last, point) < MIN_STEP_CM) {
      if (exit && st.points.length >= 2) finish(ctx);
      return;
    }
    const points = [...st.points, point];
    if (exit && points.length >= 2) {
      commitRoute(points, ctx);
      return;
    }
    st.patch({ points, cursor: point, exit: null });
  },
  onPointerMove: (e, ctx) => {
    const st = useEscapeRoute.getState();
    const last = st.points.length ? st.points[st.points.length - 1] : null;
    const { point, exit } = resolveRoutePoint(ctx, e, last);
    if (exit) useSnapGuides.getState().set(null);
    st.patch({ cursor: point, exit });
  },
  onDoubleClick: (_e, ctx) => {
    if (!clicks.isDoubleClick()) return;
    const st = useEscapeRoute.getState();
    if (!st.points.length) return;
    // Der zweite Klick des Doppelklicks hat ggf. einen fast identischen Punkt angehängt → entfernen (auch bei nur zwei Punkten).
    const n = st.points.length;
    if (n >= 2 && distance(st.points[n - 1], st.points[n - 2]) <= ctx.pxToWorld(6)) st.patch({ points: st.points.slice(0, -1) });
    finish(ctx); // meldet bei < 2 Punkten „Mindestens 2 Punkte nötig“
  },
  onKeyDown: (e, ctx) => {
    const st = useEscapeRoute.getState();
    if (!st.points.length) return false;
    if (e.key === 'Enter') {
      finish(ctx);
      return true;
    }
    if (e.key === 'Escape') {
      resetRoute();
      return true;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      st.patch({ points: st.points.slice(0, -1) });
      return true;
    }
    return false;
  },
  onCancel: () => resetRoute(),
  onActivate: () => resetRoute(),
});
