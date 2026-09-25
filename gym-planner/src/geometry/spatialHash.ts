/**
 * Räumlicher Hash (gleichmäßiges Zellraster) als Broadphase für Snapping, Kollision und Abstandsmessung.
 * Alle Koordinaten in cm. Objekte werden über ihre achsenparallele Bounding-Box in Zellen eingetragen;
 * `query` liefert jeden Treffer genau einmal (Stempel-Verfahren, keine Set-Allokation pro Abfrage).
 *
 * Zusätzlich gibt es gecachte Indizes für Objekt- und Wandlisten (`itemIndexFor`, `wallIndexFor`).
 * Der Cache ist an die Array-Identität gebunden – der Store erzeugt bei jeder Änderung neue Arrays (Immer),
 * daher bleiben Indizes über viele Pointer-Events hinweg gültig. Arrays dürfen nicht in-place mutiert werden.
 */
import type { PlacedItem, Wall, Vec2 } from '@/types';
import { bbox, bboxOverlap, type BBox } from './polygon';
import { itemFootprint, itemSafetyPolygon, zoneIsEmpty } from './transform';
import { wallRect } from './walls';

export const DEFAULT_CELL_SIZE = 200;

/** Schlüssel-Multiplikator: Zellindizes bis ±2^19 (≈ 100 km bei 200-cm-Zellen) kollisionsfrei. */
const KEY_MUL = 1 << 20;

function isFiniteBox(b: BBox): boolean {
  return Number.isFinite(b.minX) && Number.isFinite(b.minY) && Number.isFinite(b.maxX) && Number.isFinite(b.maxY);
}

export class SpatialHash<T> {
  readonly cellSize: number;
  private readonly cells = new Map<number, number[]>();
  private readonly entries: T[] = [];
  private readonly boxes: BBox[] = [];
  private readonly seen: number[] = [];
  private stamp = 0;

  constructor(cellSize: number = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize > 0 && Number.isFinite(cellSize) ? cellSize : DEFAULT_CELL_SIZE;
  }

  /** Anzahl eingetragener Elemente. */
  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.cells.clear();
    this.entries.length = 0;
    this.boxes.length = 0;
    this.seen.length = 0;
  }

  private cellRange(b: BBox): { x0: number; y0: number; x1: number; y1: number } {
    const s = this.cellSize;
    return {
      x0: Math.floor(Math.min(b.minX, b.maxX) / s),
      y0: Math.floor(Math.min(b.minY, b.maxY) / s),
      x1: Math.floor(Math.max(b.minX, b.maxX) / s),
      y1: Math.floor(Math.max(b.minY, b.maxY) / s),
    };
  }

  /** Trägt ein Element mit seiner Bounding-Box ein. Ungültige (NaN/∞) Boxen werden ignoriert. */
  insert(item: T, box: BBox): void {
    if (!isFiniteBox(box)) return;
    const idx = this.entries.length;
    this.entries.push(item);
    this.boxes.push(box);
    this.seen.push(0);
    const r = this.cellRange(box);
    for (let cx = r.x0; cx <= r.x1; cx++) {
      for (let cy = r.y0; cy <= r.y1; cy++) {
        const key = cx * KEY_MUL + cy;
        const cell = this.cells.get(key);
        if (cell) cell.push(idx);
        else this.cells.set(key, [idx]);
      }
    }
  }

  /** Alle Elemente, deren Bounding-Box `box` überlappt (jedes genau einmal). */
  query(box: BBox, out: T[] = []): T[] {
    this.forEachIn(box, (item) => { out.push(item); });
    return out;
  }

  /**
   * Ruft `fn` für jedes Element auf, dessen Box `box` überlappt (ohne Zwischen-Array).
   * Bei sehr großen Abfragefenstern wird linear über alle Einträge gegangen statt über die Zellen.
   */
  forEachIn(box: BBox, fn: (item: T, box: BBox, index: number) => void): void {
    const n = this.entries.length;
    if (n === 0 || !isFiniteBox(box)) return;
    const r = this.cellRange(box);
    const cellCount = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    if (cellCount > n * 4 + 64) {
      for (let i = 0; i < n; i++) if (bboxOverlap(this.boxes[i], box)) fn(this.entries[i], this.boxes[i], i);
      return;
    }
    const stamp = ++this.stamp;
    for (let cx = r.x0; cx <= r.x1; cx++) {
      for (let cy = r.y0; cy <= r.y1; cy++) {
        const cell = this.cells.get(cx * KEY_MUL + cy);
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          const idx = cell[k];
          if (this.seen[idx] === stamp) continue;
          this.seen[idx] = stamp;
          if (bboxOverlap(this.boxes[idx], box)) fn(this.entries[idx], this.boxes[idx], idx);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Objekt-Index                                                        */
/* ------------------------------------------------------------------ */

export interface ItemIndex {
  items: PlacedItem[];
  /** Grundflächen (Polygon) je Objekt, Index wie `items`. */
  footprints: Vec2[][];
  /** Bounding-Box der Grundfläche. */
  boxes: BBox[];
  /** Aktive Sicherheitszone als Polygon (null, wenn deaktiviert/leer). */
  zones: (Vec2[] | null)[];
  zoneBoxes: (BBox | null)[];
  /** Broadphase über Indizes in `items`; Box = Grundfläche ∪ Sicherheitszone. Versteckte Objekte fehlen. */
  hash: SpatialHash<number>;
  /** Länge des indizierten Arrays beim Aufbau – Schutz gegen in-place veränderte (nicht eingefrorene) Arrays. */
  size: number;
}

function unionBox(a: BBox, b: BBox | null): BBox {
  if (!b) return a;
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
}

export function buildItemIndex(items: PlacedItem[], cellSize: number = DEFAULT_CELL_SIZE): ItemIndex {
  const n = items.length;
  const footprints = new Array<Vec2[]>(n);
  const boxes = new Array<BBox>(n);
  const zones = new Array<Vec2[] | null>(n);
  const zoneBoxes = new Array<BBox | null>(n);
  const hash = new SpatialHash<number>(cellSize);
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const fp = itemFootprint(it);
    footprints[i] = fp;
    boxes[i] = bbox(fp);
    const z = it.safetyZoneEnabled && it.safetyZone && !zoneIsEmpty(it.safetyZone) ? itemSafetyPolygon(it, it.safetyZone) : null;
    zones[i] = z;
    zoneBoxes[i] = z ? bbox(z) : null;
    if (!it.hidden) hash.insert(i, unionBox(boxes[i], zoneBoxes[i]));
  }
  return { items, footprints, boxes, zones, zoneBoxes, hash, size: n };
}

const itemIndexCache = new WeakMap<PlacedItem[], ItemIndex>();

/** Gecachter Objekt-Index (Schlüssel: Array-Identität; bei in-place geänderter Länge wird neu gebaut). */
export function itemIndexFor(items: PlacedItem[]): ItemIndex {
  let idx = itemIndexCache.get(items);
  if (!idx || idx.size !== items.length) {
    idx = buildItemIndex(items);
    itemIndexCache.set(items, idx);
  }
  return idx;
}

/** Hash über sichtbare Objekte (Box = Grundfläche, optional inkl. Sicherheitszone). */
export function buildItemHash(items: PlacedItem[], opts: { includeZones?: boolean; cellSize?: number } = {}): SpatialHash<PlacedItem> {
  const h = new SpatialHash<PlacedItem>(opts.cellSize ?? DEFAULT_CELL_SIZE);
  const includeZones = opts.includeZones ?? true;
  for (const it of items) {
    if (it.hidden) continue;
    let box = bbox(itemFootprint(it));
    if (includeZones && it.safetyZoneEnabled && it.safetyZone && !zoneIsEmpty(it.safetyZone)) box = unionBox(box, bbox(itemSafetyPolygon(it, it.safetyZone)));
    h.insert(it, box);
  }
  return h;
}

/* ------------------------------------------------------------------ */
/* Wand-Index                                                          */
/* ------------------------------------------------------------------ */

export interface WallIndex {
  walls: Wall[];
  /** Wandrechteck (ohne Gehrung) je Wand. */
  rects: Vec2[][];
  boxes: BBox[];
  /** Broadphase über Indizes in `walls`; versteckte Wände fehlen. */
  hash: SpatialHash<number>;
  /** Länge des indizierten Arrays beim Aufbau – Schutz gegen in-place veränderte (nicht eingefrorene) Arrays. */
  size: number;
}

export function buildWallIndex(walls: Wall[], cellSize: number = DEFAULT_CELL_SIZE): WallIndex {
  const n = walls.length;
  const rects = new Array<Vec2[]>(n);
  const boxes = new Array<BBox>(n);
  const hash = new SpatialHash<number>(cellSize);
  for (let i = 0; i < n; i++) {
    const r = wallRect(walls[i]);
    rects[i] = r;
    boxes[i] = bbox(r);
    if (!walls[i].hidden) hash.insert(i, boxes[i]);
  }
  return { walls, rects, boxes, hash, size: n };
}

const wallIndexCache = new WeakMap<Wall[], WallIndex>();

/** Gecachter Wand-Index (Schlüssel: Array-Identität; bei in-place geänderter Länge wird neu gebaut). */
export function wallIndexFor(walls: Wall[]): WallIndex {
  let idx = wallIndexCache.get(walls);
  if (!idx || idx.size !== walls.length) {
    idx = buildWallIndex(walls);
    wallIndexCache.set(walls, idx);
  }
  return idx;
}

/** Hash über sichtbare Wände (Box = Wandrechteck). */
export function buildWallHash(walls: Wall[], cellSize: number = DEFAULT_CELL_SIZE): SpatialHash<Wall> {
  const h = new SpatialHash<Wall>(cellSize);
  for (const w of walls) {
    if (w.hidden) continue;
    h.insert(w, bbox(wallRect(w)));
  }
  return h;
}

/** Box um `margin` (cm) in alle Richtungen vergrößert. */
export function expandBox(b: BBox, margin: number): BBox {
  return { minX: b.minX - margin, minY: b.minY - margin, maxX: b.maxX + margin, maxY: b.maxY + margin };
}
