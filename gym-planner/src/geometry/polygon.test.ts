import { describe, it, expect } from 'vitest';
import { polygonArea, polygonAreaM2, perimeter, centroid, pointInPolygon, rectPolygon, offsetPolygon, segmentIntersection, simplifyPolygon, ensureClockwise, convexHull, signedArea, MITER_LIMIT } from './polygon';

describe('Flächenberechnung (Shoelace)', () => {
  it('25 × 20 m Halle = 500,00 m²', () => {
    const p = rectPolygon({ x: 0, y: 0 }, { x: 2500, y: 2000 });
    expect(polygonAreaM2(p)).toBeCloseTo(500, 6);
  });
  it('L-Form wird korrekt berechnet', () => {
    // 20×20 m Quadrat minus 10×10 m Ecke = 300 m²
    const l = [
      { x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 1000, y: 1000 }, { x: 1000, y: 2000 }, { x: 0, y: 2000 },
    ];
    expect(polygonAreaM2(l)).toBeCloseTo(300, 6);
    expect(polygonAreaM2([...l].reverse())).toBeCloseTo(300, 6);
  });
  it('Polygon mit Kommazahlen', () => {
    const p = rectPolygon({ x: 0, y: 0 }, { x: 350, y: 355.7 });
    expect(polygonAreaM2(p)).toBeCloseTo(12.4495, 6);
  });
  it('Dreieck', () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 0, y: 300 }])).toBe(60000);
  });
  it('degenerierte Polygone ergeben 0', () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });
});

describe('Umfang und Schwerpunkt', () => {
  it('Umfang Rechteck', () => {
    expect(perimeter(rectPolygon({ x: 0, y: 0 }, { x: 2500, y: 2000 }))).toBe(9000);
  });
  it('Schwerpunkt Rechteck', () => {
    const c = centroid(rectPolygon({ x: 0, y: 0 }, { x: 2500, y: 2000 }));
    expect(c.x).toBeCloseTo(1250);
    expect(c.y).toBeCloseTo(1000);
  });
});

describe('Punkt im Polygon', () => {
  const l = [
    { x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 1000, y: 1000 }, { x: 1000, y: 2000 }, { x: 0, y: 2000 },
  ];
  it('innen/außen bei L-Form', () => {
    expect(pointInPolygon({ x: 500, y: 500 }, l)).toBe(true);
    expect(pointInPolygon({ x: 1500, y: 1500 }, l)).toBe(false);
    expect(pointInPolygon({ x: 500, y: 1500 }, l)).toBe(true);
  });
  it('Punkt auf Kante zählt als innen', () => {
    expect(pointInPolygon({ x: 0, y: 500 }, l)).toBe(true);
  });
});

describe('Offset (Wandstärke abziehen)', () => {
  it('Rechteck nach innen versetzt ergibt Innenfläche', () => {
    const outer = rectPolygon({ x: 0, y: 0 }, { x: 2500, y: 2000 });
    const inner = offsetPolygon(outer, 24);
    // (2500-48) × (2000-48) = 2452 × 1952
    expect(polygonArea(inner)).toBeCloseTo(2452 * 1952, 3);
  });
  it('L-Form nach innen versetzt', () => {
    const l = [
      { x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 1000, y: 1000 }, { x: 1000, y: 2000 }, { x: 0, y: 2000 },
    ];
    const inner = offsetPolygon(l, 10);
    // Prüfen: alle Innenpunkte liegen innerhalb des Originals, Fläche kleiner
    expect(inner.length).toBe(6);
    for (const p of inner) expect(pointInPolygon(p, l)).toBe(true);
    expect(polygonArea(inner)).toBeLessThan(polygonArea(l));
    // Erwartete Innenfläche: Außenkanten -10, Innenecke +10
    // Punkte: (10,10),(1990,10),(1990,990),(990,990),(990,1990),(10,1990)
    const expected = [
      { x: 10, y: 10 }, { x: 1990, y: 10 }, { x: 1990, y: 990 }, { x: 990, y: 990 }, { x: 990, y: 1990 }, { x: 10, y: 1990 },
    ];
    expect(polygonArea(inner)).toBeCloseTo(polygonArea(expected), 3);
  });
  it('Reihenfolge (gegen Uhrzeigersinn) spielt keine Rolle', () => {
    const outer = rectPolygon({ x: 0, y: 0 }, { x: 1000, y: 1000 }).reverse();
    const inner = offsetPolygon(outer, 10);
    expect(polygonArea(inner)).toBeCloseTo(980 * 980, 3);
  });
});

describe('Streckenschnitt', () => {
  it('kreuzende Strecken', () => {
    const r = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
    expect(r?.point.x).toBeCloseTo(5);
    expect(r?.point.y).toBeCloseTo(5);
  });
  it('parallel', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBeNull();
  });
});

describe('Hilfsfunktionen', () => {
  it('simplifyPolygon entfernt kollineare Punkte', () => {
    const p = [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
    expect(simplifyPolygon(p).length).toBe(4);
  });
  it('ensureClockwise', () => {
    const ccw = rectPolygon({ x: 0, y: 0 }, { x: 10, y: 10 }).reverse();
    expect(ensureClockwise(ccw)[1]).toEqual({ x: 10, y: 0 });
  });
  it('convexHull', () => {
    const h = convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(h.length).toBe(4);
  });
});

describe('offsetPolygon – Degenerations-Schutz (M7)', () => {
  it('spitzes, zu schmales Dreieck: Innen-Offset liefert leeres Polygon statt Netto > Brutto', () => {
    const tri = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 0, y: 20 }];
    expect(polygonAreaM2(tri)).toBeCloseTo(2, 6);
    const inner = offsetPolygon(tri, 24);
    expect(inner).toEqual([]);
    expect(polygonArea(inner)).toBe(0);
  });
  it('spitze Ecke wird gekappt: Ergebnis liegt innerhalb, gleiche Orientierung, kleinere Fläche', () => {
    const poly = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 0, y: 300 }];
    const d = 24;
    const inner = offsetPolygon(poly, d);
    expect(inner.length).toBe(3);
    expect(signedArea(inner)).toBeGreaterThan(0);
    expect(polygonArea(inner)).toBeLessThan(polygonArea(poly));
    for (const p of inner) expect(pointInPolygon(p, poly)).toBe(true);
    const tip = inner.find((p) => p.x > 1000)!;
    expect(Math.hypot(tip.x - 2000, tip.y)).toBeCloseTo(MITER_LIMIT * d, 6);
  });
  it('rechtwinklige und L-förmige Polygone bleiben exakt', () => {
    const rect = rectPolygon({ x: 0, y: 0 }, { x: 1000, y: 800 });
    expect(offsetPolygon(rect, 12)).toEqual([{ x: 12, y: 12 }, { x: 988, y: 12 }, { x: 988, y: 788 }, { x: 12, y: 788 }]);
    expect(polygonArea(offsetPolygon(rect, -12))).toBeCloseTo(1024 * 824, 6);
  });
});
