import { describe, it, expect } from 'vitest';
import type { Door, Floor, PlacedItem, Project } from '@/types';
import { TEMPLATES, getTemplate } from './templates';
import { getDef } from '@/data/equipment';
import { polygonAreaM2, pointInPolygon } from '@/geometry/polygon';
import { allWalls, findWall, hallInnerPolygon, hallOuterPolygon, wallLength } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { findCollisions, itemInsideHall, itemsInDoorSwing, emergencyExitBlocked } from '@/geometry/collision';
import { itemFootprint, itemSafetyPolygon, zoneIsEmpty } from '@/geometry/transform';
import { warnings } from '@/analysis';

const EXPECTED_AREAS: Record<string, number> = { 'empty-20x25': 500, 'studio-400': 400, 'studio-800': 800 };

function firstFloor(p: Project): Floor {
  const f = p.floors.find((x) => x.id === p.activeFloorId) ?? p.floors[0];
  expect(f).toBeDefined();
  return f;
}

function label(it: PlacedItem, p: Project): string {
  const d = getDef(it.defId, p);
  return `${it.label ?? d?.name ?? it.defId} [${it.defId}] @ (${it.x}, ${it.y}) ${it.width}×${it.depth} rot ${it.rotation}`;
}

describe('Projekt-Vorlagen', () => {
  it('es gibt genau die drei Vorlagen mit eindeutigen IDs und deutschen Namen', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['empty-20x25', 'studio-400', 'studio-800']);
    expect(TEMPLATES.map((t) => t.name)).toEqual(['Leere Halle 20 × 25 m', 'Kleines Studio 400 m²', 'Mittleres Studio 800 m²']);
    for (const t of TEMPLATES) expect(t.description.length).toBeGreaterThan(10);
    expect(getTemplate('studio-400')?.name).toBe('Kleines Studio 400 m²');
    expect(getTemplate('nope')).toBeUndefined();
  });

  for (const t of TEMPLATES) {
    describe(t.name, () => {
      const p = t.create();
      const floor = firstFloor(p);
      const walls = allWalls(floor);
      const inner = floor.hall ? hallInnerPolygon(floor.hall) : [];

      it('erzeugt ein vollständiges Projekt mit Halle', () => {
        expect(p.name).toBe(t.name);
        expect(p.floors.length).toBe(1);
        expect(p.activeFloorId).toBe(floor.id);
        expect(floor.hall).not.toBeNull();
        expect(floor.hall!.wallThickness).toBe(24);
        expect(floor.ceilingHeight).toBe(400);
        expect(p.customEquipment).toEqual([]);
        expect(p.settings.gridSize).toBe(10);
      });

      it('Name ist überschreibbar', () => {
        expect(t.create('Mein Studio').name).toBe('Mein Studio');
      });

      it(`Hallenfläche = ${EXPECTED_AREAS[t.id]} m²`, () => {
        expect(polygonAreaM2(floor.hall!.polygon)).toBeCloseTo(EXPECTED_AREAS[t.id], 6);
        expect(polygonAreaM2(hallOuterPolygon(floor.hall!))).toBeCloseTo(EXPECTED_AREAS[t.id], 6);
      });

      it('alle defIds existieren in der Bibliothek', () => {
        for (const it of floor.items) expect(getDef(it.defId, p), it.defId).toBeDefined();
      });

      it('Objekte haben Bibliotheksmaße (außer skalierbare), Mittelpunkte auf dem 10-cm-Raster und 90°-Drehungen', () => {
        for (const it of floor.items) {
          const d = getDef(it.defId, p)!;
          if (!d.skalierbar) {
            expect([it.width, it.depth], label(it, p)).toEqual([d.breite_cm, d.tiefe_cm]);
          }
          expect(it.width, label(it, p)).toBeGreaterThan(0);
          expect(it.depth, label(it, p)).toBeGreaterThan(0);
          expect(it.x % 10, label(it, p)).toBe(0);
          expect(it.y % 10, label(it, p)).toBe(0);
          expect([0, 90, 180, 270], label(it, p)).toContain(it.rotation);
          expect(it.safetyZoneEnabled).toBe(true);
          expect(it.safetyZone).toEqual(d.sicherheitszone_cm);
          if (d.bereich === 'Bauelemente' && d.params?.kind) expect(it.kind).toBe(d.params.kind);
          else expect(it.kind).toBe('equipment');
          if (d.wandmontage) expect(it.wallId && findWall(floor, it.wallId), `${label(it, p)}: Wandmontage ohne gültige Wand`).toBeTruthy();
        }
      });

      it('keine Kollisionen (Grundflächen, Sicherheitszonen, Wände)', () => {
        const cols = findCollisions(floor.items, { includeZones: true, walls });
        const byId = new Map(floor.items.map((it) => [it.id, it]));
        const desc = cols.map((c) => {
          const a = byId.get(c.a);
          const b = byId.get(c.b);
          return `${c.kind}: ${a ? label(a, p) : c.a} ↔ ${b ? label(b, p) : c.b}`;
        });
        expect(desc).toEqual([]);
      });

      it('alle Objekte liegen innerhalb der Halle (Grundfläche, Sicherheitszone bei Nicht-Wandobjekten)', () => {
        if (!floor.hall) return;
        for (const it of floor.items) {
          expect(itemInsideHall(it, inner), label(it, p)).toBe(true);
          for (const c of itemFootprint(it)) expect(pointInPolygon(c, inner) || Math.abs(c.x) < 1e-6, label(it, p)).toBe(true);
        }
      });

      it('Öffnungen hängen an existierenden Wänden und liegen innerhalb der Wandlänge', () => {
        for (const o of floor.openings) {
          const w = findWall(floor, o.wallId);
          expect(w, `${o.kind} ${o.id} → Wand ${o.wallId}`).toBeDefined();
          expect(o.width).toBeGreaterThan(0);
          expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(-1e-6);
          expect(o.offset + o.width / 2).toBeLessThanOrEqual(wallLength(w!) + 1e-6);
        }
        const ids = [...floor.walls, ...floor.zones, ...floor.openings, ...floor.items].map((x) => x.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('kein Objekt steht in einer Tür-Schwenkfläche oder vor einem Notausgang', () => {
        const doors = floor.openings.filter((o): o is Door => o.kind === 'door');
        const byId = new Map(floor.items.map((it) => [it.id, it]));
        const hits = itemsInDoorSwing(floor.items, doors, walls).map((h) => `${label(byId.get(h.itemId)!, p)} in Tür ${h.doorId}`);
        expect(hits).toEqual([]);
        for (const d of doors.filter((x) => x.doorType === 'Notausgang')) {
          expect(emergencyExitBlocked(floor.items, d, findWall(floor, d.wallId)!), `Notausgang ${d.id} blockiert`).toBe(false);
        }
      });

      if (t.id !== 'empty-20x25') {
        it('startet mit höchstens 3 Laufweg-Warnungen (je Raum gebündelt) und genau einer Info „Maße ungeprüft“ je Stockwerk', () => {
          const list = warnings(p);
          const escape = list.filter((w) => w.kind === 'escape-route');
          expect(escape.length, escape.map((w) => w.message).join('\n')).toBeLessThanOrEqual(3);
          for (const w of escape) {
            expect(w.message).toMatch(/^Raum „.+“: /);
            expect(w.target && 'point' in w.target).toBe(true);
          }
          const unverified = list.filter((w) => w.kind === 'unverified');
          expect(unverified.length).toBe(p.floors.length);
          expect(unverified[0].severity).toBe('info');
          expect(unverified[0].floorId).toBe(floor.id);
          expect(unverified[0].message).toMatch(/^\d+ Objekte mit ungeprüften Maßen \(generische Bibliothek\): /);
          // Keine weiteren Warnungsarten ab Werk (keine Kollisionen, Türen, Notausgänge, Deckenhöhe …)
          expect(list.filter((w) => w.kind !== 'escape-route' && w.kind !== 'unverified').map((w) => w.message)).toEqual([]);
        });
      }

      it('zweimaliges create() liefert unabhängige Projekte mit neuen IDs', () => {
        const q = t.create();
        expect(q.id).not.toBe(p.id);
        expect(q.floors[0].id).not.toBe(floor.id);
        const idsA = new Set([...floor.walls, ...floor.zones, ...floor.openings, ...floor.items].map((x) => x.id));
        for (const x of [...q.floors[0].walls, ...q.floors[0].zones, ...q.floors[0].openings, ...q.floors[0].items]) {
          expect(idsA.has(x.id), x.id).toBe(false);
        }
        // Layout selbst ist deterministisch
        expect(q.floors[0].items.map((it) => [it.defId, it.x, it.y, it.rotation])).toEqual(floor.items.map((it) => [it.defId, it.x, it.y, it.rotation]));
        expect(q.floors[0].hall).toEqual(floor.hall);
        expect(Object.values(q.floors[0].roomMeta)).toEqual(Object.values(floor.roomMeta));
      });
    });
  }

  describe('Leere Halle 20 × 25 m', () => {
    it('hat keine Einrichtung, Wände, Zonen oder Öffnungen', () => {
      const f = firstFloor(getTemplate('empty-20x25')!.create());
      expect(f.items).toEqual([]);
      expect(f.walls).toEqual([]);
      expect(f.zones).toEqual([]);
      expect(f.openings).toEqual([]);
      expect(f.hall!.polygon.length).toBe(4);
      const xs = f.hall!.polygon.map((v) => v.x);
      const ys = f.hall!.polygon.map((v) => v.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBe(2500);
      expect(Math.max(...ys) - Math.min(...ys)).toBe(2000);
    });
  });

  describe('Kleines Studio 400 m²', () => {
    const p = getTemplate('studio-400')!.create();
    const f = firstFloor(p);
    const rooms = floorRooms(f);
    const autoRooms = rooms.filter((r) => r.source === 'auto');
    const zones = rooms.filter((r) => r.source === 'zone');
    const names = new Set(autoRooms.map((r) => r.name));

    it('erkennt Empfang, Büro, Umkleiden mit Duschen/WC und die Halle als Räume mit Typ', () => {
      for (const n of ['Empfang / Lounge', 'Büro / Lager', 'Umkleide Damen', 'Duschen / WC Damen', 'Umkleide Herren', 'Duschen / WC Herren', 'Trainingshalle (Verkehrsfläche)']) {
        expect(names.has(n), n).toBe(true);
      }
      expect(autoRooms.every((r) => r.type !== 'Sonstiges' && r.name !== 'Raum')).toBe(true);
      expect(autoRooms.find((r) => r.name === 'Umkleide Damen')!.type).toBe('Umkleide Damen');
      expect(autoRooms.find((r) => r.name === 'Umkleide Herren')!.type).toBe('Umkleide Herren');
      expect(autoRooms.find((r) => r.name === 'Trainingshalle (Verkehrsfläche)')!.areaM2).toBeGreaterThan(250);
      const sum = autoRooms.reduce((s, r) => s + r.areaM2, 0);
      expect(sum).toBeGreaterThan(370);
      expect(sum).toBeLessThan(400);
    });

    it('hat Zonen Freihantel/Maschinen/Cardio/Functional', () => {
      expect(new Set(zones.map((z) => z.type))).toEqual(new Set(['Trainingsfläche Freihantel', 'Maschinen', 'Cardio', 'Functional/Stretching']));
    });

    it('hat Türen inkl. Haupteingang als Notausgang an einer Hallen-Außenwand und einen zweiten Notausgang', () => {
      const doors = f.openings.filter((o): o is Door => o.kind === 'door');
      expect(doors.length).toBeGreaterThanOrEqual(7);
      const exits = doors.filter((d) => d.doorType === 'Notausgang');
      expect(exits.length).toBeGreaterThanOrEqual(2);
      expect(exits.every((d) => d.wallId.startsWith('hall_'))).toBe(true);
      expect(f.openings.some((o) => o.kind === 'window')).toBe(true);
    });

    it('ist mit 25–35 Geräten plus Ausstattung eingerichtet (Atlantis, Prime, Cardio, Spinde, Duschen, WCs, Theke, Drehkreuz)', () => {
      const defs = f.items.map((it) => getDef(it.defId, p)!);
      const equipment = defs.filter((d) => ['Kraftgeräte', 'Cardio', 'Functional', 'Freihantel-Zubehör'].includes(d.bereich));
      expect(equipment.length).toBeGreaterThanOrEqual(25);
      expect(equipment.length).toBeLessThanOrEqual(35);
      expect(defs.some((d) => d.hersteller === 'Atlantis')).toBe(true);
      expect(defs.some((d) => d.hersteller === 'Prime')).toBe(true);
      expect(defs.some((d) => d.id === 'atlantis-c513')).toBe(true);
      expect(defs.some((d) => d.symbol === 'dumbbell-rack')).toBe(true);
      expect(defs.filter((d) => d.symbol === 'bench').length).toBeGreaterThanOrEqual(2);
      const cardio = defs.filter((d) => d.bereich === 'Cardio').length;
      expect(cardio).toBeGreaterThanOrEqual(6);
      expect(cardio).toBeLessThanOrEqual(8);
      expect(defs.filter((d) => d.symbol === 'locker-row').length).toBeGreaterThanOrEqual(2);
      expect(defs.filter((d) => d.symbol === 'shower').length).toBeGreaterThanOrEqual(4);
      expect(defs.filter((d) => d.symbol === 'toilet').length).toBeGreaterThanOrEqual(2);
      expect(defs.some((d) => d.symbol === 'counter')).toBe(true);
      expect(defs.some((d) => d.symbol === 'turnstile')).toBe(true);
      expect(f.items.length).toBeGreaterThanOrEqual(60);
    });

    it('Cardio-Geräte stehen in einer Reihe mit gleicher Ausrichtung (Belegungsboxen oben bündig)', () => {
      const cardio = f.items.filter((it) => getDef(it.defId, p)!.bereich === 'Cardio');
      expect(cardio.length).toBeGreaterThanOrEqual(6);
      expect(new Set(cardio.map((it) => it.rotation)).size).toBe(1);
      const tops = cardio.map((it) => {
        const poly = zoneIsEmpty(it.safetyZone) ? itemFootprint(it) : itemSafetyPolygon(it, it.safetyZone);
        return Math.min(...poly.map((v) => v.y));
      });
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(10);
      // Laufbänder: Sturzraum 200 cm zeigt in die Halle (nach unten), nicht in die Wand
      for (const it of cardio.filter((x) => x.defId === 'gen-cardio-laufband')) {
        const zone = itemSafetyPolygon(it, it.safetyZone);
        expect(Math.max(...zone.map((v) => v.y)) - (it.y + it.depth / 2)).toBeCloseTo(200, 6);
      }
    });
  });

  describe('Mittleres Studio 800 m²', () => {
    const p = getTemplate('studio-800')!.create();
    const f = firstFloor(p);
    const rooms = floorRooms(f);
    const autoRooms = rooms.filter((r) => r.source === 'auto');

    it('hat zusätzlich Kursraum und Wellness als Räume', () => {
      const byName = new Map(autoRooms.map((r) => [r.name, r]));
      expect(byName.get('Kursraum')?.type).toBe('Kursraum');
      expect(byName.get('Wellness')?.type).toBe('Wellness/Sauna');
      expect(byName.get('Lager / Technik')?.type).toBe('Lager');
      expect(autoRooms.every((r) => r.type !== 'Sonstiges')).toBe(true);
      expect(autoRooms.length).toBe(10);
    });

    it('ist mit 50–70 Geräten, 12–15 Cardio-Geräten, zwei Racks, Plattform und Functional Trainer eingerichtet', () => {
      const defs = f.items.map((it) => getDef(it.defId, p)!);
      const equipment = defs.filter((d) => ['Kraftgeräte', 'Cardio', 'Functional', 'Freihantel-Zubehör'].includes(d.bereich));
      expect(equipment.length).toBeGreaterThanOrEqual(50);
      expect(equipment.length).toBeLessThanOrEqual(70);
      const cardio = defs.filter((d) => d.bereich === 'Cardio').length;
      expect(cardio).toBeGreaterThanOrEqual(12);
      expect(cardio).toBeLessThanOrEqual(15);
      expect(defs.filter((d) => d.symbol === 'rack').length).toBeGreaterThanOrEqual(2);
      expect(defs.some((d) => d.symbol === 'platform')).toBe(true);
      expect(defs.some((d) => d.symbol === 'cable')).toBe(true);
      expect(defs.some((d) => d.symbol === 'smith')).toBe(true);
      expect(defs.some((d) => d.symbol === 'sauna')).toBe(true);
      expect(defs.filter((d) => d.symbol === 'lounger').length).toBeGreaterThanOrEqual(2);
      expect(defs.some((d) => d.symbol === 'shower-experience')).toBe(true);
      expect(defs.some((d) => d.symbol === 'plunge')).toBe(true);
      expect(defs.some((d) => d.symbol === 'rig')).toBe(true);
      expect(defs.some((d) => d.symbol === 'podium')).toBe(true);
      expect(defs.filter((d) => d.symbol === 'spin-bike').length).toBeGreaterThanOrEqual(6);
      expect(defs.filter((d) => d.symbol === 'column-round').length).toBe(2);
      expect(f.items.filter((it) => it.kind === 'column').length).toBe(2);
    });

    it('Wellness-Objekte liegen im Wellness-Raum, Kursraum-Objekte im Kursraum', () => {
      const wellness = autoRooms.find((r) => r.name === 'Wellness')!;
      const kurs = autoRooms.find((r) => r.name === 'Kursraum')!;
      for (const it of f.items) {
        const d = getDef(it.defId, p)!;
        if (d.bereich === 'Wellness') expect(pointInPolygon({ x: it.x, y: it.y }, wellness.polygon), label(it, p)).toBe(true);
        if (d.bereich === 'Kursraum') expect(pointInPolygon({ x: it.x, y: it.y }, kurs.polygon), label(it, p)).toBe(true);
      }
    });

    it('Umkleiden enthalten Spindreihen mit Fächerzahl und liegen im jeweiligen Raum', () => {
      const damen = autoRooms.find((r) => r.name === 'Umkleide Damen')!;
      const herren = autoRooms.find((r) => r.name === 'Umkleide Herren')!;
      const rows = f.items.filter((it) => getDef(it.defId, p)!.symbol === 'locker-row');
      expect(rows.length).toBe(4);
      let lockers = 0;
      for (const r of rows) {
        expect(Number(r.params?.faecher), label(r, p)).toBeGreaterThan(0);
        expect(r.width).toBe(Number(r.params?.faecher) / 2 * Number(r.params?.abteilbreite));
        lockers += Number(r.params?.faecher);
        expect(pointInPolygon({ x: r.x, y: r.y }, damen.polygon) || pointInPolygon({ x: r.x, y: r.y }, herren.polygon), label(r, p)).toBe(true);
      }
      expect(lockers).toBeGreaterThanOrEqual(80);
    });
  });
});
