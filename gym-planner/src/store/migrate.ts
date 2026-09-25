/**
 * Validierung und Migration von Projektdaten (Import, Laden aus IndexedDB, Versionsverlauf).
 *
 * validateProject(unknown) prüft die Struktur aller Pflichtfelder ohne externe Bibliothek und liefert
 * deutsche Fehlermeldungen mit Pfadangabe. Fehlende, aber ergänzbare Felder (settings, layers, favorites …)
 * sind kein Fehler – migrateProject() füllt sie mit den Defaults aus factories.ts auf.
 * Unbekannte Geräte-IDs (defId) sind erlaubt und werden als Warnung gemeldet.
 */
import type {
  Project, Floor, Wall, Zone, Opening, PlacedItem, Group, VoidArea, Annotation, RoomMeta, Vec2, Hall,
  EquipmentDef, SafetyZone, ProjectSettings, LayerVisibility,
} from '@/types';
import { SCHEMA_VERSION, DEFAULT_SETTINGS, DEFAULT_LAYERS, DEFAULT_CEILING_HEIGHT, DEFAULT_OUTER_WALL_THICKNESS } from './factories';
import { getDef } from '@/data/equipment';

export interface ValidationOk {
  ok: true;
  project: Project;
  /** Hinweise, die den Import nicht verhindern (z. B. unbekannte Geräte-IDs). */
  warnings: string[];
}
export interface ValidationFail {
  ok: false;
  errors: string[];
  warnings: string[];
}
export type ValidationResult = ValidationOk | ValidationFail;

const MAX_ERRORS = 40;

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isVec2(v: unknown): v is Vec2 {
  return isRec(v) && isNum(v.x) && isNum(v.y);
}
function isPolygon(v: unknown, minPoints = 3): v is Vec2[] {
  return Array.isArray(v) && v.length >= minPoints && v.every(isVec2);
}
function isSafetyZone(v: unknown): v is SafetyZone {
  return isRec(v) && isNum(v.vorne) && isNum(v.hinten) && isNum(v.links) && isNum(v.rechts);
}

class Collector {
  errors: string[] = [];
  warnings: string[] = [];
  error(path: string, msg: string) {
    if (this.errors.length < MAX_ERRORS) this.errors.push(`${path}: ${msg}`);
    else if (this.errors.length === MAX_ERRORS) this.errors.push('… weitere Fehler ausgelassen');
  }
  warn(msg: string) {
    if (!this.warnings.includes(msg)) this.warnings.push(msg);
  }
}

function checkId(c: Collector, obj: Rec, path: string): boolean {
  if (!isStr(obj.id) || obj.id.length === 0) {
    c.error(`${path}.id`, 'ID fehlt oder ist keine Zeichenkette');
    return false;
  }
  return true;
}

function checkOptionalBool(c: Collector, obj: Rec, key: string, path: string) {
  if (obj[key] !== undefined && typeof obj[key] !== 'boolean') c.error(`${path}.${key}`, 'Wahrheitswert erwartet');
}

function checkWall(c: Collector, w: unknown, path: string) {
  if (!isRec(w)) { c.error(path, 'Wand muss ein Objekt sein'); return; }
  checkId(c, w, path);
  if (!isVec2(w.start)) c.error(`${path}.start`, 'Punkt {x, y} erwartet');
  if (!isVec2(w.end)) c.error(`${path}.end`, 'Punkt {x, y} erwartet');
  if (!isNum(w.thickness) || w.thickness <= 0) c.error(`${path}.thickness`, 'positive Wandstärke in cm erwartet');
  if (w.type !== undefined && !isStr(w.type)) c.error(`${path}.type`, 'Wandtyp muss eine Zeichenkette sein');
  if (w.height !== undefined && w.height !== null && !isNum(w.height)) c.error(`${path}.height`, 'Höhe in cm oder null erwartet');
  checkOptionalBool(c, w, 'locked', path);
  checkOptionalBool(c, w, 'hidden', path);
}

function checkRoomMeta(c: Collector, m: unknown, path: string) {
  if (!isRec(m)) { c.error(path, 'Raum-Metadaten müssen ein Objekt sein'); return; }
  if (!isStr(m.name)) c.error(`${path}.name`, 'Name fehlt');
  if (!isStr(m.type)) c.error(`${path}.type`, 'Raumtyp fehlt');
  if (m.color !== undefined && !isStr(m.color)) c.error(`${path}.color`, 'Farbe muss eine Zeichenkette sein');
}

function checkZone(c: Collector, z: unknown, path: string) {
  if (!isRec(z)) { c.error(path, 'Zone muss ein Objekt sein'); return; }
  checkId(c, z, path);
  if (!isPolygon(z.polygon)) c.error(`${path}.polygon`, 'Polygon mit mindestens 3 Punkten erwartet');
  checkRoomMeta(c, z, path);
}

function checkOpening(c: Collector, o: unknown, path: string) {
  if (!isRec(o)) { c.error(path, 'Öffnung muss ein Objekt sein'); return; }
  checkId(c, o, path);
  if (!isStr(o.wallId)) c.error(`${path}.wallId`, 'Wand-ID fehlt');
  if (!isNum(o.offset)) c.error(`${path}.offset`, 'Abstand ab Wandanfang (cm) erwartet');
  if (!isNum(o.width) || o.width <= 0) c.error(`${path}.width`, 'positive Breite in cm erwartet');
  switch (o.kind) {
    case 'door':
      if (!isStr(o.doorType)) c.error(`${path}.doorType`, 'Türtyp fehlt');
      if (!isNum(o.height)) c.error(`${path}.height`, 'Höhe in cm erwartet');
      if (o.hinge !== 'left' && o.hinge !== 'right') c.error(`${path}.hinge`, '„left“ oder „right“ erwartet');
      if (o.swingSide !== 'a' && o.swingSide !== 'b') c.error(`${path}.swingSide`, '„a“ oder „b“ erwartet');
      break;
    case 'window':
      if (!isNum(o.height)) c.error(`${path}.height`, 'Höhe in cm erwartet');
      if (!isNum(o.sillHeight)) c.error(`${path}.sillHeight`, 'Brüstungshöhe in cm erwartet');
      break;
    case 'mirror':
      if (!isNum(o.height)) c.error(`${path}.height`, 'Höhe in cm erwartet');
      if (o.side !== 'a' && o.side !== 'b') c.error(`${path}.side`, '„a“ oder „b“ erwartet');
      break;
    default:
      c.error(`${path}.kind`, 'Art muss „door“, „window“ oder „mirror“ sein');
  }
}

const ITEM_KINDS = new Set(['equipment', 'stairs', 'elevator', 'column', 'radiator', 'vent', 'ramp']);

function checkItem(c: Collector, it: unknown, path: string) {
  if (!isRec(it)) { c.error(path, 'Objekt muss ein Objekt sein'); return; }
  checkId(c, it, path);
  if (!isStr(it.defId) || !it.defId) c.error(`${path}.defId`, 'Bibliotheks-ID (defId) fehlt');
  if (it.kind !== undefined && (!isStr(it.kind) || !ITEM_KINDS.has(it.kind))) c.error(`${path}.kind`, 'unbekannte Objektart');
  for (const k of ['x', 'y', 'rotation', 'width', 'depth'] as const) {
    if (!isNum(it[k])) c.error(`${path}.${k}`, 'Zahl erwartet');
  }
  if (isNum(it.width) && it.width <= 0) c.error(`${path}.width`, 'Breite muss größer 0 sein');
  if (isNum(it.depth) && it.depth <= 0) c.error(`${path}.depth`, 'Tiefe muss größer 0 sein');
  if (it.height !== undefined && it.height !== null && !isNum(it.height)) c.error(`${path}.height`, 'Höhe in cm oder null erwartet');
  if (it.safetyZone !== undefined && !isSafetyZone(it.safetyZone)) c.error(`${path}.safetyZone`, 'Sicherheitszone {vorne, hinten, links, rechts} erwartet');
  checkOptionalBool(c, it, 'safetyZoneEnabled', path);
  checkOptionalBool(c, it, 'locked', path);
  checkOptionalBool(c, it, 'hidden', path);
  if (it.priceEur !== undefined && !isNum(it.priceEur)) c.error(`${path}.priceEur`, 'Preis muss eine Zahl sein');
  if (it.linkedFloorIds !== undefined && !(Array.isArray(it.linkedFloorIds) && it.linkedFloorIds.every(isStr))) c.error(`${path}.linkedFloorIds`, 'Liste von Stockwerk-IDs erwartet');
}

function checkGroup(c: Collector, g: unknown, path: string) {
  if (!isRec(g)) { c.error(path, 'Gruppe muss ein Objekt sein'); return; }
  checkId(c, g, path);
  if (!(Array.isArray(g.itemIds) && g.itemIds.every(isStr))) c.error(`${path}.itemIds`, 'Liste von Objekt-IDs erwartet');
}

function checkVoid(c: Collector, v: unknown, path: string) {
  if (!isRec(v)) { c.error(path, 'Luftraum muss ein Objekt sein'); return; }
  checkId(c, v, path);
  if (!isPolygon(v.polygon)) c.error(`${path}.polygon`, 'Polygon mit mindestens 3 Punkten erwartet');
}

function checkAnnotation(c: Collector, a: unknown, path: string) {
  if (!isRec(a)) { c.error(path, 'Anmerkung muss ein Objekt sein'); return; }
  checkId(c, a, path);
  if (a.kind === 'text') {
    if (!isNum(a.x) || !isNum(a.y)) c.error(`${path}.x/y`, 'Position erwartet');
    if (!isStr(a.text)) c.error(`${path}.text`, 'Text fehlt');
    if (!isNum(a.fontSize) || a.fontSize <= 0) c.error(`${path}.fontSize`, 'positive Schriftgröße erwartet');
    if (a.rotation !== undefined && !isNum(a.rotation)) c.error(`${path}.rotation`, 'Zahl erwartet');
  } else if (a.kind === 'measure') {
    if (!isVec2(a.start)) c.error(`${path}.start`, 'Punkt {x, y} erwartet');
    if (!isVec2(a.end)) c.error(`${path}.end`, 'Punkt {x, y} erwartet');
  } else {
    c.error(`${path}.kind`, 'Art muss „text“ oder „measure“ sein');
  }
}

function checkHall(c: Collector, h: unknown, path: string) {
  if (h === null || h === undefined) return;
  if (!isRec(h)) { c.error(path, 'Halle muss ein Objekt oder null sein'); return; }
  if (!isPolygon(h.polygon)) c.error(`${path}.polygon`, 'Polygon mit mindestens 3 Punkten erwartet');
  if (h.wallThickness !== undefined && (!isNum(h.wallThickness) || h.wallThickness < 0)) c.error(`${path}.wallThickness`, 'Wandstärke in cm erwartet');
  if (h.floorCovering !== undefined && !isStr(h.floorCovering)) c.error(`${path}.floorCovering`, 'Bodenbelag muss eine Zeichenkette sein');
}

function checkList(c: Collector, obj: Rec, key: string, path: string, fn: (c: Collector, v: unknown, p: string) => void) {
  const list = obj[key];
  if (list === undefined) return;
  if (!Array.isArray(list)) { c.error(`${path}.${key}`, 'Liste erwartet'); return; }
  list.forEach((v, i) => fn(c, v, `${path}.${key}[${i}]`));
}

function checkFloor(c: Collector, f: unknown, path: string) {
  if (!isRec(f)) { c.error(path, 'Stockwerk muss ein Objekt sein'); return; }
  checkId(c, f, path);
  if (!isStr(f.name)) c.error(`${path}.name`, 'Name fehlt');
  if (f.order !== undefined && !isNum(f.order)) c.error(`${path}.order`, 'Zahl erwartet');
  if (f.ceilingHeight !== undefined && (!isNum(f.ceilingHeight) || f.ceilingHeight <= 0)) c.error(`${path}.ceilingHeight`, 'positive Deckenhöhe erwartet');
  checkHall(c, f.hall, `${path}.hall`);
  checkList(c, f, 'walls', path, checkWall);
  checkList(c, f, 'zones', path, checkZone);
  checkList(c, f, 'openings', path, checkOpening);
  checkList(c, f, 'items', path, checkItem);
  checkList(c, f, 'groups', path, checkGroup);
  checkList(c, f, 'voids', path, checkVoid);
  checkList(c, f, 'annotations', path, checkAnnotation);
  if (f.roomMeta !== undefined) {
    if (!isRec(f.roomMeta)) c.error(`${path}.roomMeta`, 'Objekt erwartet');
    else for (const [k, m] of Object.entries(f.roomMeta)) checkRoomMeta(c, m, `${path}.roomMeta[${k}]`);
  }
}

function checkCustomEquipment(c: Collector, d: unknown, path: string) {
  if (!isRec(d)) { c.error(path, 'Gerät muss ein Objekt sein'); return; }
  checkId(c, d, path);
  if (!isStr(d.name)) c.error(`${path}.name`, 'Name fehlt');
  if (!isNum(d.breite_cm) || d.breite_cm <= 0) c.error(`${path}.breite_cm`, 'positive Breite erwartet');
  if (!isNum(d.tiefe_cm) || d.tiefe_cm <= 0) c.error(`${path}.tiefe_cm`, 'positive Tiefe erwartet');
  if (d.hoehe_cm !== undefined && d.hoehe_cm !== null && !isNum(d.hoehe_cm)) c.error(`${path}.hoehe_cm`, 'Höhe oder null erwartet');
  if (d.gewicht_kg !== undefined && d.gewicht_kg !== null && !isNum(d.gewicht_kg)) c.error(`${path}.gewicht_kg`, 'Gewicht oder null erwartet');
  if (d.sicherheitszone_cm !== undefined && !isSafetyZone(d.sicherheitszone_cm)) c.error(`${path}.sicherheitszone_cm`, 'Sicherheitszone erwartet');
  if (d.preis_eur !== undefined && !isNum(d.preis_eur)) c.error(`${path}.preis_eur`, 'Preis muss eine Zahl sein');
}

/**
 * Strukturelle Prüfung eines unbekannten Werts als Projekt.
 * Liefert bei Erfolg das (noch nicht migrierte) Projekt sowie Warnungen zu unbekannten Geräte-IDs.
 */
export function validateProject(input: unknown): ValidationResult {
  const c = new Collector();
  if (!isRec(input)) return { ok: false, errors: ['Projekt: Objekt erwartet'], warnings: [] };
  const p = input;
  const path = 'project';
  checkId(c, p, path);
  if (!isStr(p.name)) c.error(`${path}.name`, 'Projektname fehlt');
  if (p.schemaVersion !== undefined && !isNum(p.schemaVersion)) c.error(`${path}.schemaVersion`, 'Zahl erwartet');
  if (isNum(p.schemaVersion) && p.schemaVersion > SCHEMA_VERSION) c.warn(`Das Projekt stammt aus einer neueren Programmversion (Schema ${p.schemaVersion}, unterstützt: ${SCHEMA_VERSION}). Unbekannte Felder bleiben erhalten.`);
  if (p.createdAt !== undefined && !isStr(p.createdAt)) c.error(`${path}.createdAt`, 'Datum (ISO-String) erwartet');
  if (p.updatedAt !== undefined && !isStr(p.updatedAt)) c.error(`${path}.updatedAt`, 'Datum (ISO-String) erwartet');
  if (p.parentId !== undefined && !isStr(p.parentId)) c.error(`${path}.parentId`, 'ID erwartet');
  if (p.variantName !== undefined && !isStr(p.variantName)) c.error(`${path}.variantName`, 'Zeichenkette erwartet');
  if (p.activeFloorId !== undefined && !isStr(p.activeFloorId)) c.error(`${path}.activeFloorId`, 'ID erwartet');
  if (!Array.isArray(p.floors)) c.error(`${path}.floors`, 'Liste der Stockwerke fehlt');
  else if (p.floors.length === 0) c.error(`${path}.floors`, 'mindestens ein Stockwerk erforderlich');
  else p.floors.forEach((f, i) => checkFloor(c, f, `${path}.floors[${i}]`));
  if (p.settings !== undefined && !isRec(p.settings)) c.error(`${path}.settings`, 'Objekt erwartet');
  if (p.layers !== undefined && !isRec(p.layers)) c.error(`${path}.layers`, 'Objekt erwartet');
  if (p.favorites !== undefined && !(Array.isArray(p.favorites) && p.favorites.every(isStr))) c.error(`${path}.favorites`, 'Liste von IDs erwartet');
  if (p.priceOverrides !== undefined && !isRec(p.priceOverrides)) c.error(`${path}.priceOverrides`, 'Objekt erwartet');
  checkList(c, p, 'customEquipment', path, checkCustomEquipment);

  if (c.errors.length) return { ok: false, errors: c.errors, warnings: c.warnings };

  // Doppelte Stockwerk-IDs
  const floors = p.floors as Rec[];
  const seen = new Set<string>();
  for (const f of floors) {
    const id = f.id as string;
    if (seen.has(id)) c.error(`${path}.floors`, `Stockwerk-ID „${id}“ ist doppelt`);
    seen.add(id);
  }
  if (c.errors.length) return { ok: false, errors: c.errors, warnings: c.warnings };

  // Unbekannte Geräte-IDs sind erlaubt → Warnung
  const custom = Array.isArray(p.customEquipment) ? (p.customEquipment as EquipmentDef[]) : [];
  for (const f of floors) {
    const items = Array.isArray(f.items) ? (f.items as Rec[]) : [];
    for (const it of items) {
      const defId = it.defId as string;
      if (!getDef(defId, { customEquipment: custom })) {
        c.warn(`Unbekannte Geräte-ID „${defId}“ (Stockwerk „${String(f.name)}“) – das Objekt wird mit den gespeicherten Maßen übernommen.`);
      }
    }
  }
  return { ok: true, project: p as unknown as Project, warnings: c.warnings };
}

/* ------------------------------------------------------------------ */
/* Migration                                                           */
/* ------------------------------------------------------------------ */

function fillFloor(f: Partial<Floor> & Pick<Floor, 'id' | 'name'>, index: number): Floor {
  const hallIn = f.hall as Partial<Hall> | null | undefined;
  const hall: Hall | null = hallIn
    ? {
        polygon: (hallIn.polygon ?? []).map((v) => ({ x: v.x, y: v.y })),
        wallThickness: isNum(hallIn.wallThickness) ? hallIn.wallThickness : DEFAULT_OUTER_WALL_THICKNESS,
        floorCovering: isStr(hallIn.floorCovering) ? hallIn.floorCovering : 'Gummiboden',
      }
    : null;
  const walls: Wall[] = (f.walls ?? []).map((w) => ({
    ...w,
    type: w.type ?? 'Trockenbau',
    height: w.height === undefined ? null : w.height,
  }));
  const items: PlacedItem[] = (f.items ?? []).map((it) => {
    const def = it.defId ? getDef(it.defId) : undefined;
    return {
      ...it,
      kind: it.kind ?? 'equipment',
      height: it.height === undefined ? (def?.hoehe_cm ?? null) : it.height,
      safetyZone: it.safetyZone ?? (def ? { ...def.sicherheitszone_cm } : { vorne: 0, hinten: 0, links: 0, rechts: 0 }),
      safetyZoneEnabled: typeof it.safetyZoneEnabled === 'boolean' ? it.safetyZoneEnabled : true,
    };
  });
  const roomMeta: Record<string, RoomMeta> = {};
  for (const [k, m] of Object.entries(f.roomMeta ?? {})) roomMeta[k] = { ...m };
  return {
    id: f.id,
    name: f.name,
    order: isNum(f.order) ? f.order : index,
    ceilingHeight: isNum(f.ceilingHeight) ? f.ceilingHeight : DEFAULT_CEILING_HEIGHT,
    hall,
    walls,
    zones: (f.zones ?? []) as Zone[],
    roomMeta,
    openings: (f.openings ?? []) as Opening[],
    items,
    groups: (f.groups ?? []) as Group[],
    voids: (f.voids ?? []) as VoidArea[],
    annotations: (f.annotations ?? []) as Annotation[],
  };
}

function fillCustomEquipment(d: Partial<EquipmentDef> & Pick<EquipmentDef, 'id' | 'name' | 'breite_cm' | 'tiefe_cm'>): EquipmentDef {
  return {
    kategorie: 'Eigene',
    unterkategorie: '',
    hersteller: 'Generisch',
    hoehe_cm: null,
    sicherheitszone_cm: { vorne: 0, hinten: 0, links: 0, rechts: 0 },
    form: 'rechteck',
    skalierbar: true,
    verifiziert: false,
    bereich: 'Eigene',
    symbol: 'generic',
    benutzerdefiniert: true,
    ...d,
  };
}

/** Prüft, ob ein Projekt alle Felder der aktuellen Schema-Version besitzt. */
function isComplete(p: Project): boolean {
  if (!isNum(p.schemaVersion) || p.schemaVersion < SCHEMA_VERSION) return false;
  if (!isRec(p.settings) || !isRec(p.layers) || !Array.isArray(p.favorites) || !isRec(p.priceOverrides) || !Array.isArray(p.customEquipment)) return false;
  if (!isStr(p.createdAt) || !isStr(p.updatedAt) || !isStr(p.activeFloorId)) return false;
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof ProjectSettings)[]) if (p.settings[k] === undefined) return false;
  for (const k of Object.keys(DEFAULT_LAYERS) as (keyof LayerVisibility)[]) if (p.layers[k] === undefined) return false;
  if (!p.floors.some((f) => f.id === p.activeFloorId)) return false;
  for (const f of p.floors) {
    if (!Array.isArray(f.walls) || !Array.isArray(f.zones) || !Array.isArray(f.openings) || !Array.isArray(f.items)) return false;
    if (!Array.isArray(f.groups) || !Array.isArray(f.voids) || !Array.isArray(f.annotations) || !isRec(f.roomMeta)) return false;
    if (!isNum(f.order) || !isNum(f.ceilingHeight)) return false;
    for (const it of f.items) if (!isSafetyZone(it.safetyZone) || typeof it.safetyZoneEnabled !== 'boolean' || it.height === undefined) return false;
  }
  return true;
}

/**
 * Ergänzt fehlende Felder älterer Schema-Versionen mit Defaults und hebt schemaVersion an.
 * Ein bereits vollständiges Projekt wird unverändert (gleiche Referenz) zurückgegeben.
 */
export function migrateProject(input: Project): Project {
  if (isComplete(input)) return input;
  const p = input as Partial<Project> & Pick<Project, 'id' | 'name' | 'floors'>;
  const now = new Date().toISOString();
  const floors = p.floors.map((f, i) => fillFloor(f, i));
  const activeFloorId = floors.some((f) => f.id === p.activeFloorId) ? (p.activeFloorId as string) : floors[0].id;
  const out: Project = {
    ...(p as Project),
    schemaVersion: SCHEMA_VERSION,
    createdAt: isStr(p.createdAt) ? p.createdAt : now,
    updatedAt: isStr(p.updatedAt) ? p.updatedAt : now,
    settings: { ...DEFAULT_SETTINGS, ...(isRec(p.settings) ? p.settings : {}) },
    layers: { ...DEFAULT_LAYERS, ...(isRec(p.layers) ? p.layers : {}) },
    floors,
    activeFloorId,
    customEquipment: (Array.isArray(p.customEquipment) ? p.customEquipment : []).map(fillCustomEquipment),
    favorites: Array.isArray(p.favorites) ? [...p.favorites] : [],
    priceOverrides: isRec(p.priceOverrides) ? { ...(p.priceOverrides as Record<string, number>) } : {},
  };
  if (out.parentId === undefined) delete out.parentId;
  if (out.variantName === undefined) delete out.variantName;
  return out;
}

/** Bequemer Kombinationsaufruf: validieren und migrieren. */
export function validateAndMigrate(input: unknown): ValidationResult {
  const r = validateProject(input);
  if (!r.ok) return r;
  return { ok: true, project: migrateProject(r.project), warnings: r.warnings };
}
