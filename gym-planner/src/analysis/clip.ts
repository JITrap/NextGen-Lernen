/**
 * Polygon-Schnittflächen für die Flächenbilanz.
 *
 * - `clipPolygonConvex`: Sutherland–Hodgman (beliebiges einfaches Subjekt, konvexes Clip-Polygon).
 *   Bei konkavem Subjekt entstehen ggf. degenerierte „Brücken“ entlang der Clip-Kanten – die
 *   Shoelace-Fläche des Ergebnisses ist trotzdem exakt.
 * - `polygonIntersectionArea`: exakte Schnittfläche zweier einfacher Polygone. Ist das Clip-Polygon
 *   konkav, wird es per Ear-Clipping trianguliert und die Schnittflächen der Dreiecke summiert
 *   (Dreiecke einer Triangulation überlappen sich nicht → Summe exakt). Nur wenn eine
 *   Triangulation scheitert (selbstschneidendes/degeneriertes Polygon), wird näherungsweise gegen die
 *   konvexe Hülle geschnitten.
 */
import type { Vec2 } from '@/types';
import { signedArea, polygonArea, cross, sub, bbox, bboxOverlap, simplifyPolygon, lineIntersection, convexHull, polygonInside } from '@/geometry/polygon';

const TOL = 1e-9;

/** Ist das Polygon konvex (kollineare Punkte erlaubt)? */
export function isConvex(poly: Vec2[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const c = poly[(i + 2) % n];
    const cr = cross(sub(b, a), sub(c, b));
    if (Math.abs(cr) < TOL) continue;
    const s = cr > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Sutherland–Hodgman: schneidet `subject` mit dem konvexen Polygon `clip`. */
export function clipPolygonConvex(subject: Vec2[], clip: Vec2[]): Vec2[] {
  if (subject.length < 3 || clip.length < 3) return [];
  const orient = signedArea(clip) >= 0 ? 1 : -1;
  let output = subject;
  const n = clip.length;
  for (let i = 0; i < n && output.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % n];
    const edge = sub(b, a);
    if (Math.abs(edge.x) < TOL && Math.abs(edge.y) < TOL) continue;
    const input = output;
    output = [];
    const inside = (p: Vec2) => cross(edge, sub(p, a)) * orient >= -TOL;
    let prev = input[input.length - 1];
    let prevIn = inside(prev);
    for (const cur of input) {
      const curIn = inside(cur);
      if (curIn) {
        if (!prevIn) output.push(lineIntersection(prev, cur, a, b) ?? cur);
        output.push(cur);
      } else if (prevIn) {
        output.push(lineIntersection(prev, cur, a, b) ?? cur);
      }
      prev = cur;
      prevIn = curIn;
    }
  }
  return output;
}

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = cross(sub(b, a), sub(p, a));
  const d2 = cross(sub(c, b), sub(p, b));
  const d3 = cross(sub(a, c), sub(p, c));
  const hasNeg = d1 < -TOL || d2 < -TOL || d3 < -TOL;
  const hasPos = d1 > TOL || d2 > TOL || d3 > TOL;
  return !(hasNeg && hasPos);
}

/**
 * Ear-Clipping-Triangulation eines einfachen Polygons (O(n²), Polygone hier klein).
 * Liefert null, wenn keine gültige Triangulation gefunden wird (z. B. selbstschneidend).
 */
export function triangulate(polyIn: Vec2[]): Vec2[][] | null {
  const poly = simplifyPolygon(polyIn);
  const n = poly.length;
  if (n < 3) return null;
  if (n === 3) return [poly];
  const orient = signedArea(poly) >= 0 ? 1 : -1;
  const idx = poly.map((_, i) => i);
  const tris: Vec2[][] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let found = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k - 1 + idx.length) % idx.length];
      const i1 = idx[k];
      const i2 = idx[(k + 1) % idx.length];
      const a = poly[i0];
      const b = poly[i1];
      const c = poly[i2];
      const cr = cross(sub(b, a), sub(c, b)) * orient;
      if (cr <= TOL) continue; // reflexer oder kollinearer Eckpunkt
      let empty = true;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTriangle(poly[j], a, b, c)) { empty = false; break; }
      }
      if (!empty) continue;
      tris.push([a, b, c]);
      idx.splice(k, 1);
      found = true;
      break;
    }
    if (!found) return null;
  }
  if (idx.length === 3) tris.push([poly[idx[0]], poly[idx[1]], poly[idx[2]]]);
  return tris.length ? tris : null;
}

/** Schnittfläche zweier einfacher Polygone in Einheiten² (cm²). */
export function polygonIntersectionArea(a: Vec2[], b: Vec2[]): number {
  if (a.length < 3 || b.length < 3) return 0;
  if (!bboxOverlap(bbox(a), bbox(b))) return 0;
  const bConvex = isConvex(b);
  const aConvex = isConvex(a);
  // Schnelle Pfade: vollständig enthalten (nur bei konvexem Außenpolygon hinreichend).
  if (bConvex && polygonInside(a, b)) return polygonArea(a);
  if (aConvex && polygonInside(b, a)) return polygonArea(b);
  if (bConvex) return polygonArea(clipPolygonConvex(a, b));
  if (aConvex) return polygonArea(clipPolygonConvex(b, a));
  let tris = triangulate(b);
  let subject = a;
  if (!tris) { tris = triangulate(a); subject = b; }
  if (tris) {
    let s = 0;
    for (const t of tris) s += polygonArea(clipPolygonConvex(subject, t));
    return s;
  }
  // Fallback (degenerierte Polygone): Näherung über die konvexe Hülle, gedeckelt auf die kleinere Fläche.
  const approx = polygonArea(clipPolygonConvex(a, convexHull(b)));
  return Math.min(approx, polygonArea(a), polygonArea(b));
}

/** Schnittfläche in m² bei cm-Koordinaten. */
export function polygonIntersectionAreaM2(a: Vec2[], b: Vec2[]): number {
  return polygonIntersectionArea(a, b) / 10000;
}
