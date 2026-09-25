import type { Vec2 } from '@/types';
import type { Viewport } from '@/store/uiStore';

export const MIN_SCALE = 0.02; // px/cm  (1 m = 2 px)
export const MAX_SCALE = 8; // px/cm

export function screenToWorld(p: Vec2, v: Viewport): Vec2 {
  return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
}
export function worldToScreen(p: Vec2, v: Viewport): Vec2 {
  return { x: p.x * v.scale + v.x, y: p.y * v.scale + v.y };
}
/** Zoomt um einen Bildschirmpunkt. */
export function zoomAt(v: Viewport, screen: Vec2, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const w = screenToWorld(screen, v);
  return { scale, x: screen.x - w.x * scale, y: screen.y - w.y * scale };
}
/** Passt ein Welt-Rechteck in die Bildschirmgröße ein. */
export function fitToBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }, width: number, height: number, padding = 60): Viewport {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((width - padding * 2) / bw, (height - padding * 2) / bh)));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { scale, x: width / 2 - cx * scale, y: height / 2 - cy * scale };
}
/** Sinnvolle Rasterschrittweite in cm für Lineal/Beschriftung je nach Zoom (ca. alle 80 px). */
export function niceStep(scale: number, targetPx = 80): number {
  const raw = targetPx / scale; // cm
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
  for (const s of steps) if (s >= raw) return s;
  return 10000;
}
