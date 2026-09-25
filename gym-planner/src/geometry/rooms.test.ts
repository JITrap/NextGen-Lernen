import { describe, it, expect } from 'vitest';
import type { Wall, Floor } from '@/types';
import { detectWallRooms, floorRooms, floorRoomsWithHoles, loopKeyFor, roomFromPolygon } from './rooms';
import { allWalls, wallOutline } from './walls';
import { createHall, createFloor } from '@/store/factories';
import { polygonArea, pointInPolygon } from './polygon';

let counter = 0;
function wall(x1: number, y1: number, x2: number, y2: number, thickness = 10, extra: Partial<Wall> = {}): Wall {
  return { id: `w${++counter}`, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, type: 'Trockenbau', height: null, ...extra };
}
const m2 = (poly: { x: number; y: number }[]) => Math.round((polygonArea(poly) / 10000) * 10000) / 10000;
const HALL_INNER = (2500 - 48) * (2000 - 48) / 10000; // 2452 · 1952 cm² = 478,6304 m²

describe('detectWallRooms – Halle', () => {
  it('Halle 25 × 20 m ohne Innenwände → genau 1 Raum mit Innenfläche 478,6304 m²', () => {
    const hall = createHall(2500, 2000);
    const rooms = detectWallRooms(allWalls({ hall, walls: [] }));
    expect(rooms).toHaveLength(1);
    expect(m2(rooms[0].polygon)).toBe(478.6304);
    expect(rooms[0].polygon).toHaveLength(4);
    expect(rooms[0].wallIds.sort()).toEqual(['hall_0', 'hall_1', 'hall_2', 'hall_3']);
    // Innenkante bei 24 cm
    expect(rooms[0].polygon.some((p) => Math.abs(p.x - 24) < 1e-6 && Math.abs(p.y - 24) < 1e-6)).toBe(true);
    expect(rooms[0].polygon.some((p) => Math.abs(p.x - 2476) < 1e-6 && Math.abs(p.y - 1976) < 1e-6)).toBe(true);
  });

  it('Halle + durchgehende Innenwand (12,5 cm) bei x = 1000 von Innenkante zu Innenkante → 2 Räume', () => {
    const hall = createHall(2500, 2000);
    const inner = wall(1000, 24, 1000, 1976, 12.5);
    const rooms = detectWallRooms(allWalls({ hall, walls: [inner] }));
    expect(rooms).toHaveLength(2);
    const areas = rooms.map((r) => m2(r.polygon)).sort((a, b) => a - b);
    const left = Math.round((1000 - 24 - 6.25) * 1952) / 10000;
    const right = Math.round((2500 - 24 - 1000 - 6.25) * 1952) / 10000;
    expect(areas).toEqual([left, right].sort((a, b) => a - b));
    expect(left).toBe(189.2952);
    expect(right).toBe(286.8952);
    for (const r of rooms) expect(r.wallIds).toContain(inner.id);
  });

  it('Innenwand exakt von Achse zu Achse ergibt dieselben Räume', () => {
    const hall = createHall(2500, 2000);
    const inner = wall(1000, 12, 1000, 1988, 12.5);
    const rooms = detectWallRooms(allWalls({ hall, walls: [inner] }));
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => m2(r.polygon)).sort((a, b) => a - b)).toEqual([189.2952, 286.8952]);
  });

  it('Innenwand, die 0,4 cm vor der Innenkante endet, schließt trotzdem an (Toleranz)', () => {
    const hall = createHall(2500, 2000);
    const inner = wall(1000, 24.4, 1000, 1975.6, 12.5);
    expect(detectWallRooms(allWalls({ hall, walls: [inner] }))).toHaveLength(2);
  });

  it('Innenwand, die 5 cm vor der Innenkante endet, bildet keinen Raum (Sackgasse)', () => {
    const hall = createHall(2500, 2000);
    const inner = wall(1000, 29, 1000, 1971, 12.5);
    const rooms = detectWallRooms(allWalls({ hall, walls: [inner] }));
    expect(rooms).toHaveLength(1);
    expect(m2(rooms[0].polygon)).toBe(478.6304);
  });

  it('L-förmige Halle', () => {
    const hall = createHall(2500, 2000, {
      polygon: [
        { x: 0, y: 0 },
        { x: 2500, y: 0 },
        { x: 2500, y: 1000 },
        { x: 1500, y: 1000 },
        { x: 1500, y: 2000 },
        { x: 0, y: 2000 },
      ],
    });
    const rooms = detectWallRooms(allWalls({ hall, walls: [] }));
    expect(rooms).toHaveLength(1);
    // Innen: 2452 × 1952 abzüglich Aussparung: die einspringende Ecke (1500,1000) wandert nach innen auf (1476, 976)
    const expected = (2452 * 1952 - (2476 - 1476) * (1976 - 976)) / 10000;
    expect(m2(rooms[0].polygon)).toBe(Math.round(expected * 10000) / 10000);
    expect(rooms[0].polygon).toHaveLength(6);
  });
});

describe('detectWallRooms – freie Wände', () => {
  it('4 freie Wände bilden 5 × 4 m (Achsen), Stärke 10 → Innenfläche 19,11 m²', () => {
    const walls = [wall(0, 0, 500, 0), wall(500, 0, 500, 400), wall(500, 400, 0, 400), wall(0, 400, 0, 0)];
    const rooms = detectWallRooms(walls);
    expect(rooms).toHaveLength(1);
    expect(m2(rooms[0].polygon)).toBe(19.11);
    expect(rooms[0].wallIds.sort()).toEqual(walls.map((w) => w.id).sort());
    expect(rooms[0].polygon.some((p) => Math.abs(p.x - 5) < 1e-6 && Math.abs(p.y - 5) < 1e-6)).toBe(true);
  });

  it('Reihenfolge/Richtung der Wände ist egal', () => {
    const walls = [wall(0, 400, 0, 0), wall(500, 400, 0, 400), wall(0, 0, 500, 0), wall(500, 400, 500, 0)];
    const rooms = detectWallRooms(walls);
    expect(rooms).toHaveLength(1);
    expect(m2(rooms[0].polygon)).toBe(19.11);
  });

  it('L-förmiger Raum aus 6 Wänden → korrekte Innenfläche', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 300 },
      { x: 300, y: 300 },
      { x: 300, y: 500 },
      { x: 0, y: 500 },
    ];
    const walls = pts.map((p, i) => wall(p.x, p.y, pts[(i + 1) % 6].x, pts[(i + 1) % 6].y, 10));
    const rooms = detectWallRooms(walls);
    expect(rooms).toHaveLength(1);
    // Innen: (5,5) (595,5) (595,295) (295,295) (295,495) (5,495) → 590·290 + 290·200 = 229100 cm²
    expect(m2(rooms[0].polygon)).toBe(22.91);
    expect(rooms[0].polygon).toHaveLength(6);
    expect(rooms[0].polygon.some((p) => Math.abs(p.x - 295) < 1e-6 && Math.abs(p.y - 295) < 1e-6)).toBe(true);
  });

  it('T-Stoß: Wand endet auf der Mitte einer anderen → zwei Räume; Wandpolygon reicht bis zur Fläche', () => {
    const top = wall(0, 0, 1000, 0, 10);
    const right = wall(1000, 0, 1000, 500, 10);
    const bottom = wall(1000, 500, 0, 500, 10);
    const left = wall(0, 500, 0, 0, 10);
    const mid = wall(500, 0, 500, 500, 10);
    const all = [top, right, bottom, left, mid];
    const rooms = detectWallRooms(all);
    expect(rooms).toHaveLength(2);
    // je (500 − 5 − 5) × (500 − 5 − 5) = 490 × 490 = 24,01 m²
    expect(rooms.map((r) => m2(r.polygon))).toEqual([24.01, 24.01]);
    expect(rooms.every((r) => r.wallIds.includes(mid.id))).toBe(true);
    const o = wallOutline(mid, all);
    // Wandpolygon der endenden Wand: exakt bis zur Fläche der oberen (y = 5) und unteren (y = 495) Wand
    expect(o[0]).toEqual({ x: 505, y: 5 });
    expect(o[3]).toEqual({ x: 495, y: 5 });
    expect(o[1]).toEqual({ x: 505, y: 495 });
    expect(o[2]).toEqual({ x: 495, y: 495 });
  });

  it('T-Stoß mit Wandende auf der Fläche der anderen Wand (nicht auf der Achse)', () => {
    const top = wall(0, 0, 1000, 0, 10);
    const right = wall(1000, 0, 1000, 500, 10);
    const bottom = wall(1000, 500, 0, 500, 10);
    const left = wall(0, 500, 0, 0, 10);
    const mid = wall(500, 5, 500, 495, 10);
    const rooms = detectWallRooms([top, right, bottom, left, mid]);
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => m2(r.polygon))).toEqual([24.01, 24.01]);
  });

  it('Kreuzung von zwei Wänden im Rechteck → 4 Räume', () => {
    const walls = [wall(0, 0, 1000, 0), wall(1000, 0, 1000, 800), wall(1000, 800, 0, 800), wall(0, 800, 0, 0), wall(500, 0, 500, 800), wall(0, 400, 1000, 400)];
    const rooms = detectWallRooms(walls);
    expect(rooms).toHaveLength(4);
    for (const r of rooms) expect(m2(r.polygon)).toBe(19.11);
  });

  it('Sackgasse in einem Raum ändert die Raumzahl und Fläche nicht', () => {
    const hall = createHall(2500, 2000);
    const stub = wall(1000, 24, 1000, 800, 12.5);
    const rooms = detectWallRooms(allWalls({ hall, walls: [stub] }));
    expect(rooms).toHaveLength(1);
    expect(m2(rooms[0].polygon)).toBe(478.6304);
    expect(rooms[0].wallIds).not.toContain(stub.id);
    // freie Sackgasse (nirgends angeschlossen) ebenfalls harmlos
    const free = wall(300, 300, 800, 700, 10);
    const rooms2 = detectWallRooms(allWalls({ hall, walls: [stub, free] }));
    expect(rooms2).toHaveLength(1);
    expect(m2(rooms2[0].polygon)).toBe(478.6304);
  });

  it('Raum im Raum: Außenraum-Fläche = außen − innen (inkl. Wandstärke des inneren Zugs)', () => {
    const hall = createHall(2500, 2000);
    const inner = [wall(500, 500, 1000, 500), wall(1000, 500, 1000, 900), wall(1000, 900, 500, 900), wall(500, 900, 500, 500)];
    const rooms = detectWallRooms(allWalls({ hall, walls: inner }));
    expect(rooms).toHaveLength(2);
    const outer = rooms.find((r) => r.holes)!;
    const small = rooms.find((r) => !r.holes)!;
    expect(small).toBeDefined();
    expect(m2(small.polygon)).toBe(19.11);
    expect(outer.holes).toHaveLength(1);
    expect(m2(outer.polygon)).toBe(478.6304);
    // Loch = Außenkante der inneren Wände: 510 × 410
    expect(m2(outer.holes![0])).toBe(20.91);
    const floor: Floor = createFloor({ hall, walls: inner });
    const fr = floorRooms(floor);
    const big = fr.find((r) => r.areaM2 > 100)!;
    expect(Math.round(big.areaM2 * 10000) / 10000).toBe(Math.round((HALL_INNER - 20.91) * 10000) / 10000);
    expect(big.polygon).toHaveLength(4);
    const withHoles = floorRoomsWithHoles(floor).find((e) => e.holes.length)!;
    expect(withHoles.holes[0]).toHaveLength(4);
  });

  it('dreifach verschachtelt: nur die direkt enthaltene Fläche ist ein Loch', () => {
    const hall = createHall(2500, 2000);
    const mid = [wall(300, 300, 1500, 300), wall(1500, 300, 1500, 1500), wall(1500, 1500, 300, 1500), wall(300, 1500, 300, 300)];
    const tiny = [wall(600, 600, 900, 600), wall(900, 600, 900, 900), wall(900, 900, 600, 900), wall(600, 900, 600, 600)];
    const rooms = detectWallRooms(allWalls({ hall, walls: [...mid, ...tiny] }));
    expect(rooms).toHaveLength(3);
    const byArea = [...rooms].sort((a, b) => polygonArea(a.polygon) - polygonArea(b.polygon));
    expect(byArea[0].holes).toBeUndefined();
    expect(byArea[1].holes).toHaveLength(1);
    expect(byArea[2].holes).toHaveLength(1);
    expect(m2(byArea[2].holes![0])).toBe(Math.round(1210 * 1210) / 10000);
  });

  it('Halle ohne Wände, leere Liste, zu wenige Wände', () => {
    expect(detectWallRooms([])).toEqual([]);
    expect(detectWallRooms([wall(0, 0, 500, 0), wall(500, 0, 500, 500)])).toEqual([]);
    expect(detectWallRooms([wall(0, 0, 500, 0), wall(500, 0, 500, 500), wall(500, 500, 0, 0)])).toHaveLength(1);
  });

  it('Doppelwände in Wandstärken-Abstand erzeugen keinen Scheinraum', () => {
    const walls = [wall(0, 0, 500, 0), wall(500, 0, 500, 400), wall(500, 400, 0, 400), wall(0, 400, 0, 0), wall(0, 8, 500, 8)];
    const rooms = detectWallRooms(walls);
    expect(rooms).toHaveLength(1);
  });

  it('leicht ungenaue Ecken (0,3 cm) schließen den Raum', () => {
    const walls = [wall(0, 0, 500, 0), wall(500.3, 0.2, 500, 400), wall(500, 400.3, 0, 400), wall(0.2, 400, 0, 0.3)];
    expect(detectWallRooms(walls)).toHaveLength(1);
  });

  it('Performance: 200 Wände in < 20 ms', () => {
    const walls: Wall[] = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        walls.push(wall(i * 300, j * 300, i * 300 + 300, j * 300, 12.5));
        walls.push(wall(i * 300, j * 300, i * 300, j * 300 + 300, 12.5));
      }
    }
    expect(walls).toHaveLength(200);
    // Aufwärmen (JIT), dann Bestzeit aus 3 Läufen
    detectWallRooms(walls);
    let best = Infinity;
    let rooms: ReturnType<typeof detectWallRooms> = [];
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      rooms = detectWallRooms(walls);
      best = Math.min(best, performance.now() - t0);
    }
    expect(rooms).toHaveLength(81);
    expect(best).toBeLessThan(20);
  });
});

describe('floorRooms', () => {
  it('nutzt roomMeta und ordnet bei minimal verschobenen Wänden den nächsten Schlüssel zu (rein lesend)', () => {
    const hall = createHall(2500, 2000);
    const floor = createFloor({ hall, walls: [] });
    const [room] = floorRooms(floor);
    expect(room.name).toBe('Raum');
    expect(room.source).toBe('auto');
    expect(room.loopKey).toBe(loopKeyFor(room.polygon));
    const meta = { [room.loopKey!]: { name: 'Trainingsfläche', type: 'Maschinen' as const } };
    const floor2 = { ...floor, roomMeta: meta };
    expect(floorRooms(floor2)[0].name).toBe('Trainingsfläche');
    // Halle um 30 cm verschoben → neuer Schwerpunkt, aber Meta innerhalb 50 cm gefunden
    const shifted = createHall(2500, 2000, { polygon: hall.polygon.map((p) => ({ x: p.x + 30, y: p.y })) });
    const floor3 = { ...floor, hall: shifted, roomMeta: meta };
    const r3 = floorRooms(floor3)[0];
    expect(r3.name).toBe('Trainingsfläche');
    expect(r3.loopKey).toBe(room.loopKey);
    expect(floor3.roomMeta).toBe(meta);
    // Weit verschoben → Standard
    const far = createHall(2500, 2000, { polygon: hall.polygon.map((p) => ({ x: p.x + 300, y: p.y })) });
    expect(floorRooms({ ...floor, hall: far, roomMeta: meta })[0].name).toBe('Raum');
  });

  it('IDs bleiben eindeutig, auch wenn mehrere Räume denselben Schlüssel beanspruchen würden', () => {
    const hall = createHall(2500, 2000);
    const inner = wall(1250, 24, 1250, 1976, 12.5);
    const floor = createFloor({ hall, walls: [inner], roomMeta: { 'r:125:100': { name: 'Alt', type: 'Cardio' } } });
    const rooms = floorRooms(floor);
    expect(rooms).toHaveLength(2);
    expect(new Set(rooms.map((r) => r.id)).size).toBe(2);
  });

  it('Zonen werden angehängt, versteckte Zonen nicht', () => {
    const floor = createFloor({
      zones: [
        { id: 'z1', name: 'Freihantel', type: 'Trainingsfläche Freihantel', polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }] },
        { id: 'z2', name: 'Versteckt', type: 'Cardio', hidden: true, polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] },
      ],
    });
    const rooms = floorRooms(floor);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].source).toBe('zone');
    expect(rooms[0].areaM2).toBe(12);
  });

  it('roomFromPolygon zieht Löcher ab, Polygon bleibt außen', () => {
    const outer = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
    const hole = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }];
    const r = roomFromPolygon(outer, { id: 'x', source: 'zone', name: 'A', type: 'Sonstiges' }, [hole]);
    expect(r.areaM2).toBe(96);
    expect(r.polygon).toHaveLength(4);
    expect(pointInPolygon({ x: 200, y: 200 }, r.polygon)).toBe(true);
  });
});
