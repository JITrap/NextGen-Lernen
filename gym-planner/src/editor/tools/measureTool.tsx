/**
 * Werkzeug „Messen“ ('measure'): Klick setzt den Startpunkt (mit Snapping), die Bewegung zeigt Linie, Länge und
 * Δx/Δy, der zweite Klick (oder Loslassen nach Ziehen) fixiert und legt eine Messlinien-Anmerkung an.
 * Shift rastet den Winkel in 45°-Schritten ein. Esc bricht die laufende Messung ab; das Werkzeug bleibt aktiv.
 */
import { memo } from 'react';
import { Group, Line, Circle } from 'react-konva';
import type { Vec2 } from '@/types';
import type { ToolContext, ToolEvent } from './types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import { useSnapGuides } from '../overlays/SnapGuides';
import { transaction } from '@/store/projectStore';
import { newId } from '@/utils/id';
import { snapAngle, snapToGridAlongRay, type SnapResult } from '@/geometry/snap';
import { distance } from '@/geometry/polygon';
import { formatLength } from '@/geometry/units';
import { useIsDark } from '@/hooks/useTheme';
import { OverlayLabel } from './zoneTools';

/** Ab dieser Bildschirm-Distanz (px) zwischen Pointer-Down und -Up gilt die Messung als „gezogen“. */
const DRAG_PX = 8;

export interface MeasureState {
  start: Vec2 | null;
  cursor: Vec2 | null;
  downScreen: Vec2 | null;
}

export const useMeasure = createToolStore<MeasureState>({ start: null, cursor: null, downScreen: null });

function resetMeasure() {
  useMeasure.getState().reset();
  useSnapGuides.getState().set(null);
}

/** Endpunkt-Snapping: mit Shift strikt auf 45°-Winkel (+ Raster entlang des Strahls), sonst normales Punkt-Snapping. */
export function snapMeasurePoint(ctx: ToolContext, e: Pick<ToolEvent, 'world' | 'shift'>, start: Vec2 | null): SnapResult {
  if (start && e.shift) {
    const a = snapAngle(start, e.world, 45);
    const gridOn = ctx.project.settings.snapEnabled && !ctx.ui.snapOverride;
    const p = gridOn ? snapToGridAlongRay(start, a, ctx.project.settings.gridSize) : a;
    return { point: p, kind: 'angle', guides: [{ from: start, to: p, kind: 'angle' }] };
  }
  return ctx.snap(e.world, { angleFrom: start, targets: { angle: false } });
}

function commitMeasure(start: Vec2, end: Vec2, ctx: ToolContext) {
  resetMeasure();
  if (distance(start, end) < 1) return;
  const id = newId('a_');
  transaction(() => ctx.store.addAnnotation(ctx.floor.id, { id, kind: 'measure', start, end }));
  ctx.ui.setSelection([{ kind: 'annotation', id }]);
  if (!ctx.project.layers.annotations) ctx.ui.toast('Ebene „Anmerkungen“ ist ausgeblendet – die Messlinie ist nicht sichtbar', 'info');
}

const MeasureOverlay = memo(function MeasureOverlay({ ctx }: { ctx: ToolContext }) {
  const start = useMeasure((s) => s.start);
  const cursor = useMeasure((s) => s.cursor);
  const dark = useIsDark();
  if (!start) return null;
  const scale = ctx.viewport.scale;
  const s = 1 / scale;
  const color = dark ? '#fb923c' : '#ea580c';
  const dotFill = dark ? '#0f172a' : '#ffffff';
  const end = cursor && distance(start, cursor) >= 0.5 ? cursor : null;
  let ticks: number[] | null = null;
  if (end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * 6 * s;
    const ny = (dx / len) * 6 * s;
    ticks = [start.x + nx, start.y + ny, start.x - nx, start.y - ny, end.x + nx, end.y + ny, end.x - nx, end.y - ny];
  }
  return (
    <Group listening={false}>
      {end && <Line points={[start.x, start.y, end.x, end.y]} stroke={color} strokeWidth={1.5 * s} />}
      {ticks && <Line points={ticks.slice(0, 4)} stroke={color} strokeWidth={1.5 * s} />}
      {ticks && <Line points={ticks.slice(4)} stroke={color} strokeWidth={1.5 * s} />}
      <Circle x={start.x} y={start.y} radius={3.5 * s} fill={dotFill} stroke={color} strokeWidth={1.5 * s} />
      {end && (
        <>
          <Circle x={end.x} y={end.y} radius={3.5 * s} fill={dotFill} stroke={color} strokeWidth={1.5 * s} />
          <OverlayLabel x={(start.x + end.x) / 2} y={(start.y + end.y) / 2} text={formatLength(distance(start, end))} anchor="above" tone="measure" scale={scale} dark={dark} />
          <OverlayLabel
            x={end.x}
            y={end.y}
            text={`Δx ${formatLength(Math.abs(end.x - start.x))} · Δy ${formatLength(Math.abs(end.y - start.y))}`}
            anchor="below"
            fontPx={11}
            scale={scale}
            dark={dark}
          />
        </>
      )}
      {!end && <OverlayLabel x={start.x} y={start.y} text="Endpunkt klicken" anchor="below" fontPx={11} scale={scale} dark={dark} />}
    </Group>
  );
});

registerTool({
  id: 'measure',
  cursor: 'crosshair',
  hint: 'Startpunkt klicken, dann Endpunkt (oder ziehen) · Shift: 45°-Winkel · Esc: abbrechen',
  Overlay: MeasureOverlay,
  onPointerDown: (e, ctx) => {
    if (e.button !== 0) return;
    const st = useMeasure.getState();
    if (!st.start) {
      const r = ctx.snap(e.world);
      useSnapGuides.getState().set(r);
      st.patch({ start: r.point, cursor: r.point, downScreen: e.screen });
      return;
    }
    commitMeasure(st.start, snapMeasurePoint(ctx, e, st.start).point, ctx);
  },
  onPointerMove: (e, ctx) => {
    const st = useMeasure.getState();
    const r = snapMeasurePoint(ctx, e, st.start);
    useSnapGuides.getState().set(r);
    if (st.start) st.patch({ cursor: r.point });
  },
  onPointerUp: (e, ctx) => {
    const st = useMeasure.getState();
    if (!st.start || !st.downScreen) return;
    if (distance(e.screen, st.downScreen) <= DRAG_PX) {
      st.patch({ downScreen: null });
      return;
    }
    commitMeasure(st.start, snapMeasurePoint(ctx, e, st.start).point, ctx);
  },
  onKeyDown: (e) => {
    if (e.key === 'Escape' && useMeasure.getState().start) {
      resetMeasure();
      return true;
    }
    return false;
  },
  onCancel: () => resetMeasure(),
});
