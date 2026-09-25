import type { Floor, Room, Vec2, Wall } from '@/types';
import { polygonArea, perimeter, centroid, ensureClockwise } from './polygon';
import { allWalls } from './walls';

/** Stabiler Schlüssel für einen automatisch erkannten Raum (Schwerpunkt auf 10 cm gerundet). */
export function loopKeyFor(polygon: Vec2[]): string {
  const c = centroid(polygon);
  return `r:${Math.round(c.x / 10)}:${Math.round(c.y / 10)}`;
}

export function roomFromPolygon(polygon: Vec2[], base: Omit<Room, 'polygon' | 'areaM2' | 'perimeterCm' | 'centroid'>): Room {
  const poly = ensureClockwise(polygon);
  return { ...base, polygon: poly, areaM2: polygonArea(poly) / 10000, perimeterCm: perimeter(poly), centroid: centroid(poly) };
}

/**
 * Erkennt Räume aus geschlossenen Wandzügen (inkl. Hallen-Außenwänden).
 * Liefert die Innenpolygone (Wandstärke abgezogen).
 * Basisimplementierung: leer – wird durch die Flächenerkennung (planarer Graph) ersetzt.
 */
export function detectWallRooms(_walls: Wall[]): { polygon: Vec2[]; wallIds: string[] }[] {
  return [];
}

/** Alle Räume eines Stockwerks: automatisch erkannte (mit Metadaten) + Zonen. */
export function floorRooms(floor: Floor): Room[] {
  const rooms: Room[] = [];
  const walls = allWalls(floor);
  for (const r of detectWallRooms(walls)) {
    const key = loopKeyFor(r.polygon);
    const meta = floor.roomMeta[key] ?? { name: 'Raum', type: 'Sonstiges' as const };
    rooms.push(roomFromPolygon(r.polygon, { id: key, source: 'auto', loopKey: key, ...meta }));
  }
  for (const z of floor.zones) {
    if (z.hidden) continue;
    const { id, polygon, locked: _l, hidden: _h, ...meta } = z;
    rooms.push(roomFromPolygon(polygon, { id, source: 'zone', ...meta }));
  }
  return rooms;
}
