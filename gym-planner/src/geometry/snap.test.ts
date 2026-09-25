import { describe, it, expect } from 'vitest';
import type { PlacedItem, Wall, Hall } from '@/types';
import {
  snapToGrid, snapAngle, snapRotation, snapPoint, snapToGridAlongRay, snapItemPosition,
  snapToWallSide, dockToRack, nearestDistances, itemBounds, type SnapContext,
} from './snap';
import { SpatialHash, buildItemHash, buildWallHash, itemIndexFor } from './spatialHash';
import { itemFootprint } from './transform';
import { bbox } from './polygon';
import { hallInnerPolygon } from './walls';

function item(id: string, x: number, y: number, width: number, depth: number, rotation = 0, extra: Partial<PlacedItem> = {}): PlacedItem {
  return {
    id, kind: 'equipment', defId: 'def', x, y, rotation, width, depth, height: 150,
    safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: false, ...extra,
  };
}
function wall(id: string, sx: number, sy: number, ex: number, ey: number, thickness = 10): Wall {
  return { id, start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness, type: 'Trockenbau', height: null };
}
const base: SnapContext = { gridSize: 10, enabled: true, threshold: 15 };

describe('Raster & Winkel', () => {
  it('Raster 10 cm rundet auf das nächste Vielfache', () => {
    expect(snapToGrid({ x: 123, y: 456 }, 10)).toEqual({ x: 120, y: 460 });
    expect(snapToGrid({ x: 125, y: -7 }, 10)).toEqual({ x: 130, y: -10 });
    expect(snapToGrid({ x: 3, y: 4 }, 0)).toEqual({ x: 3, y: 4 });
  });
  it('snapPoint fängt ohne Ziele auf das Raster', () => {
    const r = snapPoint({ x: 104, y: 97 }, base);
    expect(r.kind).toBe('grid');
    expect(r.point).toEqual({ x: 100, y: 100 });
  });
  it('Winkel-Snapping auf 45°', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 100, y: 95 }, 45);
    const len = Math.hypot(100, 95);
    expect(p.x).toBeCloseTo(Math.cos(Math.PI / 4) * len, 6);
    expect(p.y).toBeCloseTo(Math.sin(Math.PI / 4) * len, 6);
    expect(snapAngle({ x: 0, y: 0 }, { x: 200, y: 8 }, 45)).toEqual({ x: expect.closeTo(Math.hypot(200, 8), 6), y: expect.closeTo(0, 6) });
  });
  it('snapRotation auf 15°-Schritte', () => {
    expect(snapRotation(37)).toBe(30);
    expect(snapRotation(38)).toBe(45);
    expect(snapRotation(91, 90)).toBe(90);
  });
  it('snapToGridAlongRay hält den Winkel und rastet die Länge', () => {
    const p = snapToGridAlongRay({ x: 0, y: 0 }, { x: 70.7, y: 70.7 }, 10);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 6);
    expect(p.x).toBeCloseTo(p.y, 6);
  });
  it('snapPoint mit angleFrom: nahezu waagerecht → exakt waagerecht mit Hilfslinie, Länge auf Raster', () => {
    const r = snapPoint({ x: 203, y: 6 }, { ...base, angleFrom: { x: 0, y: 0 } });
    expect(r.kind).toBe('angle');
    expect(r.point).toEqual({ x: 200, y: 0 });
    expect(r.guides.length).toBeGreaterThan(0);
    expect(r.guides[0].from).toEqual({ x: 0, y: 0 });
  });
  it('Winkelstrahl schneidet Ausrichtungslinie eines Wandknotens', () => {
    const walls = [wall('w1', 350, 300, 350, 500)];
    const r = snapPoint({ x: 343, y: 4 }, { ...base, walls, angleFrom: { x: 0, y: 0 } });
    expect(r.kind).toBe('angle');
    expect(r.point).toEqual({ x: 350, y: 0 });
  });
  it('deaktiviert → unverändert', () => {
    const r = snapPoint({ x: 104, y: 97 }, { ...base, enabled: false });
    expect(r.kind).toBe('none');
    expect(r.point).toEqual({ x: 104, y: 97 });
  });
});

describe('Wände & Halle', () => {
  const walls = [wall('w1', 0, 0, 300, 0), wall('w2', 300, 0, 300, 200)];
  it('Wandende gewinnt gegen Raster innerhalb der Schwelle', () => {
    const r = snapPoint({ x: 292, y: 6 }, { ...base, walls });
    expect(r.kind).toBe('wall-end');
    expect(r.point).toEqual({ x: 300, y: 0 });
    expect(r.guides.length).toBe(2); // Kreuz-Marker
  });
  it('Wandende gewinnt gegen Wandmitte, nächstgelegenes gleicher Priorität gewinnt', () => {
    const r = snapPoint({ x: 296, y: 190 }, { ...base, walls });
    expect(r.kind).toBe('wall-end');
    expect(r.point).toEqual({ x: 300, y: 200 });
  });
  it('Wandmitte mit Linie entlang der Wand', () => {
    const r = snapPoint({ x: 154, y: 8 }, { ...base, walls });
    expect(r.kind).toBe('wall-mid');
    expect(r.point).toEqual({ x: 150, y: 0 });
    expect(r.guides[0]).toEqual({ from: { x: 0, y: 0 }, to: { x: 300, y: 0 }, kind: 'wall-mid' });
  });
  it('Ziele lassen sich abschalten, ignorierte Wände werden übersprungen', () => {
    const r = snapPoint({ x: 292, y: 6 }, { ...base, walls, targets: { 'wall-end': false, 'wall-mid': false, 'item-edge': false } });
    expect(r.kind).toBe('grid');
    const r2 = snapPoint({ x: 292, y: 6 }, { ...base, walls, ignoreIds: new Set(['w1', 'w2']) });
    expect(r2.kind).toBe('grid');
  });
  it('Hallen-Ecken (außen und innen) werden gefangen', () => {
    const hall: Hall = { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], wallThickness: 24, floorCovering: 'Beton' };
    const outer = snapPoint({ x: 5, y: -4 }, { ...base, hall });
    expect(outer.kind).toBe('hall-vertex');
    expect(outer.point).toEqual({ x: 0, y: 0 });
    const inner = snapPoint({ x: 28, y: 20 }, { ...base, hall });
    expect(inner.kind).toBe('hall-vertex');
    expect(inner.point.x).toBeCloseTo(24, 6);
    expect(inner.point.y).toBeCloseTo(24, 6);
  });
});

describe('Objekte & Achsen-Ausrichtung', () => {
  const items = [item('a', 500, 500, 100, 100), item('b', 900, 300, 60, 120)];
  it('Objektecke wird gefangen und liefert die beiden Kanten als Hilfslinien', () => {
    const r = snapPoint({ x: 553, y: 447 }, { ...base, items });
    expect(r.kind).toBe('item-edge');
    expect(r.point).toEqual({ x: 550, y: 450 });
    expect(r.guides.length).toBe(2);
  });
  it('Achsen-Ausrichtung: nur x fängt (Objektkante) und liefert vertikale Hilfslinie', () => {
    const r = snapPoint({ x: 553, y: 700 }, { ...base, items });
    expect(r.kind).toBe('item-edge');
    expect(r.point).toEqual({ x: 550, y: 700 });
    expect(r.guides.length).toBe(1);
    const g = r.guides[0];
    expect(g.from.x).toBe(550);
    expect(g.to.x).toBe(550);
    expect(g.from.y).toBe(450);
    expect(g.to.y).toBe(700);
  });
  it('Achsen-Ausrichtung: y am Objektzentrum, x frei auf Raster', () => {
    const r = snapPoint({ x: 123, y: 306 }, { ...base, items });
    expect(r.kind).toBe('item-edge');
    expect(r.point).toEqual({ x: 120, y: 300 });
    expect(r.guides[0].from.y).toBe(300);
  });
  it('ignoriertes Objekt liefert keine Kandidaten', () => {
    const r = snapPoint({ x: 553, y: 447 }, { ...base, items, ignoreIds: new Set(['a']) });
    expect(r.kind).toBe('grid');
  });
});

describe('snapItemPosition', () => {
  it('fängt die linke Kante an der rechten Kante des Nachbarn (Kante an Kante)', () => {
    const others = [item('a', 500, 500, 100, 100)];
    const me = { id: 'me', x: 0, y: 0, width: 80, depth: 60, rotation: 0 };
    const r = snapItemPosition(me, { x: 596, y: 503 }, { ...base, items: others });
    expect(r.kind).toBe('item-edge');
    expect(r.point.x).toBe(590); // linke Kante bei 550
    expect(r.point.y).toBe(500); // Zentrum an Zentrum (503 → 500)
    const g = r.guides.find((x) => x.from.x === 550 && x.to.x === 550);
    expect(g).toBeDefined();
  });
  it('gedrehtes Objekt: Bounding-Box wird verwendet', () => {
    const others = [item('a', 500, 500, 100, 100)];
    const me = { id: 'me', x: 0, y: 0, width: 80, depth: 60, rotation: 90 }; // Box 60 × 80
    const r = snapItemPosition(me, { x: 584, y: 700 }, { ...base, items: others });
    expect(r.point.x).toBe(580); // linke Kante (584-30=554) → 550
  });
  it('fängt an der Wandinnenseite und an der Hallen-Innenkante', () => {
    const walls = [wall('w1', 300, 0, 300, 500, 10)]; // Flächen bei 295 / 305
    const me = { id: 'me', x: 0, y: 0, width: 100, depth: 50, rotation: 0 };
    const r = snapItemPosition(me, { x: 362, y: 250 }, { ...base, walls });
    expect(r.point.x).toBe(355); // linke Kante 312 → 305
    const hall: Hall = { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], wallThickness: 24, floorCovering: 'Beton' };
    const r2 = snapItemPosition(me, { x: 500, y: 43 }, { ...base, hall });
    expect(r2.point.y).toBeCloseTo(49, 6); // obere Kante 18 → 24
  });
  it('Auswahl (ignoreIds) und das Objekt selbst werden ausgeschlossen, sonst Raster', () => {
    const others = [item('me', 500, 500, 100, 100), item('sel', 700, 500, 100, 100)];
    const me = { id: 'me', x: 500, y: 500, width: 100, depth: 100, rotation: 0 };
    const r = snapItemPosition(me, { x: 503, y: 504 }, { ...base, items: others, ignoreIds: new Set(['sel']) });
    expect(r.kind).toBe('grid');
    expect(r.point).toEqual({ x: 500, y: 500 });
  });
  it('läuft bei 500 Objekten in unter 2 ms (warm)', () => {
    const items: PlacedItem[] = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < 500; i++) items.push(item(`i${i}`, rnd() * 4000, rnd() * 3000, 60 + rnd() * 150, 60 + rnd() * 200, Math.floor(rnd() * 4) * 90));
    const walls: Wall[] = [wall('w1', 0, 0, 4000, 0, 24), wall('w2', 4000, 0, 4000, 3000, 24), wall('w3', 0, 3000, 4000, 3000, 24), wall('w4', 0, 0, 0, 3000, 24)];
    const me = { id: 'x', x: 0, y: 0, width: 100, depth: 100, rotation: 0 };
    const ctx: SnapContext = { ...base, items, walls, threshold: 12 };
    snapItemPosition(me, { x: 1000, y: 1000 }, ctx); // Index-Aufbau (gecacht)
    const t0 = performance.now();
    const runs = 50;
    for (let k = 0; k < runs; k++) snapItemPosition(me, { x: 500 + k * 50, y: 800 + k * 30 }, ctx);
    const per = (performance.now() - t0) / runs;
    expect(per).toBeLessThan(2);
  });
});

describe('snapToWallSide', () => {
  it('richtet die Rückseite bündig an der Wandfläche aus und dreht passend', () => {
    const walls = [wall('w1', 0, 0, 400, 0, 10)];
    // Objekt unterhalb der Wand
    const r = snapToWallSide({ x: 200, y: 40, width: 100, depth: 50, rotation: 33 }, walls, 40);
    expect(r).not.toBeNull();
    expect(r!.wallId).toBe('w1');
    expect(r!.x).toBe(200);
    expect(r!.y).toBeCloseTo(5 + 25, 6); // Wandfläche 5 + halbe Tiefe
    expect(r!.rotation).toBe(0); // Vorderseite zeigt nach unten (+y), Rückseite zur Wand
    // Objekt oberhalb der Wand
    const r2 = snapToWallSide({ x: 50, y: -60, width: 100, depth: 50, rotation: 0 }, walls, 40);
    expect(r2!.y).toBeCloseTo(-30, 6);
    expect(r2!.rotation).toBe(180);
    expect(r2!.x).toBe(50); // seitlich innerhalb der Wand (halbe Breite)
  });
  it('vertikale Wand: Objekt rechts davon → Rotation 270', () => {
    const walls = [wall('w1', 0, 0, 0, 400, 10)];
    const r = snapToWallSide({ x: 40, y: 200, width: 80, depth: 40, rotation: 0 }, walls, 40);
    expect(r!.x).toBeCloseTo(25, 6);
    expect(r!.rotation).toBe(270);
    // Prüfung: Rückseite (lokal −y) liegt bei x = 5
    const b = bbox(itemFootprint({ x: r!.x, y: r!.y, width: 80, depth: 40, rotation: r!.rotation }));
    expect(b.minX).toBeCloseTo(5, 6);
  });
  it('null, wenn zu weit weg oder keine Wände', () => {
    const walls = [wall('w1', 0, 0, 400, 0, 10)];
    expect(snapToWallSide({ x: 200, y: 300, width: 100, depth: 50, rotation: 0 }, walls, 40)).toBeNull();
    expect(snapToWallSide({ x: 200, y: 10, width: 100, depth: 50, rotation: 0 }, [], 40)).toBeNull();
  });
});

describe('dockToRack', () => {
  const rack = item('rack', 0, 0, 165, 203); // Atlantis C513
  it('dockt ein Modul bündig an die linke Rackseite', () => {
    const module = { id: 'ms3', x: -130, y: 10, width: 65, depth: 79, rotation: 0 };
    const r = dockToRack(module, [rack]);
    expect(r).not.toBeNull();
    expect(r!.dockedTo).toBe('rack');
    expect(r!.side).toBe('left');
    expect(r!.rotation).toBe(90);
    expect(r!.x).toBeCloseTo(-82.5 - 39.5, 6);
    expect(r!.y).toBeCloseTo(10, 6);
    const b = bbox(itemFootprint({ x: r!.x, y: r!.y, width: 65, depth: 79, rotation: r!.rotation }));
    expect(b.maxX).toBeCloseTo(-82.5, 6); // bündig
    expect(b.minX).toBeCloseTo(-82.5 - 79, 6);
  });
  it('dockt hinten und hält das Modul seitlich innerhalb der Rackseite', () => {
    const module = { id: 'ms3', x: 60, y: -170, width: 65, depth: 79, rotation: 0 };
    const r = dockToRack(module, [rack]);
    expect(r!.side).toBe('back');
    expect(r!.rotation).toBe(180);
    expect(r!.y).toBeCloseTo(-101.5 - 39.5, 6);
    expect(r!.x).toBeCloseTo(82.5 - 32.5, 6); // geklemmt
  });
  it('gedrehtes Rack (90°): rechte Seite liegt unten', () => {
    const rot = item('rack', 0, 0, 165, 203, 90);
    const module = { id: 'm', x: 0, y: 140, width: 65, depth: 79, rotation: 0 };
    const r = dockToRack(module, [rot]);
    expect(r!.side).toBe('right');
    expect(r!.y).toBeCloseTo(82.5 + 39.5, 6);
    expect(r!.rotation).toBe(0);
  });
  it('null bei Abstand > 150 cm, versteckte Racks ignoriert', () => {
    expect(dockToRack({ id: 'm', x: -400, y: 0, width: 65, depth: 79, rotation: 0 }, [rack])).toBeNull();
    expect(dockToRack({ id: 'm', x: -130, y: 0, width: 65, depth: 79, rotation: 0 }, [{ ...rack, hidden: true }])).toBeNull();
  });
});

describe('nearestDistances', () => {
  it('liefert Abstände zu Objekt, Wand und Hallenkante mit Maßlinien', () => {
    const me = { id: 'me', x: 500, y: 500, width: 100, depth: 100, rotation: 0 };
    const others = [item('r', 800, 520, 100, 100), item('far', 500, 3000, 100, 100), item('offband', 800, 800, 50, 50)];
    const walls = [wall('w', 0, 200, 1000, 200, 20)]; // Unterkante bei 210
    const hall: Hall = { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }], wallThickness: 24, floorCovering: 'Beton' };
    const res = nearestDistances(me, others, walls, { hallInner: hallInnerPolygon(hall) });
    const by = Object.fromEntries(res.map((r) => [r.side, r]));
    expect(by.right.distance).toBe(200);
    expect(by.right.targetId).toBe('r');
    expect(by.right.from).toEqual({ x: 750, y: 510 });
    expect(by.right.to).toEqual({ x: 550, y: 510 });
    expect(by.top.distance).toBe(240);
    expect(by.top.targetId).toBe('w');
    expect(by.left.distance).toBeCloseTo(450 - 24, 6);
    expect(by.left.targetId).toBe('hall_3');
    expect(by.bottom.distance).toBeCloseTo(1000 - 24 - 550, 6);
  });
  it('Hindernis außerhalb des Bandes oder zu weit entfernt wird ignoriert', () => {
    const me = { id: 'me', x: 500, y: 500, width: 100, depth: 100, rotation: 0 };
    const res = nearestDistances(me, [item('a', 500, 3000, 100, 100), item('b', 900, 900, 100, 100)], []);
    expect(res).toEqual([]);
  });
  it('gedrehtes Hindernis: exakte Ausdehnung im Band statt Bounding-Box', () => {
    const me = { id: 'me', x: 0, y: 0, width: 100, depth: 100, rotation: 0 };
    const diamond = item('d', 300, 0, 100, 100, 45); // Spitze bei x = 300 - 70.7
    const res = nearestDistances(me, [diamond], []);
    const right = res.find((r) => r.side === 'right')!;
    expect(right.distance).toBeCloseTo(300 - 50 * Math.SQRT2 - 50, 4);
  });
});

describe('SpatialHash', () => {
  it('liefert jeden Treffer genau einmal und filtert per Box', () => {
    const h = new SpatialHash<string>(100);
    h.insert('a', { minX: 0, minY: 0, maxX: 350, maxY: 50 }); // 4 Zellen
    h.insert('b', { minX: 900, minY: 900, maxX: 950, maxY: 950 });
    h.insert('c', { minX: NaN, minY: 0, maxX: 1, maxY: 1 });
    expect(h.size).toBe(2);
    expect(h.query({ minX: -10, minY: -10, maxX: 400, maxY: 100 })).toEqual(['a']);
    expect(h.query({ minX: 120, minY: 60, maxX: 130, maxY: 80 })).toEqual([]); // Zelle getroffen, Box nicht
    expect(h.query({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 }).sort()).toEqual(['a', 'b']); // linearer Fallback
    h.clear();
    expect(h.query({ minX: 0, minY: 0, maxX: 100, maxY: 100 })).toEqual([]);
  });
  it('buildItemHash/buildWallHash überspringen versteckte Elemente, Index ist gecacht', () => {
    const items = [item('a', 0, 0, 100, 100), item('b', 500, 500, 100, 100, 0, { hidden: true })];
    expect(buildItemHash(items).size).toBe(1);
    expect(buildWallHash([wall('w', 0, 0, 100, 0), { ...wall('h', 0, 0, 100, 0), hidden: true }]).size).toBe(1);
    expect(itemIndexFor(items)).toBe(itemIndexFor(items));
    expect(itemIndexFor(items).boxes[0]).toEqual(itemBounds(items[0]));
  });
});
