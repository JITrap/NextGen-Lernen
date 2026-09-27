/*
 Assembliert den Businessplan (DOCX) aus kapitel-NN.json (Schema siehe SCHEMA.md), anhang.json (Tabellen), Diagrammen und Grundriss.
 Aufruf: node assemble.js <bp-dir> <out.docx>
*/
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  ImageRun, PageBreak, Footer, Header, PageNumber, TableOfContents, LevelFormat, PageOrientation, VerticalAlign, TabStopType,
} = require('docx');

const dir = process.argv[2];
const out = process.argv[3];
const FONT = 'Arial';
const BLUE = '1F3A5F';
const GREY = '5A5A5A';
const LIGHT = 'E8EEF5';
const LIGHT2 = 'F4F6F9';
const PAGE_W = 11906; // A4 DXA
const PAGE_H = 16838;
const MARGIN = 1134; // 2 cm
const CONTENT_W = PAGE_W - 2 * MARGIN; // 9638
const CONTENT_W_LS = PAGE_H - 2 * MARGIN; // Querformat 14570

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || 22, bold: opts.bold, italics: opts.italics, color: opts.color });
}
function p(text, opts = {}) {
  return new Paragraph({
    children: Array.isArray(text) ? text : [run(text, opts)],
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 120, line: opts.line ?? 276 },
    keepNext: opts.keepNext,
    indent: opts.indent,
    shading: opts.shading,
    border: opts.border,
  });
}
function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, pageBreakBefore: true });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, keepNext: true });
}
function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 }, keepNext: true });
}
function bullet(text) {
  return new Paragraph({ children: [run(text)], numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60, line: 276 }, alignment: AlignmentType.LEFT });
}
function caption(text) {
  return new Paragraph({ children: [run(text, { size: 18, italics: true, color: GREY })], alignment: AlignmentType.LEFT, spacing: { before: 60, after: 200 } });
}
function cell(text, opts = {}) {
  const lines = String(text ?? '').split('\n');
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading, color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 70, right: 70 },
    verticalAlign: VerticalAlign.CENTER,
    children: lines.map((l) => new Paragraph({ children: [run(l, { size: opts.size || 18, bold: opts.bold })], alignment: opts.align || AlignmentType.LEFT, spacing: { after: 0, line: 240 } })),
  });
}
function isNumeric(s) {
  return /^[-–−]?\d[\d.]*(,\d+)?( ?(€|%|m²|m|T€|Mon\.|Monate|Jahre|Pers\.|Mitgl\.|€\/m²|€\/Monat|Stk\.)?)?$/.test(String(s).trim()) || /^[-–−]?\d[\d.]*(,\d+)? €.*$/.test(String(s).trim());
}
function table(spec, contentWidth) {
  const cols = spec.spalten.length;
  let widths = spec.breiten && spec.breiten.length === cols ? spec.breiten : null;
  if (!widths) {
    widths = spec.spalten.map((_, i) => (i === 0 ? Math.max(18, Math.round(100 / cols) + 8) : 0));
    const rest = 100 - widths[0];
    for (let i = 1; i < cols; i++) widths[i] = rest / (cols - 1);
  }
  const sum = widths.reduce((a, b) => a + b, 0);
  const dxa = widths.map((w) => Math.round((w / sum) * contentWidth));
  const fontSize = cols > 7 ? 14 : cols > 5 ? 16 : 18;
  const header = new TableRow({ tableHeader: true, children: spec.spalten.map((s, i) => cell(s, { width: dxa[i], shading: LIGHT, bold: true, size: fontSize, align: i > 0 && cols > 2 ? AlignmentType.RIGHT : AlignmentType.LEFT })) });
  const rows = spec.zeilen.map((z, ri) => {
    const isTotal = /^(summe|gesamt|kapitalbedarf|investitionssumme|ebitda|jahresergebnis|kassenbestand ende|summe einzahlungen|summe auszahlungen)/i.test(String(z[0] || ''));
    return new TableRow({ children: z.map((v, i) => cell(v, { width: dxa[i], size: fontSize, bold: isTotal, shading: isTotal ? LIGHT2 : undefined, align: i > 0 && isNumeric(v) ? AlignmentType.RIGHT : AlignmentType.LEFT })) });
  });
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: dxa,
    rows: [header, ...rows],
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
  });
}
function image(file, width, titleText) {
  const buf = fs.readFileSync(path.join(dir, file));
  let w = 0, h = 0;
  // PNG-Größe aus Header
  if (buf.readUInt32BE(0) === 0x89504e47) { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
  const ratio = w && h ? h / w : 0.5;
  const targetW = width; // px in docx units (EMU via docx: width in px)
  const targetH = Math.round(targetW * ratio);
  return [
    new Paragraph({ children: [new ImageRun({ type: 'png', data: buf, transformation: { width: targetW, height: targetH } })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, keepNext: true }),
    caption(titleText || ''),
  ];
}
function kennzahlen(items, contentWidth) {
  const dxa = [Math.round(contentWidth * 0.55), Math.round(contentWidth * 0.45)];
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA }, columnWidths: dxa,
    rows: items.map((it) => new TableRow({ children: [cell(it[0], { width: dxa[0], size: 20, shading: LIGHT2 }), cell(it[1], { width: dxa[1], size: 20, bold: true, shading: LIGHT2, align: AlignmentType.RIGHT })] })),
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' }, insideVertical: none },
  });
}
function hinweis(text) {
  return new Paragraph({
    children: [run('Hinweis: ', { bold: true, size: 20, color: BLUE }), run(text, { size: 20 })],
    alignment: AlignmentType.LEFT, spacing: { before: 120, after: 160, line: 260 },
    shading: { type: ShadingType.CLEAR, fill: 'FFF8DC', color: 'auto' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'EDA100', space: 8 } },
    indent: { left: 120 },
  });
}

function renderBlocks(bloecke, contentWidth, imgWidth) {
  const outp = [];
  for (const b of bloecke) {
    switch (b.typ) {
      case 'h2': outp.push(h2(b.text)); break;
      case 'h3': outp.push(h3(b.text)); break;
      case 'absatz': outp.push(p(b.text)); break;
      case 'liste': for (const pt of b.punkte || []) outp.push(bullet(pt)); outp.push(p('', { after: 60 })); break;
      case 'tabelle':
        if (b.titel) outp.push(new Paragraph({ children: [run(b.titel, { bold: true, size: 20 })], spacing: { before: 160, after: 80 }, keepNext: true, alignment: AlignmentType.LEFT }));
        outp.push(table(b, contentWidth));
        outp.push(caption(b.quelle || ''));
        break;
      case 'abbildung': outp.push(...image(b.datei, imgWidth, b.titel)); break;
      case 'hinweis': outp.push(hinweis(b.text)); break;
      case 'kennzahlen': outp.push(kennzahlen(b.items, contentWidth)); outp.push(p('', { after: 80 })); break;
      default: if (b.text) outp.push(p(b.text));
    }
  }
  return outp;
}

// ---------------------------------------------------------------- Laden
const kapitel = fs.readdirSync(dir).filter((f) => /^kapitel-\d\d\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const anhang = JSON.parse(fs.readFileSync(path.join(dir, 'anhang.json'), 'utf8')).tables;
const zahlen = JSON.parse(fs.readFileSync(path.join(dir, 'zahlen.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));

const headerText = `Businessplan ${meta.titel} – vertraulich`;
const header = new Header({ children: [new Paragraph({ children: [run(headerText, { size: 16, color: GREY })], alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 } } })] });
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run('Seite ', { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY }), run(' von ', { size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: GREY })] })] });

// ---------------------------------------------------------------- Deckblatt
const cover = [
  new Paragraph({ spacing: { before: 2400 } }),
  new Paragraph({ children: [run('BUSINESSPLAN', { size: 56, bold: true, color: BLUE })], alignment: AlignmentType.LEFT, spacing: { after: 200 } }),
  new Paragraph({ children: [run(meta.titel, { size: 40, bold: true })], alignment: AlignmentType.LEFT, spacing: { after: 120 } }),
  new Paragraph({ children: [run(meta.untertitel, { size: 26, color: GREY })], alignment: AlignmentType.LEFT, spacing: { after: 600 } }),
  new Paragraph({ children: [run('Gründer und Geschäftsführer: ', { size: 24 }), run(meta.gruender, { size: 24, bold: true })], alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  new Paragraph({ children: [run('Rechtsform: ', { size: 24 }), run(meta.rechtsform, { size: 24 })], alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  new Paragraph({ children: [run('Standort: ', { size: 24 }), run(meta.standort, { size: 24 })], alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  new Paragraph({ children: [run('Geplante Eröffnung: ', { size: 24 }), run(meta.eroeffnung, { size: 24 })], alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  new Paragraph({ children: [run('Kapitalbedarf: ', { size: 24 }), run(meta.kapitalbedarf, { size: 24, bold: true })], alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  new Paragraph({ children: [run('Stand: ', { size: 24 }), run(meta.stand, { size: 24 })], alignment: AlignmentType.LEFT, spacing: { after: 1200 } }),
  new Paragraph({ children: [run('Kontakt: ' + meta.kontakt, { size: 20, color: GREY })], alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  new Paragraph({ children: [run('Vertraulichkeitshinweis: Dieser Businessplan enthält vertrauliche Informationen und ist ausschließlich für die Prüfung einer Finanzierung durch die adressierten Kreditinstitute und Förderbanken bestimmt. Eine Weitergabe an Dritte bedarf der Zustimmung des Verfassers.', { size: 18, color: GREY })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 } }),
  new Paragraph({ children: [run('Grundlage: Planungsprojekt „No.1 (überarbeitet)“ aus der Planungssoftware GymPlanner (Grundriss, Stückliste, Kapazitäts- und Regularienprüfung) und die beiliegende Excel-Planrechnung Finanzplan_No1.xlsx.', { size: 18, color: GREY })], alignment: AlignmentType.JUSTIFIED }),
];

// ---------------------------------------------------------------- Inhaltsverzeichnis
const toc = [
  new Paragraph({ children: [run('Inhaltsverzeichnis', { size: 32, bold: true, color: BLUE })], spacing: { after: 240 }, pageBreakBefore: true }),
  new TableOfContents('Inhalt', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [run('Abbildungen und Tabellen sind im Text nummeriert; der Anhang enthält die vollständigen Zahlentabellen der Planrechnung.', { size: 18, italics: true, color: GREY })], spacing: { before: 240 } }),
];

// ---------------------------------------------------------------- Kapitel
const body = [];
for (const k of kapitel) {
  body.push(h1(`${k.nummer} ${k.titel}`));
  body.push(...renderBlocks(k.bloecke || [], CONTENT_W, 600));
}

// ---------------------------------------------------------------- Anhang (Hochformat: A, B, D, E, G, H; Querformat: C)
const anhangTitel = { A: 'Anhang A – Investitions- und Geräteliste', B: 'Anhang B – Tilgungspläne', C: 'Anhang C – Liquiditätsplan (monatlich)', D: 'Anhang D – Rentabilitätsvorschau (Plan-GuV)', E: 'Anhang E – Planungsannahmen', F: 'Anhang F – Grundriss', G: 'Anhang G – Immobilien-Shortlist', H: 'Anhang H – Regularien-Checkliste', I: 'Anhang I – Quellen' };
const portraitAppendix = [];
const landscapeAppendix = [];
function appendixSection(letter, target, width) {
  target.push(h1(anhangTitel[letter]));
  for (const t of anhang.filter((x) => x.anhang === letter)) {
    target.push(new Paragraph({ children: [run(t.titel, { bold: true, size: 20 })], spacing: { before: 200, after: 80 }, keepNext: true, alignment: AlignmentType.LEFT }));
    target.push(table(t, width));
    if (t.quelle) target.push(caption(t.quelle));
  }
}
appendixSection('A', portraitAppendix, CONTENT_W);
appendixSection('B', portraitAppendix, CONTENT_W);
appendixSection('D', portraitAppendix, CONTENT_W);
appendixSection('E', portraitAppendix, CONTENT_W);
// F Grundriss
portraitAppendix.push(h1(anhangTitel.F));
portraitAppendix.push(p('Der Grundriss stammt aus der Planungssoftware GymPlanner (Projekt „No.1 (überarbeitet)“, Maßstab nach Fläche 59,5 × 33,2 m). Er zeigt Räume mit Flächen, Trainingszonen, Geräteaufstellung, Notausgänge, Fluchtwege und Sicherheitsausstattung. Die Datei liegt zusätzlich als Projektdatei und PDF-Plan bei.'));
appendixSection('G', portraitAppendix, CONTENT_W);
appendixSection('H', portraitAppendix, CONTENT_W);
// I Quellen
portraitAppendix.push(h1(anhangTitel.I));
const quellen = new Set();
for (const k of kapitel) for (const q of k.quellen || []) quellen.add(q);
for (const q of meta.quellen_zusatz || []) quellen.add(q);
for (const q of [...quellen].sort()) portraitAppendix.push(bullet(q));
// Grundriss-Section (Querformat) und C (Querformat)
appendixSection('C', landscapeAppendix, CONTENT_W_LS);

const grundriss = [
  new Paragraph({ children: [run('Abbildung F.1: Grundriss No.1 (überarbeitet) – Erdgeschoss, 1.975 m² Bruttofläche', { bold: true, size: 20 })], spacing: { after: 80 }, alignment: AlignmentType.LEFT }),
  ...image('grundriss-no1.png', 940, 'Quelle: GymPlanner, Export September 2026; Legende der Raumtypen am unteren Bildrand'),
];

const doc = new Document({
  creator: meta.gruender,
  title: `Businessplan ${meta.titel}`,
  description: 'Businessplan für die Bank',
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: BLUE, font: FONT }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: BLUE, font: FONT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: '000000', font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 240 } } } }] }] },
  features: { updateFields: true },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: cover },
    { properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, headers: { default: header }, footers: { default: footer }, children: [...toc, ...body, ...portraitAppendix] },
    { properties: { page: { size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.LANDSCAPE }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, headers: { default: header }, footers: { default: footer }, children: [...grundriss, ...landscapeAppendix] },
  ],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log('geschrieben', out, buf.length, 'Bytes; Kapitel', kapitel.map((k) => k.nummer).join(','), '; Anhangtabellen', anhang.length); });
