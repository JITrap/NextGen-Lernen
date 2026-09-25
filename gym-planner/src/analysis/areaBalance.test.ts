import { describe, it, expect } from 'vitest';
import { areaBalance } from './areaBalance';
import { projectWithHall, firstFloor, addZone, addFloor } from './testFixtures';
import { rectPolygon } from '@/geometry/polygon';
import { createHall } from '@/store/factories';

describe('Flächenbilanz', () => {
  it('Halle 25 × 20 m: brutto 500,00 m², netto bei 24 cm Außenwand 478,63 m²', () => {
    const p = projectWithHall(2500, 2000, 24);
    const b = areaBalance(p);
    expect(b.total.bruttoM2).toBeCloseTo(500, 6);
    // (2500 − 48) × (2000 − 48) = 2452 × 1952 cm² = 478,6304 m²
    expect(b.total.nettoM2).toBeCloseTo(478.63, 2);
    expect(b.floors[0].unassignedM2).toBeCloseTo(478.63, 2);
    expect(b.floors[0].hasHall).toBe(true);
    expect(b.total.byClass.map((c) => c.m2).every((m) => m === 0)).toBe(true);
  });

  it('Zone zählt zu Raumtyp und Flächenklasse, Rest ist „nicht zugeordnet“', () => {
    const p = projectWithHall(2500, 2000);
    addZone(firstFloor(p), 100, 100, 1100, 1100, 'Trainingsfläche Freihantel', 'Freihantel');
    const f = areaBalance(p).floors[0];
    expect(f.trainingM2).toBeCloseTo(100, 6);
    expect(f.byType[0].type).toBe('Trainingsfläche Freihantel');
    expect(f.byType[0].m2).toBeCloseTo(100, 6);
    expect(f.byType[0].percent).toBeCloseTo((100 / 478.6304) * 100, 3);
    expect(f.byClass.find((c) => c.areaClass === 'Trainingsfläche')!.m2).toBeCloseTo(100, 6);
    expect(f.unassignedM2).toBeCloseTo(378.6304, 3);
  });

  it('verschachtelte Zonen: die kleinere gewinnt, nichts zählt doppelt', () => {
    const p = projectWithHall(2500, 2000);
    addZone(firstFloor(p), 100, 100, 1100, 1100, 'Maschinen');
    addZone(firstFloor(p), 200, 200, 600, 600, 'Functional/Stretching');
    const f = areaBalance(p).floors[0];
    const m = f.byType.find((t) => t.type === 'Maschinen')!;
    const fn = f.byType.find((t) => t.type === 'Functional/Stretching')!;
    expect(fn.m2).toBeCloseTo(16, 6);
    expect(m.m2).toBeCloseTo(84, 6);
    expect(m.m2 + fn.m2).toBeCloseTo(100, 6);
  });

  it('teilweise überlappende Zonen: Überlappung nur einmal', () => {
    const p = projectWithHall(2500, 2000);
    addZone(firstFloor(p), 100, 100, 1100, 1100, 'Cardio');
    addZone(firstFloor(p), 600, 100, 1600, 1100, 'Kursraum');
    const f = areaBalance(p).floors[0];
    const sum = f.byType.reduce((s, t) => s + t.m2, 0);
    expect(sum).toBeCloseTo(150, 6);
    expect(f.byType.map((t) => t.m2).sort((a, b) => a - b)).toEqual([50, 100].map((v) => expect.closeTo(v, 6)));
  });

  it('Luftraum zählt nicht zur Nutzfläche und wird von Zonen abgezogen', () => {
    const p = projectWithHall(2500, 2000);
    firstFloor(p).voids.push({ id: 'v1', polygon: rectPolygon({ x: 300, y: 300 }, { x: 800, y: 800 }) });
    addZone(firstFloor(p), 100, 100, 1100, 1100, 'Kursraum');
    const f = areaBalance(p).floors[0];
    expect(f.voidM2).toBeCloseTo(25, 6);
    expect(f.nettoM2).toBeCloseTo(478.6304 - 25, 3);
    expect(f.byType[0].m2).toBeCloseTo(75, 6);
  });

  it('Zone über den Hallenrand hinaus wird auf die Halle beschnitten', () => {
    const p = projectWithHall(2500, 2000);
    addZone(firstFloor(p), -500, 100, 500, 1100, 'Lager');
    const f = areaBalance(p).floors[0];
    // Innenkante bei x = 24 → 476 × 1000 cm
    expect(f.byType[0].m2).toBeCloseTo(47.6, 6);
  });

  it('ohne Halle: Netto = Summe der Räume', () => {
    const p = projectWithHall(2500, 2000);
    firstFloor(p).hall = null;
    addZone(firstFloor(p), 0, 0, 1000, 1000, 'Büro');
    const f = areaBalance(p).floors[0];
    expect(f.hasHall).toBe(false);
    expect(f.bruttoM2).toBe(0);
    expect(f.nettoM2).toBeCloseTo(100, 6);
    expect(f.unassignedM2).toBe(0);
    expect(f.byType[0].percent).toBeCloseTo(100, 6);
  });

  it('Gesamt summiert alle Stockwerke (sortiert nach order)', () => {
    const p = projectWithHall(2500, 2000);
    const og = addFloor(p, { order: 1, hall: createHall(1000, 1000) });
    addZone(og, 100, 100, 600, 600, 'Ruheraum');
    const b = areaBalance(p);
    expect(b.floors.length).toBe(2);
    expect(b.floors[1].floorId).toBe(og.id);
    expect(b.total.bruttoM2).toBeCloseTo(600, 6);
    expect(b.total.nettoM2).toBeCloseTo(478.6304 + 90.5904, 3);
    expect(b.total.byClass.find((c) => c.areaClass === 'Wellness')!.m2).toBeCloseTo(25, 6);
    expect(b.total.roomCount).toBe(1);
  });

  it('ist am Projekt-Objekt memoisiert', () => {
    const p = projectWithHall(2500, 2000);
    expect(areaBalance(p)).toBe(areaBalance(p));
    expect(areaBalance({ ...p })).not.toBe(areaBalance(p));
  });
});
