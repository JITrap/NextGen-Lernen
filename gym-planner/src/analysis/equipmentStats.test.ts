import { describe, it, expect } from 'vitest';
import { equipmentStats } from './equipmentStats';
import { projectWithHall, firstFloor, addZone, addCustomDef, makeDef, place } from './testFixtures';
import { getDef } from '@/data/equipment';

describe('Geräte-Statistik', () => {
  it('zählt je Bereich/Muskelgruppe/Hersteller und summiert Grundflächen', () => {
    const p = projectWithHall(2500, 2000);
    const rack = getDef('atlantis-c513')!; // 165 × 203, Racks, Zone 60 rundum
    const treadmill = addCustomDef(p, makeDef({ id: 'test-treadmill', name: 'Laufband', bereich: 'Cardio', symbol: 'treadmill', breite_cm: 90, tiefe_cm: 210, sicherheitszone_cm: { vorne: 0, hinten: 200, links: 0, rechts: 0 } }));
    const plates = addCustomDef(p, makeDef({ id: 'test-plates', name: 'Hantelscheiben', bereich: 'Freihantel-Zubehör', ohne_stellflaeche: true }));
    const f = firstFloor(p);
    addZone(f, 100, 100, 1100, 1100, 'Trainingsfläche Freihantel', 'Freihantel');
    place(f, rack, 500, 500);
    place(f, treadmill, 1500, 500);
    place(f, plates, 1500, 1500);
    const s = equipmentStats(p).floors[0];
    expect(s.itemCount).toBe(3);
    expect(s.noFootprintCount).toBe(1);
    expect(s.byArea.find((e) => e.key === 'Kraftgeräte')!.count).toBe(1);
    expect(s.byArea.find((e) => e.key === 'Cardio')!.count).toBe(1);
    expect(s.byMuscle.find((e) => e.key === 'Racks')!.count).toBe(1);
    expect(s.byManufacturer.find((e) => e.key === 'Atlantis')!.count).toBe(1);
    expect(s.byManufacturer.find((e) => e.key === 'Generisch')!.count).toBe(2);
    expect(s.bySeries.find((e) => e.key === 'Atlantis – Athletic Series')!.count).toBe(1);
    expect(s.footprintM2).toBeCloseTo(1.65 * 2.03 + 0.9 * 2.1, 6);
    // Rack inkl. Zone: 285 × 323; Laufband: 90 × 410
    expect(s.withZonesM2).toBeCloseTo((285 * 323 + 90 * 410) / 10000, 6);
    const room = s.freeByRoom[0];
    expect(room.itemCount).toBe(1);
    expect(room.freeM2).toBeCloseTo(100 - 1.65 * 2.03, 6);
  });

  it('Gesamt summiert Stockwerke', () => {
    const p = projectWithHall(2500, 2000);
    place(firstFloor(p), getDef('atlantis-c513')!, 500, 500);
    const s = equipmentStats(p);
    expect(s.total.itemCount).toBe(1);
    expect(s.total.byArea[0].key).toBe('Kraftgeräte');
  });
});
