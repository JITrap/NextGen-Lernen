import { describe, it, expect } from 'vitest';
import { costs, costAssumptions, annuityMonthly, DEFAULT_COST_ASSUMPTIONS, COST_ASSUMPTION_FIELDS, IMPORT_MANUFACTURERS } from './costs';
import { areaBalance } from './areaBalance';
import { bom } from './bom';
import { priceQuantity, libraryItemPrice, priceUnitOf } from './priceUnits';
import { projectWithHall, firstFloor, addCustomDef, makeDef, place, addZone, fresh } from './testFixtures';
import { getDef } from '@/data/equipment';
import { getTemplate } from '@/data/templates';
import type { Project } from '@/types';

/** Halle 20 × 10 m (Wand 24 cm): Brutto 200 m², Netto (1952 × 952 cm) = 185,83 m². */
function synthetic(): Project {
  const p = projectWithHall(2000, 1000);
  const f = firstFloor(p);
  addZone(f, 100, 100, 1100, 900, 'Trainingsfläche Freihantel', 'Training'); // 10 × 8 m = 80 m² Trainingsfläche
  addZone(f, 1200, 100, 1700, 500, 'Umkleide Herren', 'Umkleide'); // 5 × 4 m = 20 m² Umkleide/Sanitär
  f.openings.push({ id: 'm1', kind: 'mirror', wallId: 'hall_0', offset: 500, width: 400, height: 220, side: 'a' });
  f.openings.push({ id: 'm2', kind: 'mirror', wallId: 'hall_1', offset: 300, width: 250, height: 220, side: 'a' });
  f.openings.push({ id: 'm3', kind: 'mirror', wallId: 'hall_2', offset: 300, width: 100, height: 220, side: 'a', hidden: true });
  const machine = addCustomDef(p, makeDef({ id: 't-machine', bereich: 'Kraftgeräte', hersteller: 'Prime', preis_eur: 10000 }));
  const bike = addCustomDef(p, makeDef({ id: 't-bike', bereich: 'Cardio', preis_eur: 3000 }));
  const noPrice = addCustomDef(p, makeDef({ id: 't-noprice', bereich: 'Cardio' }));
  place(f, machine, 300, 300);
  place(f, machine, 600, 300);
  place(f, bike, 300, 600, { priceEur: 2500 });
  place(f, noPrice, 600, 600);
  place(f, getDef('gen-sanitaer-einzeldusche')!, 1300, 200);
  place(f, getDef('gen-sanitaer-reihendusche')!, 1500, 200, { params: { plaetze: 3 } });
  place(f, getDef('gen-sanitaer-wc-kabine')!, 1300, 400);
  place(f, getDef('gen-sanitaer-urinal')!, 1500, 400);
  place(f, getDef('gen-umkleide-waschtisch-doppel')!, 1600, 450);
  return p;
}

describe('Kostenkalkulation', () => {
  it('rechnet Geräte je Bereich, Import, Ausbau nach Flächen, Sanitär nach Symbolen, Prozente und Kaution', () => {
    const p = synthetic();
    const c = costs(p);
    const a = c.assumptions;
    const bal = areaBalance(p).total;
    expect(bal.bruttoM2).toBeCloseTo(200, 6);
    expect(bal.nettoM2).toBeCloseTo(185.8304, 4);
    expect(c.flaechen.trainingM2).toBeCloseTo(80, 6);
    expect(c.flaechen.nassM2).toBeCloseTo(20, 6);
    expect(c.flaechen.spiegelM).toBeCloseTo(6.5, 6); // ausgeblendeter Spiegel zählt nicht
    expect(c.sanitaer).toEqual({ duschen: 4, wcs: 1, urinale: 1, waschtische: 2 });

    // Geräte je Bereich: 2 × 10.000 (Prime, Import) + Bike 2.500 (Objektpreis) + Sanitär-/Umkleideobjekte aus der Bibliothek
    const kraft = c.geraeteJeBereich.find((g) => g.bereich === 'Kraftgeräte')!;
    expect(kraft).toEqual({ bereich: 'Kraftgeräte', count: 2, summeEur: 20000, itemsWithoutPrice: 0 });
    const cardio = c.geraeteJeBereich.find((g) => g.bereich === 'Cardio')!;
    expect(cardio).toEqual({ bereich: 'Cardio', count: 2, summeEur: 2500, itemsWithoutPrice: 1 });
    expect(c.itemsWithoutPrice).toBe(1);
    expect(c.geraeteSummeEur).toBe(Math.round(bom(p).totalEur));
    const line = (id: string) => c.einmal.find((l) => l.id === id)!;
    expect(line('geraete:Cardio').hinweis).toBe('1 Objekt ohne Preis');
    expect(line('import').summeEur).toBe(Math.round((20000 * a.importNebenkostenProzent) / 100));
    expect(line('ausbau').summeEur).toBe(Math.round(bal.nettoM2 * a.ausbauEurM2));
    expect(line('boden-training').summeEur).toBe(Math.round(80 * a.bodenTrainingEurM2));
    expect(line('boden-nass').summeEur).toBe(Math.round(20 * a.bodenNassEurM2));
    expect(line('lueftung').summeEur).toBe(Math.round(bal.nettoM2 * a.lueftungEurM2));
    expect(line('spiegel').summeEur).toBe(Math.round(6.5 * a.spiegelEurM));
    expect(line('brandschutz').summeEur).toBe(Math.round(bal.nettoM2 * a.brandschutzEurM2));
    expect(line('sanitaer-duschen').summeEur).toBe(4 * a.sanitaerDuscheEur);
    expect(line('sanitaer-wc').summeEur).toBe(2 * a.sanitaerWcEur);
    expect(line('sanitaer-wc').hinweis).toBe('1 WC + 1 Urinale');
    expect(line('sanitaer-waschtische').summeEur).toBe(2 * a.sanitaerWaschtischEur);
    const ausbauSanitaer = c.einmal.filter((l) => l.gruppe === 'ausbau' || l.gruppe === 'sanitaer').reduce((s, l) => s + l.summeEur, 0);
    expect(line('planung').summeEur).toBe(Math.round((ausbauSanitaer * a.planungProzent) / 100));
    expect(line('sonstiges').summeEur).toBe(a.sonstigeEinmalEur);
    expect(line('kaution').summeEur).toBe(Math.round(a.kautionMonate * (a.mieteEurM2Monat + a.nebenkostenEurM2Monat) * 200));
    // Alle Summen ganze Euro, Gruppenreihenfolge Geräte → Ausbau → Sanitär → Planung → Sonstiges
    for (const l of [...c.einmal, ...c.monatlich]) expect(Number.isInteger(l.summeEur), l.id).toBe(true);
    const order = ['geraete', 'ausbau', 'sanitaer', 'planung', 'sonstiges'];
    const seen = c.einmal.map((l) => order.indexOf(l.gruppe));
    expect([...seen].sort((x, y) => x - y)).toEqual(seen);
  });

  it('Finanzierung: Geräte + Import nicht in der Einmalsumme, Annuität in den laufenden Kosten; Barkauf umgekehrt', () => {
    const p = synthetic();
    const fin = costs(p);
    expect(fin.assumptions.finanzierungJahre).toBe(5);
    expect(fin.finanziert).toBe(true);
    const financedLines = fin.einmal.filter((l) => l.finanziert);
    expect(financedLines.map((l) => l.gruppe)).toEqual(financedLines.map(() => 'geraete'));
    const unfinancedSum = fin.einmal.filter((l) => !l.finanziert).reduce((s, l) => s + l.summeEur, 0);
    expect(fin.einmalSummeEur).toBe(unfinancedSum);
    expect(fin.investitionSummeEur).toBe(fin.einmalSummeEur + fin.geraeteSummeEur + fin.importSummeEur);
    const rate = fin.monatlich.find((l) => l.id === 'finanzierung')!;
    expect(rate.summeEur).toBe(Math.round(annuityMonthly(fin.geraeteSummeEur + fin.importSummeEur, fin.assumptions.zinsProzent, fin.assumptions.finanzierungJahre)));
    // Unvorhergesehenes bezieht sich auf die gezählten (nicht finanzierten) Posten vor ihm, Kaution kommt danach
    const before = fin.einmal.slice(0, fin.einmal.findIndex((l) => l.id === 'unvorhergesehen')).filter((l) => !l.finanziert).reduce((s, l) => s + l.summeEur, 0);
    expect(fin.einmal.find((l) => l.id === 'unvorhergesehen')!.summeEur).toBe(Math.round((before * fin.assumptions.unvorhergesehenProzent) / 100));
    expect(fin.einmal[fin.einmal.length - 1].id).toBe('kaution');

    const bar = costs({ ...p, costs: { finanzierungJahre: 0 } });
    expect(bar.finanziert).toBe(false);
    expect(bar.einmal.some((l) => l.finanziert)).toBe(false);
    expect(bar.monatlich.some((l) => l.id === 'finanzierung')).toBe(false);
    expect(bar.einmalSummeEur).toBeGreaterThan(fin.einmalSummeEur + fin.geraeteSummeEur);
    expect(bar.investitionSummeEur).toBe(bar.einmalSummeEur);
    expect(bar.monatlichSummeEur).toBe(fin.monatlichSummeEur - rate.summeEur);
  });

  it('Kennzahlen: Jahr 1, € je m², Break-even, Wartung', () => {
    const p = synthetic();
    const c = costs(p);
    expect(c.jahr1SummeEur).toBe(c.einmalSummeEur + 12 * c.monatlichSummeEur);
    expect(c.kostenJeM2).toBe(Math.round(c.einmalSummeEur / 200));
    expect(c.breakEvenMitglieder).toBe(Math.ceil(c.monatlichSummeEur / 39));
    expect(c.monatlich.find((l) => l.id === 'wartung')!.summeEur).toBe(Math.round((c.geraeteSummeEur * c.assumptions.wartungProzentJahr) / 100 / 12));
    expect(c.monatlich.find((l) => l.id === 'miete')!.summeEur).toBe(Math.round(c.assumptions.mieteEurM2Monat * 200));
    const beitrag = costs({ ...p, costs: { mitgliedsbeitragEurMonat: 0 } });
    expect(beitrag.breakEvenMitglieder).toBe(0);
    const c2 = costs({ ...p, costs: { mitgliedsbeitragEurMonat: 50, personalEurMonat: 0 } });
    expect(c2.breakEvenMitglieder).toBe(Math.ceil(c2.monatlichSummeEur / 50));
    expect(c2.monatlichSummeEur).toBe(c.monatlichSummeEur - c.assumptions.personalEurMonat);
  });

  it('Annahmen: Standardwerte, ungültige Werte werden ersetzt, Felder vollständig beschrieben', () => {
    expect(costAssumptions({ costs: undefined })).toEqual(DEFAULT_COST_ASSUMPTIONS);
    const a = costAssumptions({ costs: { ausbauEurM2: 400, mieteEurM2Monat: -1, personalEurMonat: Number.NaN, zinsProzent: 0 } as never });
    expect(a.ausbauEurM2).toBe(400);
    expect(a.mieteEurM2Monat).toBe(DEFAULT_COST_ASSUMPTIONS.mieteEurM2Monat);
    expect(a.personalEurMonat).toBe(DEFAULT_COST_ASSUMPTIONS.personalEurMonat);
    expect(a.zinsProzent).toBe(0);
    const keys = Object.keys(DEFAULT_COST_ASSUMPTIONS).sort();
    expect(COST_ASSUMPTION_FIELDS.map((f) => f.key).sort()).toEqual(keys);
    for (const f of COST_ASSUMPTION_FIELDS) {
      expect(f.label.length).toBeGreaterThan(1);
      expect(f.einheit.length).toBeGreaterThan(0);
      expect(f.erklaerung.length).toBeGreaterThan(10);
    }
    // Zins 0 → lineare Rate
    expect(annuityMonthly(12000, 0, 1)).toBeCloseTo(1000, 9);
    expect(annuityMonthly(12000, 6, 0)).toBe(0);
    expect(annuityMonthly(0, 6, 5)).toBe(0);
    expect(annuityMonthly(100000, 6, 5)).toBeCloseTo(1933.28, 1);
    expect([...IMPORT_MANUFACTURERS]).toEqual(['Atlantis', 'Prime']);
  });

  it('memoisiert am Projekt-Objekt und reagiert auf geänderte Annahmen', () => {
    const p = synthetic();
    expect(costs(p)).toBe(costs(p));
    const q = fresh({ ...p, costs: { ausbauEurM2: DEFAULT_COST_ASSUMPTIONS.ausbauEurM2 + 100 } });
    expect(costs(q).einmalSummeEur).toBeGreaterThan(costs(p).einmalSummeEur);
  });

  it('leeres Projekt ohne Halle: keine Flächen, keine Miete, keine Objekte', () => {
    const p = projectWithHall(1000, 1000);
    p.floors[0].hall = null;
    const c = costs(p);
    expect(c.geraeteSummeEur).toBe(0);
    expect(c.einmal.find((l) => l.id === 'ausbau')!.summeEur).toBe(0);
    expect(c.monatlich.find((l) => l.id === 'miete')!.summeEur).toBe(0);
    expect(c.kostenJeM2).toBe(0);
    expect(c.finanziert).toBe(false);
    expect(c.einmalSummeEur).toBe(DEFAULT_COST_ASSUMPTIONS.sonstigeEinmalEur + Math.round((DEFAULT_COST_ASSUMPTIONS.sonstigeEinmalEur * DEFAULT_COST_ASSUMPTIONS.unvorhergesehenProzent) / 100));
  });

  it('Vorlage „Beispielstudio 1.000 m²“: plausible Größenordnung', () => {
    const p = getTemplate('beispiel-1000')!.create();
    const c = costs(p);
    expect(c.geraeteSummeEur).toBeGreaterThan(100000);
    expect(c.einmalSummeEur).toBeGreaterThan(400000);
    expect(c.einmalSummeEur).toBeLessThan(1200000);
    expect(c.investitionSummeEur).toBeGreaterThan(c.einmalSummeEur);
    expect(c.monatlichSummeEur).toBeGreaterThan(20000);
    expect(c.monatlichSummeEur).toBeLessThan(100000);
    expect(c.jahr1SummeEur).toBe(c.einmalSummeEur + 12 * c.monatlichSummeEur);
    expect(c.kostenJeM2).toBeGreaterThan(300);
    expect(c.kostenJeM2).toBeLessThan(1500);
    expect(c.breakEvenMitglieder).toBeGreaterThan(300);
    expect(c.itemsWithoutPrice).toBe(0);
    expect(c.sanitaer.duschen).toBeGreaterThan(0);
    expect(c.sanitaer.wcs).toBeGreaterThan(0);
    expect(c.flaechen.bruttoM2).toBeCloseTo(1000, 3);
    expect(c.geraeteJeBereich.map((g) => g.bereich)).toContain('Kraftgeräte');
    expect(c.geraeteJeBereich.find((g) => g.bereich === 'Bauelemente')?.summeEur ?? 0).toBe(0);
  });
});

describe('Preiseinheiten skalierbarer Objekte', () => {
  it('Spindreihe je Abteil (Fächer ÷ Stöcke), Kunstrasen je m², sonst Stück', () => {
    const row = getDef('gen-umkleide-spindreihe')!;
    expect(priceUnitOf(row)).toBe('Abteil');
    expect(priceQuantity({ width: 400, depth: 50 }, row)).toEqual({ einheit: 'Abteil', menge: 10 });
    expect(priceQuantity({ width: 400, depth: 50, params: { faecher: 20, stoeckig: 2 } }, row)).toEqual({ einheit: 'Abteil', menge: 10 });
    expect(priceQuantity({ width: 600, depth: 50, params: { faecher: '' } }, row).menge).toBe(15); // Breite ÷ 40 cm
    expect(libraryItemPrice({ width: 400, depth: 50 }, row)).toBe(row.preis_eur! * 10);
    const turf = getDef('gen-functional-kunstrasen')!;
    expect(priceUnitOf(turf)).toBe('m²');
    expect(priceQuantity({ width: 400, depth: 200 }, turf)).toEqual({ einheit: 'm²', menge: 8 });
    expect(libraryItemPrice({ width: 1000, depth: 150 }, turf)).toBe(turf.preis_eur! * 15);
    const rack = getDef('atlantis-c513')!;
    expect(priceUnitOf(rack)).toBe('Stück');
    expect(libraryItemPrice({ width: 1, depth: 1 }, rack)).toBe(rack.preis_eur);
    expect(libraryItemPrice({ width: 1, depth: 1 }, undefined)).toBeNull();
    expect(priceUnitOf(undefined)).toBe('Stück');
  });

  it('Stückliste: Spindreihe mit 10 Abteilen kostet 10 × Bibliothekspreis; Objektpreis gilt je Stück', () => {
    const p = projectWithHall(2500, 2000);
    const row = getDef('gen-umkleide-spindreihe')!;
    place(firstFloor(p), row, 300, 300);
    place(firstFloor(p), row, 300, 600, { priceEur: 1234 });
    const b = bom(p);
    expect(b.totalEur).toBe(row.preis_eur! * 10 + 1234);
  });
});
