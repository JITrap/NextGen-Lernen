/**
 * Stückliste (BOM) gruppiert nach Bibliotheks-ID über alle Stockwerke.
 * Stückpreis: Preise der platzierten Objekte (priceEur); sind sie unterschiedlich → Mittelwert + Flag,
 * sonst project.priceOverrides[defId] ?? def.preis_eur ?? null.
 */
import type { Project, Id } from '@/types';
import { formatDims } from '@/geometry/units';
import { analysisContext, memoByProject, itemWeightKg } from './common';

export interface BomFloorCount {
  floorId: Id;
  floorName: string;
  count: number;
}
export interface BomLine {
  defId: string;
  name: string;
  hersteller: string;
  serie: string;
  modell: string;
  /** „B × T × H cm“ */
  dims: string;
  widthCm: number;
  depthCm: number;
  heightCm: number | null;
  weightKg: number | null;
  count: number;
  unitPriceEur: number | null;
  /** Objekte dieser Position haben unterschiedliche Preise (unitPriceEur = Mittelwert). */
  priceMixed: boolean;
  totalEur: number | null;
  totalWeightKg: number | null;
  verifiziert: boolean;
  ohneStellflaeche: boolean;
  /** Bibliothekseintrag nicht (mehr) vorhanden. */
  unknownDef: boolean;
  floorCounts: BomFloorCount[];
  itemIds: Id[];
}
export interface Bom {
  lines: BomLine[];
  totalCount: number;
  totalWeightKg: number;
  /** Summe nur über Positionen mit Preis. */
  totalEur: number;
  linesWithoutPrice: number;
  linesWithoutWeight: number;
  /** Anzahl Objekte ohne Gewichtsangabe. */
  itemsWithoutWeight: number;
}

/** Stückliste des Projekts (memoisiert am Projekt-Objekt). */
export const bom: (project: Project) => Bom = memoByProject((project) => {
  const ctx = analysisContext(project);
  interface Acc { prices: number[]; count: number; floorCounts: Map<Id, BomFloorCount>; itemIds: Id[]; sample: { width: number; depth: number; height: number | null } }
  const groups = new Map<string, Acc>();
  for (const fc of ctx.floors) {
    for (const it of fc.items) {
      let g = groups.get(it.defId);
      if (!g) {
        g = { prices: [], count: 0, floorCounts: new Map(), itemIds: [], sample: { width: it.width, depth: it.depth, height: it.height } };
        groups.set(it.defId, g);
      }
      g.count += 1;
      g.itemIds.push(it.id);
      if (typeof it.priceEur === 'number' && Number.isFinite(it.priceEur)) g.prices.push(it.priceEur);
      const fcnt = g.floorCounts.get(fc.floor.id) ?? { floorId: fc.floor.id, floorName: fc.floor.name, count: 0 };
      fcnt.count += 1;
      g.floorCounts.set(fc.floor.id, fcnt);
    }
  }

  const lines: BomLine[] = [];
  let totalCount = 0;
  let totalWeight = 0;
  let totalEur = 0;
  let linesWithoutPrice = 0;
  let linesWithoutWeight = 0;
  let itemsWithoutWeight = 0;

  for (const [defId, g] of groups) {
    const def = ctx.def(defId);
    let unit: number | null;
    let mixed = false;
    if (g.prices.length) {
      const distinct = new Set(g.prices.map((p) => Math.round(p * 100)));
      if (distinct.size === 1) unit = g.prices[0];
      else { unit = g.prices.reduce((s, p) => s + p, 0) / g.prices.length; mixed = true; }
    } else {
      const override = project.priceOverrides[defId];
      unit = typeof override === 'number' && Number.isFinite(override) ? override : def?.preis_eur ?? null;
    }
    const weight = itemWeightKg(def);
    const width = def?.breite_cm ?? g.sample.width;
    const depth = def?.tiefe_cm ?? g.sample.depth;
    const height = def ? def.hoehe_cm : g.sample.height;
    const line: BomLine = {
      defId,
      name: def?.name ?? `Unbekanntes Objekt (${defId})`,
      hersteller: def?.hersteller ?? '–',
      serie: def?.serie ?? '',
      modell: def?.modell ?? '',
      dims: formatDims(width, depth, height),
      widthCm: width,
      depthCm: depth,
      heightCm: height,
      weightKg: weight,
      count: g.count,
      unitPriceEur: unit,
      priceMixed: mixed,
      totalEur: unit != null ? unit * g.count : null,
      totalWeightKg: weight != null ? weight * g.count : null,
      verifiziert: def?.verifiziert ?? false,
      ohneStellflaeche: !!def?.ohne_stellflaeche,
      unknownDef: !def,
      floorCounts: [...g.floorCounts.values()],
      itemIds: g.itemIds,
    };
    lines.push(line);
    totalCount += g.count;
    if (line.totalWeightKg != null) totalWeight += line.totalWeightKg;
    else { linesWithoutWeight += 1; itemsWithoutWeight += g.count; }
    if (line.totalEur != null) totalEur += line.totalEur;
    else linesWithoutPrice += 1;
  }

  lines.sort((a, b) => a.hersteller.localeCompare(b.hersteller, 'de') || a.serie.localeCompare(b.serie, 'de') || a.name.localeCompare(b.name, 'de'));
  return { lines, totalCount, totalWeightKg: totalWeight, totalEur, linesWithoutPrice, linesWithoutWeight, itemsWithoutWeight };
});
