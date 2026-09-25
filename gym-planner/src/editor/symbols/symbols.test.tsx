/**
 * Tests für das Symbolsystem, die Objekt-Ebene und die Platzier-Werkzeuge.
 *
 * react-konva unter jsdom: jsdom hat keinen 2D-Canvas-Kontext. Wir stubben HTMLCanvasElement.getContext mit einem
 * Proxy (alle Zeichenmethoden no-op, measureText liefert eine Breite). Damit baut Konva den Szenengraphen
 * vollständig auf (Nodes, Attribute, Text-Layout), nur die Pixel bleiben leer. Was hier NICHT geprüft wird:
 * das tatsächliche Aussehen der Silhouetten.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { createRef, type ReactElement } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import Konva from 'konva';
import { Stage, Layer, Group } from 'react-konva';
import type { EquipmentDef, PlacedItem, SymbolKind, Project, Floor } from '@/types';
import { createEmptyProject, createFloor, createItemFromDef } from '@/store/factories';
import { useProjectStore, loadProject, undo, redo } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { getDef, GENERIC_LIBRARY } from '@/data/equipment';
import { getTool } from '../tools/registry';
import type { ToolContext, ToolEvent } from '../tools/types';
import { useSnapGuides } from '../overlays/SnapGuides';
import {
  ItemSymbol, symbolFor, ALL_SYMBOL_KINDS, SYMBOL_COLORS, SYMBOL_COLORS_DARK, areaColors, effectiveSymbolKind,
  isRoundSymbol, resolveSymbolStyle, mix, withAlpha, lockerCount, defaultStepCount, LOD_MIN_PX,
} from './index';
import { ItemsLayer, itemShortLabel, itemLabelText, scaleBucket, hasDealerHint, FURNITURE_AREAS } from '../layers/ItemsLayer';
import {
  resolvePlaceDef, buildPlacedItem, makeFallbackDef, readPlaceOptions, floorAbove, placeAt, usePlaceState, fallbackDefId, PLACE_DIMENSIONS,
} from '../tools/placeTools';

/* ------------------------------------------------------------------ */
/* jsdom-Vorbereitung                                                  */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  const noop = () => {};
  const makeCtx = (canvas: HTMLCanvasElement) => {
    const base: Record<string, unknown> = {
      canvas,
      measureText: (t: string) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createPattern: () => ({}),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    };
    return new Proxy(base, {
      get: (t, k) => (k in t ? t[k as string] : noop),
      set: (t, k, v) => { t[k as string] = v; return true; },
    });
  };
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement) { return makeCtx(this); };
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({ matches: false, media: query, onchange: null, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, dispatchEvent: () => false }),
    });
  }
});

afterEach(() => cleanup());

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

/** Alle SymbolKind-Werte aus src/types/model.ts (hart hinterlegt, damit Abweichungen auffallen). */
const KINDS: SymbolKind[] = [
  'machine', 'bench', 'rack', 'half-rack', 'smith', 'platform', 'dumbbell-rack',
  'plate-rack', 'cable', 'leg-press', 'hack-squat', 'lat-pulldown', 'chest-press',
  'row', 'curl', 'calf', 'dip', 'sled', 'treadmill', 'curved-treadmill', 'elliptical',
  'bike', 'recumbent-bike', 'spin-bike', 'air-bike', 'rower', 'stairmaster', 'skierg',
  'turf', 'kettlebell-rack', 'plyo-box', 'mat', 'ball-rack', 'rope-anchor', 'rig',
  'wall-bars', 'punching-bag', 'counter', 'turnstile', 'fridge', 'vending', 'sofa',
  'table', 'chair', 'wardrobe', 'screen', 'locker', 'locker-row', 'bench-seat',
  'mirror', 'hairdryer', 'sink', 'cabin', 'shower', 'shower-row', 'partition',
  'toilet', 'urinal', 'changing-table', 'dispenser', 'laundry', 'valuables', 'sauna',
  'infrared', 'steam', 'plunge', 'ice-fountain', 'kneipp', 'shower-experience',
  'lounger', 'waterbed', 'solarium', 'red-light', 'massage-chair', 'massage-table',
  'whirlpool', 'tea-station', 'step', 'mat-rack', 'podium', 'audio', 'desk',
  'office-chair', 'filing-cabinet', 'meeting-table', 'shelf', 'hvac', 'washer',
  'cleaning-cart', 'switchboard', 'plant', 'speaker', 'tv', 'water-dispenser',
  'sanitizer', 'trash', 'extinguisher', 'first-aid', 'aed', 'exit-sign', 'camera',
  'column-round', 'column-square', 'radiator', 'vent', 'stairs-straight', 'stairs-l',
  'stairs-u', 'stairs-spiral', 'elevator', 'ramp', 'barbell-rack', 'plate-tree',
  'dumbbells', 'barbell', 'generic',
];

function makeDef(partial: Partial<EquipmentDef> & { id: string; symbol: SymbolKind }): EquipmentDef {
  return {
    kategorie: 'Test', unterkategorie: 'Test', hersteller: 'Generisch', name: partial.id,
    breite_cm: 100, tiefe_cm: 150, hoehe_cm: 120, sicherheitszone_cm: { vorne: 60, hinten: 60, links: 60, rechts: 60 },
    form: 'rechteck', skalierbar: false, verifiziert: true, bereich: 'Kraftgeräte',
    ...partial,
  };
}

function makeItem(def: EquipmentDef, partial: Partial<PlacedItem> = {}): PlacedItem {
  return createItemFromDef(def, 300, 300, partial);
}

/** Rendert Konva-Inhalt in eine Stage und liefert die Stage-Instanz. */
function renderStage(children: ReactElement) {
  const ref = createRef<Konva.Stage>();
  const utils = render(<Stage ref={ref} width={800} height={600}><Layer>{children}</Layer></Stage>);
  return { stage: ref.current!, ...utils };
}

function shapeCount(stage: Konva.Stage): number {
  return stage.find((n: Konva.Node) => n instanceof Konva.Shape).length;
}

/* ------------------------------------------------------------------ */
/* Registry & Farben                                                   */
/* ------------------------------------------------------------------ */

describe('Symbol-Registry', () => {
  it('kennt jeden SymbolKind aus model.ts und liefert Funktionen', () => {
    expect(new Set(ALL_SYMBOL_KINDS)).toEqual(new Set(KINDS));
    expect(ALL_SYMBOL_KINDS.length).toBe(KINDS.length);
    for (const k of KINDS) expect(typeof symbolFor(k), k).toBe('function');
  });
  it('fällt bei unbekannten Werten auf „generic“ zurück', () => {
    expect(symbolFor('gibt-es-nicht' as SymbolKind)).toBe(symbolFor('generic'));
  });
  it('hat Farben für jeden Bereich in Hell und Dunkel', () => {
    const areas = ['Kraftgeräte', 'Freihantel-Zubehör', 'Cardio', 'Functional', 'Empfang & Lounge', 'Umkleide', 'Sanitär', 'Wellness', 'Kursraum', 'Büro & Personal', 'Lager & Technik', 'Ausstattung', 'Bauelemente', 'Eigene'] as const;
    for (const a of areas) {
      expect(SYMBOL_COLORS[a].fill).toMatch(/^#[0-9a-f]{6}$/i);
      expect(SYMBOL_COLORS[a].stroke).toMatch(/^#[0-9a-f]{6}$/i);
      expect(SYMBOL_COLORS_DARK[a].fill).toMatch(/^#[0-9a-f]{6}$/i);
      expect(areaColors(a, true)).toBe(SYMBOL_COLORS_DARK[a]);
    }
    expect(areaColors(undefined, false)).toBe(SYMBOL_COLORS['Eigene']);
  });
  it('Farbhelfer: mix und withAlpha', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mix('ungültig', '#0000ff', 0.5)).toBe('ungültig');
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
  });
  it('Zustandsfarben: Kollision rot, Auswahl blau, Sperre entsättigt', () => {
    const def = makeDef({ id: 'd', symbol: 'machine' });
    const base = resolveSymbolStyle('machine', {}, def, 1, false, false, false, false);
    const col = resolveSymbolStyle('machine', {}, def, 1, false, false, true, false);
    const sel = resolveSymbolStyle('machine', {}, def, 1, false, true, false, false);
    const locked = resolveSymbolStyle('machine', { locked: true }, def, 1, false, false, false, false);
    expect(col.stroke).toBe('#dc2626');
    expect(col.fill).not.toBe(base.fill);
    expect(sel.stroke).toBe('#2563eb');
    expect(sel.sw).toBeGreaterThan(base.sw);
    expect(locked.fill).not.toBe(base.fill);
    expect(resolveSymbolStyle('machine', {}, def, 0.5, false, false, false, false).sw).toBeCloseTo(base.sw * 2);
  });
});

describe('effectiveSymbolKind', () => {
  it('Treppen folgen params.typ, Säulen params.form', () => {
    const stairs = makeDef({ id: 's', symbol: 'stairs-straight', bereich: 'Bauelemente' });
    expect(effectiveSymbolKind({ kind: 'stairs', params: { typ: 'L' } }, stairs)).toBe('stairs-l');
    expect(effectiveSymbolKind({ kind: 'stairs', params: { typ: 'U' } }, stairs)).toBe('stairs-u');
    expect(effectiveSymbolKind({ kind: 'stairs', params: { typ: 'Wendeltreppe' } }, stairs)).toBe('stairs-spiral');
    expect(effectiveSymbolKind({ kind: 'stairs', params: { typ: 'gerade' } }, makeDef({ id: 'x', symbol: 'stairs-u' }))).toBe('stairs-straight');
    expect(effectiveSymbolKind({ kind: 'stairs' }, undefined)).toBe('stairs-straight');
    const col = makeDef({ id: 'c', symbol: 'column-square', bereich: 'Bauelemente' });
    expect(effectiveSymbolKind({ kind: 'column', params: { form: 'rund' } }, col)).toBe('column-round');
    expect(effectiveSymbolKind({ kind: 'column', params: { rund: false } }, makeDef({ id: 'c2', symbol: 'column-round' }))).toBe('column-square');
    expect(effectiveSymbolKind({ kind: 'column' }, undefined)).toBe('column-square');
    expect(effectiveSymbolKind({ kind: 'elevator' }, undefined)).toBe('elevator');
    expect(effectiveSymbolKind({ kind: 'equipment' }, undefined)).toBe('generic');
    expect(effectiveSymbolKind({ kind: 'equipment' }, makeDef({ id: 'u', symbol: 'unbekannt' as SymbolKind }))).toBe('generic');
  });
  it('rund: Säule rund, Wendeltreppe und form „kreis“', () => {
    expect(isRoundSymbol({ kind: 'column', params: { form: 'rund' } }, undefined)).toBe(true);
    expect(isRoundSymbol({ kind: 'stairs', params: { typ: 'Wendeltreppe' } }, undefined)).toBe(true);
    expect(isRoundSymbol({ kind: 'equipment' }, makeDef({ id: 't', symbol: 'table', form: 'kreis' }))).toBe(true);
    expect(isRoundSymbol({ kind: 'equipment' }, makeDef({ id: 't', symbol: 'table' }))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Rendern jedes Symbols                                               */
/* ------------------------------------------------------------------ */

describe('ItemSymbol rendert jeden SymbolKind', () => {
  const sizes: [number, number][] = [[100, 150], [30, 30], [246, 81], [800, 50]];
  for (const kind of KINDS) {
    it(`${kind}: rendert ohne Exception, ≤ 8 Nodes`, () => {
      for (const [w, d] of sizes) {
        const def = makeDef({ id: `def-${kind}`, symbol: kind, breite_cm: w, tiefe_cm: d, form: kind === 'column-round' || kind === 'stairs-spiral' ? 'kreis' : 'rechteck' });
        const item = makeItem(def, { rotation: 37, params: kind === 'locker-row' ? { faecher: 12 } : undefined });
        const { stage, unmount } = renderStage(
          <Group x={item.x} y={item.y} rotation={item.rotation}>
            <ItemSymbol item={item} def={def} scale={1} dark={false} selected={false} colliding={false} hovered={false} />
          </Group>,
        );
        const n = shapeCount(stage);
        expect(n, `${kind} ${w}×${d}`).toBeGreaterThan(0);
        expect(n, `${kind} ${w}×${d} hat ${n} Nodes`).toBeLessThanOrEqual(8);
        unmount();
      }
    });
  }
  it('Zustände (dunkel, gewählt, kollidierend, hover, gesperrt) rendern für alle Symbole', () => {
    for (const kind of KINDS) {
      const def = makeDef({ id: `d-${kind}`, symbol: kind });
      const item = makeItem(def, { locked: true });
      const { stage, unmount } = renderStage(
        <Group>
          <ItemSymbol item={item} def={def} scale={0.25} dark selected colliding hovered />
        </Group>,
      );
      expect(shapeCount(stage)).toBeGreaterThan(0);
      unmount();
    }
  });
  it('sehr kleine Objekte auf dem Bildschirm werden nur als Grundfläche gezeichnet (LOD)', () => {
    const def = makeDef({ id: 'lod', symbol: 'treadmill', breite_cm: 90, tiefe_cm: 210 });
    const item = makeItem(def);
    const scale = (LOD_MIN_PX - 1) / 210;
    const { stage } = renderStage(<Group><ItemSymbol item={item} def={def} scale={scale} dark={false} selected={false} colliding={false} hovered={false} /></Group>);
    expect(shapeCount(stage)).toBe(1);
  });
  it('form „kreis“ ohne eigenes rundes Symbol → Kreisfläche mit Durchmesser = Breite', () => {
    const def = makeDef({ id: 'k', symbol: 'machine', form: 'kreis', breite_cm: 80, tiefe_cm: 80 });
    const item = makeItem(def);
    const { stage } = renderStage(<Group><ItemSymbol item={item} def={def} scale={1} dark={false} selected={false} colliding={false} hovered={false} /></Group>);
    const circles = stage.find('Circle');
    expect(circles.length).toBeGreaterThan(0);
    expect((circles[0] as Konva.Circle).radius()).toBe(40);
  });
  it('polygon-Grundfläche wird als geschlossene Linie gezeichnet', () => {
    const def = makeDef({ id: 'p', symbol: 'machine', form: 'polygon', polygon: [[0, 0], [1, 0], [1, 1], [0.5, 1], [0, 0.5]] });
    const item = makeItem(def);
    const { stage } = renderStage(<Group><ItemSymbol item={item} def={def} scale={1} dark={false} selected={false} colliding={false} hovered={false} /></Group>);
    expect(stage.find('Line').length).toBe(1);
    expect((stage.find('Line')[0] as Konva.Line).closed()).toBe(true);
  });
  it('Spindreihe: Fächerzahl aus params.faecher, sonst Breite / 40', () => {
    const def = makeDef({ id: 'lr', symbol: 'locker-row', breite_cm: 400, tiefe_cm: 50 });
    expect(lockerCount(makeItem(def), def)).toBe(10);
    expect(lockerCount(makeItem(def, { params: { faecher: 12 } }), def)).toBe(12);
    expect(lockerCount({ width: 30 }, undefined)).toBe(1);
  });
  it('Treppen-Stufenzahl aus Maßen: gerade 360 cm → 13 Stufen', () => {
    expect(defaultStepCount('gerade', 100, 360)).toBe(13);
    expect(defaultStepCount('L', 240, 240)).toBeGreaterThanOrEqual(8);
    expect(defaultStepCount('U', 240, 300)).toBeGreaterThanOrEqual(10);
    expect(defaultStepCount('Wendeltreppe', 200, 200)).toBeGreaterThanOrEqual(3);
    expect(defaultStepCount('gerade', 100, 1)).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/* ItemsLayer                                                          */
/* ------------------------------------------------------------------ */

function layerProps(project: Project, floor: Floor, items: PlacedItem[], over: Partial<Parameters<typeof ItemsLayer>[0]> = {}) {
  return {
    project, floor, walls: [], rooms: [], items,
    viewport: { scale: 0.5, x: 0, y: 0 }, selection: [], hoverId: null, dark: false,
    lowerFloor: null, collidingIds: new Set<string>(), presentation: false,
    ...over,
  };
}

describe('ItemsLayer', () => {
  it('Beschriftung: label ?? modell ?? name, max. 18 Zeichen; Spindreihe mit Fächern; verlinkt „von …“', () => {
    const def = makeDef({ id: 'd', symbol: 'machine', modell: 'C513', name: 'Power Rack' });
    expect(itemShortLabel({ label: undefined, defId: 'd' }, def)).toBe('C513');
    expect(itemShortLabel({ label: 'Mein Rack', defId: 'd' }, def)).toBe('Mein Rack');
    expect(itemShortLabel({ label: undefined, defId: 'd' }, makeDef({ id: 'x', symbol: 'machine', name: 'Ein sehr sehr langer Gerätename' }))).toBe('Ein sehr sehr lan…');
    expect(itemShortLabel({ label: undefined, defId: 'd' }, makeDef({ id: 'x', symbol: 'machine', name: 'Genau achtzehn Zei' }))).toBe('Genau achtzehn Zei');
    const lr = makeDef({ id: 'lr', symbol: 'locker-row', name: 'Spindreihe', breite_cm: 480, tiefe_cm: 50 });
    expect(itemLabelText({ label: undefined, defId: 'lr', params: { faecher: 12 }, width: 480 }, lr, null)).toBe('Spindreihe\n12 Fächer');
    expect(itemLabelText({ label: undefined, defId: 'lr', params: undefined, width: 480 }, lr, 'OG 1')).toBe('Spindreihe\n12 Fächer\nvon OG 1');
    expect(scaleBucket(0.123456)).toBe(0.12);
    expect(scaleBucket(0)).toBe(0.01);
    expect(hasDealerHint(makeDef({ id: 'h', symbol: 'machine', hinweis: 'Maße vor Kauf beim Händler bestätigen' }))).toBe(true);
    expect(hasDealerHint(undefined)).toBe(false);
    expect(FURNITURE_AREAS.has('Empfang & Lounge')).toBe(true);
  });

  it('rendert Zonen, Symbole, Labels und Marker; versteckte Objekte nicht', () => {
    const project = createEmptyProject('T');
    const floor = project.floors[0];
    floor.ceilingHeight = 240;
    const def = makeDef({ id: 'rack', symbol: 'rack', modell: 'C513', hoehe_cm: 246, verifiziert: false, hinweis: 'Maße vor Kauf beim Händler bestätigen', breite_cm: 165, tiefe_cm: 203 });
    project.customEquipment.push(def);
    const a = makeItem(def);
    const b = makeItem(def, { hidden: true, x: 900, y: 900 });
    const c = makeItem(def, { x: 1500, y: 300, safetyZoneEnabled: false });
    const items = [a, b, c];
    const { stage, unmount } = renderStage(<ItemsLayer {...layerProps(project, floor, items, { collidingIds: new Set([a.id]) })} />);
    expect(stage.find('Text').length).toBe(2); // Labels für a und c (Breite 165 cm × 0,5 = 82 px > 28 px)
    const zoneLines = stage.find('Line').filter((l) => (l as Konva.Line).closed() && ((l as Konva.Line).dash()?.length ?? 0) > 0 && (l as Konva.Line).points().length === 8);
    expect(zoneLines.length).toBe(1); // nur a hat eine aktive Zone
    expect(zoneLines[0].getAttr('stroke')).toBe('#dc2626'); // kollidierend → rot
    // Marker: zu hoch (Dreieck, 3 Punkte, gefüllt), unverifiziert (gestrichelt), Händler-Punkt
    const triangles = stage.find('Line').filter((l) => (l as Konva.Line).points().length === 6 && (l as Konva.Line).closed());
    expect(triangles.length).toBe(2);
    expect(stage.find('Circle').length).toBe(2);
    unmount();
    // Ebene „Beschriftungen“ aus → keine Texte; Zonen aus → keine gestrichelten Rechtecke
    const p2 = { ...project, layers: { ...project.layers, labels: false, safetyZones: false } };
    const r2 = renderStage(<ItemsLayer {...layerProps(p2, floor, items)} />);
    expect(r2.stage.find('Text').length).toBe(0);
    expect(r2.stage.find('Line').filter((l) => (l as Konva.Line).closed() && (l as Konva.Line).points().length === 8).length).toBe(0);
    r2.unmount();
    // Präsentationsmodus: keine Marker, Labels bleiben
    const r3 = renderStage(<ItemsLayer {...layerProps(project, floor, items, { presentation: true })} />);
    expect(r3.stage.find('Circle').length).toBe(0);
    expect(r3.stage.find('Text').length).toBe(2);
    r3.unmount();
  });

  it('kein Label, wenn das Objekt auf dem Bildschirm schmaler als 28 px ist', () => {
    const project = createEmptyProject('T');
    const floor = project.floors[0];
    const def = makeDef({ id: 'x', symbol: 'machine', breite_cm: 100, tiefe_cm: 100 });
    project.customEquipment.push(def);
    const { stage } = renderStage(<ItemsLayer {...layerProps(project, floor, [makeItem(def)], { viewport: { scale: 0.2, x: 0, y: 0 } })} />);
    expect(stage.find('Text').length).toBe(0);
  });

  it('verlinkte Treppen anderer Stockwerke: halbtransparent mit „von <Stockwerk>“', () => {
    const project = createEmptyProject('T');
    const eg = project.floors[0];
    const og = createFloor({ name: 'OG 1', order: 1 });
    project.floors.push(og);
    const def = makeDef({ id: 'st', symbol: 'stairs-straight', bereich: 'Bauelemente', name: 'Treppe', breite_cm: 100, tiefe_cm: 360, sicherheitszone_cm: { vorne: 0, hinten: 0, links: 0, rechts: 0 } });
    project.customEquipment.push(def);
    const linked = makeItem(def, { kind: 'stairs', locked: true, params: { __linkedFrom: og.id, typ: 'gerade' } });
    const { stage } = renderStage(<ItemsLayer {...layerProps(project, eg, [linked])} />);
    const text = stage.find('Text')[0] as Konva.Text;
    expect(text.text()).toBe('Treppe\nvon OG 1');
    const groups = stage.find('Group').filter((g) => g.opacity() < 1);
    expect(groups.length).toBe(1);
  });

  it('Ebene „Möbel“ blendet Empfang/Büro/Ausstattung aus', () => {
    const project = createEmptyProject('T');
    const floor = project.floors[0];
    const sofa = makeDef({ id: 'sofa', symbol: 'sofa', bereich: 'Empfang & Lounge', breite_cm: 200, tiefe_cm: 90 });
    const rack = makeDef({ id: 'rack', symbol: 'rack' });
    project.customEquipment.push(sofa, rack);
    const p2 = { ...project, layers: { ...project.layers, furniture: false, safetyZones: false, labels: false } };
    const { stage } = renderStage(<ItemsLayer {...layerProps(p2, floor, [makeItem(sofa), makeItem(rack, { x: 800 })])} />);
    // Nur das Rack (Body + 4 Pfosten + Ablage + 2 Streben = 8 Shapes)
    expect(shapeCount(stage)).toBe(8);
  });

  it('600 Objekte rendern zügig (memoisierte Items) und Pan löst keine Item-Re-Renders aus', () => {
    const project = createEmptyProject('Perf');
    const floor = project.floors[0];
    const defs = [
      makeDef({ id: 'p1', symbol: 'treadmill', bereich: 'Cardio', breite_cm: 90, tiefe_cm: 210, sicherheitszone_cm: { vorne: 0, hinten: 200, links: 0, rechts: 0 } }),
      makeDef({ id: 'p2', symbol: 'rack', breite_cm: 165, tiefe_cm: 203 }),
      makeDef({ id: 'p3', symbol: 'locker-row', bereich: 'Umkleide', breite_cm: 400, tiefe_cm: 50, sicherheitszone_cm: { vorne: 0, hinten: 0, links: 0, rechts: 0 } }),
      makeDef({ id: 'p4', symbol: 'leg-press', breite_cm: 120, tiefe_cm: 191 }),
    ];
    project.customEquipment.push(...defs);
    const items: PlacedItem[] = [];
    for (let i = 0; i < 600; i++) items.push(makeItem(defs[i % defs.length], { x: (i % 30) * 300, y: Math.floor(i / 30) * 300, rotation: (i % 4) * 90 }));
    const t0 = performance.now();
    const props = layerProps(project, floor, items);
    const ref = createRef<Konva.Stage>();
    const r = render(<Stage ref={ref} width={800} height={600}><Layer><ItemsLayer {...props} /></Layer></Stage>);
    const ms = performance.now() - t0;
    expect(shapeCount(ref.current!)).toBeGreaterThan(600);
    expect(ms).toBeLessThan(3000);
    // Pan: gleiche Scale, andere x/y → Konva-Node-Instanzen bleiben identisch (memo greift)
    const before = ref.current!.find('Group').length;
    const firstGroup = ref.current!.find('Group')[3];
    r.rerender(<Stage ref={ref} width={800} height={600}><Layer><ItemsLayer {...props} viewport={{ scale: 0.5, x: 120, y: -40 }} /></Layer></Stage>);
    expect(ref.current!.find('Group').length).toBe(before);
    expect(ref.current!.find('Group')[3]).toBe(firstGroup);
    // eslint-disable-next-line no-console
    console.info(`ItemsLayer: 600 Objekte in ${ms.toFixed(0)} ms gerendert`);
  });
});

/* ------------------------------------------------------------------ */
/* Platzier-Werkzeuge                                                  */
/* ------------------------------------------------------------------ */

function makeCtx(project: Project, floor: Floor, scale = 0.5): ToolContext {
  return {
    project, floor, walls: [], rooms: [], items: floor.items, viewport: { scale, x: 0, y: 0 },
    store: useProjectStore.getState(), ui: useUiStore.getState(),
    snap: (p) => ({ point: p, kind: 'none', guides: [] }),
    pxToWorld: (px) => px / scale,
    stageSize: { width: 800, height: 600 },
  };
}

function ev(x: number, y: number, over: Partial<ToolEvent> = {}): ToolEvent {
  return {
    world: { x, y }, screen: { x: x * 0.5, y: y * 0.5 }, shift: false, alt: false, ctrl: false, meta: false, button: 0, pointerType: 'mouse',
    evt: {} as ToolEvent['evt'], target: {} as ToolEvent['target'], ...over,
  };
}

describe('Platzier-Werkzeuge', () => {
  beforeEach(() => {
    const p = createEmptyProject('Platzieren');
    loadProject(p);
    useUiStore.setState({ tool: 'select', selection: [], toolOptions: {}, toasts: [], snapOverride: false });
    usePlaceState.getState().reset();
    useSnapGuides.getState().set(null);
  });

  it('Optionen werden robust gelesen', () => {
    expect(readPlaceOptions(undefined)).toEqual({ stairsType: 'gerade', columnShape: 'eckig' });
    expect(readPlaceOptions({ stairsType: 'U', columnShape: 'rund' })).toEqual({ stairsType: 'U', columnShape: 'rund' });
    expect(readPlaceOptions({ stairsType: 'quatsch', columnShape: 3 })).toEqual({ stairsType: 'gerade', columnShape: 'eckig' });
  });

  it('Fallback-Definitionen tragen die Maße der Spezifikation und werden über getDef gefunden, sobald sie im Projekt liegen', () => {
    const gerade = makeFallbackDef('stairs', { stairsType: 'gerade', columnShape: 'eckig' });
    expect([gerade.breite_cm, gerade.tiefe_cm]).toEqual([100, 360]);
    expect(gerade.symbol).toBe('stairs-straight');
    expect(gerade.params).toMatchObject({ kind: 'stairs', typ: 'gerade', stufen: 13 });
    expect(makeFallbackDef('stairs', { stairsType: 'L', columnShape: 'eckig' }).breite_cm).toBe(240);
    expect(makeFallbackDef('stairs', { stairsType: 'U', columnShape: 'eckig' }).tiefe_cm).toBe(300);
    const wendel = makeFallbackDef('stairs', { stairsType: 'Wendeltreppe', columnShape: 'eckig' });
    expect([wendel.breite_cm, wendel.tiefe_cm, wendel.form, wendel.symbol]).toEqual([200, 200, 'kreis', 'stairs-spiral']);
    const lift = makeFallbackDef('elevator', readPlaceOptions(undefined));
    expect([lift.breite_cm, lift.tiefe_cm, lift.symbol]).toEqual([180, 200, 'elevator']);
    const rund = makeFallbackDef('column', { stairsType: 'gerade', columnShape: 'rund' });
    expect([rund.breite_cm, rund.tiefe_cm, rund.form, rund.symbol]).toEqual([30, 30, 'kreis', 'column-round']);
    expect(makeFallbackDef('column', { stairsType: 'gerade', columnShape: 'eckig' }).symbol).toBe('column-square');
    expect(PLACE_DIMENSIONS.column.w).toBe(30);
    for (const d of [gerade, wendel, lift, rund]) {
      expect(d.bereich).toBe('Bauelemente');
      expect(d.skalierbar).toBe(true);
      expect(d.sicherheitszone_cm).toEqual({ vorne: 0, hinten: 0, links: 0, rechts: 0 });
    }
  });

  it('resolvePlaceDef: generic.json → gespeicherte Fallback-Def → neue Fallback-Def', () => {
    const project = useProjectStore.getState().project;
    const opts = { stairsType: 'gerade' as const };
    const r = resolvePlaceDef('stairs', opts, project);
    const hasGeneric = GENERIC_LIBRARY.some((d) => d.bereich === 'Bauelemente' && d.symbol === 'stairs-straight');
    if (hasGeneric) {
      expect(r.source).toBe('generic');
      expect(r.def.symbol).toBe('stairs-straight');
    } else {
      expect(r.source).toBe('fallback');
      expect(r.def.id).toBe(fallbackDefId('stairs', readPlaceOptions(opts)));
      useProjectStore.getState().addCustomEquipment(r.def);
      const again = resolvePlaceDef('stairs', opts, useProjectStore.getState().project);
      expect(again.source).toBe('custom');
      expect(getDef(again.def.id, useProjectStore.getState().project)).toBeDefined();
    }
  });

  it('buildPlacedItem: Treppe/Aufzug verlinken aktuelles + darüberliegendes Stockwerk, Säule nicht', () => {
    const eg = createFloor({ name: 'EG', order: 0 });
    const og1 = createFloor({ name: 'OG 1', order: 1 });
    const og2 = createFloor({ name: 'OG 2', order: 2 });
    const ug = createFloor({ name: 'UG', order: -1 });
    const floors = [og2, ug, eg, og1];
    expect(floorAbove(floors, eg)?.id).toBe(og1.id);
    expect(floorAbove(floors, og2)).toBeNull();
    const opts = readPlaceOptions({ stairsType: 'L', columnShape: 'rund' });
    const st = buildPlacedItem('stairs', makeFallbackDef('stairs', opts), { x: 100, y: 200 }, 450, eg, floors, opts);
    expect(st.kind).toBe('stairs');
    expect(st.linkedFloorIds).toEqual([eg.id, og1.id]);
    expect(st.rotation).toBe(90);
    expect(st.params).toMatchObject({ typ: 'L' });
    expect(typeof st.params?.stufen).toBe('number');
    expect([st.width, st.depth]).toEqual([240, 240]);
    const top = buildPlacedItem('elevator', makeFallbackDef('elevator', opts), { x: 0, y: 0 }, 0, og2, floors, opts);
    expect(top.kind).toBe('elevator');
    expect(top.linkedFloorIds).toEqual([og2.id]);
    const col = buildPlacedItem('column', makeFallbackDef('column', opts), { x: 0, y: 0 }, 0, eg, floors, opts);
    expect(col.kind).toBe('column');
    expect(col.linkedFloorIds).toBeUndefined();
    expect(col.params).toMatchObject({ form: 'rund' });
  });

  it('Werkzeuge sind registriert: Klick platziert, Auswahl + select-Werkzeug, ein Undo-Schritt', () => {
    const tool = getTool('stairs')!;
    expect(tool).toBeDefined();
    expect(getTool('elevator')).toBeDefined();
    expect(getTool('column')).toBeDefined();
    expect(tool.hint).toContain('Treppe');
    useProjectStore.getState().addFloor({ name: 'OG 1', order: 1 });
    const project0 = useProjectStore.getState().project;
    const eg = project0.floors.find((f) => f.order === 0)!;
    useProjectStore.getState().setActiveFloor(eg.id);
    useUiStore.setState({ tool: 'stairs', toolOptions: { stairsType: 'U' } });
    const ctx = makeCtx(useProjectStore.getState().project, eg);
    act(() => { tool.onActivate?.(ctx); });
    act(() => { tool.onPointerMove?.(ev(1000, 800), ctx); });
    expect(usePlaceState.getState().pos).toEqual({ x: 1000, y: 800 }); // Raster 10 cm → unverändert
    act(() => { tool.onPointerDown?.(ev(1000, 800), ctx); tool.onPointerUp?.(ev(1000, 800), ctx); });
    const p1 = useProjectStore.getState().project;
    const floor = p1.floors.find((f) => f.id === eg.id)!;
    expect(floor.items.length).toBe(1);
    const it = floor.items[0];
    expect(it.kind).toBe('stairs');
    expect(it.params?.typ).toBe('U');
    expect(it.linkedFloorIds?.length).toBe(2);
    expect(getDef(it.defId, p1)).toBeDefined();
    expect(useUiStore.getState().selection).toEqual([{ kind: 'item', id: it.id }]);
    expect(useUiStore.getState().tool).toBe('select');
    expect(usePlaceState.getState().pos).toBeNull();
    // Ein Undo entfernt Objekt (und ggf. Fallback-Def) gemeinsam
    undo();
    const p2 = useProjectStore.getState().project;
    expect(p2.floors.find((f) => f.id === eg.id)!.items.length).toBe(0);
    if (resolvePlaceDef('stairs', { stairsType: 'U' }, p1).source !== 'generic') expect(p2.customEquipment.length).toBe(0);
    redo();
    expect(useProjectStore.getState().project.floors.find((f) => f.id === eg.id)!.items.length).toBe(1);
  });

  it('Ziehen (Bewegung > 8 px) platziert nicht, rechte Maustaste nicht, Touch-Tipp schon', () => {
    const tool = getTool('column')!;
    const eg = useProjectStore.getState().project.floors[0];
    useUiStore.setState({ tool: 'column', toolOptions: { columnShape: 'rund' } });
    const ctx = makeCtx(useProjectStore.getState().project, eg);
    tool.onPointerDown?.(ev(100, 100), ctx);
    tool.onPointerUp?.(ev(100, 100, { screen: { x: 90, y: 90 } }), ctx);
    expect(useProjectStore.getState().project.floors[0].items.length).toBe(0);
    tool.onPointerDown?.(ev(100, 100, { button: 2 }), ctx);
    tool.onPointerUp?.(ev(100, 100, { button: 2 }), ctx);
    expect(useProjectStore.getState().project.floors[0].items.length).toBe(0);
    tool.onPointerDown?.(ev(200, 200, { pointerType: 'touch' }), ctx);
    tool.onPointerUp?.(ev(200, 200, { pointerType: 'touch', screen: { x: 102, y: 101 } }), ctx);
    const items = useProjectStore.getState().project.floors[0].items;
    expect(items.length).toBe(1);
    expect(items[0].kind).toBe('column');
    expect(items[0].params?.form).toBe('rund');
    expect([items[0].width, items[0].depth]).toEqual([30, 30]);
    expect(items[0].linkedFloorIds).toBeUndefined();
  });

  it('Tasten: R dreht die Vorschau um 90°, Shift+R zurück, Esc bricht ab und wechselt zu „select“', () => {
    const tool = getTool('elevator')!;
    const eg = useProjectStore.getState().project.floors[0];
    useUiStore.setState({ tool: 'elevator' });
    const ctx = makeCtx(useProjectStore.getState().project, eg);
    tool.onActivate?.(ctx);
    tool.onPointerMove?.(ev(500, 500), ctx);
    expect(tool.onKeyDown?.(new KeyboardEvent('keydown', { key: 'r' }), ctx)).toBe(true);
    expect(usePlaceState.getState().rotation).toBe(90);
    expect(tool.onKeyDown?.(new KeyboardEvent('keydown', { key: 'R', shiftKey: true }), ctx)).toBe(true);
    expect(usePlaceState.getState().rotation).toBe(0);
    expect(tool.onKeyDown?.(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true }), ctx)).toBe(false);
    expect(tool.onKeyDown?.(new KeyboardEvent('keydown', { key: 'x' }), ctx)).toBe(false);
    tool.onKeyDown?.(new KeyboardEvent('keydown', { key: 'r' }), ctx);
    tool.onPointerDown?.(ev(500, 500), ctx);
    tool.onPointerUp?.(ev(500, 500), ctx);
    expect(useProjectStore.getState().project.floors[0].items[0].rotation).toBe(90);
    useUiStore.setState({ tool: 'elevator' });
    tool.onPointerMove?.(ev(500, 500), ctx);
    expect(usePlaceState.getState().pos).not.toBeNull();
    expect(tool.onKeyDown?.(new KeyboardEvent('keydown', { key: 'Escape' }), ctx)).toBe(true);
    expect(useUiStore.getState().tool).toBe('select');
    expect(usePlaceState.getState().pos).toBeNull();
    tool.onCancel?.(ctx);
    expect(useSnapGuides.getState().guides.length).toBe(0);
  });

  it('Overlay zeigt die Vorschau (Symbol + Infotext) an der gesnappten Position', () => {
    const tool = getTool('stairs')!;
    const eg = useProjectStore.getState().project.floors[0];
    useUiStore.setState({ tool: 'stairs', toolOptions: { stairsType: 'Wendeltreppe' } });
    const ctx = makeCtx(useProjectStore.getState().project, eg);
    const Overlay = tool.Overlay!;
    const r = renderStage(<Overlay ctx={ctx} />);
    expect(shapeCount(r.stage)).toBe(0);
    act(() => { tool.onPointerMove?.(ev(700, 900), ctx); });
    expect(shapeCount(r.stage)).toBeGreaterThan(1);
    const text = r.stage.find('Text')[0] as Konva.Text;
    expect(text.text()).toContain('200 × 200 cm');
    expect(text.text()).toContain('kein Stockwerk darüber');
    expect(r.stage.find('Circle').length).toBeGreaterThan(0); // Wendeltreppe = Kreis
  });

  it('placeAt ignoriert ungültige Positionen', () => {
    const eg = useProjectStore.getState().project.floors[0];
    const ctx = makeCtx(useProjectStore.getState().project, eg);
    expect(placeAt('column', { x: NaN, y: 0 }, ctx)).toBeNull();
    expect(useProjectStore.getState().project.floors[0].items.length).toBe(0);
  });
});
