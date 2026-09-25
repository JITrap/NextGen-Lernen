/**
 * Öffnungs-Werkzeuge 'door', 'window', 'mirror': Beim Bewegen über eine Wand (inkl. Hallen-Außenwände `hall_<i>`)
 * erscheint eine Vorschau an der projizierten Position (Offset auf das Raster entlang der Wand gefangen und auf die
 * Wandlänge begrenzt). Klick legt die Öffnung an; das Werkzeug bleibt aktiv.
 *
 * Regeln: keine Öffnung ragt über das Wandende hinaus, keine überlappt eine andere derselben Wand
 * (Vorschau rot, Klick verweigert + Toast). Tasten während der Vorschau: F = Anschlag (Tür), S = Aufschlag-/Wandseite.
 *
 * Reine Helfer (`placeOpeningOnWall`, `openingOverlaps`, `openingFitsWall`, `wallSideOf`, `openingSpecFromOptions`,
 * `createOpening`, `validatePlacement`) sind exportiert und getestet (openingTools.test.ts).
 */
import { memo } from 'react';
import { Group, Circle } from 'react-konva';
import type { DoorType, Opening, Vec2, Wall } from '@/types';
import type { ToolContext, ToolHandler } from './types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import { useSnapGuides } from '../overlays/SnapGuides';
import { transaction } from '@/store/projectStore';
import { newId } from '@/utils/id';
import { DOOR_TYPE_MAP, WINDOW_DEFAULT, MIRROR_DEFAULT } from '@/data/wallTypes';
import { nearestWall, clampOpeningOffset, wallLength, wallNormal, pointOnWall, openingPlacement } from '@/geometry/walls';
import { formatCm } from '@/geometry/units';
import { useIsDark } from '@/hooks/useTheme';
import { OpeningGlyph, openingPalette } from '../layers/OpeningsLayer';
import { OverlayLabel, type LabelAnchor } from './zoneTools';

export type OpeningKind = Opening['kind'];
export type WallSide = 'a' | 'b';
type ToolOptions = ToolContext['ui']['toolOptions'];

/** Fangabstand zur Wand in Bildschirm-Pixeln. */
export const WALL_PICK_PX = 20;

/* ------------------------------------------------------------------ */
/* Reine Helfer                                                        */
/* ------------------------------------------------------------------ */

/** Auf welcher Wandseite liegt p? 'a' = Richtung der Wandnormalen (links von start→end), 'b' = gegenüber. */
export function wallSideOf(wall: Pick<Wall, 'start' | 'end'>, p: Vec2): WallSide {
  const n = wallNormal(wall);
  return (p.x - wall.start.x) * n.x + (p.y - wall.start.y) * n.y >= 0 ? 'a' : 'b';
}

export interface OpeningPlacement {
  wall: Wall;
  /** Mittelpunkt der Öffnung ab Wandanfang (cm), gerastert und auf die Wand begrenzt. */
  offset: number;
  /** Cursorseite relativ zur Wand. */
  side: WallSide;
  /** Mittelpunkt der Öffnung in Weltkoordinaten. */
  point: Vec2;
  /** Abstand des Cursors zur Wandfläche (cm). */
  distance: number;
}

/**
 * Projiziert einen Weltpunkt auf die nächste (sichtbare) Wand innerhalb `threshold` (cm, gemessen ab Wandfläche).
 * Der Offset wird auf `grid` (cm, 0 = kein Raster) entlang der Wand gerundet und mit `clampOpeningOffset` auf die
 * Wandlänge begrenzt. null, wenn keine Wand in Reichweite ist.
 */
export function placeOpeningOnWall(world: Vec2, walls: Wall[], width: number, threshold: number, grid = 0): OpeningPlacement | null {
  let candidates = walls;
  for (const w of walls) {
    if (w.hidden || wallLength(w) < 1) {
      candidates = walls.filter((x) => !x.hidden && wallLength(x) >= 1);
      break;
    }
  }
  const near = nearestWall(candidates, world, threshold);
  if (!near) return null;
  let offset = near.offset;
  if (grid > 0) offset = Math.round(offset / grid) * grid;
  offset = clampOpeningOffset(offset, width, near.wall);
  return { wall: near.wall, offset, side: wallSideOf(near.wall, world), point: pointOnWall(near.wall, offset), distance: near.distance };
}

/** Passt eine Öffnung (Mittelpunkt `offset`, Breite `width`) vollständig in die Wand? */
export function openingFitsWall(offset: number, width: number, wall: Pick<Wall, 'start' | 'end'>, eps = 1e-6): boolean {
  const len = wallLength(wall);
  return width > 0 && width <= len + eps && offset - width / 2 >= -eps && offset + width / 2 <= len + eps;
}

/** Erste Öffnung derselben Wand, die sich mit dem Kandidaten überschneidet (Berührung zählt nicht), sonst null. */
export function openingOverlaps(candidate: { wallId: string; offset: number; width: number; id?: string }, others: Opening[], eps = 1e-6): Opening | null {
  for (const o of others) {
    if (o.wallId !== candidate.wallId || (candidate.id !== undefined && o.id === candidate.id)) continue;
    if (Math.abs(o.offset - candidate.offset) < (o.width + candidate.width) / 2 - eps) return o;
  }
  return null;
}

export interface OpeningSpec {
  kind: OpeningKind;
  width: number;
  height: number;
  doorType?: DoorType;
  sillHeight?: number;
  /** Anzeigename (Türtyp, „Fenster“, „Spiegel“). */
  label: string;
}

function positive(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}
function nonNegative(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

/**
 * Maße/Typ aus den Werkzeug-Optionen der Werkzeugleiste (Schlüssel doorType, doorWidth, windowWidth, windowHeight,
 * windowSillHeight, mirrorLength, mirrorHeight) mit Standardwerten aus src/data/wallTypes.ts.
 */
export function openingSpecFromOptions(kind: OpeningKind, opts: ToolOptions): OpeningSpec {
  switch (kind) {
    case 'door': {
      const t = opts.doorType;
      const doorType: DoorType = typeof t === 'string' && t in DOOR_TYPE_MAP ? (t as DoorType) : 'einflügelig';
      const info = DOOR_TYPE_MAP[doorType];
      return { kind, doorType, width: positive(opts.doorWidth, info.defaultWidth), height: info.defaultHeight, label: `Tür (${doorType})` };
    }
    case 'window':
      return {
        kind,
        width: positive(opts.windowWidth, WINDOW_DEFAULT.width),
        height: positive(opts.windowHeight, WINDOW_DEFAULT.height),
        sillHeight: nonNegative(opts.windowSillHeight, WINDOW_DEFAULT.sillHeight),
        label: 'Fenster',
      };
    default:
      return { kind: 'mirror', width: positive(opts.mirrorLength, MIRROR_DEFAULT.width), height: positive(opts.mirrorHeight, MIRROR_DEFAULT.height), label: 'Spiegel' };
  }
}

/** Baut die Öffnung aus Spezifikation und Platzierung. `side` = Aufschlagseite (Tür) bzw. Wandseite (Spiegel). */
export function createOpening(spec: OpeningSpec, id: string, wallId: string, offset: number, side: WallSide, hinge: 'left' | 'right'): Opening {
  switch (spec.kind) {
    case 'door':
      return { id, kind: 'door', wallId, offset, width: spec.width, doorType: spec.doorType ?? 'einflügelig', height: spec.height, hinge, swingSide: side };
    case 'window':
      return { id, kind: 'window', wallId, offset, width: spec.width, height: spec.height, sillHeight: spec.sillHeight ?? WINDOW_DEFAULT.sillHeight };
    default:
      return { id, kind: 'mirror', wallId, offset, width: spec.width, height: spec.height, side };
  }
}

export type PlacementCheck = { ok: true } | { ok: false; reason: string };

/** Prüft Wandlänge und Überlappung mit vorhandenen Öffnungen derselben Wand. */
export function validatePlacement(pl: Pick<OpeningPlacement, 'wall' | 'offset'>, width: number, openings: Opening[]): PlacementCheck {
  if (!openingFitsWall(pl.offset, width, pl.wall)) {
    return { ok: false, reason: `Wand zu kurz (${formatCm(wallLength(pl.wall))}) für eine Öffnung von ${formatCm(width)}` };
  }
  const hit = openingOverlaps({ wallId: pl.wall.id, offset: pl.offset, width }, openings);
  if (hit) {
    const what = hit.kind === 'door' ? 'einer Tür' : hit.kind === 'window' ? 'einem Fenster' : 'einem Spiegel';
    return { ok: false, reason: `Überlappt mit ${what} (${formatCm(hit.width)}) auf dieser Wand` };
  }
  return { ok: true };
}

export function oppositeSide(side: WallSide): WallSide {
  return side === 'a' ? 'b' : 'a';
}

/* ------------------------------------------------------------------ */
/* Werkzeug-Zustand                                                    */
/* ------------------------------------------------------------------ */

export interface OpeningPreview {
  placement: OpeningPlacement;
  valid: boolean;
  reason?: string;
}

export interface OpeningToolState {
  preview: OpeningPreview | null;
  /** Anschlag (Tür) – bleibt zwischen Platzierungen erhalten, F wechselt. */
  hinge: 'left' | 'right';
  /** S gedrückt: Aufschlag-/Wandseite entgegen der Cursorseite. Wird beim Seitenwechsel des Cursors zurückgesetzt. */
  flip: boolean;
  lastSide: WallSide | null;
}

export const useOpeningTool = createToolStore<OpeningToolState>({ preview: null, hinge: 'left', flip: false, lastSide: null });

function effectiveSide(cursorSide: WallSide, flip: boolean): WallSide {
  return flip ? oppositeSide(cursorSide) : cursorSide;
}

function gridFor(ctx: ToolContext): number {
  return ctx.project.settings.snapEnabled && !ctx.ui.snapOverride ? ctx.project.settings.gridSize : 0;
}

function computePlacement(kind: OpeningKind, world: Vec2, ctx: ToolContext): { spec: OpeningSpec; placement: OpeningPlacement | null } {
  const spec = openingSpecFromOptions(kind, ctx.ui.toolOptions);
  return { spec, placement: placeOpeningOnWall(world, ctx.walls, spec.width, ctx.pxToWorld(WALL_PICK_PX), gridFor(ctx)) };
}

function clearPreview() {
  const st = useOpeningTool.getState();
  if (st.preview || st.flip || st.lastSide) st.patch({ preview: null, flip: false, lastSide: null });
  useSnapGuides.getState().set(null);
}

/* ------------------------------------------------------------------ */
/* Vorschau                                                            */
/* ------------------------------------------------------------------ */

function anchorForNormal(n: Vec2): LabelAnchor {
  if (Math.abs(n.y) >= Math.abs(n.x)) return n.y < 0 ? 'above' : 'below';
  return n.x < 0 ? 'leftOf' : 'rightOf';
}

function makePreviewOverlay(kind: OpeningKind) {
  return memo(function OpeningPreviewOverlay({ ctx }: { ctx: ToolContext }) {
    const preview = useOpeningTool((s) => s.preview);
    const hinge = useOpeningTool((s) => s.hinge);
    const flip = useOpeningTool((s) => s.flip);
    const dark = useIsDark();
    if (!preview) return null;
    const { wall, offset, side } = preview.placement;
    const spec = openingSpecFromOptions(kind, ctx.ui.toolOptions);
    const opening = createOpening(spec, '__preview', wall.id, offset, effectiveSide(side, flip), hinge);
    const pal = openingPalette(dark);
    const scale = ctx.viewport.scale;
    const s = 1 / scale;
    const pl = openingPlacement(opening, wall);
    const color = preview.valid ? pal.accent : pal.danger;
    const half = wall.thickness / 2;
    // Beschriftungsseite: Tür → gegenüber der Aufschlagseite, Spiegel → gegenüber der Spiegelseite, Fenster → Cursorseite
    const labelSign = opening.kind === 'door' ? (opening.swingSide === 'a' ? -1 : 1) : opening.kind === 'mirror' ? (opening.side === 'a' ? -1 : 1) : side === 'a' ? 1 : -1;
    const ln = { x: pl.normal.x * labelSign, y: pl.normal.y * labelSign };
    const labelDist = half + 14 * s;
    const len = wallLength(wall);
    const left = offset - spec.width / 2;
    const right = len - offset - spec.width / 2;
    const showEnds = preview.valid && spec.width * scale >= 24;
    const endDist = half + 6 * s;
    const mainText = preview.valid ? `${spec.label} · ${formatCm(spec.width)}` : `${spec.label} · ${formatCm(spec.width)}\n${preview.reason ?? 'Platzierung nicht möglich'}`;
    return (
      <Group listening={false}>
        <OpeningGlyph opening={opening} wall={wall} scale={scale} dark={dark} stroke={color} showLabel={false} />
        <Circle x={pl.center.x} y={pl.center.y} radius={3 * s} fill={color} />
        <OverlayLabel
          x={pl.center.x + ln.x * labelDist}
          y={pl.center.y + ln.y * labelDist}
          text={mainText}
          anchor={anchorForNormal(ln)}
          tone={preview.valid ? 'accent' : 'danger'}
          scale={scale}
          dark={dark}
        />
        {showEnds && left > 0.5 && (
          <OverlayLabel x={pl.a.x + ln.x * endDist} y={pl.a.y + ln.y * endDist} text={formatCm(left)} anchor={anchorForNormal(ln)} fontPx={10} scale={scale} dark={dark} />
        )}
        {showEnds && right > 0.5 && (
          <OverlayLabel x={pl.b.x + ln.x * endDist} y={pl.b.y + ln.y * endDist} text={formatCm(right)} anchor={anchorForNormal(ln)} fontPx={10} scale={scale} dark={dark} />
        )}
      </Group>
    );
  });
}

/* ------------------------------------------------------------------ */
/* Werkzeuge                                                           */
/* ------------------------------------------------------------------ */

const HINTS: Record<OpeningKind, string> = {
  door: 'Auf eine Wand klicken · F: Anschlag links/rechts · S: Aufschlagseite wechseln · Esc: beenden',
  window: 'Auf eine Wand klicken – Fenster sitzen immer in einer Wand · Esc: beenden',
  mirror: 'Auf eine Wand klicken · S: Wandseite wechseln · Esc: beenden',
};

function makeOpeningTool(kind: OpeningKind): ToolHandler {
  const Overlay = makePreviewOverlay(kind);
  return {
    id: kind,
    hint: HINTS[kind],
    Overlay,
    cursor: () => {
      const p = useOpeningTool.getState().preview;
      return p ? (p.valid ? 'crosshair' : 'not-allowed') : 'not-allowed';
    },
    onPointerMove: (e, ctx) => {
      const { spec, placement } = computePlacement(kind, e.world, ctx);
      if (!placement) {
        clearPreview();
        return;
      }
      const st = useOpeningTool.getState();
      const flip = st.lastSide !== null && st.lastSide !== placement.side ? false : st.flip;
      const check = validatePlacement(placement, spec.width, ctx.floor.openings);
      st.patch({ preview: { placement, valid: check.ok, reason: check.ok ? undefined : check.reason }, flip, lastSide: placement.side });
      useSnapGuides.getState().set(null);
    },
    onPointerDown: (e, ctx) => {
      if (e.button !== 0) return;
      const { spec, placement } = computePlacement(kind, e.world, ctx);
      if (!placement) return;
      const check = validatePlacement(placement, spec.width, ctx.floor.openings);
      const st = useOpeningTool.getState();
      const flip = st.lastSide !== null && st.lastSide !== placement.side ? false : st.flip;
      st.patch({ preview: { placement, valid: check.ok, reason: check.ok ? undefined : check.reason }, flip, lastSide: placement.side });
      if (!check.ok) {
        ctx.ui.toast(check.reason, 'warning');
        return;
      }
      const opening = createOpening(spec, newId('o_'), placement.wall.id, placement.offset, effectiveSide(placement.side, flip), st.hinge);
      transaction(() => ctx.store.addOpening(ctx.floor.id, opening));
      ctx.ui.setSelection([{ kind: 'opening', id: opening.id }]);
      if (!ctx.project.layers.openings) ctx.ui.toast('Ebene „Öffnungen“ ist ausgeblendet – die Öffnung ist nicht sichtbar', 'info');
      // Vorschau sofort gegen die neue Öffnung prüfen (gleiche Stelle ist jetzt belegt).
      const again = validatePlacement(placement, spec.width, [...ctx.floor.openings, opening]);
      st.patch({ preview: { placement, valid: again.ok, reason: again.ok ? undefined : again.reason } });
    },
    onKeyDown: (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const st = useOpeningTool.getState();
      if (!st.preview) return false;
      const k = e.key.toLowerCase();
      if (kind === 'door' && k === 'f') {
        st.patch({ hinge: st.hinge === 'left' ? 'right' : 'left' });
        return true;
      }
      if (kind !== 'window' && k === 's') {
        st.patch({ flip: !st.flip });
        return true;
      }
      return false;
    },
    onCancel: () => clearPreview(),
    onActivate: () => clearPreview(),
  };
}

registerTool(makeOpeningTool('door'));
registerTool(makeOpeningTool('window'));
registerTool(makeOpeningTool('mirror'));
