import { describe, it, expect, beforeEach } from 'vitest';
import type { PlacedItem, Floor, Opening } from '@/types';
import {
  deleteSelection, duplicateSelection, copySelection, pasteClipboard, rotateSelection, nudgeSelection, flipSelection,
  groupSelection, ungroupSelection, toggleLockSelection, toggleHideSelection, alignSelection, alignOffsets, selectAll,
  splitWallAtPoint, setWallLength, hallPolygonWithEdgeLength, setHallEdgeLength, setItemSize, setItemRotation, setItemPosition,
  selectionBounds, movablesOf, hallOpeningsAfterVertexRemoval, HALL_OPENING_REMAP_MAX_CM,
} from './actions';
import { hallWalls, pointOnWall } from '@/geometry/walls';
import { distance } from '@/geometry/polygon';
import { useProjectStore, loadProject } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createEmptyProject, createHall, createItemFromDef, createWall } from '@/store/factories';
import { getDef } from '@/data/equipment';

const floor = (): Floor => {
  const p = useProjectStore.getState().project;
  return p.floors.find((f) => f.id === p.activeFloorId) ?? p.floors[0];
};
const sel = () => useUiStore.getState().selection;
const selectItems = (...ids: string[]) => useUiStore.getState().setSelection(ids.map((id) => ({ kind: 'item', id })));
const itemById = (id: string) => floor().items.find((i) => i.id === id)!;
const undo = () => useProjectStore.temporal.getState().undo();

let a: PlacedItem;
let b: PlacedItem;
let c: PlacedItem;

beforeEach(() => {
  const p = createEmptyProject('Test');
  const f = p.floors[0];
  f.hall = createHall(2000, 1500);
  p.settings.snapEnabled = false;
  // a: 100 × 100 bei (200,200); b: 200 × 100 bei (600,200); c: 100 × 100 bei (1500,200)
  a = createItemFromDef(getDef('gen-functional-matte')!, 200, 200, { id: 'a', width: 100, depth: 100 });
  b = createItemFromDef(getDef('gen-functional-matte')!, 600, 200, { id: 'b', width: 200, depth: 100 });
  c = createItemFromDef(getDef('gen-functional-matte')!, 1500, 200, { id: 'c', width: 100, depth: 100 });
  f.items = [a, b, c];
  f.walls = [createWall({ id: 'w1', start: { x: 100, y: 800 }, end: { x: 700, y: 800 } }), createWall({ id: 'w2', start: { x: 700, y: 800 }, end: { x: 700, y: 1200 } })];
  f.openings = [{ id: 'o1', kind: 'door', wallId: 'w1', offset: 450, width: 90, height: 210, doorType: 'einflügelig', hinge: 'left', swingSide: 'a' }];
  loadProject(p);
  useUiStore.getState().clearSelection();
  useUiStore.getState().setClipboard(null);
  useUiStore.getState().setCursorWorld(null);
});

describe('Duplizieren / Kopieren / Einfügen', () => {
  it('duplicate erzeugt neue IDs mit Versatz +50/+50 und wählt die Kopien', () => {
    selectItems('a', 'b');
    duplicateSelection();
    expect(floor().items).toHaveLength(5);
    const copies = sel().map((s) => itemById(s.id));
    expect(copies).toHaveLength(2);
    expect(copies.every((it) => it.id !== 'a' && it.id !== 'b')).toBe(true);
    const ca = copies.find((it) => it.defId === a.defId && it.width === 100)!;
    expect(ca).toMatchObject({ x: 250, y: 250 });
    const cb = copies.find((it) => it.width === 200)!;
    expect(cb).toMatchObject({ x: 650, y: 250 });
    // Original unverändert
    expect(itemById('a')).toMatchObject({ x: 200, y: 200 });
    undo();
    expect(floor().items).toHaveLength(3);
  });
  it('duplicate kopiert Gruppen mit', () => {
    useProjectStore.getState().groupItems(floor().id, ['a', 'b']);
    selectItems('a', 'b');
    duplicateSelection();
    expect(floor().groups).toHaveLength(2);
    const copyIds = sel().map((s) => s.id);
    const g = floor().groups.find((x) => x.itemIds.every((id) => copyIds.includes(id)))!;
    expect(g).toBeTruthy();
    expect(g.itemIds).toHaveLength(2);
    for (const id of copyIds) expect(itemById(id).groupId).toBe(g.id);
  });
  it('paste fügt an der Cursorposition zentriert ein, mehrfach mit Versatz', () => {
    selectItems('a');
    copySelection();
    expect(useUiStore.getState().clipboard).toHaveLength(1);
    useUiStore.getState().setCursorWorld({ x: 1000, y: 1000 });
    pasteClipboard();
    let pasted = itemById(sel()[0].id);
    expect(pasted.id).not.toBe('a');
    expect(pasted).toMatchObject({ x: 1000, y: 1000 });
    pasteClipboard();
    pasted = itemById(sel()[0].id);
    expect(pasted).toMatchObject({ x: 1050, y: 1050 });
    expect(floor().items).toHaveLength(5);
  });
  it('paste ohne Cursor versetzt um +50/+50, explizite Zielposition hat Vorrang', () => {
    selectItems('a');
    copySelection();
    pasteClipboard();
    expect(itemById(sel()[0].id)).toMatchObject({ x: 250, y: 250 });
    pasteClipboard({ x: 700, y: 700 });
    expect(itemById(sel()[0].id)).toMatchObject({ x: 700, y: 700 });
  });
});

describe('Ausrichten / Verteilen', () => {
  it('alignOffsets left richtet an minX aus', () => {
    const boxes = [
      { minX: 100, minY: 0, maxX: 200, maxY: 50 },
      { minX: 300, minY: 100, maxX: 350, maxY: 150 },
    ];
    expect(alignOffsets(boxes, 'left')).toEqual([{ x: 0, y: 0 }, { x: -200, y: 0 }]);
    expect(alignOffsets(boxes, 'right')).toEqual([{ x: 150, y: 0 }, { x: 0, y: 0 }]);
    expect(alignOffsets(boxes, 'top')).toEqual([{ x: 0, y: 0 }, { x: 0, y: -100 }]);
    expect(alignOffsets(boxes, 'centerY')).toEqual([{ x: 0, y: 50 }, { x: 0, y: -50 }]);
    expect(alignOffsets([boxes[0]], 'left')).toEqual([{ x: 0, y: 0 }]);
  });
  it('align left richtet die Auswahl an der linken Kante aus (ein Undo-Schritt)', () => {
    selectItems('a', 'b', 'c');
    alignSelection('left');
    // linke Kante von a = 150 → alle bei minX 150
    expect(itemById('a').x - 50).toBe(150);
    expect(itemById('b').x - 100).toBe(150);
    expect(itemById('c').x - 50).toBe(150);
    undo();
    expect(itemById('b').x).toBe(600);
  });
  it('distributeX verteilt gleichmäßig nach Bounding-Boxen', () => {
    selectItems('a', 'b', 'c');
    alignSelection('distributeX');
    // Spanne 150 … 1550, Breiten 100+200+100 → Lücke (1400 − 400) / 2 = 500
    expect(itemById('a').x - 50).toBe(150);
    expect(itemById('b').x - 100).toBe(750);
    expect(itemById('c').x - 50).toBe(1450);
    expect(itemById('c').x + 50).toBe(1550);
  });
  it('distributeY mit weniger als 3 Elementen ändert nichts', () => {
    selectItems('a', 'b');
    alignSelection('distributeY');
    expect(itemById('a')).toMatchObject({ x: 200, y: 200 });
    expect(itemById('b')).toMatchObject({ x: 600, y: 200 });
  });
});

describe('Drehen / Verschieben / Spiegeln', () => {
  it('rotate 90 dreht zwei Objekte um das gemeinsame Zentrum', () => {
    selectItems('a', 'b');
    rotateSelection(90);
    // Bounding-Box: x 150…700, y 150…250 → Zentrum (425, 200)
    const ra = itemById('a');
    const rb = itemById('b');
    expect(ra.x).toBeCloseTo(425);
    expect(ra.y).toBeCloseTo(200 - 225);
    expect(rb.x).toBeCloseTo(425);
    expect(rb.y).toBeCloseTo(200 + 175);
    expect(ra.rotation).toBe(90);
    expect(rb.rotation).toBe(90);
    undo();
    expect(itemById('a')).toMatchObject({ x: 200, y: 200, rotation: 0 });
  });
  it('rotate bei Einzelobjekt dreht um den eigenen Mittelpunkt, normalisiert', () => {
    selectItems('a');
    rotateSelection(-90);
    expect(itemById('a')).toMatchObject({ x: 200, y: 200, rotation: 270 });
    rotateSelection(90);
    expect(itemById('a').rotation).toBe(0);
  });
  it('nudge verschiebt Objekte, nicht Wände', () => {
    useUiStore.getState().setSelection([{ kind: 'item', id: 'a' }, { kind: 'wall', id: 'w1' }]);
    nudgeSelection(10, -1);
    expect(itemById('a')).toMatchObject({ x: 210, y: 199 });
    expect(floor().walls[0].start).toEqual({ x: 100, y: 800 });
  });
  it('flip x spiegelt Positionen um das Zentrum und die Drehung', () => {
    selectItems('a', 'b');
    flipSelection('x');
    // Zentrum x = 425 → a: 650, b: 250
    expect(itemById('a').x).toBeCloseTo(650);
    expect(itemById('b').x).toBeCloseTo(250);
    // Einzelobjekt: Position bleibt, Drehung wird gespiegelt
    useProjectStore.getState().updateItem(floor().id, 'a', { rotation: 30 });
    selectItems('a');
    flipSelection('x');
    expect(itemById('a').x).toBeCloseTo(650);
    expect(itemById('a').rotation).toBe(330);
    flipSelection('y');
    expect(itemById('a').rotation).toBe(210);
  });
  it('gesperrte Objekte bleiben beim Drehen/Verschieben unverändert', () => {
    useProjectStore.getState().updateItem(floor().id, 'a', { locked: true });
    selectItems('a', 'b');
    nudgeSelection(100, 0);
    expect(itemById('a').x).toBe(200);
    expect(itemById('b').x).toBe(700);
  });
});

describe('Gruppen, Sperren, Ausblenden, Löschen', () => {
  it('group/ungroup', () => {
    selectItems('a', 'b');
    groupSelection();
    expect(floor().groups).toHaveLength(1);
    const gid = floor().groups[0].id;
    expect(itemById('a').groupId).toBe(gid);
    expect(itemById('b').groupId).toBe(gid);
    ungroupSelection();
    expect(floor().groups).toHaveLength(0);
    expect(itemById('a').groupId).toBeUndefined();
    undo();
    expect(floor().groups).toHaveLength(1);
  });
  it('group mit weniger als zwei Objekten tut nichts', () => {
    selectItems('a');
    groupSelection();
    expect(floor().groups).toHaveLength(0);
  });
  it('delete respektiert locked und behält gesperrte in der Auswahl', () => {
    useProjectStore.getState().updateItem(floor().id, 'a', { locked: true });
    selectItems('a', 'b');
    deleteSelection();
    expect(floor().items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(sel()).toEqual([{ kind: 'item', id: 'a' }]);
    undo();
    expect(floor().items).toHaveLength(3);
  });
  it('delete entfernt Wände samt Öffnungen', () => {
    useUiStore.getState().setSelection([{ kind: 'wall', id: 'w1' }]);
    deleteSelection();
    expect(floor().walls.map((w) => w.id)).toEqual(['w2']);
    expect(floor().openings).toHaveLength(0);
  });
  it('toggleLock / toggleHide', () => {
    selectItems('a', 'b');
    toggleLockSelection();
    expect(itemById('a').locked).toBe(true);
    expect(itemById('b').locked).toBe(true);
    toggleLockSelection();
    expect(itemById('a').locked).toBe(false);
    toggleHideSelection();
    expect(itemById('a').hidden).toBe(true);
    expect(sel()).toEqual([]);
  });
  it('selectAll wählt alle sichtbaren Objekte', () => {
    useProjectStore.getState().updateItem(floor().id, 'c', { hidden: true });
    selectAll();
    expect(sel().map((s) => s.id).sort()).toEqual(['a', 'b']);
  });
});

describe('Wände und Halle', () => {
  it('splitWallAtPoint teilt die Wand und verteilt Öffnungen', () => {
    const newId = splitWallAtPoint('w1', { x: 400, y: 805 });
    expect(newId).toBeTruthy();
    const w1 = floor().walls.find((w) => w.id === 'w1')!;
    const w1b = floor().walls.find((w) => w.id === newId)!;
    expect(w1.end).toEqual({ x: 400, y: 800 });
    expect(w1b.start).toEqual({ x: 400, y: 800 });
    expect(w1b.end).toEqual({ x: 700, y: 800 });
    // Tür bei Offset 450 liegt auf der zweiten Hälfte (Offset 150)
    const o = floor().openings[0];
    expect(o.wallId).toBe(newId);
    expect(o.offset).toBe(150);
    undo();
    expect(floor().walls).toHaveLength(2);
    expect(floor().openings[0].wallId).toBe('w1');
  });
  it('splitWallAtPoint lehnt Hallenwände, gesperrte Wände und Endpunkte ab', () => {
    expect(splitWallAtPoint('hall_0', { x: 100, y: 0 })).toBeNull();
    expect(splitWallAtPoint('w1', { x: 100, y: 800 })).toBeNull();
    useProjectStore.getState().updateWall(floor().id, 'w1', { locked: true });
    expect(splitWallAtPoint('w1', { x: 400, y: 800 })).toBeNull();
  });
  it('setWallLength verschiebt den Endpunkt entlang der Wand, Nachbarn folgen, Öffnungen bleiben gültig', () => {
    expect(setWallLength('w1', 500)).toBe(true);
    const w1 = floor().walls.find((w) => w.id === 'w1')!;
    const w2 = floor().walls.find((w) => w.id === 'w2')!;
    expect(w1.end).toEqual({ x: 600, y: 800 });
    expect(w2.start).toEqual({ x: 600, y: 800 });
    expect(floor().openings[0].offset).toBe(450);
    expect(setWallLength('w1', 300)).toBe(true);
    // Tür (Breite 90) auf 300 cm Wand: Offset auf 255 begrenzt
    expect(floor().openings[0].offset).toBe(255);
    expect(setWallLength('w1', 0)).toBe(false);
  });
  it('hallPolygonWithEdgeLength verlängert eine Rechteckkante und zieht die Ecken dahinter mit', () => {
    const poly = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1500 }, { x: 0, y: 1500 }];
    const next = hallPolygonWithEdgeLength(poly, 0, 2500)!;
    expect(next).toEqual([{ x: 0, y: 0 }, { x: 2500, y: 0 }, { x: 2500, y: 1500 }, { x: 0, y: 1500 }]);
    expect(hallPolygonWithEdgeLength(poly, 9, 100)).toBeNull();
    expect(hallPolygonWithEdgeLength(poly, 0, 0)).toBeNull();
    expect(setHallEdgeLength(1, 1000)).toBe(true);
    expect(floor().hall!.polygon[2]).toEqual({ x: 2000, y: 1000 });
    expect(floor().hall!.polygon[3]).toEqual({ x: 0, y: 1000 });
  });
});

describe('Wrapper für das Eigenschaften-Panel', () => {
  it('setItemSize nur bei skalierbaren Objekten', () => {
    expect(setItemSize('a', 300, 120)).toBe(true);
    expect(itemById('a')).toMatchObject({ width: 300, depth: 120 });
    const fixed = createItemFromDef(getDef('atlantis-a301')!, 900, 900, { id: 'fixed' });
    useProjectStore.getState().addItem(floor().id, fixed);
    expect(setItemSize('fixed', 10, 10)).toBe(false);
    expect(itemById('fixed').width).toBe(123);
  });
  it('setItemRotation / setItemPosition', () => {
    setItemRotation('a', 450);
    expect(itemById('a').rotation).toBe(90);
    setItemPosition('a', 1, 2);
    expect(itemById('a')).toMatchObject({ x: 1, y: 2 });
    setItemPosition('a', Number.NaN, 5);
    expect(itemById('a')).toMatchObject({ x: 1, y: 2 });
  });
  it('selectionBounds / movablesOf', () => {
    selectItems('a', 'b');
    expect(selectionBounds(floor())).toEqual({ minX: 150, minY: 150, maxX: 700, maxY: 250 });
    expect(movablesOf(floor()).map((m) => m.key)).toEqual(['item:a', 'item:b']);
    useUiStore.getState().clearSelection();
    expect(selectionBounds(floor())).toBeNull();
  });
});

describe('Hallen-Eckpunkt entfernen: Öffnungen an den Außenwänden (M6)', () => {
  // Konvexes Fünfeck: Kante i verläuft von p[i] nach p[i+1]
  const pent = [{ x: 0, y: 0 }, { x: 1200, y: -400 }, { x: 2000, y: 400 }, { x: 1200, y: 1500 }, { x: 0, y: 1500 }];
  const openingsOn = (spec: { id: string; wallId: string; offset: number }[]): Opening[] =>
    spec.map((s) => ({ id: s.id, kind: 'window', wallId: s.wallId, offset: s.offset, width: 100, height: 100, sillHeight: 90 }) as Opening);

  it('hallOpeningsAfterVertexRemoval verschiebt Indizes und projiziert auf die neue Kante', () => {
    const oldHall = createHall(1, 1, { polygon: pent });
    const newHall = { ...oldHall, polygon: pent.filter((_, i) => i !== 1) };
    const oldW = hallWalls(oldHall);
    const door = pointOnWall(oldW.find((w) => w.id === 'hall_2')!, 700); // rechte (schräge) Kante
    const win = pointOnWall(oldW.find((w) => w.id === 'hall_3')!, 500); // untere Kante
    const nearP2 = pointOnWall(oldW.find((w) => w.id === 'hall_1')!, 1050); // Kante 1 nahe p2 → nahe an der neuen Sehne
    const plan = hallOpeningsAfterVertexRemoval(
      openingsOn([{ id: 'door', wallId: 'hall_2', offset: 700 }, { id: 'win', wallId: 'hall_3', offset: 500 }, { id: 'far', wallId: 'hall_0', offset: 1100 }, { id: 'near', wallId: 'hall_1', offset: 1050 }, { id: 'left', wallId: 'hall_4', offset: 600 }]),
      oldHall, 1, newHall,
    );
    // Öffnung nahe der entfernten Ecke liegt > 1 m von der neuen Sehne entfernt → löschen
    expect(plan.remove).toEqual(['far']);
    const byId = new Map(plan.update.map((u) => [u.id, u]));
    const newW = new Map(hallWalls(newHall).map((w) => [w.id, w]));
    // Indizes rücken nach: hall_2 → hall_1, hall_3 → hall_2, hall_4 → hall_3; verschmolzene Kanten 0/1 → hall_0
    expect(byId.get('door')?.wallId).toBe('hall_1');
    expect(byId.get('win')?.wallId).toBe('hall_2');
    expect(byId.get('near')?.wallId).toBe('hall_0');
    expect(byId.get('left')?.wallId).toBe('hall_3');
    // Weltposition bleibt (bis auf Gehrungsversatz an den Ecken) erhalten
    expect(distance(pointOnWall(newW.get('hall_1')!, byId.get('door')!.offset), door)).toBeLessThan(5);
    expect(distance(pointOnWall(newW.get('hall_2')!, byId.get('win')!.offset), win)).toBeLessThan(5);
    expect(distance(pointOnWall(newW.get('hall_0')!, byId.get('near')!.offset), nearP2)).toBeLessThan(HALL_OPENING_REMAP_MAX_CM);
    // Ecke 0 entfernen: Kanten 4 und 0 verschmelzen zur neuen Kante n−2 = 3
    const plan0 = hallOpeningsAfterVertexRemoval(openingsOn([{ id: 'win', wallId: 'hall_3', offset: 500 }, { id: 'left', wallId: 'hall_4', offset: 1400 }]), oldHall, 0, { ...oldHall, polygon: pent.slice(1) });
    expect(plan0.update.find((u) => u.id === 'win')?.wallId).toBe('hall_2');
    expect(plan0.update.find((u) => u.id === 'left')?.wallId ?? (plan0.remove.includes('left') ? 'removed' : null)).toMatch(/^(hall_3|removed)$/);
  });

  it('deleteSelection entfernt den Eckpunkt und hält Tür/Fenster an ihren Wänden', () => {
    const p = createEmptyProject('Test');
    const f = p.floors[0];
    f.hall = createHall(1, 1, { polygon: pent });
    f.openings = openingsOn([{ id: 'door', wallId: 'hall_2', offset: 700 }, { id: 'win', wallId: 'hall_3', offset: 500 }]);
    loadProject(p);
    const oldW = hallWalls(f.hall);
    const doorPos = pointOnWall(oldW.find((w) => w.id === 'hall_2')!, 700);
    const winPos = pointOnWall(oldW.find((w) => w.id === 'hall_3')!, 500);
    useUiStore.getState().setSelection([{ kind: 'hallVertex', id: '1' }]);
    deleteSelection();
    const after = floor();
    expect(after.hall!.polygon).toHaveLength(4);
    expect(after.openings).toHaveLength(2);
    const nw = new Map(hallWalls(after.hall!).map((w) => [w.id, w]));
    const door = after.openings.find((o) => o.id === 'door')!;
    const win = after.openings.find((o) => o.id === 'win')!;
    expect(door.wallId).toBe('hall_1');
    expect(win.wallId).toBe('hall_2');
    expect(distance(pointOnWall(nw.get(door.wallId)!, door.offset), doorPos)).toBeLessThan(5);
    expect(distance(pointOnWall(nw.get(win.wallId)!, win.offset), winPos)).toBeLessThan(5);
    // Ein Undo-Schritt für Polygon + Öffnungen
    undo();
    expect(floor().hall!.polygon).toHaveLength(5);
    expect(floor().openings.find((o) => o.id === 'door')).toMatchObject({ wallId: 'hall_2', offset: 700 });
  });
});
