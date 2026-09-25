/**
 * Werkzeug „Wand“: Klick-Klick-Kette mit Snapping (Wandenden/-mitten, Hallen-Ecken, Hallen-Innenkanten,
 * Wandachsen, 90°/45°), Live-Länge und -Winkel, exakter Länge/Winkel per Tastatur und automatischem
 * Teilen an T-Stößen und Kreuzungen, damit die Raumerkennung geschlossene Wandzüge findet.
 *
 * Reine Helfer (computeSegmentEnd, findWallSplits, resolveWallSnap, wallPropsFromOptions) sind exportiert
 * und in wallTool.test.ts getestet.
 */
import { memo, useMemo } from 'react';
import { Group, Line, Circle, Label, Tag, Text } from 'react-konva';
import type { Vec2, Wall, Opening, Hall, WallType } from '@/types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import { createClickTracker, type ToolContext, type ToolEvent } from './types';
import { useSnapGuides } from '../overlays/SnapGuides';
import { worldToScreen } from '../viewport';
import { transaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createWall, DEFAULT_WALL_THICKNESS } from '@/store/factories';
import { WALL_TYPE_MAP } from '@/data/wallTypes';
import { useIsDark } from '@/hooks/useTheme';
import type { SnapGuide, SnapKind, SnapResult } from '@/geometry/snap';
import { distance, closestPointOnSegment, lineIntersection, bbox, bboxOverlap, flatten, equals, angleDeg, EPS } from '@/geometry/polygon';
import {
  hallInnerPolygon, isHallWallId, wallOutline, wallNormal, wallMidpoint, splitWallsAtIntersectionsDetailed, WALL_NODE_TOL,
} from '@/geometry/walls';
import { formatLength, formatDegrees, parseLength, parseNumber, normalizeAngle, DEG2RAD, RAD2DEG } from '@/geometry/units';

/* ------------------------------------------------------------------ */
/* Konstanten & Zustand                                                */
/* ------------------------------------------------------------------ */

/** Segmente kürzer als dieser Wert (cm) werden verworfen. */
export const MIN_SEGMENT_CM = 2;
/** Fangradius in Pixeln (wie im Canvas-Snapping). */
const SNAP_PX = 8;
/** Maximale Länge der Tastatureingabe. */
const MAX_TYPED = 12;

export type WallInputField = 'length' | 'angle';

/** Was ein Segment-Commit im Stockwerk geändert hat – für „letztes Segment zurück“ ohne globales Undo. */
export interface WallSegmentRecord {
  /** Startpunkt des Segments (wird bei Rücknahme wieder Kettenstart). */
  start: Vec2;
  /** IDs der angelegten Wände (neues Segment und Teilstücke geteilter Wände). */
  addedIds: string[];
  /** Wände, die durch Teilstücke ersetzt wurden (Originale zum Wiederherstellen). */
  removed: Wall[];
  /** Öffnungen, die auf Teilstücke gewandert sind (mit ursprünglichem Wandbezug/Offset). */
  openings: Pick<Opening, 'id' | 'wallId' | 'offset'>[];
}

export interface WallToolState {
  /** Startpunkt des Segments, das gerade „in der Luft hängt“ (null = keine Kette aktiv). */
  chainStart: Vec2 | null;
  /** Gesnappter Cursor (Weltkoordinaten). */
  cursor: Vec2 | null;
  /** Bereits angelegte Segmente in dieser Kette. */
  count: number;
  /** Angelegte Segmente dieser Kette (für „letztes Segment zurück“ per Backspace). */
  history: WallSegmentRecord[];
  /** Tastatureingabe für Länge („350“, „3,5m“) und Winkel (Grad). */
  typedLength: string;
  typedAngle: string;
  field: WallInputField;
  /** Snapping aktiv (Einstellung an, Alt nicht gedrückt) – steuert die Richtung bei getippter Länge. */
  snapping: boolean;
}

const INITIAL: WallToolState = {
  chainStart: null,
  cursor: null,
  count: 0,
  history: [],
  typedLength: '',
  typedAngle: '',
  field: 'length',
  snapping: true,
};

/** Transienter Zustand des Wandwerkzeugs (reaktiv für Overlays). */
export const useWallTool = createToolStore<WallToolState>(INITIAL);
type WallToolStore = ReturnType<typeof useWallTool.getState>;

/* ------------------------------------------------------------------ */
/* Reine Helfer                                                        */
/* ------------------------------------------------------------------ */

function clean(v: number): number {
  const r = Math.round(v * 1e4) / 1e4;
  return r === 0 ? 0 : r;
}

/** Einheitsvektor aus Winkel in Grad (im Uhrzeigersinn, y nach unten; 0° = nach rechts, 90° = nach unten). */
export function dirFromAngle(deg: number): Vec2 {
  const r = deg * DEG2RAD;
  return { x: Math.cos(r), y: Math.sin(r) };
}

/**
 * Endpunkt eines Segments ab `start`. Getippte Länge/Winkel haben Vorrang vor dem Cursor:
 * - `typedAngle` (Grad, im Uhrzeigersinn) legt die Richtung fest, sonst die Richtung zum Cursor,
 *   bei `snapped` auf 45°-Schritte gerundet (Alt aus, Snapping an).
 * - `typedLength` (cm) legt die Länge fest, sonst der Abstand zum Cursor.
 * Koordinaten werden auf 1/10 000 cm gerundet (keine Float-Reste wie 2e-14).
 */
export function computeSegmentEnd(start: Vec2, cursor: Vec2, typedLength: number | null, typedAngle: number | null, snapped: boolean): Vec2 {
  const dx = cursor.x - start.x;
  const dy = cursor.y - start.y;
  const cursorLen = Math.hypot(dx, dy);
  let angle: number;
  if (typedAngle != null && Number.isFinite(typedAngle)) angle = typedAngle;
  else if (cursorLen < EPS) angle = 0;
  else {
    angle = Math.atan2(dy, dx) * RAD2DEG;
    if (snapped) angle = Math.round(angle / 45) * 45;
  }
  const len = typedLength != null && Number.isFinite(typedLength) && typedLength > 0 ? typedLength : cursorLen;
  const d = dirFromAngle(angle);
  return { x: clean(start.x + d.x * len), y: clean(start.y + d.y * len) };
}

/** Getippte Länge („350“ = cm, „3,5m“, „12,5cm“) → cm oder null. */
export function parseTypedLength(s: string): number | null {
  if (!s) return null;
  const v = parseLength(s, 'cm');
  return v != null && v > 0 ? v : null;
}
/** Getippter Winkel (Grad, Komma oder Punkt) → Zahl oder null. */
export function parseTypedAngle(s: string): number | null {
  if (!s) return null;
  const v = parseNumber(s);
  return v != null ? v : null;
}

/** Wand-Eigenschaften aus ui.toolOptions (Schlüssel der Werkzeugleiste: wallThickness, wallType, wallHeight; 0 = bis Decke). */
export function wallPropsFromOptions(opts: Record<string, string | number | boolean>): Pick<Wall, 'thickness' | 'type' | 'height'> {
  const t = Number(opts.wallThickness);
  const h = Number(opts.wallHeight);
  const type = typeof opts.wallType === 'string' && opts.wallType in WALL_TYPE_MAP ? (opts.wallType as WallType) : 'Trockenbau';
  return {
    thickness: Number.isFinite(t) && t > 0 ? t : DEFAULT_WALL_THICKNESS,
    type,
    height: Number.isFinite(h) && h > 0 ? h : null,
  };
}

export interface WallSnapOptions {
  /** Echte Wände des Stockwerks (ohne Hallen-Außenwände); ihre Achsen sind Fanglinien. */
  walls: Wall[];
  hall: Hall | null | undefined;
  /** Fangradius in cm. */
  threshold: number;
  /** Startpunkt des laufenden Segments (Winkel-Snapping). */
  angleFrom: Vec2 | null;
  /** Snapping aktiv (Einstellung an, Alt nicht gedrückt). */
  enabled: boolean;
}

interface SnapLine {
  a: Vec2;
  b: Vec2;
}

/** Fanglinien: Hallen-Innenkanten + Achsen echter, sichtbarer Wände. */
function snapLines(opts: WallSnapOptions): SnapLine[] {
  const out: SnapLine[] = [];
  if (opts.hall && opts.hall.polygon.length >= 3) {
    const inner = hallInnerPolygon(opts.hall);
    for (let i = 0; i < inner.length; i++) out.push({ a: inner[i], b: inner[(i + 1) % inner.length] });
  }
  for (const w of opts.walls) {
    if (w.hidden || isHallWallId(w.id)) continue;
    out.push({ a: w.start, b: w.end });
  }
  return out;
}

/**
 * Ergänzt das Basis-Snapping (`ctx.snap`) um Fanglinien: Innenkanten der Hallen-Außenwand und Achsen
 * bestehender Wände. Starke Treffer (Wandende, Wandmitte, Hallen-Ecke) bleiben unverändert. Sonst wird der
 * Punkt auf die nächste Fanglinie innerhalb der Schwelle projiziert – bei aktivem Winkel-Snapping als
 * Schnitt des gesnappten Strahls mit der Linie (Winkel bleibt exakt, Wand schließt sauber an).
 * Alle Ergebnispunkte sind auf 1/10 000 cm gerundet.
 */
export function resolveWallSnap(p: Vec2, baseIn: SnapResult, opts: WallSnapOptions): SnapResult {
  // Float-Reste des Basis-Snappings (z. B. 799,9999999) entfernen, damit Wandknoten exakt zusammenfallen.
  const base: SnapResult =
    baseIn.point.x === clean(baseIn.point.x) && baseIn.point.y === clean(baseIn.point.y) ? baseIn : { ...baseIn, point: { x: clean(baseIn.point.x), y: clean(baseIn.point.y) } };
  if (!opts.enabled) return base;
  if (base.kind === 'wall-end' || base.kind === 'wall-mid' || base.kind === 'hall-vertex') return base;
  const t = Math.max(0, opts.threshold);
  let best: { line: SnapLine; point: Vec2 } | null = null;
  let bestD = t;
  for (const line of snapLines(opts)) {
    if (distance(line.a, line.b) < EPS) continue;
    const c = closestPointOnSegment(p, line.a, line.b);
    const d = distance(p, c.point);
    if (d <= bestD) {
      bestD = d;
      best = { line, point: c.point };
    }
  }
  if (!best) return base;
  const { line } = best;
  const edgeGuide: SnapGuide = { from: line.a, to: line.b, kind: 'hall-vertex' };
  if (base.kind === 'angle' && opts.angleFrom) {
    const from = opts.angleFrom;
    const hit = lineIntersection(from, base.point, line.a, line.b);
    if (hit) {
      const onSeg = distance(closestPointOnSegment(hit, line.a, line.b).point, hit) < 0.01;
      const ahead = (hit.x - from.x) * (base.point.x - from.x) + (hit.y - from.y) * (base.point.y - from.y) > 0;
      if (onSeg && ahead && distance(hit, p) <= t * 2) {
        const point = { x: clean(hit.x), y: clean(hit.y) };
        return { point, kind: 'angle', guides: [{ from, to: point, kind: 'angle' }, edgeGuide] };
      }
    }
    // Strahl trifft die Linie nicht in der Nähe → Winkel-Snapping hat Vorrang.
    return base;
  }
  const point = { x: clean(best.point.x), y: clean(best.point.y) };
  const kind: SnapKind = 'hall-vertex';
  return { point, kind, guides: [edgeGuide] };
}

export interface WallSplitResult {
  /** IDs bestehender Wände, die durch Teilstücke ersetzt werden. */
  removeIds: string[];
  /** Neue Wände: Teilstücke geteilter Wände (erstes behält die ID) + Teilstücke der neuen Wand. */
  add: Wall[];
  /** Öffnungen, die auf ein anderes Teilstück wandern (nur geänderte, mit neuem wallId/offset). */
  openings: Opening[];
}

/**
 * Ermittelt, welche Wände beim Einfügen von `newWall` geteilt werden müssen:
 * - T-Stoß: ein Ende der neuen Wand liegt auf einer bestehenden Wand → bestehende Wand wird dort geteilt;
 * - umgekehrt: ein Ende einer bestehenden Wand liegt auf der neuen Wand → neue Wand wird geteilt;
 * - Kreuzung (X): beide werden geteilt.
 * Betrachtet werden nur echte, sichtbare, nicht gesperrte Wände, deren Bounding-Box die neue Wand berührt.
 * Basis ist `splitWallsAtIntersectionsDetailed` aus geometry/walls (inkl. Öffnungs-Umverteilung).
 */
export function findWallSplits(newWall: Wall, walls: Wall[], openings: Opening[] = []): WallSplitResult {
  const nb = bbox([newWall.start, newWall.end]);
  const margin = newWall.thickness / 2 + WALL_NODE_TOL;
  const candidates = walls.filter(
    (w) => w.id !== newWall.id && !isHallWallId(w.id) && !w.hidden && !w.locked && bboxOverlap(bbox([w.start, w.end]), nb, margin + w.thickness / 2 + WALL_NODE_TOL),
  );
  if (!candidates.length) return { removeIds: [], add: [newWall], openings: [] };
  const inputs = [...candidates, newWall];
  const candidateIds = new Set(candidates.map((c) => c.id));
  const subsetOpenings = openings.filter((o) => candidateIds.has(o.wallId));
  const res = splitWallsAtIntersectionsDetailed(inputs, subsetOpenings);
  // Teilstücke je Ursprungswand: das Ergebnis ist in Eingabereihenfolge gruppiert, das erste Teilstück behält die ID.
  const groups = new Map<string, Wall[]>();
  let current: Wall[] | null = null;
  for (const w of res.walls) {
    if (inputs.some((i) => i.id === w.id)) {
      current = [];
      groups.set(w.id, current);
    }
    if (current) current.push(w);
  }
  const removeIds: string[] = [];
  const add: Wall[] = [];
  for (const c of candidates) {
    const parts = groups.get(c.id) ?? [c];
    const unchanged = parts.length === 1 && equals(parts[0].start, c.start) && equals(parts[0].end, c.end);
    if (unchanged) continue;
    removeIds.push(c.id);
    add.push(...parts);
  }
  const newParts = groups.get(newWall.id) ?? [newWall];
  add.push(...newParts);
  const changed: Opening[] = [];
  if (subsetOpenings.length) {
    res.openings.forEach((o, i) => {
      const orig = subsetOpenings[i];
      if (o.wallId !== orig.wallId || Math.abs(o.offset - orig.offset) > 1e-6) changed.push(o);
    });
  }
  return { removeIds, add, openings: changed };
}

/* ------------------------------------------------------------------ */
/* Werkzeug-Logik                                                      */
/* ------------------------------------------------------------------ */

function snappingEnabled(e: ToolEvent | null, ctx: ToolContext): boolean {
  return ctx.project.settings.snapEnabled && !ctx.ui.snapOverride && !(e?.alt ?? false);
}

/** Cursor snappen: Basis-Snapping (ohne Objektkanten) + Fanglinien für Wände. */
function snapCursor(e: ToolEvent, ctx: ToolContext): SnapResult {
  const st = useWallTool.getState();
  const base = ctx.snap(e.world, { angleFrom: st.chainStart, targets: { 'item-edge': false } });
  return resolveWallSnap(e.world, base, {
    walls: ctx.floor.walls,
    hall: ctx.floor.hall,
    threshold: ctx.pxToWorld(SNAP_PX),
    angleFrom: st.chainStart,
    enabled: snappingEnabled(e, ctx),
  });
}

/** Legt ein Wandsegment an (inkl. Teilen an T-Stößen/Kreuzungen) – ein Undo-Schritt. null bei zu kurzem Segment. */
function commitSegment(ctx: ToolContext, start: Vec2, end: Vec2): WallSegmentRecord | null {
  if (distance(start, end) < MIN_SEGMENT_CM) return null;
  const wall = createWall({ start, end, ...wallPropsFromOptions(ctx.ui.toolOptions) });
  const { removeIds, add, openings } = findWallSplits(wall, ctx.floor.walls, ctx.floor.openings);
  const floorId = ctx.floor.id;
  const store = ctx.store;
  const removedSet = new Set(removeIds);
  const record: WallSegmentRecord = {
    start,
    // Alle eingefügten Wände – auch das erste Teilstück, das die ID der geteilten Wand behält.
    addedIds: add.map((w) => w.id),
    removed: ctx.floor.walls.filter((w) => removedSet.has(w.id)),
    openings: openings.map((o) => {
      const orig = ctx.floor.openings.find((x) => x.id === o.id);
      return { id: o.id, wallId: orig?.wallId ?? o.wallId, offset: orig?.offset ?? o.offset };
    }),
  };
  transaction(() => {
    for (const o of openings) store.updateOpening(floorId, o.id, { wallId: o.wallId, offset: o.offset });
    store.replaceWalls(floorId, removeIds, add);
  });
  return record;
}

/** Beendet die Kette (angelegte Wände bleiben, das schwebende Segment wird verworfen). */
export function finishWallChain(): void {
  const st = useWallTool.getState();
  if (st.chainStart) st.reset();
  useSnapGuides.getState().set(null);
  clicks.reset();
}

/**
 * Nimmt das zuletzt angelegte Segment der Kette gezielt zurück (eigener Undo-Schritt, kein globales Undo –
 * zwischenzeitliche andere Aktionen bleiben unberührt): angelegte Wände entfernen, geteilte Wände samt
 * Öffnungsbezügen wiederherstellen, Kettenstart auf den Segmentanfang setzen.
 */
export function undoLastSegment(ctx: ToolContext): boolean {
  const st = useWallTool.getState();
  if (!st.history.length || !st.chainStart) return false;
  const rec = st.history[st.history.length - 1];
  const floor = ctx.floor;
  const store = ctx.store;
  const present = new Set(floor.walls.map((w) => w.id));
  // Eingefügte Wände (inkl. Teilstücke) entfernen und die geteilten Originale wiederherstellen.
  const removeIds = rec.addedIds.filter((id) => present.has(id));
  transaction(() => {
    // Öffnungen zuerst zurückhängen, damit replaceWalls sie nicht mit den Teilstücken entfernt.
    for (const o of rec.openings) {
      if (floor.openings.some((x) => x.id === o.id)) store.updateOpening(floor.id, o.id, { wallId: o.wallId, offset: o.offset });
    }
    store.replaceWalls(floor.id, removeIds, rec.removed);
  });
  st.patch({ chainStart: rec.start, cursor: st.cursor, history: st.history.slice(0, -1), count: Math.max(0, st.count - 1), typedLength: '', typedAngle: '', field: 'length' });
  return true;
}

/** Letzte Klickpositionen: Doppelklick nur bei zwei Klicks an derselben Stelle (Konva prüft nur die Zeit). */
const clicks = createClickTracker();

/** Vorschau-Endpunkt aus Zustand (Tastatur hat Vorrang vor Cursor). */
function previewEnd(st: WallToolState): Vec2 | null {
  if (!st.chainStart) return null;
  const typedLen = parseTypedLength(st.typedLength);
  const typedAng = parseTypedAngle(st.typedAngle);
  const cursor = st.cursor ?? st.chainStart;
  if (typedLen == null && typedAng == null) return cursor;
  return computeSegmentEnd(st.chainStart, cursor, typedLen, typedAng, st.snapping);
}

function appendTyped(st: WallToolStore, key: string): boolean {
  if (st.field === 'length') {
    const cur = st.typedLength;
    if (cur.length >= MAX_TYPED) return true;
    const digit = /^[0-9.,]$/.test(key);
    const unit = (key === 'm' && cur.length > 0 && /[0-9c]$/.test(cur)) || (key === 'c' && /[0-9]$/.test(cur));
    if (!digit && !unit) return false;
    if (/[m]/.test(cur) && !unit) return true; // nach der Einheit nichts mehr anhängen
    st.patch({ typedLength: cur + key });
    return true;
  }
  const cur = st.typedAngle;
  if (cur.length >= MAX_TYPED) return true;
  if (!/^[0-9.,]$/.test(key) && !(key === '-' && cur.length === 0)) return false;
  st.patch({ typedAngle: cur + key });
  return true;
}

registerTool({
  id: 'wall',
  cursor: 'crosshair',
  hint: 'Klick: Punkt setzen · Enter/Doppelklick: fertig · Zahlen tippen: exakte Länge · Esc: abbrechen',
  onActivate: () => {
    useWallTool.getState().reset();
  },
  onCancel: () => {
    finishWallChain();
  },
  onPointerDown: (e, ctx) => {
    if (e.button !== 0) return;
    clicks.down(e.screen);
    const r = snapCursor(e, ctx);
    useSnapGuides.getState().set(r);
    const st = useWallTool.getState();
    const snapping = snappingEnabled(e, ctx);
    if (!st.chainStart) {
      st.patch({ chainStart: r.point, cursor: r.point, count: 0, history: [], typedLength: '', typedAngle: '', field: 'length', snapping });
      return;
    }
    const end = r.point;
    // Zweiter Klick eines Doppelklicks / Wackler (bildschirmbasiert, damit es bei jedem Zoom funktioniert): ignorieren
    if (distance(st.chainStart, end) < Math.max(MIN_SEGMENT_CM, ctx.pxToWorld(4))) return;
    const rec = commitSegment(ctx, st.chainStart, end);
    if (rec) {
      st.patch({ chainStart: end, cursor: end, count: st.count + 1, history: [...st.history, rec], typedLength: '', typedAngle: '', field: 'length', snapping });
    }
  },
  onPointerMove: (e, ctx) => {
    const r = snapCursor(e, ctx);
    const st = useWallTool.getState();
    const snapping = snappingEnabled(e, ctx);
    if (!st.cursor || st.cursor.x !== r.point.x || st.cursor.y !== r.point.y || st.snapping !== snapping) st.patch({ cursor: r.point, snapping });
    useSnapGuides.getState().set(r);
  },
  onDoubleClick: () => {
    // Zwei schnelle Klicks an verschiedenen Punkten sind zwei Segmente, kein Doppelklick (Konva prüft nur die Zeit).
    if (!clicks.isDoubleClick()) return;
    finishWallChain();
  },
  onKeyDown: (e, ctx) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const st = useWallTool.getState();
    if (e.key === 'Escape') {
      if (!st.chainStart) return false;
      finishWallChain();
      return true;
    }
    // Ohne aktive Kette: Ziffern gehören zur Längeneingabe des Werkzeugs (z. B. „3“ nicht als 3D-Ansicht werten).
    if (!st.chainStart) return /^[0-9]$/.test(e.key);
    switch (e.key) {
      case 'Enter': {
        const typedLen = parseTypedLength(st.typedLength);
        const typedAng = parseTypedAngle(st.typedAngle);
        if (typedLen == null && typedAng == null) {
          finishWallChain();
          return true;
        }
        const end = computeSegmentEnd(st.chainStart, st.cursor ?? st.chainStart, typedLen, typedAng, st.snapping);
        const rec = commitSegment(ctx, st.chainStart, end);
        if (rec) {
          st.patch({ chainStart: end, count: st.count + 1, history: [...st.history, rec], typedLength: '', typedAngle: '', field: 'length' });
        } else {
          ctx.ui.toast('Segment zu kurz – mindestens 2 cm.', 'warning');
        }
        return true;
      }
      case 'Tab':
        st.patch({ field: st.field === 'length' ? 'angle' : 'length' });
        return true;
      case 'Backspace':
        if (st.field === 'length' && st.typedLength) st.patch({ typedLength: st.typedLength.slice(0, -1) });
        else if (st.field === 'angle' && st.typedAngle) st.patch({ typedAngle: st.typedAngle.slice(0, -1) });
        else if (!st.typedLength && !st.typedAngle) undoLastSegment(ctx);
        return true;
      case 'Delete':
        // Während des Zeichnens nicht die Auswahl löschen.
        return true;
      default:
        break;
    }
    // Während der Kette alle einzelnen Zeichen verbrauchen: Ziffern/Einheiten füllen die Eingabe, Buchstaben-Kürzel
    // (G = einpassen, H/W/… = Werkzeugwechsel, 3 = 3D) würden Kette und Eingabe sonst verwerfen.
    if (e.key.length === 1) {
      appendTyped(st, e.key);
      return true;
    }
    return false;
  },
  Overlay: WallOverlay,
  HtmlOverlay: WallHtmlOverlay,
});

// Rechtsklick beendet die Kette: der Canvas reicht Rechtsklicks nicht an Werkzeuge weiter, sondern öffnet das
// Kontextmenü – während einer aktiven Kette wird es abgefangen und die Kette beendet.
useUiStore.subscribe((s, prev) => {
  if (s.tool === 'wall' && s.contextMenu && s.contextMenu !== prev.contextMenu && useWallTool.getState().chainStart) {
    finishWallChain();
    s.setContextMenu(null);
  }
});

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

export interface MeasureLabelProps {
  x: number;
  y: number;
  text: string;
  /** Bildschirm-Einheit in Welt-cm (1 / viewport.scale). */
  s: number;
  dark: boolean;
  /** Ankerpunkt relativ zur Box: 0 = links/oben, 0,5 = Mitte, 1 = rechts/unten. */
  anchorX?: number;
  anchorY?: number;
  fontSize?: number;
  accent?: boolean;
}

/** Beschriftung mit Hintergrund in Bildschirm-konstanter Größe (Konva Label). Breite wird geschätzt. */
export const MeasureLabel = memo(function MeasureLabel({ x, y, text, s, dark, anchorX = 0.5, anchorY = 0.5, fontSize = 12, accent = false }: MeasureLabelProps) {
  const lines = text.split('\n');
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const pad = 4 * s;
  const fs = fontSize * s;
  const w = longest * fs * 0.58 + pad * 2;
  const h = lines.length * fs * 1.15 + pad * 2;
  const bg = accent ? '#2563eb' : dark ? 'rgba(17,26,46,0.92)' : 'rgba(255,255,255,0.94)';
  const fg = accent ? '#ffffff' : dark ? '#e2e8f0' : '#0f172a';
  const border = accent ? 'transparent' : dark ? '#334155' : '#cbd5e1';
  return (
    <Label x={x} y={y} offsetX={w * anchorX} offsetY={h * anchorY} listening={false}>
      <Tag fill={bg} stroke={border} strokeWidth={1 * s} cornerRadius={3 * s} shadowColor="black" shadowBlur={4 * s} shadowOpacity={dark ? 0.4 : 0.12} />
      <Text text={text} fontSize={fs} lineHeight={1.15} padding={pad} fill={fg} fontFamily="Inter, system-ui, sans-serif" />
    </Label>
  );
});

/** Konva-Overlay: Vorschau des schwebenden Segments mit sauberen Anschlüssen, Länge & Winkel. */
function WallOverlay({ ctx }: { ctx: ToolContext }) {
  const st = useWallTool();
  const dark = useIsDark();
  const s = 1 / ctx.viewport.scale;
  const start = st.chainStart;
  const end = previewEnd(st);
  const props = useMemo(() => wallPropsFromOptions(ctx.ui.toolOptions), [ctx.ui.toolOptions]);
  const preview = useMemo<Wall | null>(() => (start && end ? { id: '__wall_preview', start, end, ...props } : null), [start, end, props]);
  const outline = useMemo(() => (preview && distance(preview.start, preview.end) >= MIN_SEGMENT_CM ? wallOutline(preview, ctx.walls) : null), [preview, ctx.walls]);
  if (!start || !end || !preview) return null;
  const len = distance(start, end);
  const accent = dark ? '#60a5fa' : '#2563eb';
  const soft = dark ? 'rgba(96,165,250,0.28)' : 'rgba(37,99,235,0.22)';
  const mid = wallMidpoint(preview);
  const n = wallNormal(preview);
  const off = preview.thickness / 2 + 10 * s;
  // Beschriftung auf der Seite, die (auf dem Bildschirm) oben liegt
  const sign = n.y <= 0 ? 1 : -1;
  const labelPos = { x: mid.x + n.x * off * sign, y: mid.y + n.y * off * sign };
  const angle = normalizeAngle(angleDeg(start, end));
  const typing = st.typedLength !== '' || st.typedAngle !== '';
  return (
    <Group listening={false}>
      {outline && <Line points={flatten(outline)} closed fill={soft} stroke={accent} strokeWidth={1.5 * s} />}
      <Line points={[start.x, start.y, end.x, end.y]} stroke={accent} strokeWidth={1 * s} dash={[6 * s, 4 * s]} />
      <Circle x={start.x} y={start.y} radius={4 * s} fill={accent} stroke={dark ? '#0f172a' : '#ffffff'} strokeWidth={1 * s} />
      {len >= 1 && <MeasureLabel x={labelPos.x} y={labelPos.y} text={`${formatLength(len)} · ${formatDegrees(angle)}`} s={s} dark={dark} accent={typing} />}
    </Group>
  );
}

function TypedField({ label, value, unit, active }: { label: string; value: string; unit: string; active: boolean }) {
  return (
    <span
      className={`flex items-baseline gap-1 rounded px-1.5 py-0.5 ${active ? 'ring-2 ring-blue-500/60' : ''}`}
      style={{ background: active ? 'color-mix(in srgb, var(--gp-accent) 12%, transparent)' : 'transparent' }}
    >
      <span className="gp-muted">{label}</span>
      <span className="font-mono font-semibold tabular-nums">
        {value || '–'}
        {active && <span className="animate-pulse">|</span>}
      </span>
      <span className="gp-muted">{unit}</span>
    </span>
  );
}

/** HTML-Overlay: Eingabefeld neben dem Cursor (Länge/Winkel) und Kettenstatus mit Schaltflächen (auch für Touch). */
function WallHtmlOverlay({ ctx }: { ctx: ToolContext }) {
  const st = useWallTool();
  if (!st.chainStart) return null;
  const anchor = st.cursor ?? st.chainStart;
  const screen = worldToScreen(anchor, ctx.viewport);
  const typing = st.typedLength !== '' || st.typedAngle !== '' || st.field === 'angle';
  const left = Math.min(Math.max(screen.x + 18, 8), Math.max(8, ctx.stageSize.width - 260));
  const top = Math.min(Math.max(screen.y + 18, 8), Math.max(8, ctx.stageSize.height - 48));
  return (
    <>
      {typing && (
        <div className="pointer-events-none absolute z-10 flex items-center gap-2 rounded-md border px-2 py-1 text-xs shadow-md gp-panel" style={{ left, top }}>
          <TypedField label="Länge" value={st.typedLength} unit={/m$/.test(st.typedLength) ? '' : 'cm'} active={st.field === 'length'} />
          <TypedField label="Winkel" value={st.typedAngle} unit="°" active={st.field === 'angle'} />
          <span className="gp-muted whitespace-nowrap">
            <kbd className="gp-kbd">↵</kbd> anlegen · <kbd className="gp-kbd">⇥</kbd> Feld
          </span>
        </div>
      )}
      <div className="absolute left-8 top-8 z-10 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs shadow-md gp-panel">
        <span className="whitespace-nowrap">
          Wandkette · <strong className="font-semibold">{st.count}</strong> {st.count === 1 ? 'Segment' : 'Segmente'}
        </span>
        <span className="gp-muted hidden sm:inline whitespace-nowrap">Zahlen tippen = exakte Länge (350 oder 3,5m) · Backspace = Segment zurück</span>
        <button type="button" className="gp-btn gp-btn-primary px-2 py-0.5" onClick={() => finishWallChain()} title="Kette beenden (Enter)">
          Fertig
        </button>
      </div>
    </>
  );
}
