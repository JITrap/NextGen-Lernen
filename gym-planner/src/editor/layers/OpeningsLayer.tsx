/**
 * Ebene „Öffnungen“: Türen (Wandausschnitt, Türblatt und Schwenkbogen je Türtyp), Fenster (Ausschnitt mit
 * drei Glaslinien) und Spiegel (dicke silberne Linie auf der Wandseite). Alles in Weltkoordinaten (cm);
 * Linienbreiten und Schriftgrößen werden mit 1 / viewport.scale bildschirm-konstant gehalten.
 *
 * `OpeningGlyph` zeichnet eine einzelne Öffnung und wird auch vom Öffnungs-Werkzeug für die Vorschau genutzt.
 * Die Ebene ist nicht klickbar (hitTest übernimmt die Auswahl), daher überall listening={false}.
 */
import { memo, useMemo, type ReactNode } from 'react';
import { Group, Line, Circle, Text } from 'react-konva';
import type { Door, Mirror, Opening, Vec2, Wall } from '@/types';
import type { LayerProps } from './LayerProps';
import { DOOR_TYPE_MAP } from '@/data/wallTypes';
import { doorSwingSectors } from '@/geometry/collision';
import { openingPlacement } from '@/geometry/walls';
import { flatten } from '@/geometry/polygon';
import { formatNumber } from '@/geometry/units';

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Ab dieser Bildschirmbreite (px) der Öffnung wird die Breite beschriftet. */
const LABEL_MIN_PX = 28;

/** Bodenfarbe der Halle (entspricht --gp-hall in src/index.css) – für Wandausschnitte. */
export function floorFillColor(dark: boolean): string {
  return dark ? '#162032' : '#ffffff';
}

export interface OpeningPalette {
  floor: string;
  wall: string;
  door: string;
  glass: string;
  glassDoor: string;
  emergency: string;
  mirror: string;
  swing: string;
  label: string;
  accent: string;
  danger: string;
}

export function openingPalette(dark: boolean): OpeningPalette {
  return dark
    ? {
        floor: floorFillColor(true), wall: '#cbd5e1', door: '#e2e8f0', glass: '#7dd3fc', glassDoor: '#7dd3fc', emergency: '#4ade80',
        mirror: '#d4d4d8', swing: 'rgba(203,213,225,0.12)', label: '#94a3b8', accent: '#60a5fa', danger: '#f87171',
      }
    : {
        floor: floorFillColor(false), wall: '#334155', door: '#1e293b', glass: '#0284c7', glassDoor: '#38bdf8', emergency: '#16a34a',
        mirror: '#9ca3af', swing: 'rgba(51,65,85,0.09)', label: '#64748b', accent: '#2563eb', danger: '#dc2626',
      };
}

const ANGLE_EPS = 1e-6;
/** Textdrehung entlang einer Richtung, sodass der Text nie kopfüber steht (senkrecht: von unten nach oben lesbar). */
export function readableAngle(deg: number): number {
  let a = ((deg % 360) + 540) % 360 - 180; // (-180, 180]
  if (a > 90 + ANGLE_EPS) a -= 180;
  else if (a < -90 - ANGLE_EPS) a += 180;
  if (Math.abs(a - 90) <= ANGLE_EPS) a = -90;
  return a;
}

function pt(base: Vec2, v: Vec2, k: number, u?: Vec2, m = 0): Vec2 {
  return { x: base.x + v.x * k + (u ? u.x * m : 0), y: base.y + v.y * k + (u ? u.y * m : 0) };
}

/** Beschriftung mittig an einem Punkt, entlang der Wand gedreht (lesbar). Größe bildschirm-konstant. */
function RotatedLabel({ x, y, angle, text, fontPx, s, color, bold }: { x: number; y: number; angle: number; text: string; fontPx: number; s: number; color: string; bold?: boolean }) {
  const w = 160 * s;
  const fs = fontPx * s;
  return (
    <Text
      x={x}
      y={y}
      rotation={readableAngle(angle)}
      text={text}
      fontSize={fs}
      fontFamily={FONT}
      fontStyle={bold ? 'bold' : 'normal'}
      fill={color}
      width={w}
      offsetX={w / 2}
      offsetY={fs / 2}
      align="center"
      listening={false}
    />
  );
}

type Placement = ReturnType<typeof openingPlacement>;

function doorNodes(o: Door, wall: Wall, pl: Placement, half: number, s: number, pal: OpeningPalette, stroke: string | undefined): ReactNode[] {
  const out: ReactNode[] = [];
  const info = DOOR_TYPE_MAP[o.doorType] ?? DOOR_TYPE_MAP['einflügelig'];
  const sgn = o.swingSide === 'b' ? -1 : 1;
  const sn = { x: pl.normal.x * sgn, y: pl.normal.y * sgn };
  const d = pl.dir;
  const n = pl.normal;
  const base = o.doorType === 'Glastür' ? pal.glassDoor : o.doorType === 'Notausgang' ? pal.emergency : pal.door;
  const col = stroke ?? base;
  const w = o.width;

  if (info.swings) {
    doorSwingSectors(o, wall, 16).forEach((sec, i) => {
      if (sec.length < 3) return;
      const tip = sec[sec.length - 1];
      out.push(<Line key={`sf${i}`} points={flatten(sec)} closed fill={pal.swing} listening={false} />);
      out.push(<Line key={`sa${i}`} points={flatten(sec.slice(1))} stroke={col} strokeWidth={0.8 * s} opacity={0.85} listening={false} />);
      out.push(<Line key={`sl${i}`} points={[sec[0].x, sec[0].y, tip.x, tip.y]} stroke={col} strokeWidth={2.2 * s} lineCap="round" listening={false} />);
    });
  } else if (o.doorType === 'Schiebetür') {
    // Türblatt parallel zur Wand vor der Wandfläche (Aufschlagseite) + Pfeil in Schieberichtung (zum Anschlag hin)
    const off = half + Math.max(2, 2.5 * s);
    const t = Math.max(2.5 * s, Math.min(6, wall.thickness * 0.4));
    const a0 = pt(pl.a, sn, off);
    const b0 = pt(pl.b, sn, off);
    const a1 = pt(a0, sn, t);
    const b1 = pt(b0, sn, t);
    out.push(<Line key="leaf" points={flatten([a0, b0, b1, a1])} closed fill={col} opacity={0.85} listening={false} />);
    const dirSign = o.hinge === 'left' ? -1 : 1;
    const ay = off + t + 5 * s;
    const reach = Math.min(w * 0.3, 60);
    const from = pt(pl.center, sn, ay, d, -dirSign * reach);
    const to = pt(pl.center, sn, ay, d, dirSign * reach);
    const h = 4 * s;
    out.push(<Line key="arr" points={[from.x, from.y, to.x, to.y]} stroke={col} strokeWidth={1.2 * s} listening={false} />);
    out.push(
      <Line
        key="arh"
        points={[to.x - d.x * dirSign * h + sn.x * h, to.y - d.y * dirSign * h + sn.y * h, to.x, to.y, to.x - d.x * dirSign * h - sn.x * h, to.y - d.y * dirSign * h - sn.y * h]}
        stroke={col}
        strokeWidth={1.2 * s}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />,
    );
  } else {
    // Rolltor: gestrichelte Linie in der Wandachse + Rollensymbol auf der Aufschlagseite
    out.push(<Line key="rl" points={[pl.a.x, pl.a.y, pl.b.x, pl.b.y]} stroke={col} strokeWidth={1.5 * s} dash={[6 * s, 4 * s]} listening={false} />);
    const r = Math.max(4 * s, Math.min(12, half + 4));
    const c = pt(pl.center, sn, half + r);
    out.push(<Circle key="roll" x={c.x} y={c.y} radius={r} stroke={col} strokeWidth={1.2 * s} fill={pal.floor} listening={false} />);
    out.push(<Circle key="roll2" x={c.x} y={c.y} radius={r * 0.35} fill={col} listening={false} />);
  }

  if (o.doorType === 'Notausgang') {
    const m = 2 * s;
    const frame = [pt(pl.a, n, half + m, d, -m), pt(pl.b, n, half + m, d, m), pt(pl.b, n, -(half + m), d, m), pt(pl.a, n, -(half + m), d, -m)];
    out.push(<Line key="ef" points={flatten(frame)} closed stroke={stroke ?? pal.emergency} strokeWidth={1.5 * s} listening={false} />);
    const p = pt(pl.center, sn, half + 8 * s);
    out.push(<RotatedLabel key="not" x={p.x} y={p.y} angle={pl.angle} text="NOT" fontPx={9} s={s} color={stroke ?? pal.emergency} bold />);
  }
  return out;
}

/** Fenster: drei parallele Glaslinien innerhalb der Wandstärke. */
function windowNodes(pl: Placement, half: number, s: number, pal: OpeningPalette, stroke: string | undefined): ReactNode[] {
  const col = stroke ?? pal.glass;
  const out: ReactNode[] = [];
  for (const k of [-0.66, 0, 0.66]) {
    const a = pt(pl.a, pl.normal, half * k);
    const b = pt(pl.b, pl.normal, half * k);
    out.push(<Line key={`g${k}`} points={[a.x, a.y, b.x, b.y]} stroke={col} strokeWidth={(k === 0 ? 1.2 : 0.8) * s} listening={false} />);
  }
  return out;
}

function mirrorNodes(o: Mirror, pl: Placement, half: number, s: number, pal: OpeningPalette, stroke: string | undefined): ReactNode[] {
  const col = stroke ?? pal.mirror;
  const sgn = o.side === 'b' ? -1 : 1;
  const sn = { x: pl.normal.x * sgn, y: pl.normal.y * sgn };
  const off = half + 1.5 * s;
  const a0 = pt(pl.a, sn, off);
  const b0 = pt(pl.b, sn, off);
  const out: ReactNode[] = [<Line key="m" points={[a0.x, a0.y, b0.x, b0.y]} stroke={col} strokeWidth={3 * s} lineCap="butt" listening={false} />];
  // Kleine Schraffur (Spiegelsymbol) auf der Außenseite
  const step = Math.max(20, 14 * s);
  const tick = 5 * s;
  let i = 0;
  for (let t = step / 2; t < o.width; t += step) {
    const p = pt(a0, pl.dir, t);
    const q = pt(p, sn, tick, pl.dir, tick);
    out.push(<Line key={`t${i++}`} points={[p.x, p.y, q.x, q.y]} stroke={col} strokeWidth={1 * s} opacity={0.8} listening={false} />);
  }
  return out;
}

export interface OpeningGlyphProps {
  opening: Opening;
  wall: Wall;
  scale: number;
  dark: boolean;
  /** Überschreibt die Strichfarbe (Auswahl/Hover/ungültige Vorschau). */
  stroke?: string;
  /** Breitenbeschriftung bei ausreichendem Zoom (Standard true). */
  showLabel?: boolean;
}

/** Zeichnet eine einzelne Öffnung in ihrer Wand (Weltkoordinaten). */
export const OpeningGlyph = memo(function OpeningGlyph({ opening, wall, scale, dark, stroke, showLabel = true }: OpeningGlyphProps) {
  const pal = openingPalette(dark);
  const s = 1 / scale;
  const pl = openingPlacement(opening, wall);
  const half = wall.thickness / 2;
  const { a, b, normal: n, center } = pl;
  const nx = n.x * half;
  const ny = n.y * half;
  const nodes: ReactNode[] = [];
  const wallColor = stroke ?? pal.wall;
  const cutPoints = [a.x + nx, a.y + ny, b.x + nx, b.y + ny, b.x - nx, b.y - ny, a.x - nx, a.y - ny];
  const jambs = () => {
    nodes.push(<Line key="ja" points={[a.x + nx, a.y + ny, a.x - nx, a.y - ny]} stroke={wallColor} strokeWidth={1 * s} listening={false} />);
    nodes.push(<Line key="jb" points={[b.x + nx, b.y + ny, b.x - nx, b.y - ny]} stroke={wallColor} strokeWidth={1 * s} listening={false} />);
  };
  let labelSign = 1;
  switch (opening.kind) {
    case 'door':
      nodes.push(<Line key="cut" points={cutPoints} closed fill={pal.floor} listening={false} />);
      jambs();
      nodes.push(...doorNodes(opening, wall, pl, half, s, pal, stroke));
      labelSign = opening.swingSide === 'a' ? -1 : 1;
      break;
    case 'window':
      nodes.push(<Line key="cut" points={cutPoints} closed fill={pal.floor} listening={false} />);
      nodes.push(...windowNodes(pl, half, s, pal, stroke));
      jambs();
      break;
    case 'mirror':
      nodes.push(...mirrorNodes(opening, pl, half, s, pal, stroke));
      labelSign = opening.side === 'a' ? -1 : 1;
      break;
    default:
      break;
  }
  if (showLabel && opening.width * scale >= LABEL_MIN_PX) {
    const dist = half + 9 * s;
    nodes.push(
      <RotatedLabel
        key="lbl"
        x={center.x + n.x * labelSign * dist}
        y={center.y + n.y * labelSign * dist}
        angle={pl.angle}
        text={formatNumber(opening.width, 1)}
        fontPx={10}
        s={s}
        color={stroke ?? pal.label}
      />,
    );
  }
  return <Group listening={false}>{nodes}</Group>;
});

/** Alle sichtbaren Öffnungen des Stockwerks (Wände inkl. Hallen-Außenwände aus props.walls). */
export const OpeningsLayer = memo(function OpeningsLayer(props: LayerProps) {
  const { floor, walls, viewport, selection, hoverId, dark } = props;
  const wallById = useMemo(() => {
    const m = new Map<string, Wall>();
    for (const w of walls) m.set(w.id, w);
    return m;
  }, [walls]);
  const selectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const x of selection) if (x.kind === 'opening') set.add(x.id);
    return set;
  }, [selection]);
  const accent = openingPalette(dark).accent;
  const nodes: ReactNode[] = [];
  for (const o of floor.openings) {
    if (o.hidden) continue;
    const w = wallById.get(o.wallId);
    if (!w || w.hidden) continue;
    const emphasis = selectedIds.has(o.id) || hoverId === o.id;
    nodes.push(<OpeningGlyph key={o.id} opening={o} wall={w} scale={viewport.scale} dark={dark} stroke={emphasis ? accent : undefined} />);
  }
  return <Group listening={false}>{nodes}</Group>;
});
