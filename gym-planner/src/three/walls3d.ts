/**
 * Grundriss-Vierecke der Wandsegmente (reine Geometrie in cm, keine three-Abhängigkeit).
 * Hallen-Außenwände werden an den Ecken auf Gehrung geschnitten (Ring zwischen Außen- und Innenpolygon),
 * Innenwände über wallOutline (Gehrung an Ecken/T-Stößen).
 */
import type { Floor, Hall, Opening, Vec2, Wall } from '@/types';
import { add, scale, sub, offsetPolygon } from '@/geometry/polygon';
import { wallDirection, wallNormal, wallLength, wallOutline, hallWalls, isHallWallId, allWalls } from '@/geometry/walls';
import { wallSegments, type WallSegment } from './wallSegments';

/** Ecken einer Wand: [start-a, end-a, end-b, start-b] (wie wallRect/wallOutline). */
export type WallCorners = [Vec2, Vec2, Vec2, Vec2];

export interface WallPiece {
  wall: Wall;
  segment: WallSegment;
  /** Grundriss-Viereck des Segments (cm, Weltkoordinaten). */
  polygon: Vec2[];
}

/** Ecken ohne Nachbarn: Rechteck, bei Außenwänden um die halbe Stärke verlängert (füllt rechtwinklige Ecken). */
export function fallbackCorners(wall: Wall, extend = 0): WallCorners {
  const dir = wallDirection(wall);
  const n = scale(wallNormal(wall), wall.thickness / 2);
  const e = scale(dir, extend);
  const s = sub(wall.start, e);
  const t = add(wall.end, e);
  return [add(s, n), add(t, n), sub(t, n), sub(s, n)];
}

/**
 * Gehrungs-Ecken der Hallen-Außenwände: Außen- und Innenring aus dem Achsenpolygon.
 * Seite „a“ (+Normale) liegt bei Uhrzeigersinn außen.
 */
export function hallWallCorners(hall: Hall): Map<string, WallCorners> {
  const map = new Map<string, WallCorners>();
  const walls = hallWalls(hall);
  if (walls.length < 3) return map;
  const mid = walls.map((w) => w.start);
  const outer = offsetPolygon(mid, -hall.wallThickness / 2);
  const inner = offsetPolygon(mid, hall.wallThickness / 2);
  const consistent = outer.length === mid.length && inner.length === mid.length;
  walls.forEach((w, i) => {
    if (consistent) {
      const j = (i + 1) % mid.length;
      map.set(w.id, [outer[i], outer[j], inner[j], inner[i]]);
    } else {
      map.set(w.id, fallbackCorners(w, hall.wallThickness / 2));
    }
  });
  return map;
}

/** Viereck eines Segments: an den Wandenden die Gehrungs-Ecken, dazwischen Achse ± halbe Stärke. */
export function segmentPolygon(wall: Wall, seg: WallSegment, corners: WallCorners): Vec2[] {
  const len = wallLength(wall);
  const dir = wallDirection(wall);
  const n = scale(wallNormal(wall), wall.thickness / 2);
  const atStart = seg.start <= 0.01;
  const atEnd = seg.end >= len - 0.01;
  const ps = add(wall.start, scale(dir, seg.start));
  const pe = add(wall.start, scale(dir, seg.end));
  const sa = atStart ? corners[0] : add(ps, n);
  const sb = atStart ? corners[3] : sub(ps, n);
  const ea = atEnd ? corners[1] : add(pe, n);
  const eb = atEnd ? corners[2] : sub(pe, n);
  return [sa, ea, eb, sb];
}

/** Öffnungen je Wand (ohne ausgeblendete). */
export function openingsByWall(openings: Opening[]): Map<string, Opening[]> {
  const m = new Map<string, Opening[]>();
  for (const o of openings) {
    if (o.hidden) continue;
    const list = m.get(o.wallId);
    if (list) list.push(o); else m.set(o.wallId, [o]);
  }
  return m;
}

/**
 * Alle Wandsegmente eines Stockwerks (Außen- und Innenwände) mit Grundriss-Viereck.
 * `ceiling` in cm.
 */
export function floorWallPieces(floor: Pick<Floor, 'walls' | 'hall' | 'openings'>, ceiling: number): WallPiece[] {
  const walls = allWalls(floor);
  const byWall = openingsByWall(floor.openings);
  const hallCorners = floor.hall ? hallWallCorners(floor.hall) : new Map<string, WallCorners>();
  const out: WallPiece[] = [];
  for (const wall of walls) {
    if (wall.hidden) continue;
    if (wallLength(wall) < 0.5) continue;
    const segs = wallSegments(wall, byWall.get(wall.id) ?? [], ceiling);
    if (!segs.length) continue;
    const corners: WallCorners = isHallWallId(wall.id)
      ? hallCorners.get(wall.id) ?? fallbackCorners(wall, wall.thickness / 2)
      : (wallOutline(wall, walls) as WallCorners);
    for (const segment of segs) out.push({ wall, segment, polygon: segmentPolygon(wall, segment, corners) });
  }
  return out;
}
