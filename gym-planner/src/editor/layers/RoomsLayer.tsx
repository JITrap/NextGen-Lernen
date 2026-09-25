/**
 * Ebene „Räume“: automatisch erkannte Räume und Zonen (Füllung in Raumtyp-Farbe, Rand – Zonen gestrichelt –,
 * Beschriftung mit Name und/oder m² in der Raummitte) sowie Lufträume (blaue Schraffur, „Luftraum (offen)“).
 * Weltkoordinaten; Schrift und Linienbreiten bildschirm-konstant (1 / viewport.scale).
 * Räume mit Löchern (Raum im Raum) werden per Konva-Shape mit fillRule 'evenodd' gefüllt.
 * Die Ebene ist nicht klickbar (Auswahl über hitTest), daher listening={false}.
 */
import { memo, useMemo, type ReactNode } from 'react';
import { Group, Line, Shape, Text } from 'react-konva';
import type Konva from 'konva';
import type { Room, RoomLabelMode, Vec2, VoidArea } from '@/types';
import type { LayerProps } from './LayerProps';
import { roomColor } from '@/data/roomTypes';
import { bbox, flatten, pointInPolygon, distanceToSegment, lerp, polygonArea, centroid as polyCentroid, type BBox } from '@/geometry/polygon';
import { formatM2, cm2ToM2 } from '@/geometry/units';

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
/** Beschriftung nur, wenn der Raum auf dem Bildschirm mindestens so breit ist (px). */
const MIN_LABEL_PX = 60;
/** Zweite Zeile (Fläche) nur, wenn der Raum so hoch ist (px). */
const MIN_TWO_LINE_PX = 34;

/* ------------------------------------------------------------------ */
/* Beschriftungsposition                                               */
/* ------------------------------------------------------------------ */

function minEdgeDistance(p: Vec2, poly: Vec2[]): number {
  let m = Infinity;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const d = distanceToSegment(p, poly[i], poly[j]);
    if (d < m) m = d;
  }
  return m;
}

/**
 * Punkt für die Beschriftung: Flächenschwerpunkt, wenn er im Polygon (und in keinem Loch) liegt,
 * sonst Bounding-Box-Mitte, sonst der „innerste“ Mittelpunkt zwischen Schwerpunkt und einer Ecke (L-Formen).
 */
export function labelAnchor(polygon: Vec2[], centroid: Vec2, holes: Vec2[][] = []): Vec2 {
  if (polygon.length < 3) return centroid;
  const inside = (p: Vec2) => pointInPolygon(p, polygon) && !holes.some((h) => pointInPolygon(p, h));
  if (inside(centroid) && minEdgeDistance(centroid, polygon) > 1) return centroid;
  const b = bbox(polygon);
  const bc = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  if (inside(bc) && minEdgeDistance(bc, polygon) > 1) return bc;
  let best: Vec2 | null = null;
  let bestD = 0;
  for (const v of polygon) {
    for (const t of [0.5, 0.35, 0.65]) {
      const m = lerp(centroid, v, t);
      if (!inside(m)) continue;
      const d = minEdgeDistance(m, polygon);
      if (d > bestD) {
        bestD = d;
        best = m;
      }
    }
  }
  return best ?? centroid;
}

/* ------------------------------------------------------------------ */
/* Raum                                                                */
/* ------------------------------------------------------------------ */

interface RoomNodeProps {
  room: Room;
  scale: number;
  dark: boolean;
  selected: boolean;
  hovered: boolean;
  showLabels: boolean;
}

function drawPolygonPath(c: Konva.Context, poly: Vec2[]) {
  c.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) c.lineTo(poly[i].x, poly[i].y);
  c.closePath();
}

const RoomNode = memo(function RoomNode({ room, scale, dark, selected, hovered, showLabels }: RoomNodeProps) {
  const s = 1 / scale;
  const color = roomColor(room.type, room.color);
  const isZone = room.source === 'zone';
  const holes = room.holes;
  const geo = useMemo(
    () => ({ box: bbox(room.polygon), flat: flatten(room.polygon), anchor: labelAnchor(room.polygon, room.centroid, holes) }),
    [room.polygon, room.centroid, holes],
  );
  const { box } = geo;
  const emphasis = selected || hovered;
  const wPx = (box.maxX - box.minX) * scale;
  const hPx = (box.maxY - box.minY) * scale;
  const mode: RoomLabelMode = room.labelMode ?? 'name+area';
  const wantName = mode === 'name+area' || mode === 'name';
  const wantArea = mode === 'name+area' || mode === 'area';
  const big = wPx > MIN_LABEL_PX;
  const showName = showLabels && wantName && big;
  const showArea = showLabels && wantArea && big && (mode === 'area' || hPx > MIN_TWO_LINE_PX);
  const both = showName && showArea;
  const textColor = dark ? '#e2e8f0' : '#0f172a';
  const opacity = isZone ? 0.35 : 0.28;
  const labelW = Math.max(box.maxX - box.minX - 8 * s, 20 * s);

  const fill =
    holes && holes.length ? (
      <Shape
        sceneFunc={(c, shape) => {
          c.beginPath();
          drawPolygonPath(c, room.polygon);
          for (const h of holes) if (h.length >= 3) drawPolygonPath(c, h);
          c.fillStrokeShape(shape);
        }}
        fill={color}
        fillRule="evenodd"
        opacity={opacity}
        listening={false}
      />
    ) : (
      <Line points={geo.flat} closed fill={color} opacity={opacity} listening={false} />
    );

  return (
    <Group listening={false}>
      {fill}
      <Line points={geo.flat} closed stroke={color} strokeWidth={(emphasis ? 2.5 : 1) * s} dash={isZone ? [8 * s, 4 * s] : undefined} opacity={emphasis ? 1 : 0.85} listening={false} />
      {showName && (
        <Text
          x={geo.anchor.x}
          y={geo.anchor.y - (both ? 14 : 7) * s}
          width={labelW}
          offsetX={labelW / 2}
          text={room.name}
          fontSize={12 * s}
          fontFamily={FONT}
          fontStyle="bold"
          fill={textColor}
          align="center"
          wrap="none"
          ellipsis
          listening={false}
        />
      )}
      {showArea && (
        <Text
          x={geo.anchor.x}
          y={geo.anchor.y + (both ? 1 : -6.5) * s}
          width={labelW}
          offsetX={labelW / 2}
          text={formatM2(room.areaM2)}
          fontSize={11 * s}
          fontFamily={FONT}
          fill={textColor}
          opacity={0.9}
          align="center"
          wrap="none"
          ellipsis
          listening={false}
        />
      )}
    </Group>
  );
});

/* ------------------------------------------------------------------ */
/* Luftraum                                                            */
/* ------------------------------------------------------------------ */

/** Blaue Schraffur + gestrichelter Rand für einen Luftraum (auch vom Luftraum-Werkzeug als Vorschau genutzt). */
export const VoidHatch = memo(function VoidHatch({ polygon, scale, dark, emphasis = false }: { polygon: Vec2[]; scale: number; dark: boolean; emphasis?: boolean }) {
  const s = 1 / scale;
  const col = dark ? '#60a5fa' : '#2563eb';
  const box: BBox = bbox(polygon);
  const flat = flatten(polygon);
  if (polygon.length < 3) return null;
  return (
    <Group listening={false}>
      <Line points={flat} closed fill={dark ? 'rgba(96,165,250,0.10)' : 'rgba(37,99,235,0.08)'} listening={false} />
      <Shape
        listening={false}
        sceneFunc={(c) => {
          c.save();
          c.beginPath();
          drawPolygonPath(c, polygon);
          c.clip();
          c.beginPath();
          const w = box.maxX - box.minX;
          const h = box.maxY - box.minY;
          let step = 14 * s * Math.SQRT2;
          const maxLines = 1500;
          if ((w + h) / step > maxLines) step = (w + h) / maxLines;
          for (let x = box.minX - h; x <= box.maxX; x += step) {
            c.moveTo(x, box.maxY);
            c.lineTo(x + h, box.minY);
          }
          c.setAttr('strokeStyle', col);
          c.setAttr('lineWidth', 1 * s);
          c.setAttr('globalAlpha', 0.55);
          c.stroke();
          c.restore();
        }}
      />
      <Line points={flat} closed stroke={col} strokeWidth={(emphasis ? 2.5 : 1.2) * s} dash={[10 * s, 5 * s]} opacity={0.9} listening={false} />
    </Group>
  );
});

const VoidNode = memo(function VoidNode({ v, scale, dark, selected, showLabels }: { v: VoidArea; scale: number; dark: boolean; selected: boolean; showLabels: boolean }) {
  const s = 1 / scale;
  const geo = useMemo(() => {
    const box = bbox(v.polygon);
    return { box, anchor: labelAnchor(v.polygon, polyCentroid(v.polygon)), area: cm2ToM2(polygonArea(v.polygon)) };
  }, [v.polygon]);
  const wPx = (geo.box.maxX - geo.box.minX) * scale;
  const hPx = (geo.box.maxY - geo.box.minY) * scale;
  const col = dark ? '#93c5fd' : '#1d4ed8';
  const showLabel = showLabels && wPx > MIN_LABEL_PX;
  const twoLines = showLabel && hPx > MIN_TWO_LINE_PX;
  const labelW = Math.max(geo.box.maxX - geo.box.minX - 8 * s, 20 * s);
  const title = `${v.name?.trim() || 'Luftraum'} (offen)`;
  return (
    <Group listening={false}>
      <VoidHatch polygon={v.polygon} scale={scale} dark={dark} emphasis={selected} />
      {showLabel && (
        <Text
          x={geo.anchor.x}
          y={geo.anchor.y - (twoLines ? 14 : 7) * s}
          width={labelW}
          offsetX={labelW / 2}
          text={title}
          fontSize={12 * s}
          fontFamily={FONT}
          fontStyle="bold"
          fill={col}
          align="center"
          wrap="none"
          ellipsis
          listening={false}
        />
      )}
      {twoLines && (
        <Text
          x={geo.anchor.x}
          y={geo.anchor.y + 1 * s}
          width={labelW}
          offsetX={labelW / 2}
          text={`${formatM2(geo.area)} · nicht Nutzfläche`}
          fontSize={11 * s}
          fontFamily={FONT}
          fill={col}
          opacity={0.9}
          align="center"
          wrap="none"
          ellipsis
          listening={false}
        />
      )}
    </Group>
  );
});

/* ------------------------------------------------------------------ */
/* Ebene                                                               */
/* ------------------------------------------------------------------ */

export const RoomsLayer = memo(function RoomsLayer(props: LayerProps) {
  const { rooms, floor, viewport, selection, hoverId, dark, project } = props;
  const scale = viewport.scale;
  const selectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const x of selection) if (x.kind === 'zone' || x.kind === 'room' || x.kind === 'void') set.add(x.id);
    return set;
  }, [selection]);
  const showLabels = project.layers.labels;
  const nodes: ReactNode[] = [];
  for (const r of rooms) {
    if (r.polygon.length < 3) continue;
    nodes.push(<RoomNode key={r.id} room={r} scale={scale} dark={dark} selected={selectedIds.has(r.id)} hovered={hoverId === r.id} showLabels={showLabels} />);
  }
  if (project.layers.voids) {
    for (const v of floor.voids) {
      if (v.polygon.length < 3) continue;
      nodes.push(<VoidNode key={v.id} v={v} scale={scale} dark={dark} selected={selectedIds.has(v.id)} showLabels={showLabels} />);
    }
  }
  return <Group listening={false}>{nodes}</Group>;
});
