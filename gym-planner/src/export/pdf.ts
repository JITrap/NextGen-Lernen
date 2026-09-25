/**
 * PDF-Export (jsPDF, ohne autoTable): je Stockwerk eine maßstäbliche Planseite (Titelblock, Plan als eingebettetes
 * PNG mit exakter Papierbreite, Maßstabsbalken, Legende), danach Flächenbilanz und Stückliste als Tabellen.
 *
 * Maßstab: 1 cm Welt = 10/scale mm Papier (paperMmForCm). Bei 1:100 sind 25 m Halle = 250 mm.
 * jsPDF wird erst beim Export dynamisch geladen (eigener Chunk).
 */
import type { Project, Floor, RoomType } from '@/types';
import type { jsPDF as JsPdf } from 'jspdf';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { polygonArea } from '@/geometry/polygon';
import { hallInnerPolygon } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { formatNumber, formatM2 } from '@/geometry/units';
import { ROOM_TYPE_MAP, AREA_CLASSES, roomColor, type AreaClass } from '@/data/roomTypes';
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
/* Flächenbilanz (lokal berechnet)                                     */
/* ------------------------------------------------------------------ */

export interface AreaByType { type: RoomType; areaClass: AreaClass; count: number; m2: number; percent: number }
export interface AreaByClass { areaClass: AreaClass; m2: number; percent: number }
export interface FloorAreaBalance {
  floorId: string;
  floorName: string;
  /** Brutto-Hallenfläche (Außenkante) in m². */
  grossM2: number;
  /** Netto (Innenkante der Außenwände abzüglich Lufträume) in m². */
  netM2: number;
  voidM2: number;
  byType: AreaByType[];
  byClass: AreaByClass[];
  /** Netto-Fläche ohne Raumzuordnung (falls positiv). */
  unassignedM2: number;
}
export interface ProjectAreaBalance {
  floors: FloorAreaBalance[];
  grossM2: number;
  netM2: number;
  byClass: AreaByClass[];
  byType: AreaByType[];
}

const m2 = (poly: { x: number; y: number }[]) => polygonArea(poly) / 10000;

export function floorAreaBalance(floor: Floor): FloorAreaBalance {
  const rooms = floorRooms(floor);
  const grossM2 = floor.hall && floor.hall.polygon.length >= 3 ? m2(floor.hall.polygon) : 0;
  const innerM2 = floor.hall && floor.hall.polygon.length >= 3 ? m2(hallInnerPolygon(floor.hall)) : 0;
  const voidM2 = floor.voids.reduce((s, v) => s + (v.polygon.length >= 3 ? m2(v.polygon) : 0), 0);
  const roomSum = rooms.reduce((s, r) => s + r.areaM2, 0);
  const base = grossM2 > 0 ? grossM2 : roomSum;
  const netM2 = grossM2 > 0 ? Math.max(0, innerM2 - voidM2) : roomSum;
  const typeMap = new Map<RoomType, AreaByType>();
  for (const r of rooms) {
    const info = ROOM_TYPE_MAP[r.type];
    let e = typeMap.get(r.type);
    if (!e) { e = { type: r.type, areaClass: info?.areaClass ?? 'Nebenfläche', count: 0, m2: 0, percent: 0 }; typeMap.set(r.type, e); }
    e.count += 1;
    e.m2 += r.areaM2;
  }
  const byType = [...typeMap.values()].sort((a, b) => b.m2 - a.m2);
  for (const e of byType) e.percent = base > 0 ? (e.m2 / base) * 100 : 0;
  const byClass: AreaByClass[] = AREA_CLASSES.map((areaClass) => {
    const sum = byType.filter((t) => t.areaClass === areaClass).reduce((s, t) => s + t.m2, 0);
    return { areaClass, m2: sum, percent: base > 0 ? (sum / base) * 100 : 0 };
  }).filter((c) => c.m2 > 0);
  return { floorId: floor.id, floorName: floor.name, grossM2, netM2, voidM2, byType, byClass, unassignedM2: Math.max(0, netM2 - roomSum) };
}

export function projectAreaBalance(project: Project): ProjectAreaBalance {
  const floors = [...project.floors].sort((a, b) => a.order - b.order).map(floorAreaBalance);
  const grossM2 = floors.reduce((s, f) => s + f.grossM2, 0);
  const netM2 = floors.reduce((s, f) => s + f.netM2, 0);
  const base = grossM2 > 0 ? grossM2 : floors.reduce((s, f) => s + f.byType.reduce((x, t) => x + t.m2, 0), 0);
  const typeMap = new Map<RoomType, AreaByType>();
  for (const f of floors) for (const t of f.byType) {
    const e = typeMap.get(t.type) ?? { ...t, count: 0, m2: 0, percent: 0 };
    e.count += t.count;
    e.m2 += t.m2;
    typeMap.set(t.type, e);
  }
  const byType = [...typeMap.values()].sort((a, b) => b.m2 - a.m2);
  for (const e of byType) e.percent = base > 0 ? (e.m2 / base) * 100 : 0;
  const byClass = AREA_CLASSES.map((areaClass) => {
    const sum = byType.filter((t) => t.areaClass === areaClass).reduce((s, t) => s + t.m2, 0);
    return { areaClass, m2: sum, percent: base > 0 ? (sum / base) * 100 : 0 };
  }).filter((c) => c.m2 > 0);
  return { floors, grossM2, netM2, byClass, byType };
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

  const balance = floorAreaBalance(floor);
  const variant = project.variantName ? `Variante „${project.variantName}“ · ` : '';
  drawPageHeader(doc, pageW, project.name, `${variant}Stockwerk „${floor.name}“ · Deckenhöhe ${formatNumber(floor.ceilingHeight / 100, 2)} m · ${dateDe()}`, [
    `Maßstab 1:${scale}`,
    `Brutto ${formatM2(balance.grossM2)} · Netto ${formatM2(balance.netM2)}`,
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

function drawAreaBalancePages(doc: JsPdf, project: Project, floors: Floor[]) {
  doc.addPage('a4', 'landscape');
  const pageW = 297;
  const pageH = 210;
  const footer = () => drawFooter(doc, pageW, pageH, `GymPlanner · ${project.name} · Flächenbilanz · ${dateDe()}`);
  drawPageHeader(doc, pageW, `${project.name} – Flächenbilanz`, `${floors.length} Stockwerk(e) · Prozentwerte bezogen auf die Brutto-Hallenfläche · ${dateDe()}`, [dateDe()]);
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
  const balances = floors.map(floorAreaBalance);
  for (const b of balances) {
    if (ctx.y + 30 > pageH - PAGE_MARGIN_MM) ctx.newPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Stockwerk „${b.floorName}“`, PAGE_MARGIN_MM, ctx.y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Brutto ${formatM2(b.grossM2)} · Netto ${formatM2(b.netM2)}${b.voidM2 ? ` · Luftraum ${formatM2(b.voidM2)}` : ''}${b.unassignedM2 > 0.005 ? ` · ohne Raumzuordnung ${formatM2(b.unassignedM2)}` : ''}`, PAGE_MARGIN_MM + 60, ctx.y + 4);
    ctx.y += 7;
    const rows: string[][] = b.byType.map((t) => [t.type, t.areaClass, String(t.count), formatNumber(t.m2, 2), formatNumber(t.percent, 1)]);
    for (const c of b.byClass) rows.push([`Summe ${c.areaClass}`, '', '', formatNumber(c.m2, 2), formatNumber(c.percent, 1)]);
    const roomSum = b.byType.reduce((s, t) => s + t.m2, 0);
    rows.push(['Räume gesamt', '', String(b.byType.reduce((s, t) => s + t.count, 0)), formatNumber(roomSum, 2), formatNumber(b.grossM2 > 0 ? (roomSum / b.grossM2) * 100 : 0, 1)]);
    if (!b.byType.length) rows.splice(0, rows.length, ['Keine Räume/Zonen definiert', '', '', formatNumber(0, 2), formatNumber(0, 1)]);
    drawTable(ctx, cols, rows, { boldLast: true, zebra: true });
    ctx.y += 6;
  }
  if (balances.length > 1) {
    const total = projectAreaBalance(project);
    if (ctx.y + 30 > pageH - PAGE_MARGIN_MM) ctx.newPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Gesamt (alle Stockwerke)', PAGE_MARGIN_MM, ctx.y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Brutto ${formatM2(total.grossM2)} · Netto ${formatM2(total.netM2)}`, PAGE_MARGIN_MM + 60, ctx.y + 4);
    ctx.y += 7;
    const rows = total.byType.map((t) => [t.type, t.areaClass, String(t.count), formatNumber(t.m2, 2), formatNumber(t.percent, 1)]);
    for (const c of total.byClass) rows.push([`Summe ${c.areaClass}`, '', '', formatNumber(c.m2, 2), formatNumber(c.percent, 1)]);
    rows.push(['Räume gesamt', '', String(total.byType.reduce((s, t) => s + t.count, 0)), formatNumber(total.byType.reduce((s, t) => s + t.m2, 0), 2), formatNumber(total.byType.reduce((s, t) => s + t.percent, 0), 1)]);
    drawTable(ctx, cols, rows, { boldLast: true, zebra: true });
  }
}

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
