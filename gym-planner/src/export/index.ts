/**
 * Export-API. Alle Export-Funktionen arbeiten standardmäßig auf dem aktuellen Projekt aus dem Store.
 *
 * - exportPng({ floorId?, scaleFactor? })      PNG des Stockwerks (hochauflösend)
 * - exportPdf({ floorIds?, scale? })           PDF: maßstäbliche Pläne + Flächenbilanz + Stückliste
 * - exportCsv(project?)                         Stückliste als CSV (Excel DE)
 * - exportJson(project?) / importJsonFile()     Projekt als JSON sichern / laden (liefert Projekt, lädt nicht selbst)
 * - serializeProject / parseProject             reine Text-Konvertierung (validiert + migriert)
 *
 * Flächenbilanz (floorAreaBalance/projectAreaBalance) und Stückliste (bomRows/bomTotals/bomCsvText) sind Adapter auf
 * areaBalance()/bom() aus src/analysis – Export und Panel „Übersicht“ liefern dieselben Zahlen.
 */
export { exportPng, exportAllFloorsPng, renderFloorPng, pngPxPerCm, PNG_BASE_PX_PER_CM, type PngOptions } from './png';
export { exportPdf, buildPdf, floorAreaBalance, projectAreaBalance, paperFormatForPlan, PAPER_FORMATS, type PdfOptions, type PdfScale, type FloorAreaBalance, type ProjectAreaBalance, type AreaByType, type AreaByClass } from './pdf';
export { exportCsv, bomRows, bomTotals, bomCsvText, unitPrice, CSV_HEADER, type BomRow, type BomTotals } from './csv';
export {
  exportJson, importJsonFile, importProjectFromText, serializeProject, parseProject, parseProjectDetailed, stableStringify,
  downloadBlob, safeFileName, pickJsonFile, JSON_FORMAT, JSON_FILE_SUFFIX, type ParsedProject,
} from './json';
export {
  renderFloorToCanvas, layoutFloorRender, floorContentBounds, paperMmForCm, cmForPaperMm, pxPerCmForPaper, clampPxPerCm,
  scaleBarLength, legendRoomTypes, itemAreaColor, itemShortLabel, AREA_COLORS, MAX_IMAGE_PX,
  type RenderOptions, type RenderResult, type RenderLayout,
} from './planRenderer';
