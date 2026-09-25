/**
 * Stückliste (BOM) als CSV-Export.
 * CSV für Excel (DE): UTF-8 mit BOM, Semikolon als Trenner, Dezimalkomma, CRLF.
 *
 * Die Zahlen stammen aus `bom(project)` (src/analysis) – dieselbe Quelle wie das Panel „Übersicht“.
 * `bomRows`/`bomTotals` sind Adapter auf dieses Ergebnis (flache Zeilen mit deutschen Feldnamen).
 */
import type { Project, PlacedItem, EquipmentDef } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { getDef } from '@/data/equipment';
import { bom, type BomLine } from '@/analysis';
import { downloadBlob, safeFileName } from './json';

export interface BomRow {
  /** Eindeutiger Zeilenschlüssel (`BomLine.key`: Bibliotheks-ID, bei skalierbaren Objekten zusätzlich die Maße). */
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
  /** Stückpreis in EUR (null = kein Preis hinterlegt); bei unterschiedlichen Objektpreisen der Mittelwert. */
  stueckpreis: number | null;
  /** Objekte dieser Position haben unterschiedliche Preise (stueckpreis = Mittelwert). */
  preisGemischt: boolean;
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

/**
 * Stückpreis eines einzelnen platzierten Objekts: eigener Preis → Projekt-Überschreibung → Bibliothek.
 * (Die Stückliste selbst bildet Positionen über `bom()`; dort werden unterschiedliche Objektpreise gemittelt.)
 */
export function unitPrice(item: PlacedItem, def: EquipmentDef | undefined, project: Project): number | null {
  if (typeof item.priceEur === 'number' && Number.isFinite(item.priceEur)) return item.priceEur;
  const ov = project.priceOverrides[item.defId];
  if (typeof ov === 'number' && Number.isFinite(ov)) return ov;
  if (typeof def?.preis_eur === 'number' && Number.isFinite(def.preis_eur)) return def.preis_eur;
  return null;
}

/** Hinweis-Spalte: Bibliothekshinweise plus Besonderheiten der Position. */
function rowHint(line: BomLine, def: EquipmentDef | undefined): string {
  const parts: string[] = [];
  if (line.unknownDef) parts.push('Nicht in der Bibliothek – gespeicherte Maße');
  else if (def) parts.push(...[def.hinweis, def.extra].filter((s): s is string => !!s));
  if (line.priceMixed) parts.push('Unterschiedliche Objektpreise – Stückpreis ist der Mittelwert');
  return parts.join(' · ');
}

/** Eine Zeile je Stücklistenposition (Adapter auf `BomLine`; skalierbare Objekte: eine Zeile je Größe). */
function rowFromLine(line: BomLine, project: Project): BomRow {
  const def = line.unknownDef ? undefined : getDef(line.defId, project);
  return {
    key: line.key,
    defId: line.defId,
    hersteller: line.hersteller,
    serie: line.serie,
    modell: line.modell,
    bezeichnung: line.name,
    breite: line.widthCm,
    tiefe: line.depthCm,
    hoehe: line.heightCm,
    gewicht: line.weightKg,
    anzahl: line.count,
    stueckpreis: line.unitPriceEur,
    preisGemischt: line.priceMixed,
    summe: line.totalEur,
    stockwerke: line.floorCounts.map((f) => f.floorName),
    verifiziert: line.verifiziert,
    hinweis: rowHint(line, def),
    itemIds: line.itemIds,
  };
}

/** Stückliste: gleiche Geräte (Bibliotheks-ID) werden über alle Stockwerke zusammengefasst – identisch zu `bom(project).lines`. */
export function bomRows(project: Project): BomRow[] {
  return bom(project).lines.map((line) => rowFromLine(line, project));
}

/** Summen über die Zeilen (entsprechen `totalCount`, `totalWeightKg`, `totalEur`, `linesWithoutPrice` aus `bom(project)`). */
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

/**
 * Zelle für Excel DE: Textzellen, die wie eine Formel beginnen (= + - @ Tab CR), erhalten ein führendes
 * Apostroph (CSV-Injection-Schutz); Zahlen werden über csvNumber formatiert und nie geschützt.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  let s = typeof v === 'number' ? csvNumber(v) : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
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
  return `\uFEFF${lines.join('\r\n')}\r\n`;
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
