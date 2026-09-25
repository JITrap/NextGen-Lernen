/**
 * Ebene „Wände“: Innenwände mit sauberen Ecken/T-Stößen (wallOutline aus geometry/walls), Füllung in
 * Wandtyp-Farbe mit Muster (Mauerwerk-Schraffur, Glaswand, Brüstung gestrichelt, Trennwand/Netz gepunktet),
 * Akzentrand bei Auswahl/Hover und Wandknoten, sobald eine Wand gewählt ist. Alles listening={false}.
 */
import { memo, useMemo } from 'react';
import { Group, Line, Circle, Shape } from 'react-konva';
import type Konva from 'konva';
import type { Vec2, Wall, WallType } from '@/types';
import type { LayerProps } from './LayerProps';
import { WALL_TYPE_MAP } from '@/data/wallTypes';
import { wallOutlines, wallJoinPolygons, wallNodes, isHallWallId, hallInnerPolygon } from '@/geometry/walls';
import { bbox, flatten, centroid, pointInPolygon } from '@/geometry/polygon';

/* ------------------------------------------------------------------ */
/* Farben                                                              */
/* ------------------------------------------------------------------ */

/** Wandfarbe je Typ; im Dunkelmodus hellere Varianten (Draufsicht-Konvention: dunkle Wände auf hellem Plan und umgekehrt). */
const DARK_COLORS: Record<WallType, string> = {
  Außenwand: '#e2e8f0',
  Trockenbau: '#cbd5e1',
  Mauerwerk: '#b8c2d0',
  Glaswand: '#7dd3fc',
  Brüstung: '#94a3b8',
  'Trennwand/Netz': '#4ade80',
};

export function wallColor(type: WallType, dark: boolean): string {
  if (dark) return DARK_COLORS[type] ?? DARK_COLORS.Trockenbau;
  return WALL_TYPE_MAP[type]?.color ?? WALL_TYPE_MAP.Trockenbau.color;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

function tracePolygon(ctx: Konva.Context, poly: Vec2[]) {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Einzelne Wand                                                       */
/* ------------------------------------------------------------------ */

interface WallShapeProps {
  wall: Wall;
  outline: Vec2[];
  /** 1 / viewport.scale */
  s: number;
  dark: boolean;
  selected: boolean;
  hovered: boolean;
}

const WallShape = memo(function WallShape({ wall, outline, s, dark, selected, hovered }: WallShapeProps) {
  const info = WALL_TYPE_MAP[wall.type] ?? WALL_TYPE_MAP.Trockenbau;
  const color = wallColor(wall.type, dark);
  const pts = flatten(outline);
  const accent = dark ? '#60a5fa' : '#2563eb';
  const highlight = selected ? accent : hovered ? hexToRgba(accent, 0.7) : undefined;
  const highlightWidth = selected ? 2 * s : 1.5 * s;
  const axis = [wall.start.x, wall.start.y, wall.end.x, wall.end.y];
  const opacity = wall.locked ? 0.85 : 1;

  switch (info.pattern) {
    case 'hatch': {
      const box = bbox(outline);
      const spacing = Math.max(4, 7 * s);
      return (
        <Group listening={false} opacity={opacity}>
          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              tracePolygon(ctx, outline);
              ctx.setAttr('fillStyle', hexToRgba(color, 0.55));
              ctx.fill();
              ctx.save();
              ctx.clip();
              ctx.beginPath();
              const h = box.maxY - box.minY;
              const from = Math.floor((box.minX - h) / spacing) * spacing;
              let n = 0;
              for (let x = from; x <= box.maxX && n < 800; x += spacing, n++) {
                ctx.moveTo(x, box.maxY);
                ctx.lineTo(x + h, box.minY);
              }
              ctx.setAttr('strokeStyle', color);
              ctx.setAttr('lineWidth', 1 * s);
              ctx.stroke();
              ctx.restore();
            }}
          />
          <Line points={pts} closed stroke={highlight ?? color} strokeWidth={highlight ? highlightWidth : 0.75 * s} />
        </Group>
      );
    }
    case 'glass':
      return (
        <Group listening={false} opacity={opacity}>
          <Line points={pts} closed fill={hexToRgba(color, dark ? 0.3 : 0.28)} stroke={highlight ?? color} strokeWidth={highlight ? highlightWidth : 1 * s} />
          <Line points={axis} stroke={color} strokeWidth={1.25 * s} />
        </Group>
      );
    case 'dashed':
      return (
        <Group listening={false} opacity={opacity}>
          <Line points={pts} closed fill={hexToRgba(color, 0.35)} />
          <Line points={pts} closed stroke={highlight ?? color} strokeWidth={highlight ? highlightWidth : 1 * s} dash={highlight ? undefined : [6 * s, 4 * s]} />
        </Group>
      );
    case 'net':
      return (
        <Group listening={false} opacity={opacity}>
          <Line points={pts} closed fill={hexToRgba(color, 0.18)} stroke={highlight ?? hexToRgba(color, 0.6)} strokeWidth={highlight ? highlightWidth : 0.75 * s} />
          <Line points={axis} stroke={color} strokeWidth={1.5 * s} dash={[1.5 * s, 4 * s]} lineCap="round" />
        </Group>
      );
    default:
      return <Line listening={false} points={pts} closed fill={color} stroke={highlight} strokeWidth={highlight ? highlightWidth : 0} opacity={opacity} />;
  }
});

/* ------------------------------------------------------------------ */
/* Ebene                                                               */
/* ------------------------------------------------------------------ */

export const WallsLayer = memo(function WallsLayer(props: LayerProps) {
  const { walls, floor, viewport, selection, hoverId, dark, presentation } = props;
  const s = 1 / viewport.scale;

  // Sichtbare Wände inkl. Hallen-Außenwände: nur so bekommen Innenwände saubere Anschlüsse an die Halle.
  const visible = useMemo(() => walls.filter((w) => !w.hidden), [walls]);
  const outlines = useMemo(() => wallOutlines(visible), [visible]);
  const hallInner = useMemo(() => (floor.hall && floor.hall.polygon.length >= 3 ? hallInnerPolygon(floor.hall) : null), [floor.hall]);
  const joins = useMemo(() => {
    const polys = wallJoinPolygons(visible);
    // Nur Knoten im Halleninneren – Hallen-Ecken zeichnet die Hallen-Ebene.
    return hallInner ? polys.filter((p) => pointInPolygon(centroid(p), hallInner)) : polys;
  }, [visible, hallInner]);
  const real = useMemo(() => visible.filter((w) => !isHallWallId(w.id)), [visible]);
  const selectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const sel of selection) if (sel.kind === 'wall') set.add(sel.id);
    return set;
  }, [selection]);
  const showNodes = selectedIds.size > 0 && !presentation;
  const nodes = useMemo(() => (showNodes ? wallNodes(real) : []), [showNodes, real]);

  const joinFill = dark ? DARK_COLORS.Trockenbau : WALL_TYPE_MAP.Trockenbau.color;
  const accent = dark ? '#60a5fa' : '#2563eb';

  return (
    <Group listening={false}>
      {joins.map((p, i) => (
        <Line key={`j${i}`} points={flatten(p)} closed fill={joinFill} />
      ))}
      {real.map((w) => {
        const outline = outlines.get(w.id);
        if (!outline) return null;
        return <WallShape key={w.id} wall={w} outline={outline} s={s} dark={dark} selected={selectedIds.has(w.id)} hovered={!presentation && hoverId === w.id} />;
      })}
      {nodes.map((n, i) => (
        <Circle key={`n${i}`} x={n.x} y={n.y} radius={2.5 * s} fill={dark ? '#0f172a' : '#ffffff'} stroke={accent} strokeWidth={1 * s} />
      ))}
    </Group>
  );
});
