import { describe, it, expect } from 'vitest';
import { createFloor, createHall, createWall, createItemFromDef, duplicateFloor } from './factories';
import { getDef } from '@/data/equipment';

describe('duplicateFloor', () => {
  it('behält hall_<i>-Referenzen (Öffnungen, Wandmontage) und benennt nur echte Wände um (H3)', () => {
    const f = createFloor({ name: 'EG', hall: createHall(1000, 800) });
    const w = createWall({ start: { x: 0, y: 0 }, end: { x: 500, y: 0 } });
    f.walls.push(w);
    f.openings.push({ id: 'o1', kind: 'door', wallId: 'hall_0', offset: 100, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' });
    f.openings.push({ id: 'o2', kind: 'window', wallId: w.id, offset: 100, width: 120, height: 120, sillHeight: 90 });
    const def = getDef('atlantis-a301')!;
    f.items.push(createItemFromDef(def, 100, 100, { id: 'i1', wallId: 'hall_2' }));
    f.items.push(createItemFromDef(def, 200, 100, { id: 'i2', wallId: w.id }));
    f.items.push(createItemFromDef(def, 300, 100, { id: 'i3', linkedFloorIds: [f.id] }));
    f.groups.push({ id: 'g1', itemIds: ['i1', 'i2'] });
    f.items[0].groupId = 'g1';
    f.items[1].groupId = 'g1';
    f.items[1].dockedTo = 'i1';

    const c = duplicateFloor(f, 'Kopie');
    expect(c.id).not.toBe(f.id);
    expect(c.name).toBe('Kopie');
    // Hallen-Außenwände heißen im Duplikat gleich → Öffnungen und Wandmontage bleiben erhalten
    expect(c.openings[0].wallId).toBe('hall_0');
    expect(c.items[0].wallId).toBe('hall_2');
    // Echte Wände erhalten neue IDs, Referenzen ziehen mit
    expect(c.walls[0].id).not.toBe(w.id);
    expect(c.openings[1].wallId).toBe(c.walls[0].id);
    expect(c.items[1].wallId).toBe(c.walls[0].id);
    // Gruppen/Andockung innerhalb des Stockwerks bleiben konsistent
    expect(c.groups[0].id).not.toBe('g1');
    expect(c.groups[0].itemIds).toEqual([c.items[0].id, c.items[1].id]);
    expect(c.items[0].groupId).toBe(c.groups[0].id);
    expect(c.items[1].dockedTo).toBe(c.items[0].id);
    // Original unverändert
    expect(f.openings[1].wallId).toBe(w.id);
  });

  it('erzeugt keine expliziten undefined-Eigenschaften (L5)', () => {
    const f = createFloor({ name: 'EG' });
    const def = getDef('atlantis-a301')!;
    f.items.push(createItemFromDef(def, 300, 100, { id: 'i3', linkedFloorIds: ['f_x'] }));
    const c = duplicateFloor(f, 'Kopie');
    const it = c.items[0];
    for (const k of ['wallId', 'groupId', 'dockedTo', 'linkedFloorIds'] as const) expect(k in it).toBe(false);
    expect(it.id).not.toBe('i3');
    expect('params' in createItemFromDef(def, 0, 0)).toBe(def.params !== undefined);
  });
});
