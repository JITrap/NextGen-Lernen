/**
 * Hinspringen im Plan: löst ein Prüf-/Warnungsziel (Objekt, Raum, Wand, Öffnung, Anmerkung oder Punkt) in einen
 * Weltpunkt plus optionale Auswahl auf, wechselt bei Bedarf das Stockwerk, verlässt die 3D-Ansicht und fordert den
 * Canvas über `useUiStore.requestFocus` zum Zentrieren auf. Von Übersicht (Warnungen) und Regularien-Panel genutzt.
 */
import type { Id, PlanningWarning, Project, Selection, Vec2 } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { warningFocus } from '@/analysis/warnings';
import { bbox } from '@/geometry/polygon';

export type FocusTarget = PlanningWarning['target'];

/** Weltpunkt (+ Auswahl) für ein Ziel; Anmerkungen werden hier ergänzt, alles andere über `warningFocus`. */
export function resolveFocus(project: Project, floorId: Id | undefined, target: FocusTarget): { point: Vec2; selection?: Selection } | null {
  if (target && 'kind' in target && target.kind === 'annotation') {
    const floor = project.floors.find((f) => f.id === floorId) ?? project.floors.find((f) => f.annotations.some((a) => a.id === target.id));
    const a = floor?.annotations.find((x) => x.id === target.id);
    if (!a) return null;
    const sel: Selection = { kind: 'annotation', id: a.id };
    if (a.kind === 'text') return { point: { x: a.x, y: a.y }, selection: sel };
    if (a.kind === 'measure') return { point: { x: (a.start.x + a.end.x) / 2, y: (a.start.y + a.end.y) / 2 }, selection: sel };
    if (!a.points.length) return null;
    const b = bbox(a.points);
    return { point: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }, selection: sel };
  }
  return warningFocus(project, { id: 'focus', kind: 'collision', severity: 'info', message: '', floorId: floorId ?? project.activeFloorId, target });
}

/**
 * Springt zum Ziel: Stockwerk wechseln (falls nötig), 3D verlassen, Fokus anfordern. Liefert false (mit Toast),
 * wenn kein Ziel auflösbar ist.
 */
export function focusTarget(floorId: Id | undefined, target: FocusTarget): boolean {
  const store = useProjectStore.getState();
  const ui = useUiStore.getState();
  const project = store.project;
  const f = resolveFocus(project, floorId, target);
  if (!f) {
    ui.toast('Kein Ziel zum Hinspringen vorhanden.', 'info');
    return false;
  }
  if (floorId && floorId !== project.activeFloorId && project.floors.some((x) => x.id === floorId)) store.setActiveFloor(floorId);
  if (ui.view3d) ui.setView3d(false);
  ui.requestFocus(f.point, f.selection);
  return true;
}
