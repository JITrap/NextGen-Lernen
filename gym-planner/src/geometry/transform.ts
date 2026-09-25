import type { PlacedItem, SafetyZone, Vec2 } from '@/types';
import { rotateAround } from './polygon';

/**
 * Eckpunkte eines gedrehten Rechtecks (Objekt-Grundfläche).
 * Lokales System: Breite entlang x, Tiefe entlang y; „vorne“ = +y (unten) bei rotation 0.
 * Reihenfolge: links-hinten, rechts-hinten, rechts-vorne, links-vorne (Uhrzeigersinn).
 */
export function rectCorners(cx: number, cy: number, w: number, d: number, rotationDeg: number): Vec2[] {
  const hw = w / 2;
  const hd = d / 2;
  const c = { x: cx, y: cy };
  const local: Vec2[] = [
    { x: cx - hw, y: cy - hd },
    { x: cx + hw, y: cy - hd },
    { x: cx + hw, y: cy + hd },
    { x: cx - hw, y: cy + hd },
  ];
  if (!rotationDeg) return local;
  return local.map((p) => rotateAround(p, c, rotationDeg));
}

/** Grundfläche eines platzierten Objekts als Polygon (Weltkoordinaten). */
export function itemFootprint(item: Pick<PlacedItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>): Vec2[] {
  return rectCorners(item.x, item.y, item.width, item.depth, item.rotation);
}

/**
 * Sicherheitszone als Polygon: Grundfläche + Zone (vorne = +y lokal, hinten = -y, links = -x, rechts = +x).
 */
export function itemSafetyPolygon(
  item: Pick<PlacedItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  zone: SafetyZone,
): Vec2[] {
  const w = item.width + zone.links + zone.rechts;
  const d = item.depth + zone.vorne + zone.hinten;
  // Zentrum verschiebt sich um die Asymmetrie
  const dx = (zone.rechts - zone.links) / 2;
  const dy = (zone.vorne - zone.hinten) / 2;
  const c = rotateAround({ x: item.x + dx, y: item.y + dy }, { x: item.x, y: item.y }, item.rotation);
  return rectCorners(c.x, c.y, w, d, item.rotation);
}

export function zoneIsEmpty(z: SafetyZone): boolean {
  return z.vorne === 0 && z.hinten === 0 && z.links === 0 && z.rechts === 0;
}

/** Welt → lokale Objektkoordinaten. */
export function worldToLocal(p: Vec2, item: Pick<PlacedItem, 'x' | 'y' | 'rotation'>): Vec2 {
  const r = rotateAround(p, { x: item.x, y: item.y }, -item.rotation);
  return { x: r.x - item.x, y: r.y - item.y };
}
/** Lokale Objektkoordinaten → Welt. */
export function localToWorld(p: Vec2, item: Pick<PlacedItem, 'x' | 'y' | 'rotation'>): Vec2 {
  return rotateAround({ x: item.x + p.x, y: item.y + p.y }, { x: item.x, y: item.y }, item.rotation);
}
