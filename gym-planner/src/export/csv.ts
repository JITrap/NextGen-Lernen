/**
 * Stückliste (BOM) und CSV-Export.
 * CSV für Excel (DE): UTF-8 mit BOM, Semikolon als Trenner, Dezimalkomma, CRLF.
 * Die Stückliste wird hier lokal berechnet (bomRows), unabhängig vom Analyse-Modul.
 */
import type { Project, PlacedItem, EquipmentDef } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { getDef } from '@/data/equipment';
import { downloadBlob, safeFileName } from './json';

export interface BomRow {
  /** Gruppenschlüssel (defId + Stückpreis). */
  key: string;
  defId: string;
  hersteller: string;
  serie: string;
  modell: string;
  bezeichnung: string;
  breite: number;
  tiefe: number;
  hoehe: number | null;
  /** Gewicht je Stück in kg (null = unbekannt). */
  gewicht: number | null;
  anzahl: number;
  /** Stückpreis in EUR (null = kein Preis hinterlegt). */
  stueckpreis: number | null;
  /** Summe in EUR (null, wenn kein Preis). */
  summe: number | null;
  /** Namen der Stockwerke, auf denen das Gerät steht. */
  stockwerke: string[];
  verifiziert: boolean;
  hinweis: string;
  /** Beteiligte Objekt-IDs (z. B. zum Hinspringen). */
  itemIds: string[];
}

export interface BomTotals {
  anzahl: number;
  gewicht: number;
  summe: number;
  /** Zeilen ohne Preis (Kosten unvollständig). */
  ohnePreis: number;
}

/** Stückpreis eines platzierten Objekts: eigener Preis → Projekt-Überschreibung → Bibliothek. */
export function unitPrice(item: PlacedItem, def: EquipmentDef | undefined, project: Project): number | null {
  if (typeof item.priceEur === 'number' && Number.isFinite(item.priceEur)) return item.priceEur;
  const ov = project.priceOverrides[item.defId];
  if (typeof ov === 'number' && Number.isFinite(ov)) return ov;
  if (typeof def?.preis_eur === 'number' && Number.isFinite(def.preis_eur)) return def.preis_eur;
  return null;
}

/** Stückliste: gleiche Geräte (defId + Stückpreis) werden zusammengefasst. */
export function bomRows(project: Project): BomRow[] {
  const map = new Map<string, BomRow>();
  const floors = [...project.floors].sort((a, b) => a.order - b.order);
  for (const f of floors) {
    for (const it of f.items) {
      const def = getDef(it.defId, project);
      const price = unitPrice(it, def, project);
      const key = `${it.defId}|${price ?? ''}`;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          defId: it.defId,
          hersteller: def?.hersteller ?? 'Unbekannt',
          serie: def?.serie ?? '',
          modell: def?.modell ?? '',
          bezeichnung: def?.name ?? it.label ?? it.defId,
          breite: def?.breite_cm ?? it.width,
          tiefe: def?.tiefe_cm ?? it.depth,
          hoehe: def ? def.hoehe_cm : it.height,
          gewicht: def?.gewicht_kg ?? null,
          anzahl: 0,
          stueckpreis: price,
          summe: price == null ? null : 0,
          stockwerke: [],
          verifiziert: def?.verifiziert ?? false,
          hinweis: def ? [def.hinweis, def.extra].filter(Boolean).join(' · ') : 'Nicht in der Bibliothek – gespeicherte Maße',
          itemIds: [],
        };
        map.set(key, row);
      }
      row.anzahl += 1;
      row.itemIds.push(it.id);
      if (price != null) row.summe = (row.summe ?? 0) + price;
      if (!row.stockwerke.includes(f.name)) row.stockwerke.push(f.name);
    }
  }
  const rows = [...map.values()];
  rows.sort((a, b) => a.hersteller.localeCompare(b.hersteller, 'de') || a.serie.localeCompare(b.serie, 'de') || a.modell.localeCompare(b.modell, 'de') || a.bezeichnung.localeCompare(b.bezeichnung, 'de'));
  return rows;
}

export function bomTotals(rows: BomRow[]): BomTotals {
  let anzahl = 0;
  let gewicht = 0;
  let summe = 0;
  let ohnePreis = 0;
  for (const r of rows) {
    anzahl += r.anzahl;
    if (r.gewicht != null) gewicht += r.gewicht * r.anzahl;
    if (r.summe != null) summe += r.summe; else ohnePreis += 1;
  }
  return { anzahl, gewicht, summe, ohnePreis };
}

export const CSV_HEADER = [
  'Hersteller', 'Serie', 'Modell', 'Bezeichnung', 'Breite cm', 'Tiefe cm', 'Höhe cm', 'Gewicht kg',
  'Anzahl', 'Stückpreis EUR', 'Summe EUR', 'Stockwerke', 'Verifiziert', 'Hinweis',
] as const;

/** Zahl mit Dezimalkomma, maximal 2 Nachkommastellen, ohne Tausendertrennzeichen. */
export function csvNumber(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return '';
  const f = 10 ** decimals;
  const r = Math.round((v + Number.EPSILON) * f) / f;
  return String(r).replace('.', ',');
}

export function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = typeof v === 'number' ? csvNumber(v) : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV-Text der Stückliste inkl. BOM und Summenzeile. */
export function bomCsvText(project: Project): string {
  const rows = bomRows(project);
  const totals = bomTotals(rows);
  const lines: string[] = [CSV_HEADER.join(';')];
  for (const r of rows) {
    lines.push([
      csvCell(r.hersteller), csvCell(r.serie), csvCell(r.modell), csvCell(r.bezeichnung),
      csvNumber(r.breite), csvNumber(r.tiefe), csvNumber(r.hoehe), csvNumber(r.gewicht),
      String(r.anzahl), csvNumber(r.stueckpreis), csvNumber(r.summe),
      csvCell(r.stockwerke.join(', ')), r.verifiziert ? 'Ja' : 'Nein', csvCell(r.hinweis),
    ].join(';'));
  }
  lines.push([
    'Summe', '', '', `${rows.length} Positionen`, '', '', '', csvNumber(totals.gewicht),
    String(totals.anzahl), '', csvNumber(totals.summe), '', '',
    totals.ohnePreis ? csvCell(`${totals.ohnePreis} Position(en) ohne Preis`) : '',
  ].join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Lädt die Stückliste als „<Projekt>-Stueckliste.csv“ herunter. */
export function exportCsv(project?: Project): void {
  const p = project ?? useProjectStore.getState().project;
  try {
    const text = bomCsvText(p);
    downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${safeFileName(p.name)}-Stueckliste.csv`);
    useUiStore.getState().toast('Stückliste als CSV exportiert.', 'success');
  } catch (e) {
    useUiStore.getState().toast(`CSV-Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}
