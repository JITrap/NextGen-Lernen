/**
 * Werkzeug „Luftraum“ ('void'): Rechteck aufziehen wie bei der Zone, legt aber einen Luftraum
 * („offen nach unten“, z. B. Galerie/Empore) an. Die Fläche zählt nicht zur Nutzfläche.
 */
import { memo } from 'react';
import { Group } from 'react-konva';
import type { Vec2 } from '@/types';
import type { ToolContext } from './types';
import { registerTool } from './registry';
import { makeRectDrawTool, useRectDraw, RectDrawDims } from './zoneTools';
import { VoidHatch } from '../layers/RoomsLayer';
import { transaction } from '@/store/projectStore';
import { newId } from '@/utils/id';
import { rectPolygon, polygonArea, perimeter } from '@/geometry/polygon';
import { formatM2, formatLength, cm2ToM2 } from '@/geometry/units';
import { useIsDark } from '@/hooks/useTheme';

/** Legt einen Luftraum an (ein Undo-Schritt), wählt ihn aus und wechselt auf „Auswahl“. */
export function commitVoid(polygon: Vec2[], ctx: ToolContext): string {
  const id = newId('v_');
  transaction(() => ctx.store.addVoid(ctx.floor.id, { id, polygon, name: 'Luftraum' }));
  ctx.ui.setSelection([{ kind: 'void', id }]);
  ctx.ui.setRightPanel('properties');
  ctx.ui.setTool('select');
  const m2 = formatM2(cm2ToM2(polygonArea(polygon)));
  if (!ctx.project.layers.voids || !ctx.project.layers.rooms) {
    ctx.ui.toast(`Luftraum (${m2}) angelegt – die Ebene „Lufträume“ bzw. „Räume“ ist ausgeblendet`, 'info');
  } else {
    ctx.ui.toast(`Luftraum (${m2}) angelegt – zählt nicht zur Nutzfläche`, 'success');
  }
  return id;
}

const VoidRectOverlay = memo(function VoidRectOverlay({ ctx }: { ctx: ToolContext }) {
  const start = useRectDraw((s) => s.start);
  const current = useRectDraw((s) => s.current);
  const dark = useIsDark();
  if (!start || !current) return null;
  const poly = rectPolygon(start, current);
  const text = `Luftraum (offen nach unten)\n${formatM2(cm2ToM2(polygonArea(poly)))} · Umfang ${formatLength(perimeter(poly))}\nzählt nicht zur Nutzfläche`;
  return (
    <Group listening={false}>
      <VoidHatch polygon={poly} scale={ctx.viewport.scale} dark={dark} emphasis />
      <RectDrawDims start={start} end={current} scale={ctx.viewport.scale} dark={dark} centerText={text} tone="void" />
    </Group>
  );
});

registerTool(
  makeRectDrawTool({
    id: 'void',
    hint: 'Luftraum als Rechteck aufziehen – die Fläche zählt nicht zur Nutzfläche · Esc: abbrechen',
    tooSmall: 'Luftraum zu klein – bitte ein größeres Rechteck aufziehen',
    commit: commitVoid,
    Overlay: VoidRectOverlay,
  }),
);
