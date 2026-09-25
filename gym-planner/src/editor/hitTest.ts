import type { Vec2, Selection, Floor, Wall, Room, PlacedItem } from '@/types';
import { pointInPolygon, distanceToSegment, distance } from '@/geometry/polygon';
import { itemFootprint } from '@/geometry/transform';
import { openingPlacement, findWall } from '@/geometry/walls';

export interface HitTestInput {
  floor: Floor;
  walls: Wall[];
  rooms: Room[];
  items: PlacedItem[];
  /** Toleranz in cm (z. B. 6 px / scale). */
  tolerance: number;
  layers: { items: boolean; walls: boolean; rooms: boolean; openings: boolean; annotations: boolean; voids: boolean };
}

/**
 * Findet das oberste Objekt unter einem Weltpunkt.
 * Reihenfolge: Anmerkungen → Öffnungen → Objekte → Wände → Zonen/Räume → Luftraum → Hallen-Ecken/-Kanten.
 */
export function hitTest(p: Vec2, inp: HitTestInput): Selection | null {
  const { floor, tolerance } = inp;
  if (inp.layers.annotations) {
    for (let i = floor.annotations.length - 1; i >= 0; i--) {
      const a = floor.annotations[i];
      if (a.hidden) continue;
      if (a.kind === 'text') {
        const w = Math.max(60, a.text.length * a.fontSize * 0.6);
        if (p.x >= a.x - tolerance && p.x <= a.x + w + tolerance && p.y >= a.y - tolerance && p.y <= a.y + a.fontSize * 1.4 + tolerance) return { kind: 'annotation', id: a.id };
      } else if (distanceToSegment(p, a.start, a.end) <= tolerance) return { kind: 'annotation', id: a.id };
    }
  }
  if (inp.layers.openings) {
    for (let i = floor.openings.length - 1; i >= 0; i--) {
      const o = floor.openings[i];
      if (o.hidden) continue;
      const w = findWall(floor, o.wallId);
      if (!w) continue;
      const pl = openingPlacement(o, w);
      if (distanceToSegment(p, pl.a, pl.b) <= Math.max(tolerance, w.thickness / 2 + 2)) return { kind: 'opening', id: o.id };
    }
  }
  if (inp.layers.items) {
    for (let i = inp.items.length - 1; i >= 0; i--) {
      const it = inp.items[i];
      if (it.hidden) continue;
      if (pointInPolygon(p, itemFootprint(it))) return { kind: 'item', id: it.id };
    }
  }
  if (inp.layers.walls) {
    for (let i = floor.walls.length - 1; i >= 0; i--) {
      const w = floor.walls[i];
      if (w.hidden) continue;
      if (distanceToSegment(p, w.start, w.end) <= Math.max(tolerance, w.thickness / 2)) return { kind: 'wall', id: w.id };
    }
  }
  if (inp.layers.rooms) {
    // kleinste Zone zuerst (falls verschachtelt)
    const zones = floor.zones.filter((z) => !z.hidden && pointInPolygon(p, z.polygon));
    if (zones.length) {
      const r = inp.rooms.filter((x) => zones.some((z) => z.id === x.id)).sort((a, b) => a.areaM2 - b.areaM2)[0];
      if (r) return { kind: 'zone', id: r.id };
    }
    const auto = inp.rooms.filter((r) => r.source === 'auto' && pointInPolygon(p, r.polygon)).sort((a, b) => a.areaM2 - b.areaM2)[0];
    if (auto) return { kind: 'room', id: auto.id };
  }
  if (inp.layers.voids) {
    for (const v of floor.voids) if (pointInPolygon(p, v.polygon)) return { kind: 'void', id: v.id };
  }
  if (floor.hall) {
    const poly = floor.hall.polygon;
    for (let i = 0; i < poly.length; i++) if (distance(p, poly[i]) <= tolerance * 1.5) return { kind: 'hallVertex', id: String(i) };
    for (let i = 0; i < poly.length; i++) if (distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]) <= Math.max(tolerance, floor.hall.wallThickness / 2)) return { kind: 'hallEdge', id: String(i) };
  }
  return null;
}
