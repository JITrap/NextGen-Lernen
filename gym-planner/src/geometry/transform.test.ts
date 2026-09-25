import { describe, it, expect } from 'vitest';
import { rectCorners, itemSafetyPolygon, itemFootprint } from './transform';
import { polygonArea, bbox } from './polygon';

describe('Objekt-Transformation', () => {
  it('Grundfläche belegt exakt B × T', () => {
    const fp = itemFootprint({ x: 0, y: 0, width: 165, depth: 203, rotation: 0 });
    expect(polygonArea(fp)).toBe(165 * 203);
    const b = bbox(fp);
    expect(b.maxX - b.minX).toBe(165);
    expect(b.maxY - b.minY).toBe(203);
  });
  it('Drehung um 90° vertauscht Breite und Tiefe in der Bounding-Box', () => {
    const fp = itemFootprint({ x: 0, y: 0, width: 120, depth: 191, rotation: 90 });
    const b = bbox(fp);
    expect(b.maxX - b.minX).toBeCloseTo(191);
    expect(b.maxY - b.minY).toBeCloseTo(120);
    expect(polygonArea(fp)).toBeCloseTo(120 * 191);
  });
  it('Sicherheitszone Laufband: 200 cm hinten', () => {
    const z = itemSafetyPolygon({ x: 0, y: 0, width: 90, depth: 210, rotation: 0 }, { vorne: 0, hinten: 200, links: 0, rechts: 0 });
    const b = bbox(z);
    expect(b.maxX - b.minX).toBeCloseTo(90);
    expect(b.maxY - b.minY).toBeCloseTo(410);
    expect(b.minY).toBeCloseTo(-105 - 200);
    expect(b.maxY).toBeCloseTo(105);
  });
  it('Sicherheitszone 60 cm rundum', () => {
    const z = itemSafetyPolygon({ x: 100, y: 100, width: 100, depth: 100, rotation: 45 }, { vorne: 60, hinten: 60, links: 60, rechts: 60 });
    expect(polygonArea(z)).toBeCloseTo(220 * 220);
  });
  it('rectCorners liefert 4 Punkte im Uhrzeigersinn', () => {
    const c = rectCorners(0, 0, 10, 20, 0);
    expect(c).toEqual([
      { x: -5, y: -10 }, { x: 5, y: -10 }, { x: 5, y: 10 }, { x: -5, y: 10 },
    ]);
  });
});
