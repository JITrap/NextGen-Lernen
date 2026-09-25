/**
 * Ebene „Darunterliegendes Stockwerk“: halbtransparente Orientierung (Deckung aus
 * project.settings.lowerFloorOpacity) – Hallenumriss, Wände grau, Objekte als graue Grundflächen,
 * Treppen/Aufzüge gestrichelt hervorgehoben. Wenige Konva-Shapes (je Kategorie eine), listening={false}.
 */
import { memo, useMemo } from 'react';
import { Group, Line, Shape } from 'react-konva';
import type Konva from 'konva';
import type { Floor, Vec2 } from '@/types';
import type { LayerProps } from './LayerProps';
import { wallRect, hallInnerPolygon, hallOuterPolygon } from '@/geometry/walls';
import { itemFootprint } from '@/geometry/transform';
import { flatten } from '@/geometry/polygon';

function tracePolygon(ctx: Konva.Context, poly: Vec2[]) {
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

interface Palette {
  wall: string;
  itemFill: string;
  itemStroke: string;
  linkFill: string;
  linkStroke: string;
  hall: string;
}
function palette(dark: boolean): Palette {
  return dark
    ? { wall: '#64748b', itemFill: 'rgba(148,163,184,0.25)', itemStroke: '#64748b', linkFill: 'rgba(148,163,184,0.35)', linkStroke: '#cbd5e1', hall: '#94a3b8' }
    : { wall: '#94a3b8', itemFill: 'rgba(148,163,184,0.25)', itemStroke: '#94a3b8', linkFill: 'rgba(100,116,139,0.3)', linkStroke: '#475569', hall: '#94a3b8' };
}

/** Geometrie des unteren Stockwerks (einmal je Stockwerk berechnet). */
function lowerGeometry(floor: Floor) {
  const walls: Vec2[][] = [];
  for (const w of floor.walls) if (!w.hidden) walls.push(wallRect(w));
  const items: Vec2[][] = [];
  const linked: Vec2[][] = [];
  for (const it of floor.items) {
    if (it.hidden) continue;
    (it.kind === 'stairs' || it.kind === 'elevator' ? linked : items).push(itemFootprint(it));
  }
  const hall = floor.hall && floor.hall.polygon.length >= 3 ? { outer: hallOuterPolygon(floor.hall), inner: hallInnerPolygon(floor.hall) } : null;
  return { walls, items, linked, hall };
}

export const LowerFloorLayer = memo(function LowerFloorLayer(props: LayerProps) {
  const { lowerFloor, project, viewport, dark } = props;
  const s = 1 / viewport.scale;
  const opacity = Math.min(1, Math.max(0.05, project.settings.lowerFloorOpacity ?? 0.3));
  const geo = useMemo(() => (lowerFloor ? lowerGeometry(lowerFloor) : null), [lowerFloor]);
  const pal = useMemo(() => palette(dark), [dark]);
  if (!geo) return null;
  const { walls, items, linked, hall } = geo;
  return (
    <Group listening={false} opacity={opacity}>
      {hall && (
        <>
          <Line points={flatten(hall.outer)} closed stroke={pal.hall} strokeWidth={1 * s} dash={[10 * s, 5 * s]} />
          {hall.inner.length >= 3 && <Line points={flatten(hall.inner)} closed stroke={pal.hall} strokeWidth={1.5 * s} />}
        </>
      )}
      {walls.length > 0 && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            ctx.beginPath();
            for (const p of walls) tracePolygon(ctx, p);
            ctx.setAttr('fillStyle', pal.wall);
            ctx.fill();
          }}
        />
      )}
      {items.length > 0 && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            ctx.beginPath();
            for (const p of items) tracePolygon(ctx, p);
            ctx.setAttr('fillStyle', pal.itemFill);
            ctx.fill();
            ctx.setAttr('strokeStyle', pal.itemStroke);
            ctx.setAttr('lineWidth', 1 * s);
            ctx.stroke();
          }}
        />
      )}
      {linked.length > 0 && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            ctx.beginPath();
            for (const p of linked) tracePolygon(ctx, p);
            ctx.setAttr('fillStyle', pal.linkFill);
            ctx.fill();
            ctx.setLineDash([6 * s, 3 * s]);
            ctx.setAttr('strokeStyle', pal.linkStroke);
            ctx.setAttr('lineWidth', 1.5 * s);
            ctx.stroke();
            ctx.setLineDash([]);
          }}
        />
      )}
    </Group>
  );
});
