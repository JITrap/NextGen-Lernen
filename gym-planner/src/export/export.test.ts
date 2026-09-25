import { describe, it, expect } from 'vitest';
import type { Project } from '@/types';
import { createEmptyProject, createFloor, createHall, createWall, createZone, createItemFromDef } from '@/store/factories';
import { getDef } from '@/data/equipment';
import { areaBalance, bom } from '@/analysis';
import { serializeProject, parseProject, parseProjectDetailed, stableStringify, safeFileName, importSizeError, MAX_IMPORT_BYTES } from './json';
import { bomRows, bomTotals, bomCsvText, csvNumber, csvCell, CSV_HEADER } from './csv';
import {
  paperMmForCm, cmForPaperMm, pxPerCmForPaper, clampPxPerCm, floorContentBounds, layoutFloorRender, scaleBarLength, legendRoomTypes,
  renderFloorToCanvas, MAX_IMAGE_PX, itemShortLabel, roomLabelBoxes, hallSummaryText,
} from './planRenderer';
import { pngPxPerCm } from './png';
import { paperFormatForPlan, floorAreaBalance, projectAreaBalance, buildPdf } from './pdf';
import { floorRooms } from '@/geometry/rooms';
import { rectPolygon } from '@/geometry/polygon';
import { formatM2 } from '@/geometry/units';

function sampleProject(): Project {
  const p = createEmptyProject('Studio Nord');
  const f = p.floors[0];
  f.hall = createHall(2500, 2000);
  const wall = createWall({ start: { x: 100, y: 100 }, end: { x: 900, y: 100 }, type: 'Glaswand' });
  f.walls.push(wall);
  f.openings.push({ id: 'o1', kind: 'door', wallId: wall.id, offset: 300, width: 90, doorType: 'Notausgang', height: 210, hinge: 'left', swingSide: 'b' });
  f.openings.push({ id: 'o2', kind: 'window', wallId: 'hall_0', offset: 500, width: 120, height: 120, sillHeight: 90 });
  f.openings.push({ id: 'o3', kind: 'mirror', wallId: wall.id, offset: 700, width: 200, height: 200, side: 'a' });
  f.zones.push(createZone({ polygon: [{ x: 100, y: 100 }, { x: 1100, y: 100 }, { x: 1100, y: 1100 }, { x: 100, y: 1100 }], name: 'Cardio', type: 'Cardio' }));
  f.zones.push(createZone({ polygon: [{ x: 1200, y: 100 }, { x: 2400, y: 100 }, { x: 2400, y: 1100 }, { x: 1200, y: 1100 }], name: 'Maschinen', type: 'Maschinen', color: '#123456' }));
  f.items.push(createItemFromDef(getDef('atlantis-a301')!, 400, 400));
  f.items.push(createItemFromDef(getDef('atlantis-a301')!, 700, 400, { rotation: 90 }));
  f.items.push(createItemFromDef(getDef('prime-hybrid-leg-press')!, 1500, 600, { note: 'Notiz' }));
  f.voids.push({ id: 'v1', polygon: [{ x: 1500, y: 1300 }, { x: 2000, y: 1300 }, { x: 2000, y: 1800 }, { x: 1500, y: 1800 }], name: 'Galerie offen' });
  f.annotations.push({ id: 'a1', kind: 'text', x: 200, y: 1500, text: 'Hinweis', fontSize: 30, rotation: 0 });
  f.annotations.push({ id: 'a2', kind: 'measure', start: { x: 100, y: 1900 }, end: { x: 2400, y: 1900 } });
  f.roomMeta['r:1:1'] = { name: 'Raum', type: 'Büro' };
  p.customEquipment.push({
    id: 'custom-1', kategorie: 'Eigene', unterkategorie: '', hersteller: 'Generisch', name: 'Eigene Theke', breite_cm: 300, tiefe_cm: 80, hoehe_cm: 110,
    sicherheitszone_cm: { vorne: 60, hinten: 0, links: 0, rechts: 0 }, form: 'rechteck', skalierbar: true, verifiziert: false, bereich: 'Eigene', symbol: 'counter', benutzerdefiniert: true, preis_eur: 999,
  });
  f.items.push(createItemFromDef(p.customEquipment[0], 2000, 1500));
  p.favorites.push('atlantis-a301');
  p.priceOverrides['atlantis-a301'] = 1000;
  return p;
}

const canvasSupported = (() => {
  try {
    return !!document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
})();

describe('JSON-Export/-Import', () => {
  it('Roundtrip serialize → parse ist deepEqual', () => {
    const p = sampleProject();
    const text = serializeProject(p, '2026-09-25T10:00:00.000Z');
    expect(text.startsWith('{\n  "app": "GymPlanner"')).toBe(true);
    const back = parseProject(text);
    expect(back).toEqual(p);
    const detailed = parseProjectDetailed(text);
    expect(detailed.exportedAt).toBe('2026-09-25T10:00:00.000Z');
    expect(detailed.warnings).toEqual([]);
  });

  it('ist stabil: gleiche Daten, andere Schlüsselreihenfolge → gleicher Text', () => {
    const a = { b: 1, a: [{ y: 2, x: 1 }] };
    const b = { a: [{ x: 1, y: 2 }], b: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
    const p = sampleProject();
    expect(serializeProject(p, 'T')).toBe(serializeProject(JSON.parse(JSON.stringify(p)) as Project, 'T'));
  });

  it('akzeptiert auch ein nacktes Projektobjekt und migriert alte Stände', () => {
    const p = sampleProject();
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    const old = { id: 'p1', name: 'Alt', floors: [{ id: 'f1', name: 'EG' }] };
    const m = parseProject(JSON.stringify(old));
    expect(m.settings).toBeDefined();
    expect(m.floors[0].items).toEqual([]);
  });

  it('liefert deutsche Fehlermeldungen', () => {
    expect(() => parseProject('kein json')).toThrow(/gültiges JSON/);
    expect(() => parseProject('{"foo":1}')).toThrow(/keine gültige GymPlanner-Projektdatei/);
    expect(() => parseProject('{"format":"gymplanner-project","project":{"id":"x","name":"y","floors":[]}}')).toThrow(/mindestens ein Stockwerk/);
  });

  it('meldet unbekannte Geräte-IDs als Warnung', () => {
    const p = sampleProject();
    p.floors[0].items[0].defId = 'unbekannt-xyz';
    const r = parseProjectDetailed(serializeProject(p));
    expect(r.warnings.some((w) => w.includes('unbekannt-xyz'))).toBe(true);
    expect(r.project.floors[0].items[0].defId).toBe('unbekannt-xyz');
  });

  it('safeFileName entfernt unzulässige Zeichen', () => {
    expect(safeFileName('Studio: Nord/Süd?')).toBe('Studio- Nord-Süd-');
    expect(safeFileName('   ')).toBe('projekt');
  });
});

describe('CSV-Stückliste', () => {
  it('fasst gleiche Geräte zusammen und rechnet Summen', () => {
    const p = sampleProject();
    const rows = bomRows(p);
    const a301 = rows.find((r) => r.modell === 'A301')!;
    expect(a301.anzahl).toBe(2);
    expect(a301.stueckpreis).toBe(1000);
    expect(a301.preisGemischt).toBe(false);
    expect(a301.summe).toBe(2000);
    expect(a301.hersteller).toBe('Atlantis');
    expect(a301.verifiziert).toBe(true);
    expect(a301.stockwerke).toEqual(['EG']);
    expect(a301.itemIds.length).toBe(2);
    const custom = rows.find((r) => r.defId === 'custom-1')!;
    expect(custom.stueckpreis).toBe(999);
    expect(custom.verifiziert).toBe(false);
    const lp = rows.find((r) => r.defId === 'prime-hybrid-leg-press')!;
    expect(lp.stueckpreis).toBeNull();
    expect(lp.summe).toBeNull();
    const t = bomTotals(rows);
    expect(t.anzahl).toBe(4);
    expect(t.summe).toBe(2999);
    expect(t.ohnePreis).toBe(1);
    expect(t.gewicht).toBe(284 * 2 + 524);
  });

  it('liefert exakt die Zahlen von bom(project) aus src/analysis', () => {
    // 2 gleiche Geräte mit Objektpreis 1000
    const p = createEmptyProject('Zwei Geräte');
    p.floors[0].hall = createHall(2500, 2000);
    const rack = getDef('atlantis-c513')!;
    p.floors[0].items.push(createItemFromDef(rack, 300, 300, { priceEur: 1000 }));
    p.floors[0].items.push(createItemFromDef(rack, 700, 300, { priceEur: 1000 }));
    const rows = bomRows(p);
    const list = bom(p);
    expect(rows.length).toBe(1);
    expect(list.lines.length).toBe(1);
    expect(rows[0].anzahl).toBe(2);
    expect(rows[0].anzahl).toBe(list.lines[0].count);
    expect(rows[0].stueckpreis).toBe(list.lines[0].unitPriceEur);
    expect(rows[0].summe).toBe(2000);
    expect(rows[0].summe).toBe(list.lines[0].totalEur);
    expect(rows[0].gewicht).toBe(list.lines[0].weightKg);
    expect(rows[0].stockwerke).toEqual(list.lines[0].floorCounts.map((f) => f.floorName));
    expect(rows[0].itemIds).toEqual(list.lines[0].itemIds);
    const t = bomTotals(rows);
    expect(t.anzahl).toBe(list.totalCount);
    expect(t.summe).toBe(list.totalEur);
    expect(t.gewicht).toBe(list.totalWeightKg);
    expect(t.ohnePreis).toBe(list.linesWithoutPrice);
    // Auch im größeren Beispielprojekt: Positionen, Reihenfolge und Summen 1:1
    const sp = sampleProject();
    const srows = bomRows(sp);
    const sl = bom(sp);
    expect(srows.map((r) => [r.key, r.defId, r.anzahl, r.stueckpreis, r.summe])).toEqual(sl.lines.map((l) => [l.key, l.defId, l.count, l.unitPriceEur, l.totalEur]));
    expect(new Set(srows.map((r) => r.key)).size).toBe(srows.length);
    expect(bomTotals(srows)).toEqual({ anzahl: sl.totalCount, gewicht: sl.totalWeightKg, summe: sl.totalEur, ohnePreis: sl.linesWithoutPrice });
  });

  it('unterschiedliche Objektpreise → eine Position mit Mittelwert und Hinweis', () => {
    const p = createEmptyProject('Gemischt');
    const rack = getDef('atlantis-c513')!;
    p.floors[0].items.push(createItemFromDef(rack, 300, 300, { priceEur: 1000 }));
    p.floors[0].items.push(createItemFromDef(rack, 700, 300, { priceEur: 2000 }));
    const rows = bomRows(p);
    expect(rows.length).toBe(1);
    expect(rows[0].anzahl).toBe(2);
    expect(rows[0].stueckpreis).toBe(1500);
    expect(rows[0].preisGemischt).toBe(true);
    expect(rows[0].summe).toBe(3000);
    expect(rows[0].hinweis).toContain('Mittelwert');
    const cells = bomCsvText(p).split('\r\n')[1].split(';');
    expect(cells[9]).toBe('1500');
    expect(cells[10]).toBe('3000');
  });

  it('unbekannte Bibliotheks-ID bleibt als Position mit gespeicherten Maßen erhalten', () => {
    const p = sampleProject();
    p.floors[0].items[2].defId = 'gibt-es-nicht';
    const row = bomRows(p).find((r) => r.defId === 'gibt-es-nicht')!;
    expect(row).toBeDefined();
    expect(row.anzahl).toBe(1);
    expect(row.breite).toBe(p.floors[0].items[2].width);
    expect(row.stueckpreis).toBeNull();
    expect(row.hinweis).toContain('Nicht in der Bibliothek');
  });

  it('erzeugt CSV mit BOM, Semikolon, Dezimalkomma und Summenzeile', () => {
    const p = sampleProject();
    const text = bomCsvText(p);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(CSV_HEADER.join(';'));
    expect(lines[0].split(';').length).toBe(14);
    const row = lines.find((l) => l.includes(';A301;'))!;
    expect(row).toBeDefined();
    const cells = row.split(';');
    expect(cells[0]).toBe('Atlantis');
    expect(cells[8]).toBe('2');
    expect(cells[9]).toBe('1000');
    expect(cells[10]).toBe('2000');
    expect(cells[12]).toBe('Ja');
    const last = lines[lines.length - 1];
    expect(last.startsWith('Summe;')).toBe(true);
    expect(last.split(';')[8]).toBe('4');
    expect(last.split(';')[10]).toBe('2999');
    expect(last.split(';')[7]).toBe(String(284 * 2 + 524));
    expect(text).toContain('Eigene Theke');
    expect(text.endsWith('\r\n')).toBe(true);
  });

  it('formatiert Zahlen und Zellen für Excel DE', () => {
    expect(csvNumber(12.5)).toBe('12,5');
    expect(csvNumber(1234.567)).toBe('1234,57');
    expect(csvNumber(null)).toBe('');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('sagt "hi"')).toBe('"sagt ""hi"""');
    expect(csvCell('normal')).toBe('normal');
  });

  it('leeres Projekt → nur Kopf- und Summenzeile', () => {
    const p = createEmptyProject('Leer');
    const lines = bomCsvText(p).slice(1).split('\r\n').filter(Boolean);
    expect(lines.length).toBe(2);
    expect(bomRows(p)).toEqual([]);
  });
});

describe('Maßstab & Layout', () => {
  it('paperMmForCm(2500, 100) = 250 und Umkehrung', () => {
    expect(paperMmForCm(2500, 100)).toBe(250);
    expect(paperMmForCm(2500, 50)).toBe(500);
    expect(paperMmForCm(2500, 200)).toBe(125);
    expect(cmForPaperMm(250, 100)).toBe(2500);
    expect(pxPerCmForPaper(100, 254)).toBeCloseTo(1, 10);
  });

  it('begrenzt die Auflösung auf die maximale Kantenlänge', () => {
    const b = { minX: 0, minY: 0, maxX: 10000, maxY: 5000 };
    expect(clampPxPerCm(2, b)).toBe(MAX_IMAGE_PX / 10000);
    expect(clampPxPerCm(0.5, b)).toBe(0.5);
    const p = sampleProject();
    const px = pngPxPerCm(p, p.floors[0], 1000);
    const layout = layoutFloorRender(p, p.floors[0], { pxPerCm: px });
    expect(Math.max(layout.widthPx, layout.heightPx)).toBeLessThanOrEqual(MAX_IMAGE_PX + 1);
    expect(pngPxPerCm(p, p.floors[0], 2)).toBeCloseTo(1.2, 10);
  });

  it('berechnet Inhaltsbereich und Layout inkl. Rand und Legende', () => {
    const p = sampleProject();
    const b = floorContentBounds(p.floors[0], p);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxX).toBe(2500);
    expect(b.maxY).toBe(2000);
    const layout = layoutFloorRender(p, p.floors[0], { pxPerCm: 1, marginCm: 150 });
    expect(layout.planBounds).toEqual({ minX: -150, minY: -150, maxX: 2650, maxY: 2150 });
    expect(layout.widthPx).toBe(2800);
    const roomTypes = floorRooms(p.floors[0]).map((r) => r.type);
    expect(layout.legendTypes).toEqual([...new Set(roomTypes)]);
    expect(layout.legendTypes).toContain('Cardio');
    expect(layout.legendTypes).toContain('Maschinen');
    expect(layout.heightPx).toBeGreaterThan(2300);
    const noLegend = layoutFloorRender(p, p.floors[0], { pxPerCm: 1, marginCm: 150, legend: false });
    expect(noLegend.heightPx).toBe(2300);
    // Leeres Stockwerk ohne Halle
    const empty = createEmptyProject('Leer');
    const eb = floorContentBounds(empty.floors[0], empty);
    expect(eb.maxX - eb.minX).toBeGreaterThan(0);
    expect(layoutFloorRender(empty, empty.floors[0], { pxPerCm: 0.5 }).widthPx).toBeGreaterThan(0);
  });

  it('Hilfsfunktionen: Maßstabsbalken, Legende, Kurzname', () => {
    expect(scaleBarLength(2800)).toBe(500);
    expect(scaleBarLength(400)).toBe(100);
    const p = sampleProject();
    const legend = legendRoomTypes(floorRooms(p.floors[0]));
    expect(legend).toEqual([...new Set(legend)]);
    expect(legend).toContain('Cardio');
    expect(legend).toContain('Maschinen');
    expect(itemShortLabel(p.floors[0].items[0], getDef('atlantis-a301'))).toBe('A301');
    expect(itemShortLabel({ ...p.floors[0].items[0], label: 'Mein Gerät' }, getDef('atlantis-a301'))).toBe('Mein Gerät');
  });

  it('Raumlabels: Auto-Raumlabel weicht überlappendem Zonenlabel nach oben aus, Zonenlabel bleibt mittig', () => {
    const p = sampleProject();
    const f = p.floors[0];
    const rooms = floorRooms(f);
    const boxes = roomLabelBoxes(rooms);
    expect(boxes.length).toBe(rooms.length);
    rooms.forEach((r, i) => {
      const b = boxes[i]!;
      expect(b.lines).toEqual([r.name, formatM2(r.areaM2)]);
      expect(b.x + b.width / 2).toBeCloseTo(r.centroid.x, 6);
      if (r.source === 'zone') expect(b.y + b.height / 2).toBeCloseTo(r.centroid.y, 6);
    });
    // Konstruierter Fall: Zone in der Mitte eines Auto-Raums – gleiche Schwerpunkte
    const auto = { ...rooms[0], id: 'auto', source: 'auto' as const, name: 'Halle', polygon: rectPolygon({ x: 0, y: 0 }, { x: 2000, y: 1600 }), centroid: { x: 1000, y: 800 }, areaM2: 320 };
    const zone = { ...rooms[0], id: 'zone', source: 'zone' as const, name: 'Maschinen', polygon: rectPolygon({ x: 600, y: 500 }, { x: 1400, y: 1100 }), centroid: { x: 1000, y: 800 }, areaM2: 48 };
    const [a, z] = roomLabelBoxes([auto, zone]);
    expect(z!.y + z!.height / 2).toBeCloseTo(800, 6);
    expect(a!.y + a!.height).toBeLessThan(z!.y); // über dem Zonenlabel
    expect(a!.y).toBeGreaterThan(0); // innerhalb des Raums
    expect(a!.x + a!.width / 2).toBeCloseTo(1000, 6);
    // Ohne Überlappung keine Verschiebung; labelMode 'none' → null; Schriftfaktor skaliert die Schrift
    const far = { ...zone, id: 'far', polygon: rectPolygon({ x: 0, y: 1200 }, { x: 600, y: 1600 }), centroid: { x: 300, y: 1400 } };
    expect(roomLabelBoxes([auto, far])[0]!.y + roomLabelBoxes([auto, far])[0]!.height / 2).toBeCloseTo(800, 6);
    expect(roomLabelBoxes([{ ...auto, labelMode: 'none' }, zone])[0]).toBeNull();
    expect(roomLabelBoxes([auto], 0.5)[0]!.fontSize).toBeCloseTo(roomLabelBoxes([auto], 1)[0]!.fontSize / 2, 6);
    // Sehr flacher Raum: Label bleibt an der Oberkante (nicht darüber hinaus)
    const flat = { ...auto, polygon: rectPolygon({ x: 0, y: 760 }, { x: 2000, y: 840 }), centroid: { x: 1000, y: 800 }, areaM2: 16 };
    const [fb] = roomLabelBoxes([flat, zone]);
    expect(fb!.y).toBeGreaterThanOrEqual(760);
  });

  it('Hallen-Zusammenfassung: Maße bei Rechteck, sonst nur Fläche', () => {
    expect(hallSummaryText(rectPolygon({ x: 0, y: 0 }, { x: 2500, y: 1600 }))).toBe('Halle: 25,00 m × 16,00 m · 400,00 m²');
    expect(hallSummaryText([{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 1000, y: 1000 }, { x: 1000, y: 2000 }, { x: 0, y: 2000 }])).toBe('Halle: 300,00 m²');
    expect(hallSummaryText([])).toBe('Halle: 0,00 m²');
  });

  it('wählt das kleinste passende Querformat', () => {
    expect(paperFormatForPlan(100, 80)?.name).toBe('a4');
    expect(paperFormatForPlan(280, 220)?.name).toBe('a3');
    expect(paperFormatForPlan(500, 300)?.name).toBe('a2');
    expect(paperFormatForPlan(700, 500)?.name).toBe('a1');
    expect(paperFormatForPlan(1000, 700)?.name).toBe('a0');
    expect(paperFormatForPlan(2000, 700)).toBeNull();
  });

  it.skipIf(!canvasSupported)('rendert ein Stockwerk in ein Canvas mit erwarteten Maßen', () => {
    const p = sampleProject();
    const r = renderFloorToCanvas(p, p.floors[0], { pxPerCm: 0.25, legend: true });
    expect(r.canvas.width).toBe(r.widthPx);
    expect(r.canvas.height).toBe(r.heightPx);
    expect(r.widthPx).toBe(Math.ceil(2800 * 0.25));
  });

  it('renderFloorToCanvas wirft in einer Umgebung ohne Canvas eine Exception (kein Hängenbleiben)', () => {
    if (canvasSupported) return;
    const p = sampleProject();
    expect(() => renderFloorToCanvas(p, p.floors[0], { pxPerCm: 0.25 })).toThrow();
  });
});

describe('Flächenbilanz (PDF)', () => {
  it('liefert dieselben Werte wie areaBalance(project) aus src/analysis', () => {
    const p = sampleProject();
    const ref = areaBalance(p).floors[0];
    const b = floorAreaBalance(p.floors[0], p);
    expect(b.bruttoM2).toBe(ref.bruttoM2);
    expect(b.nettoM2).toBe(ref.nettoM2);
    expect(b.voidM2).toBe(ref.voidM2);
    expect(b.unassignedM2).toBe(ref.unassignedM2);
    expect(b.byType).toEqual(ref.byType);
    expect(b.byClass).toEqual(ref.byClass);
    // Kompatibilitäts-Aliase
    expect(b.grossM2).toBe(ref.bruttoM2);
    expect(b.netM2).toBe(ref.nettoM2);
    // Ohne Projektbezug: gleiche Regeln, gleiche Zahlen
    const alone = floorAreaBalance(p.floors[0]);
    expect(alone.bruttoM2).toBeCloseTo(ref.bruttoM2, 9);
    expect(alone.nettoM2).toBeCloseTo(ref.nettoM2, 9);
    expect(alone.byType).toEqual(ref.byType);
    // Projektbilanz = total + Stockwerke
    const total = projectAreaBalance(p);
    expect(total.grossM2).toBe(areaBalance(p).total.bruttoM2);
    expect(total.netM2).toBe(areaBalance(p).total.nettoM2);
    expect(total.floors.map((f) => f.floorId)).toEqual([p.floors[0].id]);
    expect(total.byType.map((t) => t.type)).toEqual(b.byType.map((t) => t.type));
  });

  it('berechnet Brutto, Netto, Luftraum, Raumtypen und Prozente (bezogen auf Netto)', () => {
    const p = sampleProject();
    const b = floorAreaBalance(p.floors[0], p);
    expect(b.hasHall).toBe(true);
    expect(b.bruttoM2).toBeCloseTo(500, 6);
    expect(b.voidM2).toBeCloseTo(25, 6);
    expect(b.nettoM2).toBeCloseTo(24.52 * 19.52 - 25, 6);
    const cardio = b.byType.find((t) => t.type === 'Cardio')!;
    expect(cardio.count).toBe(1);
    expect(cardio.m2).toBeCloseTo(100, 6);
    expect(cardio.percent).toBeCloseTo((100 / b.nettoM2) * 100, 6);
    const training = b.byClass.find((c) => c.areaClass === 'Trainingsfläche')!;
    expect(training.m2).toBeCloseTo(220, 6);
    // Die Halle selbst ist ein Auto-Raum ohne gewählten Typ → Rest zählt als „nicht zugeordnet“
    const typed = b.byType.reduce((s, t) => s + t.m2, 0);
    expect(b.untypedRoomCount).toBe(1);
    expect(b.roomCount).toBe(3);
    expect(b.unassignedM2).toBeCloseTo(b.nettoM2 - typed, 6);
    expect(b.unassignedPercent + b.byType.reduce((s, t) => s + t.percent, 0)).toBeCloseTo(100, 6);
  });

  it('buildPdf erzeugt Flächenbilanz- und Stücklistenseiten (ohne Planseite, da kein Canvas nötig)', async () => {
    const p = sampleProject();
    const { doc, warnings } = await buildPdf(p, { floorIds: ['nicht-vorhanden'], scale: 100 });
    expect(warnings).toEqual([]);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    const out = doc.output('arraybuffer');
    expect(out.byteLength).toBeGreaterThan(2000);
    const empty = await buildPdf(createEmptyProject('Leer'), { floorIds: ['x'] });
    expect(empty.doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    // Mehrere Stockwerke → zusätzlicher Gesamtabschnitt, ebenfalls ohne Planseiten
    const multi = sampleProject();
    multi.floors.push(createFloor({ name: 'OG', order: 1, hall: createHall(1000, 1000) }));
    const m = await buildPdf(multi, { floorIds: ['nicht-vorhanden'] });
    expect(m.doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });

  it('kommt mit Stockwerken ohne Halle zurecht', () => {
    const p = createEmptyProject('Ohne Halle');
    p.floors[0].zones.push(createZone({ polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }], name: 'Z', type: 'Kursraum' }));
    const b = floorAreaBalance(p.floors[0], p);
    expect(b.hasHall).toBe(false);
    expect(b.bruttoM2).toBe(0);
    expect(b.nettoM2).toBeCloseTo(100, 6);
    expect(b.byType[0].percent).toBeCloseTo(100, 6);
    expect(b.unassignedM2).toBe(0);
    const empty = floorAreaBalance(createEmptyProject('x').floors[0]);
    expect(empty.byType).toEqual([]);
    expect(empty.nettoM2).toBe(0);
    expect(empty.unassignedM2).toBe(0);
  });

  it('Gesamtbilanz über mehrere Stockwerke entspricht areaBalance(project).total', () => {
    const p = sampleProject();
    const og = createFloor({ name: 'OG', order: 1, hall: createHall(1000, 1000) });
    og.zones.push(createZone({ polygon: [{ x: 100, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 600 }, { x: 100, y: 600 }], name: 'Ruhe', type: 'Ruheraum' }));
    p.floors.push(og);
    const total = projectAreaBalance(p);
    const ref = areaBalance(p);
    expect(total.floors.length).toBe(2);
    expect(total.floors[1].floorName).toBe('OG');
    expect(total.bruttoM2).toBeCloseTo(600, 6);
    expect(total.grossM2).toBe(ref.total.bruttoM2);
    expect(total.netM2).toBe(ref.total.nettoM2);
    expect(total.byType).toEqual(ref.total.byType);
    expect(total.byClass).toEqual(ref.total.byClass);
    expect(total.unassignedM2).toBe(ref.total.unassignedM2);
  });
});

describe('Review-Befunde Export', () => {
  it('L2: CSV-Zellen mit Formelzeichen am Anfang werden entschärft, Zahlen nicht', () => {
    expect(csvCell('=SUM(A1:A3)')).toBe("'=SUM(A1:A3)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-x')).toBe("'-x");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('=1;2')).toBe('"\'=1;2"');
    expect(csvCell('Normal')).toBe('Normal');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(-5.5)).toBe('-5,5');
    const p = sampleProject();
    p.customEquipment[0].name = '=HYPERLINK("x")';
    const text = bomCsvText(p);
    expect(text).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(text).not.toMatch(/;=HYPERLINK/);
  });

  it('L8: Importdateien über 50 MB werden abgelehnt', () => {
    expect(MAX_IMPORT_BYTES).toBe(50 * 1024 * 1024);
    expect(importSizeError({ name: 'a.json', size: 10 })).toBeNull();
    expect(importSizeError({ name: 'a.json', size: MAX_IMPORT_BYTES })).toBeNull();
    const msg = importSizeError({ name: 'gross.json', size: MAX_IMPORT_BYTES + 1 });
    expect(msg).toContain('gross.json');
    expect(msg).toContain('zu groß');
    expect(msg).toContain('50 MB');
  });
});
