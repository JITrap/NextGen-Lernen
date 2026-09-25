/**
 * Platzier-Werkzeuge für Bauelemente: 'stairs' (Treppe), 'elevator' (Aufzug), 'column' (Säule).
 *
 * Bedienung: Vorschau folgt dem Cursor (mit Snapping an Raster/Wänden/Objekten/Halle), Klick bzw. Tipp
 * platziert das Objekt, R dreht die Vorschau um 90° (Shift+R gegen den Uhrzeigersinn), Esc bricht ab.
 * Optionen kommen aus ui.toolOptions (Werkzeugleiste): stairsType ('gerade'|'L'|'U'|'Wendeltreppe'),
 * columnShape ('rund'|'eckig').
 *
 * Definitionen: bevorzugt die generischen Bauelemente aus src/data/equipment/generic.json
 * (IDs gen-bauelemente-treppe-<slug>, gen-bauelemente-aufzug, gen-bauelemente-saeule-<form>, sonst nach Symbol);
 * fehlen sie, wird eine Definition mit den Standardmaßen der Spezifikation erzeugt und beim Platzieren als
 * benutzerdefinierte Def im Projekt abgelegt (store.addCustomEquipment, im selben Undo-Schritt), damit getDef sie findet.
 *
 * Treppen/Aufzüge erhalten linkedFloorIds = [aktuelles Stockwerk, darüberliegendes (falls vorhanden)].
 * Nach dem Platzieren: Werkzeug 'select', Auswahl = neues Objekt, Eigenschaften-Panel.
 */
import { useMemo } from 'react';
import { Group, Text } from 'react-konva';
import type { EquipmentDef, Floor, PlacedItem, Project, StairsType, SymbolKind, Vec2 } from '@/types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import type { ToolContext, ToolEvent, ToolHandler } from './types';
import { GENERIC_LIBRARY } from '@/data/equipment';
import { createItemFromDef } from '@/store/factories';
import { useProjectStore, transaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { useIsDark } from '@/hooks/useTheme';
import { snapItemPosition } from '@/geometry/snap';
import { bbox } from '@/geometry/polygon';
import { rectCorners } from '@/geometry/transform';
import { formatDims, normalizeAngle } from '@/geometry/units';
import { useSnapGuides } from '../overlays/SnapGuides';
import { ItemSymbol, defaultStepCount, statePalette } from '../symbols';

/* ------------------------------------------------------------------ */
/* Optionen & Standardmaße                                             */
/* ------------------------------------------------------------------ */

export type PlaceKind = 'stairs' | 'elevator' | 'column';
export type ColumnShape = 'rund' | 'eckig';

export interface PlaceOptions {
  stairsType: StairsType;
  columnShape: ColumnShape;
}

export const STAIRS_TYPES: readonly StairsType[] = ['gerade', 'L', 'U', 'Wendeltreppe'];

/** Standardmaße laut Spezifikation (cm). */
export const PLACE_DIMENSIONS = {
  stairs: {
    gerade: { w: 100, d: 360 },
    L: { w: 240, d: 240 },
    U: { w: 240, d: 300 },
    Wendeltreppe: { w: 200, d: 200 },
  } as Record<StairsType, { w: number; d: number }>,
  elevator: { w: 180, d: 200 },
  column: { w: 30, d: 30 },
} as const;

const STAIRS_SYMBOL: Record<StairsType, SymbolKind> = { gerade: 'stairs-straight', L: 'stairs-l', U: 'stairs-u', Wendeltreppe: 'stairs-spiral' };
const STAIRS_NAME: Record<StairsType, string> = { gerade: 'Treppe gerade', L: 'L-Treppe', U: 'U-Treppe', Wendeltreppe: 'Wendeltreppe' };
const STAIRS_SLUG: Record<StairsType, string> = { gerade: 'gerade', L: 'l', U: 'u', Wendeltreppe: 'wendeltreppe' };

/** Liest die Werkzeug-Optionen robust (unbekannte Werte → Standard). */
export function readPlaceOptions(options: Record<string, string | number | boolean> | undefined): PlaceOptions {
  const st = options?.stairsType;
  const cs = options?.columnShape;
  const stairsType = STAIRS_TYPES.find((t) => t === st) ?? 'gerade';
  const columnShape: ColumnShape = cs === 'rund' ? 'rund' : 'eckig';
  return { stairsType, columnShape };
}

/** Slug einer Treppenart in generischen IDs (gen-bauelemente-treppe-<slug>). */
export function stairsSlug(t: StairsType): string {
  return STAIRS_SLUG[t];
}

/** Gewünschtes Symbol für Art + Optionen. */
export function wantedSymbol(kind: PlaceKind, opts: PlaceOptions): SymbolKind {
  if (kind === 'stairs') return STAIRS_SYMBOL[opts.stairsType];
  if (kind === 'elevator') return 'elevator';
  return opts.columnShape === 'rund' ? 'column-round' : 'column-square';
}

/** ID der Fallback-Definition (benutzerdefiniert im Projekt). */
export function fallbackDefId(kind: PlaceKind, opts: PlaceOptions): string {
  if (kind === 'stairs') return `custom-bauelemente-treppe-${stairsSlug(opts.stairsType)}`;
  if (kind === 'elevator') return 'custom-bauelemente-aufzug';
  return `custom-bauelemente-saeule-${opts.columnShape}`;
}

/** Fallback-Definition mit Standardmaßen (wird beim Platzieren als benutzerdefinierte Def gespeichert). */
export function makeFallbackDef(kind: PlaceKind, opts: PlaceOptions): EquipmentDef {
  const zone = { vorne: 0, hinten: 0, links: 0, rechts: 0 };
  const base = {
    kategorie: 'Bauelemente',
    hersteller: 'Generisch',
    hoehe_cm: null,
    gewicht_kg: null,
    hinweis: 'Standardmaß – Breite und Tiefe frei anpassbar.',
    sicherheitszone_cm: zone,
    skalierbar: true,
    verifiziert: false,
    bereich: 'Bauelemente' as const,
    benutzerdefiniert: true,
  };
  if (kind === 'stairs') {
    const t = opts.stairsType;
    const dims = PLACE_DIMENSIONS.stairs[t];
    return {
      ...base,
      id: fallbackDefId(kind, opts),
      unterkategorie: 'Treppe',
      name: STAIRS_NAME[t],
      breite_cm: dims.w,
      tiefe_cm: dims.d,
      form: t === 'Wendeltreppe' ? 'kreis' : 'rechteck',
      symbol: STAIRS_SYMBOL[t],
      params: { kind: 'stairs', typ: t, stufen: defaultStepCount(t, dims.w, dims.d) },
      tags: ['Treppe', t, 'Bauelement'],
    };
  }
  if (kind === 'elevator') {
    const dims = PLACE_DIMENSIONS.elevator;
    return {
      ...base,
      id: fallbackDefId(kind, opts),
      unterkategorie: 'Aufzug',
      name: 'Aufzug',
      breite_cm: dims.w,
      tiefe_cm: dims.d,
      form: 'rechteck',
      symbol: 'elevator',
      params: { kind: 'elevator' },
      tags: ['Aufzug', 'Lift', 'Bauelement'],
    };
  }
  const dims = PLACE_DIMENSIONS.column;
  const rund = opts.columnShape === 'rund';
  return {
    ...base,
    id: fallbackDefId(kind, opts),
    unterkategorie: 'Säule',
    name: rund ? 'Säule rund' : 'Säule eckig',
    breite_cm: dims.w,
    tiefe_cm: dims.d,
    form: rund ? 'kreis' : 'rechteck',
    symbol: rund ? 'column-round' : 'column-square',
    params: { kind: 'column', form: opts.columnShape },
    tags: ['Säule', 'Stütze', 'Bauelement'],
  };
}

/* ------------------------------------------------------------------ */
/* Definition auflösen                                                 */
/* ------------------------------------------------------------------ */

const GENERIC_MAP = new Map(GENERIC_LIBRARY.map((d) => [d.id, d]));
const genericCache = new Map<string, EquipmentDef | null>();

function preferredIds(kind: PlaceKind, opts: PlaceOptions): string[] {
  if (kind === 'stairs') {
    const t = opts.stairsType;
    const slug = stairsSlug(t);
    const ids = [
      t === 'Wendeltreppe' ? 'gen-bau-wendeltreppe' : `gen-bau-treppe-${slug}`,
      `gen-bauelemente-treppe-${slug}`, `gen-bauelemente-treppe-${t.toLowerCase()}`,
    ];
    if (t === 'Wendeltreppe') ids.push('gen-bauelemente-treppe-wendel', 'gen-bauelemente-wendeltreppe', 'gen-bauelemente-treppe-spirale');
    if (t === 'L') ids.push('gen-bauelemente-treppe-l-treppe', 'gen-bauelemente-l-treppe');
    if (t === 'U') ids.push('gen-bauelemente-treppe-u-treppe', 'gen-bauelemente-u-treppe');
    return ids;
  }
  if (kind === 'elevator') return ['gen-bau-aufzug', 'gen-bauelemente-aufzug', 'gen-bauelemente-lift', 'gen-bauelemente-fahrstuhl'];
  const s = opts.columnShape;
  return [`gen-bau-saeule-${s}`, `gen-bauelemente-saeule-${s}`, `gen-bauelemente-stuetze-${s}`, `gen-bauelemente-saeule-${s === 'rund' ? 'rund' : 'quadratisch'}`];
}

function matchesColumnShape(d: EquipmentDef, shape: ColumnShape): boolean {
  const form = String(d.params?.form ?? '').toLowerCase();
  if (form === 'rund' || form === 'eckig') return form === shape;
  if (typeof d.params?.rund === 'boolean') return d.params.rund === (shape === 'rund');
  return shape === 'rund' ? d.symbol === 'column-round' || d.form === 'kreis' : d.symbol === 'column-square';
}

/** Passende generische Definition aus generic.json (null, wenn keine vorhanden). */
export function findGenericPlaceDef(kind: PlaceKind, opts: PlaceOptions): EquipmentDef | null {
  const key = `${kind}:${kind === 'stairs' ? opts.stairsType : kind === 'column' ? opts.columnShape : '-'}`;
  const cached = genericCache.get(key);
  if (cached !== undefined) return cached;
  let found: EquipmentDef | undefined;
  for (const id of preferredIds(kind, opts)) {
    found = GENERIC_MAP.get(id);
    if (found) break;
  }
  if (!found) {
    const sym = wantedSymbol(kind, opts);
    const building = GENERIC_LIBRARY.filter((d) => d.bereich === 'Bauelemente' && !d.ohne_stellflaeche);
    if (kind === 'stairs') {
      const want = opts.stairsType.toLowerCase();
      found = building.find((d) => d.symbol === sym) ?? building.find((d) => d.symbol.startsWith('stairs-') && String(d.params?.typ ?? '').toLowerCase() === want);
    } else if (kind === 'column') {
      found = building.find((d) => d.symbol === sym) ?? building.find((d) => (d.symbol === 'column-round' || d.symbol === 'column-square' || d.params?.kind === 'column') && matchesColumnShape(d, opts.columnShape));
    } else {
      found = building.find((d) => d.symbol === sym);
    }
  }
  const result = found ?? null;
  genericCache.set(key, result);
  return result;
}

export interface ResolvedPlaceDef {
  def: EquipmentDef;
  /** generic = aus generic.json; custom = bereits im Projekt gespeicherte Fallback-Def; fallback = neu erzeugt (noch nicht gespeichert). */
  source: 'generic' | 'custom' | 'fallback';
}

/** Definition für Art + Optionen: generic.json → benutzerdefinierte Fallback-Def im Projekt → neue Fallback-Def. */
export function resolvePlaceDef(kind: PlaceKind, options: Record<string, string | number | boolean> | undefined, project: Pick<Project, 'customEquipment'>): ResolvedPlaceDef {
  const opts = readPlaceOptions(options);
  const generic = findGenericPlaceDef(kind, opts);
  if (generic) return { def: generic, source: 'generic' };
  const id = fallbackDefId(kind, opts);
  const custom = project.customEquipment.find((d) => d.id === id);
  if (custom) return { def: custom, source: 'custom' };
  return { def: makeFallbackDef(kind, opts), source: 'fallback' };
}

/* ------------------------------------------------------------------ */
/* Objekt erzeugen                                                     */
/* ------------------------------------------------------------------ */

/** Nächsthöheres Stockwerk (nach order), null wenn keines. */
export function floorAbove(floors: readonly Floor[], floor: Pick<Floor, 'id' | 'order'>): Floor | null {
  let best: Floor | null = null;
  for (const f of floors) {
    if (f.id === floor.id || f.order <= floor.order) continue;
    if (!best || f.order < best.order) best = f;
  }
  return best;
}

/** Objekt-Parameter (typ/stufen bzw. form) aus Definition und Optionen. */
export function placeParams(kind: PlaceKind, def: EquipmentDef, opts: PlaceOptions): Record<string, number | string | boolean> {
  const params: Record<string, number | string | boolean> = { ...(def.params ?? {}) };
  if (kind === 'stairs') {
    params.typ = opts.stairsType;
    const raw = Number(params.stufen);
    if (!Number.isFinite(raw) || raw < 2) params.stufen = defaultStepCount(opts.stairsType, def.breite_cm, def.tiefe_cm);
  } else if (kind === 'column') {
    params.form = opts.columnShape;
  }
  return params;
}

/** Erzeugt das platzierte Objekt (noch nicht im Store). */
export function buildPlacedItem(kind: PlaceKind, def: EquipmentDef, pos: Vec2, rotation: number, floor: Pick<Floor, 'id' | 'order'>, floors: readonly Floor[], opts: PlaceOptions): PlacedItem {
  const above = kind === 'column' ? null : floorAbove(floors, floor);
  const linkedFloorIds = kind === 'column' ? undefined : above ? [floor.id, above.id] : [floor.id];
  return createItemFromDef(def, pos.x, pos.y, {
    kind,
    rotation: normalizeAngle(rotation),
    linkedFloorIds,
    params: placeParams(kind, def, opts),
  });
}

/** Objekt für die Vorschau (Ursprung 0/0, Rotation macht die Overlay-Group). */
export function previewItem(kind: PlaceKind, def: EquipmentDef, opts: PlaceOptions): PlacedItem {
  return {
    id: '__place-preview',
    kind,
    defId: def.id,
    x: 0,
    y: 0,
    rotation: 0,
    width: def.breite_cm,
    depth: def.tiefe_cm,
    height: def.hoehe_cm,
    safetyZone: { ...def.sicherheitszone_cm },
    safetyZoneEnabled: false,
    params: placeParams(kind, def, opts),
  };
}

/* ------------------------------------------------------------------ */
/* Werkzeug-Zustand                                                    */
/* ------------------------------------------------------------------ */

interface PlaceState {
  /** Gesnappte Vorschau-Position (Weltkoordinaten). */
  pos: Vec2 | null;
  /** Vorschau-Drehung in Grad. */
  rotation: number;
  /** Bildschirmposition des Pointer-Down (zum Unterscheiden von Klick und Ziehen). */
  down: Vec2 | null;
}

export const usePlaceState = createToolStore<PlaceState>({ pos: null, rotation: 0, down: null });

/** Maximale Bewegung (px) zwischen Pointer-Down und -Up, damit es als Klick/Tipp gilt. */
const CLICK_TOLERANCE_PX = 8;

function snapPreview(e: ToolEvent, ctx: ToolContext, def: EquipmentDef, rotation: number): Vec2 {
  const settings = ctx.project.settings;
  const res = snapItemPosition(
    { id: '__place-preview', x: e.world.x, y: e.world.y, width: def.breite_cm, depth: def.tiefe_cm, rotation },
    e.world,
    {
      gridSize: settings.gridSize,
      enabled: settings.snapEnabled && !useUiStore.getState().snapOverride && !e.alt,
      threshold: ctx.pxToWorld(8),
      walls: ctx.walls,
      items: ctx.items,
      hall: ctx.floor.hall,
    },
  );
  useSnapGuides.getState().set(res);
  return res.point;
}

function updatePreview(e: ToolEvent, ctx: ToolContext, kind: PlaceKind): Vec2 {
  const { def } = resolvePlaceDef(kind, useUiStore.getState().toolOptions, ctx.project);
  const pos = snapPreview(e, ctx, def, usePlaceState.getState().rotation);
  usePlaceState.getState().patch({ pos });
  return pos;
}

/** Platziert das Objekt an `pos` (ein Undo-Schritt inkl. eventueller Fallback-Definition). */
export function placeAt(kind: PlaceKind, pos: Vec2, ctx: ToolContext): PlacedItem | null {
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
  const store = useProjectStore.getState();
  const project = store.project;
  const floor = project.floors.find((f) => f.id === ctx.floor.id) ?? project.floors.find((f) => f.id === project.activeFloorId) ?? project.floors[0];
  if (!floor) return null;
  const options = useUiStore.getState().toolOptions;
  const opts = readPlaceOptions(options);
  const { def, source } = resolvePlaceDef(kind, options, project);
  const item = buildPlacedItem(kind, def, pos, usePlaceState.getState().rotation, floor, project.floors, opts);
  transaction(() => {
    if (source === 'fallback') store.addCustomEquipment(def);
    store.addItem(floor.id, item);
  });
  const ui = useUiStore.getState();
  ui.setSelection([{ kind: 'item', id: item.id }]);
  ui.setTool('select');
  ui.setRightPanel('properties');
  if (kind !== 'column') {
    const above = floorAbove(project.floors, floor);
    ui.toast(above ? `${def.name} platziert – verbunden mit „${above.name}“` : `${def.name} platziert – kein Stockwerk darüber (Verbindung im Eigenschaften-Panel)`, 'success');
  }
  useSnapGuides.getState().set(null);
  usePlaceState.getState().reset();
  return item;
}

/* ------------------------------------------------------------------ */
/* Overlay (Vorschau unter dem Cursor)                                 */
/* ------------------------------------------------------------------ */

function PlaceOverlay({ ctx, kind }: { ctx: ToolContext; kind: PlaceKind }) {
  const pos = usePlaceState((s) => s.pos);
  const rotation = usePlaceState((s) => s.rotation);
  const options = useUiStore((s) => s.toolOptions);
  const dark = useIsDark();
  const custom = ctx.project.customEquipment;
  const opts = readPlaceOptions(options);
  const def = useMemo(() => resolvePlaceDef(kind, options, { customEquipment: custom }).def, [kind, options, custom]);
  const item = useMemo(() => previewItem(kind, def, opts), [kind, def, opts.stairsType, opts.columnShape]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = ctx.viewport.scale;
  if (!pos) return null;
  const px = 1 / scale;
  const pal = statePalette(dark);
  const box = bbox(rectCorners(0, 0, def.breite_cm, def.tiefe_cm, rotation));
  const above = kind === 'column' ? null : floorAbove(ctx.project.floors, ctx.floor);
  const link = kind === 'column' ? '' : above ? ` · verbunden mit ${above.name}` : ' · kein Stockwerk darüber';
  const info = `${def.name} · ${formatDims(def.breite_cm, def.tiefe_cm, null)}${link}`;
  return (
    <Group x={pos.x} y={pos.y} opacity={0.85} listening={false}>
      <Group rotation={rotation} listening={false}>
        <ItemSymbol item={item} def={def} scale={scale} dark={dark} selected hovered={false} colliding={false} />
      </Group>
      <Text
        x={-220 * px}
        y={box.maxY + 6 * px}
        width={440 * px}
        text={info}
        fontSize={11 * px}
        fontStyle="600"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fill={pal.text}
        align="center"
        wrap="none"
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

const StairsOverlay = ({ ctx }: { ctx: ToolContext }) => <PlaceOverlay ctx={ctx} kind="stairs" />;
const ElevatorOverlay = ({ ctx }: { ctx: ToolContext }) => <PlaceOverlay ctx={ctx} kind="elevator" />;
const ColumnOverlay = ({ ctx }: { ctx: ToolContext }) => <PlaceOverlay ctx={ctx} kind="column" />;

/* ------------------------------------------------------------------ */
/* Werkzeuge                                                           */
/* ------------------------------------------------------------------ */

const HINTS: Record<PlaceKind, string> = {
  stairs: 'Klicken: Treppe platzieren · R: drehen · Esc: abbrechen · Treppentyp in der Werkzeugleiste',
  elevator: 'Klicken: Aufzug platzieren · R: drehen · Esc: abbrechen',
  column: 'Klicken: Säule platzieren · R: drehen · Esc: abbrechen · Form (rund/eckig) in der Werkzeugleiste',
};

const OVERLAYS: Record<PlaceKind, ToolHandler['Overlay']> = { stairs: StairsOverlay, elevator: ElevatorOverlay, column: ColumnOverlay };

export function makePlaceTool(kind: PlaceKind): ToolHandler {
  return {
    id: kind,
    hint: HINTS[kind],
    cursor: 'crosshair',
    Overlay: OVERLAYS[kind],
    onActivate: () => {
      usePlaceState.getState().reset();
    },
    onCancel: () => {
      usePlaceState.getState().reset();
      useSnapGuides.getState().set(null);
    },
    onPointerMove: (e, ctx) => {
      updatePreview(e, ctx, kind);
    },
    onPointerDown: (e, ctx) => {
      if (e.button !== 0) return;
      updatePreview(e, ctx, kind);
      usePlaceState.getState().patch({ down: { x: e.screen.x, y: e.screen.y } });
    },
    onPointerUp: (e, ctx) => {
      const st = usePlaceState.getState();
      if (!st.down) return;
      const moved = Math.hypot(e.screen.x - st.down.x, e.screen.y - st.down.y);
      st.patch({ down: null });
      if (moved > CLICK_TOLERANCE_PX) return;
      const pos = st.pos ?? updatePreview(e, ctx, kind);
      placeAt(kind, pos, ctx);
    },
    onKeyDown: (e, ctx) => {
      if (e.key === 'Escape') {
        usePlaceState.getState().reset();
        useSnapGuides.getState().set(null);
        ctx.ui.setTool('select');
        return true;
      }
      if (e.key === 'r' || e.key === 'R') {
        if (e.ctrlKey || e.metaKey || e.altKey) return false;
        const st = usePlaceState.getState();
        st.patch({ rotation: normalizeAngle(st.rotation + (e.shiftKey ? -90 : 90)) });
        return true;
      }
      return false;
    },
  };
}

registerTool(makePlaceTool('stairs'));
registerTool(makePlaceTool('elevator'));
registerTool(makePlaceTool('column'));
