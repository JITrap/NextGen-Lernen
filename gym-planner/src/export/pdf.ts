/**
 * PDF-Export (jsPDF, ohne autoTable): je Stockwerk eine maßstäbliche Planseite (Titelblock, Plan als eingebettetes
 * PNG mit exakter Papierbreite, Maßstabsbalken, Legende), danach Flächenbilanz und Stückliste als Tabellen.
 *
 * Flächenbilanz und Stückliste stammen aus src/analysis (`areaBalance()`, `bom()`) – dieselben Zahlen wie das
 * Panel „Übersicht“; `floorAreaBalance`/`projectAreaBalance` sind Adapter darauf.
 *
 * Maßstab: 1 cm Welt = 10/scale mm Papier (paperMmForCm). Bei 1:100 sind 25 m Halle = 250 mm.
 * jsPDF wird erst beim Export dynamisch geladen (eigener Chunk).
 */
import type { Project, Floor } from '@/types';
import type { jsPDF as JsPdf } from 'jspdf';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createEmptyProject } from '@/store/factories';
import { floorRooms } from '@/geometry/rooms';
import { formatNumber, formatM2 } from '@/geometry/units';
import { roomColor } from '@/data/roomTypes';
import { areaBalance, sumAreaBalances, areaClassOf, type FloorAreaBalance as AnalysisFloorAreaBalance } from '@/analysis';
import { renderFloorToCanvas, layoutFloorRender, paperMmForCm, pxPerCmForPaper, clampPxPerCm, scaleBarLength, legendRoomTypes, MAX_IMAGE_PX } from './planRenderer';
import { bomRows, bomTotals } from './csv';
import { safeFileName } from './json';

export type PdfScale = 50 | 100 | 200;

export interface PdfOptions {
  /** Stockwerke (Standard: alle, nach Reihenfolge). */
  floorIds?: string[];
  /** Maßstab 1:scale (Standard 100). */
  scale?: PdfScale;
  safetyZones?: boolean;
  labels?: boolean;
  /** Flächenbilanz-Seiten anhängen (Standard: true). */
  areaBalance?: boolean;
  /** Stücklisten-Seiten anhängen (Standard: true). */
  bom?: boolean;
  /** Ohne Download – liefert nur das Dokument. */
  download?: boolean;
  /** Bildauflösung auf Papier (Standard 200 dpi). */
  dpi?: number;
}

/* ------------------------------------------------------------------ */
/* Flächenbilanz (Adapter auf src/analysis)                            */
/* ------------------------------------------------------------------ */

export type { AreaByType, AreaByClass } from '@/analysis';

/**
 * Flächenbilanz eines Stockwerks – das Ergebnis von `areaBalance()` (Brutto, Netto, Luftraum, je Raumtyp,
 * je Flächenklasse, „nicht zugeordnet“) plus die bisherigen Feldnamen `grossM2`/`netM2` als Aliase.
 */
export interface FloorAreaBalance extends AnalysisFloorAreaBalance {
  /** Alias für `bruttoM2`. */
  grossM2: number;
  /** Alias für `nettoM2`. */
  netM2: number;
}
/** Summe über alle Stockwerke (`areaBalance(project).total`) plus die Bilanzen der einzelnen Stockwerke. */
export interface ProjectAreaBalance extends FloorAreaBalance {
  floors: FloorAreaBalance[];
}

function withAliases(b: AnalysisFloorAreaBalance): FloorAreaBalance {
  return { ...b, grossM2: b.bruttoM2, netM2: b.nettoM2 };
}

/**
 * Flächenbilanz eines Stockwerks. Mit `project` wird das (memoisierte) Analyse-Ergebnis des Projekts verwendet;
 * ohne Projekt – oder wenn das Stockwerk nicht dazugehört – wird es allein nach denselben Regeln bilanziert.
 */
export function floorAreaBalance(floor: Floor, project?: Project): FloorAreaBalance {
  const inProject = project ? areaBalance(project).floors.find((f) => f.floorId === floor.id) : undefined;
  if (inProject) return withAliases(inProject);
  const single: Project = { ...(project ?? createEmptyProject(floor.name)), floors: [floor], activeFloorId: floor.id };
  return withAliases(areaBalance(single).floors[0]);
}

/** Flächenbilanz des Projekts: Gesamtsumme und Stockwerke (nach Reihenfolge) aus `areaBalance(project)`. */
export function projectAreaBalance(project: Project): ProjectAreaBalance {
  const { floors, total } = areaBalance(project);
  return { ...withAliases(total), floors: floors.map(withAliases) };
}

/* ------------------------------------------------------------------ */
/* Papierformate                                                       */
/* ------------------------------------------------------------------ */

export interface PaperFormat { name: 'a4' | 'a3' | 'a2' | 'a1' | 'a0'; widthMm: number; heightMm: number }
/** Querformate, von klein nach groß. */
export const PAPER_FORMATS: PaperFormat[] = [
  { name: 'a4', widthMm: 297, heightMm: 210 },
  { name: 'a3', widthMm: 420, heightMm: 297 },
  { name: 'a2', widthMm: 594, heightMm: 420 },
  { name: 'a1', widthMm: 841, heightMm: 594 },
  { name: 'a0', widthMm: 1189, heightMm: 841 },
];
export const PAGE_MARGIN_MM = 12;
export const TITLE_BLOCK_MM = 22;
export const FOOTER_MM = 24;

/** Kleinstes Querformat, in das ein Plan mit Titelblock und Fußzeile passt; null, wenn selbst A0 zu klein ist. */
export function paperFormatForPlan(planWidthMm: number, planHeightMm: number): PaperFormat | null {
  for (const f of PAPER_FORMATS) {
    const availW = f.widthMm - PAGE_MARGIN_MM * 2;
    const availH = f.heightMm - PAGE_MARGIN_MM * 2 - TITLE_BLOCK_MM - FOOTER_MM;
    if (planWidthMm <= availW && planHeightMm <= availH) return f;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Zeichenhelfer                                                       */
/* ------------------------------------------------------------------ */

interface Col { title: string; width: number; align?: 'left' | 'right' }

function fitText(doc: JsPdf, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

interface TableCtx { doc: JsPdf; pageW: number; pageH: number; y: number; newPage: () => void }

function drawTableHeader(ctx: TableCtx, cols: Col[], x0: number, rowH: number) {
  const { doc } = ctx;
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(148, 163, 184);
  doc.rect(x0, ctx.y, totalW, rowH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  let x = x0;
  for (const c of cols) {
    const tx = c.align === 'right' ? x + c.width - 1.5 : x + 1.5;
    doc.text(fitText(doc, c.title, c.width - 3), tx, ctx.y + rowH - 1.6, { align: c.align === 'right' ? 'right' : 'left' });
    x += c.width;
  }
  doc.setFont('helvetica', 'normal');
  ctx.y += rowH;
}

/** Zeichnet eine Tabelle mit Seitenumbruch; Zeilen als Zeichenketten je Spalte. */
function drawTable(ctx: TableCtx, cols: Col[], rows: string[][], opts: { x0?: number; rowH?: number; fontSize?: number; boldLast?: boolean; zebra?: boolean } = {}) {
  const { doc } = ctx;
  const x0 = opts.x0 ?? PAGE_MARGIN_MM;
  const rowH = opts.rowH ?? 5.4;
  const fontSize = opts.fontSize ?? 7.5;
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  doc.setFontSize(fontSize);
  drawTableHeader(ctx, cols, x0, rowH);
  rows.forEach((r, i) => {
    if (ctx.y + rowH > ctx.pageH - PAGE_MARGIN_MM) {
      ctx.newPage();
      doc.setFontSize(fontSize);
      drawTableHeader(ctx, cols, x0, rowH);
    }
    const last = opts.boldLast && i === rows.length - 1;
    if (last) {
      doc.setFillColor(241, 245, 249);
      doc.rect(x0, ctx.y, totalW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
    } else if (opts.zebra && i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(x0, ctx.y, totalW, rowH, 'F');
    }
    doc.setDrawColor(203, 213, 225);
    doc.line(x0, ctx.y + rowH, x0 + totalW, ctx.y + rowH);
    let x = x0;
    cols.forEach((c, ci) => {
      const cell = r[ci] ?? '';
      const tx = c.align === 'right' ? x + c.width - 1.5 : x + 1.5;
      doc.text(fitText(doc, cell, c.width - 3), tx, ctx.y + rowH - 1.6, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.width;
    });
    if (last) doc.setFont('helvetica', 'normal');
    ctx.y += rowH;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [148, 163, 184];
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function dateDe(d = new Date()): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/* Seiten                                                              */
/* ------------------------------------------------------------------ */

function drawPageHeader(doc: JsPdf, pageW: number, title: string, subtitle: string, right: string[]) {
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(fitText(doc, title, pageW * 0.6), PAGE_MARGIN_MM, PAGE_MARGIN_MM + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(fitText(doc, subtitle, pageW * 0.6), PAGE_MARGIN_MM, PAGE_MARGIN_MM + 12);
  doc.setFontSize(9);
  right.forEach((line, i) => doc.text(line, pageW - PAGE_MARGIN_MM, PAGE_MARGIN_MM + 6 + i * 5, { align: 'right' }));
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN_MM, PAGE_MARGIN_MM + TITLE_BLOCK_MM - 4, pageW - PAGE_MARGIN_MM, PAGE_MARGIN_MM + TITLE_BLOCK_MM - 4);
  doc.setTextColor(15, 23, 42);
}

function drawFooter(doc: JsPdf, pageW: number, pageH: number, text: string) {
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(text, PAGE_MARGIN_MM, pageH - 5);
  doc.text(`Seite ${doc.getNumberOfPages()}`, pageW - PAGE_MARGIN_MM, pageH - 5, { align: 'right' });
  doc.setTextColor(15, 23, 42);
}

interface PlanPageResult { format: PaperFormat; fits: boolean }

function drawPlanPage(doc: JsPdf, project: Project, floor: Floor, scale: number, opts: Required<Pick<PdfOptions, 'safetyZones' | 'labels' | 'dpi'>>, first: boolean): PlanPageResult {
  const probe = layoutFloorRender(project, floor, { pxPerCm: 1, safetyZones: opts.safetyZones, legend: false, marginCm: 120 });
  const planWmm = paperMmForCm(probe.planBounds.maxX - probe.planBounds.minX, scale);
  const planHmm = paperMmForCm(probe.planBounds.maxY - probe.planBounds.minY, scale);
  const format = paperFormatForPlan(planWmm, planHmm) ?? PAPER_FORMATS[PAPER_FORMATS.length - 1];
  const fits = paperFormatForPlan(planWmm, planHmm) !== null;
  if (!first) doc.addPage(format.name, 'landscape');
  const pageW = format.widthMm;
  const pageH = format.heightMm;

  const balance = floorAreaBalance(floor, project);
  const variant = project.variantName ? `Variante „${project.variantName}“ · ` : '';
  drawPageHeader(doc, pageW, project.name, `${variant}Stockwerk „${floor.name}“ · Deckenhöhe ${formatNumber(floor.ceilingHeight / 100, 2)} m · ${dateDe()}`, [
    `Maßstab 1:${scale}`,
    `Brutto ${formatM2(balance.bruttoM2)} · Netto ${formatM2(balance.nettoM2)}`,
    `Blatt ${format.name.toUpperCase()} quer`,
  ]);

  // Plan (maßstäblich)
  const availW = pageW - PAGE_MARGIN_MM * 2;
  const availH = pageH - PAGE_MARGIN_MM * 2 - TITLE_BLOCK_MM - FOOTER_MM;
  const pxPerCm = clampPxPerCm(pxPerCmForPaper(scale, opts.dpi), probe.planBounds, MAX_IMAGE_PX);
  const r = renderFloorToCanvas(project, floor, {
    pxPerCm,
    safetyZones: opts.safetyZones,
    labels: opts.labels,
    legend: false,
    scaleBar: false,
    northArrow: true,
    dimensions: true,
    marginCm: 120,
    textScale: scale / 100,
  });
  const wMm = paperMmForCm(r.bounds.maxX - r.bounds.minX, scale);
  const hMm = paperMmForCm(r.bounds.maxY - r.bounds.minY, scale);
  const x = PAGE_MARGIN_MM + Math.max(0, (availW - wMm) / 2);
  const y = PAGE_MARGIN_MM + TITLE_BLOCK_MM + Math.max(0, (availH - hMm) / 2);
  doc.addImage(r.canvas, 'PNG', x, y, wMm, hMm, undefined, 'FAST');
  r.canvas.width = 0;
  r.canvas.height = 0;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.rect(x, y, wMm, hMm);
  if (!fits) {
    doc.setFontSize(8);
    doc.setTextColor(220, 38, 38);
    doc.text(`Hinweis: Der Plan überschreitet bei 1:${scale} das Blatt A0 – bitte kleineren Maßstab wählen.`, PAGE_MARGIN_MM, PAGE_MARGIN_MM + TITLE_BLOCK_MM - 6);
    doc.setTextColor(15, 23, 42);
  }

  // Fußbereich: Maßstabsbalken + Legende
  const footY = pageH - PAGE_MARGIN_MM - FOOTER_MM + 4;
  const barCm = scaleBarLength(r.planBounds.maxX - r.planBounds.minX);
  const barMm = paperMmForCm(barCm, scale);
  const segs = 4;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.25);
  for (let s = 0; s < segs; s++) {
    if (s % 2 === 0) doc.setFillColor(15, 23, 42); else doc.setFillColor(255, 255, 255);
    doc.rect(PAGE_MARGIN_MM + (barMm / segs) * s, footY, barMm / segs, 2.2, 'FD');
  }
  doc.setFontSize(7);
  doc.text('0', PAGE_MARGIN_MM, footY - 1);
  doc.text(`${formatNumber(barCm / 100, 2)} m`, PAGE_MARGIN_MM + barMm, footY - 1, { align: 'right' });
  doc.setFontSize(8);
  doc.text(`Maßstab 1:${scale} (1 cm auf Papier = ${formatNumber(scale / 100, 2)} m)`, PAGE_MARGIN_MM, footY + 6.5);

  // Legende (Raumtypen dieses Stockwerks) rechts vom Maßstab
  const types = legendRoomTypes(floorRooms(floor));
  if (types.length) {
    const legendX0 = PAGE_MARGIN_MM + Math.max(barMm, 40) + 14;
    const legendW = pageW - PAGE_MARGIN_MM - legendX0;
    const entryW = 46;
    const cols = Math.max(1, Math.floor(legendW / entryW));
    const rowH = 4.6;
    const rows = Math.ceil(types.length / cols);
    const maxRows = Math.max(1, Math.floor((FOOTER_MM - 2) / rowH));
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Legende Raumtypen', legendX0, footY - 1);
    doc.setFont('helvetica', 'normal');
    types.slice(0, cols * Math.min(rows, maxRows)).forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const lx = legendX0 + col * entryW;
      const ly = footY + row * rowH;
      const [cr, cg, cb] = hexToRgb(roomColor(t));
      doc.setFillColor(cr, cg, cb);
      doc.setDrawColor(cr, cg, cb);
      doc.rect(lx, ly, 3.2, 3.2, 'FD');
      doc.setTextColor(15, 23, 42);
      doc.text(fitText(doc, t, entryW - 6), lx + 4.5, ly + 2.7);
    });
  }
  drawFooter(doc, pageW, pageH, `GymPlanner · ${project.name}${project.variantName ? ` – ${project.variantName}` : ''} · Plan „${floor.name}“ · exportiert am ${dateDe()}`);
  return { format, fits };
}

/** Kennzahlen-Zeile einer Bilanz: Brutto, Netto, Luftraum, nicht zugeordnet. */
function areaBalanceSummary(b: AnalysisFloorAreaBalance): string {
  const parts = [b.hasHall ? `Brutto ${formatM2(b.bruttoM2)}` : 'Ohne Halle', `Netto ${formatM2(b.nettoM2)}`];
  if (b.voidM2 > 0.005) parts.push(`Luftraum ${formatM2(b.voidM2)}`);
  if (b.unassignedM2 > 0.005) parts.push(`nicht zugeordnet ${formatM2(b.unassignedM2)}`);
  return parts.join(' · ');
}

/**
 * Tabellenzeilen einer Bilanz: je Raumtyp (Anzahl, m², %), Summen je Flächenklasse, „Nicht zugeordnet“ und
 * als Schlusszeile die Nettofläche (= 100 %). Prozentwerte beziehen sich wie in der Übersicht auf die Nettofläche.
 */
function areaBalanceRows(b: AnalysisFloorAreaBalance): string[][] {
  const rows: string[][] = b.byType.map((t) => [t.type, areaClassOf(t), String(t.count), formatNumber(t.m2, 2), formatNumber(t.percent, 1)]);
  for (const c of b.byClass) if (c.m2 > 0.005) rows.push([`Summe ${c.areaClass}`, '', '', formatNumber(c.m2, 2), formatNumber(c.percent, 1)]);
  if (b.unassignedM2 > 0.005) rows.push(['Nicht zugeordnet', '', b.untypedRoomCount ? String(b.untypedRoomCount) : '', formatNumber(b.unassignedM2, 2), formatNumber(b.unassignedPercent, 1)]);
  if (!rows.length) return [['Keine Räume/Zonen definiert', '', '0', formatNumber(0, 2), formatNumber(0, 1)]];
  rows.push(['Netto gesamt', '', String(b.roomCount), formatNumber(b.nettoM2, 2), formatNumber(b.nettoM2 > 0 ? 100 : 0, 1)]);
  return rows;
}

function drawAreaBalancePages(doc: JsPdf, project: Project, floors: Floor[]) {
  doc.addPage('a4', 'landscape');
  const pageW = 297;
  const pageH = 210;
  const footer = () => drawFooter(doc, pageW, pageH, `GymPlanner · ${project.name} · Flächenbilanz · ${dateDe()}`);
  drawPageHeader(doc, pageW, `${project.name} – Flächenbilanz`, `${floors.length} Stockwerk(e) · Prozentwerte bezogen auf die Nettofläche (Halle innen abzüglich Lufträume) · ${dateDe()}`, [dateDe()]);
  footer();
  const ctx: TableCtx = {
    doc, pageW, pageH, y: PAGE_MARGIN_MM + TITLE_BLOCK_MM,
    newPage: () => { doc.addPage('a4', 'landscape'); drawPageHeader(doc, pageW, `${project.name} – Flächenbilanz (Fortsetzung)`, '', []); footer(); ctx.y = PAGE_MARGIN_MM + TITLE_BLOCK_MM; },
  };
  const cols: Col[] = [
    { title: 'Raumtyp', width: 70 },
    { title: 'Flächenklasse', width: 40 },
    { title: 'Räume', width: 18, align: 'right' },
    { title: 'Fläche m²', width: 30, align: 'right' },
    { title: 'Anteil %', width: 24, align: 'right' },
  ];
  const section = (title: string, b: AnalysisFloorAreaBalance) => {
    if (ctx.y + 30 > pageH - PAGE_MARGIN_MM) ctx.newPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, PAGE_MARGIN_MM, ctx.y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(areaBalanceSummary(b), PAGE_MARGIN_MM + 60, ctx.y + 4);
    ctx.y += 7;
    drawTable(ctx, cols, areaBalanceRows(b), { boldLast: true, zebra: true });
    ctx.y += 6;
  };
  const all = areaBalance(project);
  const selected = new Set(floors.map((f) => f.id));
  const balances = all.floors.filter((b) => selected.has(b.floorId));
  for (const b of balances) section(`Stockwerk „${b.floorName}“`, b);
  if (balances.length > 1) {
    const complete = balances.length === all.floors.length;
    section(`Gesamt (${complete ? 'alle' : 'ausgewählte'} Stockwerke)`, complete ? all.total : sumAreaBalances(balances));
  }
}

/** Stücklisten-Seiten: dieselben Zeilen wie die CSV (`bomRows` = Adapter auf `bom(project)` aus src/analysis). */
function drawBomPages(doc: JsPdf, project: Project) {
  const rows = bomRows(project);
  const totals = bomTotals(rows);
  doc.addPage('a4', 'landscape');
  const pageW = 297;
  const pageH = 210;
  const footer = () => drawFooter(doc, pageW, pageH, `GymPlanner · ${project.name} · Stückliste · ${dateDe()}`);
  drawPageHeader(doc, pageW, `${project.name} – Stückliste`, `${rows.length} Positionen · ${totals.anzahl} Objekte · Gewicht gesamt ${formatNumber(totals.gewicht, 0)} kg · Kosten ${formatNumber(totals.summe, 2)} EUR${totals.ohnePreis ? ` (${totals.ohnePreis} Position(en) ohne Preis)` : ''}`, [dateDe()]);
  footer();
  const ctx: TableCtx = {
    doc, pageW, pageH, y: PAGE_MARGIN_MM + TITLE_BLOCK_MM,
    newPage: () => { doc.addPage('a4', 'landscape'); drawPageHeader(doc, pageW, `${project.name} – Stückliste (Fortsetzung)`, '', []); footer(); ctx.y = PAGE_MARGIN_MM + TITLE_BLOCK_MM; },
  };
  const cols: Col[] = [
    { title: 'Hersteller', width: 20 },
    { title: 'Serie', width: 20 },
    { title: 'Modell', width: 22 },
    { title: 'Bezeichnung', width: 52 },
    { title: 'B cm', width: 11, align: 'right' },
    { title: 'T cm', width: 11, align: 'right' },
    { title: 'H cm', width: 11, align: 'right' },
    { title: 'kg', width: 13, align: 'right' },
    { title: 'Anz.', width: 9, align: 'right' },
    { title: 'Stück EUR', width: 19, align: 'right' },
    { title: 'Summe EUR', width: 21, align: 'right' },
    { title: 'Stockwerke', width: 22 },
    { title: 'Verif.', width: 9 },
    { title: 'Hinweis', width: 33 },
  ];
  const data: string[][] = rows.map((r) => [
    r.hersteller, r.serie, r.modell, r.bezeichnung,
    formatNumber(r.breite, 1), formatNumber(r.tiefe, 1), r.hoehe == null ? '–' : formatNumber(r.hoehe, 1), r.gewicht == null ? '–' : formatNumber(r.gewicht, 0),
    String(r.anzahl), r.stueckpreis == null ? '–' : formatNumber(r.stueckpreis, 2), r.summe == null ? '–' : formatNumber(r.summe, 2),
    r.stockwerke.join(', '), r.verifiziert ? 'Ja' : 'Nein', r.hinweis,
  ]);
  data.push(['Summe', '', '', `${rows.length} Positionen`, '', '', '', formatNumber(totals.gewicht, 0), String(totals.anzahl), '', formatNumber(totals.summe, 2), '', '', totals.ohnePreis ? `${totals.ohnePreis} ohne Preis` : '']);
  if (!rows.length) data.splice(0, 0, ['Keine Objekte platziert', '', '', '', '', '', '', '', '0', '', '', '', '', '']);
  drawTable(ctx, cols, data, { boldLast: true, zebra: true, fontSize: 7, rowH: 5 });
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/** Erzeugt das PDF-Dokument (ohne Download). */
export async function buildPdf(project: Project, opts: PdfOptions = {}): Promise<{ doc: JsPdf; warnings: string[] }> {
  const { jsPDF } = await import('jspdf');
  const scale = opts.scale ?? 100;
  const sorted = [...project.floors].sort((a, b) => a.order - b.order);
  const floors = opts.floorIds?.length ? sorted.filter((f) => opts.floorIds!.includes(f.id)) : sorted;
  const warnings: string[] = [];
  const renderOpts = { safetyZones: opts.safetyZones ?? true, labels: opts.labels ?? true, dpi: opts.dpi ?? 200 };

  let doc: JsPdf;
  if (floors.length) {
    // Erstes Blattformat vorab bestimmen (Konstruktor legt die erste Seite an)
    const probe = layoutFloorRender(project, floors[0], { pxPerCm: 1, safetyZones: renderOpts.safetyZones, legend: false, marginCm: 120 });
    const fmt = paperFormatForPlan(paperMmForCm(probe.planBounds.maxX - probe.planBounds.minX, scale), paperMmForCm(probe.planBounds.maxY - probe.planBounds.minY, scale)) ?? PAPER_FORMATS[PAPER_FORMATS.length - 1];
    doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: fmt.name, compress: true });
    floors.forEach((f, i) => {
      const r = drawPlanPage(doc, project, f, scale, renderOpts, i === 0);
      if (!r.fits) warnings.push(`Stockwerk „${f.name}“ passt bei 1:${scale} nicht auf A0.`);
    });
  } else {
    doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    drawPageHeader(doc, 297, project.name, `Keine Stockwerke vorhanden · ${dateDe()}`, [dateDe()]);
    doc.setFontSize(10);
    doc.text('Dieses Projekt enthält keinen Stockwerksplan.', PAGE_MARGIN_MM, PAGE_MARGIN_MM + TITLE_BLOCK_MM + 6);
    drawFooter(doc, 297, 210, `GymPlanner · ${project.name} · ${dateDe()}`);
  }
  if (opts.areaBalance ?? true) drawAreaBalancePages(doc, project, floors.length ? floors : sorted);
  if (opts.bom ?? true) drawBomPages(doc, project);
  doc.setProperties({ title: `${project.name} – GymPlanner`, subject: 'Grundriss- und Einrichtungsplan', creator: 'GymPlanner' });
  return { doc, warnings };
}

/** PDF exportieren: Pläne je Stockwerk (maßstäblich), Flächenbilanz, Stückliste. Download „<Projekt>.pdf“. */
export async function exportPdf(opts: PdfOptions = {}): Promise<void> {
  const ui = useUiStore.getState();
  const project = useProjectStore.getState().project;
  ui.toast('PDF wird erstellt …', 'info');
  try {
    const { doc, warnings } = await buildPdf(project, opts);
    for (const w of warnings) ui.toast(w, 'warning');
    if (opts.download !== false) doc.save(`${safeFileName(project.name)}.pdf`);
    ui.toast(`PDF „${project.name}“ exportiert (${doc.getNumberOfPages()} Seiten, Maßstab 1:${opts.scale ?? 100}).`, 'success');
  } catch (e) {
    ui.toast(`PDF-Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}
