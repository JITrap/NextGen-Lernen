/**
 * Aktionen auf der aktuellen Auswahl (werden von Tastenkürzeln, Kontextmenü, Eigenschaften-Panel
 * und dem Auswahl-Werkzeug genutzt). Jede Aktion ist genau ein Undo-Schritt (transaction).
 *
 * Alle Aktionen arbeiten auf dem aktiven Stockwerk und lesen die Auswahl aus dem UI-Store.
 */
import type {
  Selection, PlacedItem, Zone, VoidArea, Annotation, Group, Wall, Opening, Floor, Hall, Vec2, SafetyZone, TextNote, MeasureLine, Id,
} from '@/types';
import { useProjectStore, transaction, getActiveFloor } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { getDef } from '@/data/equipment';
import { newId } from '@/utils/id';
import { bbox, rotateAround, translatePolygon, add, sub, scale as vscale, distance, normalize, type BBox } from '@/geometry/polygon';
import { itemFootprint } from '@/geometry/transform';
import { normalizeAngle } from '@/geometry/units';
import {
  splitWall, reassignOpeningsAfterSplit, isHallWallId, findWall, clampOpeningOffset, moveWallNode, wallLength, wallDirection,
  pointOnWall, projectOntoWall, hallWalls, WALL_NODE_TOL,
} from '@/geometry/walls';

/* ------------------------------------------------------------------ */
/* Auswahl lesen                                                       */
/* ------------------------------------------------------------------ */

export function currentSelection(): Selection[] {
  return useUiStore.getState().selection;
}
export function selectedItemIds(): string[] {
  return currentSelection().filter((s) => s.kind === 'item').map((s) => s.id);
}
function idsOf(sel: Selection[], kind: Selection['kind']): Set<string> {
  const out = new Set<string>();
  for (const s of sel) if (s.kind === kind) out.add(s.id);
  return out;
}
/** Objekte des Stockwerks, die zur Auswahl gehören (in Stockwerks-Reihenfolge). */
export function selectedItems(floor: Floor, sel: Selection[] = currentSelection()): PlacedItem[] {
  const ids = idsOf(sel, 'item');
  return ids.size ? floor.items.filter((it) => ids.has(it.id)) : [];
}
function selectedZones(floor: Floor, sel: Selection[]): Zone[] {
  const ids = idsOf(sel, 'zone');
  return ids.size ? floor.zones.filter((z) => ids.has(z.id)) : [];
}
function selectedVoids(floor: Floor, sel: Selection[]): VoidArea[] {
  const ids = idsOf(sel, 'void');
  return ids.size ? floor.voids.filter((v) => ids.has(v.id)) : [];
}
function selectedAnnotations(floor: Floor, sel: Selection[]): Annotation[] {
  const ids = idsOf(sel, 'annotation');
  return ids.size ? floor.annotations.filter((a) => ids.has(a.id)) : [];
}
function selectedWalls(floor: Floor, sel: Selection[]): Wall[] {
  const ids = idsOf(sel, 'wall');
  return ids.size ? floor.walls.filter((w) => ids.has(w.id)) : [];
}
function selectedOpenings(floor: Floor, sel: Selection[]): Opening[] {
  const ids = idsOf(sel, 'opening');
  return ids.size ? floor.openings.filter((o) => ids.has(o.id)) : [];
}

/* ------------------------------------------------------------------ */
/* Bewegliche Elemente (gemeinsame Abstraktion für Ausrichten etc.)    */
/* ------------------------------------------------------------------ */

/** Ein bewegliches Element mit Bounding-Box und einer Funktion, die es (innerhalb einer Transaktion) verschiebt. */
export interface Movable {
  key: string;
  box: BBox;
  move: (dx: number, dy: number) => void;
}

function textBox(a: TextNote): BBox {
  const w = Math.max(60, a.text.length * a.fontSize * 0.6);
  return { minX: a.x, minY: a.y, maxX: a.x + w, maxY: a.y + a.fontSize * 1.4 };
}

/** Alle beweglichen (nicht gesperrten) Elemente der Auswahl: Objekte, Zonen, Lufträume, Anmerkungen. */
export function movablesOf(floor: Floor, sel: Selection[] = currentSelection()): Movable[] {
  const s = useProjectStore.getState();
  const fid = floor.id;
  const out: Movable[] = [];
  for (const it of selectedItems(floor, sel)) {
    if (it.locked) continue;
    out.push({ key: `item:${it.id}`, box: bbox(itemFootprint(it)), move: (dx, dy) => s.updateItem(fid, it.id, { x: it.x + dx, y: it.y + dy }) });
  }
  for (const z of selectedZones(floor, sel)) {
    if (z.locked) continue;
    out.push({ key: `zone:${z.id}`, box: bbox(z.polygon), move: (dx, dy) => s.updateZone(fid, z.id, { polygon: translatePolygon(z.polygon, dx, dy) }) });
  }
  for (const v of selectedVoids(floor, sel)) {
    out.push({ key: `void:${v.id}`, box: bbox(v.polygon), move: (dx, dy) => s.updateVoid(fid, v.id, { polygon: translatePolygon(v.polygon, dx, dy) }) });
  }
  for (const a of selectedAnnotations(floor, sel)) {
    if (a.locked) continue;
    if (a.kind === 'text') {
      out.push({ key: `ann:${a.id}`, box: textBox(a), move: (dx, dy) => s.updateAnnotation(fid, a.id, { x: a.x + dx, y: a.y + dy }) });
    } else {
      out.push({
        key: `ann:${a.id}`,
        box: bbox([a.start, a.end]),
        move: (dx, dy) => s.updateAnnotation(fid, a.id, { start: { x: a.start.x + dx, y: a.start.y + dy }, end: { x: a.end.x + dx, y: a.end.y + dy } }),
      });
    }
  }
  return out;
}

function unionBox(boxes: BBox[]): BBox | null {
  if (!boxes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY };
}
function boxCenter(b: BBox): Vec2 {
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** Bounding-Box der gesamten Auswahl (Objekte, Zonen, Lufträume, Anmerkungen, Wände, Öffnungen). */
export function selectionBounds(floor: Floor, sel: Selection[] = currentSelection()): BBox | null {
  const boxes: BBox[] = [];
  for (const it of selectedItems(floor, sel)) boxes.push(bbox(itemFootprint(it)));
  for (const z of selectedZones(floor, sel)) boxes.push(bbox(z.polygon));
  for (const v of selectedVoids(floor, sel)) boxes.push(bbox(v.polygon));
  for (const a of selectedAnnotations(floor, sel)) boxes.push(a.kind === 'text' ? textBox(a) : bbox([a.start, a.end]));
  for (const w of selectedWalls(floor, sel)) boxes.push(bbox([w.start, w.end]));
  for (const o of selectedOpenings(floor, sel)) {
    const w = findWall(floor, o.wallId);
    if (w) {
      const c = pointOnWall(w, o.offset);
      boxes.push({ minX: c.x, minY: c.y, maxX: c.x, maxY: c.y });
    }
  }
  return unionBox(boxes);
}

/* ------------------------------------------------------------------ */
/* Löschen                                                             */
/* ------------------------------------------------------------------ */

/** Bis zu diesem Abstand (cm) wird eine Öffnung an einer geänderten Hallen-Außenwand auf die neue Kante projiziert; sonst wird sie entfernt. */
export const HALL_OPENING_REMAP_MAX_CM = 100;

export interface HallOpeningPlan {
  /** Öffnungen mit neuem Wandbezug/Offset. */
  update: { id: Id; wallId: Id; offset: number }[];
  /** Öffnungen ohne sinnvolle Projektion (werden gelöscht). */
  remove: Id[];
}

/**
 * Öffnungen an den Hallen-Außenwänden nach dem Entfernen von Eckpunkt `removedIndex` umschreiben (rein).
 * `hall_<i>` ist die Kante i des rohen Polygons (polygon[i] → polygon[i+1]). Die beiden Kanten am entfernten Punkt
 * verschmelzen zur neuen Kante `k-1` (bzw. `n-2` für k = 0), alle folgenden Indizes rücken um 1 nach vorn. Jede Öffnung
 * wird über ihre Weltposition auf die neue Kante projiziert (Offset-Richtung/Gehrung können sich ändern); liegt sie
 * weiter als `maxDist` von der neuen Kante entfernt, wird sie gelöscht.
 */
export function hallOpeningsAfterVertexRemoval(openings: Opening[], oldHall: Hall, removedIndex: number, newHall: Hall, maxDist = HALL_OPENING_REMAP_MAX_CM): HallOpeningPlan {
  const plan: HallOpeningPlan = { update: [], remove: [] };
  const n = oldHall.polygon.length;
  const k = removedIndex;
  if (!Number.isInteger(k) || k < 0 || k >= n || n < 4) return plan;
  const oldWalls = new Map(hallWalls(oldHall).map((w) => [w.id, w]));
  const newWalls = new Map(hallWalls(newHall).map((w) => [w.id, w]));
  const merged = k === 0 ? n - 2 : k - 1;
  const mapIndex = (i: number): number => {
    if (i === k || i === (k - 1 + n) % n) return merged;
    return i > k ? i - 1 : i;
  };
  for (const o of openings) {
    if (!isHallWallId(o.wallId)) continue;
    const i = Number(o.wallId.slice('hall_'.length));
    const oldWall = oldWalls.get(o.wallId);
    if (!Number.isInteger(i) || !oldWall) {
      plan.remove.push(o.id);
      continue;
    }
    const center = pointOnWall(oldWall, o.offset);
    const target = newWalls.get(`hall_${mapIndex(i)}`);
    if (!target || wallLength(target) < 1) {
      plan.remove.push(o.id);
      continue;
    }
    const pr = projectOntoWall(target, center);
    const len = wallLength(target);
    if (pr.distance > maxDist || pr.offset < -maxDist || pr.offset > len + maxDist) {
      plan.remove.push(o.id);
      continue;
    }
    const offset = clampOpeningOffset(pr.offset, o.width, target);
    if (target.id !== o.wallId || Math.abs(offset - o.offset) > 1e-6) plan.update.push({ id: o.id, wallId: target.id, offset });
  }
  return plan;
}

/** Löscht die Auswahl (gesperrte Elemente bleiben). Ein gewählter Hallen-Eckpunkt wird aus dem Polygon entfernt (min. 3 Ecken). */
export function deleteSelection() {
  const sel = currentSelection();
  if (!sel.length) return;
  const floor = getActiveFloor();
  const s = useProjectStore.getState();
  const vertexIdx = [...idsOf(sel, 'hallVertex')].map(Number).filter((i) => Number.isInteger(i)).sort((a, b) => b - a);
  const keep: Selection[] = [];
  let droppedOpenings = 0;
  transaction(() => {
    s.deleteSelection(floor.id, sel);
    if (vertexIdx.length && floor.hall) {
      const n = floor.hall.polygon.length;
      const removable = vertexIdx.filter((i) => i >= 0 && i < n).slice(0, Math.max(0, n - 3));
      // Absteigend sortiert: höhere Indizes zuerst entfernen, damit die übrigen Indizes gültig bleiben.
      for (const idx of removable) {
        const cur = getActiveFloor();
        if (!cur.hall || cur.hall.polygon.length <= 3) break;
        const oldHall = cur.hall;
        const newHall: Hall = { ...oldHall, polygon: oldHall.polygon.filter((_, i) => i !== idx) };
        const plan = hallOpeningsAfterVertexRemoval(cur.openings, oldHall, idx, newHall);
        s.updateHall(floor.id, (h) => { h.polygon = newHall.polygon; });
        for (const u of plan.update) s.updateOpening(floor.id, u.id, { wallId: u.wallId, offset: u.offset });
        if (plan.remove.length) {
          s.deleteOpenings(floor.id, plan.remove);
          droppedOpenings += plan.remove.length;
        }
      }
    }
  });
  if (droppedOpenings) {
    useUiStore.getState().toast(
      droppedOpenings === 1 ? '1 Öffnung an der Außenwand entfernt – sie lag nicht mehr an der neuen Kante' : `${droppedOpenings} Öffnungen an der Außenwand entfernt – sie lagen nicht mehr an der neuen Kante`,
      'warning',
    );
  }
  // Gesperrte Elemente bleiben ausgewählt, damit der Nutzer sieht, warum nichts passiert ist.
  const after = getActiveFloor();
  for (const x of sel) {
    if (x.kind === 'item' && after.items.some((it) => it.id === x.id && it.locked)) keep.push(x);
    else if (x.kind === 'wall' && after.walls.some((w) => w.id === x.id && w.locked)) keep.push(x);
    else if (x.kind === 'zone' && after.zones.some((z) => z.id === x.id && z.locked)) keep.push(x);
    else if (x.kind === 'opening' && after.openings.some((o) => o.id === x.id && o.locked)) keep.push(x);
    else if (x.kind === 'annotation' && after.annotations.some((a) => a.id === x.id && a.locked)) keep.push(x);
  }
  useUiStore.getState().setSelection(keep);
  if (keep.length) useUiStore.getState().toast(keep.length === 1 ? 'Gesperrtes Element wurde nicht gelöscht' : `${keep.length} gesperrte Elemente wurden nicht gelöscht`, 'info');
}

/* ------------------------------------------------------------------ */
/* Kopieren / Duplizieren / Einfügen                                   */
/* ------------------------------------------------------------------ */

export type ClipboardEntry =
  | { kind: 'item'; data: PlacedItem }
  | { kind: 'group'; data: Group }
  | { kind: 'zone'; data: Zone }
  | { kind: 'void'; data: VoidArea }
  | { kind: 'annotation'; data: Annotation }
  | { kind: 'wall'; data: Wall }
  | { kind: 'opening'; data: Opening };

function clone<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}

/** Sammelt die Auswahl als Zwischenablage-Einträge (tiefe Kopien, Original-IDs). */
export function collectSelection(floor: Floor, sel: Selection[] = currentSelection()): ClipboardEntry[] {
  const out: ClipboardEntry[] = [];
  const items = selectedItems(floor, sel);
  const itemIds = new Set(items.map((i) => i.id));
  for (const it of items) out.push({ kind: 'item', data: clone(it) });
  for (const g of floor.groups) {
    const members = g.itemIds.filter((i) => itemIds.has(i));
    if (members.length >= 2) out.push({ kind: 'group', data: { ...g, itemIds: members } });
  }
  for (const z of selectedZones(floor, sel)) out.push({ kind: 'zone', data: clone(z) });
  for (const v of selectedVoids(floor, sel)) out.push({ kind: 'void', data: clone(v) });
  for (const a of selectedAnnotations(floor, sel)) out.push({ kind: 'annotation', data: clone(a) });
  for (const w of selectedWalls(floor, sel)) out.push({ kind: 'wall', data: clone(w) });
  for (const o of selectedOpenings(floor, sel)) out.push({ kind: 'opening', data: clone(o) });
  return out;
}

function entriesBounds(entries: ClipboardEntry[]): BBox | null {
  const boxes: BBox[] = [];
  for (const e of entries) {
    if (e.kind === 'item') boxes.push(bbox(itemFootprint(e.data)));
    else if (e.kind === 'zone' || e.kind === 'void') boxes.push(bbox(e.data.polygon));
    else if (e.kind === 'annotation') boxes.push(e.data.kind === 'text' ? textBox(e.data) : bbox([e.data.start, e.data.end]));
    else if (e.kind === 'wall') boxes.push(bbox([e.data.start, e.data.end]));
  }
  return unionBox(boxes);
}

/**
 * Fügt Einträge mit neuen IDs und Versatz in das Stockwerk ein (innerhalb einer Transaktion).
 * Gruppen, Andockungen und Wand-Referenzen werden auf die Kopien umgebogen.
 * Rückgabe: Auswahl der eingefügten Elemente.
 */
export function insertEntries(floor: Floor, entries: ClipboardEntry[], dx: number, dy: number): Selection[] {
  const s = useProjectStore.getState();
  const fid = floor.id;
  const idMap = new Map<string, string>();
  const remap = (old: string, prefix: string) => {
    let n = idMap.get(old);
    if (!n) { n = newId(prefix); idMap.set(old, n); }
    return n;
  };
  const sel: Selection[] = [];
  // Wände zuerst (Öffnungen und Wandmontage-Objekte referenzieren sie)
  const walls: Wall[] = [];
  for (const e of entries) {
    if (e.kind !== 'wall') continue;
    const w: Wall = { ...e.data, id: remap(e.data.id, 'w_'), start: { x: e.data.start.x + dx, y: e.data.start.y + dy }, end: { x: e.data.end.x + dx, y: e.data.end.y + dy }, locked: false };
    walls.push(w);
    sel.push({ kind: 'wall', id: w.id });
  }
  if (walls.length) s.addWalls(fid, walls);
  const items: PlacedItem[] = [];
  for (const e of entries) {
    if (e.kind !== 'item') continue;
    // Optionale Referenzen nur setzen, wenn vorhanden (keine expliziten undefined-Eigenschaften).
    const { groupId: _groupId, dockedTo: _dockedTo, wallId: srcWallId, linkedFloorIds: _linked, params: srcParams, ...rest } = e.data;
    const it: PlacedItem = {
      ...rest,
      id: remap(e.data.id, 'i_'),
      x: e.data.x + dx,
      y: e.data.y + dy,
      locked: false,
      hidden: false,
    };
    const wallId = srcWallId ? (idMap.get(srcWallId) ?? (findWall(floor, srcWallId) ? srcWallId : undefined)) : undefined;
    if (wallId) it.wallId = wallId;
    if (srcParams) it.params = { ...srcParams };
    if (it.params && '__linkedFrom' in it.params) delete it.params.__linkedFrom;
    items.push(it);
    sel.push({ kind: 'item', id: it.id });
  }
  // Andockung beibehalten, wenn das Rack mitkopiert wurde
  for (const e of entries) {
    if (e.kind !== 'item' || !e.data.dockedTo) continue;
    const target = idMap.get(e.data.dockedTo);
    const copy = items.find((i) => i.id === idMap.get(e.data.id));
    if (target && copy) copy.dockedTo = target;
  }
  if (items.length) s.addItems(fid, items);
  for (const e of entries) {
    if (e.kind !== 'group') continue;
    const ids = e.data.itemIds.map((i) => idMap.get(i)).filter((x): x is string => !!x);
    if (ids.length >= 2) s.groupItems(fid, ids);
  }
  for (const e of entries) {
    if (e.kind === 'zone') {
      const z: Zone = { ...e.data, id: remap(e.data.id, 'z_'), polygon: translatePolygon(e.data.polygon, dx, dy), locked: false, hidden: false };
      s.addZone(fid, z);
      sel.push({ kind: 'zone', id: z.id });
    } else if (e.kind === 'void') {
      const v: VoidArea = { ...e.data, id: remap(e.data.id, 'v_'), polygon: translatePolygon(e.data.polygon, dx, dy) };
      s.addVoid(fid, v);
      sel.push({ kind: 'void', id: v.id });
    } else if (e.kind === 'annotation') {
      const id = remap(e.data.id, 'a_');
      const a: Annotation = e.data.kind === 'text'
        ? { ...e.data, id, x: e.data.x + dx, y: e.data.y + dy, locked: false, hidden: false }
        : { ...e.data, id, start: { x: e.data.start.x + dx, y: e.data.start.y + dy }, end: { x: e.data.end.x + dx, y: e.data.end.y + dy }, locked: false, hidden: false };
      s.addAnnotation(fid, a);
      sel.push({ kind: 'annotation', id });
    } else if (e.kind === 'opening') {
      // Öffnung: auf kopierter Wand, sonst auf derselben Wand mit Versatz entlang der Wand
      const copiedWallId = idMap.get(e.data.wallId);
      const wallId = copiedWallId ?? e.data.wallId;
      const wall = copiedWallId ? walls.find((w) => w.id === copiedWallId) : findWall(floor, wallId);
      if (!wall) continue;
      const offset = copiedWallId ? e.data.offset : clampOpeningOffset(e.data.offset + Math.hypot(dx, dy), e.data.width, wall);
      const o: Opening = { ...e.data, id: remap(e.data.id, 'o_'), wallId, offset, locked: false, hidden: false };
      s.addOpening(fid, o);
      sel.push({ kind: 'opening', id: o.id });
    }
  }
  return sel;
}

/** Dupliziert die Auswahl um +50/+50 cm (neue IDs, Gruppen mitkopiert). Die Auswahl wechselt auf die Kopien. */
export function duplicateSelection() {
  const floor = getActiveFloor();
  const entries = collectSelection(floor);
  if (!entries.length) return;
  let sel: Selection[] = [];
  transaction(() => { sel = insertEntries(floor, entries, 50, 50); });
  if (sel.length) useUiStore.getState().setSelection(sel);
}

let pasteCount = 0;
let lastPastePoint: Vec2 | null = null;

/** Kopiert die Auswahl in die Zwischenablage (ui.clipboard). */
export function copySelection() {
  const floor = getActiveFloor();
  const entries = collectSelection(floor);
  if (!entries.length) return;
  useUiStore.getState().setClipboard(entries);
  pasteCount = 0;
  lastPastePoint = null;
  useUiStore.getState().toast(entries.length === 1 ? '1 Element kopiert' : `${entries.filter((e) => e.kind !== 'group').length} Elemente kopiert`, 'info');
}

/**
 * Fügt die Zwischenablage ein: zentriert an der Cursorposition (ui.cursorWorld), sonst um +50/+50 cm versetzt.
 * Mehrfaches Einfügen an derselben Stelle versetzt jede weitere Kopie erneut.
 */
export function pasteClipboard(at?: Vec2 | null) {
  const ui = useUiStore.getState();
  const raw = ui.clipboard;
  if (!raw || !raw.length) return;
  const entries = raw.filter((e): e is ClipboardEntry => !!e && typeof e === 'object' && 'kind' in (e as object) && 'data' in (e as object));
  if (!entries.length) return;
  const floor = getActiveFloor();
  const box = entriesBounds(entries);
  const cursor = at === undefined ? ui.cursorWorld : at;
  let dx = 50;
  let dy = 50;
  if (box && cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
    const c = boxCenter(box);
    const samePlace = lastPastePoint && distance(lastPastePoint, cursor) < 1;
    const extra = samePlace ? 50 * pasteCount : 0;
    dx = cursor.x - c.x + extra;
    dy = cursor.y - c.y + extra;
    if (!samePlace) pasteCount = 0;
    lastPastePoint = { ...cursor };
  } else {
    dx = 50 * (pasteCount + 1);
    dy = 50 * (pasteCount + 1);
    lastPastePoint = null;
  }
  pasteCount++;
  let sel: Selection[] = [];
  transaction(() => { sel = insertEntries(floor, entries, dx, dy); });
  if (sel.length) {
    ui.setSelection(sel);
    ui.setTool('select');
  }
}

/* ------------------------------------------------------------------ */
/* Drehen, Verschieben, Spiegeln                                       */
/* ------------------------------------------------------------------ */

/** Dreht die Auswahl um `deltaDeg` um das gemeinsame Zentrum (Einzelobjekt: um den eigenen Mittelpunkt). Wände/Öffnungen ignoriert. */
export function rotateSelection(deltaDeg: number) {
  if (!deltaDeg) return;
  const floor = getActiveFloor();
  const sel = currentSelection();
  const items = selectedItems(floor, sel).filter((it) => !it.locked);
  const zones = selectedZones(floor, sel).filter((z) => !z.locked);
  const voids = selectedVoids(floor, sel);
  const anns = selectedAnnotations(floor, sel).filter((a) => !a.locked);
  const count = items.length + zones.length + voids.length + anns.length;
  if (!count) return;
  const s = useProjectStore.getState();
  const fid = floor.id;
  let center: Vec2;
  if (count === 1 && items.length === 1) center = { x: items[0].x, y: items[0].y };
  else {
    const boxes: BBox[] = [];
    for (const it of items) boxes.push(bbox(itemFootprint(it)));
    for (const z of zones) boxes.push(bbox(z.polygon));
    for (const v of voids) boxes.push(bbox(v.polygon));
    for (const a of anns) boxes.push(a.kind === 'text' ? textBox(a) : bbox([a.start, a.end]));
    center = boxCenter(unionBox(boxes)!);
  }
  transaction(() => {
    for (const it of items) {
      const p = rotateAround({ x: it.x, y: it.y }, center, deltaDeg);
      s.updateItem(fid, it.id, { x: p.x, y: p.y, rotation: normalizeAngle(it.rotation + deltaDeg) });
    }
    for (const z of zones) s.updateZone(fid, z.id, { polygon: z.polygon.map((p) => rotateAround(p, center, deltaDeg)) });
    for (const v of voids) s.updateVoid(fid, v.id, { polygon: v.polygon.map((p) => rotateAround(p, center, deltaDeg)) });
    for (const a of anns) {
      if (a.kind === 'text') {
        const p = rotateAround({ x: a.x, y: a.y }, center, deltaDeg);
        s.updateAnnotation(fid, a.id, { x: p.x, y: p.y, rotation: normalizeAngle(a.rotation + deltaDeg) });
      } else {
        s.updateAnnotation(fid, a.id, { start: rotateAround(a.start, center, deltaDeg), end: rotateAround(a.end, center, deltaDeg) });
      }
    }
  });
}

/** Verschiebt Objekte, Zonen, Lufträume und Anmerkungen der Auswahl um dx/dy (cm). Wände/Öffnungen nicht. */
export function nudgeSelection(dx: number, dy: number) {
  if (!dx && !dy) return;
  const floor = getActiveFloor();
  const movables = movablesOf(floor);
  if (!movables.length) return;
  transaction(() => { for (const m of movables) m.move(dx, dy); });
}

/** Spiegelt die Auswahl: 'x' = links ↔ rechts (um die vertikale Achse), 'y' = vorne ↔ hinten. Drehung wird angepasst. */
export function flipSelection(axis: 'x' | 'y') {
  const floor = getActiveFloor();
  const sel = currentSelection();
  const items = selectedItems(floor, sel).filter((it) => !it.locked);
  const zones = selectedZones(floor, sel).filter((z) => !z.locked);
  const voids = selectedVoids(floor, sel);
  const anns = selectedAnnotations(floor, sel).filter((a) => !a.locked);
  const boxes: BBox[] = [];
  for (const it of items) boxes.push(bbox(itemFootprint(it)));
  for (const z of zones) boxes.push(bbox(z.polygon));
  for (const v of voids) boxes.push(bbox(v.polygon));
  for (const a of anns) boxes.push(a.kind === 'text' ? textBox(a) : bbox([a.start, a.end]));
  const box = unionBox(boxes);
  if (!box) return;
  const c = boxCenter(box);
  const mirror = (p: Vec2): Vec2 => (axis === 'x' ? { x: 2 * c.x - p.x, y: p.y } : { x: p.x, y: 2 * c.y - p.y });
  const mirrorRot = (r: number) => normalizeAngle(axis === 'x' ? -r : 180 - r);
  const s = useProjectStore.getState();
  const fid = floor.id;
  transaction(() => {
    for (const it of items) {
      const p = mirror({ x: it.x, y: it.y });
      s.updateItem(fid, it.id, { x: p.x, y: p.y, rotation: mirrorRot(it.rotation) });
    }
    for (const z of zones) s.updateZone(fid, z.id, { polygon: z.polygon.map(mirror) });
    for (const v of voids) s.updateVoid(fid, v.id, { polygon: v.polygon.map(mirror) });
    for (const a of anns) {
      if (a.kind === 'text') {
        const p = mirror({ x: a.x, y: a.y });
        s.updateAnnotation(fid, a.id, { x: p.x, y: p.y });
      } else s.updateAnnotation(fid, a.id, { start: mirror(a.start), end: mirror(a.end) });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Gruppen, Sperren, Ausblenden                                        */
/* ------------------------------------------------------------------ */

export function groupSelection() {
  const floor = getActiveFloor();
  const ids = selectedItems(floor).map((it) => it.id);
  if (ids.length < 2) return;
  const s = useProjectStore.getState();
  transaction(() => { s.groupItems(floor.id, ids); });
}
export function ungroupSelection() {
  const floor = getActiveFloor();
  const groupIds = new Set<string>();
  for (const it of selectedItems(floor)) if (it.groupId) groupIds.add(it.groupId);
  if (!groupIds.size) return;
  const s = useProjectStore.getState();
  transaction(() => { s.ungroupItems(floor.id, [...groupIds]); });
}

/** Sperrt die Auswahl; sind bereits alle gesperrt, wird entsperrt. */
export function toggleLockSelection() {
  const floor = getActiveFloor();
  const sel = currentSelection();
  const items = selectedItems(floor, sel);
  const walls = selectedWalls(floor, sel);
  const zones = selectedZones(floor, sel);
  const openings = selectedOpenings(floor, sel);
  const anns = selectedAnnotations(floor, sel);
  const all = [...items, ...walls, ...zones, ...openings, ...anns];
  if (!all.length) return;
  const locked = !all.every((x) => x.locked);
  const s = useProjectStore.getState();
  const fid = floor.id;
  transaction(() => {
    if (items.length) s.updateItems(fid, items.map((i) => i.id), (it) => { it.locked = locked; });
    for (const w of walls) s.updateWall(fid, w.id, { locked });
    for (const z of zones) s.updateZone(fid, z.id, { locked });
    for (const o of openings) s.updateOpening(fid, o.id, { locked });
    for (const a of anns) s.updateAnnotation(fid, a.id, { locked });
  });
}

/** Blendet die Auswahl aus (Auswahl wird geleert); sind bereits alle ausgeblendet, werden sie eingeblendet. */
export function toggleHideSelection() {
  const floor = getActiveFloor();
  const sel = currentSelection();
  const items = selectedItems(floor, sel);
  const walls = selectedWalls(floor, sel);
  const zones = selectedZones(floor, sel);
  const openings = selectedOpenings(floor, sel);
  const anns = selectedAnnotations(floor, sel);
  const all = [...items, ...walls, ...zones, ...openings, ...anns];
  if (!all.length) return;
  const hidden = !all.every((x) => x.hidden);
  const s = useProjectStore.getState();
  const fid = floor.id;
  transaction(() => {
    if (items.length) s.updateItems(fid, items.map((i) => i.id), (it) => { it.hidden = hidden; });
    for (const w of walls) s.updateWall(fid, w.id, { hidden });
    for (const z of zones) s.updateZone(fid, z.id, { hidden });
    for (const o of openings) s.updateOpening(fid, o.id, { hidden });
    for (const a of anns) s.updateAnnotation(fid, a.id, { hidden });
  });
  if (hidden) useUiStore.getState().clearSelection();
}

/* ------------------------------------------------------------------ */
/* Ausrichten / Verteilen                                              */
/* ------------------------------------------------------------------ */

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' | 'distributeX' | 'distributeY';

/** Berechnet die Verschiebungen (dx/dy je Element) für einen Ausrichtungsmodus – rein, testbar. */
export function alignOffsets(boxes: BBox[], mode: AlignMode): Vec2[] {
  const n = boxes.length;
  const zero = boxes.map(() => ({ x: 0, y: 0 }));
  if (n < 2) return zero;
  const u = unionBox(boxes)!;
  const uc = boxCenter(u);
  switch (mode) {
    case 'left': return boxes.map((b) => ({ x: u.minX - b.minX, y: 0 }));
    case 'right': return boxes.map((b) => ({ x: u.maxX - b.maxX, y: 0 }));
    case 'top': return boxes.map((b) => ({ x: 0, y: u.minY - b.minY }));
    case 'bottom': return boxes.map((b) => ({ x: 0, y: u.maxY - b.maxY }));
    case 'centerX': return boxes.map((b) => ({ x: uc.x - (b.minX + b.maxX) / 2, y: 0 }));
    case 'centerY': return boxes.map((b) => ({ x: 0, y: uc.y - (b.minY + b.maxY) / 2 }));
    case 'distributeX':
    case 'distributeY': {
      if (n < 3) return zero;
      const horiz = mode === 'distributeX';
      const lo = (b: BBox) => (horiz ? b.minX : b.minY);
      const hi = (b: BBox) => (horiz ? b.maxX : b.maxY);
      const order = boxes.map((b, i) => ({ i, c: (lo(b) + hi(b)) / 2 })).sort((a, b) => a.c - b.c).map((x) => x.i);
      const first = boxes[order[0]];
      const last = boxes[order[n - 1]];
      const span = hi(last) - lo(first);
      let sizes = 0;
      for (const b of boxes) sizes += hi(b) - lo(b);
      const gap = (span - sizes) / (n - 1);
      const out = zero.map((z) => ({ ...z }));
      let cursor = lo(first);
      for (const i of order) {
        const b = boxes[i];
        const d = cursor - lo(b);
        if (horiz) out[i].x = d; else out[i].y = d;
        cursor += hi(b) - lo(b) + gap;
      }
      return out;
    }
    default: return zero;
  }
}

/** Richtet die beweglichen Elemente der Auswahl aus bzw. verteilt sie gleichmäßig (nach Bounding-Boxen). */
export function alignSelection(mode: AlignMode) {
  const floor = getActiveFloor();
  const movables = movablesOf(floor);
  if (movables.length < 2) return;
  const offsets = alignOffsets(movables.map((m) => m.box), mode);
  transaction(() => {
    movables.forEach((m, i) => {
      const o = offsets[i];
      if (Math.abs(o.x) > 1e-9 || Math.abs(o.y) > 1e-9) m.move(o.x, o.y);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Auswahl                                                             */
/* ------------------------------------------------------------------ */

/** Wählt alle sichtbaren Objekte des aktiven Stockwerks. */
export function selectAll() {
  const floor = getActiveFloor();
  const ui = useUiStore.getState();
  if (!floor.items.length) return;
  ui.setSelection(floor.items.filter((it) => !it.hidden).map((it) => ({ kind: 'item', id: it.id }) as Selection));
  if (ui.tool !== 'select') ui.setTool('select');
}

/* ------------------------------------------------------------------ */
/* Wände                                                               */
/* ------------------------------------------------------------------ */

/** Teilt eine echte Wand am Punkt p (Öffnungen wandern auf die passende Hälfte). Rückgabe: ID der neuen zweiten Hälfte. */
export function splitWallAtPoint(wallId: string, point: Vec2): string | null {
  if (isHallWallId(wallId)) return null;
  const floor = getActiveFloor();
  const w = floor.walls.find((x) => x.id === wallId);
  if (!w || w.locked) return null;
  const parts = splitWall(w, point);
  if (!parts) return null;
  const reassigned = reassignOpeningsAfterSplit(floor.openings, w, parts);
  const s = useProjectStore.getState();
  transaction(() => {
    reassigned.forEach((o, i) => {
      if (o !== floor.openings[i]) s.updateOpening(floor.id, o.id, { wallId: o.wallId, offset: o.offset });
    });
    s.replaceWalls(floor.id, [w.id], parts);
  });
  return parts[1].id;
}

/** Hält Öffnungen auf ihren (geänderten) Wänden: Offset auf die neue Wandlänge begrenzen. */
export function clampOpeningsOnWalls(floor: Floor, walls: Wall[]) {
  const s = useProjectStore.getState();
  const byId = new Map(walls.map((w) => [w.id, w]));
  for (const o of floor.openings) {
    const w = byId.get(o.wallId);
    if (!w) continue;
    const off = clampOpeningOffset(o.offset, o.width, w);
    if (Math.abs(off - o.offset) > 1e-6) s.updateOpening(floor.id, o.id, { offset: off });
  }
}

/** Setzt die Länge einer Wand (Achsmaß) durch Verschieben des Endpunkts entlang der Wand; verbundene Wandenden folgen. */
export function setWallLength(wallId: string, lengthCm: number, floor: Floor = getActiveFloor()): boolean {
  if (isHallWallId(wallId)) return false;
  const w = floor.walls.find((x) => x.id === wallId);
  if (!w || w.locked || !(lengthCm >= 1) || !Number.isFinite(lengthCm)) return false;
  const dir = wallDirection(w);
  if (!dir.x && !dir.y) return false;
  const to = add(w.start, vscale(dir, lengthCm));
  const walls = moveWallNode(floor.walls, w.end, to);
  const s = useProjectStore.getState();
  transaction(() => {
    s.updateFloor(floor.id, (f) => { f.walls = walls; });
    clampOpeningsOnWalls(floor, walls);
  });
  return true;
}

/**
 * Setzt die Länge einer Hallenkante (Außenmaß): Der Endpunkt wird entlang der Kante verschoben; alle Ecken,
 * die in Kantenrichtung auf oder hinter dem Endpunkt liegen, wandern mit (Rechtecke bleiben Rechtecke).
 * Reine Funktion, liefert das neue Polygon.
 */
export function hallPolygonWithEdgeLength(polygon: Vec2[], edgeIndex: number, lengthCm: number): Vec2[] | null {
  const n = polygon.length;
  if (n < 3 || edgeIndex < 0 || edgeIndex >= n || !(lengthCm >= 1) || !Number.isFinite(lengthCm)) return null;
  const a = polygon[edgeIndex];
  const b = polygon[(edgeIndex + 1) % n];
  const cur = distance(a, b);
  if (cur < 1e-6) return null;
  const dir = normalize(sub(b, a));
  const delta = vscale(dir, lengthCm - cur);
  const endProj = b.x * dir.x + b.y * dir.y;
  return polygon.map((p, i) => {
    if (i === edgeIndex) return p;
    const proj = p.x * dir.x + p.y * dir.y;
    return proj >= endProj - WALL_NODE_TOL ? add(p, delta) : p;
  });
}
export function setHallEdgeLength(edgeIndex: number, lengthCm: number, floor: Floor = getActiveFloor()): boolean {
  if (!floor.hall) return false;
  const poly = hallPolygonWithEdgeLength(floor.hall.polygon, edgeIndex, lengthCm);
  if (!poly) return false;
  const s = useProjectStore.getState();
  transaction(() => { s.updateHall(floor.id, (h) => { h.polygon = poly; }); });
  return true;
}

/* ------------------------------------------------------------------ */
/* Einfache Wrapper für das Eigenschaften-Panel                        */
/* ------------------------------------------------------------------ */

export function setItemRotation(id: Id, deg: number, floor: Floor = getActiveFloor()) {
  if (!Number.isFinite(deg)) return;
  const s = useProjectStore.getState();
  transaction(() => s.updateItem(floor.id, id, { rotation: normalizeAngle(deg) }));
}
export function setItemPosition(id: Id, x: number, y: number, floor: Floor = getActiveFloor()) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const s = useProjectStore.getState();
  transaction(() => s.updateItem(floor.id, id, { x, y }));
}
/** Setzt Breite/Tiefe – nur bei skalierbaren Objekten (Geräte behalten ihr Originalmaß). */
export function setItemSize(id: Id, width: number, depth: number, floor: Floor = getActiveFloor()): boolean {
  const it = floor.items.find((x) => x.id === id);
  if (!it) return false;
  const def = getDef(it.defId, useProjectStore.getState().project);
  if (def && !def.skalierbar) return false;
  if (!(width >= 1) || !(depth >= 1)) return false;
  const s = useProjectStore.getState();
  transaction(() => s.updateItem(floor.id, id, { width, depth }));
  return true;
}
export function setSafetyZone(id: Id, zone: Partial<SafetyZone>, floor: Floor = getActiveFloor()) {
  const it = floor.items.find((x) => x.id === id);
  if (!it) return;
  const next: SafetyZone = { ...it.safetyZone, ...zone };
  for (const k of ['vorne', 'hinten', 'links', 'rechts'] as const) if (!(next[k] >= 0)) next[k] = 0;
  const s = useProjectStore.getState();
  transaction(() => s.updateItem(floor.id, id, { safetyZone: next }));
}
export function setSafetyZoneEnabled(id: Id, enabled: boolean, floor: Floor = getActiveFloor()) {
  const s = useProjectStore.getState();
  transaction(() => s.updateItem(floor.id, id, { safetyZoneEnabled: enabled }));
}
/** Beliebige Objektfelder (Label, Notiz, Preis, Höhe …) als ein Undo-Schritt. */
export function setItemProps(id: Id, patch: Partial<PlacedItem>, floor: Floor = getActiveFloor()) {
  const s = useProjectStore.getState();
  transaction(() => s.updateItem(floor.id, id, patch));
}
/** Setzt die Sicherheitszone für alle gewählten Objekte. */
export function setSelectionSafetyZone(zone: Partial<SafetyZone>) {
  const floor = getActiveFloor();
  const items = selectedItems(floor);
  if (!items.length) return;
  const s = useProjectStore.getState();
  transaction(() => {
    for (const it of items) {
      const next: SafetyZone = { ...it.safetyZone, ...zone };
      s.updateItem(floor.id, it.id, { safetyZone: next });
    }
  });
}
export function setTextAnnotation(id: Id, patch: Partial<Omit<TextNote, 'id' | 'kind'>>, floor: Floor = getActiveFloor()) {
  const s = useProjectStore.getState();
  transaction(() => s.updateAnnotation(floor.id, id, patch as Partial<Annotation>));
}
export function setMeasureLine(id: Id, patch: Partial<Omit<MeasureLine, 'id' | 'kind'>>, floor: Floor = getActiveFloor()) {
  const s = useProjectStore.getState();
  transaction(() => s.updateAnnotation(floor.id, id, patch as Partial<Annotation>));
}
/** Länge einer Wand (Achsmaß) – für Anzeige/Eingabe. */
export function wallLengthOf(wallId: string, floor: Floor = getActiveFloor()): number | null {
  const w = findWall(floor, wallId);
  return w ? wallLength(w) : null;
}
