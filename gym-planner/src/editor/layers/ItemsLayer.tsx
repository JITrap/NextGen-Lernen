/**
 * Objekt-Ebene: Sicherheitszonen, Draufsicht-Symbole, Beschriftungen und Hinweis-Marker aller platzierten Objekte.
 *
 * Aufbau (Weltkoordinaten, Stage bereits skaliert):
 *   1. Gruppe aller Sicherheitszonen (hinter allen Objekten; gelb/amber, bei Kollision rot, gestrichelter Rand)
 *   2. Gruppe aller Objekte: rotierte Group mit `ItemSymbol`, darüber (unrotiert) Beschriftung und Marker.
 *
 * Performance: Jedes Objekt ist eine React.memo-Komponente mit stabilen Props (Objekt-Referenz, Definition,
 * Zustands-Booleans, Scale-Bucket). Beim Pan bekommt die Ebene denselben gerasterten Maßstab → kein Re-Render;
 * nur wenn der Culling-Bereich (`cullRect`, mit Rand quantisiert) wandert, wird die sichtbare Teilmenge neu bestimmt.
 * Transient gezogene Objekte (`previewIds`) werden ausgelassen und von `DragPreviewLayer` in der Overlay-Ebene
 * gezeichnet, damit diese große Ebene während des Ziehens unverändert bleibt (Konva zeichnet sie dann nicht neu).
 * Kein Node dieser Ebene hört auf Events (Hit-Test läuft geometrisch in editor/hitTest.ts).
 */
import { memo, useMemo } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type { EquipmentDef, LibraryArea, PlacedItem } from '@/types';
import type { LayerProps } from './LayerProps';
import { getDef } from '@/data/equipment';
import { itemZonePolygon } from '@/geometry/collision';
import { bbox, flatten, type BBox } from '@/geometry/polygon';
import { rectCorners } from '@/geometry/transform';
import { itemIndexFor } from '@/geometry/spatialHash';
import { ItemSymbol, lockerCount, statePalette } from '../symbols';

/* ------------------------------------------------------------------ */
/* Konstanten & reine Helfer                                           */
/* ------------------------------------------------------------------ */

/** Bereiche, die über die Ebene „Möbel“ ein-/ausgeblendet werden. */
export const FURNITURE_AREAS: ReadonlySet<LibraryArea> = new Set<LibraryArea>(['Empfang & Lounge', 'Büro & Personal', 'Ausstattung']);
/** Schriftgröße der Beschriftung in Bildschirm-Pixeln. */
export const LABEL_FONT_PX = 10;
/** Beschriftung nur, wenn das Objekt auf dem Bildschirm breiter ist als … px. */
export const LABEL_MIN_WIDTH_PX = 28;
export const LABEL_MAX_CHARS = 18;
/** Unter diesem Maßstab (px/cm) werden keine Beschriftungen gezeichnet (Gesamtansicht großer Hallen). */
export const LABEL_MIN_SCALE = 0.3;
/** Unter diesem Maßstab (px/cm) werden Sicherheitszonen mit durchgehendem statt gestricheltem Rand gezeichnet (Strichelung ist in Software-Rasterisierung teuer). */
export const ZONE_DASH_MIN_SCALE = 0.3;
/** Beschriftung darf (zentriert) bis zu diesem Vielfachen der Objektbreite überstehen, erst dann wird gekürzt („…“). */
export const LABEL_OVERHANG_FACTOR = 1.6;
/** Geschätzte mittlere Zeichenbreite (Anteil der Schriftgröße) für die Breite der Beschriftung. */
const LABEL_CHAR_WIDTH = 0.62;
const LABEL_FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** viewport.scale auf 2 Nachkommastellen (Bucket), damit Objekte nicht bei jeder Zoom-Nuance neu rendern. */
export function scaleBucket(scale: number): number {
  const s = Math.round(scale * 100) / 100;
  return Number.isFinite(s) && s > 0 ? s : 0.01;
}

/** Kurzname: label ?? def.modell ?? def.name (max. 18 Zeichen, sonst mit „…“ gekürzt). */
export function itemShortLabel(item: Pick<PlacedItem, 'label' | 'defId'>, def: EquipmentDef | undefined): string {
  const raw = (item.label?.trim() || def?.modell?.trim() || def?.name?.trim() || '').trim();
  if (raw.length <= LABEL_MAX_CHARS) return raw;
  return `${raw.slice(0, LABEL_MAX_CHARS - 1).trimEnd()}…`;
}

/** Vollständiger Beschriftungstext (mehrzeilig): Kurzname, bei Spindreihen „n Fächer“, bei verlinkten Kopien „von <Stockwerk>“. */
export function itemLabelText(item: Pick<PlacedItem, 'label' | 'defId' | 'params' | 'width'>, def: EquipmentDef | undefined, linkedFrom: string | null): string {
  const lines: string[] = [];
  const name = itemShortLabel(item, def);
  if (name) lines.push(name);
  if (def?.symbol === 'locker-row') {
    const n = lockerCount(item, def);
    lines.push(n === 1 ? '1 Fach' : `${n} Fächer`);
  }
  if (linkedFrom) lines.push(`von ${linkedFrom}`);
  return lines.join('\n');
}

/**
 * Breite des Beschriftungsfelds: mindestens die Objektbreite, bei längerem Text bis zu `LABEL_OVERHANG_FACTOR` × Objektbreite
 * (zentriert überstehend); erst darüber kürzt Konva mit „…“.
 */
export function labelBoxWidth(text: string, boxW: number, fontSize: number, factor = LABEL_OVERHANG_FACTOR): number {
  const longest = text.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
  const need = longest * fontSize * LABEL_CHAR_WIDTH + fontSize * 0.4;
  return Math.min(boxW * factor, Math.max(boxW, need));
}

/** Stockwerk-ID, von dem eine verlinkte Kopie (Treppe/Aufzug) stammt, sonst null. */
export function linkedFromId(item: Pick<PlacedItem, 'params'>): string | null {
  const v = item.params?.__linkedFrom;
  return typeof v === 'string' && v ? v : null;
}

/** Enthält der Bibliotheks-Hinweis die Aufforderung, Maße beim Händler zu bestätigen? */
export function hasDealerHint(def: EquipmentDef | undefined): boolean {
  return !!def?.hinweis && /händler/i.test(def.hinweis);
}

/* ------------------------------------------------------------------ */
/* Sicherheitszone                                                     */
/* ------------------------------------------------------------------ */

interface ZoneProps {
  item: PlacedItem;
  colliding: boolean;
  /** Gestrichelter Rand (ab ZONE_DASH_MIN_SCALE). */
  dashed: boolean;
  dark: boolean;
}

const ZONE_DASH = [5, 4];

/** Sicherheitszone; Rand in Bildschirm-Pixeln (strokeScaleEnabled=false) → unabhängig vom Maßstab, kein Re-Render beim Zoom. */
export const ItemZone = memo(function ItemZone({ item, colliding, dashed, dark }: ZoneProps) {
  const poly = useMemo(() => itemZonePolygon(item), [item]);
  if (!poly) return null;
  const pal = statePalette(dark);
  const fill = colliding
    ? (dark ? 'rgba(248,113,113,0.22)' : 'rgba(239,68,68,0.16)')
    : (dark ? 'rgba(251,191,36,0.15)' : 'rgba(245,158,11,0.13)');
  return (
    <Line
      points={flatten(poly)}
      closed
      fill={fill}
      stroke={colliding ? pal.danger : pal.warn}
      strokeWidth={1}
      strokeScaleEnabled={false}
      dash={dashed ? ZONE_DASH : undefined}
      opacity={linkedFromId(item) ? 0.5 : 1}
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
});

/* ------------------------------------------------------------------ */
/* Objekt                                                              */
/* ------------------------------------------------------------------ */

interface NodeProps {
  item: PlacedItem;
  def: EquipmentDef | undefined;
  /** Scale-Bucket (px/cm). */
  scale: number;
  dark: boolean;
  selected: boolean;
  colliding: boolean;
  hovered: boolean;
  showLabel: boolean;
  showMarkers: boolean;
  ceilingHeight: number;
  /** Name des Stockwerks, von dem die verlinkte Kopie stammt (null = eigenes Objekt). */
  linkedFrom: string | null;
}

export const ItemNode = memo(function ItemNode(p: NodeProps) {
  const { item, def, scale, dark, selected, colliding, hovered, showLabel, showMarkers, ceilingHeight, linkedFrom } = p;
  const px = 1 / scale;
  const pal = statePalette(dark);
  // Achsenparallele Box der (gedrehten) Grundfläche in lokalen, unrotierten Koordinaten → Beschriftung/Marker bleiben aufrecht.
  const box = useMemo(() => bbox(rectCorners(0, 0, Math.max(1, item.width), Math.max(1, item.depth), item.rotation)), [item.width, item.depth, item.rotation]);
  const label = showLabel && item.width * scale > LABEL_MIN_WIDTH_PX ? itemLabelText(item, def, linkedFrom) : '';
  const tooHigh = showMarkers && item.height != null && Number.isFinite(item.height) && item.height > ceilingHeight;
  const unverified = showMarkers && def?.verifiziert === false && def.bereich !== 'Bauelemente';
  const dealer = showMarkers && hasDealerHint(def);
  const m = 10 * px;
  const fontSize = LABEL_FONT_PX * px;
  const boxW = box.maxX - box.minX;
  const boxH = box.maxY - box.minY;
  const labelW = label ? labelBoxWidth(label, boxW, fontSize) : boxW;

  return (
    <Group x={item.x} y={item.y} opacity={linkedFrom ? 0.45 : 1} listening={false}>
      <Group rotation={item.rotation} listening={false}>
        <ItemSymbol item={item} def={def} scale={scale} dark={dark} selected={selected} colliding={colliding} hovered={hovered} />
      </Group>
      {label && (
        <Text
          x={box.minX - (labelW - boxW) / 2}
          y={box.minY}
          width={labelW}
          height={boxH}
          text={label}
          fontSize={fontSize}
          fontFamily={LABEL_FONT}
          fontStyle="600"
          lineHeight={1.15}
          fill={pal.text}
          align="center"
          verticalAlign="middle"
          wrap="none"
          ellipsis
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {unverified && (
        <Line
          points={[box.minX + px, box.minY + m, box.minX + px, box.minY + px, box.minX + m, box.minY + px]}
          stroke={pal.warn}
          strokeWidth={1.5 * px}
          dash={[2 * px, 2 * px]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {dealer && <Circle x={box.minX + m * 0.7} y={box.minY + m * 0.7} radius={3 * px} fill={pal.warn} stroke={dark ? '#0f172a' : '#ffffff'} strokeWidth={px} listening={false} perfectDrawEnabled={false} />}
      {tooHigh && (
        <Line
          points={[box.maxX - 1.3 * m, box.minY + 1.2 * m, box.maxX - 0.2 * m, box.minY + 1.2 * m, box.maxX - 0.75 * m, box.minY + 0.2 * m]}
          closed
          fill={pal.danger}
          stroke={dark ? '#0f172a' : '#ffffff'}
          strokeWidth={px}
          lineJoin="round"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
});

/* ------------------------------------------------------------------ */
/* Ebene                                                               */
/* ------------------------------------------------------------------ */

interface VisibleEntry {
  item: PlacedItem;
  def: EquipmentDef | undefined;
  linkedFrom: string | null;
}

/** Sichtbare Objekte der Ebene (ohne versteckte, ohne transient gezogene, optional nur im Culling-Bereich). */
export function visibleEntries(
  items: PlacedItem[],
  lib: { customEquipment: EquipmentDef[] },
  floorNames: ReadonlyMap<string, string>,
  showFurniture: boolean,
  cullRect?: BBox | null,
  previewIds?: ReadonlySet<string> | null,
): VisibleEntry[] {
  const idx = cullRect ? itemIndexFor(items) : null;
  const out: VisibleEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.hidden) continue;
    if (previewIds?.has(it.id)) continue;
    if (idx && cullRect) {
      const b = idx.boxes[i];
      const z = idx.zoneBoxes[i];
      const minX = z ? Math.min(b.minX, z.minX) : b.minX;
      const maxX = z ? Math.max(b.maxX, z.maxX) : b.maxX;
      const minY = z ? Math.min(b.minY, z.minY) : b.minY;
      const maxY = z ? Math.max(b.maxY, z.maxY) : b.maxY;
      if (maxX < cullRect.minX || minX > cullRect.maxX || maxY < cullRect.minY || minY > cullRect.maxY) continue;
    }
    const def = getDef(it.defId, lib);
    if (!showFurniture && def && FURNITURE_AREAS.has(def.bereich)) continue;
    const from = linkedFromId(it);
    out.push({ item: it, def, linkedFrom: from ? (floorNames.get(from) ?? 'anderem Stockwerk') : null });
  }
  return out;
}

export const ItemsLayer = memo(function ItemsLayer(props: LayerProps) {
  const { project, floor, items, viewport, selection, hoverId, dark, collidingIds, presentation, cullRect, previewIds } = props;
  const scale = scaleBucket(viewport.scale);
  const showZones = project.layers.safetyZones;
  const showLabels = project.layers.labels && scale >= LABEL_MIN_SCALE;
  const dashed = scale >= ZONE_DASH_MIN_SCALE;
  const showFurniture = project.layers.furniture;
  const showMarkers = !presentation;
  const custom = project.customEquipment;
  const floors = project.floors;

  const selectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const x of selection) if (x.kind === 'item') s.add(x.id);
    return s;
  }, [selection]);

  const visible = useMemo<VisibleEntry[]>(() => {
    const names = new Map<string, string>();
    for (const f of floors) names.set(f.id, f.name);
    return visibleEntries(items, { customEquipment: custom }, names, showFurniture, cullRect, previewIds);
  }, [items, custom, floors, showFurniture, cullRect, previewIds]);

  return (
    <Group listening={false}>
      {showZones && (
        <Group listening={false}>
          {visible.map(({ item, linkedFrom }) =>
            item.safetyZoneEnabled ? <ItemZone key={linkedFrom ? `${item.id}:l` : item.id} item={item} colliding={collidingIds.has(item.id)} dashed={dashed} dark={dark} /> : null,
          )}
        </Group>
      )}
      <Group listening={false}>
        {visible.map(({ item, def, linkedFrom }) => (
          <ItemNode
            key={linkedFrom ? `${item.id}:l` : item.id}
            item={item}
            def={def}
            scale={scale}
            dark={dark}
            selected={selectedIds.has(item.id)}
            colliding={collidingIds.has(item.id)}
            hovered={hoverId === item.id}
            showLabel={showLabels}
            showMarkers={showMarkers}
            ceilingHeight={floor.ceilingHeight}
            linkedFrom={linkedFrom}
          />
        ))}
      </Group>
    </Group>
  );
});
