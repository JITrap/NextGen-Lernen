import { describe, it, expect } from 'vitest';
import { areaBalance, equipmentStats, floorLoad, capacity, bom, warnings } from './index';
import { projectWithHall, firstFloor, addZone, place } from './testFixtures';
import { BUILTIN_LIBRARY } from '@/data/equipment';
import { cloneDeep } from '@/store/factories';
import type { Project } from '@/types';

function bigProject(): Project {
  const p = projectWithHall(6000, 4000);
  const f = firstFloor(p);
  addZone(f, 100, 100, 3000, 1900, 'Maschinen');
  addZone(f, 3000, 100, 5900, 1900, 'Cardio');
  addZone(f, 100, 2000, 2000, 3900, 'Umkleide Herren');
  addZone(f, 2000, 2000, 5900, 3900, 'Trainingsfläche Freihantel');
  f.walls.push({ id: 'w1', start: { x: 3000, y: 24 }, end: { x: 3000, y: 2000 }, thickness: 12.5, type: 'Trockenbau', height: null });
  const defs = BUILTIN_LIBRARY.filter((d) => !d.nur_an_rack).slice(0, 60);
  for (let i = 0; i < 500; i++) {
    const def = defs[i % defs.length];
    const col = i % 25;
    const row = Math.floor(i / 25);
    place(f, def, 150 + col * 230, 150 + row * 190, { rotation: (i % 4) * 90, priceEur: 1000 + (i % 7) * 100 });
  }
  return p;
}

describe('Laufzeit mit 500 Objekten', () => {
  const fns: [string, (p: Project) => unknown][] = [
    ['areaBalance', areaBalance], ['equipmentStats', equipmentStats], ['floorLoad', floorLoad],
    ['capacity', capacity], ['bom', bom], ['warnings', warnings],
  ];
  // Aufwärmen (JIT), damit die Messung die Algorithmen misst.
  const warm = bigProject();
  for (const [, fn] of fns) fn(warm);

  // Bestes von drei Läufen auf jeweils frischen Klonen (kalte Caches), damit parallel laufende
  // Test-Worker/GC-Pausen das Ergebnis nicht verfälschen.
  for (const [name, fn] of fns) {
    it(`${name} < 100 ms`, () => {
      let best = Infinity;
      for (let run = 0; run < 3; run++) {
        const p = cloneDeep(bigProject());
        const t0 = performance.now();
        fn(p);
        best = Math.min(best, performance.now() - t0);
      }
      expect(best).toBeLessThan(100);
    });
  }
  it('liefert plausible Ergebnisse', () => {
    const p = bigProject();
    expect(equipmentStats(p).total.itemCount).toBe(500);
    expect(bom(p).totalCount).toBe(500);
    expect(warnings(p).length).toBeGreaterThan(0);
  });
});
