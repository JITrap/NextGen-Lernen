import { describe, it, expect } from 'vitest';
import type { PlacedItem, Wall, Door, Hall } from '@/types';
import {
  convexPolygonsOverlap, polygonsOverlap, polygonExtentInBand, findCollisions, collidingIds, itemsOverlap,
  itemInsideHall, doorSwingPolygon, doorSwingSectors, itemsInDoorSwing, emergencyExitBlocked,
  emergencyExitClearanceRects, escapeRouteBottlenecks, effectiveZone, itemZonePolygon, SLIDING_DOOR_CLEARANCE,
} from './collision';
import { polygonArea, bbox, pointInPolygon } from './polygon';
import { hallInnerPolygon, hallWalls, openingPlacement } from './walls';
import { itemIndexFor, wallIndexFor } from './spatialHash';

function item(id: string, x: number, y: number, width: number, depth: number, rotation = 0, extra: Partial<PlacedItem> = {}): PlacedItem {
  return {
    id, kind: 'equipment', defId: 'def', x, y, rotation, width, depth, height: 150,
    safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: false, ...extra,
  };
}
function withZone(it: PlacedItem, cm: number | { vorne: number; hinten: number; links: number; rechts: number }): PlacedItem {
  const z = typeof cm === 'number' ? { vorne: cm, hinten: cm, links: cm, rechts: cm } : cm;
  return { ...it, safetyZone: z, safetyZoneEnabled: true };
}
function wall(id: string, sx: number, sy: number, ex: number, ey: number, thickness = 10): Wall {
  return { id, start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness, type: 'Trockenbau', height: null };
}
function door(id: string, wallId: string, offset: number, width: number, partial: Partial<Door> = {}): Door {
  return { id, kind: 'door', wallId, offset, width, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a', ...partial };
}
const square = (cx: number, cy: number, s: number) => [{ x: cx - s / 2, y: cy - s / 2 }, { x: cx + s / 2, y: cy - s / 2 }, { x: cx + s / 2, y: cy + s / 2 }, { x: cx - s / 2, y: cy + s / 2 }];

describe('Polygon-Überlappung', () => {
  it('SAT: Berührung Kante an Kante ist keine Überlappung', () => {
    expect(convexPolygonsOverlap(square(0, 0, 100), square(100, 0, 100))).toBe(false);
    expect(convexPolygonsOverlap(square(0, 0, 100), square(99, 0, 100))).toBe(true);
  });
  it('polygonsOverlap für konkave Polygone (L-Form) inkl. Enthaltensein und Identität', () => {
    const L = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 300 }, { x: 0, y: 300 }];
    expect(polygonsOverlap(L, square(200, 200, 100))).toBe(false); // in der Aussparung
    expect(polygonsOverlap(L, square(200, 200, 250))).toBe(true); // ragt hinein
    expect(polygonsOverlap(L, square(50, 50, 20))).toBe(true); // vollständig innen
    expect(polygonsOverlap(L, L)).toBe(true);
    expect(polygonsOverlap(L, square(350, 50, 100))).toBe(false); // berührt Kante x=300
  });
  it('polygonExtentInBand liefert die Ausdehnung im Band (auch Strecken)', () => {
    const diamond = [{ x: 100, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 100 }];
    expect(polygonExtentInBand(diamond, 'x', 90, 110)).toEqual({ min: 0, max: 200 });
    const e = polygonExtentInBand(diamond, 'x', 0, 50)!;
    expect(e.min).toBeCloseTo(50, 6);
    expect(e.max).toBeCloseTo(150, 6);
    expect(polygonExtentInBand(diamond, 'y', 500, 600)).toBeNull();
    expect(polygonExtentInBand([{ x: 24, y: 0 }, { x: 24, y: 1000 }], 'x', 100, 200)).toEqual({ min: 24, max: 24 });
  });
});

describe('findCollisions', () => {
  it('zwei 100×100-Objekte Kante an Kante → keine Kollision, 1 cm überlappt → Kollision', () => {
    expect(findCollisions([item('a', 0, 0, 100, 100), item('b', 100, 0, 100, 100)])).toEqual([]);
    const cols = findCollisions([item('a', 0, 0, 100, 100), item('b', 99, 0, 100, 100)]);
    expect(cols).toEqual([{ a: 'a', b: 'b', kind: 'item-item' }]);
    expect([...collidingIds(cols)].sort()).toEqual(['a', 'b']);
    expect(itemsOverlap(item('a', 0, 0, 100, 100), item('b', 99, 0, 100, 100))).toBe(true);
  });
  it('gedreht (45°): Bounding-Boxen überlappen, Polygone nicht – und umgekehrt echte Überlappung', () => {
    const diamond = item('d', 0, 0, 100, 100, 45);
    expect(findCollisions([diamond, item('b', 120, 60, 100, 100)])).toEqual([]);
    expect(findCollisions([diamond, item('b', 100, 0, 100, 100)])).toEqual([{ a: 'd', b: 'b', kind: 'item-item' }]);
  });
  it('Laufband (90×210, Zone hinten 200) und Objekt 100 cm dahinter → item-zone', () => {
    const treadmill = withZone(item('lb', 0, 0, 90, 210), { vorne: 0, hinten: 200, links: 0, rechts: 0 });
    const behind = item('x', 0, -105 - 100 - 50, 100, 100); // 100 cm Luft zur Geräterückseite
    expect(findCollisions([treadmill, behind])).toEqual([{ a: 'lb', b: 'x', kind: 'item-zone' }]);
    expect(findCollisions([behind, treadmill])).toEqual([{ a: 'lb', b: 'x', kind: 'item-zone' }]);
    expect(findCollisions([treadmill, behind], { includeZones: false })).toEqual([]);
    const beyond = item('y', 0, -105 - 200 - 50, 100, 100); // genau am Zonenrand
    expect(findCollisions([treadmill, beyond])).toEqual([]);
    expect(effectiveZone(treadmill)).toEqual({ vorne: 0, hinten: 200, links: 0, rechts: 0 });
    expect(itemZonePolygon(behind)).toBeNull();
  });
  it('zwei Sicherheitszonen überlappen sich → zone-zone (Grundflächen frei)', () => {
    const a = withZone(item('a', 0, 0, 100, 100), 60);
    const b = withZone(item('b', 200, 0, 100, 100), 60);
    expect(findCollisions([a, b])).toEqual([{ a: 'a', b: 'b', kind: 'zone-zone' }]);
    expect(findCollisions([a, withZone(item('b', 230, 0, 100, 100), 60)])).toEqual([]);
  });
  it('Wände: Objekt in der Wand → item-wall; Berührung erlaubt; eigene Wand mit 1 cm Toleranz; Säulen nicht geprüft', () => {
    const walls = [wall('w', 0, 0, 500, 0, 10)];
    expect(findCollisions([item('a', 100, 0, 100, 100)], { walls })).toEqual([{ a: 'a', b: 'w', kind: 'item-wall' }]);
    expect(findCollisions([item('a', 100, 55, 100, 100)], { walls })).toEqual([]);
    expect(findCollisions([item('a', 100, 54.5, 100, 100)], { walls })).toEqual([{ a: 'a', b: 'w', kind: 'item-wall' }]);
    expect(findCollisions([item('a', 100, 54.5, 100, 100, 0, { wallId: 'w' })], { walls })).toEqual([]);
    expect(findCollisions([item('a', 100, 54.5, 100, 100)], { walls, wallMountedIds: new Set(['a']) })).toEqual([]);
    expect(findCollisions([item('a', 100, 53, 100, 100, 0, { wallId: 'w' })], { walls })).toEqual([{ a: 'a', b: 'w', kind: 'item-wall' }]);
    expect(findCollisions([item('c', 100, 0, 30, 30, 0, { kind: 'column' })], { walls })).toEqual([]);
    expect(findCollisions([item('a', 100, 0, 100, 100)], { walls: [{ ...walls[0], hidden: true }] })).toEqual([]);
  });
  it('Zone gegen Wand nur auf Wunsch (zone-wall)', () => {
    const walls = [wall('w', 0, 0, 500, 0, 10)];
    const a = withZone(item('a', 100, 80, 100, 100), 60); // Grundfläche ab y=30, Zone ab y=-30
    expect(findCollisions([a], { walls })).toEqual([]);
    expect(findCollisions([a], { walls, zonesAgainstWalls: true })).toEqual([{ a: 'a', b: 'w', kind: 'zone-wall' }]);
  });
  it('angedockte Module nicht gegen ihr Rack, versteckte ignoriert, gleiche Gruppe wird geprüft', () => {
    const rack = item('rack', 0, 0, 165, 203);
    const mod = item('mod', -120, 0, 65, 79, 90, { dockedTo: 'rack' });
    expect(findCollisions([rack, mod])).toEqual([]);
    expect(findCollisions([rack, { ...mod, dockedTo: undefined }])).toEqual([{ a: 'rack', b: 'mod', kind: 'item-item' }]);
    expect(findCollisions([item('a', 0, 0, 100, 100, 0, { hidden: true }), item('b', 50, 0, 100, 100)])).toEqual([]);
    expect(findCollisions([item('a', 0, 0, 100, 100, 0, { groupId: 'g' }), item('b', 50, 0, 100, 100, 0, { groupId: 'g' })])).toHaveLength(1);
  });
  it('onlyIds: nur Paare mit beteiligter ID, jedes Paar einmal', () => {
    const items = [item('a', 0, 0, 100, 100), item('b', 50, 0, 100, 100), item('c', 500, 0, 100, 100), item('d', 550, 0, 100, 100)];
    expect(findCollisions(items, { onlyIds: new Set(['a']) })).toEqual([{ a: 'a', b: 'b', kind: 'item-item' }]);
    expect(findCollisions(items, { onlyIds: new Set(['a', 'b']) })).toEqual([{ a: 'a', b: 'b', kind: 'item-item' }]);
    expect(findCollisions(items)).toHaveLength(2);
  });
  it('leere Eingabe', () => {
    expect(findCollisions([])).toEqual([]);
    expect(findCollisions([], { walls: [wall('w', 0, 0, 100, 0)] })).toEqual([]);
  });
  it('Performance: 500 zufällige Objekte in unter 30 ms', () => {
    const items: PlacedItem[] = [];
    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < 500; i++) {
      const it = item(`i${i}`, rnd() * 4000, rnd() * 3000, 60 + rnd() * 150, 60 + rnd() * 200, rnd() * 360);
      items.push(i % 2 === 0 ? withZone(it, 60) : it);
    }
    const walls: Wall[] = [wall('w1', 0, 0, 4000, 0, 24), wall('w2', 4000, 0, 4000, 3000, 24), wall('w3', 0, 3000, 4000, 3000, 24), wall('w4', 0, 0, 0, 3000, 24), wall('w5', 2000, 0, 2000, 1500, 12.5)];
    // Bestes von drei Läufen auf frischen Arrays (Index-Cache greift nicht), robust gegen Last durch andere Prozesse.
    let dt = Infinity;
    let cols: ReturnType<typeof findCollisions> = [];
    for (let run = 0; run < 3; run++) {
      const fresh = [...items];
      const t0 = performance.now();
      cols = findCollisions(fresh, { walls: [...walls] });
      dt = Math.min(dt, performance.now() - t0);
    }
    expect(cols.length).toBeGreaterThan(0);
    expect(dt).toBeLessThan(30);
    // Ergebnis stimmt mit naiver O(n²)-Prüfung der Grundflächen überein
    let naive = 0;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (itemsOverlap(items[i], items[j])) naive++;
    expect(cols.filter((c) => c.kind === 'item-item')).toHaveLength(naive);
  });
});

describe('Halle', () => {
  const hall: Hall = { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], wallThickness: 24, floorCovering: 'Beton' };
  const inner = hallInnerPolygon(hall);
  it('itemInsideHall: innen, bündig (Toleranz 0,5 cm) und außerhalb', () => {
    expect(itemInsideHall(item('a', 500, 400, 100, 100), inner)).toBe(true);
    expect(itemInsideHall(item('a', 74, 400, 100, 100), inner)).toBe(true);
    expect(itemInsideHall(item('a', 73.6, 400, 100, 100), inner)).toBe(true);
    expect(itemInsideHall(item('a', 73, 400, 100, 100), inner)).toBe(false);
    expect(itemInsideHall(item('a', 30, 400, 100, 100, 45), inner)).toBe(false);
    expect(itemInsideHall(item('a', 5000, 400, 100, 100), [])).toBe(true);
  });
});

describe('Türen', () => {
  const w = wall('w', 0, 0, 500, 0, 10); // Normale (0,-1): Seite a = oben (y < 0)
  it('Fläche eines 90-cm-Tür-Sektors ≈ π·90²/4, auf der richtigen Wandseite', () => {
    const d = door('d', 'w', 250, 90);
    const poly = doorSwingPolygon(d, w, 64);
    const expected = (Math.PI * 90 * 90) / 4;
    expect(Math.abs(polygonArea(poly) - expected) / expected).toBeLessThan(0.005);
    const b = bbox(poly);
    expect(b.maxY).toBeCloseTo(-5, 6); // beginnt an der Wandfläche
    expect(b.minY).toBeCloseTo(-95, 6);
    expect(b.minX).toBeCloseTo(205, 6); // Anschlag links = Richtung Wandanfang
    expect(b.maxX).toBeCloseTo(295, 6);
    const rightHinge = bbox(doorSwingPolygon(door('d', 'w', 250, 90, { hinge: 'right' }), w));
    expect(rightHinge.minX).toBeCloseTo(205, 6);
    expect(rightHinge.maxX).toBeCloseTo(295, 6);
    expect(pointInPolygon({ x: 290, y: -80 }, doorSwingPolygon(door('d', 'w', 250, 90, { hinge: 'right' }), w, 64))).toBe(true);
    expect(pointInPolygon({ x: 210, y: -80 }, doorSwingPolygon(door('d', 'w', 250, 90, { hinge: 'right' }), w, 64))).toBe(false);
    const sideB = bbox(doorSwingPolygon(door('d', 'w', 250, 90, { swingSide: 'b' }), w));
    expect(sideB.minY).toBeCloseTo(5, 6);
    expect(sideB.maxY).toBeCloseTo(95, 6);
  });
  it('zweiflügelig: zwei Sektoren, Vereinigung ≈ 2·π·(w/2)²/4; Schiebetür/Rolltor: Rechteck w × 60', () => {
    const d2 = door('d', 'w', 250, 200, { doorType: 'zweiflügelig' });
    expect(doorSwingSectors(d2, w)).toHaveLength(2);
    const poly = doorSwingPolygon(d2, w, 64);
    const expected = 2 * ((Math.PI * 100 * 100) / 4);
    expect(Math.abs(polygonArea(poly) - expected) / expected).toBeLessThan(0.005);
    const slide = doorSwingPolygon(door('d', 'w', 250, 125, { doorType: 'Schiebetür' }), w);
    expect(slide).toHaveLength(4);
    expect(polygonArea(slide)).toBeCloseTo(125 * SLIDING_DOOR_CLEARANCE, 6);
    expect(doorSwingPolygon(door('d', 'w', 250, 0), w)).toEqual([]);
  });
  it('itemsInDoorSwing findet Objekte im Schwenkbereich', () => {
    const d = door('d', 'w', 250, 90);
    const inside = item('in', 230, -40, 30, 30);
    const outside = item('out', 230, -300, 30, 30);
    const otherSide = item('os', 230, 40, 30, 30);
    const col = item('col', 230, -40, 30, 30, 0, { kind: 'column' });
    expect(itemsInDoorSwing([inside, outside, otherSide, col], [d], [w])).toEqual([{ itemId: 'in', doorId: 'd' }]);
    expect(itemsInDoorSwing([inside], [{ ...d, hidden: true }], [w])).toEqual([]);
    expect(itemsInDoorSwing([inside], [d], [])).toEqual([]);
  });
  it('emergencyExitBlocked prüft Türbreite × 150 cm auf beiden Seiten', () => {
    const d = door('d', 'w', 250, 100, { doorType: 'Notausgang' });
    expect(emergencyExitClearanceRects(d, w)).toHaveLength(2);
    expect(emergencyExitBlocked([item('a', 250, -100, 50, 50)], d, w)).toBe(true);
    expect(emergencyExitBlocked([item('a', 250, 100, 50, 50)], d, w)).toBe(true);
    expect(emergencyExitBlocked([item('a', 250, -200, 50, 50)], d, w)).toBe(false);
    expect(emergencyExitBlocked([item('a', 400, -100, 50, 50)], d, w)).toBe(false);
    expect(emergencyExitBlocked([item('a', 250, -100, 50, 50, 0, { hidden: true })], d, w)).toBe(false);
    expect(emergencyExitBlocked([item('a', 250, -100, 50, 50)], d, w, 60)).toBe(false);
    expect(emergencyExitBlocked([], d, w)).toBe(false);
    const pl = openingPlacement(d, w);
    expect(pl.center).toEqual({ x: 250, y: 0 });
  });
});

describe('escapeRouteBottlenecks', () => {
  it('zwei Geräte mit 100 cm Abstand, minWidth 120 → ein Engpass mit width 100', () => {
    const a = item('a', 0, 0, 100, 100);
    const b = item('b', 200, 0, 100, 100);
    const res = escapeRouteBottlenecks([a, b], [], null, 120);
    expect(res).toHaveLength(1);
    expect(res[0].width).toBe(100);
    expect(res[0].point).toEqual({ x: 100, y: 0 });
    expect(res[0].from).toEqual({ x: 50, y: 0 });
    expect(res[0].to).toEqual({ x: 150, y: 0 });
    expect([res[0].a, res[0].b].sort()).toEqual(['a', 'b']);
    expect(escapeRouteBottlenecks([a, b], [], null, 100)).toEqual([]); // 100 ist nicht < 100
    expect(escapeRouteBottlenecks([a, item('b', 100, 0, 100, 100)], [], null, 120)).toEqual([]); // Berührung = Kollision
    expect(escapeRouteBottlenecks([a, item('b', 200, 300, 100, 100)], [], null, 120)).toEqual([]); // keine Projektionsüberlappung
  });
  it('Sicherheitszonen zählen zur Ausdehnung, wenn aktiv', () => {
    const a = withZone(item('a', 0, 0, 100, 100), 60);
    const b = withZone(item('b', 300, 0, 100, 100), 60);
    const res = escapeRouteBottlenecks([a, b], [], null, 120);
    expect(res).toHaveLength(1);
    expect(res[0].width).toBe(80); // 200 − 2·60
    expect(escapeRouteBottlenecks([a, b], [], null, 120, { includeZones: false })).toEqual([]);
  });
  it('Objekt–Wand und Objekt–Hallenkante, doppelte Hallen-Außenwände dedupliziert', () => {
    const hall: Hall = { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], wallThickness: 24, floorCovering: 'Beton' };
    const inner = hallInnerPolygon(hall);
    const a = item('a', 24 + 90 + 50, 400, 100, 100); // 90 cm zur linken Innenkante
    const res = escapeRouteBottlenecks([a], [], inner, 120);
    expect(res).toHaveLength(1);
    expect(res[0].width).toBeCloseTo(90, 6);
    expect(res[0].b).toBe('hall_3');
    // Hallen-Außenwände zusätzlich als Wände: gleiche ID → kein Duplikat
    const res2 = escapeRouteBottlenecks([a], hallWalls(hall), inner, 120);
    expect(res2).toHaveLength(1);
    // Innenwand: 80 cm Abstand
    const wl = wall('w', 500, 0, 500, 800, 10); // Fläche bei 495
    const b = item('b', 495 - 80 - 50, 400, 100, 100);
    const res3 = escapeRouteBottlenecks([b], [wl], null, 120);
    expect(res3).toHaveLength(1);
    expect(res3[0].width).toBeCloseTo(80, 6);
    expect(res3[0].b).toBe('w');
    expect(res3[0].axis).toBe('x');
  });
  it('Ergebnis nach Breite sortiert, versteckte Objekte ignoriert', () => {
    const a = item('a', 0, 0, 100, 100);
    const b = item('b', 200, 0, 100, 100);
    const c = item('c', 0, 180, 100, 100); // 80 cm unter a
    const h = item('h', 0, -150, 100, 100, 0, { hidden: true });
    const res = escapeRouteBottlenecks([a, b, c, h], [], null, 120);
    expect(res.map((r) => r.width)).toEqual([80, 100]);
    expect(res[0].axis).toBe('y');
  });
});

describe('escapeRouteBottlenecks – Projektionsüberlappung und Rückseite (N7)', () => {
  it('Überlappung der Projektionen unter 60 cm zählt nicht, ab 60 cm schon', () => {
    const a = item('a', 0, 0, 100, 100); // y ∈ [−50, 50]
    expect(escapeRouteBottlenecks([a, item('b', 200, 50, 100, 100)], [], null, 120)).toEqual([]); // 50 cm Überlappung
    expect(escapeRouteBottlenecks([a, item('b', 200, 45, 100, 100)], [], null, 120)).toEqual([]); // 55 cm Überlappung
    const res = escapeRouteBottlenecks([a, item('b', 200, 40, 100, 100)], [], null, 120); // 60 cm Überlappung
    expect(res).toHaveLength(1);
    expect(res[0].axis).toBe('x');
    expect(res[0].width).toBe(100);
  });
  it('Rückseite eines Objekts an der Wand ist kein Laufweg, Vorderseite schon', () => {
    const w = wall('w', 0, 5, 500, 5, 10); // Fläche y ∈ [0, 10]
    const back = item('a', 100, 100, 100, 100, 0); // Rückseite (−y) zeigt zur Wand, Spalt 40 cm
    expect(escapeRouteBottlenecks([back], [w], null, 120)).toEqual([]);
    const front = item('a', 100, 100, 100, 100, 180); // Vorderseite zur Wand
    const res = escapeRouteBottlenecks([front], [w], null, 120);
    expect(res).toHaveLength(1);
    expect(res[0].width).toBeCloseTo(40, 6);
    // Hallenkante ebenso
    const hall: Hall = { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], wallThickness: 24, floorCovering: 'Beton' };
    const inner = hallInnerPolygon(hall);
    const backToHall = item('a', 500, 24 + 40 + 50, 100, 100, 0);
    expect(escapeRouteBottlenecks([backToHall], [], inner, 120)).toEqual([]);
    expect(escapeRouteBottlenecks([{ ...backToHall, rotation: 90 }], [], inner, 120)).toHaveLength(1);
  });
});

describe('Indizes gegen in-place veränderte Arrays (N1)', () => {
  it('itemIndexFor / wallIndexFor bauen bei geänderter Länge neu statt mit undefinierten Einträgen zu rechnen', () => {
    const items = [item('a', 0, 0, 100, 100)];
    const idx = itemIndexFor(items);
    expect(idx.footprints).toHaveLength(1);
    items.push(item('b', 50, 0, 100, 100));
    const idx2 = itemIndexFor(items);
    expect(idx2).not.toBe(idx);
    expect(idx2.footprints).toHaveLength(2);
    expect(findCollisions(items).length).toBe(1);
    const walls = [wall('w', 0, 0, 100, 0)];
    const w1 = wallIndexFor(walls);
    walls.push(wall('w2', 0, 0, 0, 100));
    expect(wallIndexFor(walls).rects).toHaveLength(2);
    expect(wallIndexFor(walls)).not.toBe(w1);
  });
});
