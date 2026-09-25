import { describe, it, expect } from 'vitest';
import { resolveLabelAnchor, labelAnchor } from './RoomsLayer';

const room = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1500 }, { x: 0, y: 1500 }];

describe('resolveLabelAnchor', () => {
  it('ohne Überlappung bleibt der Anker', () => {
    const a = labelAnchor(room, { x: 1000, y: 750 });
    expect(resolveLabelAnchor(a, 'Trainingshalle', room, [{ x: 300, y: 300, hw: 40, hh: 15 }], 1)).toEqual(a);
  });
  it('weicht einem Zonenlabel am selben Punkt nach oben aus und bleibt im Raum', () => {
    const a = { x: 1000, y: 750 };
    const r = resolveLabelAnchor(a, 'Trainingshalle', room, [{ x: 1000, y: 750, hw: 40, hh: 15 }], 1);
    expect(r.x).toBe(1000);
    expect(r.y).toBeLessThan(750 - 20);
    expect(r.y).toBeGreaterThan(0);
  });
  it('weicht nach unten aus, wenn oben kein Platz ist', () => {
    const flat = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 120 }, { x: 0, y: 120 }];
    const r = resolveLabelAnchor({ x: 1000, y: 40 }, 'Raum', flat, [{ x: 1000, y: 40, hw: 40, hh: 15 }], 1);
    expect(r.y).toBeGreaterThan(40);
  });
});
