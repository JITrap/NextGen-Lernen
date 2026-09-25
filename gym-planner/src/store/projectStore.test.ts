import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, undo, redo, clearHistory, transaction, loadProject, beginTransaction, endTransaction } from './projectStore';
import { createEmptyProject, createWall, createHall } from './factories';
import type { PlacedItem } from '@/types';

describe('Projekt-Store mit Undo/Redo', () => {
  beforeEach(() => {
    loadProject(createEmptyProject('Test'));
  });

  it('legt Wände an und kann rückgängig machen', () => {
    const s = useProjectStore.getState();
    const fid = s.project.activeFloorId;
    s.addWall(fid, createWall({ start: { x: 0, y: 0 }, end: { x: 500, y: 0 } }));
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(1);
    undo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(0);
    redo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(1);
  });

  it('Transaktion erzeugt genau einen Undo-Schritt', () => {
    const s = useProjectStore.getState();
    const fid = s.project.activeFloorId;
    transaction(() => {
      for (let i = 0; i < 10; i++) s.addWall(fid, createWall({ start: { x: 0, y: i * 10 }, end: { x: 500, y: i * 10 } }));
    });
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(10);
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(1);
    undo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(0);
    // Ein zweites Undo darf die Wände nicht wieder hinzufügen (kein doppelter Eintrag).
    undo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(0);
    redo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(10);
    // Verschachtelte Transaktionen und eine ohne Änderung erzeugen keine zusätzlichen Einträge.
    transaction(() => { transaction(() => {}); });
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(1);
    transaction(() => s.addWall(fid, createWall({ start: { x: 0, y: 500 }, end: { x: 100, y: 500 } })));
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(2);
  });

  it('mindestens 100 Undo-Schritte', () => {
    const s = useProjectStore.getState();
    const fid = s.project.activeFloorId;
    for (let i = 0; i < 150; i++) s.addWall(fid, createWall({ start: { x: 0, y: i }, end: { x: 100, y: i } }));
    for (let i = 0; i < 120; i++) undo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(30);
  });

  it('Stockwerke: anlegen, duplizieren, löschen, sortieren', () => {
    const s = useProjectStore.getState();
    const f0 = s.project.floors[0].id;
    s.setHall(f0, createHall(2500, 2000));
    const f1 = s.addFloor({ name: 'OG 1' });
    expect(useProjectStore.getState().project.floors.length).toBe(2);
    const f2 = useProjectStore.getState().duplicateFloor(f0)!;
    expect(useProjectStore.getState().project.floors.length).toBe(3);
    expect(useProjectStore.getState().project.floors.find((f) => f.id === f2)?.hall?.polygon.length).toBe(4);
    useProjectStore.getState().moveFloor(f1, -1);
    const orders = useProjectStore.getState().project.floors.map((f) => [f.id, f.order] as const);
    expect(orders.find(([id]) => id === f1)![1]).toBeLessThan(orders.find(([id]) => id === f2)![1]);
    useProjectStore.getState().deleteFloor(f1);
    expect(useProjectStore.getState().project.floors.length).toBe(2);
  });

  it('Gruppieren und Löschen räumt Gruppen auf', () => {
    const s = useProjectStore.getState();
    const fid = s.project.activeFloorId;
    const mk = (id: string) => ({ id, kind: 'equipment' as const, defId: 'x', x: 0, y: 0, rotation: 0, width: 10, depth: 10, height: 10, safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: true });
    s.addItems(fid, [mk('a'), mk('b'), mk('c')]);
    const gid = useProjectStore.getState().groupItems(fid, ['a', 'b', 'c'])!;
    expect(useProjectStore.getState().project.floors[0].items.every((i) => i.groupId === gid)).toBe(true);
    useProjectStore.getState().deleteItems(fid, ['a', 'b']);
    expect(useProjectStore.getState().project.floors[0].groups.length).toBe(0);
    expect(useProjectStore.getState().project.floors[0].items.length).toBe(1);
  });

  it('clearHistory leert die Historie', () => {
    const s = useProjectStore.getState();
    s.renameProject('Neu');
    clearHistory();
    undo();
    expect(useProjectStore.getState().project.name).toBe('Neu');
  });
});

describe('Review-Befunde Store', () => {
  const past = () => useProjectStore.temporal.getState().pastStates.length;
  const mkBase = (id: string): PlacedItem => ({ id, kind: 'equipment', defId: 'x', x: 0, y: 0, rotation: 0, width: 10, depth: 10, height: 10, safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: true });
  const mk = (id: string, extra: Partial<PlacedItem> = {}): PlacedItem => ({ ...mkBase(id), ...extra });

  beforeEach(() => {
    loadProject(createEmptyProject('Review'));
  });

  it('M1: deleteSelection lässt Öffnungen und Wandmontage einer gesperrten Wand unangetastet', () => {
    const s = useProjectStore.getState();
    const fid = s.project.activeFloorId;
    const locked = createWall({ start: { x: 0, y: 0 }, end: { x: 500, y: 0 }, locked: true });
    const free = createWall({ start: { x: 0, y: 200 }, end: { x: 500, y: 200 } });
    s.addWalls(fid, [locked, free]);
    s.addOpening(fid, { id: 'o1', kind: 'door', wallId: locked.id, offset: 100, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' });
    s.addOpening(fid, { id: 'o2', kind: 'door', wallId: free.id, offset: 100, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' });
    s.addItems(fid, [mk('a', { wallId: locked.id }), mk('b', { wallId: free.id })]);
    useProjectStore.getState().deleteSelection(fid, [{ kind: 'wall', id: locked.id }, { kind: 'wall', id: free.id }]);
    const f = useProjectStore.getState().project.floors[0];
    expect(f.walls.map((w) => w.id)).toEqual([locked.id]);
    expect(f.openings.map((o) => o.id)).toEqual(['o1']);
    expect(f.items.find((i) => i.id === 'a')!.wallId).toBe(locked.id);
    expect(f.items.find((i) => i.id === 'b')!.wallId).toBeUndefined();
  });

  it('M2: deleteSelection behält Gruppen gesperrter Objekte und bereinigt dockedTo', () => {
    const s = useProjectStore.getState();
    const fid = s.project.activeFloorId;
    s.addItems(fid, [mk('rack'), mk('mod', { dockedTo: 'rack' }), mk('a', { locked: true }), mk('b'), mk('c')]);
    const gid = useProjectStore.getState().groupItems(fid, ['a', 'b', 'c'])!;
    useProjectStore.getState().deleteSelection(fid, [{ kind: 'item', id: 'rack' }, { kind: 'item', id: 'a' }, { kind: 'item', id: 'b' }]);
    const f = useProjectStore.getState().project.floors[0];
    expect(f.items.map((i) => i.id).sort()).toEqual(['a', 'c', 'mod']);
    expect(f.items.find((i) => i.id === 'mod')!.dockedTo).toBeUndefined();
    expect(f.groups).toEqual([{ id: gid, itemIds: ['a', 'c'] }]);
    expect(f.items.find((i) => i.id === 'a')!.groupId).toBe(gid);
    // Gruppe mit nur einem verbleibenden Objekt wird aufgelöst
    useProjectStore.getState().deleteSelection(fid, [{ kind: 'item', id: 'c' }]);
    expect(useProjectStore.getState().project.floors[0].groups).toEqual([]);
  });

  it('M5: eine Transaktion überlebt keinen Projektwechsel (Undo holt kein altes Projekt zurück)', () => {
    const s = useProjectStore.getState();
    const fid = s.project.activeFloorId;
    const oldId = s.project.id;
    beginTransaction();
    s.addWall(fid, createWall({ start: { x: 0, y: 0 }, end: { x: 500, y: 0 } }));
    loadProject(createEmptyProject('Anderes'));
    endTransaction();
    expect(past()).toBe(0);
    expect(useProjectStore.temporal.getState().isTracking).toBe(true);
    undo();
    expect(useProjectStore.getState().project.id).not.toBe(oldId);
    expect(useProjectStore.getState().project.name).toBe('Anderes');
    // Historie arbeitet danach normal
    useProjectStore.getState().renameProject('X');
    expect(past()).toBe(1);
    undo();
    expect(useProjectStore.getState().project.name).toBe('Anderes');
    // endTransaction nach loadProject (ohne begin) ist harmlos
    endTransaction();
    expect(useProjectStore.temporal.getState().isTracking).toBe(true);
  });

  it('L1: Stockwerkwechsel erzeugt keinen Undo-Schritt', () => {
    const s = useProjectStore.getState();
    const f0 = s.project.floors[0].id;
    const f1 = s.addFloor({ name: 'OG 1' });
    const before = past();
    expect(before).toBe(1);
    useProjectStore.getState().setActiveFloor(f0);
    expect(useProjectStore.getState().project.activeFloorId).toBe(f0);
    expect(past()).toBe(before);
    useProjectStore.getState().setActiveFloor(f1);
    expect(past()).toBe(before);
    // Echte Änderung nach dem Wechsel: ein Eintrag; Undo führt zum Stand vor der Änderung
    useProjectStore.getState().renameFloor(f1, 'Galerie');
    expect(past()).toBe(before + 1);
    undo();
    expect(useProjectStore.getState().project.floors.find((f) => f.id === f1)!.name).toBe('OG 1');
    expect(useProjectStore.getState().project.activeFloorId).toBe(f1);
    undo();
    expect(useProjectStore.getState().project.floors.length).toBe(1);
  });

  it('L6: moveFloor funktioniert auch bei gleichen order-Werten', () => {
    const s = useProjectStore.getState();
    const f0 = s.project.floors[0].id;
    const f1 = s.addFloor({ name: 'A', order: 0 });
    const f2 = useProjectStore.getState().addFloor({ name: 'B', order: 0 });
    useProjectStore.getState().moveFloor(f2, -1);
    const orderOf = (id: string) => useProjectStore.getState().project.floors.find((f) => f.id === id)!.order;
    expect(orderOf(f2)).toBeLessThan(orderOf(f1));
    expect(orderOf(f0)).toBeLessThan(orderOf(f2));
    const orders = useProjectStore.getState().project.floors.map((f) => f.order);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
