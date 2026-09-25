/**
 * Vorschau-Ebene für transient gezogene Objekte (siehe editor/dragPreview.ts): zeichnet Sicherheitszonen, Symbole,
 * Beschriftungen und Objektmaße der gerade gezogenen Objekte an ihrer Vorschauposition – in der Overlay-Ebene über
 * allen anderen Objekten – sowie die Kollisionsvorschau: gezogene Objekte rot und für berührte statische Objekte eine
 * rote Markierung (Grundfläche + Sicherheitszone) als Overlay. Die statischen Ebenen lassen die gezogenen Objekte aus
 * (`previewIds`) und bleiben während des Ziehens unverändert, sodass nur die kleine Overlay-Ebene neu gezeichnet wird.
 * Nutzt dieselben memoisierten Knoten wie die Objekt-Ebene.
 */
import { memo, useMemo } from 'react';
import { Group, Line } from 'react-konva';
import type { PlacedItem } from '@/types';
import type { LayerProps } from './LayerProps';
import { getDef } from '@/data/equipment';
import { bbox, flatten } from '@/geometry/polygon';
import { itemFootprint } from '@/geometry/transform';
import { formatNumber } from '@/geometry/units';
import { statePalette } from '../symbols';
import { useDragPreview } from '../dragPreview';
import { ItemNode, ItemZone, LABEL_MIN_SCALE, ZONE_DASH_MIN_SCALE, scaleBucket } from './ItemsLayer';
import { DimText, dimPalette } from './DimensionsLayer';

/** Rote Markierung eines statischen Objekts, das mit einem gezogenen kollidiert (Grundfläche, optional Zone). */
const CollisionMark = memo(function CollisionMark({ item, zone, dashed, dark }: { item: PlacedItem; zone: boolean; dashed: boolean; dark: boolean }) {
  const pal = statePalette(dark);
  return (
    <Group listening={false}>
      {zone && item.safetyZoneEnabled && <ItemZone item={item} colliding dashed={dashed} dark={dark} />}
      <Line
        points={flatten(itemFootprint(item))}
        closed
        fill={dark ? 'rgba(248,113,113,0.3)' : 'rgba(239,68,68,0.22)'}
        stroke={pal.danger}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        listening={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
    </Group>
  );
});

export const DragPreviewLayer = memo(function DragPreviewLayer(props: LayerProps) {
  const { project, floor, viewport, selection, hoverId, dark, presentation } = props;
  const preview = useDragPreview((s) => s.items);
  const colliding = useDragPreview((s) => s.colliding);
  const scale = scaleBucket(viewport.scale);
  const selectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const x of selection) if (x.kind === 'item') s.add(x.id);
    return s;
  }, [selection]);
  const byId = useMemo(() => {
    const m = new Map<string, PlacedItem>();
    for (const it of props.items) m.set(it.id, it);
    return m;
  }, [props.items]);
  if (!preview || !preview.size) return null;
  const layers = project.layers;
  const showLabels = layers.labels && scale >= LABEL_MIN_SCALE;
  const dashed = scale >= ZONE_DASH_MIN_SCALE;
  const showDims = layers.dimensions && !presentation;
  const s = 1 / scale;
  const pal = dimPalette(dark);
  const items = [...preview.values()].filter((it) => !it.hidden);
  const partners: PlacedItem[] = [];
  for (const id of colliding) {
    if (preview.has(id)) continue;
    const it = byId.get(id);
    if (it && !it.hidden) partners.push(it);
  }
  return (
    <Group listening={false}>
      {layers.safetyZones && (
        <Group listening={false}>
          {items.map((item) => (item.safetyZoneEnabled ? <ItemZone key={item.id} item={item} colliding={colliding.has(item.id)} dashed={dashed} dark={dark} /> : null))}
        </Group>
      )}
      <Group listening={false}>
        {partners.map((it) => <CollisionMark key={`c:${it.id}`} item={it} zone={layers.safetyZones} dashed={dashed} dark={dark} />)}
      </Group>
      <Group listening={false}>
        {items.map((item) => (
          <ItemNode
            key={item.id}
            item={item}
            def={getDef(item.defId, project)}
            scale={scale}
            dark={dark}
            selected={selectedIds.has(item.id)}
            colliding={colliding.has(item.id)}
            hovered={hoverId === item.id}
            showLabel={showLabels}
            showMarkers={!presentation}
            ceilingHeight={floor.ceilingHeight}
            linkedFrom={null}
          />
        ))}
      </Group>
      {showDims && (
        <Group listening={false}>
          {items.map((it) => {
            if (!selectedIds.has(it.id)) return null;
            const b = bbox(itemFootprint(it));
            return <DimText key={`d:${it.id}`} x={(b.minX + b.maxX) / 2} y={b.maxY + 11 * s} text={`${formatNumber(it.width, 1)} × ${formatNumber(it.depth, 1)} cm`} s={s} color={pal.accent} bg={pal.bg} />;
          })}
        </Group>
      )}
    </Group>
  );
});
