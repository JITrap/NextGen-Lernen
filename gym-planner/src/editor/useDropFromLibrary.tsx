import { useCallback, useState, type RefObject, type DragEvent } from 'react';
import { Group, Rect } from 'react-konva';
import type { Viewport } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';
import { useProjectStore, transaction } from '@/store/projectStore';
import { getDef } from '@/data/equipment';
import { createItemFromDef } from '@/store/factories';
import { screenToWorld } from './viewport';
import type { ToolContext } from './tools/types';
import { snapItemPosition } from '@/geometry/snap';
import { itemFootprint } from '@/geometry/transform';
import { flatten } from '@/geometry/polygon';
import { Line } from 'react-konva';

export const DRAG_MIME = 'application/x-gymplanner-def';

/**
 * Drag & Drop aus der Bibliothek auf den Canvas: zeigt eine Vorschau des Objekts und legt es beim Ablegen an.
 * Die Bibliothek setzt beim Dragstart `dataTransfer.setData(DRAG_MIME, defId)` und ui.setDraggingDefId.
 */
export function useDropFromLibrary(containerRef: RefObject<HTMLDivElement | null>, viewport: Viewport, ctxRef: RefObject<ToolContext>) {
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; d: number } | null>(null);
  const draggingDefId = useUiStore((s) => s.draggingDefId);

  const worldFrom = (e: DragEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, viewport);
  };

  const onDragOver = useCallback(
    (e: DragEvent) => {
      const id = draggingDefId ?? (e.dataTransfer.types.includes(DRAG_MIME) ? '' : null);
      if (id === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const def = draggingDefId ? getDef(draggingDefId, ctxRef.current.project) : undefined;
      const w = worldFrom(e);
      if (!def || !w) return;
      const snapped = snapItemPosition({ id: '__new', x: w.x, y: w.y, width: def.breite_cm, depth: def.tiefe_cm, rotation: 0 }, w, {
        gridSize: ctxRef.current.project.settings.gridSize,
        enabled: ctxRef.current.project.settings.snapEnabled && !ctxRef.current.ui.snapOverride,
        threshold: 8 / viewport.scale,
        walls: ctxRef.current.walls,
        items: ctxRef.current.items,
      });
      setPreview({ x: snapped.point.x, y: snapped.point.y, w: def.breite_cm, d: def.tiefe_cm });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draggingDefId, viewport],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData(DRAG_MIME) || draggingDefId;
      setPreview(null);
      useUiStore.getState().setDraggingDefId(null);
      if (!id) return;
      const ctx = ctxRef.current;
      const def = getDef(id, ctx.project);
      const w = worldFrom(e);
      if (!def || !w) return;
      const snapped = snapItemPosition({ id: '__new', x: w.x, y: w.y, width: def.breite_cm, depth: def.tiefe_cm, rotation: 0 }, w, {
        gridSize: ctx.project.settings.gridSize,
        enabled: ctx.project.settings.snapEnabled && !ctx.ui.snapOverride,
        threshold: 8 / viewport.scale,
        walls: ctx.walls,
        items: ctx.items,
      });
      const item = createItemFromDef(def, snapped.point.x, snapped.point.y);
      if (def.preis_eur != null) item.priceEur = ctx.project.priceOverrides[def.id] ?? def.preis_eur;
      transaction(() => useProjectStore.getState().addItem(ctx.floor.id, item));
      useUiStore.getState().setSelection([{ kind: 'item', id: item.id }]);
      useUiStore.getState().setTool('select');
      useUiStore.getState().setRightPanel('properties');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draggingDefId, viewport],
  );
  const onDragLeave = useCallback(() => setPreview(null), []);

  const previewNode = preview ? (
    <Group listening={false}>
      <Line points={flatten(itemFootprint({ x: preview.x, y: preview.y, width: preview.w, depth: preview.d, rotation: 0 }))} closed fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth={2 / viewport.scale} dash={[6 / viewport.scale, 4 / viewport.scale]} />
      <Rect x={preview.x - 1} y={preview.y - 1} width={2} height={2} fill="#3b82f6" />
    </Group>
  ) : null;

  return { onDragOver, onDrop, onDragLeave, preview: previewNode };
}
