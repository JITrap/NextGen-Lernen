import { describe, it, expect } from 'vitest';
import { rectPolygon, polygonArea } from '@/geometry/polygon';
import { clipPolygonConvex, polygonIntersectionArea, triangulate, isConvex } from './clip';

const L1 = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 1000, y: 1000 }, { x: 1000, y: 2000 }, { x: 0, y: 2000 }];
// Quadrat ohne die untere linke Ecke
const L2 = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 1000, y: 2000 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];

describe('Polygon-Clipping', () => {
  it('erkennt konvexe und konkave Polygone', () => {
    expect(isConvex(rectPolygon({ x: 0, y: 0 }, { x: 10, y: 10 }))).toBe(true);
    expect(isConvex(L1)).toBe(false);
  });
  it('Rechteck ∩ Rechteck (Teilüberlappung)', () => {
    const a = rectPolygon({ x: 0, y: 0 }, { x: 100, y: 100 });
    const b = rectPolygon({ x: 50, y: 50 }, { x: 150, y: 150 });
    expect(polygonArea(clipPolygonConvex(a, b))).toBeCloseTo(2500, 6);
    expect(polygonIntersectionArea(a, b)).toBeCloseTo(2500, 6);
    expect(polygonIntersectionArea(b, a)).toBeCloseTo(2500, 6);
  });
  it('vollständig enthalten und disjunkt', () => {
    const outer = rectPolygon({ x: 0, y: 0 }, { x: 1000, y: 1000 });
    const inner = rectPolygon({ x: 100, y: 100 }, { x: 300, y: 300 });
    expect(polygonIntersectionArea(inner, outer)).toBeCloseTo(40000, 6);
    expect(polygonIntersectionArea(outer, inner)).toBeCloseTo(40000, 6);
    expect(polygonIntersectionArea(inner, rectPolygon({ x: 2000, y: 2000 }, { x: 2100, y: 2100 }))).toBe(0);
  });
  it('L-Form ∩ Rechteck (konkaves Subjekt)', () => {
    const r = rectPolygon({ x: 500, y: 500 }, { x: 1500, y: 1500 });
    // 1000×1000 minus Quadrant 1000..1500 × 1000..1500
    expect(polygonIntersectionArea(L1, r)).toBeCloseTo(750000, 3);
    expect(polygonIntersectionArea(r, L1)).toBeCloseTo(750000, 3);
  });
  it('L-Form ∩ L-Form (beide konkav) über Triangulation', () => {
    // Schnitt = obere Hälfte 2000 × 1000
    expect(polygonIntersectionArea(L1, L2)).toBeCloseTo(2_000_000, 3);
    expect(polygonIntersectionArea(L2, L1)).toBeCloseTo(2_000_000, 3);
  });
  it('trianguliert eine L-Form flächentreu', () => {
    const tris = triangulate(L1);
    expect(tris).not.toBeNull();
    expect(tris!.length).toBe(4);
    expect(tris!.reduce((s, t) => s + polygonArea(t), 0)).toBeCloseTo(3_000_000, 3);
    expect(triangulate([...L1].reverse())!.reduce((s, t) => s + polygonArea(t), 0)).toBeCloseTo(3_000_000, 3);
  });
  it('degenerierte Eingaben ergeben 0', () => {
    expect(polygonIntersectionArea([], L1)).toBe(0);
    expect(polygonIntersectionArea([{ x: 0, y: 0 }, { x: 1, y: 1 }], L1)).toBe(0);
  });
});
