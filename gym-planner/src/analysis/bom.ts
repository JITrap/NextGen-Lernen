/**
 * Stückliste (BOM) gruppiert nach Bibliotheks-ID über alle Stockwerke; skalierbare Objekte (def.skalierbar)
 * zusätzlich nach ihren Maßen (eine Position je Größe, Maße = Objektmaße).
 * Preis je Objekt: item.priceEur ?? project.priceOverrides[defId] ?? def.preis_eur. Gesamtpreis der Position =
 * Summe der Objektpreise, Stückpreis = Mittelwert; sind die Objektpreise verschieden → priceMixed. Objekte ohne
 * Preis werden gezählt (itemsWithoutPrice) und fließen nicht in die Summe ein.
 */
import type { Project, Id, EquipmentDef } from '@/types';
import { formatDims } from '@/geometry/units';
import { analysisContext, memoByProject, itemWeightKg } from './common';

export interface BomFloorCount {
  floorId: Id;
  floorName: string;
  count: number;
}
export interface BomLine {
  /**
   * Eindeutiger Zeilenschlüssel (React-Key, CSV/PDF): Bibliotheks-ID, bei skalierbaren Objekten
   * `defId|Breite|Tiefe|Höhe` – dieselbe defId kann dort mehrere Positionen (Größen) haben.
   */
  key: string;
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
  /** Mittelwert der Objektpreise (nur Objekte mit Preis); null, wenn kein Objekt einen Preis hat. */
  unitPriceEur: number | null;
  /** Objekte dieser Position haben unterschiedliche Preise (unitPriceEur = Mittelwert). */
  priceMixed: boolean;
  /** Summe der Objektpreise (Objekte ohne Preis zählen nicht); null, wenn kein Objekt einen Preis hat. */
  totalEur: number | null;
  /** Objekte dieser Position ohne Preis (weder Objektpreis noch Überschreibung noch Bibliothekspreis). */
  itemsWithoutPrice: number;
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
  /** Positionen ohne jeden Preis. */
  linesWithoutPrice: number;
  linesWithoutWeight: number;
  /** Anzahl Objekte ohne Gewichtsangabe. */
  itemsWithoutWeight: number;
  /** Anzahl Objekte ohne Preis (auch in Positionen mit teilweise bepreisten Objekten). */
  itemsWithoutPrice: number;
}

/** Effektiver Preis eines Objekts: Objektpreis, sonst Projekt-Überschreibung, sonst Bibliothekspreis. */
function itemPrice(priceEur: number | undefined, defId: string, def: EquipmentDef | undefined, project: Project): number | null {
  if (typeof priceEur === 'number' && Number.isFinite(priceEur)) return priceEur;
  const override = project.priceOverrides[defId];
  if (typeof override === 'number' && Number.isFinite(override)) return override;
  const p = def?.preis_eur;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Stückliste des Projekts (memoisiert am Projekt-Objekt). */
export const bom: (project: Project) => Bom = memoByProject((project) => {
  const ctx = analysisContext(project);
  interface Acc {
    defId: string;
    def: EquipmentDef | undefined;
    prices: number[];
    count: number;
    floorCounts: Map<Id, BomFloorCount>;
    itemIds: Id[];
    /** Maße der Position: Bibliotheksmaße, bei skalierbaren/unbekannten Objekten die Objektmaße. */
    dims: { width: number; depth: number; height: number | null };
  }
  const groups = new Map<string, Acc>();
  const keyFor = (defId: string, scalable: boolean, dims: Acc['dims']) =>
    scalable ? `${defId}|${r1(dims.width)}|${r1(dims.depth)}|${dims.height == null ? '' : r1(dims.height)}` : defId;
  for (const fc of ctx.floors) {
    for (const it of fc.items) {
      const def = ctx.def(it.defId);
      const scalable = !!def?.skalierbar;
      const dims = scalable || !def
        ? { width: it.width, depth: it.depth, height: it.height ?? def?.hoehe_cm ?? null }
        : { width: def.breite_cm, depth: def.tiefe_cm, height: def.hoehe_cm };
      const key = keyFor(it.defId, scalable, dims);
      let g = groups.get(key);
      if (!g) {
        g = { defId: it.defId, def, prices: [], count: 0, floorCounts: new Map(), itemIds: [], dims };
        groups.set(key, g);
      }
      g.count += 1;
      g.itemIds.push(it.id);
      const price = itemPrice(it.priceEur, it.defId, def, project);
      if (price != null) g.prices.push(price);
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
  let itemsWithoutPrice = 0;

  for (const [key, g] of groups) {
    const { defId, def } = g;
    let unit: number | null = null;
    let total: number | null = null;
    let mixed = false;
    if (g.prices.length) {
      total = g.prices.reduce((s, p) => s + p, 0);
      unit = g.prices.length === 1 ? g.prices[0] : total / g.prices.length;
      mixed = new Set(g.prices.map((p) => Math.round(p * 100))).size > 1;
    }
    const weight = itemWeightKg(def);
    const { width, depth, height } = g.dims;
    const line: BomLine = {
      key,
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
      totalEur: total,
      itemsWithoutPrice: g.count - g.prices.length,
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
    itemsWithoutPrice += line.itemsWithoutPrice;
  }

  lines.sort((a, b) => a.hersteller.localeCompare(b.hersteller, 'de') || a.serie.localeCompare(b.serie, 'de') || a.name.localeCompare(b.name, 'de') || a.widthCm - b.widthCm || a.depthCm - b.depthCm);
  return { lines, totalCount, totalWeightKg: totalWeight, totalEur, linesWithoutPrice, linesWithoutWeight, itemsWithoutWeight, itemsWithoutPrice };
});
