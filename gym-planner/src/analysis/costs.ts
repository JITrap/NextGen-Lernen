/**
 * Kostenkalkulation (projektweit, netto EUR, ganze Euro):
 *
 * Einmalkosten
 *   - Geräte je Bibliotheksbereich aus der Stückliste (bom): Objektpreis → Projekt-Überschreibung → Bibliothekspreis
 *     (skalierbare Objekte je Abteil/m², siehe priceUnits.ts); Objekte ohne Preis werden gezählt und ausgewiesen.
 *   - Import-Nebenkosten: importNebenkostenProzent × Gerätesumme der Übersee-Hersteller (Atlantis, Prime).
 *   - Ausbau nach Flächen (areaBalance/capacity): Grundausbau, Lüftung und Brandschutz je m² Netto, Sportboden je m²
 *     Trainingsfläche, Nassbereich-Boden je m² Umkleide/Sanitär, Spiegelwände je m (Öffnungen „mirror“).
 *   - Sanitärinstallation je Dusche / WC + Urinal / Waschtisch (Symbole shower, shower-row, toilet, urinal, sink).
 *   - Planung (Prozent der Ausbau- + Sanitärsumme), Sonstiges pauschal, Unvorhergesehenes (Prozent der bis dahin
 *     gezählten Einmalposten), Kaution (Monate × (Miete + Nebenkosten) × Bruttofläche; nicht in „Unvorhergesehenes“).
 *
 * Laufend je Monat: Miete und Nebenkosten je Brutto-m², Personal, Sonstiges, Wartung (Prozent des Gerätewerts je
 * Jahr ÷ 12) und – bei finanzierungJahre > 0 – die Annuität auf Geräte + Import. Bei Finanzierung zählen Geräte und
 * Import NICHT zur Einmalsumme (sie stecken in der Rate); die Zeilen bleiben zur Information mit `finanziert: true`.
 *
 * Kennzahlen: einmalSummeEur, geraeteSummeEur, monatlichSummeEur, jahr1SummeEur (= Einmal + 12 × monatlich),
 * kostenJeM2 (Einmalkosten je Brutto-m²), breakEvenMitglieder (monatlich ÷ Mitgliedsbeitrag, aufgerundet).
 * Annahmen: project.costs, ergänzt um DEFAULT_COST_ASSUMPTIONS.
 */
import type { Project, CostAssumptions, LibraryArea } from '@/types';
import { analysisContext, memoByProject, numParam, symbolOf } from './common';
import { areaBalance } from './areaBalance';
import { capacity, countFacilities } from './capacity';
import { bom } from './bom';

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
  mitgliedsbeitragEurMonat: 39,
};

/** Hersteller, deren Geräte importiert werden (Fracht/Zoll/EUSt). */
export const IMPORT_MANUFACTURERS: ReadonlySet<string> = new Set(['Atlantis', 'Prime']);

export type CostGroup = 'geraete' | 'ausbau' | 'sanitaer' | 'planung' | 'sonstiges' | 'laufend';

export const COST_GROUP_LABELS: Record<CostGroup, string> = {
  geraete: 'Geräte',
  ausbau: 'Ausbau',
  sanitaer: 'Sanitär',
  planung: 'Planung',
  sonstiges: 'Sonstiges',
  laufend: 'Laufend',
};

export type CostAssumptionGroup = 'ausbau' | 'sanitaer' | 'prozent' | 'einmal' | 'laufend' | 'finanzierung';

export const COST_ASSUMPTION_GROUP_LABELS: Record<CostAssumptionGroup, string> = {
  ausbau: 'Ausbau je Fläche',
  sanitaer: 'Sanitärinstallation je Stück',
  prozent: 'Zuschläge in Prozent',
  einmal: 'Einmalig pauschal',
  laufend: 'Laufend je Monat',
  finanzierung: 'Finanzierung & Beitrag',
};

/** Beschreibung eines Annahme-Felds (Label, Einheit, Erklärung) – für Panel, PDF und CSV. */
export interface CostAssumptionField {
  key: keyof CostAssumptions;
  label: string;
  einheit: string;
  erklaerung: string;
  gruppe: CostAssumptionGroup;
  /** Nachkommastellen in der Eingabe (Standard 0). */
  decimals?: number;
  step?: number;
  max?: number;
}

export const COST_ASSUMPTION_FIELDS: readonly CostAssumptionField[] = [
  { key: 'ausbauEurM2', label: 'Grundausbau', einheit: '€/m²', erklaerung: 'Trockenbau, Elektro, Beleuchtung, Maler – je m² Nettofläche', gruppe: 'ausbau', step: 10 },
  { key: 'bodenTrainingEurM2', label: 'Sportboden', einheit: '€/m²', erklaerung: 'Gummi-/Kautschukboden verlegt – je m² Trainingsfläche', gruppe: 'ausbau', step: 5 },
  { key: 'bodenNassEurM2', label: 'Nassbereich-Boden', einheit: '€/m²', erklaerung: 'Fliesen/Vinyl verlegt – je m² Umkleide/Sanitär', gruppe: 'ausbau', step: 5 },
  { key: 'lueftungEurM2', label: 'Lüftung (RLT)', einheit: '€/m²', erklaerung: 'Lüftungsanlage – je m² Nettofläche', gruppe: 'ausbau', step: 5 },
  { key: 'spiegelEurM', label: 'Spiegelwände', einheit: '€/m', erklaerung: 'je laufendem Meter Spiegel (Höhe ca. 2,2 m), Öffnungen vom Typ Spiegel', gruppe: 'ausbau', step: 10 },
  { key: 'brandschutzEurM2', label: 'Brandschutz', einheit: '€/m²', erklaerung: 'Brandmelder, Sicherheitsbeleuchtung, Rettungszeichen – je m² Nettofläche', gruppe: 'ausbau', step: 5 },
  { key: 'sanitaerDuscheEur', label: 'Dusche', einheit: '€/Stk.', erklaerung: 'Anschluss und Armatur je Dusche (Duschen und Reihenduschen)', gruppe: 'sanitaer', step: 100 },
  { key: 'sanitaerWcEur', label: 'WC / Urinal', einheit: '€/Stk.', erklaerung: 'Anschluss je WC-Kabine oder Urinal', gruppe: 'sanitaer', step: 100 },
  { key: 'sanitaerWaschtischEur', label: 'Waschtisch', einheit: '€/Stk.', erklaerung: 'Anschluss je Waschplatz (Doppelwaschtisch = 2, Waschrinne je 60 cm)', gruppe: 'sanitaer', step: 100 },
  { key: 'planungProzent', label: 'Planung / Genehmigung', einheit: '%', erklaerung: 'Architekt, Brandschutzkonzept, Nutzungsänderung – Prozent der Ausbau- und Sanitärsumme', gruppe: 'prozent', decimals: 1, step: 1, max: 100 },
  { key: 'importNebenkostenProzent', label: 'Import-Nebenkosten', einheit: '%', erklaerung: 'Fracht, Zoll, Einfuhrumsatzsteuer – Prozent der Gerätesumme von Atlantis und Prime', gruppe: 'prozent', decimals: 1, step: 1, max: 100 },
  { key: 'unvorhergesehenProzent', label: 'Unvorhergesehenes', einheit: '%', erklaerung: 'Prozent der vorherigen Einmalposten (ohne Kaution)', gruppe: 'prozent', decimals: 1, step: 1, max: 100 },
  { key: 'sonstigeEinmalEur', label: 'Sonstiges einmalig', einheit: '€', erklaerung: 'Eröffnungsmarketing, Software/Zutrittssystem, Kleinmaterial', gruppe: 'einmal', step: 1000 },
  { key: 'kautionMonate', label: 'Kaution', einheit: 'Monate', erklaerung: 'Monatsmieten (Miete + Nebenkosten) als Mietsicherheit', gruppe: 'einmal', step: 1, max: 12 },
  { key: 'mieteEurM2Monat', label: 'Miete', einheit: '€/m²', erklaerung: 'Kaltmiete je m² Bruttofläche und Monat', gruppe: 'laufend', decimals: 2, step: 0.5 },
  { key: 'nebenkostenEurM2Monat', label: 'Nebenkosten', einheit: '€/m²', erklaerung: 'Heizung, Strom, Wasser, Reinigung je m² Bruttofläche und Monat', gruppe: 'laufend', decimals: 2, step: 0.5 },
  { key: 'personalEurMonat', label: 'Personal', einheit: '€/Monat', erklaerung: 'Löhne inkl. Nebenkosten je Monat', gruppe: 'laufend', step: 500 },
  { key: 'sonstigesEurMonat', label: 'Sonstiges laufend', einheit: '€/Monat', erklaerung: 'Versicherung, Marketing, Software, Musiklizenzen je Monat', gruppe: 'laufend', step: 250 },
  { key: 'wartungProzentJahr', label: 'Wartung', einheit: '%/Jahr', erklaerung: 'Prozent des Gerätewerts je Jahr (÷ 12 je Monat)', gruppe: 'laufend', decimals: 1, step: 0.5, max: 100 },
  { key: 'finanzierungJahre', label: 'Finanzierung', einheit: 'Jahre', erklaerung: 'Laufzeit der Gerätefinanzierung; 0 = Barkauf (Geräte + Import zählen dann zu den Einmalkosten)', gruppe: 'finanzierung', step: 1, max: 30 },
  { key: 'zinsProzent', label: 'Zins', einheit: '% p. a.', erklaerung: 'Nominalzins der Finanzierung (Annuität, monatliche Rate)', gruppe: 'finanzierung', decimals: 2, step: 0.5, max: 100 },
  { key: 'mitgliedsbeitragEurMonat', label: 'Mitgliedsbeitrag', einheit: '€/Monat', erklaerung: 'Durchschnittlicher Beitrag je Mitglied – Break-even-Mitglieder = laufende Kosten ÷ Beitrag', gruppe: 'finanzierung', decimals: 2, step: 1 },
];

export interface CostLine {
  id: string;
  gruppe: CostGroup;
  bezeichnung: string;
  /** Menge in `einheit` (bei Prozent-Positionen der Prozentsatz, Einzelpreis = Basisbetrag). */
  menge: number;
  einheit: string;
  einzelpreisEur: number;
  /** Ganze Euro. */
  summeEur: number;
  hinweis?: string;
  /** Wird über die Finanzierungsrate bezahlt und zählt nicht zur Einmalsumme. */
  finanziert?: boolean;
  /** Objekte dieser Position ohne Preis (nur Gerätezeilen). */
  itemsWithoutPrice?: number;
}

export interface CostAreaSum {
  bereich: LibraryArea;
  count: number;
  summeEur: number;
  itemsWithoutPrice: number;
}

export interface CostReport {
  assumptions: CostAssumptions;
  /** Einmalkosten (Geräte, Import, Ausbau, Sanitär, Planung, Sonstiges) in Anzeigereihenfolge. */
  einmal: CostLine[];
  /** Summe der Einmalposten ohne finanzierte Zeilen. */
  einmalSummeEur: number;
  geraeteSummeEur: number;
  importSummeEur: number;
  /** Geräte + Import werden über eine Rate finanziert (finanzierungJahre > 0 und Gerätesumme > 0). */
  finanziert: boolean;
  /** Gesamtinvestition: Einmalsumme + finanzierte Geräte/Import. */
  investitionSummeEur: number;
  /** Objekte ohne Preis (nicht in der Summe). */
  itemsWithoutPrice: number;
  /** Laufende Kosten je Monat (inkl. Finanzierungsrate, falls Laufzeit > 0). */
  monatlich: CostLine[];
  monatlichSummeEur: number;
  /** Gesamtbedarf im ersten Jahr (Einmalkosten + 12 Monate laufend). */
  jahr1SummeEur: number;
  /** Einmalkosten je m² Bruttofläche (0 ohne Halle). */
  kostenJeM2: number;
  /** Mitglieder, ab denen die laufenden Kosten gedeckt sind (aufgerundet; 0 ohne Beitrag). */
  breakEvenMitglieder: number;
  geraeteJeBereich: CostAreaSum[];
  flaechen: { bruttoM2: number; nettoM2: number; trainingM2: number; nassM2: number; spiegelM: number };
  sanitaer: { duschen: number; wcs: number; urinale: number; waschtische: number };
}

const LIBRARY_AREA_ORDER: LibraryArea[] = [
  'Kraftgeräte', 'Freihantel-Zubehör', 'Cardio', 'Functional', 'Kursraum', 'Empfang & Lounge', 'Umkleide', 'Sanitär', 'Wellness',
  'Büro & Personal', 'Lager & Technik', 'Ausstattung', 'Bauelemente', 'Eigene',
];

const ASSUMPTION_KEYS = Object.keys(DEFAULT_COST_ASSUMPTIONS) as (keyof CostAssumptions)[];

/** Gültiger Annahmewert: endliche Zahl ≥ 0. */
export function isValidCostValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** Vollständige Annahmen eines Projekts (Standardwerte ergänzt, ungültige Werte durch Standard ersetzt). */
export function costAssumptions(project: Pick<Project, 'costs'>): CostAssumptions {
  const out: CostAssumptions = { ...DEFAULT_COST_ASSUMPTIONS };
  const c = project.costs;
  if (!c) return out;
  for (const k of ASSUMPTION_KEYS) {
    const v = (c as Partial<Record<keyof CostAssumptions, unknown>>)[k];
    if (isValidCostValue(v)) out[k] = v;
  }
  return out;
}

const eur = (v: number): number => (Number.isFinite(v) ? Math.round(v) : 0);

/** Monatliche Annuität auf `principal` bei `zinsProzent` p. a. über `jahre` (0 Jahre → 0). */
export function annuityMonthly(principal: number, zinsProzent: number, jahre: number): number {
  const n = Math.round(jahre * 12);
  if (!(principal > 0) || !(n > 0)) return 0;
  const r = zinsProzent / 100 / 12;
  if (r <= 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

/** Waschplätze eines Objekts mit Symbol „sink“: params.plaetze/anzahl, sonst Breite ÷ 60 cm. */
function sinkPlaces(width: number, plaetze: number | null): number {
  return Math.max(1, Math.round(plaetze ?? width / 60));
}

export const costs = memoByProject((project: Project): CostReport => {
  const a = costAssumptions(project);
  const ctx = analysisContext(project);
  const balance = areaBalance(project).total;
  const cap = capacity(project);
  const list = bom(project);

  /* ---- Flächen und Zählungen ---- */
  const bruttoM2 = balance.bruttoM2;
  const nettoM2 = balance.nettoM2;
  const trainingM2 = cap.trainingM2;
  const nassM2 = balance.byClass.find((c) => c.areaClass === 'Umkleide/Sanitär')?.m2 ?? 0;
  let spiegelM = 0;
  let waschtische = 0;
  let duschen = 0;
  let wcs = 0;
  let urinale = 0;
  for (const fc of ctx.floors) {
    for (const o of fc.floor.openings) if (o.kind === 'mirror' && !o.hidden) spiegelM += o.width / 100;
    const fac = countFacilities(fc, ctx);
    duschen += fac.showers;
    wcs += fac.toilets;
    urinale += fac.urinals;
    for (const it of fc.items) {
      const def = ctx.def(it.defId);
      if (symbolOf(def) === 'sink') waschtische += sinkPlaces(it.width, numParam(it, def, 'plaetze') ?? numParam(it, def, 'anzahl'));
    }
  }

  /* ---- Geräte je Bereich ---- */
  const byArea = new Map<LibraryArea, CostAreaSum>();
  let importBase = 0;
  for (const line of list.lines) {
    const def = ctx.def(line.defId);
    const bereich: LibraryArea = def?.bereich ?? 'Eigene';
    const acc = byArea.get(bereich) ?? { bereich, count: 0, summeEur: 0, itemsWithoutPrice: 0 };
    acc.count += line.count;
    acc.summeEur += line.totalEur ?? 0;
    acc.itemsWithoutPrice += line.itemsWithoutPrice;
    byArea.set(bereich, acc);
    if (IMPORT_MANUFACTURERS.has(line.hersteller)) importBase += line.totalEur ?? 0;
  }
  const geraeteJeBereich: CostAreaSum[] = LIBRARY_AREA_ORDER.filter((b) => byArea.has(b)).map((b) => {
    const s = byArea.get(b)!;
    return { ...s, summeEur: eur(s.summeEur) };
  });
  const geraeteSummeEur = geraeteJeBereich.reduce((s, g) => s + g.summeEur, 0);
  const importSummeEur = eur((importBase * a.importNebenkostenProzent) / 100);
  const finanziert = a.finanzierungJahre > 0 && geraeteSummeEur + importSummeEur > 0;

  /* ---- Einmalkosten ---- */
  const einmal: CostLine[] = [];
  for (const g of geraeteJeBereich) {
    einmal.push({
      id: `geraete:${g.bereich}`,
      gruppe: 'geraete',
      bezeichnung: g.bereich,
      menge: g.count,
      einheit: 'Stk.',
      einzelpreisEur: g.count > 0 ? g.summeEur / g.count : 0,
      summeEur: g.summeEur,
      hinweis: g.itemsWithoutPrice > 0 ? `${g.itemsWithoutPrice} ${g.itemsWithoutPrice === 1 ? 'Objekt' : 'Objekte'} ohne Preis` : g.bereich === 'Bauelemente' ? 'Bestand/Bauleistung (0 €)' : undefined,
      finanziert: finanziert || undefined,
      itemsWithoutPrice: g.itemsWithoutPrice,
    });
  }
  if (importBase > 0) {
    einmal.push({
      id: 'import',
      gruppe: 'geraete',
      bezeichnung: 'Import-Nebenkosten',
      menge: a.importNebenkostenProzent,
      einheit: '%',
      einzelpreisEur: eur(importBase),
      summeEur: importSummeEur,
      hinweis: `Fracht, Zoll, EUSt auf ${[...IMPORT_MANUFACTURERS].join('/')}-Geräte`,
      finanziert: finanziert || undefined,
    });
  }
  const perM2 = (id: string, gruppe: CostGroup, bezeichnung: string, m2: number, preis: number, hinweis?: string): CostLine => ({
    id, gruppe, bezeichnung, menge: m2, einheit: 'm²', einzelpreisEur: preis, summeEur: eur(m2 * preis), hinweis,
  });
  einmal.push(perM2('ausbau', 'ausbau', 'Grundausbau', nettoM2, a.ausbauEurM2, 'Nettofläche'));
  einmal.push(perM2('boden-training', 'ausbau', 'Sportboden', trainingM2, a.bodenTrainingEurM2, cap.usedNettoFallback ? 'Trainingsfläche (ohne typisierte Räume: Nettofläche)' : 'Trainingsfläche'));
  einmal.push(perM2('boden-nass', 'ausbau', 'Nassbereich-Boden', nassM2, a.bodenNassEurM2, 'Umkleide/Sanitär'));
  einmal.push(perM2('lueftung', 'ausbau', 'Lüftung (RLT)', nettoM2, a.lueftungEurM2, 'Nettofläche'));
  einmal.push({ id: 'spiegel', gruppe: 'ausbau', bezeichnung: 'Spiegelwände', menge: spiegelM, einheit: 'm', einzelpreisEur: a.spiegelEurM, summeEur: eur(spiegelM * a.spiegelEurM), hinweis: 'Öffnungen vom Typ Spiegel' });
  einmal.push(perM2('brandschutz', 'ausbau', 'Brandschutz / Sicherheitsbeleuchtung', nettoM2, a.brandschutzEurM2, 'Nettofläche'));
  const perStk = (id: string, bezeichnung: string, n: number, preis: number, hinweis?: string): CostLine => ({
    id, gruppe: 'sanitaer', bezeichnung, menge: n, einheit: 'Stk.', einzelpreisEur: preis, summeEur: eur(n * preis), hinweis,
  });
  einmal.push(perStk('sanitaer-duschen', 'Duschen (Installation)', duschen, a.sanitaerDuscheEur));
  einmal.push(perStk('sanitaer-wc', 'WCs / Urinale (Installation)', wcs + urinale, a.sanitaerWcEur, urinale > 0 ? `${wcs} WC + ${urinale} Urinale` : undefined));
  einmal.push(perStk('sanitaer-waschtische', 'Waschtische (Installation)', waschtische, a.sanitaerWaschtischEur));
  const ausbauSanitaerSumme = einmal.filter((l) => l.gruppe === 'ausbau' || l.gruppe === 'sanitaer').reduce((s, l) => s + l.summeEur, 0);
  einmal.push({
    id: 'planung', gruppe: 'planung', bezeichnung: 'Planung / Genehmigung', menge: a.planungProzent, einheit: '%', einzelpreisEur: ausbauSanitaerSumme,
    summeEur: eur((ausbauSanitaerSumme * a.planungProzent) / 100), hinweis: 'Prozent der Ausbau- und Sanitärsumme',
  });
  einmal.push({ id: 'sonstiges', gruppe: 'sonstiges', bezeichnung: 'Sonstiges einmalig', menge: 1, einheit: 'pauschal', einzelpreisEur: a.sonstigeEinmalEur, summeEur: eur(a.sonstigeEinmalEur), hinweis: 'Marketing, Software, Kleinmaterial' });
  const counted = einmal.filter((l) => !l.finanziert).reduce((s, l) => s + l.summeEur, 0);
  einmal.push({
    id: 'unvorhergesehen', gruppe: 'sonstiges', bezeichnung: 'Unvorhergesehenes', menge: a.unvorhergesehenProzent, einheit: '%', einzelpreisEur: counted,
    summeEur: eur((counted * a.unvorhergesehenProzent) / 100), hinweis: finanziert ? 'Prozent der vorherigen Einmalposten (ohne finanzierte Geräte)' : 'Prozent der vorherigen Einmalposten',
  });
  const monatsmiete = (a.mieteEurM2Monat + a.nebenkostenEurM2Monat) * bruttoM2;
  einmal.push({
    id: 'kaution', gruppe: 'sonstiges', bezeichnung: 'Kaution', menge: a.kautionMonate, einheit: 'Monate', einzelpreisEur: eur(monatsmiete),
    summeEur: eur(a.kautionMonate * monatsmiete), hinweis: 'Monatsmieten inkl. Nebenkosten (Bruttofläche)',
  });
  const einmalSummeEur = einmal.filter((l) => !l.finanziert).reduce((s, l) => s + l.summeEur, 0);
  const finanzierungBasis = finanziert ? geraeteSummeEur + importSummeEur : 0;
  const investitionSummeEur = einmalSummeEur + finanzierungBasis;

  /* ---- Laufende Kosten ---- */
  const monatlich: CostLine[] = [
    perM2('miete', 'laufend', 'Miete', bruttoM2, a.mieteEurM2Monat, 'Bruttofläche'),
    perM2('nebenkosten', 'laufend', 'Nebenkosten', bruttoM2, a.nebenkostenEurM2Monat, 'Bruttofläche'),
    { id: 'personal', gruppe: 'laufend', bezeichnung: 'Personal', menge: 1, einheit: 'pauschal', einzelpreisEur: a.personalEurMonat, summeEur: eur(a.personalEurMonat) },
    { id: 'sonstiges-monat', gruppe: 'laufend', bezeichnung: 'Sonstiges laufend', menge: 1, einheit: 'pauschal', einzelpreisEur: a.sonstigesEurMonat, summeEur: eur(a.sonstigesEurMonat) },
    {
      id: 'wartung', gruppe: 'laufend', bezeichnung: 'Wartung / Instandhaltung', menge: a.wartungProzentJahr, einheit: '%/Jahr', einzelpreisEur: geraeteSummeEur,
      summeEur: eur((geraeteSummeEur * a.wartungProzentJahr) / 100 / 12), hinweis: 'Prozent des Gerätewerts je Jahr ÷ 12',
    },
  ];
  if (finanziert) {
    monatlich.push({
      id: 'finanzierung', gruppe: 'laufend', bezeichnung: 'Finanzierungsrate', menge: Math.round(a.finanzierungJahre * 12), einheit: 'Monate', einzelpreisEur: finanzierungBasis,
      summeEur: eur(annuityMonthly(finanzierungBasis, a.zinsProzent, a.finanzierungJahre)),
      hinweis: `Annuität auf Geräte + Import bei ${a.zinsProzent} % p. a. über ${a.finanzierungJahre} Jahre`,
    });
  }
  const monatlichSummeEur = monatlich.reduce((s, l) => s + l.summeEur, 0);

  return {
    assumptions: a,
    einmal,
    einmalSummeEur,
    geraeteSummeEur,
    importSummeEur,
    finanziert,
    investitionSummeEur,
    itemsWithoutPrice: list.itemsWithoutPrice,
    monatlich,
    monatlichSummeEur,
    jahr1SummeEur: einmalSummeEur + 12 * monatlichSummeEur,
    kostenJeM2: bruttoM2 > 0 ? eur(einmalSummeEur / bruttoM2) : 0,
    breakEvenMitglieder: a.mitgliedsbeitragEurMonat > 0 ? Math.ceil(monatlichSummeEur / a.mitgliedsbeitragEurMonat) : 0,
    geraeteJeBereich,
    flaechen: { bruttoM2, nettoM2, trainingM2, nassM2, spiegelM },
    sanitaer: { duschen, wcs, urinale, waschtische },
  };
});
