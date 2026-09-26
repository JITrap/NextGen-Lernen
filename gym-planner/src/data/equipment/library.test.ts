import { describe, it, expect } from 'vitest';
import { ATLANTIS_LIBRARY, PRIME_LIBRARY, ATLANTIS_DATA, PRIME_DATA, BUILTIN_LIBRARY, GENERIC_LIBRARY, PRICE_DATA, getDef, withPrice, priceEntry, PRICE_CONFIDENCE_LABELS } from './index';

describe('Bibliothek vs. Herstellerdaten (gym-planner/data/*.json)', () => {
  it('enthält alle 132 Atlantis- und 70 Prime-Einträge', () => {
    expect(ATLANTIS_DATA.anzahl).toBe(132);
    expect(PRIME_DATA.anzahl).toBe(70);
    expect(ATLANTIS_LIBRARY.length).toBe(132);
    expect(PRIME_LIBRARY.length).toBe(70);
  });
  it('alle Hersteller-Einträge sind verifiziert und haben exakt die Maße der Datendatei', () => {
    for (const raw of [...ATLANTIS_DATA.geraete, ...PRIME_DATA.geraete]) {
      const def = getDef(raw.id);
      expect(def, raw.id).toBeDefined();
      expect(def!.breite_cm).toBe(raw.breite_cm);
      expect(def!.tiefe_cm).toBe(raw.tiefe_cm);
      expect(def!.hoehe_cm).toBe(raw.hoehe_cm);
      expect(def!.gewicht_kg ?? null).toBe(raw.gewicht_kg ?? null);
      expect(def!.verifiziert).toBe(true);
      expect(def!.skalierbar).toBe(false);
      expect(def!.bereich).toBe('Kraftgeräte');
      expect(def!.muskelgruppe).toBeDefined();
    }
  });
  it('Stichproben: C513 Power Rack 165 × 203 × 246, Prime Hybrid Leg Press 120 × 191 × 181', () => {
    const rack = ATLANTIS_LIBRARY.find((d) => d.modell === 'C513')!;
    expect([rack.breite_cm, rack.tiefe_cm, rack.hoehe_cm]).toEqual([165, 203, 246]);
    const lp = PRIME_LIBRARY.find((d) => d.serie === 'Hybrid' && d.modell === 'Leg Press')!;
    expect([lp.breite_cm, lp.tiefe_cm, lp.hoehe_cm, lp.gewicht_kg]).toEqual([120, 191, 181, 524]);
    const hlp = PRIME_LIBRARY.find((d) => d.modell === 'HLP Plate Loaded Rack')!;
    expect(hlp.tiefe_cm).toBe(157);
    expect(hlp.hinweis).toContain('Tippfehler');
    const b7272 = ATLANTIS_LIBRARY.find((d) => d.modell === 'B7272')!;
    expect(b7272.gewicht_kg).toBe(123);
    expect(b7272.hinweis).toContain('fehlerhaft');
  });
  it('Serien-Anzahlen stimmen', () => {
    const count = (lib: typeof ATLANTIS_LIBRARY, serie: string) => lib.filter((d) => d.serie === serie).length;
    expect(count(ATLANTIS_LIBRARY, 'Precision Series')).toBe(39);
    expect(count(ATLANTIS_LIBRARY, 'Power Series')).toBe(26);
    expect(count(ATLANTIS_LIBRARY, 'Pro Series')).toBe(8);
    expect(count(ATLANTIS_LIBRARY, 'Bench Series')).toBe(25);
    expect(count(ATLANTIS_LIBRARY, 'Athletic Series')).toBe(18);
    expect(count(ATLANTIS_LIBRARY, 'Functional Trainer')).toBe(2);
    expect(count(ATLANTIS_LIBRARY, 'Rack-Module')).toBe(14);
    expect(count(PRIME_LIBRARY, 'Benches')).toBe(3);
    expect(count(PRIME_LIBRARY, 'Evolution')).toBe(12);
    expect(count(PRIME_LIBRARY, 'Hybrid')).toBe(25);
    expect(count(PRIME_LIBRARY, 'Plate Loaded')).toBe(17);
    expect(count(PRIME_LIBRARY, 'Prodigy Racks')).toBe(8);
    expect(count(PRIME_LIBRARY, 'Specialty')).toBe(4);
    expect(count(PRIME_LIBRARY, 'Wall Mounts')).toBe(1);
  });
  it('Rack-Module sind als nur-an-Rack markiert, Evolution trägt den Händler-Hinweis', () => {
    expect(ATLANTIS_LIBRARY.filter((d) => d.nur_an_rack).length).toBe(14);
    expect(PRIME_LIBRARY.filter((d) => d.serie === 'Evolution').every((d) => d.hinweis?.includes('Händler'))).toBe(true);
  });
  it('IDs sind eindeutig', () => {
    const ids = BUILTIN_LIBRARY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Bibliothekspreise (prices.json)', () => {
  it('jede Bibliotheks-ID hat einen Preis mit Quelle, Stand und Konfidenz; Bauelemente 0 € mit Hinweis', () => {
    expect(BUILTIN_LIBRARY.length).toBe(373);
    for (const def of BUILTIN_LIBRARY) {
      expect(typeof def.preis_eur, def.id).toBe('number');
      expect(def.preisQuelle, def.id).toBeTruthy();
      expect(def.preisStand, def.id).toMatch(/^\d{4}-\d{2}$/);
      expect(['liste', 'haendler', 'schaetzung'], def.id).toContain(def.preisKonfidenz);
      if (def.bereich === 'Bauelemente') {
        expect(def.preis_eur, def.id).toBe(0);
        expect(def.preisHinweis, def.id).toContain('Bestand');
      } else if (def.preis_eur === 0) {
        expect(def.preisHinweis, def.id).toBeTruthy();
      } else {
        expect(def.preis_eur!, def.id).toBeGreaterThan(0);
      }
    }
    expect(GENERIC_LIBRARY.filter((d) => d.bereich !== 'Bauelemente' && d.preis_eur === 0).length).toBeLessThanOrEqual(3);
  });
  it('jede ID in prices.json existiert in der Bibliothek, Datei hat Stand und Hinweis', () => {
    const ids = Object.keys(PRICE_DATA.preise);
    expect(ids.length).toBe(373);
    for (const id of ids) expect(getDef(id), id).toBeDefined();
    expect(PRICE_DATA.stand).toMatch(/^\d{4}-\d{2}$/);
    expect(PRICE_DATA.hinweis).toContain('MwSt');
    for (const [id, e] of Object.entries(PRICE_DATA.preise)) {
      expect(e.preis_eur, id).toBeGreaterThanOrEqual(0);
      expect(e.quelle, id).toBeTruthy();
      expect(['liste', 'haendler', 'schaetzung'], id).toContain(e.konfidenz);
    }
  });
  it('Merge: Rohdaten-Preis hat Vorrang (Listenpreis), unbekannte IDs bleiben ohne Preis, Größenordnungen stimmen', () => {
    const base = { ...getDef('atlantis-c513')!, preis_eur: undefined, preisQuelle: undefined, preisQuelleUrl: undefined, preisStand: undefined, preisKonfidenz: undefined, preisHinweis: undefined };
    const merged = withPrice(base);
    expect(merged.preis_eur).toBe(priceEntry('atlantis-c513')!.preis_eur);
    expect(merged.preisKonfidenz).toBe(priceEntry('atlantis-c513')!.konfidenz);
    expect(merged.preisQuelle).toBe(priceEntry('atlantis-c513')!.quelle);
    expect(merged.preisQuelleUrl).toBe(priceEntry('atlantis-c513')!.quelle_url);
    const own = withPrice({ ...base, preis_eur: 4321, quelle_url: 'https://example.org/x' });
    expect(own.preis_eur).toBe(4321);
    expect(own.preisKonfidenz).toBe('liste');
    expect(own.preisQuelle).toBe('Herstellerdaten');
    expect(own.preisQuelleUrl).toBe('https://example.org/x');
    const unknown = withPrice({ ...base, id: 'gibt-es-nicht' });
    expect(unknown.preis_eur).toBeUndefined();
    expect(priceEntry('gibt-es-nicht')).toBeUndefined();
    expect(priceEntry('__proto__')).toBeUndefined();
    expect(PRICE_CONFIDENCE_LABELS.schaetzung).toBe('Schätzung');
    // Richtwerte je Kategorie
    const hybrid = PRIME_LIBRARY.filter((d) => d.serie === 'Hybrid');
    expect(hybrid.every((d) => d.preis_eur! >= 9000 && d.preis_eur! <= 12000)).toBe(true);
    const precision = ATLANTIS_LIBRARY.filter((d) => d.serie === 'Precision Series');
    expect(precision.every((d) => d.preis_eur! >= 6000 && d.preis_eur! <= 9000)).toBe(true);
    expect(getDef('gen-cardio-laufband')!.preis_eur).toBe(9000);
    expect(getDef('gen-umkleide-spindreihe')!.preisHinweis).toContain('Abteil');
    expect(getDef('gen-functional-kunstrasen')!.preisHinweis).toContain('m²');
  });
});
