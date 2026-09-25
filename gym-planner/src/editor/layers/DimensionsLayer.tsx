/**
 * Bemaßungs-Ebene: automatische Wandbemaßung.
 * - Hallen-Außenkanten: Länge je Kante ca. 40 px außerhalb mit Hilfs- und Endstrichen
 * - Gesamtmaße der Halle (Breite × Tiefe der Bounding-Box) und Gesamtfläche als Text unterhalb
 * - Achsmaß jeder Innenwand (nur ab Zoom > 0,15; bei > 150 Wänden nur gewählte Wände)
 * - Maße gewählter Objekte (B × T) unter dem Objekt
 * Alle Texte sind Bildschirm-konstant (11 px), Linienbreiten über 1/scale. Die Ebene hört nicht auf Events.
 *
 * `DimensionLine` und `DimText` werden auch vom Auswahl-Werkzeug (Abstandsanzeige beim Ziehen) genutzt.
 */
import { memo, useMemo, type ReactNode } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import type { LayerProps } from './LayerProps';
import type { Vec2, Wall } from '@/types';
import { hallOuterPolygon, wallLength, wallNormal, wallMidpoint } from '@/geometry/walls';
import { bbox, polygonAreaM2, distance, normalize, sub } from '@/geometry/polygon';
import { itemFootprint } from '@/geometry/transform';
import { formatLength, formatM2, formatM, formatNumber } from '@/geometry/units';

/** Schriftgröße der Maßtexte in Pixeln. */
export const DIM_FONT_PX = 11;
/** Abstand der Hallen-Maßlinien von der Außenkante in Pixeln. */
export const HALL_DIM_OFFSET_PX = 40;
/** Ab diesem Zoom (px/cm) werden Wandmaße gezeigt. */
export const WALL_DIM_MIN_SCALE = 0.15;
/** Ab so vielen Wänden werden nur noch gewählte Wände bemaßt. */
export const MAX_WALL_DIMS = 150;

export interface DimPalette {
  line: string;
  text: string;
  bg: string;
  accent: string;
}
export function dimPalette(dark: boolean): DimPalette {
  return dark
    ? { line: '#94a3b8', text: '#e2e8f0', bg: 'rgba(15,23,42,0.88)', accent: '#60a5fa' }
    : { line: '#475569', text: '#1e293b', bg: 'rgba(241,245,249,0.92)', accent: '#2563eb' };
}

/** Rotation (Grad), bei der Text entlang einer Richtung lesbar bleibt (nie kopfüber). */
export function readableRotation(dir: Vec2): number {
  let rot = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  if (rot > 90 || rot <= -90) rot += 180;
  if (rot > 180) rot -= 360;
  return rot;
}

/** Ungefähre Textbreite in Weltkoordinaten (für Hintergrund-Rechtecke). */
export function textWidthWorld(text: string, s: number): number {
  return text.length * DIM_FONT_PX * s * 0.6 + 8 * s;
}

interface DimTextProps {
  x: number;
  y: number;
  text: string;
  /** 1 / viewport.scale */
  s: number;
  rotation?: number;
  color: string;
  bg?: string;
  bold?: boolean;
}

/** Bildschirm-konstanter Text mit Hintergrund, zentriert auf (x, y), optional gedreht. */
export function DimText({ x, y, text, s, rotation = 0, color, bg, bold }: DimTextProps) {
  const fs = DIM_FONT_PX * s;
  const w = textWidthWorld(text, s);
  const h = fs + 5 * s;
  return (
    <Group x={x} y={y} rotation={rotation} listening={false}>
      {bg && <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={bg} cornerRadius={2 * s} />}
      <Text
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        text={text}
        fontSize={fs}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontStyle={bold ? 'bold' : 'normal'}
        fill={color}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}

interface DimensionLineProps {
  from: Vec2;
  to: Vec2;
  label: string;
  s: number;
  color: string;
  textColor?: string;
  bg?: string;
  /** Ursprungspunkte, von denen Hilfslinien zur Maßlinie gezeichnet werden. */
  ext?: [Vec2, Vec2];
  /** Richtung (Welt, normiert), in die der Text von der Linienmitte versetzt wird; Standard: „nach oben“. */
  labelDir?: Vec2;
  /** Textversatz in Pixeln. */
  labelOffsetPx?: number;
  dashed?: boolean;
}

/** Maßlinie mit Endstrichen, optionalen Hilfslinien und Text (Bildschirm-konstant, lesbar gedreht). */
export function DimensionLine({ from, to, label, s, color, textColor, bg, ext, labelDir, labelOffsetPx = 9, dashed }: DimensionLineProps) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  // Normale, die auf dem Bildschirm „nach oben“ zeigt (bei senkrechten Linien nach links)
  let nx = -uy;
  let ny = ux;
  if (ny > 1e-9 || (Math.abs(ny) <= 1e-9 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const ldx = labelDir ? labelDir.x : nx;
  const ldy = labelDir ? labelDir.y : ny;
  const t = 5 * s;
  const off = labelOffsetPx * s;
  const mid = { x: (from.x + to.x) / 2 + ldx * off, y: (from.y + to.y) / 2 + ldy * off };
  const rot = readableRotation({ x: ux, y: uy });
  const sw = 1 * s;
  return (
    <Group listening={false}>
      {ext && (
        <>
          <Line points={[ext[0].x, ext[0].y, from.x + (from.x - ext[0].x) * 0.12, from.y + (from.y - ext[0].y) * 0.12]} stroke={color} strokeWidth={sw} opacity={0.6} />
          <Line points={[ext[1].x, ext[1].y, to.x + (to.x - ext[1].x) * 0.12, to.y + (to.y - ext[1].y) * 0.12]} stroke={color} strokeWidth={sw} opacity={0.6} />
        </>
      )}
      <Line points={[from.x, from.y, to.x, to.y]} stroke={color} strokeWidth={sw} dash={dashed ? [5 * s, 3 * s] : undefined} />
      <Line points={[from.x + nx * t, from.y + ny * t, from.x - nx * t, from.y - ny * t]} stroke={color} strokeWidth={sw} />
      <Line points={[to.x + nx * t, to.y + ny * t, to.x - nx * t, to.y - ny * t]} stroke={color} strokeWidth={sw} />
      <DimText x={mid.x} y={mid.y} text={label} s={s} rotation={rot} color={textColor ?? color} bg={bg} />
    </Group>
  );
}

/* ------------------------------------------------------------------ */
/* Reine Berechnungen (testbar)                                        */
/* ------------------------------------------------------------------ */

export interface HallEdgeDim {
  index: number;
  from: Vec2;
  to: Vec2;
  a: Vec2;
  b: Vec2;
  /** Außennormale (normiert). */
  normal: Vec2;
  lengthCm: number;
}

/** Maßlinien der Hallen-Außenkanten, `offsetCm` außerhalb. Polygon wird im Uhrzeigersinn normalisiert. */
export function hallEdgeDimensions(polygon: Vec2[], offsetCm: number): HallEdgeDim[] {
  if (polygon.length < 2) return [];
  const poly = polygon.length >= 3 ? hallOuterPolygon({ polygon, wallThickness: 0, floorCovering: '' }) : polygon;
  const n = poly.length;
  const out: HallEdgeDim[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const len = distance(a, b);
    if (len < 1e-6) continue;
    const d = normalize(sub(b, a));
    // Uhrzeigersinn (y nach unten): Innennormale = (-d.y, d.x) → Außennormale = (d.y, -d.x)
    const normal = { x: d.y, y: -d.x };
    out.push({ index: i, a, b, normal, lengthCm: len, from: { x: a.x + normal.x * offsetCm, y: a.y + normal.y * offsetCm }, to: { x: b.x + normal.x * offsetCm, y: b.y + normal.y * offsetCm } });
  }
  return out;
}

/** Zusammenfassung „Halle: 25,00 m × 20,00 m · 500,00 m²“. */
export function hallSummaryText(polygon: Vec2[]): string {
  const b = bbox(polygon);
  return `Halle: ${formatM(b.maxX - b.minX)} × ${formatM(b.maxY - b.minY)} · ${formatM2(polygonAreaM2(polygon))}`;
}

/** Welche Wände bemaßt werden: alle sichtbaren, bei zu vielen nur die gewählten. */
export function wallsToDimension(walls: Wall[], selectedIds: Set<string>, scale: number): Wall[] {
  if (!(scale > WALL_DIM_MIN_SCALE)) return [];
  const visible = walls.filter((w) => !w.hidden && wallLength(w) >= 1);
  if (visible.length > MAX_WALL_DIMS) return visible.filter((w) => selectedIds.has(w.id));
  return visible;
}

/* ------------------------------------------------------------------ */
/* Ebene                                                               */
/* ------------------------------------------------------------------ */

export const DimensionsLayer = memo(function DimensionsLayer(props: LayerProps) {
  const { floor, items, viewport, selection, dark } = props;
  const scale = viewport.scale;
  const s = 1 / scale;
  const pal = useMemo(() => dimPalette(dark), [dark]);

  const hallNodes = useMemo(() => {
    const hall = floor.hall;
    if (!hall || hall.polygon.length < 3) return null;
    const off = HALL_DIM_OFFSET_PX * s;
    const dims = hallEdgeDimensions(hall.polygon, off);
    const nodes: ReactNode[] = dims.map((d) => (
      <DimensionLine key={`he:${d.index}`} from={d.from} to={d.to} ext={[d.a, d.b]} label={formatLength(d.lengthCm)} s={s} color={pal.line} textColor={pal.text} bg={pal.bg} labelDir={d.normal} />
    ));
    const b = bbox(hall.polygon);
    const complex = hall.polygon.length > 4;
    if (complex) {
      // Gesamtmaße der Bounding-Box bei unregelmäßigen Grundrissen (zweite Maßreihe)
      const off2 = off * 2;
      nodes.push(
        <DimensionLine key="hw" from={{ x: b.minX, y: b.maxY + off2 }} to={{ x: b.maxX, y: b.maxY + off2 }} ext={[{ x: b.minX, y: b.maxY }, { x: b.maxX, y: b.maxY }]} label={formatLength(b.maxX - b.minX)} s={s} color={pal.line} textColor={pal.text} bg={pal.bg} labelDir={{ x: 0, y: 1 }} />,
        <DimensionLine key="hd" from={{ x: b.maxX + off2, y: b.minY }} to={{ x: b.maxX + off2, y: b.maxY }} ext={[{ x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }]} label={formatLength(b.maxY - b.minY)} s={s} color={pal.line} textColor={pal.text} bg={pal.bg} labelDir={{ x: 1, y: 0 }} />,
      );
    }
    nodes.push(<DimText key="sum" x={(b.minX + b.maxX) / 2} y={b.maxY + (complex ? 3.4 : 1.9) * off} text={hallSummaryText(hall.polygon)} s={s} color={pal.text} bg={pal.bg} bold />);
    return nodes;
  }, [floor.hall, s, pal]);

  const selectedWallIds = useMemo(() => {
    const set = new Set<string>();
    for (const x of selection) if (x.kind === 'wall') set.add(x.id);
    return set;
  }, [selection]);

  const wallNodes = useMemo(() => {
    const walls = wallsToDimension(floor.walls, selectedWallIds, scale);
    if (!walls.length) return null;
    return walls.map((w) => {
      const n = wallNormal(w);
      const m = wallMidpoint(w);
      const off = w.thickness / 2 + 8 * s;
      const sel = selectedWallIds.has(w.id);
      return (
        <DimText key={`w:${w.id}`} x={m.x + n.x * off} y={m.y + n.y * off} text={formatLength(wallLength(w))} s={s} rotation={readableRotation(sub(w.end, w.start))} color={sel ? pal.accent : pal.text} bg={pal.bg} />
      );
    });
  }, [floor.walls, selectedWallIds, scale, s, pal]);

  const itemNodes = useMemo(() => {
    const ids = new Set<string>();
    for (const x of selection) if (x.kind === 'item') ids.add(x.id);
    if (!ids.size) return null;
    const nodes: ReactNode[] = [];
    for (const it of items) {
      if (!ids.has(it.id) || it.hidden) continue;
      const b = bbox(itemFootprint(it));
      nodes.push(
        <DimText key={`i:${it.id}`} x={(b.minX + b.maxX) / 2} y={b.maxY + 11 * s} text={`${formatNumber(it.width, 1)} × ${formatNumber(it.depth, 1)} cm`} s={s} color={pal.accent} bg={pal.bg} />,
      );
    }
    return nodes;
  }, [selection, items, s, pal]);

  return (
    <Group listening={false}>
      {hallNodes}
      {wallNodes}
      {itemNodes}
    </Group>
  );
});
