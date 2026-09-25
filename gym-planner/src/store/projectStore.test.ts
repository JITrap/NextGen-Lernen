import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, undo, redo, clearHistory, transaction, loadProject } from './projectStore';
import { createEmptyProject, createWall, createHall } from './factories';

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
    undo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(0);
    redo();
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(10);
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
