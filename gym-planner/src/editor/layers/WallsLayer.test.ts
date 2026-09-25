import { describe, it, expect } from 'vitest';
import type { Wall } from '@/types';
import { exteriorEdges } from './WallsLayer';
import { wallOutlines } from '@/geometry/walls';
import { ensureClockwise } from '@/geometry/polygon';

function wall(id: string, sx: number, sy: number, ex: number, ey: number, thickness = 12.5): Wall {
  return { id, start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness, type: 'Trockenbau', height: null };
}

describe('exteriorEdges', () => {
  it('ohne Nachbarn sind alle Kanten außen', () => {
    const sq = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 0, y: 10 }];
    expect(exteriorEdges(sq, [])).toHaveLength(4);
  });
  it('T-Stoß: die Stoßkante der geteilten Wand und das Ende der anstoßenden Wand sind innen', () => {
    // durchgehende Wand (500..1500, y 500), bei x=1000 geteilt; Stiel von (1000,500) nach unten
    const walls = [wall('a', 500, 500, 1000, 500), wall('b', 1000, 500, 1500, 500), wall('c', 1000, 500, 1000, 900)];
    const outlines = wallOutlines(walls);
    const polys = new Map([...outlines].map(([id, p]) => [id, ensureClockwise(p)]));
    const all = [...polys.values()];
    const others = (id: string) => all.filter((p) => p !== polys.get(id));
    const isVertical = ([p, q]: [{ x: number; y: number }, { x: number; y: number }]) => Math.abs(p.x - q.x) < 1e-6;
    // Wand a: 4 Kanten, die Stoßkante bei x=1000 fehlt (liegt in b)
    const ea = exteriorEdges(polys.get('a')!, others('a'));
    expect(ea).toHaveLength(3);
    expect(ea.some((e) => isVertical(e) && Math.abs(e[0].x - 1000) < 1e-6)).toBe(false);
    expect(ea.some((e) => isVertical(e) && Math.abs(e[0].x - 500) < 1e-6)).toBe(true);
    // Stiel c: das obere Ende (an der Fläche von a/b) fehlt, das freie Ende bei y=900 bleibt
    const ec = exteriorEdges(polys.get('c')!, others('c'));
    expect(ec).toHaveLength(3);
    expect(ec.some((e) => !isVertical(e) && Math.abs(e[0].y - 900) < 1e-6)).toBe(true);
    expect(ec.some((e) => !isVertical(e) && e[0].y < 600)).toBe(false);
  });
});
