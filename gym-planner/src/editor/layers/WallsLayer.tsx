/**
 * Ebene „Wände“: Innenwände mit sauberen Ecken/T-Stößen (wallOutline aus geometry/walls), Füllung in
 * Wandtyp-Farbe mit Muster (Mauerwerk-Schraffur, Glaswand, Brüstung gestrichelt, Trennwand/Netz gepunktet),
 * Akzentrand bei Auswahl/Hover und Wandknoten, sobald eine Wand gewählt ist. Alles listening={false}.
 *
 * Keine Nahtlinien an Stößen: Alle Wände eines Typs werden als EIN Pfad (Vereinigung, nonzero) gefüllt – aneinander
 * grenzende Polygone (z. B. die beiden Hälften einer am T-Stoß geteilten Wand) ergeben so eine durchgehende Fläche
 * ohne Antialiasing-Naht und ohne doppelte Deckkraft bei halbtransparenten Mustern. Konturlinien werden nur an
 * Außenkanten (nicht an Kanten, die in einer Nachbarwand liegen) und UNTER den Füllungen gezeichnet, damit die
 * Kontur einer durchlaufenden Wand nicht über den Stoß der anstoßenden Wand läuft. Join-Polygone (Y-/Sternknoten)
 * werden ohne Kontur mit 0,5 px Überlappung gefüllt.
 */
import { memo, useMemo } from 'react';
import { Group, Line, Circle, Shape } from 'react-konva';
import type Konva from 'konva';
import type { Vec2, Wall, WallType } from '@/types';
import type { LayerProps } from './LayerProps';
import { WALL_TYPE_MAP } from '@/data/wallTypes';
import { wallOutlines, wallJoinPolygons, wallNodes, isHallWallId, hallInnerPolygon } from '@/geometry/walls';
import { bbox, flatten, centroid, pointInPolygon, ensureClockwise } from '@/geometry/polygon';

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

/** Fügt ein Polygon als Teilpfad an (ohne beginPath – mehrere Polygone bilden einen Pfad = Vereinigung). */
function addPolygonPath(ctx: Konva.Context, poly: Vec2[]) {
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Außenkanten (rein)                                                  */
/* ------------------------------------------------------------------ */

export type Edge = [Vec2, Vec2];

/** Abstand (cm), um den Kanten-Stichproben nach außen versetzt werden. */
const EDGE_PROBE_CM = 0.5;

/**
 * Kanten eines (im Uhrzeigersinn orientierten) Wandpolygons, die nicht in einem anderen Polygon liegen. Eine Kante gilt
 * als innen, wenn mindestens zwei von drei knapp nach außen versetzten Stichproben (bei 30 %/50 %/70 %) in einem der
 * `others` liegen – so zählt auch die Stoßkante zweier Wandhälften, deren Mitte genau auf deren gemeinsamer Grenze liegt.
 */
export function exteriorEdges(polygon: Vec2[], others: Vec2[][]): Edge[] {
  const n = polygon.length;
  const out: Edge[] = [];
  if (n < 2) return out;
  if (!others.length) {
    for (let i = 0; i < n; i++) out.push([polygon[i], polygon[(i + 1) % n]]);
    return out;
  }
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    // Uhrzeigersinn (y nach unten): Außennormale = (dy, -dx) / len
    const nx = (dy / len) * EDGE_PROBE_CM;
    const ny = (-dx / len) * EDGE_PROBE_CM;
    let inside = 0;
    for (const t of [0.3, 0.5, 0.7]) {
      const p = { x: a.x + dx * t + nx, y: a.y + dy * t + ny };
      if (others.some((o) => pointInPolygon(p, o))) inside++;
    }
    if (inside < 2) out.push([a, b]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Gruppe gleichen Typs                                                */
/* ------------------------------------------------------------------ */

interface WallGroupProps {
  type: WallType;
  locked: boolean;
  walls: Wall[];
  /** Polygone der Wände dieser Gruppe (Uhrzeigersinn). */
  polys: Vec2[][];
  /** Außenkanten je Wand (für Konturen). */
  edges: Edge[][];
  /** 1 / viewport.scale */
  s: number;
  dark: boolean;
}

/** Alle Wände eines Typs (und Sperrzustands): Konturen unten, eine gemeinsame Füllung darüber, Achslinien zuletzt. */
const WallGroup = memo(function WallGroup({ type, locked, walls, polys, edges, s, dark }: WallGroupProps) {
  const info = WALL_TYPE_MAP[type] ?? WALL_TYPE_MAP.Trockenbau;
  const color = wallColor(type, dark);
  const opacity = locked ? 0.85 : 1;
  const box = useMemo(() => bbox(polys.flat()), [polys]);
  const pattern = info.pattern;

  // Füllung (Vereinigung aller Polygone); Muster im Pfad geclippt
  const fill = pattern === 'hatch' ? hexToRgba(color, 0.55) : pattern === 'glass' ? hexToRgba(color, dark ? 0.3 : 0.28) : pattern === 'dashed' ? hexToRgba(color, 0.35) : pattern === 'net' ? hexToRgba(color, 0.18) : color;
  const fillShape = (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        ctx.beginPath();
        for (const p of polys) addPolygonPath(ctx, p);
        ctx.setAttr('fillStyle', fill);
        ctx.fill();
        if (pattern !== 'hatch') return;
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        const spacing = Math.max(4, 7 * s);
        const h = box.maxY - box.minY;
        const from = Math.floor((box.minX - h) / spacing) * spacing;
        let n = 0;
        for (let x = from; x <= box.maxX && n < 2000; x += spacing, n++) {
          ctx.moveTo(x, box.maxY);
          ctx.lineTo(x + h, box.minY);
        }
        ctx.setAttr('strokeStyle', color);
        ctx.setAttr('lineWidth', 1 * s);
        ctx.stroke();
        ctx.restore();
      }}
    />
  );

  // Konturen (nur Außenkanten) unter der Füllung: sichtbar bleibt die äußere Hälfte → doppelte Breite.
  let outline: { color: string; width: number; dash?: number[] } | null = null;
  if (pattern === 'hatch') outline = { color, width: 1.5 * s };
  else if (pattern === 'glass') outline = { color, width: 2 * s };
  else if (pattern === 'dashed') outline = { color, width: 2 * s, dash: [6 * s, 4 * s] };
  else if (pattern === 'net') outline = { color: hexToRgba(color, 0.6), width: 1.5 * s };
  const strokes = outline
    ? edges.map((es, i) =>
        es.length ? (
          <Shape
            key={walls[i].id}
            listening={false}
            sceneFunc={(ctx) => {
              ctx.beginPath();
              for (const [a, b] of es) {
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
              }
              ctx.setAttr('strokeStyle', outline.color);
              ctx.setAttr('lineWidth', outline.width);
              ctx.setAttr('lineCap', 'butt');
              if (outline.dash) ctx.setLineDash(outline.dash);
              ctx.stroke();
            }}
          />
        ) : null,
      )
    : null;

  // Achslinien (Glaswand durchgezogen, Trennwand/Netz gepunktet)
  const axes =
    pattern === 'glass' || pattern === 'net'
      ? walls.map((w) => (
          <Line
            key={w.id}
            points={[w.start.x, w.start.y, w.end.x, w.end.y]}
            stroke={color}
            strokeWidth={(pattern === 'glass' ? 1.25 : 1.5) * s}
            dash={pattern === 'net' ? [1.5 * s, 4 * s] : undefined}
            lineCap={pattern === 'net' ? 'round' : 'butt'}
            listening={false}
          />
        ))
      : null;

  return (
    <Group listening={false} opacity={opacity}>
      {strokes}
      {fillShape}
      {axes}
    </Group>
  );
});

/* ------------------------------------------------------------------ */
/* Ebene                                                               */
/* ------------------------------------------------------------------ */

interface WallGroupData {
  key: string;
  type: WallType;
  locked: boolean;
  walls: Wall[];
  polys: Vec2[][];
  edges: Edge[][];
}

export const WallsLayer = memo(function WallsLayer(props: LayerProps) {
  const { walls, floor, viewport, selection, hoverId, dark, presentation } = props;
  const s = 1 / viewport.scale;

  // Sichtbare Wände inkl. Hallen-Außenwände: nur so bekommen Innenwände saubere Anschlüsse an die Halle.
  const visible = useMemo(() => walls.filter((w) => !w.hidden), [walls]);
  const outlines = useMemo(() => {
    const raw = wallOutlines(visible);
    const out = new Map<string, Vec2[]>();
    for (const [id, poly] of raw) out.set(id, ensureClockwise(poly));
    return out;
  }, [visible]);
  const hallInner = useMemo(() => (floor.hall && floor.hall.polygon.length >= 3 ? hallInnerPolygon(floor.hall) : null), [floor.hall]);
  const joins = useMemo(() => {
    const polys = wallJoinPolygons(visible).map(ensureClockwise);
    // Nur Knoten im Halleninneren – Hallen-Ecken zeichnet die Hallen-Ebene.
    return hallInner ? polys.filter((p) => pointInPolygon(centroid(p), hallInner)) : polys;
  }, [visible, hallInner]);
  const real = useMemo(() => visible.filter((w) => !isHallWallId(w.id)), [visible]);

  // Gruppen je Typ/Sperrzustand mit Polygonen und Außenkanten
  const groups = useMemo<WallGroupData[]>(() => {
    const all = [...outlines.values(), ...joins];
    const map = new Map<string, WallGroupData>();
    for (const w of real) {
      const poly = outlines.get(w.id);
      if (!poly) continue;
      const key = `${w.type}|${w.locked ? 1 : 0}`;
      let g = map.get(key);
      if (!g) {
        g = { key, type: w.type, locked: !!w.locked, walls: [], polys: [], edges: [] };
        map.set(key, g);
      }
      g.walls.push(w);
      g.polys.push(poly);
      g.edges.push(exteriorEdges(poly, all.filter((o) => o !== poly)));
    }
    return [...map.values()];
  }, [real, outlines, joins]);

  const selectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const sel of selection) if (sel.kind === 'wall') set.add(sel.id);
    return set;
  }, [selection]);
  const showNodes = selectedIds.size > 0 && !presentation;
  const nodes = useMemo(() => (showNodes ? wallNodes(real) : []), [showNodes, real]);

  const joinFill = dark ? DARK_COLORS.Trockenbau : WALL_TYPE_MAP.Trockenbau.color;
  const accent = dark ? '#60a5fa' : '#2563eb';
  const highlighted = real.filter((w) => selectedIds.has(w.id) || (!presentation && hoverId === w.id));

  return (
    <Group listening={false}>
      {joins.map((p, i) => (
        <Line key={`j${i}`} points={flatten(p)} closed fill={joinFill} stroke={joinFill} strokeWidth={1 * s} lineJoin="miter" />
      ))}
      {groups.map((g) => (
        <WallGroup key={g.key} type={g.type} locked={g.locked} walls={g.walls} polys={g.polys} edges={g.edges} s={s} dark={dark} />
      ))}
      {highlighted.map((w) => {
        const outline = outlines.get(w.id);
        if (!outline) return null;
        const selected = selectedIds.has(w.id);
        return <Line key={`h${w.id}`} points={flatten(outline)} closed stroke={selected ? accent : hexToRgba(accent, 0.7)} strokeWidth={(selected ? 2 : 1.5) * s} listening={false} />;
      })}
      {nodes.map((n, i) => (
        <Circle key={`n${i}`} x={n.x} y={n.y} radius={2.5 * s} fill={dark ? '#0f172a' : '#ffffff'} stroke={accent} strokeWidth={1 * s} />
      ))}
    </Group>
  );
});
