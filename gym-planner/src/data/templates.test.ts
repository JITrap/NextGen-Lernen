import { describe, it, expect } from 'vitest';
import type { Door, EscapeRoute, Floor, PlacedItem, Project, TextNote, Vec2 } from '@/types';
import { TEMPLATES, getTemplate, defaultTemplate, DEFAULT_TEMPLATE_ID, EMPTY_TEMPLATE_ID } from './templates';
import { getDef } from '@/data/equipment';
import { polygonAreaM2, pointInPolygon, distance, lineIntersection, bbox, sub, normalize, perp, add, scale } from '@/geometry/polygon';
import { allWalls, findWall, hallInnerPolygon, hallOuterPolygon, wallLength, openingPlacement, wallRect, projectOntoWall, isHallWallId } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { findCollisions, itemInsideHall, itemsInDoorSwing, emergencyExitBlocked, convexPolygonsOverlap } from '@/geometry/collision';
import { itemFootprint, itemSafetyPolygon, zoneIsEmpty } from '@/geometry/transform';
import { warnings, capacity, areaBalance } from '@/analysis';

const EXPECTED_AREAS: Record<string, number> = { 'beispiel-1000': 1000, 'empty-20x25': 500, 'studio-400': 400, 'studio-800': 800 };

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
  it('es gibt genau die vier Vorlagen mit eindeutigen IDs und deutschen Namen, Beispielstudio zuerst', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['beispiel-1000', 'empty-20x25', 'studio-400', 'studio-800']);
    expect(TEMPLATES.map((t) => t.name)).toEqual(['Beispielstudio 1.000 m²', 'Leere Halle 20 × 25 m', 'Kleines Studio 400 m²', 'Mittleres Studio 800 m²']);
    for (const t of TEMPLATES) expect(t.description.length).toBeGreaterThan(10);
    expect(getTemplate('studio-400')?.name).toBe('Kleines Studio 400 m²');
    expect(getTemplate('nope')).toBeUndefined();
    expect(DEFAULT_TEMPLATE_ID).toBe('beispiel-1000');
    expect(EMPTY_TEMPLATE_ID).toBe('empty-20x25');
    expect(defaultTemplate().id).toBe('beispiel-1000');
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

  describe('Beispielstudio 1.000 m²', () => {
    const p = getTemplate('beispiel-1000')!.create();
    const f = firstFloor(p);
    const walls = allWalls(f);
    const inner = hallInnerPolygon(f.hall!);
    const rooms = floorRooms(f);
    const autoRooms = rooms.filter((r) => r.source === 'auto');
    const zones = rooms.filter((r) => r.source === 'zone');
    const byName = new Map(autoRooms.map((r) => [r.name, r]));
    const zoneByName = new Map(zones.map((z) => [z.name, z]));
    const defs = f.items.map((it) => getDef(it.defId, p)!);
    const doors = f.openings.filter((o): o is Door => o.kind === 'door');
    const exits = doors.filter((d) => d.doorType === 'Notausgang');
    const at = (it: PlacedItem): Vec2 => ({ x: it.x, y: it.y });
    const itemsIn = (poly: Vec2[]) => f.items.filter((it) => pointInPolygon(at(it), poly));
    const idsIn = (poly: Vec2[]) => itemsIn(poly).map((it) => it.defId);
    const box = (it: PlacedItem) => bbox(zoneIsEmpty(it.safetyZone) ? itemFootprint(it) : itemSafetyPolygon(it, it.safetyZone));
    const count = (arr: string[], id: string) => arr.filter((x) => x === id).length;
    const zoneOf = (name: string) => {
      const z = zoneByName.get(name);
      expect(z, `Zone „${name}“`).toBeDefined();
      return z!;
    };
    const roomOf = (name: string) => {
      const r = byName.get(name);
      expect(r, `Raum „${name}“`).toBeDefined();
      return r!;
    };

    it('ist 40 × 25 m mit 14 benannten, typisierten Räumen und 8 Trainingszonen ohne Überlappung', () => {
      const xs = f.hall!.polygon.map((v) => v.x);
      const ys = f.hall!.polygon.map((v) => v.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBe(4000);
      expect(Math.max(...ys) - Math.min(...ys)).toBe(2500);
      for (const [name, type] of [
        ['Empfang / Lounge', 'Empfang/Lounge'], ['Büro', 'Büro'], ['Personalraum', 'Personalraum'], ['WC barrierefrei', 'WC'],
        ['Umkleide Damen', 'Umkleide Damen'], ['Duschen / WC Damen', 'Duschen'], ['Umkleide Herren', 'Umkleide Herren'], ['Duschen / WC Herren', 'Duschen'],
        ['Lager', 'Lager'], ['Technik / Lüftung', 'Technik/Lüftung'], ['Putzraum', 'Putzraum'], ['Wellness', 'Wellness/Sauna'], ['Kursraum', 'Kursraum'],
        ['Trainingshalle', 'Flur/Verkehrsfläche'],
      ] as const) {
        expect(byName.get(name)?.type, name).toBe(type);
      }
      expect(autoRooms.length).toBe(14);
      expect(autoRooms.every((r) => r.type !== 'Sonstiges' && r.name !== 'Raum')).toBe(true);
      expect(roomOf('Kursraum').areaM2).toBeGreaterThanOrEqual(95);
      expect(roomOf('Trainingshalle').areaM2).toBeGreaterThan(550);
      expect(zones.map((z) => z.name).sort()).toEqual(['Beine', 'Brust', 'Cardio', 'Core', 'Freihantel', 'HYROX', 'Rücken', 'Schultern & Arme']);
      expect(zoneOf('HYROX').type).toBe('HYROX');
      expect(zoneOf('Freihantel').type).toBe('Trainingsfläche Freihantel');
      expect(zoneOf('Cardio').type).toBe('Cardio');
      for (const n of ['Brust', 'Rücken', 'Beine', 'Schultern & Arme', 'Core']) expect(zoneOf(n).type, n).toBe('Maschinen');
      // Zonen überlappen sich nicht (Rasterprobe 20 cm) und liegen in der Halle
      for (let x = 913; x < 3976; x += 20) {
        for (let y = 33; y < 2476; y += 20) {
          const hits = zones.filter((z) => pointInPolygon({ x, y }, z.polygon));
          expect(hits.length, `Zonen bei (${x}, ${y}): ${hits.map((z) => z.name).join(', ')}`).toBeLessThanOrEqual(1);
        }
      }
      for (const z of zones) for (const v of z.polygon) expect(pointInPolygon(v, inner) || v.x === 24 || v.y === 24 || v.x === 3976 || v.y === 2476, `${z.name} ${v.x}/${v.y}`).toBe(true);
      // Hallen-Label ausgeblendet (Zonen tragen die Beschriftung)
      const hallMeta = Object.values(f.roomMeta).find((m) => m.name === 'Trainingshalle');
      expect(hallMeta?.labelMode).toBe('none');
      const balance = areaBalance(p).floors[0];
      expect(balance.bruttoM2).toBe(1000);
      expect(balance.untypedRoomCount).toBe(0);
      expect(balance.nettoM2).toBeGreaterThan(950);
    });

    it('hat Haupteingang (200 cm, zweiflügelig) und drei weitere Notausgänge an Außenwänden, Rolltor, Fensterbänder und zwei Spiegelwände', () => {
      expect(doors.length).toBeGreaterThanOrEqual(18);
      expect(exits.length).toBe(4);
      expect(exits.every((d) => d.wallId.startsWith('hall_') && d.width >= 100)).toBe(true);
      expect(exits.some((d) => d.width === 200 && /Haupteingang/.test(d.note ?? ''))).toBe(true);
      expect(doors.some((d) => d.doorType === 'Rolltor')).toBe(true);
      expect(doors.some((d) => d.doorType === 'zweiflügelig')).toBe(true);
      expect(f.openings.filter((o) => o.kind === 'window').length).toBeGreaterThanOrEqual(12);
      expect(f.openings.filter((o) => o.kind === 'mirror').length).toBe(2);
    });

    it('Kraftbereich nach Muskelgruppen: jede Zone enthält die passenden Geräte, Reihen an gemeinsamen Kanten ausgerichtet, Front zum Gang', () => {
      const brust = idsIn(zoneOf('Brust').polygon);
      for (const id of ['prime-hybrid-chest-press', 'prime-hybrid-incline-press', 'prime-hybrid-pec-rear-delt', 'prime-specialty-functional-trainer', 'atlantis-p337', 'atlantis-p338']) {
        expect(brust, `Brust: ${id}`).toContain(id);
      }
      const ruecken = idsIn(zoneOf('Rücken').polygon);
      for (const id of ['prime-hybrid-lat-pulldown', 'prime-hybrid-seated-row', 'atlantis-pw637', 'prime-specialty-chin-dip-assist', 'atlantis-pw625']) {
        expect(ruecken, `Rücken: ${id}`).toContain(id);
      }
      const sa = idsIn(zoneOf('Schultern & Arme').polygon);
      for (const id of ['prime-hybrid-shoulder-press', 'prime-hybrid-lateral-raise', 'prime-hybrid-arm-curl', 'prime-hybrid-tricep-extension', 'atlantis-b256']) {
        expect(sa, `Schultern & Arme: ${id}`).toContain(id);
      }
      const beine = idsIn(zoneOf('Beine').polygon);
      for (const id of ['prime-plate-loaded-leg-press', 'prime-plate-loaded-hack-squat', 'prime-plate-loaded-pendulum-squat', 'prime-hybrid-leg-extension-leg-curl-combo', 'atlantis-pw702', 'prime-hybrid-inner-outer-thigh', 'gen-freihantel-scheibenstaender']) {
        expect(beine, `Beine: ${id}`).toContain(id);
      }
      const core = idsIn(zoneOf('Core').polygon);
      for (const id of ['prime-hybrid-abdominal-crunch', 'prime-hybrid-low-back-extension']) expect(core, `Core: ${id}`).toContain(id);
      const frei = idsIn(zoneOf('Freihantel').polygon);
      for (const id of ['atlantis-s189', 'atlantis-s187', 'atlantis-c513', 'atlantis-rs611', 'atlantis-b4800', 'gen-freihantel-scheibenstaender', 'gen-freihantel-langhantelstaender', 'atlantis-r400']) {
        expect(frei, `Freihantel: ${id}`).toContain(id);
      }
      // Kurzhantel-Racks und Racks an der Spiegelwand (Nordwand), Front zur Halle; ≥ 150 cm Freiraum vor den Kurzhantel-Racks
      const mirror = f.openings.find((o) => o.kind === 'mirror' && o.wallId === 'hall_0')!;
      expect(mirror).toBeDefined();
      for (const it of itemsIn(zoneOf('Freihantel').polygon).filter((x) => ['atlantis-s189', 'atlantis-s187', 'atlantis-c513', 'atlantis-rs611'].includes(x.defId))) {
        expect(it.rotation, label(it, p)).toBe(0);
        expect(box(it).minY - 24, label(it, p)).toBeLessThanOrEqual(20); // Belegungsbox an der Wand (Rundung aufs Raster)
      }
      const dbRacks = f.items.filter((it) => it.defId === 'atlantis-s189' || it.defId === 'atlantis-s187');
      const dbFront = Math.max(...dbRacks.map((it) => it.y + it.depth / 2));
      const nextRow = f.items.filter((it) => ['atlantis-b4800', 'gen-freihantel-scheibenstaender', 'gen-freihantel-langhantelstaender'].includes(it.defId) && it.y > 300);
      expect(Math.min(...nextRow.map((it) => box(it).minY)) - dbFront).toBeGreaterThanOrEqual(150);
      // Reihen: Brust-Reihe (Front nach oben) an gemeinsamer Oberkante, Rücken-Reihe (Front nach unten) direkt Rücken an Rücken dahinter
      const brustRow = itemsIn(zoneOf('Brust').polygon).filter((it) => getDef(it.defId, p)!.bereich === 'Kraftgeräte');
      expect(brustRow.length).toBe(6);
      expect(new Set(brustRow.map((it) => it.rotation))).toEqual(new Set([180]));
      // Mittelpunkte liegen auf dem 10-cm-Raster → Kanten einer Reihe weichen höchstens um ein Rasterfeld voneinander ab
      const tops = brustRow.map((it) => box(it).minY);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(10);
      const rueckenRow = itemsIn(zoneOf('Rücken').polygon).filter((it) => getDef(it.defId, p)!.bereich === 'Kraftgeräte');
      expect(rueckenRow.length).toBe(5);
      expect(new Set(rueckenRow.map((it) => it.rotation))).toEqual(new Set([0]));
      const rTops = rueckenRow.map((it) => box(it).minY);
      expect(Math.max(...rTops) - Math.min(...rTops)).toBeLessThanOrEqual(10);
      expect(Math.min(...rTops) - Math.max(...brustRow.map((it) => box(it).maxY))).toBeGreaterThanOrEqual(-1e-6);
      expect(Math.min(...rTops) - Math.max(...brustRow.map((it) => box(it).maxY))).toBeLessThanOrEqual(10);
      // Gänge zwischen den Reihen ≥ 125 cm (Brust-Reihe ↔ Freihantel/Core, Rücken-Reihe ↔ Beine/Arme)
      const brustTop = Math.min(...tops);
      const above = f.items.filter((it) => box(it).maxY <= brustTop && box(it).minX >= 1000 && it.x < 3000 && getDef(it.defId, p)!.bereich !== 'Ausstattung');
      expect(brustTop - Math.max(...above.map((it) => box(it).maxY))).toBeGreaterThanOrEqual(120);
      const rueckenBottom = Math.max(...rueckenRow.map((it) => box(it).maxY));
      const below = f.items.filter((it) => box(it).minY >= rueckenBottom && it.y < 2000 && ['Kraftgeräte', 'Freihantel-Zubehör'].includes(getDef(it.defId, p)!.bereich));
      expect(Math.min(...below.map((it) => box(it).minY)) - rueckenBottom).toBeGreaterThanOrEqual(125);
      // Scheibenständer in der Nähe der Plate-Loaded-Geräte (Mittelpunkte ≤ 6 m, in der Reihe oder gegenüber über den Gang)
      const trees = f.items.filter((it) => it.defId === 'gen-freihantel-scheibenstaender');
      for (const pl of f.items.filter((it) => it.defId.startsWith('prime-plate-loaded-') || it.defId === 'atlantis-pw625' || it.defId === 'atlantis-pw637')) {
        expect(Math.min(...trees.map((t) => distance(at(t), at(pl)))), label(pl, p)).toBeLessThanOrEqual(600);
      }
    });

    it('Cardio steht am Fensterband (Süd) mit Front zum Fenster, Sturzraum nach innen und TVs an der Fensterwand', () => {
      const cardio = itemsIn(zoneOf('Cardio').polygon).filter((it) => getDef(it.defId, p)!.bereich === 'Cardio');
      expect(cardio.length).toBe(12);
      expect(cardio.filter((it) => it.defId === 'gen-cardio-laufband').length).toBe(4);
      for (const it of cardio) {
        expect(it.rotation, label(it, p)).toBe(0);
        expect(2476 - box(it).maxY, label(it, p)).toBeLessThanOrEqual(20);
      }
      for (const it of cardio.filter((x) => x.defId === 'gen-cardio-laufband')) {
        const zone = itemSafetyPolygon(it, it.safetyZone);
        expect((it.y - it.depth / 2) - Math.min(...zone.map((v) => v.y))).toBeCloseTo(200, 6);
      }
      const windows = f.openings.filter((o) => o.kind === 'window' && o.wallId === 'hall_2');
      expect(windows.length).toBeGreaterThanOrEqual(5);
      expect(f.items.filter((it) => it.defId === 'gen-ausstattung-tv-65' && it.wallId === 'hall_2').length).toBeGreaterThanOrEqual(3);
    });

    it('HYROX-Bereich: Zone vom Typ HYROX mit 8 Stationen, zwei Bahnen ≥ 15 m, Schlitten, Wall-Ball-Zielen, Timer und Beschriftungen', () => {
      const z = zoneOf('HYROX');
      expect(z.areaM2).toBeGreaterThanOrEqual(80);
      const ids = idsIn(z.polygon);
      expect(count(ids, 'gen-cardio-skierg')).toBe(2);
      expect(count(ids, 'gen-cardio-rudergeraet')).toBe(2);
      expect(count(ids, 'gen-functional-sled')).toBe(2);
      for (const id of ['gen-functional-kettlebell-regal', 'gen-hyrox-sandbag-regal', 'gen-hyrox-wall-ball-regal', 'gen-hyrox-farmers-carry-griffe', 'gen-hyrox-intervall-timer']) {
        expect(count(ids, id), id).toBe(1);
      }
      expect(count(ids, 'gen-hyrox-wall-ball-ziel')).toBe(2);
      const lanes = itemsIn(z.polygon).filter((it) => it.defId === 'gen-functional-sled-bahn' || it.defId === 'gen-functional-matte');
      expect(lanes.length).toBe(2);
      for (const lane of lanes) {
        const b = bbox(itemFootprint(lane));
        expect(b.maxX - b.minX, label(lane, p)).toBeGreaterThanOrEqual(1500);
        expect(b.maxY - b.minY, label(lane, p)).toBeGreaterThanOrEqual(180);
        expect(b.maxY - b.minY, label(lane, p)).toBeLessThanOrEqual(200);
      }
      // Schlitten stehen am Bahnanfang, Wall-Ball-Ziele hängen an der Nordwand
      const laneStart = Math.min(...lanes.map((l) => bbox(itemFootprint(l)).minX));
      for (const sled of f.items.filter((it) => it.defId === 'gen-functional-sled')) expect(laneStart - (sled.x + sled.width / 2), label(sled, p)).toBeLessThan(40);
      for (const t of f.items.filter((it) => it.defId === 'gen-hyrox-wall-ball-ziel')) expect(t.wallId).toBe('hall_0');
      // Stationsbeschriftungen als Textnotizen
      const notes = f.annotations.filter((a): a is TextNote => a.kind === 'text').map((a) => a.text).join(' | ');
      for (const s of ['1 SkiErg', '2 Sled Push', '3 Sled Pull', '4 Burpee Broad Jump', '5 Rowing', '6 Farmers', '7 Sandbag', '8 Wall Balls']) expect(notes, s).toContain(s);
      expect(f.annotations.filter((a) => a.kind === 'text').every((a) => (a as TextNote).fontSize > 0 && pointInPolygon({ x: (a as TextNote).x, y: (a as TextNote).y }, inner))).toBe(true);
    });

    it('Kursraum: Spiegelwand, Podest mit Musikanlage, ≥ 12 Matten, 6 Cycling-Räder mit ≥ 100 cm Abstand, Regale, Wasserspender, Notausgang mit Rettungszeichen', () => {
      const kurs = roomOf('Kursraum');
      const ids = idsIn(kurs.polygon);
      expect(count(ids, 'gen-kursraum-kursmatte')).toBeGreaterThanOrEqual(12);
      expect(count(ids, 'gen-kursraum-spinning-rad')).toBe(6);
      for (const id of ['gen-kursraum-trainer-podest', 'gen-kursraum-musikanlage', 'gen-kursraum-mattenregal', 'gen-kursraum-step-wagen', 'gen-kursraum-kurshantel-regal', 'gen-kursraum-gymnastikball-regal', 'gen-ausstattung-wasserspender', 'gen-bau-lueftungsauslass', 'gen-ausstattung-feuerloescher']) {
        expect(ids, id).toContain(id);
      }
      const bikes = itemsIn(kurs.polygon).filter((it) => it.defId === 'gen-kursraum-spinning-rad');
      for (let i = 0; i < bikes.length; i++) {
        for (let j = i + 1; j < bikes.length; j++) {
          const a = bbox(itemFootprint(bikes[i]));
          const b = bbox(itemFootprint(bikes[j]));
          const gap = Math.max(b.minX - a.maxX, a.minX - b.maxX, b.minY - a.maxY, a.minY - b.maxY);
          expect(gap, `${label(bikes[i], p)} ↔ ${label(bikes[j], p)}`).toBeGreaterThanOrEqual(100);
        }
      }
      // Matten: mind. 2 m² je Platz (Raster 180 × 60 mit Abständen) – Mattenfläche + Freiraum ≥ 12 × 2 m²
      const mats = itemsIn(kurs.polygon).filter((it) => it.defId === 'gen-kursraum-kursmatte');
      const mb = bbox(mats.flatMap((m) => itemFootprint(m)));
      expect(((mb.maxX - mb.minX + 100) * (mb.maxY - mb.minY + 100)) / 10000).toBeGreaterThanOrEqual(mats.length * 2);
      const mirror = f.openings.find((o) => o.kind === 'mirror' && o.wallId !== 'hall_0');
      expect(mirror).toBeDefined();
      expect(mirror!.width).toBeGreaterThanOrEqual(600);
      const exit = exits.find((d) => d.wallId === 'hall_1' && pointInPolygon({ x: 3900, y: openingPlacement(d, findWall(f, d.wallId)!).center.y }, kurs.polygon));
      expect(exit, 'Notausgang Kursraum').toBeDefined();
      const sign = f.items.find((it) => it.defId === 'gen-ausstattung-notausgang-schild' && pointInPolygon(at(it), kurs.polygon));
      expect(sign).toBeDefined();
    });

    it('Empfang, Umkleiden/Sanitär, Wellness, Lager/Technik/Putzraum sind vollständig ausgestattet', () => {
      const empf = idsIn(roomOf('Empfang / Lounge').polygon);
      for (const id of ['gen-empfang-theke', 'gen-empfang-drehkreuz', 'gen-empfang-zugangsschranke', 'gen-empfang-shakebar', 'gen-empfang-garderobe', 'gen-empfang-info-bildschirm', 'gen-empfang-sofa-3', 'gen-ausstattung-aed', 'gen-ausstattung-erste-hilfe', 'gen-ausstattung-feuerloescher', 'gen-ausstattung-wasserspender']) {
        expect(empf, id).toContain(id);
      }
      expect(empf.filter((id) => id.startsWith('gen-ausstattung-pflanze')).length).toBeGreaterThanOrEqual(3);
      const wc = idsIn(roomOf('WC barrierefrei').polygon);
      expect(wc).toContain('gen-sanitaer-wc-barrierefrei');
      expect(wc).toContain('gen-umkleide-waschtisch');
      const wcDoor = doors.find((d) => /WC barrierefrei/.test(d.note ?? ''))!;
      expect(wcDoor.width).toBeGreaterThanOrEqual(90);
      // Bewegungsfläche 150 × 150 im WC frei (Rasterprobe)
      const wcItems = itemsIn(roomOf('WC barrierefrei').polygon).filter((it) => !it.wallId);
      const free = [730, 880, 715, 865] as const;
      for (const it of wcItems) {
        const b = bbox(itemFootprint(it));
        expect(b.maxX <= free[0] || b.minX >= free[1] || b.maxY <= free[2] || b.minY >= free[3], label(it, p)).toBe(true);
      }
      for (const [room, women] of [['Umkleide Damen', true], ['Umkleide Herren', false]] as const) {
        const ids = idsIn(roomOf(room).polygon);
        for (const id of ['gen-umkleide-einzelkabine', 'gen-umkleide-mittelbank', 'gen-umkleide-bank-schuhrost', 'gen-umkleide-spiegel', 'gen-umkleide-foehnplatz', 'gen-umkleide-wertfaecher', 'gen-ausstattung-muelleimer', 'gen-bau-lueftungsauslass', 'gen-ausstattung-feuerloescher']) {
          expect(ids, `${room}: ${id}`).toContain(id);
        }
        expect(count(ids, 'gen-umkleide-spindreihe-2')).toBe(2);
        const san = idsIn(roomOf(women ? 'Duschen / WC Damen' : 'Duschen / WC Herren').polygon);
        expect(count(san, 'gen-sanitaer-einzeldusche')).toBe(4);
        expect(count(san, 'gen-sanitaer-dusche-barrierefrei')).toBe(1);
        expect(count(san, 'gen-sanitaer-wc-kabine')).toBe(2);
        expect(count(san, 'gen-sanitaer-urinal')).toBe(women ? 0 : 2);
        expect(count(san, 'gen-sanitaer-wickeltisch')).toBe(women ? 1 : 0);
        expect(san).toContain('gen-umkleide-waschtisch-doppel');
        expect(san).toContain('gen-umkleide-handtuchspender');
        expect(san).toContain('gen-umkleide-waeschesammler');
      }
      const lockers = f.items.filter((it) => getDef(it.defId, p)!.symbol === 'locker-row');
      expect(lockers.length).toBe(4);
      expect(lockers.reduce((s, r) => s + Number(r.params?.faecher), 0)).toBeGreaterThanOrEqual(100);
      const well = idsIn(roomOf('Wellness').polygon);
      for (const id of ['gen-wellness-sauna-300', 'gen-wellness-infrarotkabine', 'gen-wellness-erlebnisdusche', 'gen-wellness-eisbrunnen', 'gen-wellness-cold-plunge', 'gen-wellness-teestation', 'gen-ausstattung-wasserspender', 'gen-umkleide-waeschesammler']) {
        expect(well, id).toContain(id);
      }
      expect(count(well, 'gen-wellness-ruheliege')).toBe(4);
      const lager = idsIn(roomOf('Lager').polygon);
      expect(count(lager, 'gen-lager-schwerlastregal')).toBe(2);
      expect(lager).toContain('gen-lager-waschmaschine');
      expect(doors.some((d) => d.doorType === 'Rolltor' && d.wallId === 'hall_2')).toBe(true);
      const technik = idsIn(roomOf('Technik / Lüftung').polygon);
      for (const id of ['gen-lager-lueftungsanlage', 'gen-lager-warmwasserspeicher', 'gen-lager-serverschrank', 'gen-lager-schaltschrank']) expect(technik, id).toContain(id);
      const putz = idsIn(roomOf('Putzraum').polygon);
      expect(putz).toContain('gen-lager-putzwagen');
      expect(putz).toContain('gen-sanitaer-putzraum-ausguss');
      const buero = idsIn(roomOf('Büro').polygon);
      expect(buero).toContain('gen-buero-schreibtisch');
      const personal = idsIn(roomOf('Personalraum').polygon);
      expect(personal).toContain('gen-buero-teekueche');
      expect(personal).toContain('gen-ausstattung-erste-hilfe');
    });

    it('ist mit über 240 Objekten eingerichtet: 12 Atlantis-, 18 Prime-Geräte, 16 Cardio-Geräte, 4 Spindreihen, 10 Duschen', () => {
      expect(f.items.length).toBeGreaterThanOrEqual(240);
      const equipment = defs.filter((d) => ['Kraftgeräte', 'Cardio', 'Functional', 'Freihantel-Zubehör'].includes(d.bereich));
      expect(equipment.length).toBeGreaterThanOrEqual(55);
      expect(defs.filter((d) => d.hersteller === 'Atlantis').length).toBeGreaterThanOrEqual(12);
      expect(defs.filter((d) => d.hersteller === 'Prime').length).toBeGreaterThanOrEqual(18);
      expect(defs.filter((d) => d.id.startsWith('prime-hybrid-')).length).toBeGreaterThanOrEqual(13);
      expect(defs.filter((d) => d.id.startsWith('prime-plate-loaded-')).length).toBe(3);
      expect(defs.filter((d) => d.bereich === 'Cardio').length).toBe(16);
      for (const sym of ['sauna', 'plunge', 'shower-experience', 'podium', 'counter', 'turnstile', 'platform', 'rack', 'half-rack', 'dumbbell-rack', 'skierg', 'rower', 'turf', 'sled']) {
        expect(defs.some((d) => d.symbol === sym), sym).toBe(true);
      }
      expect(defs.filter((d) => d.symbol === 'dumbbell-rack').length).toBe(2);
      expect(defs.filter((d) => d.symbol === 'spin-bike').length).toBe(6);
      expect(defs.filter((d) => d.symbol === 'lounger').length).toBe(4);
      expect(defs.filter((d) => d.symbol === 'shower').length).toBe(10);
      expect(defs.filter((d) => d.symbol === 'locker-row').length).toBe(4);
    });

    it('Sicherheit: 4 Notausgänge mit Rettungszeichen und Sicherheitsleuchte, ≥ 12 Feuerlöscher (kein Punkt > 20 m), ≥ 2 Erste-Hilfe-Kästen, AED, Desinfektion', () => {
      const signs = f.items.filter((it) => it.defId === 'gen-ausstattung-notausgang-schild');
      const lights = f.items.filter((it) => it.defId === 'gen-ausstattung-sicherheitsleuchte');
      expect(signs.length).toBeGreaterThanOrEqual(4);
      expect(lights.length).toBeGreaterThanOrEqual(4);
      for (const d of exits) {
        const wall = findWall(f, d.wallId)!;
        const c = openingPlacement(d, wall).center;
        const near = (it: PlacedItem) => it.wallId === d.wallId && distance(at(it), c) <= d.width / 2 + 150;
        expect(signs.some(near), `Rettungszeichen ≤ 150 cm neben Notausgang ${d.note ?? d.id}`).toBe(true);
        expect(lights.some(near), `Sicherheitsleuchte neben Notausgang ${d.note ?? d.id}`).toBe(true);
      }
      const ext = f.items.filter((it) => it.defId === 'gen-ausstattung-feuerloescher');
      expect(ext.length).toBeGreaterThanOrEqual(12);
      expect(ext.every((it) => it.wallId && findWall(f, it.wallId))).toBe(true);
      let worst = 0;
      for (let x = 30; x < 3976; x += 100) {
        for (let y = 30; y < 2476; y += 100) {
          if (!pointInPolygon({ x, y }, inner)) continue;
          const d = Math.min(...ext.map((e) => distance(at(e), { x, y })));
          worst = Math.max(worst, d);
        }
      }
      expect(worst).toBeLessThanOrEqual(2000);
      expect(f.items.filter((it) => it.defId === 'gen-ausstattung-erste-hilfe').length).toBeGreaterThanOrEqual(2);
      const aed = f.items.filter((it) => it.defId === 'gen-ausstattung-aed');
      expect(aed.length).toBeGreaterThanOrEqual(1);
      expect(aed.some((it) => pointInPolygon(at(it), roomOf('Empfang / Lounge').polygon))).toBe(true);
      expect(f.items.filter((it) => it.defId === 'gen-ausstattung-desinfektionsstation').length).toBeGreaterThanOrEqual(4);
      expect(f.items.filter((it) => it.defId === 'gen-ausstattung-wasserspender').length).toBeGreaterThanOrEqual(4);
    });

    it('Fluchtwege: ≥ 4 Anmerkungen, jede endet ≤ 100 cm an einem Notausgang, ≤ 52,5 m lang, Luftlinie ≤ 35 m, kreuzt keine Grundflächen und Wände nur an Türen', () => {
      const routes = f.annotations.filter((a): a is EscapeRoute => a.kind === 'escape-route');
      expect(routes.length).toBeGreaterThanOrEqual(4);
      const exitCenters = exits.map((d) => openingPlacement(d, findWall(f, d.wallId)!).center);
      // Hindernisse: Grundflächen aller Bodenobjekte außer Bauelementen in der Wand und der Zugangsschranke (Paniköffnung, Teil des Fluchtwegs)
      const obstacles = f.items.filter((it) => !it.wallId && !['column', 'radiator', 'vent'].includes(it.kind) && getDef(it.defId, p)!.symbol !== 'turnstile');
      const strip = (a: Vec2, b: Vec2): Vec2[] => {
        const n = scale(perp(normalize(sub(b, a))), 1);
        return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
      };
      const startNames = new Set<string>();
      for (const r of routes) {
        expect(r.label, r.id).toMatch(/^Fluchtweg \d+ – .+ → .+/);
        startNames.add(r.label!.split(' – ')[1].split(' → ')[0]);
        expect(r.points.length).toBeGreaterThanOrEqual(2);
        let len = 0;
        for (let i = 1; i < r.points.length; i++) len += distance(r.points[i - 1], r.points[i]);
        expect(len, r.label).toBeLessThanOrEqual(5250);
        const start = r.points[0];
        const end = r.points[r.points.length - 1];
        expect(Math.min(...exitCenters.map((c) => distance(c, end))), `${r.label}: Ende am Notausgang`).toBeLessThanOrEqual(100);
        expect(Math.min(...exitCenters.map((c) => distance(c, start))), `${r.label}: Luftlinie`).toBeLessThanOrEqual(3500);
        expect(pointInPolygon(start, inner), `${r.label}: Start in der Halle`).toBe(true);
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1];
          const b = r.points[i];
          const seg = strip(a, b);
          for (const it of obstacles) {
            expect(convexPolygonsOverlap(seg, itemFootprint(it), 0.5), `${r.label}: Segment ${i} kreuzt ${label(it, p)}`).toBe(false);
          }
          for (const w of walls) {
            if (isHallWallId(w.id)) continue;
            if (!convexPolygonsOverlap(seg, wallRect(w), 0.5)) continue;
            const hit = lineIntersection(a, b, w.start, w.end);
            expect(hit, `${r.label}: Segment ${i} streift Wand ${w.id}`).not.toBeNull();
            const off = projectOntoWall(w, hit!).offset;
            const door = doors.find((d) => d.wallId === w.id && Math.abs(d.offset - off) <= d.width / 2 + 1e-6);
            expect(door, `${r.label}: Segment ${i} kreuzt Wand ${w.id} bei ${Math.round(off)} ohne Tür`).toBeDefined();
          }
        }
      }
      // Entfernteste Bereiche abgedeckt: Kursraum, Wellness, Umkleide, Hallen-Ecken
      for (const s of ['Kursraum', 'Wellness', 'Umkleide Herren', 'Cardio (Ecke Südwest)', 'Freihantel']) expect([...startNames], s).toContain(s);
    });

    it('Kapazität: alle Kennzahlen (Spinde, Duschen, WCs) reichen für die Personenzahl', () => {
      const c = capacity(p);
      expect(c.persons).toBeGreaterThanOrEqual(50);
      for (const k of c.counters) expect(k.status, `${k.key}: ${k.actual}/${k.required}`).toBe('ok');
    });

    it('startet ohne Kollisions-, Tür-, Notausgang- und Laufweg-Warnungen (nur „Maße ungeprüft“)', () => {
      const list = warnings(p);
      expect(list.filter((w) => w.kind !== 'unverified').map((w) => `${w.kind}: ${w.message}`)).toEqual([]);
      expect(list.length).toBe(1);
    });

    it('Wellness-, Kursraum- und Sanitärobjekte liegen in ihren Räumen; Trainingsgeräte in der Halle', () => {
      const wellness = roomOf('Wellness');
      const kurs = roomOf('Kursraum');
      const halle = roomOf('Trainingshalle');
      const sanitary = ['Duschen / WC Damen', 'Duschen / WC Herren', 'WC barrierefrei', 'Putzraum'].map((n) => roomOf(n));
      for (const it of f.items) {
        const d = getDef(it.defId, p)!;
        if (d.bereich === 'Wellness') expect(pointInPolygon(at(it), wellness.polygon), label(it, p)).toBe(true);
        if (d.bereich === 'Kursraum') expect(pointInPolygon(at(it), kurs.polygon), label(it, p)).toBe(true);
        if (d.bereich === 'Sanitär') expect(sanitary.some((r) => pointInPolygon(at(it), r.polygon)), label(it, p)).toBe(true);
        if (['Kraftgeräte', 'Cardio', 'Functional'].includes(d.bereich) && !d.ohne_stellflaeche) {
          expect(pointInPolygon(at(it), halle.polygon), label(it, p)).toBe(true);
        }
      }
    });
  });
});
