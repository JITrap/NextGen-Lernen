import { describe, it, expect, beforeEach } from 'vitest';
import type { PlacedItem, Wall, Floor, Vec2, Selection } from '@/types';
import type Konva from 'konva';
import {
  marqueeRect, marqueeMode, marqueeSelect, handleAt, groupMembers, mergeSelection, removeFromSelection, isSelected,
  rotationDelta, rotatedItem, scaleFromHandle, normalShift, openingDragTarget, wallsAtNode, isMovableHit, debugDragState, useSelectTool,
  DRAG_THRESHOLD_PX,
} from './selectTool';
import { getTool } from './registry';
import type { ToolContext, ToolEvent } from './types';
import { selectionHandles, type Handle } from '../layers/SelectionLayer';
import { useProjectStore, loadProject, transaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createEmptyProject, createHall, createItemFromDef, createWall, createFloor } from '@/store/factories';
import { getDef } from '@/data/equipment';
import { allWalls } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { snapPoint } from '@/geometry/snap';

function item(id: string, x: number, y: number, width: number, depth: number, rotation = 0, extra: Partial<PlacedItem> = {}): PlacedItem {
  return {
    id, kind: 'equipment', defId: 'atlantis-a301', x, y, rotation, width, depth, height: 150,
    safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: false, ...extra,
  };
}
function wall(id: string, sx: number, sy: number, ex: number, ey: number, thickness = 10): Wall {
  return { id, start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness, type: 'Trockenbau', height: null };
}
function handle(kind: Handle['kind'], id: string, x: number, y: number, r = 6): Handle {
  return { kind, id, index: 0, x, y, r, cursor: 'move' };
}

describe('Marquee', () => {
  const items = [item('a', 100, 100, 50, 50), item('b', 300, 100, 50, 50), item('c', 200, 300, 50, 50, 0, { hidden: true })];
  it('marqueeRect normalisiert die Ecken', () => {
    expect(marqueeRect({ x: 200, y: 50 }, { x: 10, y: 400 })).toEqual({ minX: 10, minY: 50, maxX: 200, maxY: 400 });
  });
  it('von links nach rechts: nur vollständig enthaltene Objekte', () => {
    expect(marqueeMode({ x: 0, y: 0 }, { x: 100, y: 100 })).toBe('contain');
    const rect = marqueeRect({ x: 0, y: 0 }, { x: 200, y: 200 });
    expect(marqueeSelect(rect, items, 'contain')).toEqual(['a']);
    // b nur angeschnitten
    const rect2 = marqueeRect({ x: 0, y: 0 }, { x: 300, y: 200 });
    expect(marqueeSelect(rect2, items, 'contain')).toEqual(['a']);
  });
  it('von rechts nach links: Berührung reicht, versteckte Objekte nie', () => {
    expect(marqueeMode({ x: 300, y: 0 }, { x: 0, y: 200 })).toBe('touch');
    const rect = marqueeRect({ x: 300, y: 0 }, { x: 0, y: 320 });
    expect(marqueeSelect(rect, items, 'touch')).toEqual(['a', 'b']);
  });
  it('leerer Rahmen wählt nichts', () => {
    expect(marqueeSelect({ minX: 100, minY: 100, maxX: 100, maxY: 100 }, items, 'contain')).toEqual([]);
  });
});

describe('Griff-Erkennung', () => {
  it('findet den nächsten Griff innerhalb der Toleranz', () => {
    const hs = [handle('scale', 'a', 0, 0), handle('wallNode', 'w', 100, 0)];
    expect(handleAt({ x: 3, y: 2 }, hs, 4)?.kind).toBe('scale');
    expect(handleAt({ x: 96, y: 1 }, hs, 4)?.id).toBe('w');
    expect(handleAt({ x: 50, y: 0 }, hs, 4)).toBeNull();
  });
  it('Toleranz mindestens 1,5 × Griffradius; Drehgriff gewinnt bei Gleichstand', () => {
    const hs = [handle('scale', 'a', 0, 0, 10), handle('rotate', 'a', 0, 0, 10)];
    expect(handleAt({ x: 14, y: 0 }, hs, 1)?.kind).toBe('rotate');
    expect(handleAt({ x: 16, y: 0 }, hs, 1)).toBeNull();
  });
  it('selectionHandles liefert Skaliergriffe nur für skalierbare Objekte', () => {
    const floor = createFloor();
    const scalable = createItemFromDef(getDef('gen-functional-matte')!, 100, 100);
    const fixed = createItemFromDef(getDef('atlantis-a301')!, 400, 100);
    floor.items = [scalable, fixed];
    const data = { floor, items: floor.items, project: { customEquipment: [] } };
    const hs1 = selectionHandles([{ kind: 'item', id: scalable.id }], data, 1);
    expect(hs1.filter((h) => h.kind === 'scale')).toHaveLength(8);
    expect(hs1.some((h) => h.kind === 'rotate')).toBe(true);
    const hs2 = selectionHandles([{ kind: 'item', id: fixed.id }], data, 1);
    expect(hs2.filter((h) => h.kind === 'scale')).toHaveLength(0);
    expect(hs2.some((h) => h.kind === 'rotate')).toBe(true);
    // gesperrt: kein Drehgriff
    floor.items = [{ ...fixed, locked: true }];
    expect(selectionHandles([{ kind: 'item', id: fixed.id }], { ...data, items: floor.items }, 1)).toHaveLength(0);
  });
});

describe('Auswahl-Helfer', () => {
  it('groupMembers liefert alle sichtbaren Gruppenmitglieder', () => {
    const items = [item('a', 0, 0, 10, 10, 0, { groupId: 'g1' }), item('b', 50, 0, 10, 10, 0, { groupId: 'g1' }), item('c', 90, 0, 10, 10, 0, { groupId: 'g1', hidden: true }), item('d', 200, 0, 10, 10)];
    const floor = { groups: [{ id: 'g1', itemIds: ['a', 'b', 'c'] }] };
    expect(groupMembers('a', floor, items).map((s) => s.id)).toEqual(['a', 'b']);
    expect(groupMembers('d', floor, items)).toEqual([{ kind: 'item', id: 'd' }]);
    expect(groupMembers('zzz', floor, items)).toEqual([{ kind: 'item', id: 'zzz' }]);
  });
  it('mergeSelection/removeFromSelection ohne Duplikate', () => {
    const cur: Selection[] = [{ kind: 'item', id: 'a' }];
    const merged = mergeSelection(cur, [{ kind: 'item', id: 'a' }, { kind: 'wall', id: 'w' }]);
    expect(merged).toHaveLength(2);
    expect(isSelected(merged, { kind: 'wall', id: 'w' })).toBe(true);
    expect(removeFromSelection(merged, { kind: 'item', id: 'a' })).toEqual([{ kind: 'wall', id: 'w' }]);
  });
  it('isMovableHit respektiert Sperren', () => {
    const floor = createFloor();
    floor.walls = [wall('w', 0, 0, 100, 0), { ...wall('wl', 0, 50, 100, 50), locked: true }];
    const items = [item('a', 0, 0, 10, 10), item('b', 0, 0, 10, 10, 0, { locked: true })];
    expect(isMovableHit({ kind: 'item', id: 'a' }, floor, items)).toBe(true);
    expect(isMovableHit({ kind: 'item', id: 'b' }, floor, items)).toBe(false);
    expect(isMovableHit({ kind: 'wall', id: 'w' }, floor, items)).toBe(true);
    expect(isMovableHit({ kind: 'wall', id: 'wl' }, floor, items)).toBe(false);
    expect(isMovableHit({ kind: 'room', id: 'r' }, floor, items)).toBe(false);
    expect(isMovableHit({ kind: 'hallEdge', id: '0' }, floor, items)).toBe(true);
  });
});

describe('Drehen / Skalieren / Verschieben (rein)', () => {
  it('rotationDelta rastert auf 15°, Shift frei', () => {
    const c = { x: 0, y: 0 };
    expect(rotationDelta(c, { x: 100, y: 0 }, { x: 0, y: 100 }, true)).toBe(90);
    expect(rotationDelta(c, { x: 100, y: 0 }, { x: 100, y: 12 }, true)).toBe(0);
    expect(rotationDelta(c, { x: 100, y: 0 }, { x: 100, y: 30 }, true)).toBe(15);
    expect(rotationDelta(c, { x: 100, y: 0 }, { x: 100, y: 30 }, false)).toBeCloseTo(16.699, 2);
    expect(rotationDelta(c, { x: 100, y: 0 }, { x: -100, y: -1 }, true)).toBe(-180);
  });
  it('rotatedItem dreht Position um das Zentrum und addiert die Drehung', () => {
    const r = rotatedItem({ x: 100, y: 0, rotation: 350 }, { x: 0, y: 0 }, 90);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(100);
    expect(r.rotation).toBe(80);
  });
  it('scaleFromHandle hält die gegenüberliegende Kante fest', () => {
    const o = { x: 100, y: 100, width: 100, depth: 60, rotation: 0 };
    // rechte Kante (sx=1) auf lokal x=70 ziehen → Breite 120, linke Kante bleibt bei x=50
    const r = scaleFromHandle(o, 1, 0, { x: 70, y: 0 });
    expect(r.width).toBe(120);
    expect(r.depth).toBe(60);
    expect(r.x - r.width / 2).toBeCloseTo(50);
    // Ecke oben-links (sx=-1, sy=-1) mit Raster
    const c = scaleFromHandle(o, -1, -1, { x: -63, y: -47 }, 10, 10);
    expect(c.width).toBe(110);
    expect(c.depth).toBe(80);
    expect(c.x + c.width / 2).toBeCloseTo(150);
    expect(c.y + c.depth / 2).toBeCloseTo(130);
    // Mindestmaß
    expect(scaleFromHandle(o, 1, 0, { x: -200, y: 0 }).width).toBe(10);
  });
  it('scaleFromHandle bei gedrehtem Objekt bleibt konsistent', () => {
    const o = { x: 0, y: 0, width: 100, depth: 50, rotation: 90 };
    const r = scaleFromHandle(o, 0, 1, { x: 0, y: 45 });
    expect(r.depth).toBe(70);
    expect(r.rotation).toBe(90);
    // lokal +y zeigt bei 90° nach Welt −x → Zentrum wandert um 10 nach −x
    expect(r.x).toBeCloseTo(-10);
    expect(r.y).toBeCloseTo(0);
  });
  it('normalShift projiziert auf die Kantennormale', () => {
    const s = normalShift({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 30, y: 20 });
    expect(s.x).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(20);
    const d = normalShift({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 4 });
    expect(d).toEqual({ x: 3, y: 4 });
  });
});

describe('Öffnungen und Wandknoten', () => {
  const walls = [wall('w1', 0, 0, 400, 0), wall('w2', 0, 100, 400, 100), wall('w3', 400, 0, 400, 300)];
  it('bleibt auf der eigenen Wand und begrenzt den Offset', () => {
    const t = openingDragTarget({ x: 250, y: 12 }, { wallId: 'w1', width: 90 }, walls)!;
    expect(t.wallId).toBe('w1');
    expect(t.offset).toBe(250);
    expect(openingDragTarget({ x: 395, y: 5 }, { wallId: 'w1', width: 90 }, walls)!.offset).toBe(355);
  });
  it('hängt auf die nächste Wand um, wenn weit genug entfernt', () => {
    const t = openingDragTarget({ x: 200, y: 95 }, { wallId: 'w1', width: 90 }, walls)!;
    expect(t.wallId).toBe('w2');
    expect(t.offset).toBe(200);
    // weit weg von allem: bleibt auf der eigenen Wand (Offset projiziert)
    const far = openingDragTarget({ x: 200, y: 60 }, { wallId: 'w1', width: 90 }, walls)!;
    expect(far.wallId).toBe('w1');
  });
  it('wallsAtNode findet alle Wände am Knoten', () => {
    expect([...wallsAtNode(walls, { x: 400, y: 0 })].sort()).toEqual(['w1', 'w3']);
    expect(wallsAtNode(walls, { x: 200, y: 50 }).size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Integration: Werkzeug mit Store                                      */
/* ------------------------------------------------------------------ */

/** Räume (Halle/Wandzüge/Zonen) im Kontext mitgeben – Standard aus, damit Klicks „ins Leere“ keinen Raum treffen. */
let withRooms = false;
function mkCtx(): ToolContext {
  const project = useProjectStore.getState().project;
  const floor: Floor = project.floors.find((f) => f.id === project.activeFloorId) ?? project.floors[0];
  const walls = allWalls(floor);
  return {
    project,
    floor,
    walls,
    rooms: withRooms ? floorRooms(floor) : [],
    items: floor.items,
    viewport: { scale: 1, x: 0, y: 0 },
    store: useProjectStore.getState(),
    ui: useUiStore.getState(),
    snap: (p, o) => snapPoint(p, { gridSize: project.settings.gridSize, enabled: project.settings.snapEnabled, threshold: 8, walls, items: floor.items, hall: floor.hall, ...o }),
    pxToWorld: (px) => px,
    stageSize: { width: 800, height: 600 },
  };
}
function ev(x: number, y: number, extra: Partial<ToolEvent> = {}): ToolEvent {
  return {
    world: { x, y }, screen: { x, y }, shift: false, alt: false, ctrl: false, meta: false, button: 0, pointerType: 'mouse',
    evt: {} as Konva.KonvaEventObject<PointerEvent>, target: {} as Konva.Node, ...extra,
  };
}
const tool = () => getTool('select')!;
function down(x: number, y: number, extra?: Partial<ToolEvent>) { tool().onPointerDown!(ev(x, y, extra), mkCtx()); }
function move(x: number, y: number, extra?: Partial<ToolEvent>) { tool().onPointerMove!(ev(x, y, extra), mkCtx()); }
function up(x: number, y: number, extra?: Partial<ToolEvent>) { tool().onPointerUp!(ev(x, y, extra), mkCtx()); }
const sel = () => useUiStore.getState().selection;
const floorNow = () => mkCtx().floor;
const historyLen = () => useProjectStore.temporal.getState().pastStates.length;

describe('Auswahl-Werkzeug (Integration)', () => {
  let a: PlacedItem;
  let b: PlacedItem;
  beforeEach(() => {
    const p = createEmptyProject('Test');
    const f = p.floors[0];
    f.hall = createHall(2000, 1500);
    p.settings.snapEnabled = false;
    a = createItemFromDef(getDef('atlantis-a301')!, 500, 500);
    b = createItemFromDef(getDef('atlantis-b157')!, 1000, 500);
    f.items = [a, b];
    f.walls = [createWall({ id: 'w1', start: { x: 300, y: 900 }, end: { x: 900, y: 900 } })];
    loadProject(p);
    withRooms = false;
    useUiStore.getState().clearSelection();
    useSelectTool.getState().reset();
    tool().onCancel?.(mkCtx());
  });

  it('Klick wählt aus, Klick ins Leere leert, Shift+Klick ist additiv', () => {
    down(500, 500); up(500, 500);
    expect(sel()).toEqual([{ kind: 'item', id: a.id }]);
    down(1000, 500, { shift: true }); up(1000, 500, { shift: true });
    expect(sel().map((s) => s.id)).toEqual([a.id, b.id]);
    // Shift+Klick auf gewähltes Element ohne Bewegung → abwählen
    down(500, 500, { shift: true }); up(500, 500, { shift: true });
    expect(sel().map((s) => s.id)).toEqual([b.id]);
    down(1500, 1200); up(1500, 1200);
    expect(sel()).toEqual([]);
  });

  it('Ziehen verschiebt das Objekt in genau einem Undo-Schritt, unter der Schwelle passiert nichts', () => {
    // Referenz: so viele Historieneinträge erzeugt der Store für eine einzelne Transaktion
    const ref0 = historyLen();
    transaction(() => useProjectStore.getState().renameFloor(floorNow().id, 'Ref'));
    const perTransaction = historyLen() - ref0;
    const before = historyLen();
    down(500, 500);
    move(500 + DRAG_THRESHOLD_PX - 1, 500);
    expect(debugDragState()?.active).toBe(false);
    expect(floorNow().items[0].x).toBe(500);
    move(560, 540);
    expect(debugDragState()?.active).toBe(true);
    move(600, 580);
    expect(floorNow().items[0].x).toBe(600);
    expect(floorNow().items[0].y).toBe(580);
    up(600, 580);
    expect(debugDragState()).toBeNull();
    expect(floorNow().items[0]).toMatchObject({ x: 600, y: 580 });
    expect(historyLen()).toBe(before + perTransaction);
    useProjectStore.temporal.getState().undo();
    expect(floorNow().items[0]).toMatchObject({ x: 500, y: 500 });
  });

  it('gesperrte Objekte werden nicht verschoben', () => {
    useProjectStore.getState().updateItem(floorNow().id, a.id, { locked: true });
    down(500, 500); move(600, 600); up(600, 600);
    expect(floorNow().items[0]).toMatchObject({ x: 500, y: 500 });
    expect(sel()).toEqual([{ kind: 'item', id: a.id }]);
  });

  it('Rahmen wählt vollständig enthaltene Objekte, Berührung von rechts nach links', () => {
    down(300, 300); move(1100, 700); up(1100, 700);
    expect(sel().map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    down(300, 300); move(960, 700); up(960, 700); // b nur angeschnitten
    expect(sel().map((s) => s.id)).toEqual([a.id]);
    down(960, 700); move(300, 300); up(300, 300); // von rechts nach links
    expect(sel().map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('Klick auf Gruppenmitglied wählt die Gruppe, Doppelklick nur das Element', () => {
    useProjectStore.getState().groupItems(floorNow().id, [a.id, b.id]);
    down(500, 500); up(500, 500);
    expect(sel().map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    down(500, 500); up(500, 500); // zweiter Klick des Doppelklicks
    tool().onDoubleClick!(ev(500, 500), mkCtx());
    expect(sel()).toEqual([{ kind: 'item', id: a.id }]);
    expect(useUiStore.getState().rightPanel).toBe('properties');
  });

  it('Wand parallel verschieben und Esc bricht das Ziehen ab', () => {
    down(600, 900); move(600, 950); move(600, 1000);
    expect(floorNow().walls[0].start.y).toBe(1000);
    expect(floorNow().walls[0].end.y).toBe(1000);
    expect(floorNow().walls[0].start.x).toBe(300);
    const handled = tool().onKeyDown!(new KeyboardEvent('keydown', { key: 'Escape' }), mkCtx());
    expect(handled).toBe(true);
    expect(floorNow().walls[0].start.y).toBe(900);
    expect(debugDragState()).toBeNull();
  });

  it('Hallen-Eckpunkt ziehen ändert das Polygon', () => {
    down(0, 0); move(30, 40); move(-50, -60); up(-50, -60);
    expect(floorNow().hall!.polygon[0]).toEqual({ x: -50, y: -60 });
  });

  it('Doppelklick auf Hallenkante öffnet die Längeneingabe', () => {
    down(1000, 0); up(1000, 0);
    down(1000, 0); up(1000, 0);
    tool().onDoubleClick!(ev(1000, 0), mkCtx());
    const li = useSelectTool.getState().lengthInput;
    expect(li?.kind).toBe('hallEdge');
    expect(li?.id).toBe('0');
    expect(li?.initial).toBe('2000');
  });

  it('Doppelklick nur bei zwei Klicks an (fast) derselben Stelle und nie mit Shift (F2)', () => {
    useUiStore.getState().setRightPanel('library');
    // Klick a, schneller Shift+Klick b (< 400 ms → Konva-dblclick): Auswahl bleibt additiv
    down(500, 500); up(500, 500);
    down(1000, 500, { shift: true }); up(1000, 500, { shift: true });
    tool().onDoubleClick!(ev(1000, 500, { shift: true }), mkCtx());
    expect(sel().map((s) => s.id)).toEqual([a.id, b.id]);
    expect(useUiStore.getState().rightPanel).toBe('library');
    // Zwei schnelle Klicks an verschiedenen Stellen (ohne Shift) sind kein Doppelklick
    down(500, 500); up(500, 500);
    down(1000, 500); up(1000, 500);
    tool().onDoubleClick!(ev(1000, 500), mkCtx());
    expect(sel()).toEqual([{ kind: 'item', id: b.id }]);
    expect(useUiStore.getState().rightPanel).toBe('library');
    // Zweiter Klick 4 px daneben: echter Doppelklick → Eigenschaften
    down(1000, 500); up(1000, 500);
    down(1004, 500); up(1004, 500);
    tool().onDoubleClick!(ev(1004, 500), mkCtx());
    expect(useUiStore.getState().rightPanel).toBe('properties');
  });

  it('Rahmenauswahl startet auch auf dem Auto-Raum der Halle; Klick ohne Bewegung wählt den Raum (F1)', () => {
    withRooms = true;
    const room = mkCtx().rooms.find((r) => r.source === 'auto');
    expect(room).toBeTruthy();
    // Ziehen auf freier Hallenfläche → Rahmen, wählt die enthaltenen Objekte, keine Raumauswahl
    down(300, 300);
    expect(debugDragState()?.mode).toBe('marquee');
    move(700, 500); move(1100, 700); up(1100, 700);
    expect(sel().map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    // Klick ohne Bewegung → Raum
    down(300, 300); up(300, 300);
    expect(sel()).toEqual([{ kind: 'room', id: room!.id }]);
    // Bewegung unter der Schwelle zählt als Klick
    down(1500, 1200); move(1500 + DRAG_THRESHOLD_PX - 1, 1200); up(1500 + DRAG_THRESHOLD_PX - 1, 1200);
    expect(sel()).toEqual([{ kind: 'room', id: room!.id }]);
    // Shift+Rahmen ergänzt, Shift+Klick auf den gewählten Raum wählt ihn ab
    down(300, 300, { shift: true }); move(1100, 700, { shift: true }); up(1100, 700, { shift: true });
    expect(sel().map((s) => s.id)).toEqual([room!.id, a.id, b.id]);
    down(300, 300, { shift: true }); up(300, 300, { shift: true });
    expect(sel().map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it('gesperrte Zone: Ziehen zieht einen Rahmen auf, entsperrte Zone wird verschoben', () => {
    withRooms = true;
    const fid = floorNow().id;
    const poly = [{ x: 300, y: 300 }, { x: 1200, y: 300 }, { x: 1200, y: 700 }, { x: 300, y: 700 }];
    useProjectStore.getState().addZone(fid, { id: 'z1', name: 'Zone', type: 'Sonstiges', polygon: poly, locked: true });
    down(320, 320);
    expect(debugDragState()?.mode).toBe('marquee');
    move(1100, 650); up(1100, 650);
    expect(sel().map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    down(320, 320); up(320, 320);
    expect(sel()).toEqual([{ kind: 'zone', id: 'z1' }]);
    useProjectStore.getState().updateZone(fid, 'z1', { locked: false });
    down(320, 320);
    expect(debugDragState()?.mode).toBe('move');
    up(320, 320);
  });

  it('Koordinaten werden beim Loslassen auf 4 Nachkommastellen gerundet (ein Undo-Schritt)', () => {
    const ref0 = historyLen();
    transaction(() => useProjectStore.getState().renameFloor(floorNow().id, 'Ref'));
    const perTransaction = historyLen() - ref0;
    const before = historyLen();
    down(500, 500); move(560, 540); move(600.00000000001, 580.123456789); up(600.00000000001, 580.123456789);
    expect(floorNow().items[0]).toMatchObject({ x: 600, y: 580.1235 });
    expect(historyLen()).toBe(before + perTransaction);
    // Freies Drehen zweier Objekte (Shift): Positionen/Winkel ohne Gleitkomma-Rauschen
    useUiStore.getState().setSelection([{ kind: 'item', id: a.id }, { kind: 'item', id: b.id }]);
    const rot = selectionHandles(sel(), { floor: floorNow(), items: floorNow().items, project: mkCtx().project }, 1).find((h) => h.kind === 'rotate')!;
    down(rot.x, rot.y); move(rot.x + 30, rot.y + 17, { shift: true }); move(rot.x + 33, rot.y + 21, { shift: true }); up(rot.x + 33, rot.y + 21, { shift: true });
    for (const it of floorNow().items) {
      for (const v of [it.x, it.y, it.rotation]) expect(Math.abs(v * 1e4 - Math.round(v * 1e4))).toBeLessThan(1e-6);
    }
  });

  it('Hover setzt die ID nur für Objekte', () => {
    move(500, 500);
    expect(useUiStore.getState().hoverId).toBe(a.id);
    expect(useSelectTool.getState().cursor).toBe('move');
    move(1500, 1300);
    expect(useUiStore.getState().hoverId).toBeNull();
    expect(useSelectTool.getState().cursor).toBe('default');
  });
});

describe('Import-Rauchtest', () => {
  it('Werkzeug ist registriert', () => {
    expect(getTool('select')?.id).toBe('select');
    const v: Vec2 = { x: 1, y: 2 };
    expect(marqueeRect(v, v)).toEqual({ minX: 1, minY: 2, maxX: 1, maxY: 2 });
  });
});

describe('Zieh-Vorgang robust beenden (H1/H2)', () => {
  let a: PlacedItem;
  beforeEach(() => {
    const p = createEmptyProject('Test');
    const f = p.floors[0];
    f.hall = createHall(2000, 1500);
    p.settings.snapEnabled = false;
    a = createItemFromDef(getDef('atlantis-a301')!, 500, 500);
    f.items = [a];
    loadProject(p);
    useUiStore.getState().clearSelection();
    useSelectTool.getState().reset();
    tool().onCancel?.(mkCtx());
  });

  it('setzt das zentrale ui.dragging-Flag während der Transaktion', () => {
    expect(useUiStore.getState().dragging).toBe(false);
    down(500, 500);
    move(560, 540);
    expect(debugDragState()?.active).toBe(true);
    expect(useUiStore.getState().dragging).toBe(true);
    up(560, 540);
    expect(useUiStore.getState().dragging).toBe(false);
    expect(debugDragState()).toBeNull();
  });

  it('Bewegung ohne gedrückte Taste (buttons = 0) schließt das Ziehen mit dem letzten Stand ab – ein Undo-Schritt', () => {
    const before = historyLen();
    down(500, 500);
    move(560, 540);
    move(600, 580);
    expect(floorNow().items[0]).toMatchObject({ x: 600, y: 580 });
    // Loslassen kam nicht an (z. B. außerhalb des Fensters); nächste Bewegung meldet buttons = 0
    move(700, 700, { buttons: 0 });
    expect(debugDragState()).toBeNull();
    expect(useUiStore.getState().dragging).toBe(false);
    expect(useProjectStore.temporal.getState().isTracking).toBe(true);
    // Objekt folgt dem Zeiger nicht weiter, Stand von vor dem Loslassen bleibt
    expect(floorNow().items[0]).toMatchObject({ x: 600, y: 580 });
    expect(historyLen()).toBeGreaterThan(before);
    // Spätere Änderungen laufen wieder in eigene Undo-Schritte
    const mid = historyLen();
    transaction(() => useProjectStore.getState().renameFloor(floorNow().id, 'Danach'));
    expect(historyLen()).toBeGreaterThan(mid);
    // Esc verwirft nichts mehr (kein offener Zieh-Vorgang)
    tool().onKeyDown!(new KeyboardEvent('keydown', { key: 'Escape' }), mkCtx());
    expect(floorNow().name).toBe('Danach');
    expect(floorNow().items[0]).toMatchObject({ x: 600, y: 580 });
  });

  it('buttons = undefined (Touch/unbekannt) beendet das Ziehen nicht', () => {
    down(500, 500);
    move(560, 540);
    move(600, 580, { pointerType: 'touch' });
    expect(debugDragState()?.active).toBe(true);
    up(600, 580, { pointerType: 'touch' });
    expect(debugDragState()).toBeNull();
  });

  it('onCancel (Unmount des Canvas) schließt die Transaktion und setzt das Flag zurück', () => {
    down(500, 500);
    move(560, 540);
    expect(useProjectStore.temporal.getState().isTracking).toBe(false);
    tool().onCancel!(mkCtx());
    expect(debugDragState()).toBeNull();
    expect(useUiStore.getState().dragging).toBe(false);
    expect(useProjectStore.temporal.getState().isTracking).toBe(true);
    // Abbruch stellt den Ausgangszustand wieder her
    expect(floorNow().items[0]).toMatchObject({ x: 500, y: 500 });
  });
});
