#!/usr/bin/env node
// Build numbered 3x4 contact sheets from downloads/*.jpg into auswahl-1.jpg etc.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BASE = '/home/user/NextGen-Lernen/tools/design-recherche';
const DOWNLOADS = path.join(BASE, 'downloads');

const COLS = 3;
const ROWS = 4;
const PER_SHEET = COLS * ROWS; // 12
const CELL_W = 620;
const CELL_H = 620;
const GAP = 8;
const PADDING = 20;
const LABEL_BG = '#111111';

const SHEET_W = PADDING * 2 + COLS * CELL_W + (COLS - 1) * GAP;
const SHEET_H = PADDING * 2 + ROWS * CELL_H + (ROWS - 1) * GAP;

async function getFiles() {
  const files = fs.readdirSync(DOWNLOADS)
    .filter(f => /^\d{2}-/.test(f))
    .sort();
  return files;
}

function numberBadgeSVG(nr) {
  const r = 42;
  const cx = r + 6;
  const cy = r + 6;
  const fontSize = nr >= 10 ? 40 : 46;
  return Buffer.from(`
    <svg width="${cx + r + 6}" height="${cy + r + 6}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${LABEL_BG}" stroke="white" stroke-width="3"/>
      <text x="${cx}" y="${cy}" font-family="Arial, Helvetica, sans-serif" font-weight="700"
            font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="central">${nr}</text>
    </svg>
  `);
}

async function buildCell(filePath, nr) {
  const img = sharp(filePath).rotate(); // auto-orient
  const resized = await img
    .resize(CELL_W, CELL_H, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 90 })
    .toBuffer();

  const badge = numberBadgeSVG(nr);

  const composed = await sharp(resized)
    .composite([{ input: badge, top: 10, left: 10 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return composed;
}

async function buildSheet(files, sheetIndex, startNr) {
  const composites = [];
  for (let i = 0; i < files.length; i++) {
    const nr = startNr + i;
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const left = PADDING + col * (CELL_W + GAP);
    const top = PADDING + row * (CELL_H + GAP);
    const cellBuf = await buildCell(path.join(DOWNLOADS, files[i]), nr);
    composites.push({ input: cellBuf, left, top });
  }

  const outPath = path.join(BASE, `auswahl-${sheetIndex}.jpg`);
  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 3,
      background: '#f2f0ec',
    },
  })
    .composite(composites)
    .resize({ width: 2000, withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toFile(outPath);

  console.log(`Wrote ${outPath} (${files.length} images, nr ${startNr}-${startNr + files.length - 1})`);
}

async function main() {
  const files = await getFiles();
  console.log(`Found ${files.length} source files`);
  let sheetIndex = 1;
  for (let i = 0; i < files.length; i += PER_SHEET) {
    const chunk = files.slice(i, i + PER_SHEET);
    const startNr = i + 1;
    await buildSheet(chunk, sheetIndex, startNr);
    sheetIndex++;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
