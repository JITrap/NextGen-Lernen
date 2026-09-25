/** Test-Helfer für die Analyse-Tests (kein Produktionscode). */
import type { Project, Floor, EquipmentDef, PlacedItem, Zone, RoomType } from '@/types';
import { createEmptyProject, createHall, createZone, createItemFromDef, createFloor, cloneDeep } from '@/store/factories';
import { rectPolygon } from '@/geometry/polygon';

export function makeDef(partial: Partial<EquipmentDef> & { id: string }): EquipmentDef {
  return {
    kategorie: 'Test',
    unterkategorie: 'Test',
    hersteller: 'Generisch',
    name: partial.id,
    breite_cm: 100,
    tiefe_cm: 100,
    hoehe_cm: 100,
    gewicht_kg: null,
    sicherheitszone_cm: { vorne: 0, hinten: 0, links: 0, rechts: 0 },
    form: 'rechteck',
    skalierbar: false,
    verifiziert: true,
    bereich: 'Eigene',
    symbol: 'generic',
    ...partial,
  };
}

/** Projekt mit einer Halle (Außenmaß w × d cm, Ursprung 0/0) auf dem ersten Stockwerk. */
export function projectWithHall(wCm: number, dCm: number, wallThickness = 24, name = 'Test'): Project {
  const p = createEmptyProject(name);
  p.floors[0].hall = createHall(wCm, dCm, { wallThickness });
  return p;
}

export function firstFloor(p: Project): Floor {
  return p.floors[0];
}

export function addFloor(p: Project, partial: Partial<Floor> = {}): Floor {
  const f = createFloor({ name: `OG ${p.floors.length}`, order: p.floors.length, ...partial });
  p.floors.push(f);
  return f;
}

export function addCustomDef(p: Project, def: EquipmentDef): EquipmentDef {
  p.customEquipment.push({ ...def, benutzerdefiniert: true });
  return def;
}

export function place(floor: Floor, def: EquipmentDef, x: number, y: number, partial: Partial<PlacedItem> = {}): PlacedItem {
  const it = createItemFromDef(def, x, y, partial);
  floor.items.push(it);
  return it;
}

export function addZone(floor: Floor, x0: number, y0: number, x1: number, y1: number, type: RoomType, name: string = type): Zone {
  const z = createZone({ polygon: rectPolygon({ x: x0, y: y0 }, { x: x1, y: y1 }), type, name });
  floor.zones.push(z);
  return z;
}

/**
 * Tiefe Kopie für einen erneuten Analyse-Lauf nach In-place-Änderungen: die Analyse (und die Geometrie-Indizes
 * in geometry/spatialHash) cachen an Objekt-/Array-Identität – im Store erzeugt Immer bei jeder Änderung neue Objekte.
 */
export function fresh(p: Project): Project {
  return cloneDeep(p);
}
