/**
 * PDF-Seiten „Regularien & Brandschutz“: Kopf mit Bemessungspersonen und Zählern, Tabelle (Thema, Prüfung, Status,
 * Ist, Soll, Quelle) mit Zebra-Streifen und Seitenumbruch – für alle Stockwerke (Spalte „Prüfung“ trägt bei mehreren
 * Stockwerken den Stockwerksnamen). Anschließend eine Legende der Status-Werte und der Hinweis auf die Annahmen.
 */
import type { jsPDF } from 'jspdf';
import type { Project } from '@/types';
import { regulations, REGULATION_STATUS_LABELS, STAFF_DEFAULT, type RegulationCheck } from '@/analysis/regulations';
import { drawPageHeader, drawFooter, drawTable, dateDe, PAGE_MARGIN_MM, TITLE_BLOCK_MM, type TableCtx, type Col } from './pdf';

/** Tabellenzeilen der Prüfungen (reine Funktion, testbar). */
/** jsPDF setzt die Standardschriften in WinAnsi; ≤/≥/→ liegen außerhalb und würden den ganzen String verstümmeln. */
export function pdfSafe(s: string): string {
  return s.replace(/≤ ?/g, 'max. ').replace(/≥ ?/g, 'mind. ').replace(/→/g, '->').replace(/·/g, '-').replace(/[^\u0000-\u00ff\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/g, '?');
}

export function regulationRows(project: Project, checks: RegulationCheck[] = regulations(project).checks): string[][] {
  const multi = project.floors.length > 1;
  const names = new Map(project.floors.map((f) => [f.id, f.name]));
  return checks.map((c) => [
    c.thema,
    multi && c.floorId ? `${c.titel} - ${names.get(c.floorId) ?? ''}` : c.titel,
    REGULATION_STATUS_LABELS[c.status],
    c.ist,
    c.soll,
    c.quelle,
  ].map(pdfSafe));
}

export function drawRegulationsPages(doc: jsPDF, project: Project): void {
  const report = regulations(project);
  const rows = regulationRows(project, report.checks);
  const c = report.counts;
  doc.addPage('a4', 'landscape');
  const pageW = 297;
  const pageH = 210;
  const footer = () => drawFooter(doc, pageW, pageH, `GymPlanner · ${project.name} · Regularien & Brandschutz · ${dateDe()}`);
  const subtitle = `${report.persons} Bemessungspersonen (${report.trainees} Trainierende + ${report.staff} Beschäftigte) · ${c.fail} nicht erfüllt · ${c.warn} prüfen · ${c.ok} erfüllt · ${c.info} Hinweise · ${dateDe()}`;
  drawPageHeader(doc, pageW, `${project.name} – Regularien & Brandschutz`, subtitle, [dateDe()]);
  footer();
  const ctx: TableCtx = {
    doc, pageW, pageH, y: PAGE_MARGIN_MM + TITLE_BLOCK_MM,
    newPage: () => { doc.addPage('a4', 'landscape'); drawPageHeader(doc, pageW, `${project.name} – Regularien & Brandschutz (Fortsetzung)`, '', []); footer(); ctx.y = PAGE_MARGIN_MM + TITLE_BLOCK_MM; },
  };
  const cols: Col[] = [
    { title: 'Thema', width: 36 },
    { title: 'Prüfung', width: 62 },
    { title: 'Status', width: 20 },
    { title: 'Ist', width: 52 },
    { title: 'Soll', width: 52 },
    { title: 'Quelle', width: 51 },
  ];
  drawTable(ctx, cols, rows.length ? rows : [['–', 'Keine Prüfungen', '', '', '', '']], { zebra: true, rowH: 5.2, fontSize: 7, wrap: true });
  ctx.y += 5;
  const lines = [
    `Status: ${REGULATION_STATUS_LABELS.fail} = Anforderung im Plan verletzt · ${REGULATION_STATUS_LABELS.warn} = manuell prüfen bzw. Ausstattung ergänzen · ${REGULATION_STATUS_LABELS.ok} = erfüllt · ${REGULATION_STATUS_LABELS.info} = organisatorischer Hinweis · ${REGULATION_STATUS_LABELS.na} = nicht anwendbar.`,
    `Annahmen: Bemessungspersonen = Trainierende laut Kapazität (${report.trainees}) + ${STAFF_DEFAULT} Beschäftigte; Fluchtweglängen als Luftlinie auf 50-cm-Raster; Löschmitteleinheiten konservativ 6 LE je Feuerlöscher ohne Angabe.`,
    'Planungshilfe nach ASR A2.3, A2.2, A1.3, A3.4/7, A4.1, A4.3, V3a.2, DGUV Vorschrift 1, MBO/MVStättVO – ersetzt kein Brandschutzkonzept und keine Abstimmung mit Bauaufsicht und Unfallversicherungsträger.',
  ];
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, pageW - 2 * PAGE_MARGIN_MM) as string[];
    if (ctx.y + wrapped.length * 3.4 > pageH - PAGE_MARGIN_MM) ctx.newPage();
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(wrapped, PAGE_MARGIN_MM, ctx.y + 3);
    ctx.y += wrapped.length * 3.4 + 1.5;
  }
  doc.setTextColor(15, 23, 42);
}
