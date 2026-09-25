import type { Floor, Room, Vec2, Wall } from '@/types';
import {
  polygonArea, perimeter, centroid, ensureClockwise, signedArea, lineIntersection, cross, pointInPolygon, simplifyPolygon,
  distance, add, sub, scale, normalize, closestPointOnSegment, EPS,
} from './polygon';
import { allWalls, PointGrid, splitSegmentsAtIntersections, WALL_NODE_TOL, WALL_MIN_LENGTH, wallLength } from './walls';

/** Automatisch erkannter Raum: Innenpolygon (Wandstärke abgezogen), beteiligte Wände, optionale Löcher (Raum im Raum). */
export interface DetectedRoom {
  polygon: Vec2[];
  wallIds: string[];
  /** Flächen, die vollständig im Raum liegen und nicht zur Raumfläche zählen (Außenkante der inneren Wandzüge). */
  holes?: Vec2[][];
}

/** Räume, deren Innenpolygon kleiner ist (cm²), gelten als Artefakt (z. B. Spalt zwischen Doppelwänden). */
const MIN_ROOM_AREA = 100;
/** Bis zu diesem Abstand (cm) übernimmt `floorRooms` die Metadaten eines nahegelegenen, vorhandenen Schlüssels. */
const META_MATCH_DIST = 50;

/**
 * Stabiler Schlüssel für einen automatisch erkannten Raum: Schwerpunkt (10 cm) und Fläche des Polygons (0,1 m²),
 * `r:<x>:<y>:<a>`. Konzentrische Räume (Raum im Raum) haben denselben Schwerpunkt, aber verschiedene Flächen und
 * erhalten so verschiedene Schlüssel. Ältere Schlüssel ohne Fläche (`r:<x>:<y>`) werden weiterhin gefunden.
 */
export function loopKeyFor(polygon: Vec2[]): string {
  const c = centroid(polygon);
  return `r:${Math.round(c.x / 10)}:${Math.round(c.y / 10)}:${Math.round(polygonArea(polygon) / LOOP_KEY_AREA_UNIT)}`;
}
/** Flächeneinheit im Schlüssel (cm²) = 0,1 m². */
const LOOP_KEY_AREA_UNIT = 1000;
/** Bis zu diesem Flächenverhältnis (größer/kleiner) gilt ein gespeicherter Schlüssel mit Fläche noch als derselbe Raum. */
const META_MATCH_AREA_RATIO = 2;

/** Baut ein `Room` aus einem Polygon; `holes` werden von der Fläche abgezogen (Polygon bleibt das Außenpolygon). */
export function roomFromPolygon(polygon: Vec2[], base: Omit<Room, 'polygon' | 'areaM2' | 'perimeterCm' | 'centroid'>, holes: Vec2[][] = []): Room {
  const poly = ensureClockwise(polygon);
  let area = polygonArea(poly);
  for (const h of holes) area -= polygonArea(h);
  return { ...base, polygon: poly, areaM2: Math.max(0, area) / 10000, perimeterCm: perimeter(poly), centroid: centroid(poly), ...(holes.length ? { holes } : {}) };
}

/* ------------------------------------------------------------------ */
/* Planarer Graph                                                      */
/* ------------------------------------------------------------------ */

interface Seg {
  a: Vec2;
  b: Vec2;
  t: number;
  origin: string;
}
interface Edge {
  u: number;
  v: number;
  t: number;
  origins: string[];
}
interface HalfEdge {
  from: number;
  to: number;
  edge: Edge;
  twin: HalfEdge;
  /** Index in der winkelsortierten Ausgangsliste des Knotens `from`. */
  idx: number;
}
interface Graph {
  nodes: Vec2[];
  edges: Edge[];
  out: HalfEdge[][];
  halfEdges: HalfEdge[];
}

/**
 * Bereitet Wände als Achsensegmente auf: Wandenden, die innerhalb der halben Stärke einer anderen Wand liegen
 * (T-Stoß „auf die Fläche“ gezeichnet), werden auf deren Achse verschoben – bei zwei sich schneidenden Wänden
 * (Innenecke) auf den Achsenschnittpunkt. Anschließend Teilung an allen Schnittpunkten.
 */
function prepareSegments(walls: Wall[]): Seg[] {
  const base: Seg[] = [];
  for (const w of walls) {
    if (wallLength(w) < WALL_MIN_LENGTH) continue;
    base.push({ a: w.start, b: w.end, t: w.thickness, origin: w.id });
  }
  const n = base.length;
  const grid = new PointGrid<{ i: number; end: 0 | 1 }>(2);
  base.forEach((s, i) => {
    grid.insert(s.a, { i, end: 0 });
    grid.insert(s.b, { i, end: 1 });
  });
  const lens = base.map((s) => distance(s.a, s.b));
  const boxes = base.map((s) => {
    const m = s.t / 2 + WALL_NODE_TOL;
    return { minX: Math.min(s.a.x, s.b.x) - m, maxX: Math.max(s.a.x, s.b.x) + m, minY: Math.min(s.a.y, s.b.y) - m, maxY: Math.max(s.a.y, s.b.y) + m };
  });
  const snapped: Seg[] = base.map((s) => ({ ...s }));
  for (let i = 0; i < n; i++) {
    for (const end of [0, 1] as const) {
      const p = end ? base[i].b : base[i].a;
      // Liegt bereits ein anderes Wandende am Punkt → Knoten, nichts verschieben.
      const atNode = grid.query(p, WALL_NODE_TOL).some((r) => r.i !== i && distance(r.end ? base[r.i].b : base[r.i].a, p) < WALL_NODE_TOL);
      if (atNode) continue;
      const cands: { j: number; d: number; point: Vec2 }[] = [];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const bx = boxes[j];
        if (p.x < bx.minX || p.x > bx.maxX || p.y < bx.minY || p.y > bx.maxY) continue;
        const c = closestPointOnSegment(p, base[j].a, base[j].b);
        const d = distance(p, c.point);
        const off = c.t * lens[j];
        if (d > base[j].t / 2 + WALL_NODE_TOL || off <= WALL_NODE_TOL || off >= lens[j] - WALL_NODE_TOL) continue;
        cands.push({ j, d, point: c.point });
      }
      if (!cands.length) continue;
      cands.sort((x, y) => x.d - y.d);
      let target = cands[0].point;
      for (let k = 1; k < cands.length; k++) {
        const s0 = base[cands[0].j];
        const s1 = base[cands[k].j];
        const d0 = normalize(sub(s0.b, s0.a));
        const d1 = normalize(sub(s1.b, s1.a));
        if (Math.abs(cross(d0, d1)) < 0.01) continue;
        const x = lineIntersection(s0.a, s0.b, s1.a, s1.b);
        if (x && distance(x, p) <= (s0.t + s1.t) / 2 + WALL_NODE_TOL + 1) {
          target = x;
          break;
        }
      }
      if (end) snapped[i].b = target;
      else snapped[i].a = target;
    }
  }
  return splitSegmentsAtIntersections(snapped).map((p) => ({ a: p.a, b: p.b, t: p.source.t, origin: p.source.origin }));
}

function buildGraph(segs: Seg[]): Graph {
  const nodes: Vec2[] = [];
  const grid = new PointGrid<number>(2);
  const nodeFor = (p: Vec2): number => {
    for (const idx of grid.query(p, WALL_NODE_TOL)) if (distance(nodes[idx], p) < WALL_NODE_TOL) return idx;
    nodes.push(p);
    grid.insert(p, nodes.length - 1);
    return nodes.length - 1;
  };
  const edgeMap = new Map<string, Edge>();
  for (const s of segs) {
    const u = nodeFor(s.a);
    const v = nodeFor(s.b);
    if (u === v || distance(nodes[u], nodes[v]) < WALL_MIN_LENGTH) continue;
    const key = u < v ? `${u}:${v}` : `${v}:${u}`;
    const ex = edgeMap.get(key);
    if (ex) {
      ex.t = Math.max(ex.t, s.t);
      if (!ex.origins.includes(s.origin)) ex.origins.push(s.origin);
    } else edgeMap.set(key, { u, v, t: s.t, origins: [s.origin] });
  }
  const edges = [...edgeMap.values()];
  const out: HalfEdge[][] = nodes.map(() => []);
  const halfEdges: HalfEdge[] = [];
  for (const e of edges) {
    const h1 = { from: e.u, to: e.v, edge: e, idx: 0 } as HalfEdge;
    const h2 = { from: e.v, to: e.u, edge: e, idx: 0 } as HalfEdge;
    h1.twin = h2;
    h2.twin = h1;
    out[e.u].push(h1);
    out[e.v].push(h2);
    halfEdges.push(h1, h2);
  }
  for (let i = 0; i < out.length; i++) {
    const list = out[i];
    const p = nodes[i];
    const ang = new Map<HalfEdge, number>();
    for (const h of list) ang.set(h, Math.atan2(nodes[h.to].y - p.y, nodes[h.to].x - p.x));
    list.sort((a, b) => ang.get(a)! - ang.get(b)!);
    list.forEach((h, k) => (h.idx = k));
  }
  return { nodes, edges, out, halfEdges };
}

/**
 * Alle Flächen per Halbkanten-Traversierung: am Zielknoten die Kante direkt vor der Rückkante in aufsteigender
 * Winkelreihenfolge = „linkeste“ Abbiegung. Jede Fläche liegt damit links der Laufrichtung (in Rohkoordinaten),
 * Innenflächen erhalten positive, die Außenfläche einer Komponente negative Shoelace-Fläche.
 */
function traceFaces(g: Graph): HalfEdge[][] {
  const visited = new Set<HalfEdge>();
  const faces: HalfEdge[][] = [];
  const limit = g.halfEdges.length + 1;
  for (const start of g.halfEdges) {
    if (visited.has(start)) continue;
    const cycle: HalfEdge[] = [];
    let cur = start;
    let steps = 0;
    do {
      visited.add(cur);
      cycle.push(cur);
      const list = g.out[cur.to];
      cur = list[(cur.twin.idx - 1 + list.length) % list.length];
      steps++;
    } while (cur !== start && steps < limit);
    faces.push(cycle);
  }
  return faces;
}

/** Entfernt Sackgassen (Hin- und Rückkante direkt hintereinander) aus einem Zyklus. */
function pruneSpikes(cycle: HalfEdge[]): HalfEdge[] {
  const stack: HalfEdge[] = [];
  for (const h of cycle) {
    if (stack.length && stack[stack.length - 1] === h.twin) stack.pop();
    else stack.push(h);
  }
  while (stack.length >= 2 && stack[0] === stack[stack.length - 1].twin) {
    stack.pop();
    stack.shift();
  }
  return stack;
}

/** Zusammenhangskomponente je Knoten (Union-Find). */
function components(g: Graph): number[] {
  const parent = g.nodes.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const e of g.edges) {
    const a = find(e.u);
    const b = find(e.v);
    if (a !== b) parent[a] = b;
  }
  return g.nodes.map((_, i) => find(i));
}

/**
 * Versetzt einen Zyklus (Wandachsen) je Kante um die halbe Stärke auf die Flächenseite
 * (links der Laufrichtung in Rohkoordinaten – so liefert die Traversierung alle Flächen).
 */
function offsetFace(points: Vec2[], ts: number[]): Vec2[] {
  const n = points.length;
  const lines: { a: Vec2; b: Vec2; d: Vec2 }[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const d = normalize(sub(b, a));
    const off = scale({ x: -d.y, y: d.x }, ts[i] / 2);
    lines.push({ a: add(a, off), b: add(b, off), d });
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    if (Math.abs(cross(prev.d, cur.d)) < 1e-9) {
      if (distance(prev.b, cur.a) > 1e-6) out.push(prev.b);
      out.push(cur.a);
      continue;
    }
    const p = lineIntersection(prev.a, prev.b, cur.a, cur.b);
    const maxT = Math.max(ts[(i - 1 + n) % n], ts[i]);
    out.push(p && distance(p, points[i]) <= 10 * maxT + 1 ? p : cur.a);
  }
  return simplifyPolygon(out);
}

interface FaceInfo {
  hes: HalfEdge[];
  axis: Vec2[];
  area: number;
  comp: number;
}

/**
 * Erkennt Räume aus geschlossenen Wandzügen (inkl. Hallen-Außenwänden).
 * - Planarer Graph aus den Wandachsen (Knoten-Toleranz 0,5 cm, Teilung an Schnittpunkten, Kanten < 1 cm verworfen)
 * - Minimale Flächen per Halbkanten-Traversierung; Außenfläche je Komponente ausgeschlossen; Sackgassen ignoriert
 * - Innenpolygon = Zyklus je Kante um die halbe Wandstärke nach innen versetzt
 * - Raum im Raum: äußerer Raum erhält `holes` (Außenkante des inneren Wandzugs), Fläche = außen − Löcher
 */
export function detectWallRooms(walls: Wall[]): DetectedRoom[] {
  if (walls.length < 3) return [];
  const g = buildGraph(prepareSegments(walls));
  if (g.edges.length < 3) return [];
  const comp = components(g);
  const faces: FaceInfo[] = traceFaces(g).map((cycle) => {
    const hes = pruneSpikes(cycle);
    const axis = hes.map((h) => g.nodes[h.from]);
    return { hes, axis, area: hes.length >= 3 ? signedArea(axis) : 0, comp: comp[cycle[0].from] };
  });
  // Außenfläche je Komponente: die am stärksten negativ orientierte.
  const outerByComp = new Map<number, FaceInfo>();
  for (const f of faces) {
    const cur = outerByComp.get(f.comp);
    if (!cur || f.area < cur.area) outerByComp.set(f.comp, f);
  }
  // Lochkandidaten: Außenkante je Komponente (Achse + halbe Stärke nach außen).
  const holeOf = new Map<number, { axis: Vec2[]; poly: Vec2[]; rep: Vec2 }>();
  for (const [c, f] of outerByComp) {
    if (f.hes.length < 3 || f.area >= -EPS) continue;
    const poly = offsetFace(f.axis, f.hes.map((h) => h.edge.t));
    if (poly.length < 3) continue;
    holeOf.set(c, { axis: f.axis, poly: ensureClockwise(poly), rep: f.axis[0] });
  }
  const rooms: DetectedRoom[] = [];
  for (const f of faces) {
    if (f.hes.length < 3 || f.area <= 0 || outerByComp.get(f.comp) === f) continue;
    const poly = offsetFace(f.axis, f.hes.map((h) => h.edge.t));
    // Degenerierter Offset (Orientierung kippt, Fläche wächst) → kein Raum (z. B. Fläche schmaler als die Wandstärke).
    if (poly.length < 3 || signedArea(poly) <= 0 || signedArea(poly) >= f.area || polygonArea(poly) < MIN_ROOM_AREA) continue;
    const wallIds: string[] = [];
    for (const h of f.hes) for (const id of h.edge.origins) if (!wallIds.includes(id)) wallIds.push(id);
    let holes: Vec2[][] | undefined;
    if (holeOf.size) {
      const inside: number[] = [];
      for (const [c, h] of holeOf) if (c !== f.comp && pointInPolygon(h.rep, f.axis)) inside.push(c);
      const direct = inside.filter((c) => !inside.some((o) => o !== c && pointInPolygon(holeOf.get(c)!.rep, holeOf.get(o)!.axis)));
      if (direct.length) holes = direct.map((c) => holeOf.get(c)!.poly);
    }
    rooms.push(holes ? { polygon: poly, wallIds, holes } : { polygon: poly, wallIds });
  }
  rooms.sort((a, b) => {
    const ca = centroid(a.polygon);
    const cb = centroid(b.polygon);
    return ca.y - cb.y || ca.x - cb.x;
  });
  return rooms;
}

/* ------------------------------------------------------------------ */
/* Räume eines Stockwerks                                              */
/* ------------------------------------------------------------------ */

/** Schwerpunkt (cm) und Fläche (cm², null bei alten Schlüsseln) aus `r:<x>:<y>[:<a>][#i]`. */
export function parseLoopKey(key: string): { p: Vec2; area: number | null } | null {
  const m = /^r:(-?\d+):(-?\d+)(?::(\d+))?(?:#\d+)?$/.exec(key);
  if (!m) return null;
  return { p: { x: Number(m[1]) * 10, y: Number(m[2]) * 10 }, area: m[3] != null ? Number(m[3]) * LOOP_KEY_AREA_UNIT : null };
}

/**
 * Räume eines Stockwerks inkl. Löcher: automatisch erkannte (mit Metadaten) + Zonen.
 * Fehlt zum Schlüssel ein `roomMeta`-Eintrag, wird lesend der nächstgelegene vorhandene Schlüssel
 * innerhalb 50 cm übernommen (Wände minimal verschoben → Name/Typ bleiben erhalten); enthält der gespeicherte
 * Schlüssel eine Fläche, muss sie zur Raumfläche passen (Verhältnis ≤ 2), damit konzentrische Räume nicht
 * die Metadaten des jeweils anderen übernehmen. Alte Schlüssel ohne Fläche werden nur über den Schwerpunkt zugeordnet.
 */
export function floorRoomsWithHoles(floor: Floor): { room: Room; holes: Vec2[][] }[] {
  const out: { room: Room; holes: Vec2[][] }[] = [];
  const detected = detectWallRooms(allWalls(floor));
  const keys = detected.map((r) => loopKeyFor(r.polygon));
  const effective: string[] = new Array(detected.length);
  const used = new Set<string>();
  for (let i = 0; i < detected.length; i++) {
    if (floor.roomMeta[keys[i]] && !used.has(keys[i])) {
      effective[i] = keys[i];
      used.add(keys[i]);
    }
  }
  const metaPoints = Object.keys(floor.roomMeta)
    .map((k) => ({ k, info: parseLoopKey(k) }))
    .filter((e): e is { k: string; info: { p: Vec2; area: number | null } } => !!e.info);
  for (let i = 0; i < detected.length; i++) {
    if (effective[i]) continue;
    const c = centroid(detected[i].polygon);
    const area = polygonArea(detected[i].polygon);
    let best: string | null = null;
    let bestD = META_MATCH_DIST;
    let bestRatio = Infinity;
    for (const m of metaPoints) {
      if (used.has(m.k)) continue;
      const d = distance(m.info.p, c);
      if (d > META_MATCH_DIST) continue;
      let ratio = 1;
      if (m.info.area != null) {
        ratio = Math.max(m.info.area, area) / Math.max(1, Math.min(m.info.area, area));
        if (ratio > META_MATCH_AREA_RATIO) continue;
      }
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && ratio < bestRatio)) {
        bestD = d;
        bestRatio = ratio;
        best = m.k;
      }
    }
    let key = best ?? keys[i];
    if (used.has(key)) key = `${keys[i]}#${i}`;
    effective[i] = key;
    used.add(key);
  }
  detected.forEach((r, i) => {
    const key = effective[i];
    const meta = floor.roomMeta[key] ?? { name: 'Raum', type: 'Sonstiges' as const };
    const holes = r.holes ?? [];
    out.push({ room: roomFromPolygon(r.polygon, { id: key, source: 'auto', loopKey: key, ...meta }, holes), holes });
  });
  for (const z of floor.zones) {
    if (z.hidden) continue;
    const { id, polygon, locked: _l, hidden: _h, ...meta } = z;
    out.push({ room: roomFromPolygon(polygon, { id, source: 'zone', ...meta }), holes: [] });
  }
  return out;
}

/** Alle Räume eines Stockwerks: automatisch erkannte (mit Metadaten, Löcher abgezogen) + Zonen. */
export function floorRooms(floor: Floor): Room[] {
  return floorRoomsWithHoles(floor).map((e) => e.room);
}
