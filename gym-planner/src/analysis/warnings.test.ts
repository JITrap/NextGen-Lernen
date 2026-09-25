import { describe, it, expect } from 'vitest';
import { warnings, warningFocus, sortWarnings, countWarnings } from './warnings';
import { projectWithHall, firstFloor, addZone, addCustomDef, makeDef, place, addFloor, fresh } from './testFixtures';
import { getDef } from '@/data/equipment';
import { hallWalls } from '@/geometry/walls';
import { doorSwingSectors } from '@/geometry/collision';
import { polygonArea } from '@/geometry/polygon';
import type { Door, EquipmentDef, Project } from '@/types';

function treadmillDef(p: Project): EquipmentDef {
  return addCustomDef(p, makeDef({ id: 'test-treadmill', name: 'Laufband', bereich: 'Cardio', symbol: 'treadmill', breite_cm: 90, tiefe_cm: 210, hoehe_cm: 160, gewicht_kg: 150, sicherheitszone_cm: { vorne: 0, hinten: 200, links: 0, rechts: 0 } }));
}
function plainDef(p: Project, id = 'test-plain', extra: Partial<EquipmentDef> = {}): EquipmentDef {
  return addCustomDef(p, makeDef({ id, name: id, breite_cm: 100, tiefe_cm: 100, hoehe_cm: 100, gewicht_kg: 10, ...extra }));
}

describe('Planungs-Warnungen', () => {
  it('Rack 246 cm in Stockwerk mit 240 cm Deckenhöhe → ceiling-height', () => {
    const p = projectWithHall(2500, 2000);
    firstFloor(p).ceilingHeight = 240;
    const rack = place(firstFloor(p), getDef('atlantis-c513')!, 500, 500);
    const w = warnings(p).filter((x) => x.kind === 'ceiling-height');
    expect(w.length).toBe(1);
    expect(w[0].severity).toBe('error');
    expect(w[0].message).toContain('246 cm');
    expect(w[0].message).toContain('240 cm');
    expect(w[0].target).toEqual({ kind: 'item', id: rack.id });
    expect(w[0].id).toBe(`ceiling-height:${rack.id}`);
    firstFloor(p).ceilingHeight = 350;
    expect(warnings(fresh(p)).some((x) => x.kind === 'ceiling-height')).toBe(false);
  });

  it('Wand höher als Decke → ceiling-height (Warnung)', () => {
    const p = projectWithHall(2500, 2000);
    firstFloor(p).walls.push({ id: 'w1', start: { x: 500, y: 500 }, end: { x: 1000, y: 500 }, thickness: 12.5, type: 'Trockenbau', height: 400 });
    const w = warnings(p).find((x) => x.kind === 'ceiling-height');
    expect(w?.severity).toBe('warning');
    expect(w?.target).toEqual({ kind: 'wall', id: 'w1' });
  });

  it('zwei überlappende Laufbänder → collision (Fehler); nur Zonen-Überlappung → Warnung', () => {
    const p = projectWithHall(2500, 2000);
    const tm = treadmillDef(p);
    const a = place(firstFloor(p), tm, 500, 500);
    const b = place(firstFloor(p), tm, 550, 550);
    const w = warnings(p).filter((x) => x.kind === 'collision');
    expect(w.length).toBe(1);
    expect(w[0].severity).toBe('error');
    expect(w[0].message).toContain('Laufband');
    expect(w[0].target).toEqual({ kind: 'item', id: a.id });
    // b hinter a (Zone von a reicht 200 cm nach hinten = −y)
    b.x = 500;
    b.y = 500 - 210 - 50;
    const w2 = warnings(fresh(p)).filter((x) => x.kind === 'collision');
    expect(w2.length).toBe(1);
    expect(w2[0].severity).toBe('warning');
    expect(w2[0].message).toContain('Sicherheitszone');
  });

  it('Umkleide ohne Dusche/WC → changing-room; mit Dusche und WC in der Nähe keine Warnung', () => {
    const p = projectWithHall(2500, 2000);
    const f = firstFloor(p);
    const z = addZone(f, 100, 100, 700, 700, 'Umkleide Damen', 'Damen');
    let w = warnings(p).filter((x) => x.kind === 'changing-room');
    expect(w.length).toBe(2);
    expect(w[0].target).toEqual({ kind: 'zone', id: z.id });
    expect(w.map((x) => x.message).join(' ')).toContain('Dusche');
    expect(w.map((x) => x.message).join(' ')).toContain('WC');
    const shower = addCustomDef(p, makeDef({ id: 't-shower', symbol: 'shower', breite_cm: 90, tiefe_cm: 90 }));
    place(f, shower, 900, 400);
    w = warnings(fresh(p)).filter((x) => x.kind === 'changing-room');
    expect(w.length).toBe(1);
    expect(w[0].message).toContain('WC');
    addZone(f, 800, 800, 1200, 1200, 'WC');
    expect(warnings(fresh(p)).some((x) => x.kind === 'changing-room')).toBe(false);
    // Dusche zu weit weg (> 15 m)
    f.items[0].x = 2400;
    f.zones.pop();
    addZone(f, 2200, 1700, 2400, 1900, 'WC');
    w = warnings(fresh(p)).filter((x) => x.kind === 'changing-room');
    expect(w.length).toBe(2);
  });

  it('Sauna ohne Ruhebereich/Dusche → wellness', () => {
    const p = projectWithHall(2500, 2000);
    const f = firstFloor(p);
    const sauna = addCustomDef(p, makeDef({ id: 't-sauna', name: 'Sauna', symbol: 'sauna', breite_cm: 200, tiefe_cm: 200 }));
    const s = place(f, sauna, 500, 500);
    let w = warnings(p).filter((x) => x.kind === 'wellness');
    expect(w.length).toBe(1);
    expect(w[0].message).toContain('kein Ruhebereich und keine Dusche');
    expect(w[0].target).toEqual({ kind: 'item', id: s.id });
    addZone(f, 800, 100, 1400, 700, 'Ruheraum');
    w = warnings(fresh(p)).filter((x) => x.kind === 'wellness');
    expect(w[0].message).toBe('„Sauna“: keine Dusche in der Nähe (≤ 15 m).');
    const shower = addCustomDef(p, makeDef({ id: 't-shower2', symbol: 'shower', breite_cm: 90, tiefe_cm: 90 }));
    place(f, shower, 500, 900);
    expect(warnings(fresh(p)).some((x) => x.kind === 'wellness')).toBe(false);
  });

  it('Maße ungeprüft → info mit Anzahl je Definition', () => {
    const p = projectWithHall(2500, 2000);
    const gen = addCustomDef(p, makeDef({ id: 't-unverified', name: 'Ergometer', verifiziert: false, breite_cm: 60, tiefe_cm: 120 }));
    place(firstFloor(p), gen, 300, 300);
    place(firstFloor(p), gen, 600, 300);
    place(firstFloor(p), gen, 900, 300);
    const w = warnings(p).filter((x) => x.kind === 'unverified');
    expect(w.length).toBe(1);
    expect(w[0].severity).toBe('info');
    expect(w[0].message).toContain('(3×)');
    expect(w[0].id).toBe('unverified:t-unverified');
  });

  it('Gerät außerhalb der Halle → outside-hall', () => {
    const p = projectWithHall(2500, 2000);
    const d = plainDef(p);
    const outside = place(firstFloor(p), d, -300, -300);
    const partial = place(firstFloor(p), d, 40, 500); // ragt in die Außenwand
    const inside = place(firstFloor(p), d, 500, 500);
    const w = warnings(p).filter((x) => x.kind === 'outside-hall');
    expect(w.map((x) => (x.target as { id: string }).id).sort()).toEqual([outside.id, partial.id].sort());
    expect(w.find((x) => (x.target as { id: string }).id === outside.id)!.severity).toBe('error');
    expect(w.find((x) => (x.target as { id: string }).id === partial.id)!.severity).toBe('warning');
    expect(w.some((x) => (x.target as { id: string }).id === inside.id)).toBe(false);
  });

  it('Rack-Modul ohne Andockung → rack-module', () => {
    const p = projectWithHall(2500, 2000);
    const module = getDef('atlantis-ms6')!;
    expect(module.nur_an_rack).toBe(true);
    const m = place(firstFloor(p), module, 800, 800);
    let w = warnings(p).filter((x) => x.kind === 'rack-module');
    expect(w.length).toBe(1);
    expect(w[0].target).toEqual({ kind: 'item', id: m.id });
    const rack = place(firstFloor(p), getDef('atlantis-c513')!, 1500, 800);
    m.dockedTo = rack.id;
    w = warnings(fresh(p)).filter((x) => x.kind === 'rack-module');
    expect(w.length).toBe(0);
  });

  it('Gerät in Tür-Schwenkfläche bzw. vor Notausgang', () => {
    const p = projectWithHall(2500, 2000);
    const f = firstFloor(p);
    const wall = hallWalls(f.hall!)[0]; // obere Außenwand, Richtung +x, Innenseite = Seite „b“
    const door: Door = { id: 'd1', kind: 'door', wallId: wall.id, offset: 500, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'b' };
    f.openings.push(door);
    const polys = doorSwingSectors(door, wall);
    expect(polys.length).toBe(1);
    expect(polygonArea(polys[0])).toBeCloseTo((Math.PI * 90 * 90) / 4, -2);
    const d = plainDef(p, 't-small', { breite_cm: 40, tiefe_cm: 40 });
    const inSwing = place(f, d, 500, 60);
    place(f, d, 900, 60);
    let w = warnings(p).filter((x) => x.kind === 'door-swing');
    expect(w.length).toBe(1);
    expect(w[0].target).toEqual({ kind: 'item', id: inSwing.id });
    door.doorType = 'Notausgang';
    inSwing.y = 130;
    w = warnings(fresh(p)).filter((x) => x.kind === 'emergency-exit');
    expect(w.length).toBe(1);
    expect(w[0].severity).toBe('error');
    door.doorType = 'Schiebetür';
    expect(warnings(fresh(p)).some((x) => x.kind === 'door-swing' || x.kind === 'emergency-exit')).toBe(false);
  });

  it('zu schmaler Laufweg zwischen Objekten → escape-route mit Punkt', () => {
    const p = projectWithHall(3000, 3000);
    const f = firstFloor(p);
    const d = plainDef(p);
    place(f, d, 500, 1000);
    place(f, d, 700, 1000); // Lücke 100 cm (< 120, > 60)
    place(f, d, 1500, 1000); // Lücke 700 cm → ok
    const w = warnings(p).filter((x) => x.kind === 'escape-route');
    expect(w.length).toBe(1);
    expect(w[0].message).toContain('100 cm');
    expect(w[0].message).toContain('120 cm');
    expect(w[0].target).toEqual({ point: { x: 600, y: 1000 } });
    p.settings.minEscapeRouteCm = 90;
    expect(warnings(fresh(p)).some((x) => x.kind === 'escape-route')).toBe(false);
  });

  it('Warnungen sind nach Schweregrad sortiert, gezählt und fokussierbar', () => {
    const p = projectWithHall(2500, 2000);
    const f = firstFloor(p);
    f.ceilingHeight = 240;
    const gen = addCustomDef(p, makeDef({ id: 't-unv', verifiziert: false }));
    place(f, gen, 300, 300);
    const rack = place(f, getDef('atlantis-c513')!, 800, 800);
    const z = addZone(f, 1200, 100, 1800, 700, 'Umkleide Herren');
    const list = warnings(p);
    const ranks = list.map((w) => ({ error: 0, warning: 1, info: 2 }[w.severity]));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(sortWarnings([...list].reverse())).toEqual(list);
    const c = countWarnings(list);
    expect(c.total).toBe(list.length);
    expect(c.error + c.warning + c.info).toBe(list.length);
    const itemW = list.find((w) => w.kind === 'ceiling-height')!;
    expect(warningFocus(p, itemW)).toEqual({ point: { x: 800, y: 800 }, selection: { kind: 'item', id: rack.id } });
    const zoneW = list.find((w) => w.kind === 'changing-room')!;
    expect(warningFocus(p, zoneW)!.point).toEqual({ x: 1500, y: 400 });
    expect(warningFocus(p, zoneW)!.selection).toEqual({ kind: 'zone', id: z.id });
    expect(warningFocus(p, { ...itemW, target: { point: { x: 1, y: 2 } } })).toEqual({ point: { x: 1, y: 2 } });
  });

  it('verlinkte Treppen kollidieren auch auf dem verbundenen Stockwerk', () => {
    const p = projectWithHall(2500, 2000);
    const og = addFloor(p, { hall: firstFloor(p).hall });
    const stairs = addCustomDef(p, makeDef({ id: 't-stairs', name: 'Treppe', bereich: 'Bauelemente', symbol: 'stairs-straight', breite_cm: 120, tiefe_cm: 400, params: { kind: 'stairs' } }));
    place(firstFloor(p), stairs, 600, 600, { linkedFloorIds: [og.id] });
    const d = plainDef(p);
    place(og, d, 600, 600);
    const w = warnings(p).filter((x) => x.kind === 'collision');
    expect(w.length).toBe(1);
    expect(w[0].floorId).toBe(og.id);
  });

  it('Kollisions-IDs symmetrischer Arten sind reihenfolgeunabhängig (N2)', () => {
    const p = projectWithHall(2500, 2000);
    const d = plainDef(p);
    const a = place(firstFloor(p), d, 500, 500, { id: 'zz' });
    const b = place(firstFloor(p), d, 550, 550, { id: 'aa' });
    const w = warnings(p).filter((x) => x.kind === 'collision');
    expect(w).toHaveLength(1);
    expect(w[0].id).toBe(`collision:${firstFloor(p).id}:aa:zz`);
    firstFloor(p).items.reverse();
    const w2 = warnings(fresh(p)).filter((x) => x.kind === 'collision');
    expect(w2[0].id).toBe(w[0].id);
    expect([a.id, b.id].sort()).toEqual(['aa', 'zz']);
  });

  it('leere Halle erzeugt keine Kapazitätswarnungen (N3)', () => {
    const p = projectWithHall(2500, 2000);
    expect(warnings(p).filter((x) => x.kind === 'capacity')).toEqual([]);
  });

  it('leeres Projekt ohne Halle erzeugt keine Warnungen', () => {
    const p = projectWithHall(1000, 1000);
    firstFloor(p).hall = null;
    expect(warnings(p)).toEqual([]);
  });
});
