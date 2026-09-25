import { describe, it, expect } from 'vitest';
import { ATLANTIS_LIBRARY, PRIME_LIBRARY, ATLANTIS_DATA, PRIME_DATA, BUILTIN_LIBRARY, getDef } from './index';

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
