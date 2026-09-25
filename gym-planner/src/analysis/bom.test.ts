import { describe, it, expect } from 'vitest';
import { bom } from './bom';
import { projectWithHall, firstFloor, addCustomDef, makeDef, place, addFloor } from './testFixtures';
import { getDef } from '@/data/equipment';

describe('Stückliste', () => {
  it('zählt 3× gleiches Gerät mit Preis 1000 → Summe 3000', () => {
    const p = projectWithHall(2500, 2000);
    const rack = getDef('atlantis-c513')!;
    const f = firstFloor(p);
    for (let i = 0; i < 3; i++) place(f, rack, 300 + i * 300, 300, { priceEur: 1000 });
    const b = bom(p);
    expect(b.lines.length).toBe(1);
    const line = b.lines[0];
    expect(line.count).toBe(3);
    expect(line.unitPriceEur).toBe(1000);
    expect(line.priceMixed).toBe(false);
    expect(line.totalEur).toBe(3000);
    expect(line.hersteller).toBe('Atlantis');
    expect(line.serie).toBe('Athletic Series');
    expect(line.modell).toBe('C513');
    expect(line.dims).toBe('165 × 203 × 246 cm');
    expect(line.weightKg).toBe(253);
    expect(line.totalWeightKg).toBe(759);
    expect(b.totalEur).toBe(3000);
    expect(b.totalWeightKg).toBe(759);
    expect(b.totalCount).toBe(3);
    expect(b.linesWithoutPrice).toBe(0);
  });

  it('unterschiedliche Preise → Mittelwert und Flag', () => {
    const p = projectWithHall(2500, 2000);
    const rack = getDef('atlantis-c513')!;
    place(firstFloor(p), rack, 300, 300, { priceEur: 1000 });
    place(firstFloor(p), rack, 600, 300, { priceEur: 2000 });
    const line = bom(p).lines[0];
    expect(line.unitPriceEur).toBe(1500);
    expect(line.priceMixed).toBe(true);
    expect(line.totalEur).toBe(3000);
  });

  it('ohne Objektpreis: Preisüberschreibung, dann Bibliothekspreis, sonst ohne Preis', () => {
    const p = projectWithHall(2500, 2000);
    const withPrice = addCustomDef(p, makeDef({ id: 't-price', preis_eur: 250 }));
    const noPrice = addCustomDef(p, makeDef({ id: 't-noprice' }));
    p.priceOverrides['t-price'] = 300;
    place(firstFloor(p), withPrice, 300, 300);
    place(firstFloor(p), noPrice, 600, 300);
    const b = bom(p);
    expect(b.lines.find((l) => l.defId === 't-price')!.unitPriceEur).toBe(300);
    expect(b.lines.find((l) => l.defId === 't-noprice')!.unitPriceEur).toBeNull();
    expect(b.linesWithoutPrice).toBe(1);
    expect(b.totalEur).toBe(300);
    delete p.priceOverrides['t-price'];
    expect(bom({ ...p }).lines.find((l) => l.defId === 't-price')!.unitPriceEur).toBe(250);
  });

  it('gruppiert über Stockwerke und führt Mengenpositionen ohne Stellfläche', () => {
    const p = projectWithHall(2500, 2000);
    const plates = addCustomDef(p, makeDef({ id: 't-plates', name: 'Hantelscheiben', ohne_stellflaeche: true, gewicht_kg: 20 }));
    const og = addFloor(p);
    place(firstFloor(p), plates, 300, 300);
    place(og, plates, 300, 300);
    place(og, plates, 400, 300);
    const b = bom(p);
    const line = b.lines[0];
    expect(line.count).toBe(3);
    expect(line.ohneStellflaeche).toBe(true);
    expect(line.floorCounts.map((f) => f.count)).toEqual([1, 2]);
    expect(b.totalWeightKg).toBe(60);
  });

  it('unbekannte Bibliotheks-ID bleibt als Position erhalten', () => {
    const p = projectWithHall(2500, 2000);
    firstFloor(p).items.push({ id: 'x', kind: 'equipment', defId: 'gibt-es-nicht', x: 100, y: 100, rotation: 0, width: 50, depth: 50, height: null, safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: false });
    const line = bom(p).lines[0];
    expect(line.unknownDef).toBe(true);
    expect(line.count).toBe(1);
    expect(line.dims).toBe('50 × 50 cm');
  });
});
