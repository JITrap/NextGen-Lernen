/**
 * Kostenkalkulation (Gerüst): Geräte aus der Stückliste (Bibliothekspreise, Überschreibungen, Objektpreise),
 * Ausbau nach Flächen (Nettofläche, Trainingsfläche, Sanitär), Sanitärinstallation nach Objekten, Planung,
 * Unvorhergesehenes, Kaution sowie laufende Kosten je Monat und Finanzierungsrate. Annahmen: project.costs,
 * ergänzt um DEFAULT_COST_ASSUMPTIONS.
 */
import type { Project, CostAssumptions } from '@/types';
import { memoByProject } from './common';

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  ausbauEurM2: 350,
  bodenTrainingEurM2: 70,
  bodenNassEurM2: 120,
  lueftungEurM2: 90,
  spiegelEurM: 450,
  brandschutzEurM2: 25,
  sanitaerDuscheEur: 2500,
  sanitaerWcEur: 1800,
  sanitaerWaschtischEur: 900,
  planungProzent: 12,
  importNebenkostenProzent: 18,
  unvorhergesehenProzent: 10,
  kautionMonate: 3,
  sonstigeEinmalEur: 25000,
  mieteEurM2Monat: 9,
  nebenkostenEurM2Monat: 3,
  personalEurMonat: 18000,
  sonstigesEurMonat: 4000,
  wartungProzentJahr: 3,
  finanzierungJahre: 5,
  zinsProzent: 6,
};

export type CostGroup = 'geraete' | 'ausbau' | 'sanitaer' | 'planung' | 'sonstiges' | 'laufend';

export interface CostLine {
  id: string;
  gruppe: CostGroup;
  bezeichnung: string;
  menge: number;
  einheit: string;
  einzelpreisEur: number;
  summeEur: number;
  hinweis?: string;
}

export interface CostReport {
  assumptions: CostAssumptions;
  /** Einmalkosten (Geräte, Ausbau, Sanitär, Planung, Sonstiges). */
  einmal: CostLine[];
  einmalSummeEur: number;
  geraeteSummeEur: number;
  /** Objekte ohne Preis (nicht in der Summe). */
  itemsWithoutPrice: number;
  /** Laufende Kosten je Monat (inkl. Finanzierungsrate, falls Laufzeit > 0). */
  monatlich: CostLine[];
  monatlichSummeEur: number;
  /** Gesamtbedarf im ersten Jahr (Einmalkosten + 12 Monate laufend). */
  jahr1SummeEur: number;
}

/** Vollständige Annahmen eines Projekts (Standardwerte ergänzt). */
export function costAssumptions(project: Project): CostAssumptions {
  return { ...DEFAULT_COST_ASSUMPTIONS, ...(project.costs ?? {}) };
}

export const costs = memoByProject((project: Project): CostReport => ({
  assumptions: costAssumptions(project),
  einmal: [],
  einmalSummeEur: 0,
  geraeteSummeEur: 0,
  itemsWithoutPrice: 0,
  monatlich: [],
  monatlichSummeEur: 0,
  jahr1SummeEur: 0,
}));
