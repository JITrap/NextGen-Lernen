/**
 * Reine Geometrie für Fluchtwege: Notausgänge eines Stockwerks, Polylinien-Helfer (Länge, Punkt einfügen/entfernen,
 * Fangen an Notausgangstüren), Korridor-Rechtecke je Segment und Wanddurchdringungen außerhalb von Türöffnungen.
 * Wird vom Werkzeug „Fluchtweg“, dem Auswahl-Werkzeug und der Regularien-Prüfung gemeinsam genutzt.
 */
import type { Door, Floor, Opening, Vec2, Wall } from '@/types';
import { DOOR_TYPE_MAP } from '@/data/wallTypes';
import { allWalls, findWall, isHallWallId, openingPlacement, wallLength } from './walls';
import { closestPointOnSegment, distance, segmentIntersection } from './polygon';

/** Ein als Notausgang zählender Türdurchgang (Notausgangstür oder aufschlagende Tür in einer Hallen-Außenwand). */
export interface EmergencyExit {
  door: Door;
  wall: Wall;
  /** Türmitte auf der Wandachse (Weltkoordinaten). */
  center: Vec2;
  /** Lichte Breite in cm. */
  width: number;
  /** Liegt die Tür in einer Hallen-Außenwand (`hall_<i>`)? */
  onHallWall: boolean;
  /** Explizit als Notausgang typisiert (Türtyp „Notausgang“). */
  typed: boolean;
}

/** Ist die Tür als Notausgang typisiert? */
export function isEmergencyDoor(d: Pick<Door, 'doorType'>): boolean {
  return d.doorType === 'Notausgang' || !!DOOR_TYPE_MAP[d.doorType]?.emergency;
}

/** Schwingt die Tür (kein Schiebe-/Rolltor)? Unbekannte Typen gelten als schwingend. */
export function doorSwings(d: Pick<Door, 'doorType'>): boolean {
  return DOOR_TYPE_MAP[d.doorType]?.swings ?? true;
}

/**
 * Notausgänge eines Stockwerks: sichtbare Türen vom Typ „Notausgang“ sowie alle aufschlagenden Türen in
 * Hallen-Außenwänden (führen ins Freie). Schiebetüren/Rolltore in der Außenwand zählen nicht.
 */
export function emergencyExitsOf(floor: Pick<Floor, 'walls' | 'hall' | 'openings'>): EmergencyExit[] {
  const out: EmergencyExit[] = [];
  for (const o of floor.openings) {
    if (o.kind !== 'door' || o.hidden) continue;
    const onHallWall = isHallWallId(o.wallId);
    const typed = isEmergencyDoor(o);
    if (!typed && !(onHallWall && doorSwings(o))) continue;
    const wall = findWall(floor, o.wallId);
    if (!wall || wallLength(wall) < 1) continue;
    out.push({ door: o, wall, center: openingPlacement(o, wall).center, width: o.width, onHallWall, typed });
  }
  return out;
}

/** Lauflänge einer Polylinie (Summe der Segmente) in cm. */
export function polylineLength(points: Vec2[]): number {
  let len = 0;
  for (let i = 0; i + 1 < points.length; i++) len += distance(points[i], points[i + 1]);
  return len;
}

/** Nächster Notausgang zu einem Punkt (Luftlinie zur Türmitte) oder null ohne Notausgänge. */
export function nearestExit(p: Vec2, exits: EmergencyExit[]): { exit: EmergencyExit; distance: number } | null {
  let best: { exit: EmergencyExit; distance: number } | null = null;
  for (const e of exits) {
    const d = distance(p, e.center);
    if (!best || d < best.distance) best = { exit: e, distance: d };
  }
  return best;
}

/** Notausgang, dessen Türmitte höchstens `maxCm` vom Punkt entfernt ist (zum Einrasten), sonst null. */
export function exitSnap(p: Vec2, exits: EmergencyExit[], maxCm: number): EmergencyExit | null {
  const n = nearestExit(p, exits);
  return n && n.distance <= maxCm ? n.exit : null;
}

/** Nächstgelegenes Segment einer Polylinie zu einem Punkt (Index des Segmentanfangs, Fußpunkt, Abstand). */
export function nearestPolylineSegment(points: Vec2[], p: Vec2): { index: number; point: Vec2; distance: number } | null {
  let best: { index: number; point: Vec2; distance: number } | null = null;
  for (let i = 0; i + 1 < points.length; i++) {
    const c = closestPointOnSegment(p, points[i], points[i + 1]);
    const d = distance(p, c.point);
    if (!best || d < best.distance) best = { index: i, point: c.point, distance: d };
  }
  return best;
}

/**
 * Fügt einen Punkt auf dem nächstgelegenen Segment ein (Fußpunkt des Lots). Liefert die neue Punktliste und den
 * Index des eingefügten Punkts; bei weniger als zwei Punkten wird `p` angehängt.
 */
export function insertPolylinePoint(points: Vec2[], p: Vec2): { points: Vec2[]; index: number } {
  const seg = nearestPolylineSegment(points, p);
  if (!seg) return { points: [...points, p], index: points.length };
  const index = seg.index + 1;
  return { points: [...points.slice(0, index), seg.point, ...points.slice(index)], index };
}

/** Entfernt den Punkt mit Index `index`; es bleiben mindestens `min` Punkte (sonst unverändert). */
export function removePolylinePoint(points: Vec2[], index: number, min = 2): Vec2[] {
  if (points.length <= min || index < 0 || index >= points.length) return points;
  return points.filter((_, i) => i !== index);
}

/** Rechteck der Breite `width` um ein Segment (Korridor, im Uhrzeigersinn). */
export function corridorPolygon(a: Vec2, b: Vec2, width: number): Vec2[] {
  const len = distance(a, b);
  if (len < 1e-6) return [];
  const nx = (-(b.y - a.y) / len) * (width / 2);
  const ny = ((b.x - a.x) / len) * (width / 2);
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ];
}

/** Türspannen (Offset-Intervalle entlang der Wandachse) aller sichtbaren Türen einer Wand. */
function doorSpansOf(wallId: string, openings: Opening[]): [number, number][] {
  const out: [number, number][] = [];
  for (const o of openings) {
    if (o.kind !== 'door' || o.hidden || o.wallId !== wallId) continue;
    out.push([o.offset - o.width / 2, o.offset + o.width / 2]);
  }
  return out;
}

export interface WallCrossing {
  wallId: string;
  point: Vec2;
  /** Index des Segmentanfangs in der Polylinie. */
  segment: number;
}

/**
 * Stellen, an denen die Polylinie eine Wandachse außerhalb einer Türöffnung kreuzt. Kreuzungen innerhalb der
 * Türspanne (± 2 cm Toleranz) gelten als Durchgang. Ausgeblendete Wände werden ignoriert.
 */
export function wallCrossings(points: Vec2[], floor: Pick<Floor, 'walls' | 'hall' | 'openings'>, tolerance = 2): WallCrossing[] {
  const out: WallCrossing[] = [];
  const walls = allWalls(floor).filter((w) => !w.hidden && wallLength(w) >= 1);
  const spans = new Map<string, [number, number][]>();
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (const w of walls) {
      const hit = segmentIntersection(a, b, w.start, w.end);
      if (!hit) continue;
      let sp = spans.get(w.id);
      if (!sp) {
        sp = doorSpansOf(w.id, floor.openings);
        spans.set(w.id, sp);
      }
      const off = hit.u * wallLength(w);
      if (sp.some(([lo, hi]) => off >= lo - tolerance && off <= hi + tolerance)) continue;
      out.push({ wallId: w.id, point: hit.point, segment: i });
    }
  }
  return out;
}
