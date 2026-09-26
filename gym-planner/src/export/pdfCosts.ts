/**
 * PDF-Seiten „Kostenkalkulation“: Kennzahlen als Textblock, Tabelle Einmalkosten (mit Summe), Tabelle laufende
 * Kosten je Monat (mit Summe), Tabelle der Annahmen und Hinweis netto/ohne MwSt. Die Zahlen stammen aus
 * `costs(project)` (src/analysis) – dieselben wie im Panel „Übersicht“ und in der Kosten-CSV.
 */
import type { jsPDF } from 'jspdf';
import type { Project } from '@/types';
import { costs, COST_GROUP_LABELS, COST_ASSUMPTION_FIELDS, COST_ASSUMPTION_GROUP_LABELS, type CostLine } from '@/analysis';
import { formatNumber } from '@/geometry/units';
import { drawPageHeader, drawFooter, drawTable, dateDe, PAGE_MARGIN_MM, TITLE_BLOCK_MM, type TableCtx, type Col, fitText } from './pdf';

const PAGE_W = 297;
const PAGE_H = 210;

const eur0 = (v: number) => formatNumber(v, 0);

function mengeText(l: CostLine): string {
  if (l.einheit === 'pauschal') return '1';
  if (l.einheit === 'm²' || l.einheit === 'm') return formatNumber(l.menge, 2);
  return formatNumber(l.menge, l.einheit === '%' || l.einheit === '%/Jahr' ? 1 : 0);
}

function lineRow(l: CostLine): string[] {
  const hinweis = [l.hinweis, l.finanziert ? 'über Rate' : ''].filter(Boolean).join(' · ');
  const einzel = l.einheit === '%' || l.einheit === '%/Jahr' ? `Basis ${eur0(l.einzelpreisEur)}` : formatNumber(l.einzelpreisEur, 2);
  return [COST_GROUP_LABELS[l.gruppe], l.bezeichnung, mengeText(l), l.einheit, einzel, l.finanziert ? `(${eur0(l.summeEur)})` : eur0(l.summeEur), hinweis];
}

export function drawCostPages(doc: jsPDF, project: Project): void {
  const c = costs(project);
  const a = c.assumptions;
  doc.addPage('a4', 'landscape');
  const footer = () => drawFooter(doc, PAGE_W, PAGE_H, `GymPlanner · ${project.name} · Kostenkalkulation · ${dateDe()}`);
  drawPageHeader(
    doc, PAGE_W, `${project.name} – Kostenkalkulation`,
    `Netto in EUR ohne MwSt. · Bibliothekspreise (Schätzung/Liste) · ${c.finanziert ? `Geräte + Import über ${a.finanzierungJahre} Jahre finanziert` : 'Barkauf der Geräte'} · ${dateDe()}`,
    [dateDe()],
  );
  footer();
  const ctx: TableCtx = {
    doc, pageW: PAGE_W, pageH: PAGE_H, y: PAGE_MARGIN_MM + TITLE_BLOCK_MM,
    newPage: () => { doc.addPage('a4', 'landscape'); drawPageHeader(doc, PAGE_W, `${project.name} – Kostenkalkulation (Fortsetzung)`, '', []); footer(); ctx.y = PAGE_MARGIN_MM + TITLE_BLOCK_MM; },
  };

  // Kennzahlen als Textblock (zwei Spalten)
  const kpis: [string, string][] = [
    ['Einmalkosten', `${eur0(c.einmalSummeEur)} EUR${c.finanziert ? ' (ohne finanzierte Geräte)' : ''}`],
    ['davon Geräte', `${eur0(c.geraeteSummeEur)} EUR${c.finanziert ? ' – finanziert' : ''}`],
    ['Import-Nebenkosten', `${eur0(c.importSummeEur)} EUR`],
    ['Gesamtinvestition', `${eur0(c.investitionSummeEur)} EUR`],
    ['Laufend je Monat', `${eur0(c.monatlichSummeEur)} EUR`],
    ['Jahr 1 (Einmal + 12 Monate)', `${eur0(c.jahr1SummeEur)} EUR`],
    ['Einmalkosten je m² Brutto', `${eur0(c.kostenJeM2)} EUR/m²`],
    ['Break-even-Mitglieder', `${c.breakEvenMitglieder} bei ${formatNumber(a.mitgliedsbeitragEurMonat, 2)} EUR/Monat`],
    ['Flächen', `Brutto ${formatNumber(c.flaechen.bruttoM2, 0)} m² · Netto ${formatNumber(c.flaechen.nettoM2, 0)} m² · Training ${formatNumber(c.flaechen.trainingM2, 0)} m² · Nass ${formatNumber(c.flaechen.nassM2, 0)} m² · Spiegel ${formatNumber(c.flaechen.spiegelM, 1)} m`],
    ['Sanitär', `${c.sanitaer.duschen} Duschen · ${c.sanitaer.wcs} WC · ${c.sanitaer.urinale} Urinale · ${c.sanitaer.waschtische} Waschtische`],
  ];
  doc.setFontSize(9);
  const colW = (PAGE_W - PAGE_MARGIN_MM * 2) / 2;
  const rowH = 5;
  // acht kurze Kennzahlen zweispaltig, die langen Zeilen „Flächen“ und „Sanitär“ je in voller Breite
  const grid = kpis.slice(0, 8);
  const wide = kpis.slice(8);
  grid.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAGE_MARGIN_MM + col * colW;
    const y = ctx.y + row * rowH + 4;
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(fitText(doc, value, colW - 50), x + 48, y);
  });
  let wy = ctx.y + Math.ceil(grid.length / 2) * rowH + 4;
  for (const [label, value] of wide) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, PAGE_MARGIN_MM, wy);
    doc.setFont('helvetica', 'normal');
    doc.text(fitText(doc, value, PAGE_W - PAGE_MARGIN_MM * 2 - 50), PAGE_MARGIN_MM + 48, wy);
    wy += rowH;
  }
  ctx.y += (Math.ceil(grid.length / 2) + wide.length) * rowH + 6;
  if (c.itemsWithoutPrice > 0) {
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text(`Hinweis: ${c.itemsWithoutPrice} Objekt(e) ohne Preis – nicht in der Gerätesumme enthalten.`, PAGE_MARGIN_MM, ctx.y);
    doc.setTextColor(15, 23, 42);
    ctx.y += 5;
  }

  const cols: Col[] = [
    { title: 'Gruppe', width: 22 },
    { title: 'Bezeichnung', width: 62 },
    { title: 'Menge', width: 20, align: 'right' },
    { title: 'Einheit', width: 16 },
    { title: 'Einzelpreis EUR', width: 30, align: 'right' },
    { title: 'Summe EUR', width: 26, align: 'right' },
    { title: 'Hinweis', width: 97 },
  ];
  const section = (title: string, rows: string[][]) => {
    if (ctx.y + 30 > PAGE_H - PAGE_MARGIN_MM) ctx.newPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, PAGE_MARGIN_MM, ctx.y + 4);
    doc.setFont('helvetica', 'normal');
    ctx.y += 7;
    drawTable(ctx, cols, rows, { boldLast: true, zebra: true, fontSize: 7.5, rowH: 5.2 });
    ctx.y += 6;
  };
  const einmalRows = c.einmal.map(lineRow);
  einmalRows.push(['Summe', 'Einmalkosten', '', '', '', eur0(c.einmalSummeEur), c.finanziert ? 'finanzierte Geräte/Import in Klammern, nicht enthalten' : '']);
  section('Einmalkosten', einmalRows);
  const monatRows = c.monatlich.map(lineRow);
  monatRows.push(['Summe', 'Laufend je Monat', '', '', '', eur0(c.monatlichSummeEur), `× 12 = ${eur0(c.monatlichSummeEur * 12)} EUR je Jahr`]);
  section('Laufende Kosten je Monat', monatRows);

  const aCols: Col[] = [
    { title: 'Bereich', width: 40 },
    { title: 'Annahme', width: 50 },
    { title: 'Wert', width: 24, align: 'right' },
    { title: 'Einheit', width: 20 },
    { title: 'Erläuterung', width: 139 },
  ];
  const aRows = COST_ASSUMPTION_FIELDS.map((f) => [COST_ASSUMPTION_GROUP_LABELS[f.gruppe], f.label, formatNumber(a[f.key], Math.max(f.decimals ?? 0, 2)), f.einheit, f.erklaerung]);
  if (ctx.y + 30 > PAGE_H - PAGE_MARGIN_MM) ctx.newPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Annahmen', PAGE_MARGIN_MM, ctx.y + 4);
  doc.setFont('helvetica', 'normal');
  ctx.y += 7;
  drawTable(ctx, aCols, aRows, { zebra: true, fontSize: 7.5, rowH: 5.2 });
  ctx.y += 6;
  if (ctx.y + 12 > PAGE_H - PAGE_MARGIN_MM) ctx.newPage();
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Alle Beträge netto in EUR ohne MwSt. Gerätepreise laut Bibliothek (Schätzung nach Kategorie bzw. Listen-/Händlerpreis, ohne Fracht/Zoll außer Position Import-Nebenkosten);', PAGE_MARGIN_MM, ctx.y + 4);
  doc.text('Ausbau- und Sanitärkosten sind Richtwerte je m² bzw. je Stück. Kaution ist eine Sicherheitsleistung (rückzahlbar). Unverbindliche Kalkulation, keine Angebotsgrundlage.', PAGE_MARGIN_MM, ctx.y + 8.5);
  doc.setTextColor(15, 23, 42);
}
