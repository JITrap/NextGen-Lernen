import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Wall, Opening, Vec2 } from '@/types';
import { snapPoint, type SnapContext } from '@/geometry/snap';
import { detectWallRooms, floorRooms } from '@/geometry/rooms';
import { createFloor, createHall } from '@/store/factories';
import { isClockwise } from '@/geometry/polygon';
import { computeSegmentEnd, findWallSplits, resolveWallSnap, wallPropsFromOptions, parseTypedLength, parseTypedAngle, MIN_SEGMENT_CM } from './wallTool';
import { rectFromDrag, dragCorner, polygonSelfIntersects, hallFromPolygon, hallPolygonProblem } from './hallTools';

let counter = 0;
function wall(start: Vec2, end: Vec2, partial: Partial<Wall> = {}): Wall {
  return { id: `w${++counter}`, start, end, thickness: 12.5, type: 'Trockenbau', height: null, ...partial };
}

describe('computeSegmentEnd', () => {
  it('legt Länge 350 in Richtung 90° (im Uhrzeigersinn = nach unten) an', () => {
    const p = computeSegmentEnd({ x: 0, y: 0 }, { x: 100, y: 0 }, 350, 90, false);
    expect(p).toEqual({ x: 0, y: 350 });
  });
  it('nutzt die Cursor-Richtung, wenn kein Winkel getippt wurde', () => {
    const p = computeSegmentEnd({ x: 100, y: 100 }, { x: 300, y: 100 }, 250, null, false);
    expect(p).toEqual({ x: 350, y: 100 });
  });
  it('rundet die Cursor-Richtung bei aktivem Snapping auf 45°', () => {
    const p = computeSegmentEnd({ x: 0, y: 0 }, { x: 200, y: 8 }, 100, null, true);
    expect(p).toEqual({ x: 100, y: 0 });
    const q = computeSegmentEnd({ x: 0, y: 0 }, { x: 100, y: 90 }, 100, null, true);
    expect(q.x).toBeCloseTo(Math.SQRT1_2 * 100, 3);
    expect(q.y).toBeCloseTo(Math.SQRT1_2 * 100, 3);
  });
  it('nimmt den Cursor-Abstand als Länge, wenn keine Länge getippt wurde', () => {
    const p = computeSegmentEnd({ x: 0, y: 0 }, { x: 0, y: -420 }, null, null, false);
    expect(p).toEqual({ x: 0, y: -420 });
  });
  it('fällt bei Cursor auf dem Startpunkt auf 0° zurück', () => {
    expect(computeSegmentEnd({ x: 10, y: 10 }, { x: 10, y: 10 }, 50, null, true)).toEqual({ x: 60, y: 10 });
  });
});

describe('Tastatureingabe', () => {
  it('parst Längen in cm und m', () => {
    expect(parseTypedLength('350')).toBe(350);
    expect(parseTypedLength('3,5m')).toBe(350);
    expect(parseTypedLength('12,5cm')).toBe(12.5);
    expect(parseTypedLength('')).toBeNull();
    expect(parseTypedLength('3,')).toBeNull();
    expect(parseTypedLength('0')).toBeNull();
  });
  it('parst Winkel', () => {
    expect(parseTypedAngle('90')).toBe(90);
    expect(parseTypedAngle('-45')).toBe(-45);
    expect(parseTypedAngle('22,5')).toBe(22.5);
    expect(parseTypedAngle('')).toBeNull();
  });
  it('liest Wand-Eigenschaften aus den Werkzeugoptionen (0 = bis Decke)', () => {
    expect(wallPropsFromOptions({})).toEqual({ thickness: 12.5, type: 'Trockenbau', height: null });
    expect(wallPropsFromOptions({ wallThickness: 24, wallType: 'Mauerwerk', wallHeight: 0 })).toEqual({ thickness: 24, type: 'Mauerwerk', height: null });
    expect(wallPropsFromOptions({ wallThickness: 10, wallType: 'Brüstung', wallHeight: 110 })).toEqual({ thickness: 10, type: 'Brüstung', height: 110 });
    expect(wallPropsFromOptions({ wallType: 'Unbekannt' }).type).toBe('Trockenbau');
  });
});

describe('findWallSplits', () => {
  it('erkennt einen T-Stoß und teilt die bestehende Wand', () => {
    const a = wall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const b = wall({ x: 500, y: -300 }, { x: 500, y: 0 });
    const r = findWallSplits(b, [a]);
    expect(r.removeIds).toEqual([a.id]);
    expect(r.add).toHaveLength(3);
    const parts = r.add.filter((w) => w.id !== b.id);
    expect(parts[0].id).toBe(a.id);
    expect(parts[0].start).toEqual({ x: 0, y: 0 });
    expect(parts[0].end).toEqual({ x: 500, y: 0 });
    expect(parts[1].start).toEqual({ x: 500, y: 0 });
    expect(parts[1].end).toEqual({ x: 1000, y: 0 });
    expect(r.add.find((w) => w.id === b.id)).toMatchObject({ start: { x: 500, y: -300 }, end: { x: 500, y: 0 } });
  });
  it('teilt die neue Wand, wenn das Ende einer bestehenden Wand auf sie trifft', () => {
    const a = wall({ x: 500, y: -300 }, { x: 500, y: 0 });
    const b = wall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const r = findWallSplits(b, [a]);
    expect(r.removeIds).toEqual([]);
    expect(r.add).toHaveLength(2);
    expect(r.add[0]).toMatchObject({ id: b.id, start: { x: 0, y: 0 }, end: { x: 500, y: 0 } });
    expect(r.add[1]).toMatchObject({ start: { x: 500, y: 0 }, end: { x: 1000, y: 0 } });
  });
  it('teilt bei einer Kreuzung beide Wände', () => {
    const a = wall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const b = wall({ x: 500, y: -300 }, { x: 500, y: 300 });
    const r = findWallSplits(b, [a]);
    expect(r.removeIds).toEqual([a.id]);
    expect(r.add).toHaveLength(4);
  });
  it('lässt Wände ohne Berührung unverändert und Hallenwände/gesperrte Wände aus', () => {
    const far = wall({ x: 0, y: 500 }, { x: 1000, y: 500 });
    const hall = wall({ x: 0, y: 0 }, { x: 1000, y: 0 }, { id: 'hall_0', type: 'Außenwand', thickness: 24 });
    const locked = wall({ x: 0, y: 100 }, { x: 1000, y: 100 }, { locked: true });
    const b = wall({ x: 500, y: 0 }, { x: 500, y: 100 });
    const r = findWallSplits(b, [far, hall, locked]);
    expect(r.removeIds).toEqual([]);
    expect(r.add).toEqual([b]);
  });
  it('verschiebt Öffnungen auf das passende Teilstück', () => {
    const a = wall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const door: Opening = { id: 'o1', kind: 'door', wallId: a.id, offset: 800, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' };
    const near: Opening = { id: 'o2', kind: 'window', wallId: a.id, offset: 200, width: 120, height: 120, sillHeight: 90 };
    const b = wall({ x: 500, y: -300 }, { x: 500, y: 0 });
    const r = findWallSplits(b, [a], [door, near]);
    expect(r.openings).toHaveLength(1);
    const moved = r.openings[0];
    const second = r.add.find((w) => w.id !== a.id && w.id !== b.id)!;
    expect(moved.id).toBe('o1');
    expect(moved.wallId).toBe(second.id);
    expect(moved.offset).toBeCloseTo(300, 6);
  });
});

/** Simuliert das Wandwerkzeug: Basis-Snapping wie im Canvas + Fanglinien des Werkzeugs. */
function snapLike(p: Vec2, walls: Wall[], angleFrom: Vec2 | null, threshold = 32) {
  const ctx: SnapContext = { gridSize: 10, enabled: true, threshold, walls, hall: null, angleFrom, targets: { 'item-edge': false } };
  return resolveWallSnap(p, snapPoint(p, ctx), { walls, hall: null, threshold, angleFrom, enabled: true });
}

describe('Wandkette', () => {
  it('schließt eine Kette aus 4 Segmenten exakt am Startpunkt (Snapping auf Wandende)', () => {
    let walls: Wall[] = [];
    const start: Vec2 = { x: 0, y: 0 };
    const targets: Vec2[] = [
      { x: 1003, y: 4 }, // ≈ (1000, 0) – Winkel-Snapping + Raster
      { x: 996, y: 803 },
      { x: 5, y: 797 },
      { x: 6, y: -7 }, // nahe am Startpunkt → Wandende gewinnt
    ];
    let from = start;
    for (const t of targets) {
      const r = snapLike(t, walls, from);
      const w = wall(from, r.point);
      const split = findWallSplits(w, walls);
      const remove = new Set(split.removeIds);
      walls = walls.filter((x) => !remove.has(x.id)).concat(split.add);
      from = r.point;
    }
    expect(walls).toHaveLength(4);
    expect(walls[0].start).toEqual({ x: 0, y: 0 });
    expect(walls[0].end).toEqual({ x: 1000, y: 0 });
    expect(walls[1].end).toEqual({ x: 1000, y: 800 });
    expect(walls[2].end).toEqual({ x: 0, y: 800 });
    expect(walls[3].end).toEqual(start);
    expect(walls[3].end.x).toBe(0);
    expect(walls[3].end.y).toBe(0);
    const rooms = detectWallRooms(walls);
    expect(rooms).toHaveLength(1);
    expect(Math.abs(rooms[0].polygon.length)).toBeGreaterThanOrEqual(4);
  });

  it('fängt das Segmentende auf der Achse einer bestehenden Wand (T-Stoß) und teilt sie', () => {
    const a = wall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const from: Vec2 = { x: 400, y: -300 };
    const r = snapLike({ x: 403, y: -6 }, [a], from);
    expect(r.point).toEqual({ x: 400, y: 0 });
    const split = findWallSplits(wall(from, r.point), [a]);
    expect(split.removeIds).toEqual([a.id]);
    expect(split.add).toHaveLength(3);
  });

  it('schließt Innenwände an die Halleninnenkante an', () => {
    const hall = createHall(2000, 1000, { wallThickness: 24 });
    const from: Vec2 = { x: 600, y: 500 };
    const r = resolveWallSnap({ x: 604, y: 30 }, { point: { x: 600, y: 30 }, kind: 'angle', guides: [] }, { walls: [], hall, threshold: 32, angleFrom: from, enabled: true });
    expect(r.point).toEqual({ x: 600, y: 24 });
    expect(r.kind).toBe('angle');
  });

  it('erkennt einen Raum aus Hallenwand + drei Innenwänden', () => {
    const floor = createFloor({ hall: createHall(2000, 1000, { wallThickness: 24 }) });
    let walls: Wall[] = [];
    const chain: Vec2[] = [
      { x: 600, y: 24 },
      { x: 600, y: 600 },
      { x: 1200, y: 600 },
      { x: 1200, y: 24 },
    ];
    for (let i = 0; i + 1 < chain.length; i++) {
      const w = wall(chain[i], chain[i + 1]);
      const split = findWallSplits(w, walls);
      const remove = new Set(split.removeIds);
      walls = walls.filter((x) => !remove.has(x.id)).concat(split.add);
    }
    const rooms = floorRooms({ ...floor, walls });
    const inner = rooms.find((rm) => rm.areaM2 > 30 && rm.areaM2 < 40);
    expect(inner).toBeDefined();
    expect(MIN_SEGMENT_CM).toBe(2);
  });
});

describe('Hallenwerkzeuge', () => {
  it('zieht ein Rechteck auf (auch als Quadrat mit Shift)', () => {
    expect(rectFromDrag({ x: 100, y: 100 }, { x: 600, y: 300 }, false)).toEqual([
      { x: 100, y: 100 },
      { x: 600, y: 100 },
      { x: 600, y: 300 },
      { x: 100, y: 300 },
    ]);
    expect(dragCorner({ x: 0, y: 0 }, { x: -500, y: 200 }, true)).toEqual({ x: -500, y: 500 });
  });
  it('erkennt selbstüberschneidende Polygone', () => {
    const bowtie = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(polygonSelfIntersects(bowtie)).toBe(true);
    const lShape = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 500 },
      { x: 500, y: 500 },
      { x: 500, y: 1000 },
      { x: 0, y: 1000 },
    ];
    expect(polygonSelfIntersects(lShape)).toBe(false);
    expect(hallPolygonProblem(lShape)).toBeNull();
    expect(hallPolygonProblem(bowtie)).toMatch(/überschneidet/);
    expect(hallPolygonProblem([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }])).toMatch(/1 m²/);
  });
  it('baut die Halle aus Polygon und Werkzeugoptionen', () => {
    const h = hallFromPolygon([{ x: 0, y: 0 }, { x: 0, y: 500 }, { x: 800, y: 500 }, { x: 800, y: 0 }], { wallThickness: 30, floorCovering: 'Parkett' });
    expect(h.wallThickness).toBe(30);
    expect(h.floorCovering).toBe('Parkett');
    // im Uhrzeigersinn normalisiert (Eingabe war gegen den Uhrzeigersinn)
    expect(isClockwise(h.polygon)).toBe(true);
    expect(h.polygon).toHaveLength(4);
    const d = hallFromPolygon([{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 500 }, { x: 0, y: 500 }], {});
    expect(d.wallThickness).toBe(24);
    expect(d.floorCovering).toBe('Gummiboden');
  });
});

/* ------------------------------------------------------------------ */
/* Doppelklick-Erkennung, Segment zurück, Hallen-Öffnungen             */
/* ------------------------------------------------------------------ */

import type Konva from 'konva';
import { getTool } from './registry';
import { createClickTracker, DBLCLICK_MAX_PX, type ToolContext, type ToolEvent } from './types';
import { useWallTool, undoLastSegment } from './wallTool';
import { reattachHallOpenings, HALL_OPENING_REATTACH_CM } from './hallTools';
import { useProjectStore, loadProject, transaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createEmptyProject, createWall as makeWall } from '@/store/factories';
import { allWalls, hallWalls, pointOnWall, findWall } from '@/geometry/walls';
import { distance as dist } from '@/geometry/polygon';
import './index';

describe('createClickTracker (M4)', () => {
  it('erkennt zwei Klicks an derselben Stelle als Doppelklick, entfernte Klicks nicht', () => {
    const t = createClickTracker();
    expect(t.isDoubleClick()).toBe(false);
    t.down({ x: 100, y: 100 });
    expect(t.isDoubleClick()).toBe(false);
    t.down({ x: 100 + DBLCLICK_MAX_PX, y: 100 });
    expect(t.isDoubleClick()).toBe(true);
    t.down({ x: 400, y: 250 });
    expect(t.isDoubleClick()).toBe(false);
    t.down({ x: 401, y: 251 });
    expect(t.isDoubleClick()).toBe(true);
    t.reset();
    expect(t.isDoubleClick()).toBe(false);
  });
});

function wallCtx(): ToolContext {
  const project = useProjectStore.getState().project;
  const floor = project.floors.find((f) => f.id === project.activeFloorId) ?? project.floors[0];
  const walls = allWalls(floor);
  return {
    project,
    floor,
    walls,
    rooms: [],
    items: floor.items,
    viewport: { scale: 1, x: 0, y: 0 },
    store: useProjectStore.getState(),
    ui: useUiStore.getState(),
    snap: (p, o) => snapPoint(p, { gridSize: project.settings.gridSize, enabled: false, threshold: 8, walls, items: floor.items, hall: floor.hall, ...o }),
    pxToWorld: (px) => px,
    stageSize: { width: 800, height: 600 },
  };
}
function wallEv(x: number, y: number, extra: Partial<ToolEvent> = {}): ToolEvent {
  return {
    world: { x, y }, screen: { x, y }, shift: false, alt: false, ctrl: false, meta: false, button: 0, buttons: 1, pointerType: 'mouse',
    evt: {} as Konva.KonvaEventObject<PointerEvent>, target: {} as Konva.Node, ...extra,
  };
}
const wallTool = () => getTool('wall')!;
const wallsNow = () => wallCtx().floor.walls;
const key = (k: string) => wallTool().onKeyDown!(new KeyboardEvent('keydown', { key: k }), wallCtx());

describe('Wandwerkzeug: Kette, Doppelklick und „Segment zurück“ (M4/M5/L1)', () => {
  beforeEach(() => {
    const p = createEmptyProject('Test');
    p.floors[0].hall = createHall(3000, 2000);
    p.settings.snapEnabled = false;
    loadProject(p);
    useUiStore.getState().setTool('wall');
    wallTool().onActivate?.(wallCtx());
  });
  afterEach(() => {
    wallTool().onCancel?.(wallCtx());
    useUiStore.getState().setTool('select');
  });

  it('zwei schnelle Klicks an verschiedenen Punkten beenden die Kette nicht (kein Doppelklick)', () => {
    wallTool().onPointerDown!(wallEv(100, 100), wallCtx());
    wallTool().onPointerDown!(wallEv(600, 100), wallCtx());
    // Konva meldet nach zwei Klicks < 400 ms ein dblclick – die Klicks lagen aber 500 px auseinander
    wallTool().onDoubleClick!(wallEv(600, 100), wallCtx());
    expect(useWallTool.getState().chainStart).toEqual({ x: 600, y: 100 });
    expect(wallsNow()).toHaveLength(1);
    // Echter Doppelklick (zweiter Klick an derselben Stelle) beendet die Kette
    wallTool().onPointerDown!(wallEv(600, 100), wallCtx());
    wallTool().onDoubleClick!(wallEv(600, 100), wallCtx());
    expect(useWallTool.getState().chainStart).toBeNull();
    expect(wallsNow()).toHaveLength(1);
  });

  it('Backspace nimmt nur das letzte Segment zurück – fremde Undo-Schritte bleiben unberührt', () => {
    wallTool().onPointerDown!(wallEv(100, 100), wallCtx());
    wallTool().onPointerDown!(wallEv(600, 100), wallCtx());
    expect(wallsNow()).toHaveLength(1);
    // Zwischenzeitlich ein anderer Undo-Eintrag (z. B. Raster-Schalter)
    transaction(() => useProjectStore.getState().updateSettings({ showGrid: false }));
    expect(useProjectStore.getState().project.settings.showGrid).toBe(false);
    expect(key('Backspace')).toBe(true);
    expect(wallsNow()).toHaveLength(0);
    expect(useProjectStore.getState().project.settings.showGrid).toBe(false);
    const st = useWallTool.getState();
    expect(st.chainStart).toEqual({ x: 100, y: 100 });
    expect(st.count).toBe(0);
    expect(st.history).toHaveLength(0);
    // Die Rücknahme ist ein eigener Undo-Schritt: Undo bringt das Segment zurück, Raster bleibt aus
    useProjectStore.temporal.getState().undo();
    expect(wallsNow()).toHaveLength(1);
    expect(useProjectStore.getState().project.settings.showGrid).toBe(false);
  });

  it('Backspace baut eine Teilung an einem T-Stoß samt Öffnungsbezug zurück', () => {
    const fid = wallCtx().floor.id;
    const existing = makeWall({ id: 'wx', start: { x: 300, y: 0 }, end: { x: 300, y: 400 } });
    transaction(() => {
      useProjectStore.getState().addWall(fid, existing);
      useProjectStore.getState().addOpening(fid, { id: 'ox', kind: 'window', wallId: 'wx', offset: 300, width: 100, height: 100, sillHeight: 90 } as Opening);
    });
    wallTool().onPointerDown!(wallEv(100, 100), wallCtx());
    wallTool().onPointerDown!(wallEv(600, 100), wallCtx());
    // Bestehende Wand wurde bei y = 100 geteilt, die Öffnung (Offset 300) liegt jetzt auf dem zweiten Teilstück
    expect(wallsNow().length).toBeGreaterThanOrEqual(3);
    const opening = wallCtx().floor.openings.find((o) => o.id === 'ox')!;
    expect(opening.wallId).not.toBe('wx');
    expect(key('Backspace')).toBe(true);
    const walls = wallsNow();
    expect(walls).toHaveLength(1);
    expect(walls[0]).toMatchObject({ id: 'wx', start: { x: 300, y: 0 }, end: { x: 300, y: 400 } });
    expect(wallCtx().floor.openings.find((o) => o.id === 'ox')).toMatchObject({ wallId: 'wx', offset: 300 });
    expect(undoLastSegment(wallCtx())).toBe(false); // nichts mehr zurückzunehmen
  });

  it('verbraucht während der Kette Buchstaben (kein Werkzeugwechsel) und ohne Kette Ziffern (kein 3D-Kürzel)', () => {
    expect(key('3')).toBe(true);
    expect(key('h')).toBe(false);
    expect(key('Escape')).toBe(false);
    wallTool().onPointerDown!(wallEv(100, 100), wallCtx());
    expect(key('3')).toBe(true);
    expect(key('5')).toBe(true);
    expect(useWallTool.getState().typedLength).toBe('35');
    expect(key('g')).toBe(true);
    expect(key('h')).toBe(true);
    expect(useWallTool.getState().typedLength).toBe('35');
    expect(useWallTool.getState().chainStart).toEqual({ x: 100, y: 100 });
    expect(wallTool().onKeyDown!(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }), wallCtx())).toBe(false);
  });
});

describe('reattachHallOpenings (M6, Halle neu zeichnen)', () => {
  it('hängt Öffnungen an die nächste neue Außenwand und entfernt entfernte', () => {
    const oldHall = createHall(2000, 1500);
    const newHall = createHall(2400, 1500);
    const oldWalls = hallWalls(oldHall);
    const right = oldWalls.find((w) => w.id === 'hall_1')!;
    const bottom = oldWalls.find((w) => w.id === 'hall_2')!;
    const openings = [
      { id: 'door', kind: 'door', wallId: 'hall_1', offset: 700, width: 90, height: 210, doorType: 'einflügelig', hinge: 'left', swingSide: 'a' },
      { id: 'win', kind: 'window', wallId: 'hall_2', offset: 1000, width: 120, height: 100, sillHeight: 90 },
      { id: 'inner', kind: 'window', wallId: 'w_real', offset: 50, width: 120, height: 100, sillHeight: 90 },
    ] as Opening[];
    const plan = reattachHallOpenings(openings, oldHall, newHall);
    // Rechte Wand ist um 4 m gewandert → Tür ohne passende Wand
    expect(plan.remove).toEqual(['door']);
    // Fenster an der unteren Wand bleibt an Ort und Stelle (neuer Offset, gleiche Weltposition)
    expect(plan.update).toHaveLength(1);
    const u = plan.update[0];
    expect(u).toMatchObject({ id: 'win', wallId: 'hall_2' });
    const newBottom = hallWalls(newHall).find((w) => w.id === 'hall_2')!;
    expect(dist(pointOnWall(newBottom, u.offset), pointOnWall(bottom, 1000))).toBeLessThan(1);
    expect(dist(pointOnWall(right, 700), pointOnWall(newBottom, u.offset))).toBeGreaterThan(HALL_OPENING_REATTACH_CM);
    // Öffnungen an echten Wänden sind nicht betroffen
    expect(plan.update.some((x) => x.id === 'inner') || plan.remove.includes('inner')).toBe(false);
    // Unveränderte Halle → keine Änderungen
    const same = reattachHallOpenings(openings, oldHall, oldHall);
    expect(same.update).toHaveLength(0);
    expect(same.remove).toHaveLength(0);
    // Ohne alte Halle sind Hallen-Öffnungen verwaist → entfernen
    expect(reattachHallOpenings(openings, null, newHall).remove.sort()).toEqual(['door', 'win']);
    expect(findWall({ walls: [], hall: newHall }, 'hall_2')).toBeTruthy();
  });
});
