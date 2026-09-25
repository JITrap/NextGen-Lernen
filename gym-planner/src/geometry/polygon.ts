import type { Vec2 } from '@/types';

export const EPS = 1e-6;

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}
export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function normalize(a: Vec2): Vec2 {
  const l = length(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}
/** Normale (90° gegen den Uhrzeigersinn in Bildschirmkoordinaten = links der Richtung). */
export function perp(a: Vec2): Vec2 {
  return { x: -a.y, y: a.x };
}
export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function equals(a: Vec2, b: Vec2, eps = EPS): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}
/** Rotiert Punkt p um Zentrum c um deg Grad (im Uhrzeigersinn bei y nach unten). */
export function rotateAround(p: Vec2, c: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}
export function angleDeg(a: Vec2, b: Vec2): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Vorzeichenbehaftete Fläche (Shoelace / Gaußsche Trapezformel). Positiv bei Uhrzeigersinn in Bildschirmkoordinaten. */
export function signedArea(poly: Vec2[]): number {
  const n = poly.length;
  if (n < 3) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}
/** Fläche in Einheiten² (cm²), immer positiv. */
export function polygonArea(poly: Vec2[]): number {
  return Math.abs(signedArea(poly));
}
/** Fläche in m² bei cm-Koordinaten. */
export function polygonAreaM2(poly: Vec2[]): number {
  return polygonArea(poly) / 10000;
}
export function perimeter(poly: Vec2[]): number {
  const n = poly.length;
  if (n < 2) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += distance(poly[i], poly[(i + 1) % n]);
  return s;
}
/** Flächenschwerpunkt. Bei degenerierten Polygonen Mittelwert der Punkte. */
export function centroid(poly: Vec2[]): Vec2 {
  const n = poly.length;
  if (n === 0) return { x: 0, y: 0 };
  const a = signedArea(poly);
  if (Math.abs(a) < EPS) {
    const s = poly.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
    return scale(s, 1 / n);
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export function bbox(points: Vec2[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
export function bboxOverlap(a: BBox, b: BBox, margin = 0): boolean {
  return a.minX <= b.maxX + margin && b.minX <= a.maxX + margin && a.minY <= b.maxY + margin && b.minY <= a.maxY + margin;
}
export function bboxToPolygon(b: BBox): Vec2[] {
  return [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
}
/** Rechteck aus zwei Eckpunkten (beliebige Reihenfolge) als Polygon im Uhrzeigersinn. */
export function rectPolygon(a: Vec2, b: Vec2): Vec2[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}
/** Punkt im Polygon (Even-Odd). Punkte auf der Kante gelten als innen. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (distanceToSegment(p, a, b) < EPS) return true;
    const intersect = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}
/** Alle Punkte des inneren Polygons innerhalb des äußeren? */
export function polygonInside(inner: Vec2[], outer: Vec2[]): boolean {
  return inner.every((p) => pointInPolygon(p, outer));
}
/** Nächster Punkt auf Strecke ab zu p. */
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < EPS) return { point: a, t: 0 };
  let t = dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  return { point: add(a, scale(ab, t)), t };
}
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  return distance(p, closestPointOnSegment(p, a, b).point);
}
/** Schnittpunkt zweier Strecken (inkl. Parameter). null, wenn parallel oder außerhalb. */
export function segmentIntersection(
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
  inclusive = true,
): { point: Vec2; t: number; u: number } | null {
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const denom = cross(r, s);
  if (Math.abs(denom) < EPS) return null;
  const qp = sub(b1, a1);
  const t = cross(qp, s) / denom;
  const u = cross(qp, r) / denom;
  const lo = inclusive ? -EPS : EPS;
  const hi = inclusive ? 1 + EPS : 1 - EPS;
  if (t < lo || t > hi || u < lo || u > hi) return null;
  return { point: add(a1, scale(r, t)), t, u };
}
/** Schnittpunkt zweier Geraden (unendlich). */
export function lineIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const denom = cross(r, s);
  if (Math.abs(denom) < EPS) return null;
  const t = cross(sub(b1, a1), s) / denom;
  return add(a1, scale(r, t));
}
/** Stellt Uhrzeigersinn sicher (positive signierte Fläche in Bildschirmkoordinaten). */
export function ensureClockwise(poly: Vec2[]): Vec2[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}
export function isClockwise(poly: Vec2[]): boolean {
  return signedArea(poly) > 0;
}
/** Entfernt doppelte aufeinanderfolgende Punkte und kollineare Zwischenpunkte. */
export function simplifyPolygon(poly: Vec2[], eps = 1e-3): Vec2[] {
  const out: Vec2[] = [];
  for (const p of poly) {
    if (out.length && equals(out[out.length - 1], p, eps)) continue;
    out.push(p);
  }
  if (out.length > 1 && equals(out[0], out[out.length - 1], eps)) out.pop();
  if (out.length < 3) return out;
  const res: Vec2[] = [];
  for (let i = 0; i < out.length; i++) {
    const prev = out[(i - 1 + out.length) % out.length];
    const cur = out[i];
    const next = out[(i + 1) % out.length];
    const c = cross(sub(cur, prev), sub(next, cur));
    if (Math.abs(c) < eps) continue;
    res.push(cur);
  }
  return res.length >= 3 ? res : out;
}
/**
 * Versetzt ein (einfaches) Polygon um `d` nach innen (d>0) bzw. außen (d<0),
 * per Kantenverschiebung und Geradenschnitt. Für konvexe und einfache konkave Polygone (L-Form) geeignet.
 */
export function offsetPolygon(polyIn: Vec2[], d: number): Vec2[] {
  const poly = ensureClockwise(simplifyPolygon(polyIn));
  const n = poly.length;
  if (n < 3 || Math.abs(d) < EPS) return poly;
  // Bei Uhrzeigersinn (Bildschirm, y nach unten) zeigt die "rechte" Normale (perp gedreht) nach innen.
  const lines: { a: Vec2; b: Vec2 }[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const dir = normalize(sub(b, a));
    // Innennormale bei CW in y-down: (-dir.y, dir.x) zeigt nach rechts der Laufrichtung = innen
    const nrm = { x: -dir.y, y: dir.x };
    const off = scale(nrm, d);
    lines.push({ a: add(a, off), b: add(b, off) });
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    const p = lineIntersection(prev.a, prev.b, cur.a, cur.b);
    out.push(p ?? cur.a);
  }
  return out;
}
/** Polygon als flaches Zahlen-Array für Konva. */
export function flatten(poly: Vec2[]): number[] {
  const out: number[] = [];
  for (const p of poly) out.push(p.x, p.y);
  return out;
}
export function translatePolygon(poly: Vec2[], dx: number, dy: number): Vec2[] {
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
/** Konvexe Hülle (Andrew's monotone chain). */
export function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(sub(lower[lower.length - 1], lower[lower.length - 2]), sub(p, lower[lower.length - 2])) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(sub(upper[upper.length - 1], upper[upper.length - 2]), sub(p, upper[upper.length - 2])) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
