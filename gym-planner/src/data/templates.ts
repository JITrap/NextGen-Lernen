/**
 * Projekt-Vorlagen: leere Halle 20 × 25 m, „Kleines Studio 400 m²“, „Mittleres Studio 800 m²“.
 *
 * Alle Maße in cm. Die Layouts werden deterministisch aus Bibliotheks-Definitionen aufgebaut
 * (Atlantis/Prime-Geräte + generische Objekte). Jeder Aufruf von `create()` liefert frische IDs.
 *
 * Aufbauregeln der Layout-Hilfen (`FloorBuilder`):
 * - Objekte werden über ihre „Belegungsbox“ (Grundfläche + Sicherheitszone) ausgerichtet, damit sich
 *   weder Grundflächen noch Sicherheitszonen überlappen; Reihen halten einen Gang von ≥ 120 cm.
 * - Mittelpunkte liegen auf dem 10-cm-Raster (Rundung immer „nach innen“, d. h. weg von der Kante).
 * - Innenwände enden an der Innenkante der Hallen-Außenwand; die Raumerkennung verbindet sie mit
 *   der Wandachse (T-Stoß). Raumnamen/-typen werden über `detectWallRooms` + `loopKeyFor` in
 *   `roomMeta` eingetragen, sodass `floorRooms` sie ohne weitere Konfiguration anzeigt.
 */
import type {
  Project, Floor, Wall, Door, Window, Mirror, Zone, PlacedItem, EquipmentDef, RoomType, Vec2, DoorType, SafetyZone,
} from '@/types';
import { createEmptyProject, createHall, createWall, createZone, createItemFromDef } from '@/store/factories';
import { getDef } from '@/data/equipment';
import { allWalls, findWall, hallInnerPolygon, projectOntoWall, clampOpeningOffset, wallNormal, pointOnWall } from '@/geometry/walls';
import { detectWallRooms, loopKeyFor } from '@/geometry/rooms';
import { bbox, pointInPolygon, rectPolygon, type BBox } from '@/geometry/polygon';
import { itemFootprint, itemSafetyPolygon, zoneIsEmpty } from '@/geometry/transform';
import { DOOR_TYPE_MAP, WINDOW_DEFAULT } from '@/data/wallTypes';
import { newId } from '@/utils/id';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  /** Erzeugt ein neues Projekt (mit frischen IDs). */
  create: (name?: string) => Project;
}

/* ------------------------------------------------------------------ */
/* Layout-Hilfen                                                       */
/* ------------------------------------------------------------------ */

const GRID = 10;
/** Mindestbreite eines Gangs zwischen Gerätereihen (Sicherheitszone zu Sicherheitszone). */
const AISLE = 120;
/** Stärke der Innenwände (Trockenbau); Wandflächen liegen damit auf dem 5-cm-Raster. */
const INNER_WALL = 10;

const ceilGrid = (v: number) => Math.ceil(v / GRID - 1e-9) * GRID;
const floorGrid = (v: number) => Math.floor(v / GRID + 1e-9) * GRID;
const roundGrid = (v: number) => Math.round(v / GRID) * GRID;

type Rotation = 0 | 90 | 180 | 270;

/** Objekt-Spezifikation für die Platzierung. */
interface Spec {
  id: string;
  rot?: Rotation;
  /** Überschreibt die Maße (nur für skalierbare Objekte sinnvoll). */
  width?: number;
  depth?: number;
  params?: Record<string, number | string | boolean>;
  label?: string;
  note?: string;
  /** Wandmontage: Wand, an der das Objekt hängt. */
  wallId?: string;
  /** Überschreibt die Sicherheitszone (z. B. Mittelbank vor Spinden). */
  zone?: SafetyZone;
}

/** Ausrichtung der Belegungsbox (Grundfläche + Sicherheitszone). Je Achse genau eine Angabe. */
interface Anchor {
  left?: number;
  right?: number;
  cx?: number;
  top?: number;
  bottom?: number;
  cy?: number;
}

interface RowOptions {
  /** Abstand zwischen den Belegungsboxen (Standard 10). */
  gap?: number;
  /** Grenze, die keine Box überschreiten darf (löst bei Verstoß einen Fehler aus). */
  limit?: number;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Vorlage: ${msg}`);
}

function requireDef(id: string): EquipmentDef {
  const d = getDef(id);
  assert(d, `Bibliotheks-ID „${id}“ nicht gefunden`);
  return d;
}

/** Belegungsbox eines Objekts: Sicherheitszone (inkl. Grundfläche) oder Grundfläche. */
function extentsOf(it: PlacedItem): BBox {
  const poly = it.safetyZoneEnabled && !zoneIsEmpty(it.safetyZone) ? itemSafetyPolygon(it, it.safetyZone) : itemFootprint(it);
  return bbox(poly);
}

function unionBox(boxes: BBox[]): BBox {
  const b: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const x of boxes) {
    b.minX = Math.min(b.minX, x.minX);
    b.minY = Math.min(b.minY, x.minY);
    b.maxX = Math.max(b.maxX, x.maxX);
    b.maxY = Math.max(b.maxY, x.maxY);
  }
  return b;
}

class FloorBuilder {
  readonly floor: Floor;
  /** Innenkante der Hallen-Außenwand (achsparallel). */
  readonly inner: BBox;

  constructor(floor: Floor) {
    assert(floor.hall, 'Stockwerk ohne Halle');
    this.floor = floor;
    this.inner = bbox(hallInnerPolygon(floor.hall));
  }

  /* ---- Wände / Öffnungen ---- */

  wall(x1: number, y1: number, x2: number, y2: number, partial: Partial<Wall> = {}): Wall {
    const w = createWall({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: INNER_WALL, type: 'Trockenbau', ...partial });
    this.floor.walls.push(w);
    return w;
  }

  /** Virtuelle Hallen-Außenwand `hall_<i>` (0 = oben, 1 = rechts, 2 = unten, 3 = links bei Rechteckhalle). */
  hallWall(i: number): Wall {
    const w = findWall(this.floor, `hall_${i}`);
    assert(w, `Hallenwand hall_${i} fehlt`);
    return w;
  }

  private offsetOn(wall: Wall, at: Vec2, width: number): number {
    return clampOpeningOffset(projectOntoWall(wall, at).offset, width, wall);
  }

  /** Tür an einer Wand; `swingTo` = Punkt auf der Seite, zu der die Tür aufschlägt. */
  door(wall: Wall, at: Vec2, swingTo: Vec2, opts: { width?: number; type?: DoorType; hinge?: 'left' | 'right'; note?: string } = {}): Door {
    const doorType = opts.type ?? 'einflügelig';
    const info = DOOR_TYPE_MAP[doorType];
    const width = opts.width ?? info.defaultWidth;
    const offset = this.offsetOn(wall, at, width);
    const center = pointOnWall(wall, offset);
    const n = wallNormal(wall);
    const side = n.x * (swingTo.x - center.x) + n.y * (swingTo.y - center.y) >= 0 ? 'a' : 'b';
    const d: Door = {
      id: newId('o_'), kind: 'door', wallId: wall.id, offset, width, doorType, height: info.defaultHeight,
      hinge: opts.hinge ?? 'left', swingSide: side,
    };
    if (opts.note) d.note = opts.note;
    this.floor.openings.push(d);
    return d;
  }

  window(wall: Wall, at: Vec2, width = WINDOW_DEFAULT.width, opts: { height?: number; sillHeight?: number } = {}): Window {
    const offset = this.offsetOn(wall, at, width);
    const w: Window = {
      id: newId('o_'), kind: 'window', wallId: wall.id, offset, width,
      height: opts.height ?? WINDOW_DEFAULT.height, sillHeight: opts.sillHeight ?? WINDOW_DEFAULT.sillHeight,
    };
    this.floor.openings.push(w);
    return w;
  }

  /** Spiegelwand an einer Wand; `faceTo` = Punkt auf der Seite, auf der der Spiegel hängt. */
  mirror(wall: Wall, at: Vec2, faceTo: Vec2, width: number, height = 220): Mirror {
    const offset = this.offsetOn(wall, at, width);
    const center = pointOnWall(wall, offset);
    const n = wallNormal(wall);
    const side = n.x * (faceTo.x - center.x) + n.y * (faceTo.y - center.y) >= 0 ? 'a' : 'b';
    const m: Mirror = { id: newId('o_'), kind: 'mirror', wallId: wall.id, offset, width, height, side };
    this.floor.openings.push(m);
    return m;
  }

  /* ---- Zonen / Räume ---- */

  zone(x0: number, y0: number, x1: number, y1: number, name: string, type: RoomType): Zone {
    const z = createZone({ polygon: rectPolygon({ x: x0, y: y0 }, { x: x1, y: y1 }), name, type });
    this.floor.zones.push(z);
    return z;
  }

  /**
   * Benennt automatisch erkannte Räume: Für jeden erkannten Wandzug wird der Planeintrag gesucht,
   * dessen Referenzpunkt im Innenpolygon liegt, und `roomMeta[loopKey]` gesetzt.
   * Wird ein geplanter Raum nicht erkannt, bleibt er unbenannt („Raum“/Sonstiges) – die Vorlage
   * lässt sich trotzdem anlegen. Liefert die Anzahl benannter Räume.
   */
  nameRooms(plan: { at: Vec2; name: string; type: RoomType }[]): number {
    const rooms = detectWallRooms(allWalls(this.floor));
    const used = new Set<number>();
    for (const r of rooms) {
      const idx = plan.findIndex((p, i) => !used.has(i) && pointInPolygon(p.at, r.polygon) && !(r.holes ?? []).some((h) => pointInPolygon(p.at, h)));
      if (idx < 0) continue;
      used.add(idx);
      this.floor.roomMeta[loopKeyFor(r.polygon)] = { name: plan[idx].name, type: plan[idx].type };
    }
    return used.size;
  }

  /* ---- Objekte ---- */

  private make(spec: Spec): PlacedItem {
    const def = requireDef(spec.id);
    const partial: Partial<PlacedItem> = { rotation: spec.rot ?? 0 };
    if (spec.width != null) partial.width = spec.width;
    if (spec.depth != null) partial.depth = spec.depth;
    if (spec.label) partial.label = spec.label;
    if (spec.note) partial.note = spec.note;
    if (spec.wallId) partial.wallId = spec.wallId;
    if (spec.zone) partial.safetyZone = { ...spec.zone };
    const it = createItemFromDef(def, 0, 0, partial);
    if (spec.params) it.params = { ...(it.params ?? {}), ...spec.params };
    if (def.wandmontage && !it.wallId) assert(false, `Wandmontage-Objekt „${spec.id}“ ohne wallId`);
    return it;
  }

  /** Platziert ein Objekt so, dass seine Belegungsbox die Ankerkanten einhält (Mittelpunkt auf dem Raster). */
  put(spec: Spec, anchor: Anchor): PlacedItem {
    const it = this.make(spec);
    const b = extentsOf(it); // Box relativ zum Mittelpunkt (0,0)
    let cx: number;
    if (anchor.cx != null) cx = roundGrid(anchor.cx);
    else if (anchor.left != null && anchor.right != null) cx = roundGrid((anchor.left - b.minX + anchor.right - b.maxX) / 2);
    else if (anchor.left != null) cx = ceilGrid(anchor.left - b.minX);
    else if (anchor.right != null) cx = floorGrid(anchor.right - b.maxX);
    else throw new Error('Vorlage: x-Anker fehlt');
    let cy: number;
    if (anchor.cy != null) cy = roundGrid(anchor.cy);
    else if (anchor.top != null && anchor.bottom != null) cy = roundGrid((anchor.top - b.minY + anchor.bottom - b.maxY) / 2);
    else if (anchor.top != null) cy = ceilGrid(anchor.top - b.minY);
    else if (anchor.bottom != null) cy = floorGrid(anchor.bottom - b.maxY);
    else throw new Error('Vorlage: y-Anker fehlt');
    it.x = cx;
    it.y = cy;
    this.floor.items.push(it);
    return it;
  }

  /** Reihe entlang +x: Belegungsboxen nebeneinander ab `left`, oben oder unten bündig. */
  rowX(specs: Spec[], start: { left: number; top?: number; bottom?: number }, opts: RowOptions = {}): PlacedItem[] {
    const gap = opts.gap ?? 10;
    const out: PlacedItem[] = [];
    let cursor = start.left;
    for (const s of specs) {
      const it = this.put(s, { left: cursor, top: start.top, bottom: start.bottom });
      const b = extentsOf(it);
      if (opts.limit != null) assert(b.maxX <= opts.limit + 1e-6, `Reihe überschreitet x=${opts.limit} bei „${s.id}“ (${b.maxX})`);
      cursor = b.maxX + gap;
      out.push(it);
    }
    return out;
  }

  /** Reihe entlang +y: Belegungsboxen untereinander ab `top`, links oder rechts bündig. */
  rowY(specs: Spec[], start: { top: number; left?: number; right?: number }, opts: RowOptions = {}): PlacedItem[] {
    const gap = opts.gap ?? 10;
    const out: PlacedItem[] = [];
    let cursor = start.top;
    for (const s of specs) {
      const it = this.put(s, { top: cursor, left: start.left, right: start.right });
      const b = extentsOf(it);
      if (opts.limit != null) assert(b.maxY <= opts.limit + 1e-6, `Reihe überschreitet y=${opts.limit} bei „${s.id}“ (${b.maxY})`);
      cursor = b.maxY + gap;
      out.push(it);
    }
    return out;
  }

  /** Gemeinsame Belegungsbox mehrerer Objekte. */
  boxOf(items: PlacedItem[]): BBox {
    assert(items.length, 'boxOf ohne Objekte');
    return unionBox(items.map(extentsOf));
  }

  /** Prüft einen Gang von mindestens `min` cm zwischen zwei Reihen (in y). */
  assertAisleY(upper: PlacedItem[], lower: PlacedItem[], min = AISLE): void {
    const a = this.boxOf(upper);
    const b = this.boxOf(lower);
    assert(b.minY - a.maxY >= min - 1e-6, `Gang zu schmal: ${b.minY - a.maxY} cm (mind. ${min})`);
  }
}

const S = (id: string, rot: Rotation = 0, extra: Omit<Spec, 'id' | 'rot'> = {}): Spec => ({ id, rot, ...extra });

/** Spindreihe mit n Abteilen (30 cm), 2-stöckig; Breite ergibt sich aus Abteilen × Abteilbreite. */
function lockerRow(abteile: number, rot: Rotation, label?: string): Spec {
  return S('gen-umkleide-spindreihe-2', rot, {
    width: abteile * 30,
    params: { faecher: abteile * 2, abteilbreite: 30, stoeckig: 2 },
    label,
  });
}

function baseProject(name: string, widthCm: number, depthCm: number, ceilingHeight: number): { project: Project; floor: Floor } {
  const project = createEmptyProject(name);
  const floor = project.floors[0];
  floor.ceilingHeight = ceilingHeight;
  floor.hall = createHall(widthCm, depthCm, { wallThickness: 24, floorCovering: 'Gummiboden' });
  return { project, floor };
}

/* ------------------------------------------------------------------ */
/* Vorlage 1: Leere Halle 20 × 25 m                                    */
/* ------------------------------------------------------------------ */

function createEmptyHall(name = 'Leere Halle 20 × 25 m'): Project {
  const { project } = baseProject(name, 2500, 2000, 400);
  return project;
}

/* ------------------------------------------------------------------ */
/* Vorlage 2: Kleines Studio 400 m² (25 × 16 m)                        */
/* ------------------------------------------------------------------ */

function createSmallStudio(name = 'Kleines Studio 400 m²'): Project {
  const { project, floor } = baseProject(name, 2500, 1600, 400);
  const b = new FloorBuilder(floor);
  const { minX: IX0, minY: IY0, maxX: IX1, maxY: IY1 } = b.inner; // 24 / 24 / 2476 / 1576

  /* ---- Wände: Nebenräume in der linken Spalte (x ≤ 700) ---- */
  const COL = 700; // Achse der Trennwand zur Halle
  const SAN = 300; // Achse der Wand zwischen Umkleide und Duschen/WC
  const wCol = b.wall(COL, IY0, COL, IY1);
  const wEB = b.wall(IX0, 400, COL, 400); // Empfang | Büro
  const wBD = b.wall(IX0, 700, COL, 700); // Büro | Umkleide Damen
  const wDH = b.wall(IX0, 1140, COL, 1140); // Umkleide Damen | Herren
  const wSanD = b.wall(SAN, 700, SAN, 1140);
  const wSanH = b.wall(SAN, 1140, SAN, IY1);
  const hf = INNER_WALL / 2; // halbe Innenwandstärke
  const HALL_X = COL + hf; // Innenkante der Trennwand auf Hallenseite (705)
  const ROOM_X1 = COL - hf; // … auf Raumseite (695)
  const SAN_X1 = SAN - hf; // 295
  const UMK_X0 = SAN + hf; // 305

  /* ---- Türen und Fenster ---- */
  const top = b.hallWall(0);
  const right = b.hallWall(1);
  const bottom = b.hallWall(2);
  const left = b.hallWall(3);
  b.door(top, { x: 200, y: IY0 }, { x: 200, y: -100 }, { type: 'Notausgang', width: 100, note: 'Haupteingang' });
  b.door(wCol, { x: COL, y: 150 }, { x: 900, y: 150 }, { type: 'Glastür', width: 100 });
  b.door(wCol, { x: COL, y: 550 }, { x: 500, y: 550 }, { width: 90 });
  b.door(wCol, { x: COL, y: 760 }, { x: 500, y: 760 }, { width: 90 });
  b.door(wCol, { x: COL, y: 1200 }, { x: 500, y: 1200 }, { width: 90 });
  b.door(wSanD, { x: SAN, y: 870 }, { x: 150, y: 870 }, { width: 80 });
  b.door(wSanH, { x: SAN, y: 1290 }, { x: 150, y: 1290 }, { width: 80 });
  b.door(right, { x: IX1, y: 1300 }, { x: 2700, y: 1300 }, { type: 'Notausgang', width: 100 });
  b.window(top, { x: 450, y: IY0 }, 150);
  b.window(left, { x: IX0, y: 550 }, 120);
  b.window(top, { x: 1300, y: IY0 }, 200, { sillHeight: 180, height: 100 });
  b.window(top, { x: 1900, y: IY0 }, 200, { sillHeight: 180, height: 100 });
  b.window(bottom, { x: 1400, y: IY1 }, 200, { sillHeight: 180, height: 100 });

  /* ---- Raumnamen (automatisch erkannte Räume) ---- */
  b.nameRooms([
    { at: { x: 350, y: 200 }, name: 'Empfang / Lounge', type: 'Empfang/Lounge' },
    { at: { x: 350, y: 550 }, name: 'Büro / Lager', type: 'Büro' },
    { at: { x: 500, y: 900 }, name: 'Umkleide Damen', type: 'Umkleide Damen' },
    { at: { x: 150, y: 900 }, name: 'Duschen / WC Damen', type: 'Duschen' },
    { at: { x: 500, y: 1350 }, name: 'Umkleide Herren', type: 'Umkleide Herren' },
    { at: { x: 150, y: 1350 }, name: 'Duschen / WC Herren', type: 'Duschen' },
    { at: { x: 1500, y: 800 }, name: 'Trainingshalle (Verkehrsfläche)', type: 'Flur/Verkehrsfläche' },
  ]);

  /* ---- Zonen der offenen Trainingsfläche ---- */
  b.zone(900, IY0, 1990, 450, 'Cardio', 'Cardio');
  b.zone(1990, IY0, IX1, IY1, 'Freihantel', 'Trainingsfläche Freihantel');
  b.zone(840, 540, 1990, 1150, 'Maschinen', 'Maschinen');
  b.zone(840, 1250, 1990, IY1, 'Functional', 'Functional/Stretching');

  /* ---- Empfang (x 24–695, y 24–395) ---- */
  b.put(S('gen-empfang-sofa-2', 270), { left: IX0, top: 60 });
  b.put(S('gen-empfang-stehtisch'), { cx: 170, cy: 320 });
  b.put(S('gen-empfang-theke', 180), { cx: 400, cy: 340 });
  b.put(S('gen-empfang-drehkreuz', 270), { right: ROOM_X1 - 20, cy: 150 });
  b.put(S('gen-empfang-kuehlschrank'), { right: ROOM_X1, cy: 340 });
  b.put(S('gen-empfang-getraenkeautomat'), { left: IX0, cy: 340 });
  b.put(S('gen-empfang-info-bildschirm', 0, { wallId: top.id }), { cx: 330, top: IY0 });
  b.put(S('gen-bau-heizkoerper', 0, { wallId: top.id }), { cx: 450, top: IY0 });
  b.put(S('gen-ausstattung-notausgang-schild', 0, { wallId: top.id }), { cx: 120, top: IY0 });
  b.put(S('gen-ausstattung-wasserspender'), { right: ROOM_X1, top: IY0 });
  b.put(S('gen-ausstattung-muelleimer'), { cx: 620, cy: 240 });
  b.put(S('gen-ausstattung-pflanze'), { cx: 600, cy: 60 });

  /* ---- Büro / Lager (x 24–695, y 405–695) ---- */
  b.put(S('gen-buero-schreibtisch'), { cx: 200, cy: 480 });
  b.put(S('gen-buero-buerostuhl'), { cx: 200, cy: 580 });
  b.put(S('gen-buero-rollcontainer'), { cx: 310, cy: 480 });
  b.put(S('gen-buero-aktenschrank'), { left: IX0, cy: 460 });
  b.put(S('gen-buero-personalschrank'), { left: IX0, cy: 560 });
  b.rowX([S('gen-lager-waschmaschine'), S('gen-lager-trockner'), S('gen-lager-putzwagen')], { left: IX0, bottom: 695 });
  b.rowX([S('gen-lager-schwerlastregal'), S('gen-lager-schwerlastregal')], { left: 310, bottom: 695 }, { limit: ROOM_X1 });
  b.put(S('gen-ausstattung-erste-hilfe', 0, { wallId: wEB.id }), { cx: 480, top: 405 });

  /* ---- Duschen / WC + Umkleide (Damen y 705–1135, Herren y 1145–1576) ---- */
  const changingRoom = (y0: number, y1: number, sanWall: Wall, topWall: Wall, doorY: number, women: boolean) => {
    // Sanitärraum x 24–295
    b.rowX([S('gen-sanitaer-einzeldusche'), S('gen-sanitaer-einzeldusche'), S('gen-sanitaer-einzeldusche')], { left: IX0, top: y0 }, { gap: 0, limit: SAN_X1 });
    if (women) {
      b.rowX([S('gen-sanitaer-wc-kabine'), S('gen-sanitaer-wc-kabine')], { left: IX0, bottom: y1 }, { gap: 0 });
    } else {
      b.put(S('gen-sanitaer-wc-kabine'), { left: IX0, bottom: y1 });
      b.put(S('gen-sanitaer-urinal', 180, { wallId: bottom.id }), { cx: 250, bottom: y1 });
    }
    b.put(S('gen-umkleide-waschtisch', 90, { wallId: sanWall.id }), { right: SAN_X1, cy: women ? 960 : 1400 });
    b.put(S('gen-umkleide-handtuchspender', 90, { wallId: sanWall.id }), { right: SAN_X1 - 5, cy: women ? 1010 : 1450 });
    b.put(S('gen-umkleide-waeschesammler'), women ? { cx: 250, cy: 1100 } : { cx: 160, bottom: y1 });
    // Umkleide x 305–695: Spindreihe an der Unterseite (Front nach oben) + Reihe an der Sanitärwand (Front nach rechts)
    const row1 = b.put(lockerRow(13, 180, women ? 'Spinde Damen A' : 'Spinde Herren A'), { left: UMK_X0, bottom: y1 });
    const free = extentsOf(row1).minY - 10 - y0; // Platz oberhalb der Bewegungsfläche von Reihe A
    b.put(lockerRow(Math.max(3, Math.min(9, Math.floor(free / 30))), 270, women ? 'Spinde Damen B' : 'Spinde Herren B'), { left: UMK_X0, top: y0 });
    b.put(S('gen-umkleide-bank'), { cx: 560, cy: women ? 890 : 1330 });
    b.put(S('gen-umkleide-spiegel', 90, { wallId: wCol.id }), { right: ROOM_X1, cy: women ? 860 : 1300 });
    b.put(S('gen-umkleide-foehnplatz', 90, { wallId: wCol.id }), { right: ROOM_X1, cy: women ? 950 : 1390 });
    b.put(S('gen-umkleide-wertfaecher', 0, { wallId: topWall.id }), { cx: 520, top: y0 });
    b.put(S('gen-ausstattung-muelleimer'), { cx: 480, cy: women ? 960 : 1400 });
    b.put(S('gen-bau-lueftungsauslass'), { cx: 560, cy: doorY + 40 });
  };
  changingRoom(705, 1135, wSanD, wBD, 760, true);
  changingRoom(1145, IY1, wSanH, wDH, 1200, false);

  /* ---- Trainingshalle: Cardio-Reihe oben (Front zur Wand, Sturzraum nach hinten); endet ≥ 120 cm vor der Freihantel-Spalte ---- */
  const cardio = b.rowX([
    S('gen-cardio-laufband', 180), S('gen-cardio-laufband', 180), S('gen-cardio-curved-treadmill', 180),
    S('gen-cardio-crosstrainer', 180), S('gen-cardio-crosstrainer', 180),
    S('gen-cardio-ergometer', 180), S('gen-cardio-liegeergometer', 180), S('gen-cardio-rudergeraet', 180),
  ], { left: 930, top: IY0 }, { gap: 20, limit: 1970 });
  const cardioBox = b.boxOf(cardio);

  /* ---- Maschinen: zwei Reihen Rücken an Rücken (A: Front zum Cardio-Gang, B: Front zum Functional-Gang) ---- */
  const rowA = b.rowX([
    S('prime-hybrid-leg-press', 180), S('prime-hybrid-leg-extension', 180), S('prime-hybrid-chest-press', 180), S('prime-hybrid-lat-pulldown', 180),
  ], { left: 850, top: cardioBox.maxY + AISLE }, { limit: 1980 });
  b.assertAisleY(cardio, rowA);
  const rowB = b.rowX([
    S('atlantis-p140'), S('atlantis-d123'), S('atlantis-c105'), S('atlantis-c108'),
  ], { left: 850, top: b.boxOf(rowA).maxY }, { limit: 1980 });

  /* ---- Functional (unten links) ---- */
  const funcTop = b.boxOf(rowB).maxY + AISLE;
  const func = b.rowX([
    S('gen-functional-sled'), S('gen-functional-plyo-box-soft-set'), S('gen-functional-plyo-box'), S('gen-functional-bodenmatte'), S('gen-functional-matte'),
  ], { left: 900, top: funcTop }, { gap: 20, limit: 1980 });
  b.assertAisleY(rowB, func);
  const funcWall = b.rowX([
    S('gen-functional-sled-bahn', 0, { width: 800, depth: 150 }), S('gen-functional-kettlebell-regal', 180), S('gen-functional-medizinball-regal', 180),
  ], { left: 900, bottom: IY1 }, { gap: 20, limit: 1980 });
  assert(b.boxOf(funcWall).minY - b.boxOf(func).maxY >= 10, 'Sled-Bahn/Regale überlappen die Functional-Reihe');

  /* ---- Freihantel (rechte Spalte) ---- */
  const rightCol = b.rowY([
    S('atlantis-c513'), S('gen-freihantel-scheibenstaender', 90), S('gen-freihantel-langhantelstaender', 90),
    S('atlantis-s187', 90), S('prime-benches-adjustable-bench'),
  ], { top: IY0, right: IX1 }, { limit: 1240 });
  b.put(S('atlantis-p245'), { right: IX1, bottom: IY1 }); // unterhalb des Notausgang-Freihaltebereichs (y 1250–1350)
  const rackBox = extentsOf(rightCol[0]);
  b.rowY([
    S('atlantis-b177'), S('atlantis-b275'), S('atlantis-c117'), S('atlantis-b256'),
  ], { top: IY0, right: rackBox.minX - 5 }, { limit: 1000 });

  /* ---- Ausstattung Halle ---- */
  b.put(S('gen-ausstattung-wasserspender'), { cx: 880, cy: 480 });
  b.put(S('gen-ausstattung-desinfektionsstation'), { cx: 880, cy: 1200 });
  b.put(S('gen-ausstattung-desinfektionsstation'), { cx: 2010, cy: 1500 });
  b.put(S('gen-ausstattung-feuerloescher', 180, { wallId: bottom.id }), { cx: 2010, bottom: IY1 });
  b.put(S('gen-ausstattung-feuerloescher', 90, { wallId: right.id }), { right: IX1, cy: 1180 });
  b.put(S('gen-ausstattung-aed', 270, { wallId: wCol.id }), { left: HALL_X, cy: 1000 });
  b.put(S('gen-ausstattung-tv-55', 0, { wallId: top.id }), { cx: 800, top: IY0 });
  b.put(S('gen-ausstattung-notausgang-schild', 90, { wallId: right.id }), { right: IX1, cy: 1220 });
  b.put(S('gen-ausstattung-lautsprecher', 0, { wallId: top.id }), { cx: 890, top: IY0 });
  b.put(S('gen-ausstattung-lautsprecher', 180, { wallId: bottom.id }), { cx: 880, bottom: IY1 });
  b.put(S('gen-ausstattung-muelleimer'), { cx: 880, cy: 540 });

  return project;
}

/* ------------------------------------------------------------------ */
/* Vorlage 3: Mittleres Studio 800 m² (40 × 20 m)                      */
/* ------------------------------------------------------------------ */

function createMediumStudio(name = 'Mittleres Studio 800 m²'): Project {
  const { project, floor } = baseProject(name, 4000, 2000, 400);
  const b = new FloorBuilder(floor);
  const { minX: IX0, minY: IY0, maxX: IX1, maxY: IY1 } = b.inner; // 24 / 24 / 3976 / 1976

  /* ---- Wände ---- */
  const COL = 800; // linke Nebenraum-Spalte
  const SAN = 300;
  const WING = 2800; // rechte Nebenräume (Wellness oben, Kursraum unten)
  const wCol = b.wall(COL, IY0, COL, IY1);
  b.wall(IX0, 450, COL, 450); // Empfang | Büro
  b.wall(IX0, 700, COL, 700); // Büro | Lager
  const wLD = b.wall(IX0, 900, COL, 900); // Lager | Umkleide Damen
  const wDH = b.wall(IX0, 1440, COL, 1440); // Damen | Herren
  const wSanD = b.wall(SAN, 900, SAN, 1440);
  const wSanH = b.wall(SAN, 1440, SAN, IY1);
  const wWellX = b.wall(WING, IY0, WING, 600);
  const wWellY = b.wall(WING, 600, IX1, 600);
  const wKursX = b.wall(WING, 1400, WING, IY1);
  const wKursY = b.wall(WING, 1400, IX1, 1400);
  const hf = INNER_WALL / 2;
  const HALL_X = COL + hf; // 805
  const ROOM_X1 = COL - hf; // 795
  const SAN_X1 = SAN - hf; // 295
  const UMK_X0 = SAN + hf; // 305
  const WING_X0 = WING + hf; // 2805
  const WING_X1 = WING - hf; // 2795
  const WELL_Y1 = 600 - hf; // 595
  const KURS_Y0 = 1400 + hf; // 1405
  const FUNC_Y0 = 600 + hf; // 605
  const FUNC_Y1 = 1400 - hf; // 1395

  /* ---- Türen und Fenster ---- */
  const top = b.hallWall(0);
  const right = b.hallWall(1);
  const bottom = b.hallWall(2);
  const left = b.hallWall(3);
  b.door(top, { x: 250, y: IY0 }, { x: 250, y: -100 }, { type: 'Notausgang', width: 125, note: 'Haupteingang' });
  b.door(wCol, { x: COL, y: 200 }, { x: 1000, y: 200 }, { type: 'Glastür', width: 100 });
  b.door(wCol, { x: COL, y: 575 }, { x: 600, y: 575 }, { width: 90 });
  b.door(wCol, { x: COL, y: 800 }, { x: 600, y: 800 }, { width: 100 });
  b.door(wCol, { x: COL, y: 960 }, { x: 600, y: 960 }, { width: 90 });
  b.door(wCol, { x: COL, y: 1500 }, { x: 600, y: 1500 }, { width: 90 });
  b.door(wSanD, { x: SAN, y: 1075 }, { x: 150, y: 1075 }, { width: 80 });
  b.door(wSanH, { x: SAN, y: 1615 }, { x: 150, y: 1615 }, { width: 80 });
  b.door(wWellY, { x: 2950, y: 600 }, { x: 2950, y: 400 }, { type: 'Glastür', width: 100 });
  b.door(wKursY, { x: 2950, y: 1400 }, { x: 2950, y: 1600 }, { type: 'zweiflügelig', width: 150 });
  b.door(bottom, { x: 2700, y: IY1 }, { x: 2700, y: 2200 }, { type: 'Notausgang', width: 100 });
  b.door(right, { x: IX1, y: 1880 }, { x: 4200, y: 1880 }, { type: 'Notausgang', width: 100 });
  b.window(top, { x: 550, y: IY0 }, 150);
  b.window(left, { x: IX0, y: 575 }, 120);
  b.window(left, { x: IX0, y: 240 }, 150);
  for (const x of [1200, 1800, 2400]) b.window(top, { x, y: IY0 }, 200, { sillHeight: 180, height: 100 });
  b.window(right, { x: IX1, y: 300 }, 150);
  b.window(bottom, { x: 3500, y: IY1 }, 200);
  b.window(bottom, { x: 1200, y: IY1 }, 200, { sillHeight: 180, height: 100 });

  /* ---- Raumnamen ---- */
  b.nameRooms([
    { at: { x: 400, y: 240 }, name: 'Empfang / Lounge', type: 'Empfang/Lounge' },
    { at: { x: 400, y: 575 }, name: 'Büro / Personal', type: 'Büro' },
    { at: { x: 400, y: 800 }, name: 'Lager / Technik', type: 'Lager' },
    { at: { x: 550, y: 1170 }, name: 'Umkleide Damen', type: 'Umkleide Damen' },
    { at: { x: 150, y: 1170 }, name: 'Duschen / WC Damen', type: 'Duschen' },
    { at: { x: 550, y: 1700 }, name: 'Umkleide Herren', type: 'Umkleide Herren' },
    { at: { x: 150, y: 1700 }, name: 'Duschen / WC Herren', type: 'Duschen' },
    { at: { x: 3400, y: 300 }, name: 'Wellness', type: 'Wellness/Sauna' },
    { at: { x: 3400, y: 1700 }, name: 'Kursraum', type: 'Kursraum' },
    { at: { x: 1800, y: 1000 }, name: 'Trainingshalle (Verkehrsfläche)', type: 'Flur/Verkehrsfläche' },
  ]);

  /* ---- Zonen ---- */
  b.zone(900, IY0, WING_X1, 450, 'Cardio', 'Cardio');
  b.zone(880, 540, WING_X1, 1240, 'Maschinen', 'Maschinen');
  b.zone(880, 1250, WING_X1, IY1, 'Freihantel', 'Trainingsfläche Freihantel');
  b.zone(WING_X0, FUNC_Y0, IX1, FUNC_Y1, 'Functional', 'Functional/Stretching');

  /* ---- Empfang (x 24–795, y 24–445) ---- */
  b.put(S('gen-empfang-theke', 180), { cx: 450, cy: 390 });
  b.put(S('gen-empfang-drehkreuz', 270), { right: ROOM_X1 - 20, cy: 190 });
  b.put(S('gen-empfang-zugangsschranke', 270), { right: ROOM_X1 - 20, cy: 300 });
  b.put(S('gen-empfang-sofa-3', 270), { left: IX0, top: 60 });
  b.put(S('gen-empfang-sessel'), { left: IX0, top: 300 });
  b.put(S('gen-empfang-loungetisch', 90), { cx: 150, cy: 200 });
  b.put(S('gen-empfang-stehtisch'), { cx: 250, cy: 330 });
  b.put(S('gen-empfang-kuehlschrank'), { right: ROOM_X1, cy: 400 });
  b.put(S('gen-empfang-getraenkeautomat'), { right: ROOM_X1, top: IY0 });
  b.put(S('gen-empfang-snackautomat'), { right: ROOM_X1 - 100, top: IY0 });
  b.put(S('gen-empfang-info-bildschirm', 0, { wallId: top.id }), { cx: 400, top: IY0 });
  b.put(S('gen-empfang-garderobe'), { cx: 120, bottom: 445 });
  b.put(S('gen-bau-heizkoerper', 0, { wallId: top.id }), { cx: 550, top: IY0 });
  b.put(S('gen-ausstattung-notausgang-schild', 0, { wallId: top.id }), { cx: 140, top: IY0 });
  b.put(S('gen-ausstattung-wasserspender'), { cx: 660, cy: 400 });
  b.put(S('gen-ausstattung-muelleimer'), { cx: 640, cy: 300 });
  b.put(S('gen-ausstattung-pflanze-gross'), { cx: 250, cy: 410 });
  b.put(S('gen-ausstattung-kamera', 0, { wallId: top.id }), { cx: 480, top: IY0 });

  /* ---- Büro / Personal (y 455–695) ---- */
  b.put(S('gen-buero-schreibtisch'), { cx: 200, cy: 520 });
  b.put(S('gen-buero-buerostuhl'), { cx: 200, cy: 620 });
  b.put(S('gen-buero-rollcontainer'), { cx: 310, cy: 520 });
  b.put(S('gen-buero-aktenschrank'), { left: IX0, cy: 500 });
  b.put(S('gen-buero-personalschrank'), { left: IX0, bottom: 695 });
  b.put(S('gen-buero-personaltisch'), { cx: 470, cy: 590 });
  b.rowX([S('gen-empfang-stuhl'), S('gen-empfang-stuhl')], { left: 420, top: 455 });
  b.put(S('gen-buero-teekueche', 0, { width: 150 }), { right: ROOM_X1, bottom: 695 });
  b.put(S('gen-ausstattung-erste-hilfe', 0, { wallId: wCol.id }), { cx: 660, top: 455 });

  /* ---- Lager / Technik (y 705–895) ---- */
  b.rowX([S('gen-lager-schwerlastregal'), S('gen-lager-schwerlastregal'), S('gen-lager-regal')], { left: IX0, top: 705 }, { limit: 560 });
  b.rowX([S('gen-lager-waschmaschine'), S('gen-lager-trockner'), S('gen-lager-putzwagen')], { left: IX0, bottom: 895 });
  b.put(S('gen-lager-serverschrank'), { cx: 520, bottom: 895 });
  b.put(S('gen-lager-warmwasserspeicher'), { cx: 610, bottom: 895 });
  b.put(S('gen-lager-schaltschrank', 180, { wallId: wLD.id }), { cx: 720, bottom: 895 });

  /* ---- Umkleiden (Damen y 905–1435, Herren y 1445–1976) ---- */
  const changingRoom = (y0: number, y1: number, sanWall: Wall, topWall: Wall, women: boolean) => {
    b.rowX([S('gen-sanitaer-einzeldusche'), S('gen-sanitaer-einzeldusche'), S('gen-sanitaer-einzeldusche')], { left: IX0, top: y0 }, { gap: 0, limit: SAN_X1 });
    if (women) {
      b.rowX([S('gen-sanitaer-wc-kabine'), S('gen-sanitaer-wc-kabine')], { left: IX0, bottom: y1 }, { gap: 0 });
    } else {
      b.put(S('gen-sanitaer-wc-kabine'), { left: IX0, bottom: y1 });
      b.put(S('gen-sanitaer-urinal', 180, { wallId: bottom.id }), { cx: 250, bottom: y1 });
    }
    const midY = roundGrid((y0 + y1) / 2);
    // Sanitärraum: Tür bei y0 + 170 (Schwenkbereich x 205–295), Waschtisch darunter
    b.put(S('gen-umkleide-waschtisch-doppel', 90, { wallId: sanWall.id }), { right: SAN_X1, cy: y0 + 300 });
    b.put(S('gen-umkleide-handtuchspender', 90, { wallId: sanWall.id }), { right: SAN_X1 - 5, cy: y0 + 380 });
    b.put(S('gen-umkleide-waeschesammler'), { left: IX0, cy: y0 + 200 });
    // Umkleide x 305–795: Tür von der Halle bei y0 + 55 (Schwenkbereich x 705–795, bis y0 + 100)
    const row1 = b.put(lockerRow(16, 180, women ? 'Spinde Damen A' : 'Spinde Herren A'), { left: UMK_X0, bottom: y1 });
    const free = extentsOf(row1).minY - 10 - y0;
    b.put(lockerRow(Math.max(3, Math.min(12, Math.floor(free / 30))), 270, women ? 'Spinde Damen B' : 'Spinde Herren B'), { left: UMK_X0, top: y0 });
    b.put(S('gen-umkleide-einzelkabine'), { right: ROOM_X1, top: y0 + 150 });
    b.put(S('gen-umkleide-mittelbank', 0, { width: 150 }), { cx: 560, cy: midY });
    b.put(S('gen-umkleide-spiegel', 90, { wallId: wCol.id }), { right: ROOM_X1, cy: midY + 50 });
    b.put(S('gen-umkleide-foehnplatz', 0, { wallId: topWall.id }), { cx: 650, top: y0 });
    b.put(S('gen-umkleide-wertfaecher', 0, { wallId: topWall.id }), { cx: 560, top: y0 });
    b.put(S('gen-ausstattung-muelleimer'), { cx: 500, cy: midY + 60 });
    b.put(S('gen-bau-lueftungsauslass'), { cx: 600, cy: y0 + 95 });
  };
  changingRoom(905, 1435, wSanD, wLD, true);
  changingRoom(1445, IY1, wSanH, wDH, false);

  /* ---- Wellness (x 2805–3976, y 24–595) ---- */
  const sauna = b.put(S('gen-wellness-sauna-300'), { right: IX1, top: IY0 });
  b.put(S('gen-wellness-infrarotkabine'), { right: IX1, top: extentsOf(sauna).maxY + 10 });
  const wellCol = b.rowY([S('gen-wellness-erlebnisdusche'), S('gen-wellness-eisbrunnen'), S('gen-wellness-cold-plunge', 90)], { top: IY0, right: extentsOf(sauna).minX - 10 });
  b.rowY([S('gen-wellness-ruheliege'), S('gen-wellness-ruheliege'), S('gen-wellness-ruheliege')], { top: 60, left: WING_X0 + 20 }, { gap: 30, limit: 480 });
  b.put(S('gen-wellness-wasserbett'), { cx: 3300, cy: 100 });
  b.put(S('gen-wellness-teestation'), { cx: 3300, cy: 470 });
  b.put(S('gen-wellness-red-light-panel', 180, { wallId: wWellY.id }), { cx: 3600, bottom: WELL_Y1 });
  b.put(S('gen-wellness-massagestuhl'), { cx: 3300, cy: 280 });
  b.put(S('gen-umkleide-waeschesammler'), { right: IX1, bottom: WELL_Y1 });
  b.put(S('gen-umkleide-handtuchspender', 90, { wallId: right.id }), { right: IX1 - 5, cy: 480 });
  assert(b.boxOf(wellCol).maxY <= WELL_Y1, 'Wellness-Spalte zu lang');

  /* ---- Kursraum (x 2805–3976, y 1405–1976) ---- */
  b.put(S('gen-kursraum-trainer-podest'), { right: IX1, cy: 1690 });
  b.put(S('gen-kursraum-musikanlage'), { right: IX1, top: KURS_Y0 });
  b.rowX([S('gen-kursraum-mattenregal'), S('gen-kursraum-step-wagen')], { left: 3500, top: KURS_Y0 }, { limit: 3900 });
  for (const col of [3050, 3245]) {
    b.rowY([S('gen-kursraum-spinning-rad', 270), S('gen-kursraum-spinning-rad', 270), S('gen-kursraum-spinning-rad', 270)], { top: 1500, left: col }, { limit: IY1 });
  }
  b.rowY([S('gen-kursraum-kursmatte'), S('gen-kursraum-kursmatte'), S('gen-kursraum-kursmatte'), S('gen-kursraum-kursmatte')], { top: 1570, left: 3450 }, { gap: 20, limit: IY1 });
  b.rowY([S('gen-kursraum-step'), S('gen-kursraum-step')], { top: 1590, left: 3650 }, { gap: 20 });
  b.put(S('gen-ausstattung-lautsprecher', 90, { wallId: right.id }), { right: IX1, cy: 1560 });
  b.put(S('gen-ausstattung-lautsprecher', 90, { wallId: right.id }), { right: IX1, cy: 1780 });
  b.put(S('gen-ausstattung-notausgang-schild', 90, { wallId: right.id }), { right: IX1, bottom: IY1 });

  /* ---- Trainingshalle: Cardio-Reihe oben; endet ≥ 120 cm vor der Wellness-Wand ---- */
  const cardio = b.rowX([
    S('gen-cardio-laufband', 180), S('gen-cardio-laufband', 180), S('gen-cardio-laufband', 180), S('gen-cardio-curved-treadmill', 180),
    S('gen-cardio-crosstrainer', 180), S('gen-cardio-crosstrainer', 180),
    S('gen-cardio-ergometer', 180), S('gen-cardio-ergometer', 180), S('gen-cardio-liegeergometer', 180),
    S('gen-cardio-spinning-bike', 180), S('gen-cardio-air-bike', 180),
    S('gen-cardio-stairmaster', 180), S('gen-cardio-skierg', 180), S('gen-cardio-rudergeraet', 180),
  ], { left: 950, top: IY0 }, { gap: 20, limit: WING_X1 - 20 });

  /* ---- Gang entlang der Nebenraumwand (Türen der Umkleiden/Büro) ≥ 120 cm: Reihen beginnen bei x = 930 ---- */
  const ROW_X0 = HALL_X + 125;

  /* ---- Maschinen: zwei Reihen Rücken an Rücken (A: Front zum Cardio-Gang, B: Front zum Freihantel-Gang) ---- */
  const rowA = b.rowX([
    S('prime-hybrid-leg-press', 180), S('prime-hybrid-leg-extension', 180), S('prime-hybrid-seated-leg-curl', 180),
    S('prime-hybrid-chest-press', 180), S('prime-hybrid-lat-pulldown', 180), S('prime-hybrid-seated-row', 180),
  ], { left: ROW_X0, top: b.boxOf(cardio).maxY + AISLE }, { limit: WING_X1 - 20 });
  b.assertAisleY(cardio, rowA);
  const rowB = b.rowX([
    S('atlantis-p140'), S('atlantis-p356'), S('atlantis-d123'), S('atlantis-c105'),
    S('atlantis-c108'), S('atlantis-e352'), S('atlantis-b157'),
  ], { left: ROW_X0, top: b.boxOf(rowA).maxY }, { limit: WING_X1 - 20 });

  /* ---- Freihantel: Bänke-Reihe, Rack-Reihe an der Rückwand, Kurzhantel-Racks an der Kursraumwand ---- */
  const rowC = b.rowX([
    S('atlantis-b177'), S('atlantis-b275'), S('prime-benches-adjustable-bench'), S('atlantis-b256'), S('atlantis-p245'), S('atlantis-c117'),
    S('atlantis-a264'),
  ], { left: ROW_X0, top: b.boxOf(rowB).maxY + AISLE }, { limit: 2600 });
  b.assertAisleY(rowB, rowC);
  const rowD = b.rowX([
    S('atlantis-c513'), S('gen-freihantel-scheibenstaender', 180), S('atlantis-b7200'), S('prime-prodigy-racks-power-rack'),
    S('gen-freihantel-langhantelstaender', 180), S('atlantis-e155'), S('prime-specialty-functional-trainer'),
  ], { left: ROW_X0, bottom: IY1 }, { gap: 5, limit: 2600 });
  b.assertAisleY(rowC, rowD);
  const dbRacks = b.rowY([S('atlantis-s187', 90), S('gen-freihantel-kurzhantel-rack-3', 90)], { top: b.boxOf(rowB).maxY + AISLE, right: WING_X1 }, { limit: IY1 });
  assert(b.boxOf(dbRacks).minX > Math.max(b.boxOf(rowC).maxX, b.boxOf(rowD).maxX) + 10, 'Kurzhantel-Racks kollidieren mit Freihantelreihen');

  /* ---- Functional (rechter Flügel x 2805–3976, y 605–1395) ---- */
  const rig = b.put(S('gen-functional-rig'), { right: IX1, top: FUNC_Y0 });
  b.put(S('gen-functional-sled-bahn', 0, { width: 850, depth: 150 }), { right: IX1 - 125, bottom: FUNC_Y1 }); // ≥ 120 cm zur Hallenwand
  b.put(S('gen-functional-sled'), { cx: 3450, bottom: FUNC_Y1 - 160 });
  b.rowY([S('gen-functional-kettlebell-regal', 270), S('gen-functional-medizinball-regal', 270)], { top: 900, left: WING_X0 }, { limit: FUNC_Y1 - 160 });
  b.put(S('gen-functional-plyo-box-soft-set'), { cx: 3250, cy: 700 });
  b.put(S('gen-functional-plyo-box'), { cx: 3300, cy: 800 });
  b.put(S('gen-functional-schlingentrainer'), { cx: 3420, cy: 720 });
  b.put(S('gen-functional-boxsack-staender'), { cx: 3250, top: extentsOf(rig).maxY + 10 });
  b.rowY([S('gen-functional-bodenmatte'), S('gen-functional-bodenmatte')], { top: 1000, left: 3550 }, { limit: FUNC_Y1 - 160 });
  b.put(S('gen-functional-sprossenwand', 90, { wallId: right.id }), { right: IX1, cy: 1050 });

  /* ---- Bauelemente / Ausstattung Halle ---- */
  b.put(S('gen-bau-saeule-rund'), { cx: 2760, cy: 600 });
  b.put(S('gen-bau-saeule-rund'), { cx: 2760, cy: 1230 });
  b.put(S('gen-ausstattung-wasserspender'), { cx: 880, cy: 480 });
  b.put(S('gen-ausstattung-wasserspender'), { cx: 2760, cy: 1000 });
  b.put(S('gen-ausstattung-desinfektionsstation'), { cx: 880, cy: 1500 });
  b.put(S('gen-ausstattung-desinfektionsstation'), { cx: 2840, cy: 1300 });
  b.put(S('gen-ausstattung-muelleimer'), { cx: 880, cy: 540 });
  b.put(S('gen-ausstattung-feuerloescher', 180, { wallId: bottom.id }), { cx: 2600, bottom: IY1 });
  b.put(S('gen-ausstattung-feuerloescher', 270, { wallId: wCol.id }), { left: HALL_X, cy: 1100 });
  b.put(S('gen-ausstattung-aed', 270, { wallId: wCol.id }), { left: HALL_X, cy: 1000 });
  b.put(S('gen-ausstattung-erste-hilfe', 270, { wallId: wCol.id }), { left: HALL_X, cy: 1050 });
  b.put(S('gen-ausstattung-tv-65', 0, { wallId: top.id }), { cx: 880, top: IY0 });
  b.put(S('gen-ausstattung-notausgang-schild', 90, { wallId: wKursX.id }), { right: WING_X1, cy: 1900 });
  b.put(S('gen-ausstattung-lautsprecher', 180, { wallId: bottom.id }), { cx: 2630, bottom: IY1 });
  b.put(S('gen-ausstattung-lautsprecher', 270, { wallId: wCol.id }), { left: HALL_X, cy: 700 });
  b.put(S('gen-ausstattung-lautsprecher', 90, { wallId: wWellX.id }), { right: WING_X1, cy: 500 });
  b.put(S('gen-ausstattung-kamera', 270, { wallId: wCol.id }), { left: HALL_X, cy: 300 });
  b.put(S('gen-ausstattung-kamera', 90, { wallId: wKursX.id }), { right: WING_X1, cy: 1850 });

  return project;
}


/* ------------------------------------------------------------------ */
/* Vorlage 4: Beispielstudio 1.000 m² (40 × 25 m)                       */
/* ------------------------------------------------------------------ */

/**
 * Durchdachtes Muster-Studio:
 * - Linke Servicezeile (x 24–895): Empfang/Lounge am Haupteingang, Büro, Personalraum, barrierefreies WC,
 *   Umkleide Damen und Herren mit je eigenem Dusch-/WC-Raum (Zugang jeweils von der Halle).
 * - Rechte Zeile (x 3005–3976): Lager mit Rolltor, Technik, Putzraum (oben), Wellness (Mitte), Kursraum mit
 *   Spiegelwand (unten, eigener Notausgang).
 * - Trainingshalle (x 905–2995): Freihantel mit Racks an der Spiegelwand (oben links), Functional (oben rechts),
 *   zwei Maschinenreihen Rücken an Rücken (Beine / Oberkörper), Plate-Loaded-Reihe, Cardio am Fensterband (unten).
 * - Alle Gänge ≥ 125 cm zwischen Belegungsboxen; Notausgänge oben rechts und im Kursraum; Türen ohne Geräte im
 *   Schwenkbereich; Cardio-Sturzräume (200 cm) frei.
 */
function createExampleStudio(name = 'Beispielstudio 1.000 m²'): Project {
  const { project, floor } = baseProject(name, 4000, 2500, 400);
  const b = new FloorBuilder(floor);
  const { minX: IX0, minY: IY0, maxX: IX1, maxY: IY1 } = b.inner; // 24 / 24 / 3976 / 2476
  const hf = INNER_WALL / 2;

  /* ---- Wände: linke Servicezeile ---- */
  const COL = 900;
  const wCol = b.wall(COL, IY0, COL, IY1);
  const wEmpf = b.wall(IX0, 700, COL, 700); // Empfang | Büro/Personal/WC
  const wRow = b.wall(IX0, 1050, COL, 1050); // Büro-Zeile | Umkleide Damen
  b.wall(350, 700, 350, 1050); // Büro | Personalraum
  const wWcBf = b.wall(650, 700, 650, 1050); // Personalraum | WC barrierefrei
  const wDH = b.wall(IX0, 1750, COL, 1750); // Umkleide Damen | Herren
  const wSanD = b.wall(400, 1050, 400, 1750);
  const wSanH = b.wall(400, 1750, 400, IY1);
  /* ---- Wände: rechte Zeile ---- */
  const RC = 3000;
  const wRC = b.wall(RC, IY0, RC, IY1);
  const wLagerY = b.wall(RC, 550, IX1, 550); // Lager/Technik | Wellness
  const wLagerX = b.wall(3500, IY0, 3500, 550); // Lager | Technik/Putzraum
  b.wall(3500, 300, IX1, 300); // Technik | Putzraum
  b.wall(RC, 1400, IX1, 1400); // Wellness | Kursraum

  const HALL_X0 = COL + hf; // 905
  const HALL_X1 = RC - hf; // 2995
  const ROOM_X1 = COL - hf; // 895
  const SAN_X1 = 400 - hf; // 395
  const UMK_X0 = 400 + hf; // 405
  const RX0 = RC + hf; // 3005

  /* ---- Türen, Fenster, Spiegel ---- */
  const top = b.hallWall(0);
  const right = b.hallWall(1);
  const bottom = b.hallWall(2);
  const left = b.hallWall(3);
  b.door(top, { x: 300, y: IY0 }, { x: 300, y: 200 }, { type: 'Notausgang', width: 200, note: 'Haupteingang, zweiflügelige Glastür' });
  b.door(wCol, { x: COL, y: 350 }, { x: 1000, y: 350 }, { type: 'Glastür', width: 100, note: 'Zugang Halle (hinter Drehkreuz)' });
  b.door(wEmpf, { x: 180, y: 700 }, { x: 180, y: 800 }, { width: 90 }); // Büro
  b.door(wEmpf, { x: 500, y: 700 }, { x: 500, y: 800 }, { width: 90 }); // Personalraum
  b.door(wCol, { x: COL, y: 880 }, { x: 1000, y: 880 }, { width: 100, note: 'WC barrierefrei (schlägt nach außen auf)' });
  b.door(wCol, { x: COL, y: 1130 }, { x: 800, y: 1130 }, { width: 90, note: 'Umkleide Damen' });
  b.door(wSanD, { x: 400, y: 1300 }, { x: 300, y: 1300 }, { width: 80 });
  b.door(wCol, { x: COL, y: 1830 }, { x: 800, y: 1830 }, { width: 90, note: 'Umkleide Herren' });
  b.door(wSanH, { x: 400, y: 2000 }, { x: 300, y: 2000 }, { width: 80 });
  b.door(top, { x: 3250, y: IY0 }, { x: 3250, y: 200 }, { type: 'Rolltor', width: 250, note: 'Anlieferung Lager' });
  b.door(wRC, { x: RC, y: 430 }, { x: 3100, y: 430 }, { width: 100, note: 'Lager' });
  b.door(wLagerX, { x: 3500, y: 160 }, { x: 3600, y: 160 }, { width: 90 }); // Technik
  b.door(wLagerX, { x: 3500, y: 430 }, { x: 3600, y: 430 }, { width: 90 }); // Putzraum
  b.door(wRC, { x: RC, y: 700 }, { x: 3100, y: 700 }, { type: 'Glastür', width: 100, note: 'Wellness' });
  b.door(wRC, { x: RC, y: 1500 }, { x: 3100, y: 1500 }, { type: 'zweiflügelig', width: 150, note: 'Kursraum' });
  b.door(right, { x: IX1, y: 2300 }, { x: 4200, y: 2300 }, { type: 'Notausgang', width: 100 });
  b.door(top, { x: 2910, y: IY0 }, { x: 2910, y: -100 }, { type: 'Notausgang', width: 100 });
  b.window(top, { x: 150, y: IY0 }, 150);
  b.window(left, { x: IX0, y: 300 }, 150);
  b.window(left, { x: IX0, y: 880 }, 120);
  for (const x of [1150, 1550, 1950, 2350, 2750]) b.window(bottom, { x, y: IY1 }, 300, { sillHeight: 90, height: 220 });
  b.window(right, { x: IX1, y: 900 }, 150);
  b.window(right, { x: IX1, y: 1800 }, 200);
  b.window(right, { x: IX1, y: 2050 }, 200);
  b.mirror(top, { x: 1600, y: IY0 }, { x: 1600, y: 300 }, 800); // Spiegelwand Freihantel
  b.mirror(wRC, { x: RC, y: 2000 }, { x: 3300, y: 2000 }, 800); // Spiegelwand Kursraum

  /* ---- Raumnamen ---- */
  b.nameRooms([
    { at: { x: 450, y: 350 }, name: 'Empfang / Lounge', type: 'Empfang/Lounge' },
    { at: { x: 180, y: 900 }, name: 'Büro', type: 'Büro' },
    { at: { x: 500, y: 900 }, name: 'Personalraum', type: 'Personalraum' },
    { at: { x: 770, y: 900 }, name: 'WC barrierefrei', type: 'WC' },
    { at: { x: 650, y: 1400 }, name: 'Umkleide Damen', type: 'Umkleide Damen' },
    { at: { x: 200, y: 1400 }, name: 'Duschen / WC Damen', type: 'Duschen' },
    { at: { x: 650, y: 2100 }, name: 'Umkleide Herren', type: 'Umkleide Herren' },
    { at: { x: 200, y: 2100 }, name: 'Duschen / WC Herren', type: 'Duschen' },
    { at: { x: 3250, y: 300 }, name: 'Lager', type: 'Lager' },
    { at: { x: 3740, y: 160 }, name: 'Technik / Lüftung', type: 'Technik/Lüftung' },
    { at: { x: 3740, y: 430 }, name: 'Putzraum', type: 'Putzraum' },
    { at: { x: 3500, y: 1000 }, name: 'Wellness', type: 'Wellness/Sauna' },
    { at: { x: 3500, y: 1900 }, name: 'Kursraum', type: 'Kursraum' },
    { at: { x: 1950, y: 1570 }, name: 'Trainingshalle', type: 'Flur/Verkehrsfläche' },
  ]);
  for (const meta of Object.values(floor.roomMeta)) if (meta.name === 'Trainingshalle') meta.labelMode = 'none';

  /* ---- Empfang / Lounge (x 24–895, y 24–695) – Eingang oben bei x 200–400 ---- */
  b.put(S('gen-empfang-theke', 180), { cx: 500, cy: 380 });
  b.put(S('gen-empfang-shakebar', 180, { width: 160 }), { cx: 270, cy: 380 });
  b.put(S('gen-empfang-barhocker'), { cx: 220, cy: 300 });
  b.put(S('gen-empfang-barhocker'), { cx: 300, cy: 300 });
  b.put(S('gen-empfang-drehkreuz', 270), { right: ROOM_X1, cy: 350 });
  b.put(S('gen-empfang-zugangsschranke', 270), { right: ROOM_X1, cy: 480 });
  b.put(S('gen-empfang-sofa-3', 90), { left: IX0, top: 250 });
  b.put(S('gen-empfang-sessel'), { left: IX0, top: 500 });
  b.put(S('gen-empfang-loungetisch', 90), { cx: 190, cy: 560 });
  b.put(S('gen-empfang-sessel'), { cx: 300, cy: 560 });
  b.put(S('gen-empfang-stehtisch'), { cx: 460, cy: 560 });
  b.put(S('gen-empfang-stehtisch'), { cx: 580, cy: 560 });
  b.put(S('gen-empfang-kuehlschrank'), { right: ROOM_X1, bottom: 695 });
  b.put(S('gen-empfang-getraenkeautomat'), { right: ROOM_X1 - 80, bottom: 695 });
  b.put(S('gen-empfang-snackautomat'), { right: ROOM_X1 - 180, bottom: 695 });
  b.put(S('gen-empfang-garderobe'), { cx: 600, top: IY0 });
  b.put(S('gen-empfang-info-stele'), { cx: 700, top: IY0 });
  b.put(S('gen-empfang-info-bildschirm', 0, { wallId: top.id }), { cx: 800, top: IY0 });
  b.put(S('gen-ausstattung-pflanze-gross'), { left: IX0, top: IY0 });
  b.put(S('gen-ausstattung-pflanze-gross'), { cx: 510, top: IY0 });
  b.put(S('gen-ausstattung-pflanze'), { left: IX0, bottom: 695 });
  b.put(S('gen-ausstattung-wasserspender'), { cx: 700, cy: 560 });
  b.put(S('gen-ausstattung-muelleimer'), { cx: 640, cy: 470 });
  b.put(S('gen-ausstattung-aed', 180, { wallId: wEmpf.id }), { cx: 300, bottom: 695 });
  b.put(S('gen-ausstattung-erste-hilfe', 180, { wallId: wEmpf.id }), { cx: 350, bottom: 695 });
  b.put(S('gen-ausstattung-feuerloescher', 180, { wallId: wEmpf.id }), { cx: 400, bottom: 695 });
  b.put(S('gen-ausstattung-notausgang-schild', 0, { wallId: top.id }), { cx: 430, top: IY0 });
  b.put(S('gen-ausstattung-kamera', 0, { wallId: top.id }), { right: ROOM_X1, top: IY0 });
  b.put(S('gen-bau-heizkoerper', 270, { wallId: left.id }), { left: IX0, cy: 165 });

  /* ---- Büro (x 24–345) – Tür bei x 180 (Schwenk y 705–795) ---- */
  b.put(S('gen-buero-schreibtisch', 90), { right: 345, cy: 900 });
  b.put(S('gen-buero-buerostuhl'), { cx: 200, cy: 900 });
  b.put(S('gen-buero-rollcontainer'), { right: 345, bottom: 1045 });
  b.put(S('gen-buero-aktenschrank'), { left: IX0, bottom: 1045 });
  b.put(S('gen-bau-heizkoerper', 270, { wallId: left.id }), { left: IX0, cy: 880 });
  /* ---- Personalraum (x 355–645) – Tür bei x 500 (Schwenk x 455–545, y 705–795) ---- */
  b.put(S('gen-buero-personaltisch'), { cx: 500, cy: 940 });
  b.put(S('gen-empfang-stuhl', 90), { cx: 410, cy: 940 });
  b.put(S('gen-empfang-stuhl', 270), { cx: 590, cy: 940 });
  b.put(S('gen-buero-personalschrank'), { left: 355, top: 705 });
  b.put(S('gen-buero-teekueche', 0, { width: 90 }), { right: 645, top: 705 });
  b.put(S('gen-ausstattung-erste-hilfe', 90, { wallId: wWcBf.id }), { right: 645, cy: 1000 });
  /* ---- WC barrierefrei (x 655–895) – Tür von der Halle bei y 880 (Schwenk x 805–895, y 835–925) ---- */
  b.put(S('gen-sanitaer-wc-barrierefrei'), { left: 655, top: 705 });
  b.put(S('gen-umkleide-waschtisch', 180, { wallId: wRow.id }), { cx: 850, bottom: 1045 });
  b.put(S('gen-umkleide-handtuchspender', 180, { wallId: wRow.id }), { cx: 770, bottom: 1045 });

  /* ---- Umkleiden ---- */
  const changingRoom = (y0: number, y1: number, sanWall: Wall, topWall: Wall, doorY: number, women: boolean) => {
    // Sanitärraum (x 24–395): 4 Duschen oben, barrierefreie Dusche unten links, WC-Kabinen unten, Tür von der Umkleide
    // bei doorY + 170 (Schwenk x 315–395, y doorY+130…doorY+210); Waschtisch, WC und Urinale an der Trennwand darunter
    b.rowX([S('gen-sanitaer-einzeldusche'), S('gen-sanitaer-einzeldusche'), S('gen-sanitaer-einzeldusche'), S('gen-sanitaer-einzeldusche')], { left: IX0, top: y0 }, { gap: 0, limit: SAN_X1 });
    b.put(S('gen-sanitaer-dusche-barrierefrei'), { left: IX0, bottom: y1 });
    b.rowX([S('gen-sanitaer-wc-kabine'), S('gen-sanitaer-wc-kabine')], { left: 180, bottom: y1 }, { gap: 5, limit: SAN_X1 });
    b.put(S('gen-sanitaer-wc-kabine', 90), { right: SAN_X1, cy: doorY + 260 }); // unter dem Türschwenk, y doorY+215…+305
    if (women) {
      b.put(S('gen-umkleide-waschtisch-doppel', 90, { wallId: sanWall.id }), { right: SAN_X1, cy: doorY + 375 });
      b.put(S('gen-umkleide-handtuchspender', 90, { wallId: sanWall.id }), { right: SAN_X1, cy: doorY + 75 });
      b.put(S('gen-sanitaer-wickeltisch', 270, { wallId: left.id }), { left: IX0, cy: doorY + 340 });
    } else {
      b.put(S('gen-sanitaer-urinal', 90, { wallId: sanWall.id }), { right: SAN_X1, cy: doorY + 340 });
      b.put(S('gen-sanitaer-urinal', 90, { wallId: sanWall.id }), { right: SAN_X1, cy: doorY + 405 });
      b.put(S('gen-umkleide-waschtisch-doppel', 270, { wallId: left.id }), { left: IX0, cy: doorY + 300 });
      b.put(S('gen-umkleide-handtuchspender', 270, { wallId: left.id }), { left: IX0, cy: doorY + 390 });
    }
    b.put(S('gen-umkleide-waeschesammler'), { left: IX0 + 160, cy: doorY + 340 });
    // Umkleide (x 405–895): Tür von der Halle bei doorY (Schwenk x 805–895, y doorY−45…doorY+45)
    const rowBottom = b.put(lockerRow(16, 180, women ? 'Spinde Damen A (32 Fächer)' : 'Spinde Herren A (32 Fächer)'), { left: UMK_X0, bottom: y1 });
    const freeY = extentsOf(rowBottom).minY - 10 - (y0 + 10);
    const abteile = Math.min(18, Math.floor(freeY / 30));
    b.put(lockerRow(abteile, 270, women ? `Spinde Damen B (${abteile * 2} Fächer)` : `Spinde Herren B (${abteile * 2} Fächer)`), { left: UMK_X0, top: y0 + 10 });
    b.put(S('gen-umkleide-einzelkabine'), { right: ROOM_X1, top: doorY + 60 });
    b.put(S('gen-umkleide-mittelbank', 0, { width: 180 }), { cx: 700, cy: doorY + 330 });
    b.put(S('gen-umkleide-spiegel', 90, { wallId: wCol.id }), { right: ROOM_X1, cy: doorY + 330 });
    b.put(S('gen-umkleide-foehnplatz', 90, { wallId: wCol.id }), { right: ROOM_X1, cy: doorY + 430 });
    b.put(S('gen-umkleide-wertfaecher', 0, { wallId: topWall.id }), { cx: 700, top: y0 });
    b.put(S('gen-umkleide-bank-schuhrost', 0, { width: 120 }), { cx: 700, bottom: extentsOf(rowBottom).minY - 10 });
    b.put(S('gen-ausstattung-muelleimer'), { right: ROOM_X1 - 40, bottom: extentsOf(rowBottom).minY - 10 });
    b.put(S('gen-bau-lueftungsauslass'), { cx: 620, cy: y0 + 60 });
  };
  changingRoom(1055, 1745, wSanD, wRow, 1130, true);
  changingRoom(1755, IY1, wSanH, wDH, 1830, false);

  /* ---- Lager (x 3005–3495, y 24–545) – Rolltor oben x 3125–3375, Tür von der Halle bei y 430 ---- */
  b.rowY([S('gen-lager-schwerlastregal', 90), S('gen-lager-schwerlastregal', 90)], { top: 30, right: 3495 }, { limit: 545 });
  b.rowX([S('gen-lager-waschmaschine'), S('gen-lager-trockner')], { left: 3110, bottom: 545 });
  b.put(S('gen-lager-regal', 0, { width: 120 }), { right: 3495 - 70, bottom: 545 });
  b.put(S('gen-freihantel-hantelscheiben-satz'), { left: 3110, top: 200 });
  /* ---- Technik (x 3505–3976, y 24–295) – Tür bei y 160 (Schwenk x 3505–3595) ---- */
  b.put(S('gen-lager-lueftungsanlage'), { right: IX1, top: IY0 });
  b.put(S('gen-lager-warmwasserspeicher'), { right: IX1, bottom: 295 });
  b.put(S('gen-lager-serverschrank'), { left: 3660, bottom: 295 });
  b.put(S('gen-lager-schaltschrank', 270, { wallId: wLagerX.id }), { left: 3505, cy: 250 });
  /* ---- Putzraum (x 3505–3976, y 305–545) – Tür bei y 430 ---- */
  b.put(S('gen-lager-putzwagen'), { right: IX1, bottom: 545 });
  b.put(S('gen-lager-regal'), { right: IX1, top: 305 });
  b.put(S('gen-sanitaer-putzraum-ausguss', 180, { wallId: wLagerY.id }), { cx: 3700, bottom: 545 });

  /* ---- Wellness (x 3005–3976, y 555–1395) – Tür bei y 700 (Schwenk x 3005–3105, y 650–750) ---- */
  const sauna = b.put(S('gen-wellness-sauna-300'), { right: IX1, top: 555 });
  b.put(S('gen-wellness-infrarotkabine'), { right: IX1, top: extentsOf(sauna).maxY + 10 });
  b.put(S('gen-wellness-erlebnisdusche'), { left: 3120, top: 555 });
  b.put(S('gen-wellness-eisbrunnen'), { left: 3250, top: 555 });
  b.put(S('gen-wellness-cold-plunge'), { left: 3320, top: 555 });
  b.put(S('gen-wellness-red-light-panel', 0, { wallId: wLagerY.id }), { cx: 3600, top: 555 });
  b.rowX([S('gen-wellness-ruheliege', 180), S('gen-wellness-ruheliege', 180), S('gen-wellness-ruheliege', 180), S('gen-wellness-ruheliege', 180)], { left: 3020, bottom: 1395 }, { gap: 30, limit: IX1 });
  b.put(S('gen-wellness-wasserbett'), { left: RX0 + 10, cy: 1000 });
  b.put(S('gen-wellness-massagestuhl', 90), { cx: 3370, cy: 1000 });
  b.put(S('gen-wellness-teestation'), { cx: 3350, cy: 780 });
  b.put(S('gen-umkleide-waeschesammler'), { right: IX1, bottom: 1395 - 80 });
  b.put(S('gen-umkleide-handtuchspender', 90, { wallId: right.id }), { right: IX1, cy: 1150 });
  b.put(S('gen-ausstattung-wasserspender'), { cx: 3600, cy: 1000 });
  b.put(S('gen-ausstattung-pflanze'), { cx: 3800, cy: 1150 });

  /* ---- Kursraum (x 3005–3976, y 1405–2476) – Tür bei y 1500 (Schwenk x 3005–3155), Spiegel x 3000 y 1600–2400 ---- */
  b.put(S('gen-kursraum-trainer-podest', 90), { right: IX1, cy: 1950 });
  b.put(S('gen-kursraum-musikanlage'), { right: IX1, top: 1405 });
  b.rowX([S('gen-kursraum-mattenregal'), S('gen-kursraum-step-wagen'), S('gen-kursraum-gymnastikball-regal'), S('gen-kursraum-kurshantel-regal')], { left: 3200, top: 1405 }, { limit: 3880 });
  b.rowX([
    S('gen-kursraum-spinning-rad', 180), S('gen-kursraum-spinning-rad', 180), S('gen-kursraum-spinning-rad', 180),
    S('gen-kursraum-spinning-rad', 180), S('gen-kursraum-spinning-rad', 180), S('gen-kursraum-spinning-rad', 180),
  ], { left: 3020, bottom: IY1 }, { gap: 5, limit: 3800 }); // Freihaltefläche vor dem Notausgang (x ≥ 3826)
  for (const col of [3220, 3450]) b.rowY([S('gen-kursraum-kursmatte'), S('gen-kursraum-kursmatte'), S('gen-kursraum-kursmatte')], { top: 1660, left: col }, { gap: 25, limit: 2250 });
  b.rowY([S('gen-kursraum-step'), S('gen-kursraum-step')], { top: 1700, left: 3680 }, { gap: 25 });
  b.put(S('gen-ausstattung-lautsprecher', 90, { wallId: right.id }), { right: IX1, cy: 1650 });
  b.put(S('gen-ausstattung-lautsprecher', 90, { wallId: right.id }), { right: IX1, cy: 2200 });
  b.put(S('gen-ausstattung-notausgang-schild', 90, { wallId: right.id }), { right: IX1, cy: 2380 });
  b.put(S('gen-ausstattung-feuerloescher', 90, { wallId: right.id }), { right: IX1, cy: 2420 });

  /* ---- Trainingshalle: Gang entlang der Servicezeile (Türen) → Reihen beginnen bei x 1030 ---- */
  const ROW_X0 = HALL_X0 + 125; // 1030
  const ROW_X1 = HALL_X1 - 125; // 2870 (Gang vor Wellness-/Kursraum-Tür)

  /* Freihantel (oben links): Racks an der Spiegelwand, Bänke davor, Kurzhantel-Rack an der Servicewand */
  const racks = b.rowX([
    S('atlantis-c513', 0, { note: 'Power Rack 1' }), S('atlantis-c513', 0, { note: 'Power Rack 2' }), S('atlantis-rs611'), S('atlantis-b4800', 0, { note: 'Kreuzheben-Plattform' }),
  ], { left: ROW_X0, top: IY0 }, { limit: 2200 });
  b.put(S('gen-freihantel-scheibenstaender'), { left: extentsOf(racks[3]).maxX + 8, top: IY0 }); // x 2190–2250
  b.put(S('gen-freihantel-langhantelstaender'), { right: 2325, top: IY0 }); // x 2255–2325, vor der Rig-Zone (2330)
  const benches = b.rowX([
    S('atlantis-b177'), S('atlantis-b177'), S('atlantis-b275'), S('atlantis-p337'), S('atlantis-p338'),
  ], { left: 1090, top: b.boxOf(racks).maxY + 130 }, { gap: 5, limit: 2310 });
  b.assertAisleY(racks, benches, 125);
  const dbRack = b.put(S('atlantis-s189', 270), { left: HALL_X0, top: 420 }); // Front zur Halle
  assert(extentsOf(dbRack).maxX <= 1090, 'Kurzhantel-Rack ragt in die Bänkereihe');
  b.put(S('gen-freihantel-hantelscheiben-satz-gross'), { left: extentsOf(racks[3]).maxX + 10, top: 200 });

  /* Functional (oben rechts, x 2320–2850; Notausgang oben bei x 2910 – Freihaltefläche x 2860–2960) */
  // Laufweg-Regel: Lücken zwischen Trainingsobjekten entweder < 40 cm (kein Gang) oder ≥ 120 cm
  b.put(S('gen-functional-rig', 0, { width: 360, depth: 180 }), { left: 2330, top: IY0 }); // Box x 2330–2810, y 24–324
  b.put(S('gen-functional-kettlebell-regal'), { left: 2330, top: 340 }); // x 2330–2450, Box bis y 495
  b.put(S('gen-functional-medizinball-regal'), { left: 2460, top: 340 }); // x 2460–2560
  b.put(S('gen-functional-plyo-box-soft-set'), { left: 2570, top: 340 }); // x 2575–2725, y 340–400
  b.put(S('gen-functional-sled'), { left: 2750, top: 340 }); // x 2755–2845, y 340–440
  b.rowX([S('gen-functional-bodenmatte'), S('gen-functional-bodenmatte')], { left: 2330, top: 520 }, { limit: 2745 }); // y 520–620
  b.put(S('gen-functional-sled-bahn', 90, { width: 150, depth: 520 }), { left: 2330, bottom: 787 }); // 520 × 150, y 635–785
  b.put(S('gen-functional-plyo-box'), { left: 2760, top: 570 }); // x 2765–2815, y 570–630

  /* Maschinen (Prime Hybrid), zwei Reihen Rücken an Rücken: A1 Beine (Front nach oben), A2 Oberkörper (Front nach unten) */
  const rowA1 = b.rowX([
    S('prime-hybrid-leg-press', 180), S('prime-hybrid-leg-extension', 180), S('prime-hybrid-seated-leg-curl', 180),
    S('prime-hybrid-prone-leg-curl', 180), S('prime-hybrid-inner-outer-thigh', 180), S('prime-hybrid-seated-calf-press', 180),
    S('prime-hybrid-multi-hip', 180),
  ], { left: ROW_X0, top: b.boxOf(benches).maxY + 125 }, { limit: ROW_X1 });
  b.assertAisleY(benches, rowA1, 125);
  const rowA2 = b.rowX([
    S('prime-hybrid-chest-press'), S('prime-hybrid-pec-rear-delt'), S('prime-hybrid-lat-pulldown'), S('prime-hybrid-seated-row'),
    S('prime-hybrid-shoulder-press'), S('prime-hybrid-lateral-raise'),
  ], { left: ROW_X0, top: b.boxOf(rowA1).maxY }, { limit: ROW_X1 });

  /* Plate-Loaded-Reihe (Front nach oben, große Geräte quer) */
  const rowP = b.rowX([
    S('prime-plate-loaded-hack-squat', 90), S('prime-plate-loaded-leg-press', 90), S('prime-plate-loaded-pendulum-squat', 90),
    S('prime-plate-loaded-extreme-row', 90), S('prime-hybrid-arm-curl', 180),
  ], { left: ROW_X0, top: b.boxOf(rowA2).maxY + 125 }, { limit: ROW_X1 });
  b.assertAisleY(rowA2, rowP, 125);
  b.put(S('gen-freihantel-scheibenstaender'), { left: extentsOf(rowP[4]).maxX + 15, top: extentsOf(rowP[4]).minY });

  /* Cardio am Fensterband (Front zum Fenster, Sturzraum 200 cm nach innen) */
  const cardio = b.rowX([
    S('gen-cardio-laufband'), S('gen-cardio-laufband'), S('gen-cardio-laufband'), S('gen-cardio-laufband'), S('gen-cardio-laufband'),
    S('gen-cardio-curved-treadmill'), S('gen-cardio-crosstrainer'), S('gen-cardio-crosstrainer'), S('gen-cardio-crosstrainer'),
    S('gen-cardio-ergometer'), S('gen-cardio-ergometer'), S('gen-cardio-liegeergometer'), S('gen-cardio-rudergeraet'), S('gen-cardio-rudergeraet'),
    S('gen-cardio-stairmaster'), S('gen-cardio-stairmaster'), S('gen-cardio-skierg'), S('gen-cardio-air-bike'),
  ], { left: ROW_X0, bottom: IY1 }, { gap: 8, limit: 2850 });
  b.assertAisleY(rowP, cardio, 120);
  b.put(S('gen-ausstattung-wasserspender'), { right: 2860, top: b.boxOf(rowP).maxY + 20 });
  b.put(S('gen-ausstattung-desinfektionsstation'), { right: 2860, top: b.boxOf(rowP).maxY + 70 });
  b.put(S('gen-umkleide-handtuchspender', 90, { wallId: wRC.id }), { right: HALL_X1, cy: 2100 });

  /* Zonen */
  b.zone(1000, IY0, 2325, 787, 'Freihantel', 'Trainingsfläche Freihantel');
  b.zone(2320, IY0, HALL_X1, 787, 'Functional', 'Functional/Stretching');
  b.zone(1000, b.boxOf(rowA1).minY - 30, HALL_X1, b.boxOf(rowA2).maxY + 30, 'Maschinen', 'Maschinen');
  b.zone(1000, b.boxOf(rowP).minY - 30, HALL_X1, b.boxOf(rowP).maxY + 30, 'Plate Loaded', 'Maschinen');
  b.zone(1000, b.boxOf(cardio).minY - 40, HALL_X1, IY1, 'Cardio', 'Cardio');

  /* Ausstattung Halle: Wandobjekte in den Gängen, Säulen im Raster */
  b.put(S('gen-ausstattung-feuerloescher', 270, { wallId: wCol.id }), { left: HALL_X0, cy: 1300 });
  b.put(S('gen-ausstattung-erste-hilfe', 270, { wallId: wCol.id }), { left: HALL_X0, cy: 1350 });
  b.put(S('gen-ausstattung-feuerloescher', 90, { wallId: wRC.id }), { right: HALL_X1, cy: 1300 });
  b.put(S('gen-ausstattung-feuerloescher', 270, { wallId: wCol.id }), { left: HALL_X0, cy: 2250 });
  b.put(S('gen-ausstattung-desinfektionsstation'), { left: HALL_X0, cy: 1480 });
  b.put(S('gen-ausstattung-wasserspender'), { left: HALL_X0, cy: 1560 });
  b.put(S('gen-ausstattung-muelleimer'), { left: HALL_X0, cy: 1620 });
  b.put(S('gen-ausstattung-tv-65', 270, { wallId: wCol.id }), { left: HALL_X0, cy: 2150 });
  b.put(S('gen-ausstattung-tv-65', 270, { wallId: wCol.id }), { left: HALL_X0, cy: 2350 });
  b.put(S('gen-ausstattung-lautsprecher', 270, { wallId: wCol.id }), { left: HALL_X0, cy: 700 });
  b.put(S('gen-ausstattung-lautsprecher', 90, { wallId: wRC.id }), { right: HALL_X1, cy: 1000 });
  b.put(S('gen-ausstattung-lautsprecher', 180, { wallId: bottom.id }), { cx: 2900, bottom: IY1 });
  b.put(S('gen-ausstattung-kamera', 270, { wallId: wCol.id }), { left: HALL_X0, cy: 250 });
  b.put(S('gen-ausstattung-kamera', 90, { wallId: wRC.id }), { right: HALL_X1, cy: 2400 });
  b.put(S('gen-ausstattung-notausgang-schild', 0, { wallId: top.id }), { cx: 2830, top: IY0 });
  b.put(S('gen-bau-saeule-rund-50'), { cx: 2280, cy: 850 });
  b.put(S('gen-bau-saeule-rund-50'), { cx: 2280, cy: 1570 });

  return project;
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'beispiel-1000',
    name: 'Beispielstudio 1.000 m²',
    description: '40 × 25 m: vollständig eingerichtetes Muster-Studio – Empfang, Umkleiden mit Duschen/WC, Freihantel mit Racks und Spiegelwand, Prime-Hybrid-Maschinen, Plate-Loaded, Cardio am Fensterband, Functional, Kursraum, Wellness, Lager/Technik',
    create: createExampleStudio,
  },
  {
    id: 'empty-20x25',
    name: 'Leere Halle 20 × 25 m',
    description: '500 m² Rechteckhalle (25 × 20 m), Deckenhöhe 4 m, Außenwand 24 cm – ohne Einrichtung',
    create: createEmptyHall,
  },
  {
    id: 'studio-400',
    name: 'Kleines Studio 400 m²',
    description: '25 × 16 m: Empfang, Büro/Lager, Umkleiden mit Duschen/WC, Cardio, Maschinen (Prime Hybrid, Atlantis Precision), Freihantel mit Power Rack, Functional',
    create: createSmallStudio,
  },
  {
    id: 'studio-800',
    name: 'Mittleres Studio 800 m²',
    description: '40 × 20 m: zusätzlich Kursraum und Wellness (Sauna, Ruheliegen, Erlebnisdusche), 15 Cardio-Geräte, zwei Racks, Plattform, Functional Trainer',
    create: createMediumStudio,
  },
];

/** Vorlage per ID (undefined, wenn unbekannt). */
export function getTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Vorlage, die beim allerersten Start geladen wird. */
export const DEFAULT_TEMPLATE_ID = 'beispiel-1000';
/** Leere Halle (Fallback, z. B. für Persistenz-Tests). */
export const EMPTY_TEMPLATE_ID = 'empty-20x25';
export function defaultTemplate(): ProjectTemplate {
  return getTemplate(DEFAULT_TEMPLATE_ID) ?? getTemplate(EMPTY_TEMPLATE_ID) ?? TEMPLATES[0];
}
