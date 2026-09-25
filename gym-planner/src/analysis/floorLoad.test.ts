import { describe, it, expect } from 'vitest';
import { floorLoad } from './floorLoad';
import { warnings } from './warnings';
import { projectWithHall, firstFloor, addZone, addCustomDef, makeDef, place } from './testFixtures';

describe('Gewicht & Bodenlast', () => {
  it('10 × 500 kg auf 8 m² Raum → 625 kg/m² > 500 → Warnung', () => {
    const p = projectWithHall(2000, 2000);
    const heavy = addCustomDef(p, makeDef({ id: 'test-heavy', name: 'Schweres Gerät', gewicht_kg: 500, breite_cm: 40, tiefe_cm: 40 }));
    const f = firstFloor(p);
    addZone(f, 100, 100, 500, 300, 'Maschinen', 'Kleiner Raum'); // 4 × 2 m = 8 m²
    for (let i = 0; i < 10; i++) place(f, heavy, 120 + i * 38, 200);
    const l = floorLoad(p);
    const room = l.floors[0].rooms.find((r) => r.roomName === 'Kleiner Raum')!;
    expect(room.areaM2).toBeCloseTo(8, 6);
    expect(room.weightKg).toBe(5000);
    expect(room.kgM2).toBeCloseTo(625, 6);
    expect(room.exceeded).toBe(true);
    expect(l.floors[0].weightKg).toBe(5000);
    expect(l.floors[0].exceeded).toBe(false); // 5000 kg / 381 m² Netto
    expect(l.total.exceeded).toBe(true);
    expect(l.heavyItems.length).toBe(10);
    const w = warnings(p).filter((x) => x.kind === 'floor-load');
    expect(w.length).toBe(1);
    expect(w[0].message).toContain('Kleiner Raum');
    expect(w[0].target).toEqual({ kind: 'zone', id: f.zones[0].id });
  });

  it('zählt Objekte ohne Gewichtsangabe', () => {
    const p = projectWithHall(2000, 2000);
    const unknown = addCustomDef(p, makeDef({ id: 'test-noweight', gewicht_kg: null }));
    place(firstFloor(p), unknown, 500, 500);
    const l = floorLoad(p);
    expect(l.total.missingWeightCount).toBe(1);
    expect(l.total.weightKg).toBe(0);
  });

  it('Stockwerks-Grenzwert überschritten → Fehler-Warnung', () => {
    const p = projectWithHall(500, 500); // Netto (452 cm)² = 20,43 m²
    p.settings.floorLoadLimitKgM2 = 100;
    const heavy = addCustomDef(p, makeDef({ id: 'test-heavy2', gewicht_kg: 1000, breite_cm: 50, tiefe_cm: 50 }));
    place(firstFloor(p), heavy, 100, 100);
    place(firstFloor(p), heavy, 300, 300);
    place(firstFloor(p), heavy, 100, 300);
    const l = floorLoad(p);
    expect(l.floors[0].kgM2!).toBeGreaterThan(100);
    const w = warnings(p).find((x) => x.kind === 'floor-load');
    expect(w?.severity).toBe('error');
  });
});
