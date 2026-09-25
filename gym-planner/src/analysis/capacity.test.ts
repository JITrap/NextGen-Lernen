import { describe, it, expect } from 'vitest';
import { capacity } from './capacity';
import { warnings } from './warnings';
import { projectWithHall, firstFloor, addZone, addCustomDef, makeDef, place } from './testFixtures';

describe('Kapazität', () => {
  it('400 m² Trainingsfläche / 8 m² → 50 Personen', () => {
    const p = projectWithHall(3000, 3000);
    p.settings.m2PerPerson = 8;
    addZone(firstFloor(p), 100, 100, 2100, 2100, 'Trainingsfläche Freihantel');
    const c = capacity(p);
    expect(c.trainingM2).toBeCloseTo(400, 6);
    expect(c.persons).toBe(50);
    expect(c.counters.find((x) => x.key === 'lockers')!.required).toBe(50);
    expect(c.counters.find((x) => x.key === 'showers')!.required).toBe(4);
    expect(c.counters.find((x) => x.key === 'showers')!.recommended).toBe(5);
    expect(c.counters.find((x) => x.key === 'toilets')!.required).toBe(2);
    expect(c.counters.find((x) => x.key === 'showers')!.hint).toBe('Zu wenige Duschen: 0 vorhanden, mind. 4 empfohlen (1 Dusche je 10–15 Personen).');
    expect(warnings(p).some((w) => w.kind === 'capacity')).toBe(true);
  });

  it('zählt Spinde, Duschen, WCs und Urinale über Symbole und Parameter', () => {
    const p = projectWithHall(3000, 3000);
    p.settings.m2PerPerson = 8;
    const f = firstFloor(p);
    addZone(f, 100, 100, 2100, 2100, 'Maschinen');
    const lockerRow = addCustomDef(p, makeDef({ id: 't-locker-row', symbol: 'locker-row', bereich: 'Umkleide', breite_cm: 800, tiefe_cm: 50, params: { faecher: 30 } }));
    const lockerRowNoParams = addCustomDef(p, makeDef({ id: 't-locker-row2', symbol: 'locker-row', bereich: 'Umkleide', breite_cm: 800, tiefe_cm: 50 }));
    const shower = addCustomDef(p, makeDef({ id: 't-shower', symbol: 'shower', bereich: 'Umkleide', breite_cm: 90, tiefe_cm: 90 }));
    const showerRow = addCustomDef(p, makeDef({ id: 't-shower-row', symbol: 'shower-row', bereich: 'Umkleide', breite_cm: 270, tiefe_cm: 90 }));
    const toilet = addCustomDef(p, makeDef({ id: 't-wc', symbol: 'toilet', bereich: 'Sanitär', breite_cm: 90, tiefe_cm: 150 }));
    const urinal = addCustomDef(p, makeDef({ id: 't-urinal', symbol: 'urinal', bereich: 'Sanitär', breite_cm: 40, tiefe_cm: 40 }));
    place(f, lockerRow, 2500, 200);
    place(f, lockerRowNoParams, 2500, 400); // 800 / 40 = 20 Fächer
    place(f, shower, 2500, 600);
    place(f, showerRow, 2500, 800); // 270 / 90 = 3
    place(f, toilet, 2500, 1000);
    place(f, urinal, 2500, 1200);
    const c = capacity(p);
    expect(c.persons).toBe(50);
    expect(c.lockers).toBe(50);
    expect(c.showers).toBe(4);
    expect(c.toilets).toBe(1);
    expect(c.urinals).toBe(1);
    const lockers = c.counters.find((x) => x.key === 'lockers')!;
    const showers = c.counters.find((x) => x.key === 'showers')!;
    const wcs = c.counters.find((x) => x.key === 'toilets')!;
    expect(lockers.status).toBe('ok');
    expect(showers.status).toBe('warn'); // 4 ≥ Minimum 4, aber < empfohlen 5
    expect(showers.hint).toBeNull();
    expect(wcs.actual).toBe(2);
    expect(wcs.status).toBe('ok');
    expect(warnings(p).some((w) => w.kind === 'capacity')).toBe(false);
  });

  it('ohne Räume gilt die Nettofläche als Trainingsfläche', () => {
    const p = projectWithHall(1000, 1000); // Netto 9,52² = 90,59 m²
    p.settings.m2PerPerson = 9;
    const c = capacity(p);
    expect(c.usedNettoFallback).toBe(true);
    expect(c.trainingM2).toBeCloseTo(90.5904, 3);
    expect(c.persons).toBe(10);
  });

  it('ungültige m²/Person → 0 Personen, keine Hinweise', () => {
    const p = projectWithHall(1000, 1000);
    p.settings.m2PerPerson = 0;
    const c = capacity(p);
    expect(c.persons).toBe(0);
    expect(c.counters.every((x) => x.status === 'ok')).toBe(true);
  });
});
