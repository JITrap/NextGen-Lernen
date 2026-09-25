/**
 * Rendert einen Stockwerksplan in einen eigenständigen, unsichtbaren Konva-Stage (ohne React) mit fester
 * Pixelzahl pro Zentimeter – Grundlage für PNG (hohe Auflösung) und PDF (maßstäblich).
 *
 * Alle Zeichenoperationen laufen in Weltkoordinaten (cm); die Ebene ist mit pxPerCm skaliert.
 * Die reinen Helfer (Bounds, Maßstabsrechnung) sind ohne Canvas testbar.
 */
import Konva from 'konva';
import type { Project, Floor, PlacedItem, Room, Wall, Opening, Vec2, LibraryArea, RoomType, EquipmentDef } from '@/types';
import { bbox, type BBox, ensureClockwise, flatten, polygonArea, centroid } from '@/geometry/polygon';
import { allWalls, wallOutline, hallInnerPolygon, hallOuterPolygon, findWall, openingPlacement } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { itemFootprint, itemSafetyPolygon, zoneIsEmpty } from '@/geometry/transform';
import { floorVisibleItems } from '@/store/selectors';
import { roomColor } from '@/data/roomTypes';
import { WALL_TYPE_MAP, DOOR_TYPE_MAP } from '@/data/wallTypes';
import { getDef } from '@/data/equipment';
import { formatM2, formatM, formatLength } from '@/geometry/units';

/* ------------------------------------------------------------------ */
/* Reine Helfer (ohne Canvas)                                          */
/* ------------------------------------------------------------------ */

/** Papiermaß in mm für eine Weltlänge in cm bei Maßstab 1:scale (2500 cm bei 1:100 → 250 mm). */
export function paperMmForCm(cm: number, scale: number): number {
  return (cm * 10) / scale;
}
/** Umkehrung: Weltlänge in cm für ein Papiermaß in mm. */
export function cmForPaperMm(mm: number, scale: number): number {
  return (mm * scale) / 10;
}
/** Pixel pro Welt-cm, damit das Bild auf Papier (Maßstab 1:scale) die gewünschte Auflösung (dpi) hat. */
export function pxPerCmForPaper(scale: number, dpi = 200): number {
  return (10 / scale) * (dpi / 25.4);
}

/** Maximale Kantenlänge eines Export-Bildes in Pixeln (Browser-Canvas-Limits). */
export const MAX_IMAGE_PX = 8000;

/** Begrenzt pxPerCm so, dass die längste Bildseite maxPx nicht überschreitet. */
export function clampPxPerCm(pxPerCm: number, bounds: BBox, maxPx = MAX_IMAGE_PX): number {
  const longest = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  return Math.min(pxPerCm, maxPx / longest);
}

/** Inhaltsbereich eines Stockwerks (Halle, Wände inkl. Stärke, Objekte inkl. Sicherheitszonen, Zonen, Lufträume, Anmerkungen). */
export function floorContentBounds(floor: Floor, project?: Project, includeSafetyZones = true): BBox {
  const pts: Vec2[] = [];
  if (floor.hall) pts.push(...floor.hall.polygon);
  for (const w of floor.walls) {
    if (w.hidden) continue;
    const t = w.thickness / 2;
    pts.push({ x: w.start.x - t, y: w.start.y - t }, { x: w.start.x + t, y: w.start.y + t }, { x: w.end.x - t, y: w.end.y - t }, { x: w.end.x + t, y: w.end.y + t });
  }
  const items = project ? floorVisibleItems(floor, project.floors) : floor.items;
  for (const it of items) {
    if (it.hidden) continue;
    pts.push(...itemFootprint(it));
    if (includeSafetyZones && it.safetyZoneEnabled && !zoneIsEmpty(it.safetyZone)) pts.push(...itemSafetyPolygon(it, it.safetyZone));
  }
  for (const z of floor.zones) if (!z.hidden) pts.push(...z.polygon);
  for (const v of floor.voids) pts.push(...v.polygon);
  for (const a of floor.annotations) {
    if (a.hidden) continue;
    if (a.kind === 'text') pts.push({ x: a.x, y: a.y }, { x: a.x + Math.max(60, a.text.length * a.fontSize * 0.6), y: a.y + a.fontSize * 1.4 });
    else pts.push(a.start, a.end);
  }
  if (!pts.length) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
  const b = bbox(pts);
  if (b.maxX - b.minX < 1) b.maxX = b.minX + 100;
  if (b.maxY - b.minY < 1) b.maxY = b.minY + 100;
  return b;
}

export interface RenderOptions {
  /** Pixel je Welt-cm. */
  pxPerCm: number;
  /** Sicherheitszonen zeichnen (Standard: true). */
  safetyZones?: boolean;
  /** Beschriftungen (Raumnamen, Objekt-Kurznamen) zeichnen (Standard: true). */
  labels?: boolean;
  /** Hintergrundfarbe; null = transparent (Standard: Weiß). */
  background?: string | null;
  /** Bemaßung der Hallenkanten (Standard: true). */
  dimensions?: boolean;
  /** Legende der Raumtypen unter dem Plan (Standard: true). */
  legend?: boolean;
  /** Nordpfeil (Standard: true). */
  northArrow?: boolean;
  /** Maßstabsbalken (Standard: true). */
  scaleBar?: boolean;
  /** Zusatztext am Maßstabsbalken, z. B. „1:100“. */
  scaleLabel?: string;
  /** Rand um den Inhalt in cm (Standard: 150). */
  marginCm?: number;
  /** Faktor für Schriftgrößen (PDF: scale/100, damit Text auf Papier gleich groß bleibt). */
  textScale?: number;
}

export interface RenderLayout {
  /** Inhaltsbereich ohne Rand. */
  contentBounds: BBox;
  /** Planbereich inkl. Rand (ohne Legende). */
  planBounds: BBox;
  /** Gesamtbereich inkl. Legendenstreifen. */
  bounds: BBox;
  widthPx: number;
  heightPx: number;
  pxPerCm: number;
  legendTypes: RoomType[];
  legendRows: number;
  legendCols: number;
}

export const LEGEND_ROW_CM = 46;
export const LEGEND_ENTRY_CM = 560;
export const LEGEND_PAD_CM = 40;

/** Legendeneinträge: alle Raumtypen, die auf dem Stockwerk vorkommen (in Reihenfolge des Auftretens). */
export function legendRoomTypes(rooms: Room[]): RoomType[] {
  const out: RoomType[] = [];
  for (const r of rooms) if (!out.includes(r.type)) out.push(r.type);
  return out;
}

/** Berechnet Bild-Layout (Bereiche und Pixelgröße) ohne zu zeichnen. */
export function layoutFloorRender(project: Project, floor: Floor, opts: RenderOptions): RenderLayout {
  const margin = opts.marginCm ?? 150;
  const contentBounds = floorContentBounds(floor, project, opts.safetyZones ?? true);
  const planBounds: BBox = {
    minX: contentBounds.minX - margin,
    minY: contentBounds.minY - margin,
    maxX: contentBounds.maxX + margin,
    maxY: contentBounds.maxY + margin,
  };
  const legendTypes = (opts.legend ?? true) ? legendRoomTypes(floorRooms(floor)) : [];
  const planWidth = planBounds.maxX - planBounds.minX;
  const legendCols = legendTypes.length ? Math.max(1, Math.floor((planWidth - LEGEND_PAD_CM * 2) / LEGEND_ENTRY_CM)) : 0;
  const legendRows = legendTypes.length ? Math.ceil(legendTypes.length / legendCols) : 0;
  const legendHeight = legendRows ? legendRows * LEGEND_ROW_CM + LEGEND_PAD_CM * 2 : 0;
  const bounds: BBox = { ...planBounds, maxY: planBounds.maxY + legendHeight };
  const pxPerCm = opts.pxPerCm;
  return {
    contentBounds,
    planBounds,
    bounds,
    widthPx: Math.max(1, Math.ceil((bounds.maxX - bounds.minX) * pxPerCm)),
    heightPx: Math.max(1, Math.ceil((bounds.maxY - bounds.minY) * pxPerCm)),
    pxPerCm,
    legendTypes,
    legendRows,
    legendCols,
  };
}

/** Schöne Länge für den Maßstabsbalken (≤ ¼ der Planbreite). */
export function scaleBarLength(planWidthCm: number): number {
  const steps = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  let best = steps[0];
  for (const s of steps) if (s <= planWidthCm / 4) best = s;
  return best;
}

/** Farben der Bibliotheksbereiche (Objekt-Füllung im Export). */
export const AREA_COLORS: Record<LibraryArea, string> = {
  'Kraftgeräte': '#3b82f6',
  'Freihantel-Zubehör': '#6366f1',
  'Cardio': '#ef4444',
  'Functional': '#22c55e',
  'Empfang & Lounge': '#14b8a6',
  'Umkleide': '#ec4899',
  'Sanitär': '#38bdf8',
  'Wellness': '#fb923c',
  'Kursraum': '#a855f7',
  'Büro & Personal': '#94a3b8',
  'Lager & Technik': '#a8a29e',
  'Ausstattung': '#64748b',
  'Bauelemente': '#475569',
  'Eigene': '#8b5cf6',
};

export function itemAreaColor(def: EquipmentDef | undefined): string {
  return def ? (AREA_COLORS[def.bereich] ?? '#64748b') : '#64748b';
}

/** Kurzbezeichnung eines Objekts für Beschriftungen. */
export function itemShortLabel(item: PlacedItem, def: EquipmentDef | undefined): string {
  if (item.label) return item.label;
  if (!def) return item.defId;
  if (def.params && item.params?.faecher != null && def.symbol === 'locker-row') return `${def.name} (${item.params.faecher})`;
  return def.modell ? def.modell : def.name;
}

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

const FONT = 'Inter, Helvetica, Arial, sans-serif';
/** Aktueller Schriftfaktor (nur während drawFloor gesetzt; Rendering ist synchron). */
let textScale = 1;
const INK = '#0f172a';
const MUTED = '#475569';
const HALL_FLOOR = '#ffffff';
const OUTER_WALL = '#1e293b';

export interface RenderResult extends RenderLayout {
  canvas: HTMLCanvasElement;
}

/**
 * Rendert das Stockwerk in ein HTMLCanvasElement. Der temporäre Stage wird in jedem Fall zerstört (try/finally).
 * Wirft, wenn das Bild die Canvas-Grenzen sprengt (Aufrufer sollten clampPxPerCm nutzen).
 */
export function renderFloorToCanvas(project: Project, floor: Floor, opts: RenderOptions): RenderResult {
  const layout = layoutFloorRender(project, floor, opts);
  if (layout.widthPx > 16384 || layout.heightPx > 16384 || layout.widthPx * layout.heightPx > 250_000_000) {
    throw new Error(`Bild zu groß (${layout.widthPx} × ${layout.heightPx} px). Bitte kleinere Auflösung wählen.`);
  }
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: layout.widthPx, height: layout.heightPx });
  try {
    const layer = new Konva.Layer({ listening: false });
    layer.scale({ x: layout.pxPerCm, y: layout.pxPerCm });
    layer.offset({ x: layout.bounds.minX, y: layout.bounds.minY });
    stage.add(layer);
    drawFloor(layer, project, floor, opts, layout);
    layer.draw();
    const canvas = stage.toCanvas({ pixelRatio: 1 });
    return { ...layout, canvas };
  } finally {
    stage.destroy();
  }
}

function drawFloor(layer: Konva.Layer, project: Project, floor: Floor, opts: RenderOptions, layout: RenderLayout) {
  const showSafety = opts.safetyZones ?? true;
  const showLabels = opts.labels ?? true;
  textScale = Math.max(0.2, opts.textScale ?? 1);
  const px = layout.pxPerCm;
  const minLabelPx = 5;
  const { bounds, planBounds } = layout;

  if (opts.background !== null) {
    layer.add(new Konva.Rect({ x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, fill: opts.background ?? '#ffffff' }));
  }

  const walls = allWalls(floor);
  const rooms = floorRooms(floor);
  const items = floorVisibleItems(floor, project.floors);

  // Halle: Außenwandring + Boden
  if (floor.hall && floor.hall.polygon.length >= 3) {
    const outer = hallOuterPolygon(floor.hall);
    const inner = floor.hall.wallThickness > 0 ? hallInnerPolygon(floor.hall) : outer;
    layer.add(new Konva.Line({ points: flatten(outer), closed: true, fill: OUTER_WALL, stroke: OUTER_WALL, strokeWidth: 1, lineJoin: 'miter' }));
    layer.add(new Konva.Line({ points: flatten(inner), closed: true, fill: HALL_FLOOR }));
  }

  // Räume/Zonen
  for (const r of rooms) {
    const color = roomColor(r.type, r.color);
    layer.add(new Konva.Line({ points: flatten(r.polygon), closed: true, fill: color, opacity: 0.28 }));
    layer.add(new Konva.Line({ points: flatten(r.polygon), closed: true, stroke: color, strokeWidth: 2, lineJoin: 'round' }));
    if (showLabels && (r.labelMode ?? 'name+area') !== 'none') {
      const mode = r.labelMode ?? 'name+area';
      const lines: string[] = [];
      if (mode === 'name' || mode === 'name+area') lines.push(r.name);
      if (mode === 'area' || mode === 'name+area') lines.push(formatM2(r.areaM2));
      const side = Math.sqrt(Math.max(1, polygonArea(r.polygon)));
      const fontSize = Math.max(18, Math.min(34, side * 0.09)) * textScale;
      if (fontSize * px >= minLabelPx) {
        const w = Math.max(200, side * 0.9);
        layer.add(new Konva.Text({
          x: r.centroid.x - w / 2, y: r.centroid.y - (lines.length * fontSize * 1.15) / 2, width: w, text: lines.join('\n'),
          fontSize, fontFamily: FONT, fontStyle: 'bold', fill: INK, align: 'center', lineHeight: 1.15, wrap: 'none', ellipsis: true,
        }));
      }
    }
  }

  // Lufträume
  for (const v of floor.voids) {
    if (v.polygon.length < 3) continue;
    layer.add(new Konva.Line({ points: flatten(v.polygon), closed: true, fill: '#64748b', opacity: 0.12 }));
    layer.add(new Konva.Line({ points: flatten(v.polygon), closed: true, stroke: '#64748b', strokeWidth: 2, dash: [20, 10] }));
    const b = bbox(v.polygon);
    const step = 60;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const g = new Konva.Group({ clipFunc: (ctx) => { ctx.beginPath(); v.polygon.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); } });
    for (let d = -h; d < w; d += step) {
      g.add(new Konva.Line({ points: [b.minX + d, b.minY, b.minX + d + h, b.maxY], stroke: '#64748b', strokeWidth: 1, opacity: 0.5 }));
    }
    layer.add(g);
    if (showLabels) {
      const c = centroid(v.polygon);
      const fontSize = 22 * textScale;
      if (fontSize * px >= minLabelPx) {
        layer.add(new Konva.Text({ x: c.x - 300, y: c.y - fontSize / 2, width: 600, align: 'center', text: v.name ?? 'Luftraum (offen nach unten)', fontSize, fontFamily: FONT, fill: MUTED, wrap: 'none', ellipsis: true }));
      }
    }
  }

  // Wände
  for (const w of floor.walls) {
    if (w.hidden) continue;
    const info = WALL_TYPE_MAP[w.type];
    const outline = wallOutline(w, walls);
    const pattern = info?.pattern ?? 'solid';
    if (pattern === 'glass') {
      layer.add(new Konva.Line({ points: flatten(outline), closed: true, fill: '#bae6fd', stroke: '#0284c7', strokeWidth: 1.5 }));
      layer.add(new Konva.Line({ points: [w.start.x, w.start.y, w.end.x, w.end.y], stroke: '#0284c7', strokeWidth: 1.5 }));
    } else if (pattern === 'dashed' || pattern === 'net') {
      layer.add(new Konva.Line({ points: flatten(outline), closed: true, fill: info?.color ?? '#64748b', opacity: 0.35 }));
      layer.add(new Konva.Line({ points: flatten(outline), closed: true, stroke: info?.color ?? '#64748b', strokeWidth: 2, dash: pattern === 'net' ? [8, 6] : [24, 12] }));
    } else {
      layer.add(new Konva.Line({ points: flatten(outline), closed: true, fill: info?.color ?? '#475569', stroke: '#1e293b', strokeWidth: 1, lineJoin: 'miter' }));
      if (pattern === 'hatch') drawHatch(layer, outline, '#f8fafc');
    }
  }

  // Öffnungen
  for (const o of floor.openings) {
    if (o.hidden) continue;
    const wall = findWall(floor, o.wallId);
    if (!wall) continue;
    drawOpening(layer, o, wall);
  }

  // Sicherheitszonen (unter den Objekten)
  if (showSafety) {
    for (const it of items) {
      if (it.hidden || !it.safetyZoneEnabled || zoneIsEmpty(it.safetyZone)) continue;
      const poly = itemSafetyPolygon(it, it.safetyZone);
      layer.add(new Konva.Line({ points: flatten(poly), closed: true, fill: '#f59e0b', opacity: 0.12 }));
      layer.add(new Konva.Line({ points: flatten(poly), closed: true, stroke: '#f59e0b', strokeWidth: 1.5, dash: [10, 8], opacity: 0.8 }));
    }
  }

  // Objekte
  for (const it of items) {
    if (it.hidden) continue;
    drawItem(layer, it, project, showLabels, px, minLabelPx);
  }

  // Anmerkungen
  for (const a of floor.annotations) {
    if (a.hidden) continue;
    if (a.kind === 'text') {
      if (a.fontSize * px >= minLabelPx) {
        layer.add(new Konva.Text({ x: a.x, y: a.y, text: a.text, fontSize: a.fontSize, fontFamily: FONT, fill: a.color ?? INK, rotation: a.rotation }));
      }
    } else {
      drawMeasure(layer, a.start, a.end, '#e11d48', px, minLabelPx);
    }
  }

  // Bemaßung der Hallenkanten
  if ((opts.dimensions ?? true) && floor.hall && floor.hall.polygon.length >= 3) {
    const poly = ensureClockwise(floor.hall.polygon);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      drawDimension(layer, a, b, 70, px, minLabelPx);
    }
  }

  // Nordpfeil (oben rechts im Rand)
  if (opts.northArrow ?? true) {
    const cx = planBounds.maxX - 70;
    const cy = planBounds.minY + 80;
    layer.add(new Konva.Line({ points: [cx, cy - 45, cx + 16, cy + 30, cx, cy + 18, cx - 16, cy + 30], closed: true, fill: INK }));
    layer.add(new Konva.Text({ x: cx - 30, y: cy + 36, width: 60, align: 'center', text: 'N', fontSize: 24 * textScale, fontFamily: FONT, fontStyle: 'bold', fill: INK }));
  }

  // Maßstabsbalken (unten links im Rand)
  if (opts.scaleBar ?? true) {
    const len = scaleBarLength(planBounds.maxX - planBounds.minX);
    const x0 = planBounds.minX + 40;
    const y0 = planBounds.maxY - 50;
    const segs = 4;
    for (let s = 0; s < segs; s++) {
      layer.add(new Konva.Rect({ x: x0 + (len / segs) * s, y: y0 - 10, width: len / segs, height: 10, fill: s % 2 === 0 ? INK : '#ffffff', stroke: INK, strokeWidth: 1 }));
    }
    const label = `${formatLength(len)}${opts.scaleLabel ? ` · Maßstab ${opts.scaleLabel}` : ''}`;
    layer.add(new Konva.Text({ x: x0, y: y0 + 4, text: label, fontSize: 18 * textScale, fontFamily: FONT, fill: INK }));
    layer.add(new Konva.Text({ x: x0 - 8, y: y0 - 18 - 14 * textScale, text: '0', fontSize: 14 * textScale, fontFamily: FONT, fill: MUTED }));
    layer.add(new Konva.Text({ x: x0 + len - 40, y: y0 - 18 - 14 * textScale, width: 80, align: 'center', text: formatLength(len), fontSize: 14 * textScale, fontFamily: FONT, fill: MUTED, wrap: 'none' }));
  }

  // Legende
  if (layout.legendTypes.length) {
    const y0 = planBounds.maxY;
    layer.add(new Konva.Line({ points: [bounds.minX, y0, bounds.maxX, y0], stroke: '#cbd5e1', strokeWidth: 1.5 }));
    layer.add(new Konva.Text({ x: bounds.minX + LEGEND_PAD_CM, y: y0 + 12, text: 'Legende – Raumtypen', fontSize: 20 * textScale, fontFamily: FONT, fontStyle: 'bold', fill: INK }));
    layout.legendTypes.forEach((type, i) => {
      const col = i % layout.legendCols;
      const row = Math.floor(i / layout.legendCols);
      const x = bounds.minX + LEGEND_PAD_CM + col * LEGEND_ENTRY_CM;
      const y = y0 + LEGEND_PAD_CM + 8 + row * LEGEND_ROW_CM;
      const color = roomColor(type);
      layer.add(new Konva.Rect({ x, y, width: 34, height: 34, fill: color, opacity: 0.6 }));
      layer.add(new Konva.Rect({ x, y, width: 34, height: 34, stroke: color, strokeWidth: 2 }));
      layer.add(new Konva.Text({ x: x + 46, y: y + 4, width: LEGEND_ENTRY_CM - 60, text: type, fontSize: 24 * textScale, fontFamily: FONT, fill: INK, wrap: 'none', ellipsis: true }));
    });
  }
}

function drawHatch(layer: Konva.Layer, poly: Vec2[], color: string) {
  const b = bbox(poly);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const g = new Konva.Group({ clipFunc: (ctx) => { ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); } });
  for (let d = -h; d < w; d += 12) g.add(new Konva.Line({ points: [b.minX + d, b.minY, b.minX + d + h, b.maxY], stroke: color, strokeWidth: 0.8, opacity: 0.6 }));
  layer.add(g);
}

function drawOpening(layer: Konva.Layer, o: Opening, wall: Wall) {
  const pl = openingPlacement(o, wall);
  const t = wall.thickness;
  const w = o.width;
  // Lokale Gruppe: x entlang der Wand, y quer (negativ = Seite „a“, positiv = Seite „b“).
  const g = new Konva.Group({ x: pl.center.x, y: pl.center.y, rotation: pl.angle });
  const cut = (fill: string) => g.add(new Konva.Rect({ x: -w / 2, y: -t / 2 - 0.5, width: w, height: t + 1, fill }));
  if (o.kind === 'door') {
    const info = DOOR_TYPE_MAP[o.doorType];
    const stroke = info?.emergency ? '#16a34a' : INK;
    cut(HALL_FLOOR);
    g.add(new Konva.Line({ points: [-w / 2, -t / 2, -w / 2, t / 2], stroke: INK, strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [w / 2, -t / 2, w / 2, t / 2], stroke: INK, strokeWidth: 1.5 }));
    const sideSign = o.swingSide === 'a' ? -1 : 1;
    if (info?.swings ?? true) {
      const leaves = info?.leaves ?? 1;
      const r = leaves === 2 ? w / 2 : w;
      const hinges: Array<{ hx: number; left: boolean }> = leaves === 2
        ? [{ hx: -w / 2, left: true }, { hx: w / 2, left: false }]
        : [{ hx: o.hinge === 'left' ? -w / 2 : w / 2, left: o.hinge === 'left' }];
      for (const { hx, left } of hinges) {
        const wallEdge = sideSign * (t / 2);
        // Türblatt
        g.add(new Konva.Line({ points: [hx, wallEdge, hx, wallEdge + sideSign * r], stroke, strokeWidth: 3, lineCap: 'round' }));
        // Schwenkbogen: von der Wandlinie zum Türblatt
        let rotation: number;
        if (left) rotation = sideSign > 0 ? 0 : 270;
        else rotation = sideSign > 0 ? 90 : 180;
        g.add(new Konva.Arc({ x: hx, y: wallEdge, innerRadius: r, outerRadius: r, angle: 90, rotation, stroke, strokeWidth: 1, dash: [6, 4] }));
      }
    } else if (o.doorType === 'Schiebetür') {
      const y = sideSign * (t / 2 + 3);
      g.add(new Konva.Line({ points: [-w / 2, y, w / 2, y], stroke, strokeWidth: 3 }));
      g.add(new Konva.Line({ points: [w / 2, y, w / 2 + w * 0.8, y], stroke, strokeWidth: 3, opacity: 0.35 }));
      g.add(new Konva.Line({ points: [-w / 2, -t / 2, w / 2, -t / 2], stroke: INK, strokeWidth: 1, dash: [4, 4] }));
      g.add(new Konva.Line({ points: [-w / 2, t / 2, w / 2, t / 2], stroke: INK, strokeWidth: 1, dash: [4, 4] }));
    } else {
      // Rolltor
      g.add(new Konva.Line({ points: [-w / 2, 0, w / 2, 0], stroke, strokeWidth: 2, dash: [10, 6] }));
      g.add(new Konva.Rect({ x: -w / 2, y: sideSign * (t / 2) - (sideSign < 0 ? 12 : 0), width: w, height: 12, fill: '#94a3b8', stroke: INK, strokeWidth: 1 }));
    }
    if (info?.emergency) {
      // Beschriftung auf der dem Schwenkbereich abgewandten Seite
      const yLabel = sideSign > 0 ? -t / 2 - 16 - 12 : t / 2 + 16;
      g.add(new Konva.Text({ x: -w / 2 - 40, y: yLabel, width: w + 80, align: 'center', text: 'Notausgang', fontSize: 12 * textScale, fontFamily: FONT, fill: '#16a34a', wrap: 'none' }));
    }
  } else if (o.kind === 'window') {
    cut('#e0f2fe');
    g.add(new Konva.Rect({ x: -w / 2, y: -t / 2, width: w, height: t, stroke: '#0284c7', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [-w / 2, -t / 6, w / 2, -t / 6], stroke: '#0284c7', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [-w / 2, t / 6, w / 2, t / 6], stroke: '#0284c7', strokeWidth: 1 }));
  } else {
    const sideSign = o.side === 'a' ? -1 : 1;
    const y = sideSign * (t / 2 + 3);
    g.add(new Konva.Line({ points: [-w / 2, y, w / 2, y], stroke: '#0ea5e9', strokeWidth: 5 }));
    g.add(new Konva.Line({ points: [-w / 2, y, w / 2, y], stroke: '#ffffff', strokeWidth: 1.2, dash: [8, 8] }));
  }
  layer.add(g);
}

function drawItem(layer: Konva.Layer, it: PlacedItem, project: Project, showLabels: boolean, px: number, minLabelPx: number) {
  const def = getDef(it.defId, project);
  const color = itemAreaColor(def);
  const g = new Konva.Group({ x: it.x, y: it.y, rotation: it.rotation });
  const w = it.width;
  const d = it.depth;
  const isRound = it.kind === 'column' && (it.params?.rund === true || def?.symbol === 'column-round');
  if (isRound) {
    g.add(new Konva.Circle({ x: 0, y: 0, radius: Math.min(w, d) / 2, fill: '#cbd5e1', stroke: INK, strokeWidth: 1.5 }));
  } else if (it.kind === 'column') {
    g.add(new Konva.Rect({ x: -w / 2, y: -d / 2, width: w, height: d, fill: '#cbd5e1', stroke: INK, strokeWidth: 1.5 }));
  } else {
    g.add(new Konva.Rect({ x: -w / 2, y: -d / 2, width: w, height: d, fill: color, opacity: 0.55, cornerRadius: Math.min(4, w / 10, d / 10) }));
    g.add(new Konva.Rect({ x: -w / 2, y: -d / 2, width: w, height: d, stroke: color, strokeWidth: 1.5, cornerRadius: Math.min(4, w / 10, d / 10) }));
    // Vorderkante markieren (Ausrichtung)
    g.add(new Konva.Line({ points: [-w / 2 + 4, d / 2 - 3, w / 2 - 4, d / 2 - 3], stroke: color, strokeWidth: 2 }));
    if (it.kind === 'stairs') {
      const step = 28;
      for (let y = -d / 2 + step; y < d / 2; y += step) g.add(new Konva.Line({ points: [-w / 2, y, w / 2, y], stroke: INK, strokeWidth: 0.8, opacity: 0.7 }));
      g.add(new Konva.Arrow({ points: [0, d / 2 - 10, 0, -d / 2 + 10], stroke: INK, fill: INK, strokeWidth: 1.5, pointerLength: 12, pointerWidth: 10 }));
    } else if (it.kind === 'elevator') {
      g.add(new Konva.Line({ points: [-w / 2, -d / 2, w / 2, d / 2], stroke: INK, strokeWidth: 0.8, opacity: 0.6 }));
      g.add(new Konva.Line({ points: [w / 2, -d / 2, -w / 2, d / 2], stroke: INK, strokeWidth: 0.8, opacity: 0.6 }));
    }
  }
  if (showLabels) {
    const text = itemShortLabel(it, def);
    const fontSize = Math.max(9, Math.min(22, Math.min(w, d) * 0.28)) * textScale;
    if (fontSize * px >= minLabelPx && text) {
      const rot = ((it.rotation % 360) + 360) % 360;
      const flip = rot > 90 && rot <= 270;
      // Text auf lesbare Richtung drehen; bei hochkanten Objekten entlang der langen Seite
      const along = d > w * 1.4;
      const boxW = along ? d - 6 : w - 6;
      const t = new Konva.Text({
        x: -boxW / 2, y: -fontSize * 0.6, width: boxW, text, fontSize, fontFamily: FONT, fill: INK, align: 'center', wrap: 'none', ellipsis: true,
      });
      const tg = new Konva.Group({ rotation: (along ? -90 : 0) + (flip ? 180 : 0) });
      tg.add(t);
      g.add(tg);
    }
  }
  layer.add(g);
}

function drawMeasure(layer: Konva.Layer, a: Vec2, b: Vec2, color: string, px: number, minLabelPx: number) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.5) return;
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const g = new Konva.Group({ x: a.x, y: a.y, rotation: ang });
  g.add(new Konva.Line({ points: [0, 0, len, 0], stroke: color, strokeWidth: 1.5 }));
  g.add(new Konva.Line({ points: [0, -10, 0, 10], stroke: color, strokeWidth: 1.5 }));
  g.add(new Konva.Line({ points: [len, -10, len, 10], stroke: color, strokeWidth: 1.5 }));
  const fontSize = 18 * textScale;
  if (fontSize * px >= minLabelPx) {
    const flip = ((ang % 360) + 360) % 360 > 90 && ((ang % 360) + 360) % 360 <= 270;
    const tg = new Konva.Group({ x: len / 2, y: 0, rotation: flip ? 180 : 0 });
    tg.add(new Konva.Text({ x: -150, y: -fontSize - 6, width: 300, align: 'center', text: formatLength(len), fontSize, fontFamily: FONT, fill: color }));
    g.add(tg);
  }
  layer.add(g);
}

/** Bemaßung einer Hallenkante außerhalb (Polygon im Uhrzeigersinn → außen liegt links der Laufrichtung). */
function drawDimension(layer: Konva.Layer, a: Vec2, b: Vec2, offset: number, px: number, minLabelPx: number) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return;
  const dx = (b.x - a.x) / len;
  const dy = (b.y - a.y) / len;
  // Innennormale bei CW (y nach unten) ist (-dy, dx) → außen: (dy, -dx)
  const nx = dy;
  const ny = -dx;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const g = new Konva.Group({ x: a.x + nx * offset, y: a.y + ny * offset, rotation: ang });
  g.add(new Konva.Line({ points: [0, 0, len, 0], stroke: MUTED, strokeWidth: 1.2 }));
  // Hilfslinien zur Kante
  g.add(new Konva.Line({ points: [0, 0, 0, offset - 8], stroke: MUTED, strokeWidth: 0.8 }));
  g.add(new Konva.Line({ points: [len, 0, len, offset - 8], stroke: MUTED, strokeWidth: 0.8 }));
  g.add(new Konva.Line({ points: [-6, 6, 6, -6], stroke: MUTED, strokeWidth: 1.2 }));
  g.add(new Konva.Line({ points: [len - 6, 6, len + 6, -6], stroke: MUTED, strokeWidth: 1.2 }));
  const fontSize = 20 * textScale;
  if (fontSize * px >= minLabelPx) {
    const norm = ((ang % 360) + 360) % 360;
    const flip = norm > 90 && norm <= 270;
    const tg = new Konva.Group({ x: len / 2, y: 0, rotation: flip ? 180 : 0 });
    // Text auf der Außenseite der Maßlinie
    const yText = flip ? 6 : -fontSize - 6;
    tg.add(new Konva.Text({ x: -200, y: yText, width: 400, align: 'center', text: formatM(len), fontSize, fontFamily: FONT, fill: INK }));
    g.add(tg);
  }
  layer.add(g);
}
