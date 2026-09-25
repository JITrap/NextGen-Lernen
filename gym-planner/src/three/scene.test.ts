import { describe, it, expect } from 'vitest';
import type { Door, EquipmentDef, Floor, Hall, LibraryArea, Mirror, PlacedItem, Wall, Window } from '@/types';
import { wallSegments, wallHeightOf } from './wallSegments';
import { toScene, rotationY, floorLevels, cm, SLAB_M, ceilingCmOf } from './coords';
import { AREA_COLORS, areaColor, floorCoveringColor, wallAppearance, FALLBACK_ITEM_COLOR, FALLBACK_FLOOR_COLOR } from './colors';
import { floorWallPieces, hallWallCorners, segmentPolygon, fallbackCorners } from './walls3d';
import { itemHeightCm, stairsTypeOf, stepCount, columnIsRound, verticalSpan, itemLabel, isLinkedCopy } from './items3d';
import { hallWalls, hallOuterPolygon, hallInnerPolygon } from '@/geometry/walls';

const wall: Wall = { id: 'w1', start: { x: 0, y: 0 }, end: { x: 500, y: 0 }, thickness: 12.5, type: 'Trockenbau', height: null };

const door = (offset = 250, width = 90, height = 210): Door => ({
  id: 'd1', kind: 'door', wallId: 'w1', offset, width, height, doorType: 'einflügelig', hinge: 'left', swingSide: 'a',
});
const window = (offset = 250, width = 120, sillHeight = 90, height = 120): Window => ({
  id: 'f1', kind: 'window', wallId: 'w1', offset, width, height, sillHeight,
});
const mirror: Mirror = { id: 'm1', kind: 'mirror', wallId: 'w1', offset: 100, width: 200, height: 200, side: 'a' };

const floorBase = (partial: Partial<Floor> = {}): Floor => ({
  id: 'f_eg', name: 'EG', order: 0, ceilingHeight: 300, hall: null, walls: [], zones: [], roomMeta: {}, openings: [], items: [], groups: [], voids: [], annotations: [], ...partial,
});

describe('wallSegments', () => {
  it('Tür (90 × 210) bei Offset 250 in 500er-Wand, Decke 300 → 3 Segmente', () => {
    const segs = wallSegments(wall, [door()], 300);
    expect(segs).toEqual([
      { start: 0, end: 205, bottom: 0, top: 300 },
      { start: 205, end: 295, bottom: 210, top: 300 },
      { start: 295, end: 500, bottom: 0, top: 300 },
    ]);
  });
  it('Fenster (120 breit, Brüstung 90, Höhe 120) → 4 Segmente', () => {
    const segs = wallSegments(wall, [window()], 300);
    expect(segs).toHaveLength(4);
    expect(segs).toEqual([
      { start: 0, end: 190, bottom: 0, top: 300 },
      { start: 190, end: 310, bottom: 0, top: 90 },
      { start: 190, end: 310, bottom: 210, top: 300 },
      { start: 310, end: 500, bottom: 0, top: 300 },
    ]);
  });
  it('ohne Öffnungen → ein volles Segment; Spiegel erzeugen keine Aussparung', () => {
    expect(wallSegments(wall, [], 300)).toEqual([{ start: 0, end: 500, bottom: 0, top: 300 }]);
    expect(wallSegments(wall, [mirror], 300)).toEqual([{ start: 0, end: 500, bottom: 0, top: 300 }]);
  });
  it('Wandhöhe überschreibt Deckenhöhe, raumhohe Tür ohne Sturz', () => {
    const low: Wall = { ...wall, height: 110 };
    expect(wallSegments(low, [], 300)).toEqual([{ start: 0, end: 500, bottom: 0, top: 110 }]);
    expect(wallHeightOf(low, 300)).toBe(110);
    expect(wallHeightOf(wall, 300)).toBe(300);
    const tall = wallSegments(wall, [door(250, 90, 300)], 300);
    expect(tall).toEqual([
      { start: 0, end: 205, bottom: 0, top: 300 },
      { start: 295, end: 500, bottom: 0, top: 300 },
    ]);
  });
  it('Öffnungen am Wandende und überlappende Öffnungen werden begrenzt', () => {
    const edge = wallSegments(wall, [door(45, 90, 210)], 300);
    expect(edge[0]).toEqual({ start: 0, end: 90, bottom: 210, top: 300 });
    expect(edge[1]).toEqual({ start: 90, end: 500, bottom: 0, top: 300 });
    const over = wallSegments(wall, [door(100, 90), { ...door(160, 90), id: 'd2' }], 300);
    // 55–145 und 115–205 → zusammenhängend ab 55 bis 205
    expect(over.map((s) => [s.start, s.end])).toEqual([[0, 55], [55, 145], [145, 205], [205, 500]]);
    expect(over.every((s) => s.end > s.start && s.top > s.bottom)).toBe(true);
  });
  it('degenerierte Wand → keine Segmente', () => {
    expect(wallSegments({ ...wall, end: { x: 0, y: 0 } }, [], 300)).toEqual([]);
  });
});

describe('Koordinaten', () => {
  it('Weltpunkt (cm, y nach unten) → three-Vektor (m, y nach oben)', () => {
    expect(toScene({ x: 250, y: 100 })).toEqual([2.5, 0, 1]);
    expect(toScene({ x: -50, y: 30 }, 120)).toEqual([-0.5, 1.2, 0.3]);
    expect(cm(350)).toBeCloseTo(3.5);
  });
  it('Plan-Drehung im Uhrzeigersinn → negative Rotation um y', () => {
    expect(rotationY(90)).toBeCloseTo(-Math.PI / 2);
    expect(rotationY(0)).toBe(-0);
  });
  it('Stockwerks-Versatz = Summe der Deckenhöhen + 0,3 m Decke', () => {
    const eg = floorBase({ id: 'eg', order: 0, ceilingHeight: 350 });
    const og = floorBase({ id: 'og', order: 1, ceilingHeight: 280 });
    const ug = floorBase({ id: 'ug', order: -1, ceilingHeight: 250 });
    const levels = floorLevels([og, eg, ug]);
    expect(levels.map((l) => l.floor.id)).toEqual(['ug', 'eg', 'og']);
    expect(levels[0].level).toBe(0);
    expect(levels[1].level).toBeCloseTo(2.5 + SLAB_M);
    expect(levels[2].level).toBeCloseTo(2.5 + SLAB_M + 3.5 + SLAB_M);
    expect(levels[2].top).toBeCloseTo(levels[2].level + 2.8);
    expect(ceilingCmOf({ ceilingHeight: 0 })).toBe(300);
  });
});

describe('Farben', () => {
  it('jeder Bibliotheks-Bereich hat eine Farbe', () => {
    const areas: LibraryArea[] = [
      'Kraftgeräte', 'Freihantel-Zubehör', 'Cardio', 'Functional', 'Empfang & Lounge', 'Umkleide', 'Sanitär', 'Wellness',
      'Kursraum', 'Büro & Personal', 'Lager & Technik', 'Ausstattung', 'Bauelemente', 'Eigene',
    ];
    for (const a of areas) {
      expect(AREA_COLORS[a]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(areaColor(a)).toBe(AREA_COLORS[a]);
    }
    expect(areaColor('Cardio')).toBe('#ef4444');
    expect(areaColor(undefined)).toBe(FALLBACK_ITEM_COLOR);
    expect(areaColor('Unbekannt')).toBe(FALLBACK_ITEM_COLOR);
  });
  it('Bodenbelag und Wandtypen', () => {
    expect(floorCoveringColor('Kunstrasen')).toBe('#4d9a3a');
    expect(floorCoveringColor('Irgendwas')).toBe(FALLBACK_FLOOR_COLOR);
    expect(wallAppearance('Glaswand', false)).toEqual({ color: '#7dd3fc', opacity: 0.35 });
    expect(wallAppearance('Trockenbau', true).opacity).toBe(1);
  });
});

describe('Wandsegmente im Grundriss', () => {
  const hall: Hall = { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 600 }, { x: 0, y: 600 }], wallThickness: 24, floorCovering: 'Gummiboden' };

  it('Außenwände werden an den Ecken auf Gehrung geschnitten (Außen-/Innenpolygon)', () => {
    const corners = hallWallCorners(hall);
    const walls = hallWalls(hall);
    expect(corners.size).toBe(4);
    const outer = hallOuterPolygon(hall);
    const inner = hallInnerPolygon(hall);
    const c0 = corners.get(walls[0].id)!;
    expect(c0[0].x).toBeCloseTo(outer[0].x);
    expect(c0[0].y).toBeCloseTo(outer[0].y);
    expect(c0[1].x).toBeCloseTo(outer[1].x);
    expect(c0[3].x).toBeCloseTo(inner[0].x);
    expect(c0[3].y).toBeCloseTo(inner[0].y);
  });
  it('floorWallPieces: Halle + Innenwand mit Tür → Segmente mit Vierecken', () => {
    const inner: Wall = { id: 'w_in', start: { x: 500, y: 24 }, end: { x: 500, y: 576 }, thickness: 12.5, type: 'Trockenbau', height: null };
    const floor = floorBase({ hall, walls: [inner], openings: [{ ...door(300, 90, 210), wallId: 'w_in' }] });
    const pieces = floorWallPieces(floor, 300);
    // 4 Außenwände + 3 Segmente der Innenwand
    expect(pieces).toHaveLength(7);
    for (const p of pieces) {
      expect(p.polygon).toHaveLength(4);
      expect(p.segment.top).toBeGreaterThan(p.segment.bottom);
    }
    const lintel = pieces.find((p) => p.wall.id === 'w_in' && p.segment.bottom === 210)!;
    expect(lintel.segment).toEqual({ start: 255, end: 345, bottom: 210, top: 300 });
    // Sturz-Viereck liegt zwischen y = 24+255 und 24+345, Stärke 12,5
    const ys = lintel.polygon.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(279);
    expect(Math.max(...ys)).toBeCloseTo(369);
    const xs = lintel.polygon.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(12.5);
  });
  it('ausgeblendete Wände und Öffnungen werden ignoriert', () => {
    const hidden: Wall = { ...wall, id: 'w_h', hidden: true };
    const floor = floorBase({ walls: [wall, hidden], openings: [{ ...door(), hidden: true }] });
    const pieces = floorWallPieces(floor, 300);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].wall.id).toBe('w1');
  });
  it('segmentPolygon nutzt die Ecken nur an den Wandenden', () => {
    const corners = fallbackCorners(wall, 10);
    const mid = segmentPolygon(wall, { start: 100, end: 200, bottom: 0, top: 300 }, corners);
    expect(mid[0]).toEqual({ x: 100, y: -6.25 });
    expect(mid[1]).toEqual({ x: 200, y: -6.25 });
    const first = segmentPolygon(wall, { start: 0, end: 200, bottom: 0, top: 300 }, corners);
    expect(first[0].x).toBeCloseTo(-10);
  });
});

describe('Objekte', () => {
  const def = (partial: Partial<EquipmentDef>): EquipmentDef => ({
    id: 'x', kategorie: 'Cardio', unterkategorie: '', hersteller: 'Generisch', name: 'Laufband', breite_cm: 90, tiefe_cm: 210, hoehe_cm: 160,
    sicherheitszone_cm: { vorne: 0, hinten: 200, links: 0, rechts: 0 }, form: 'rechteck', skalierbar: false, verifiziert: false, bereich: 'Cardio', symbol: 'treadmill', ...partial,
  });
  const item = (partial: Partial<PlacedItem>): PlacedItem => ({
    id: 'i1', kind: 'equipment', defId: 'x', x: 0, y: 0, rotation: 0, width: 90, depth: 210, height: null,
    safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: true, ...partial,
  });

  it('Höhe: item.height ?? def.hoehe_cm ?? 100, Plattformen 5 cm, Säulen bis zur Decke', () => {
    expect(itemHeightCm(item({}), def({}), 300)).toBe(160);
    expect(itemHeightCm(item({ height: 120 }), def({}), 300)).toBe(120);
    expect(itemHeightCm(item({}), def({ hoehe_cm: null }), 300)).toBe(100);
    expect(itemHeightCm(item({}), def({ hoehe_cm: null, symbol: 'platform' }), 300)).toBe(5);
    expect(itemHeightCm(item({ kind: 'column' }), undefined, 320)).toBe(320);
    expect(itemHeightCm(item({}), undefined, 300)).toBe(100);
  });
  it('Treppentyp, Stufen und Säulenform aus params/Symbol', () => {
    expect(stairsTypeOf(item({ params: { typ: 'Wendeltreppe' } }), undefined)).toBe('Wendeltreppe');
    expect(stairsTypeOf(item({ params: { typ: 'L' } }), undefined)).toBe('L');
    expect(stairsTypeOf(item({}), def({ symbol: 'stairs-u' }))).toBe('U');
    expect(stairsTypeOf(item({}), undefined)).toBe('gerade');
    expect(stepCount(item({ params: { stufen: 14 } }), undefined, 280)).toBe(14);
    expect(stepCount(item({}), undefined, 280)).toBe(10);
    expect(stepCount(item({}), undefined, 10)).toBe(3);
    expect(columnIsRound(item({ params: { form: 'rund' } }), undefined)).toBe(true);
    expect(columnIsRound(item({ params: { form: 'eckig' } }), def({ symbol: 'column-round' }))).toBe(false);
    expect(columnIsRound(item({}), def({ symbol: 'column-round' }))).toBe(true);
  });
  it('vertikale Ausdehnung von Treppen und Aufzügen über verlinkte Stockwerke', () => {
    const eg = floorBase({ id: 'eg', order: 0, ceilingHeight: 300 });
    const og1 = floorBase({ id: 'og1', order: 1, ceilingHeight: 300 });
    const og2 = floorBase({ id: 'og2', order: 2, ceilingHeight: 280 });
    const levels = floorLevels([eg, og1, og2]);
    const stairs = verticalSpan(item({ kind: 'stairs', linkedFloorIds: ['og1'] }), eg, levels);
    expect(stairs.bottom).toBe(0);
    expect(stairs.top).toBeCloseTo(3.3);
    const lift = verticalSpan(item({ kind: 'elevator', linkedFloorIds: ['og1', 'og2'] }), eg, levels);
    expect(lift.bottom).toBe(0);
    expect(lift.top).toBeCloseTo(3.3 + 3.3 + 2.8);
    expect(lift.floors.map((l) => l.floor.id)).toEqual(['eg', 'og1', 'og2']);
    // Einzelansicht: nur das eigene Stockwerk → Treppe bis Decke + Deckenstärke
    const single = verticalSpan(item({ kind: 'stairs', linkedFloorIds: ['og1'] }), eg, floorLevels([eg]));
    expect(single.top).toBeCloseTo(3.3);
  });
  it('Beschriftung und verlinkte Kopien', () => {
    expect(itemLabel(item({}), def({}))).toBe('Laufband');
    expect(itemLabel(item({ label: 'Mein Band' }), def({}))).toBe('Mein Band');
    expect(itemLabel(item({ params: { faecher: 12 } }), def({ name: 'Spindreihe' }))).toBe('Spindreihe · 12 Fächer');
    expect(isLinkedCopy(item({ params: { __linkedFrom: 'eg' } }))).toBe(true);
    expect(isLinkedCopy(item({}))).toBe(false);
  });
});
