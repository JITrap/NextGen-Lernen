/**
 * Auswahl-Ebene: Umrisse der gewählten Elemente, Bounding-Box bei Mehrfachauswahl, Griffe
 * (Skalieren nur bei skalierbaren Objekten, Drehen, Wandknoten, Hallen-Ecken, Zonen-Ecken) und
 * Schloss-Hinweis bei gesperrten Objekten.
 *
 * Die Griff-Positionen berechnet die reine Funktion `selectionHandles` – das Auswahl-Werkzeug nutzt
 * dieselbe Funktion, um Griffe per Abstand zum Weltpunkt zu erkennen (Konva-Nodes hier hören nicht auf Events).
 * Beim transienten Ziehen (editor/dragPreview.ts) werden die Umrisse an der Vorschauposition gezeichnet.
 */
import { memo, useMemo } from 'react';
import { Group, Line, Rect, Circle } from 'react-konva';
import type { Floor, PlacedItem, Project, Selection, Vec2, Wall, Zone, VoidArea, Annotation } from '@/types';
import type { LayerProps } from './LayerProps';
import { getDef } from '@/data/equipment';
import { bbox, flatten, type BBox } from '@/geometry/polygon';
import { itemFootprint, localToWorld } from '@/geometry/transform';
import { findWall, isHallWallId, openingPlacement, wallRect } from '@/geometry/walls';
import { previewedItems, useDragPreview } from '../dragPreview';

/* ------------------------------------------------------------------ */
/* Griffe (rein)                                                       */
/* ------------------------------------------------------------------ */

export type HandleKind = 'rotate' | 'scale' | 'wallNode' | 'hallVertex' | 'zoneVertex' | 'voidVertex' | 'measureEnd';

export interface Handle {
  kind: HandleKind;
  /** Element-ID (Objekt, Wand, Zone …); bei Hallen-Ecken die Ecknummer als String. */
  id: string;
  /** Index (Polygon-Ecke, Wandende 0/1, Messlinien-Ende 0/1, Skaliergriff-Nummer). */
  index: number;
  x: number;
  y: number;
  /** Griffradius in Weltkoordinaten (Bildschirm-konstant). */
  r: number;
  cursor: string;
  /** Skaliergriffe: welche lokale Kante bewegt wird (-1/0/1 je Achse). */
  sx?: -1 | 0 | 1;
  sy?: -1 | 0 | 1;
}

/** Daten, die die Griffberechnung braucht (Teilmenge von ToolContext/LayerProps). */
export interface HandleData {
  floor: Floor;
  /** Sichtbare Objekte (inkl. verlinkter Treppen). */
  items: PlacedItem[];
  project: Pick<Project, 'customEquipment'>;
}

/** Griffgröße in Pixeln (Radius). */
export const HANDLE_PX = 6;
/** Abstand des Drehgriffs über der Auswahl in Pixeln. */
export const ROTATE_HANDLE_OFFSET_PX = 28;

function unionBox(boxes: BBox[]): BBox | null {
  if (!boxes.length) return null;
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const x of boxes) {
    if (x.minX < b.minX) b.minX = x.minX;
    if (x.minY < b.minY) b.minY = x.minY;
    if (x.maxX > b.maxX) b.maxX = x.maxX;
    if (x.maxY > b.maxY) b.maxY = x.maxY;
  }
  return b;
}

function textBox(a: Extract<Annotation, { kind: 'text' }>): BBox {
  const w = Math.max(60, a.text.length * a.fontSize * 0.6);
  return { minX: a.x, minY: a.y, maxX: a.x + w, maxY: a.y + a.fontSize * 1.4 };
}

/** Gewählte Objekte in Stockwerks-Reihenfolge. */
export function selectedItemsOf(selection: Selection[], items: PlacedItem[]): PlacedItem[] {
  const ids = new Set<string>();
  for (const s of selection) if (s.kind === 'item') ids.add(s.id);
  return ids.size ? items.filter((it) => ids.has(it.id)) : [];
}

/** Bounding-Box aller gewählten Objekte (axial), null ohne Objekt-Auswahl. */
export function itemsBounds(items: PlacedItem[]): BBox | null {
  return unionBox(items.map((it) => bbox(itemFootprint(it))));
}

/** Ist ein Objekt skalierbar (nur generische Objekte laut Bibliothek)? Unbekannte Definitionen gelten als nicht skalierbar. */
export function isItemScalable(item: PlacedItem, project: Pick<Project, 'customEquipment'>): boolean {
  const def = getDef(item.defId, project);
  return !!def?.skalierbar;
}

/** Cursor für einen Skaliergriff anhand der Welt-Richtung. */
function scaleCursor(dir: Vec2): string {
  const a = ((Math.atan2(dir.y, dir.x) * 180) / Math.PI + 360) % 180;
  if (a < 22.5 || a >= 157.5) return 'ew-resize';
  if (a < 67.5) return 'nwse-resize';
  if (a < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

/**
 * Berechnet alle Griffe der aktuellen Auswahl in Weltkoordinaten.
 * `scale` = Pixel pro cm (viewport.scale), damit Griffgrößen auf dem Bildschirm konstant bleiben.
 */
export function selectionHandles(selection: Selection[], data: HandleData, scale: number): Handle[] {
  const out: Handle[] = [];
  if (!selection.length || !(scale > 0)) return out;
  const r = HANDLE_PX / scale;
  const { floor } = data;

  // Objekte: Drehgriff (wenn mindestens ein bewegliches Objekt), Skaliergriffe bei genau einem skalierbaren Objekt
  const items = selectedItemsOf(selection, data.items);
  if (items.length) {
    const movable = items.filter((it) => !it.locked);
    const box = itemsBounds(items);
    if (movable.length && box) {
      out.push({ kind: 'rotate', id: items.length === 1 ? items[0].id : '*', index: 0, x: (box.minX + box.maxX) / 2, y: box.minY - ROTATE_HANDLE_OFFSET_PX / scale, r, cursor: 'grab' });
    }
    if (items.length === 1 && !items[0].locked && isItemScalable(items[0], data.project)) {
      const it = items[0];
      const hw = it.width / 2;
      const hd = it.depth / 2;
      let index = 0;
      for (const sy of [-1, 0, 1] as const) {
        for (const sx of [-1, 0, 1] as const) {
          if (!sx && !sy) continue;
          const p = localToWorld({ x: sx * hw, y: sy * hd }, it);
          const dir = { x: p.x - it.x, y: p.y - it.y };
          out.push({ kind: 'scale', id: it.id, index: index++, x: p.x, y: p.y, r: r * 0.9, cursor: scaleCursor(dir), sx, sy });
        }
      }
    }
  }

  // Wandknoten: genau eine echte, nicht gesperrte Wand
  const wallSel = selection.filter((s) => s.kind === 'wall');
  if (wallSel.length === 1 && !isHallWallId(wallSel[0].id)) {
    const w = floor.walls.find((x) => x.id === wallSel[0].id);
    if (w && !w.locked) {
      out.push({ kind: 'wallNode', id: w.id, index: 0, x: w.start.x, y: w.start.y, r, cursor: 'move' });
      out.push({ kind: 'wallNode', id: w.id, index: 1, x: w.end.x, y: w.end.y, r, cursor: 'move' });
    }
  }

  // Hallen-Ecken: bei Auswahl einer Ecke oder Kante alle Ecken als Griffe
  if (floor.hall && selection.some((s) => s.kind === 'hallVertex' || s.kind === 'hallEdge')) {
    floor.hall.polygon.forEach((p, i) => out.push({ kind: 'hallVertex', id: String(i), index: i, x: p.x, y: p.y, r, cursor: 'move' }));
  }

  // Zonen-/Luftraum-Ecken bei Einzelauswahl
  if (selection.length === 1) {
    const s = selection[0];
    if (s.kind === 'zone') {
      const z = floor.zones.find((x) => x.id === s.id);
      if (z && !z.locked) z.polygon.forEach((p, i) => out.push({ kind: 'zoneVertex', id: z.id, index: i, x: p.x, y: p.y, r, cursor: 'move' }));
    } else if (s.kind === 'void') {
      const v = floor.voids.find((x) => x.id === s.id);
      if (v) v.polygon.forEach((p, i) => out.push({ kind: 'voidVertex', id: v.id, index: i, x: p.x, y: p.y, r, cursor: 'move' }));
    } else if (s.kind === 'annotation') {
      const a = floor.annotations.find((x) => x.id === s.id);
      if (a && a.kind === 'measure' && !a.locked) {
        out.push({ kind: 'measureEnd', id: a.id, index: 0, x: a.start.x, y: a.start.y, r, cursor: 'move' });
        out.push({ kind: 'measureEnd', id: a.id, index: 1, x: a.end.x, y: a.end.y, r, cursor: 'move' });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Darstellung                                                         */
/* ------------------------------------------------------------------ */

interface Palette {
  accent: string;
  accentSoft: string;
  handleFill: string;
  locked: string;
  box: string;
}
function palette(dark: boolean): Palette {
  return dark
    ? { accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.14)', handleFill: '#0f172a', locked: '#94a3b8', box: 'rgba(96,165,250,0.7)' }
    : { accent: '#2563eb', accentSoft: 'rgba(37,99,235,0.12)', handleFill: '#ffffff', locked: '#64748b', box: 'rgba(37,99,235,0.7)' };
}

/** Kleines Schloss-Symbol (Bügel + Körper) in Weltkoordinaten, Größe Bildschirm-konstant. */
function LockIcon({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  const w = 10 * s;
  const h = 8 * s;
  return (
    <Group x={x} y={y} listening={false}>
      <Rect x={-w / 2} y={0} width={w} height={h} fill={color} cornerRadius={1.5 * s} />
      <Line points={[-w / 4, 0, -w / 4, -3 * s, w / 4, -3 * s, w / 4, 0]} stroke={color} strokeWidth={1.6 * s} tension={0.6} lineCap="round" />
    </Group>
  );
}

function HandleDot({ h, pal, s }: { h: Handle; pal: Palette; s: number }) {
  if (h.kind === 'scale') {
    const size = h.r * 1.6;
    return <Rect x={h.x - size / 2} y={h.y - size / 2} width={size} height={size} fill={pal.handleFill} stroke={pal.accent} strokeWidth={1.5 * s} listening={false} />;
  }
  if (h.kind === 'rotate') {
    return (
      <Group listening={false}>
        <Circle x={h.x} y={h.y} radius={h.r} fill={pal.handleFill} stroke={pal.accent} strokeWidth={1.5 * s} />
        <Circle x={h.x} y={h.y} radius={h.r * 0.45} fill={pal.accent} />
      </Group>
    );
  }
  return <Circle x={h.x} y={h.y} radius={h.r} fill={pal.handleFill} stroke={pal.accent} strokeWidth={1.5 * s} listening={false} />;
}

function itemStroke(it: PlacedItem, pal: Palette) {
  return it.locked ? pal.locked : pal.accent;
}

export const SelectionLayer = memo(function SelectionLayer(props: LayerProps) {
  const { floor, viewport, selection, dark, project, hoverId } = props;
  // Transient gezogene Objekte an ihrer Vorschauposition (Umriss, Bounding-Box, Griffe folgen dem Zeiger)
  const preview = useDragPreview((st) => st.items);
  const items = useMemo(() => previewedItems(props.items, preview), [props.items, preview]);
  const s = 1 / viewport.scale;
  const pal = useMemo(() => palette(dark), [dark]);

  const handles = useMemo(() => selectionHandles(selection, { floor, items, project }, viewport.scale), [selection, floor, items, project, viewport.scale]);

  const content = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    if (!selection.length) return nodes;
    const selItems = selectedItemsOf(selection, items);
    const dash = [6 * s, 4 * s];

    // Objekte: Umriss (Footprint)
    for (const it of selItems) {
      const fp = itemFootprint(it);
      nodes.push(
        <Line key={`it:${it.id}`} points={flatten(fp)} closed stroke={itemStroke(it, pal)} strokeWidth={2 * s} fill={it.locked ? undefined : pal.accentSoft} dash={it.locked ? dash : undefined} listening={false} />,
      );
      if (it.locked) {
        const b = bbox(fp);
        nodes.push(<LockIcon key={`lock:${it.id}`} x={b.maxX - 9 * s} y={b.minY + 6 * s} s={s} color={pal.locked} />);
      }
    }
    // Bounding-Box bei Mehrfachauswahl
    if (selItems.length > 1) {
      const b = itemsBounds(selItems)!;
      const pad = 4 * s;
      nodes.push(
        <Rect key="bbox" x={b.minX - pad} y={b.minY - pad} width={b.maxX - b.minX + 2 * pad} height={b.maxY - b.minY + 2 * pad} stroke={pal.box} strokeWidth={1 * s} dash={dash} listening={false} />,
      );
    }
    // Linie zum Drehgriff
    const rot = handles.find((h) => h.kind === 'rotate');
    if (rot) {
      const b = itemsBounds(selItems);
      if (b) nodes.push(<Line key="rotline" points={[rot.x, b.minY - (selItems.length > 1 ? 4 * s : 0), rot.x, rot.y + rot.r]} stroke={pal.accent} strokeWidth={1 * s} listening={false} />);
    }

    for (const sel of selection) {
      switch (sel.kind) {
        case 'wall': {
          const w: Wall | undefined = findWall(floor, sel.id);
          if (!w) break;
          nodes.push(<Line key={`w:${sel.id}`} points={flatten(wallRect(w))} closed stroke={w.locked ? pal.locked : pal.accent} strokeWidth={2 * s} fill={pal.accentSoft} dash={w.locked ? dash : undefined} listening={false} />);
          if (w.locked) {
            const m = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
            nodes.push(<LockIcon key={`wl:${sel.id}`} x={m.x} y={m.y - 4 * s} s={s} color={pal.locked} />);
          }
          break;
        }
        case 'opening': {
          const o = floor.openings.find((x) => x.id === sel.id);
          const w = o ? findWall(floor, o.wallId) : undefined;
          if (!o || !w) break;
          const pl = openingPlacement(o, w);
          const n = { x: pl.normal.x * (w.thickness / 2 + 3 * s), y: pl.normal.y * (w.thickness / 2 + 3 * s) };
          const poly = [
            { x: pl.a.x + n.x, y: pl.a.y + n.y },
            { x: pl.b.x + n.x, y: pl.b.y + n.y },
            { x: pl.b.x - n.x, y: pl.b.y - n.y },
            { x: pl.a.x - n.x, y: pl.a.y - n.y },
          ];
          nodes.push(<Line key={`o:${sel.id}`} points={flatten(poly)} closed stroke={o.locked ? pal.locked : pal.accent} strokeWidth={2 * s} fill={pal.accentSoft} dash={o.locked ? dash : undefined} listening={false} />);
          break;
        }
        case 'zone': {
          const z: Zone | undefined = floor.zones.find((x) => x.id === sel.id);
          if (!z) break;
          nodes.push(<Line key={`z:${sel.id}`} points={flatten(z.polygon)} closed stroke={z.locked ? pal.locked : pal.accent} strokeWidth={2 * s} dash={z.locked ? dash : undefined} listening={false} />);
          break;
        }
        case 'room': {
          const r = props.rooms.find((x) => x.id === sel.id);
          if (!r) break;
          nodes.push(<Line key={`r:${sel.id}`} points={flatten(r.polygon)} closed stroke={pal.accent} strokeWidth={2 * s} dash={dash} listening={false} />);
          break;
        }
        case 'void': {
          const v: VoidArea | undefined = floor.voids.find((x) => x.id === sel.id);
          if (!v) break;
          nodes.push(<Line key={`v:${sel.id}`} points={flatten(v.polygon)} closed stroke={pal.accent} strokeWidth={2 * s} dash={dash} listening={false} />);
          break;
        }
        case 'annotation': {
          const a = floor.annotations.find((x) => x.id === sel.id);
          if (!a) break;
          if (a.kind === 'text') {
            const b = textBox(a);
            nodes.push(<Rect key={`a:${sel.id}`} x={b.minX - 2 * s} y={b.minY - 2 * s} width={b.maxX - b.minX + 4 * s} height={b.maxY - b.minY + 4 * s} rotation={a.rotation} stroke={a.locked ? pal.locked : pal.accent} strokeWidth={1.5 * s} dash={dash} listening={false} />);
          } else {
            nodes.push(<Line key={`a:${sel.id}`} points={[a.start.x, a.start.y, a.end.x, a.end.y]} stroke={a.locked ? pal.locked : pal.accent} strokeWidth={4 * s} opacity={0.5} listening={false} />);
          }
          break;
        }
        case 'hallEdge': {
          const poly = floor.hall?.polygon;
          const i = Number(sel.id);
          if (!poly || !Number.isInteger(i) || i < 0 || i >= poly.length) break;
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          nodes.push(<Line key={`he:${sel.id}`} points={[a.x, a.y, b.x, b.y]} stroke={pal.accent} strokeWidth={4 * s} opacity={0.7} listening={false} />);
          break;
        }
        default:
          break;
      }
    }
    return nodes;
  }, [selection, items, floor, props.rooms, pal, s, handles]);

  // Hover-Umriss (nur wenn nicht bereits gewählt)
  const hover = useMemo(() => {
    if (!hoverId || selection.some((x) => x.kind === 'item' && x.id === hoverId)) return null;
    const it = items.find((x) => x.id === hoverId);
    if (!it || it.hidden) return null;
    return <Line points={flatten(itemFootprint(it))} closed stroke={pal.accent} strokeWidth={1.5 * s} opacity={0.6} listening={false} />;
  }, [hoverId, selection, items, pal, s]);

  // Hallen-Ecken als kleine Punkte, wenn nichts gewählt ist (Hinweis auf Verschiebbarkeit)
  const hallDots = useMemo(() => {
    if (selection.length || !floor.hall) return null;
    return floor.hall.polygon.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={3 * s} fill={pal.handleFill} stroke={pal.accent} strokeWidth={1 * s} opacity={0.8} listening={false} />);
  }, [selection.length, floor.hall, pal, s]);

  return (
    <Group listening={false}>
      {hover}
      {hallDots}
      {content}
      {handles.map((h) => (
        <HandleDot key={`${h.kind}:${h.id}:${h.index}`} h={h} pal={pal} s={s} />
      ))}
    </Group>
  );
});
