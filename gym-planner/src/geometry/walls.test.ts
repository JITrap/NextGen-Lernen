import { describe, it, expect } from 'vitest';
import type { Wall, Opening } from '@/types';
import {
  wallOutline, wallOutlines, wallJoinPolygons, mergeCollinearWalls, mergeCollinearWallsDetailed,
  splitWallsAtIntersections, splitWallsAtIntersectionsDetailed, wallsBoundingBox, wallRect, hallWalls, allWalls, wallNodes,
  splitWall, reassignOpeningsAfterSplit, wallNormal, findWall,
} from './walls';
import { createHall } from '@/store/factories';
import { polygonArea, pointInPolygon } from './polygon';

let counter = 0;
function wall(x1: number, y1: number, x2: number, y2: number, thickness = 10, extra: Partial<Wall> = {}): Wall {
  return { id: `w${++counter}`, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, type: 'Trockenbau', height: null, ...extra };
}
function expectPoint(p: { x: number; y: number }, x: number, y: number) {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
}
function hasPoint(poly: { x: number; y: number }[], x: number, y: number): boolean {
  return poly.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
}

describe('wallOutline – Ecken', () => {
  it('äußere Ecke zweier 24-cm-Wände im rechten Winkel liegt auf (−12, −12) relativ zum Knoten', () => {
    const w1 = wall(0, 0, 500, 0, 24);
    const w2 = wall(0, 0, 0, 400, 24);
    const all = [w1, w2];
    const o1 = wallOutline(w1, all);
    const o2 = wallOutline(w2, all);
    // Beide Wände laufen in den +x/+y-Quadranten → Außenecke bei (−12,−12), Innenecke bei (12,12)
    expect(hasPoint(o1, -12, -12)).toBe(true);
    expect(hasPoint(o1, 12, 12)).toBe(true);
    expect(hasPoint(o2, -12, -12)).toBe(true);
    expect(hasPoint(o2, 12, 12)).toBe(true);
    // Reihenfolge wie wallRect: start-a, end-a, end-b, start-b
    expectPoint(o1[0], -12, -12);
    expectPoint(o1[3], 12, 12);
    expectPoint(o1[1], 500, -12);
    expectPoint(o1[2], 500, 12);
    expect(o1).toHaveLength(4);
  });

  it('Ecke mit unterschiedlichen Stärken', () => {
    const w1 = wall(0, 0, 500, 0, 24);
    const w2 = wall(0, 0, 0, 400, 10);
    const all = [w1, w2];
    const o1 = wallOutline(w1, all);
    const o2 = wallOutline(w2, all);
    expect(hasPoint(o1, -5, -12)).toBe(true);
    expect(hasPoint(o1, 5, 12)).toBe(true);
    expect(hasPoint(o2, -5, -12)).toBe(true);
    expect(hasPoint(o2, 5, 12)).toBe(true);
  });

  it('Ecke unabhängig von der Zeichenrichtung', () => {
    const w1 = wall(500, 0, 0, 0, 24);
    const w2 = wall(0, 400, 0, 0, 24);
    const all = [w1, w2];
    expect(hasPoint(wallOutline(w1, all), -12, -12)).toBe(true);
    expect(hasPoint(wallOutline(w2, all), 12, 12)).toBe(true);
  });

  it('freie Wand ohne Nachbarn bleibt Rechteck', () => {
    const w = wall(100, 100, 400, 100, 10);
    expect(wallOutline(w, [w])).toEqual(wallRect(w));
  });

  it('Wand mit Nulllänge ist ungefährlich', () => {
    const w = wall(100, 100, 100, 100, 10);
    expect(wallOutline(w, [w, wall(0, 0, 50, 0)])).toHaveLength(4);
  });

  it('kollineare Kette läuft mit Rechteck-Ende durch', () => {
    const w1 = wall(0, 0, 500, 0, 10);
    const w2 = wall(500, 0, 1000, 0, 10);
    const all = [w1, w2];
    expect(wallOutline(w1, all)).toEqual(wallRect(w1));
    expect(wallOutline(w2, all)).toEqual(wallRect(w2));
  });

  it('45°-Gehrung', () => {
    const w1 = wall(0, 0, 500, 0, 10);
    const w2 = wall(0, 0, -300, 300, 10);
    const o1 = wallOutline(w1, [w1, w2]);
    // Innenecke liegt auf der Seitenlinie y = 5 von w1, Gehrung 135° → x = 5·tan(22,5°) − 5/tan(22,5°)… hier nur Plausibilität
    const inner = o1.find((p) => Math.abs(p.y - 5) < 1e-6 && p.x < 100)!;
    expect(inner).toBeDefined();
    expect(Math.hypot(inner.x, inner.y)).toBeLessThan(3 * 10);
    // Beide Wandpolygone teilen sich exakt die beiden Eckpunkte
    const o2 = wallOutline(w2, [w1, w2]);
    const shared = o1.filter((p) => o2.some((q) => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6));
    expect(shared).toHaveLength(2);
  });

  it('Vorschau-Wand, die nicht in `all` enthalten ist, wird trotzdem angeschlossen', () => {
    const w1 = wall(0, 0, 500, 0, 24);
    const preview = wall(0, 0, 0, 400, 24);
    expect(hasPoint(wallOutline(preview, [w1]), -12, -12)).toBe(true);
  });
});

describe('wallOutline – T-Stöße und Kreuzungen', () => {
  it('endende Wand reicht exakt bis zur Fläche der durchgehenden Wand (Ende auf der Achse)', () => {
    const through = wall(0, 0, 1000, 0, 24);
    const w = wall(500, 300, 500, 0, 10);
    const all = [through, w];
    const o = wallOutline(w, all);
    // Wand läuft in −y, Normale n = (d.y, −d.x)·5 = (−5, 0) → Seite a links (x = 495)
    expectPoint(o[0], 495, 300);
    expectPoint(o[1], 495, 12);
    expectPoint(o[2], 505, 12);
    expectPoint(o[3], 505, 300);
    // Durchgehende Wand bleibt Rechteck
    expect(wallOutline(through, all)).toEqual(wallRect(through));
  });

  it('endende Wand, die an der Fläche (nicht Achse) endet, wird nicht verlängert/verkürzt', () => {
    const through = wall(0, 0, 1000, 0, 24);
    const w = wall(500, 300, 500, 12, 10);
    const o = wallOutline(w, [through, w]);
    expectPoint(o[1], 495, 12);
    expectPoint(o[2], 505, 12);
  });

  it('endende Wand, die leicht in die andere hineinragt, wird auf die Fläche gekürzt', () => {
    const through = wall(0, 0, 1000, 0, 24);
    const w = wall(500, 300, 500, -8, 10);
    const o = wallOutline(w, [through, w]);
    expectPoint(o[1], 495, 12);
    expectPoint(o[2], 505, 12);
  });

  it('T-Stoß aus drei Wänden am Knoten: durchgehende Wände bleiben Rechteck, endende reicht zur Fläche', () => {
    const left = wall(0, 0, 500, 0, 24);
    const right = wall(500, 0, 1000, 0, 24);
    const w = wall(500, 300, 500, 0, 10);
    const all = [left, right, w];
    expect(wallOutline(left, all)).toEqual(wallRect(left));
    expect(wallOutline(right, all)).toEqual(wallRect(right));
    const o = wallOutline(w, all);
    expectPoint(o[1], 495, 12);
    expectPoint(o[2], 505, 12);
    expect(wallJoinPolygons(all)).toHaveLength(0);
  });

  it('Kreuzung (4 Wände am Knoten): alle laufen durch', () => {
    const all = [wall(0, 0, 500, 0, 10), wall(500, 0, 1000, 0, 10), wall(500, -300, 500, 0, 10), wall(500, 0, 500, 300, 10)];
    for (const w of all) expect(wallOutline(w, all)).toEqual(wallRect(w));
    expect(wallJoinPolygons(all)).toHaveLength(0);
  });

  it('T-Stoß schräg: endende Wand reicht bis zur Fläche, ohne Überstand', () => {
    const through = wall(0, 0, 1000, 0, 24);
    const w = wall(300, 300, 500, 0, 10);
    const o = wallOutline(w, [through, w]);
    expect(o[1].y).toBeCloseTo(12, 6);
    expect(o[2].y).toBeCloseTo(12, 6);
  });
});

describe('wallJoinPolygons', () => {
  it('Y-Stoß erzeugt ein Füllpolygon um den Knoten', () => {
    const c = { x: 500, y: 500 };
    const all: Wall[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      all.push(wall(c.x, c.y, c.x + 400 * Math.cos(a), c.y + 400 * Math.sin(a), 12));
    }
    const joins = wallJoinPolygons(all);
    expect(joins).toHaveLength(1);
    expect(joins[0].length).toBe(3);
    expect(pointInPolygon(c, joins[0])).toBe(true);
    // Das Dreieck hat Seitenlänge 12/√3·… – Fläche > 0 und klein
    expect(polygonArea(joins[0])).toBeGreaterThan(1);
    expect(polygonArea(joins[0])).toBeLessThan(200);
  });

  it('Kollineares Paar unterschiedlicher Stärke + dritte Wand → Füllpolygon', () => {
    const all = [wall(0, 0, 500, 0, 24), wall(500, 0, 1000, 0, 10), wall(500, 300, 500, 0, 10)];
    expect(wallJoinPolygons(all)).toHaveLength(1);
  });

  it('rechte Ecke braucht kein Füllpolygon', () => {
    expect(wallJoinPolygons([wall(0, 0, 500, 0, 24), wall(0, 0, 0, 400, 24)])).toHaveLength(0);
  });
});

describe('wallOutlines', () => {
  it('liefert je Wand ein Polygon, identisch mit wallOutline', () => {
    const all = [wall(0, 0, 500, 0, 24), wall(500, 0, 500, 400, 24), wall(500, 400, 0, 400, 24), wall(0, 400, 0, 0, 24)];
    const m = wallOutlines(all);
    expect(m.size).toBe(4);
    for (const w of all) expect(m.get(w.id)).toEqual(wallOutline(w, all));
    // geschlossener Ring: Außenecken
    expect(hasPoint(m.get(all[0].id)!, -12, -12)).toBe(true);
    expect(hasPoint(m.get(all[1].id)!, 512, 412)).toBe(true);
  });

  it('funktioniert mit Hallen-Außenwänden', () => {
    const hall = createHall(2500, 2000);
    const walls = hallWalls(hall);
    const m = wallOutlines(walls);
    // Außenecke der Halle exakt bei (0,0), Innenecke bei (24,24)
    const first = m.get('hall_0')!;
    expect(hasPoint(first, 0, 0)).toBe(true);
    expect(hasPoint(first, 24, 24)).toBe(true);
  });

  it('500 Wände in vertretbarer Zeit', () => {
    const all: Wall[] = [];
    for (let i = 0; i < 25; i++) {
      for (let j = 0; j < 10; j++) {
        all.push(wall(i * 100, j * 100, i * 100 + 100, j * 100, 10));
        all.push(wall(i * 100, j * 100, i * 100, j * 100 + 100, 10));
      }
    }
    const t0 = performance.now();
    const m = wallOutlines(all);
    const dt = performance.now() - t0;
    expect(m.size).toBe(500);
    expect(dt).toBeLessThan(200);
  });
});

describe('splitWallsAtIntersections', () => {
  it('Kreuz (+) → 4 Teilstücke, erste behalten IDs', () => {
    const h = wall(0, 500, 1000, 500, 10);
    const v = wall(500, 0, 500, 1000, 10);
    const out = splitWallsAtIntersections([h, v]);
    expect(out).toHaveLength(4);
    expect(out[0].id).toBe(h.id);
    expect(out[2].id).toBe(v.id);
    expectPoint(out[0].start, 0, 500);
    expectPoint(out[0].end, 500, 500);
    expectPoint(out[1].start, 500, 500);
    expectPoint(out[1].end, 1000, 500);
    expect(out[1].id).not.toBe(h.id);
    expectPoint(out[2].end, 500, 500);
    expectPoint(out[3].start, 500, 500);
    expect(new Set(out.map((w) => w.id)).size).toBe(4);
  });

  it('T-Stoß (Ende auf der Fläche) teilt die durchgehende Wand am Fußpunkt', () => {
    const through = wall(0, 0, 1000, 0, 24);
    const w = wall(400, 300, 400, 12, 10);
    const out = splitWallsAtIntersections([through, w]);
    expect(out).toHaveLength(3);
    expectPoint(out[0].end, 400, 0);
    expectPoint(out[1].start, 400, 0);
    expect(out[2]).toBe(w);
  });

  it('nichts zu teilen → Wände unverändert (gleiche Referenzen)', () => {
    const a = wall(0, 0, 500, 0);
    const b = wall(0, 0, 0, 500);
    const out = splitWallsAtIntersections([a, b]);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
  });

  it('Hallenwände werden nicht geteilt, teilen aber Innenwände', () => {
    const hall = createHall(2500, 2000);
    const inner = wall(1000, 24, 1000, 1976, 12.5);
    const cross = wall(24, 1000, 2476, 1000, 12.5);
    const out = splitWallsAtIntersections(allWalls({ hall, walls: [inner, cross] }));
    expect(out.filter((w) => w.id.startsWith('hall_'))).toHaveLength(4);
    expect(out).toHaveLength(8);
  });

  it('Öffnungen wandern auf das richtige Teilstück', () => {
    const h = wall(0, 500, 1000, 500, 10);
    const v = wall(500, 0, 500, 1000, 10);
    const door: Opening = { id: 'd1', kind: 'door', wallId: h.id, offset: 800, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' };
    const { walls, openings } = splitWallsAtIntersectionsDetailed([h, v], [door]);
    expect(openings[0].wallId).toBe(walls[1].id);
    expect(openings[0].offset).toBeCloseTo(300, 6);
  });
});

describe('mergeCollinearWalls', () => {
  it('verbindet zwei kollineare Wände gleicher Eigenschaften', () => {
    const a = wall(0, 0, 500, 0, 10);
    const b = wall(500, 0, 1000, 0, 10);
    const out = mergeCollinearWalls([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(a.id);
    expectPoint(out[0].start, 0, 0);
    expectPoint(out[0].end, 1000, 0);
  });

  it('Kette aus drei Wänden, gemischte Richtungen', () => {
    const a = wall(0, 0, 500, 0, 10);
    const b = wall(1000, 0, 500, 0, 10);
    const c = wall(1000, 0, 1500, 0, 10);
    const out = mergeCollinearWalls([a, b, c]);
    expect(out).toHaveLength(1);
    expectPoint(out[0].start, 0, 0);
    expectPoint(out[0].end, 1500, 0);
  });

  it('nicht bei unterschiedlicher Stärke, Typ oder drittem Anschluss', () => {
    expect(mergeCollinearWalls([wall(0, 0, 500, 0, 10), wall(500, 0, 1000, 0, 12.5)])).toHaveLength(2);
    expect(mergeCollinearWalls([wall(0, 0, 500, 0, 10), wall(500, 0, 1000, 0, 10, { type: 'Glaswand' })])).toHaveLength(2);
    expect(mergeCollinearWalls([wall(0, 0, 500, 0, 10), wall(500, 0, 1000, 0, 10), wall(500, 0, 500, 300, 10)])).toHaveLength(3);
    expect(mergeCollinearWalls([wall(0, 0, 500, 0, 10), wall(500, 0, 500, 500, 10)])).toHaveLength(2);
  });

  it('rechnet Öffnungen um', () => {
    const a = wall(1000, 0, 500, 0, 10);
    const b = wall(500, 0, 0, 0, 10);
    const door: Opening = { id: 'd1', kind: 'door', wallId: b.id, offset: 100, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' };
    const { walls, openings, merged } = mergeCollinearWallsDetailed([a, b], [door]);
    expect(walls).toHaveLength(1);
    expect(merged).toEqual([{ keptId: a.id, removedId: b.id }]);
    expect(openings[0].wallId).toBe(a.id);
    // Türmitte war bei x=400 → 600 cm ab Anfang (x=1000)
    expect(openings[0].offset).toBeCloseTo(600, 6);
  });
});

describe('wallsBoundingBox / wallNodes', () => {
  it('Bounding-Box inkl. Stärke', () => {
    const b = wallsBoundingBox([wall(0, 0, 500, 0, 24), wall(500, 0, 500, 400, 10)]);
    expect(b).toEqual({ minX: -12, minY: -12, maxX: 512, maxY: 405 });
    expect(wallsBoundingBox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
  it('Knoten dedupliziert', () => {
    expect(wallNodes([wall(0, 0, 500, 0), wall(500, 0.2, 500, 400), wall(500, 400, 0, 400)])).toHaveLength(4);
  });
});

describe('hallWalls – stabile IDs auf dem rohen Außenpolygon (M2)', () => {
  const base = [{ x: 0, y: 0 }, { x: 1250, y: 0 }, { x: 2500, y: 0 }, { x: 2500, y: 2000 }, { x: 0, y: 2000 }];
  const rightWall = (walls: Wall[]) => walls.find((w) => Math.abs(w.start.x - 2488) < 1e-6 && Math.abs(w.end.x - 2488) < 1e-6)!;

  it('kollinearer Zwischenpunkt: Index = Index der Außenkante, rechte Wand bleibt hall_2 nach 1 cm Verschiebung', () => {
    const hall = createHall(2500, 2000, { polygon: base });
    const walls = hallWalls(hall);
    expect(walls.map((w) => w.id)).toEqual(['hall_0', 'hall_1', 'hall_2', 'hall_3', 'hall_4']);
    expect(rightWall(walls).id).toBe('hall_2');
    // obere Kante in zwei Wänden, Achse 12 cm innen, an der Ecke (0,0) auf Gehrung (12,12)
    expectPoint(walls[0].start, 12, 12);
    expectPoint(walls[0].end, 1250, 12);
    expectPoint(walls[1].start, 1250, 12);
    expectPoint(walls[1].end, 2488, 12);
    expectPoint(walls[2].end, 2488, 1988);
    // Punkt 1 um 1 cm bewegt → keine kollineare Ecke mehr, aber gleiche IDs
    const moved = createHall(2500, 2000, { polygon: base.map((p, i) => (i === 1 ? { x: 1250, y: -1 } : p)) });
    const walls2 = hallWalls(moved);
    expect(walls2.map((w) => w.id)).toEqual(['hall_0', 'hall_1', 'hall_2', 'hall_3', 'hall_4']);
    expect(rightWall(walls2).id).toBe('hall_2');
    expect(findWall({ hall: moved, walls: [] }, 'hall_2')!.start.x).toBeCloseTo(2488, 6);
    // Tür an hall_2 bleibt an der rechten Wand
    for (const w of walls2) expect(w.end.x - w.start.x !== 0 || w.end.y - w.start.y !== 0).toBe(true);
  });

  it('Kante ohne Länge liefert keine Wand, die Nummerierung der übrigen bleibt', () => {
    const hall = createHall(2500, 2000, { polygon: [{ x: 0, y: 0 }, { x: 2500, y: 0 }, { x: 2500, y: 0 }, { x: 2500, y: 2000 }, { x: 0, y: 2000 }] });
    const walls = hallWalls(hall);
    expect(walls.map((w) => w.id)).toEqual(['hall_0', 'hall_2', 'hall_3', 'hall_4']);
    expectPoint(walls[0].end, 2488, 12);
    expectPoint(walls[1].start, 2488, 12);
    expect(rightWall(walls).id).toBe('hall_2');
  });

  it('gegen den Uhrzeigersinn gezeichnete Halle: Index = Kante, Seite „a“ liegt außen', () => {
    const ccw = [...createHall(1000, 800).polygon].reverse(); // (0,800),(1000,800),(1000,0),(0,0)
    const walls = hallWalls(createHall(1000, 800, { polygon: ccw }));
    expect(walls.map((w) => w.id)).toEqual(['hall_0', 'hall_1', 'hall_2', 'hall_3']);
    // Kante 0 = untere Kante (0,800)→(1000,800): Achse bei y = 788, Normale „a“ zeigt nach außen (+y)
    expect(walls[0].start.y).toBeCloseTo(788, 6);
    expect(wallNormal(walls[0]).y).toBeCloseTo(1, 6);
    // Kante 2 = obere Kante: Normale nach oben (−y)
    expect(walls[2].start.y).toBeCloseTo(12, 6);
    expect(wallNormal(walls[2]).y).toBeCloseTo(-1, 6);
    expect(wallNodes(walls)).toHaveLength(4);
  });

  it('spitze Ecke: Achsen-Endpunkte werden gekappt statt weit hinaus zu laufen', () => {
    const hall = createHall(2500, 2000, { polygon: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 0, y: 300 }], wallThickness: 24 });
    const walls = hallWalls(hall);
    expect(walls).toHaveLength(3);
    // Ecke (2000,0) mit ≈ 8,5°: Gehrung wäre ≈ 12 / sin(4,27°) ≈ 161 cm → gekappt auf 4 × 12 = 48 cm
    const tip = walls[0].end;
    expect(Math.hypot(tip.x - 2000, tip.y)).toBeCloseTo(48, 6);
    expect(tip.x).toBeLessThan(2000);
    expect(pointInPolygon(tip, hall.polygon)).toBe(true);
  });
});

describe('Öffnungen beim Teilen – nie über das Wandende hinaus (M6)', () => {
  const doorAt = (wallId: string, offset: number, width: number): Opening => ({ id: 'd', kind: 'door', wallId, offset, width, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' });
  it('splitWallsAtIntersectionsDetailed: Tür über dem Teilungspunkt wird auf das nähere Teilstück begrenzt', () => {
    const h = wall(0, 0, 1000, 0, 10);
    const v = wall(500, -300, 500, 300, 10);
    const { walls, openings } = splitWallsAtIntersectionsDetailed([h, v], [doorAt(h.id, 520, 100)]);
    const part = walls.find((w) => w.id === openings[0].wallId)!;
    expectPoint(part.start, 500, 0);
    expectPoint(part.end, 1000, 0);
    // vorher: offset 20 → Tür ragte 30 cm über das Wandende; jetzt beginnt sie am Wandanfang
    expect(openings[0].offset).toBeCloseTo(50, 6);
    // Mitte auf dem linken Teilstück → dort begrenzt
    const r2 = splitWallsAtIntersectionsDetailed([h, v], [doorAt(h.id, 480, 100)]);
    expect(r2.openings[0].wallId).toBe(h.id);
    expect(r2.openings[0].offset).toBeCloseTo(450, 6);
    // Passt vollständig → unverändert bzw. verschoben ohne Begrenzung
    const r3 = splitWallsAtIntersectionsDetailed([h, v], [doorAt(h.id, 440, 100)]);
    expect(r3.openings[0].wallId).toBe(h.id);
    expect(r3.openings[0].offset).toBeCloseTo(440, 6);
  });
  it('reassignOpeningsAfterSplit wählt das Teilstück, das die Öffnung vollständig aufnimmt', () => {
    const h = wall(0, 0, 1000, 0, 10);
    const parts = splitWall(h, { x: 500, y: 0 })!;
    const [near] = reassignOpeningsAfterSplit([doorAt(h.id, 520, 100)], h, parts);
    expect(near.wallId).toBe(parts[1].id);
    expect(near.offset).toBeCloseTo(50, 6);
    const [fits] = reassignOpeningsAfterSplit([doorAt(h.id, 800, 90)], h, parts);
    expect(fits.wallId).toBe(parts[1].id);
    expect(fits.offset).toBeCloseTo(300, 6);
    const [left] = reassignOpeningsAfterSplit([doorAt(h.id, 200, 90)], h, parts);
    expect(left.wallId).toBe(h.id);
    expect(left.offset).toBe(200);
  });
});
