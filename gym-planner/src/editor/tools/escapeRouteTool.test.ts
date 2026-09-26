import { describe, it, expect, beforeEach } from 'vitest';
import type { Door, Project, Vec2, EscapeRoute } from '@/types';
import { getTool } from './registry';
import './escapeRouteTool';
import './selectTool';
import { useEscapeRoute, nextRouteLabel, resolveRoutePoint, commitRoute, EXIT_SNAP_CM } from './escapeRouteTool';
import { insertRoutePoint, removeRoutePoint } from './selectTool';
import type { ToolContext, ToolEvent } from './types';
import { createEmptyProject, createHall } from '@/store/factories';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { openingPlacement, findWall, allWalls } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { selectionHandles } from '../layers/SelectionLayer';
import { AnnotationsLayer, EscapeRouteNode, escapeRouteName } from '../layers/AnnotationsLayer';
import { hitTest } from '../hitTest';
import { floorContentBounds } from '@/export/planRenderer';
import { resolveFocus } from '@/components/focusTarget';

let n = 0;
function door(wallId: string, offset: number, width = 100, extra: Partial<Door> = {}): Door {
  return { id: `d${++n}`, kind: 'door', wallId, offset, width, doorType: 'Notausgang', height: 210, hinge: 'left', swingSide: 'a', ...extra };
}

function project(): Project {
  const p = createEmptyProject('Fluchtweg-Test');
  p.floors[0].hall = createHall(2000, 1500);
  p.floors[0].openings.push(door('hall_0', 500));
  return p;
}

function makeCtx(p: Project): ToolContext & { ui: ToolContext['ui'] & { calls: string[] } } {
  useProjectStore.getState().setProject(p);
  const floor = p.floors[0];
  const calls: string[] = [];
  const base = useUiStore.getState();
  const ui = {
    ...base,
    calls,
    selection: [] as ToolContext['ui']['selection'],
    snapOverride: false,
    toolOptions: {},
    setSelection: (s: ToolContext['ui']['selection']) => { calls.push(`select:${s.map((x) => x.kind).join(',')}`); useUiStore.getState().setSelection(s); },
    setRightPanel: (x: string) => { calls.push(`panel:${x}`); },
    setTool: (t: string) => { calls.push(`tool:${t}`); },
    toast: (t: string) => { calls.push(`toast:${t}`); },
  } as unknown as ToolContext['ui'] & { calls: string[] };
  return {
    project: p,
    floor,
    walls: allWalls(floor),
    rooms: floorRooms(floor),
    items: floor.items,
    viewport: { x: 0, y: 0, scale: 0.5 },
    store: useProjectStore.getState(),
    ui,
    snap: (q: Vec2) => ({ point: { x: Math.round(q.x / 10) * 10, y: Math.round(q.y / 10) * 10 }, kind: 'grid' as const, guides: [] }),
    pxToWorld: (px: number) => px / 0.5,
    stageSize: { width: 1000, height: 800 },
  };
}

function ev(world: Vec2, extra: Partial<ToolEvent> = {}): ToolEvent {
  return { world, screen: { x: world.x * 0.5, y: world.y * 0.5 }, shift: false, alt: false, ctrl: false, meta: false, button: 0, pointerType: 'mouse', evt: {} as ToolEvent['evt'], target: {} as ToolEvent['target'], ...extra };
}

function routes(): EscapeRoute[] {
  return useProjectStore.getState().project.floors[0].annotations.filter((a): a is EscapeRoute => a.kind === 'escape-route');
}

beforeEach(() => {
  useEscapeRoute.getState().reset();
  useUiStore.getState().setSelection([]);
});

describe('Werkzeug „Fluchtweg“', () => {
  it('ist registriert mit Hinweis, Overlay und Tastenbehandlung', () => {
    const t = getTool('escape-route');
    expect(t).toBeDefined();
    expect(t!.hint).toMatch(/Fluchtweg/);
    expect(t!.Overlay).toBeDefined();
    expect(t!.onKeyDown).toBeDefined();
    expect(t!.onDoubleClick).toBeDefined();
    expect(EXIT_SNAP_CM).toBe(60);
  });
  it('nextRouteLabel zählt vorhandene Fluchtwege', () => {
    const p = project();
    expect(nextRouteLabel(p.floors[0])).toBe('Fluchtweg 1');
    p.floors[0].annotations.push({ id: 'a', kind: 'escape-route', points: [] });
    expect(nextRouteLabel(p.floors[0])).toBe('Fluchtweg 2');
  });
  it('resolveRoutePoint rastet in Türnähe auf die Türmitte, sonst Punkt-Snapping', () => {
    const p = project();
    const ctx = makeCtx(p);
    const d = p.floors[0].openings[0] as Door;
    const c = openingPlacement(d, findWall(p.floors[0], d.wallId)!).center;
    const near = resolveRoutePoint(ctx, { world: { x: c.x + 20, y: c.y + 30 }, shift: false }, null);
    expect(near.exit?.door.id).toBe(d.id);
    expect(near.point).toEqual(c);
    const far = resolveRoutePoint(ctx, { world: { x: 1234, y: 567 }, shift: false }, null);
    expect(far.exit).toBeNull();
    expect(far.point).toEqual({ x: 1230, y: 570 });
  });
  it('Klicks setzen Punkte, Enter legt die Anmerkung an (ein Undo-Schritt), Auswahl und Werkzeugwechsel', () => {
    const p = project();
    const ctx = makeCtx(p);
    const t = getTool('escape-route')!;
    t.onPointerDown!(ev({ x: 1800, y: 1300 }), ctx);
    t.onPointerMove!(ev({ x: 1800, y: 800 }), ctx);
    expect(useEscapeRoute.getState().points).toHaveLength(1);
    expect(useEscapeRoute.getState().cursor).toEqual({ x: 1800, y: 800 });
    t.onPointerDown!(ev({ x: 1800, y: 800 }), ctx);
    t.onPointerDown!(ev({ x: 1800, y: 800 }), ctx); // Doppelter Punkt wird ignoriert
    expect(useEscapeRoute.getState().points).toHaveLength(2);
    const handled = t.onKeyDown!(new KeyboardEvent('keydown', { key: 'Enter' }), ctx);
    expect(handled).toBe(true);
    const list = routes();
    expect(list).toHaveLength(1);
    expect(list[0].points).toEqual([{ x: 1800, y: 1300 }, { x: 1800, y: 800 }]);
    expect(list[0].label).toBe('Fluchtweg 1');
    expect(useEscapeRoute.getState().points).toHaveLength(0);
    expect(ctx.ui.calls).toContain('select:annotation');
    expect(ctx.ui.calls).toContain('tool:select');
    expect(useUiStore.getState().selection).toEqual([{ kind: 'annotation', id: list[0].id }]);
  });
  it('Klick am Notausgang rastet auf die Türmitte und beendet automatisch', () => {
    const p = project();
    const ctx = makeCtx(p);
    const t = getTool('escape-route')!;
    const d = p.floors[0].openings[0] as Door;
    const c = openingPlacement(d, findWall(p.floors[0], d.wallId)!).center;
    t.onPointerDown!(ev({ x: 1000, y: 1000 }), ctx);
    t.onPointerDown!(ev({ x: c.x + 25, y: c.y + 25 }), ctx);
    const list = routes();
    expect(list).toHaveLength(1);
    expect(list[0].points[1]).toEqual({ x: Math.round(c.x * 1e4) / 1e4, y: Math.round(c.y * 1e4) / 1e4 });
    expect(useEscapeRoute.getState().points).toHaveLength(0);
  });
  it('erster Klick am Notausgang startet dort nicht automatisch fertig', () => {
    const p = project();
    const ctx = makeCtx(p);
    const t = getTool('escape-route')!;
    const d = p.floors[0].openings[0] as Door;
    const c = openingPlacement(d, findWall(p.floors[0], d.wallId)!).center;
    t.onPointerDown!(ev({ x: c.x, y: c.y + 10 }), ctx);
    expect(routes()).toHaveLength(0);
    expect(useEscapeRoute.getState().points).toHaveLength(1);
  });
  it('Rücktaste entfernt den letzten Punkt, Esc bricht ab, Enter mit einem Punkt meldet Hinweis', () => {
    const p = project();
    const ctx = makeCtx(p);
    const t = getTool('escape-route')!;
    expect(t.onKeyDown!(new KeyboardEvent('keydown', { key: 'Escape' }), ctx)).toBe(false);
    t.onPointerDown!(ev({ x: 100, y: 100 }), ctx);
    t.onPointerDown!(ev({ x: 500, y: 100 }), ctx);
    expect(t.onKeyDown!(new KeyboardEvent('keydown', { key: 'Backspace' }), ctx)).toBe(true);
    expect(useEscapeRoute.getState().points).toHaveLength(1);
    expect(t.onKeyDown!(new KeyboardEvent('keydown', { key: 'Enter' }), ctx)).toBe(true);
    expect(routes()).toHaveLength(0);
    expect(ctx.ui.calls.some((c) => c.startsWith('toast:Mindestens 2 Punkte'))).toBe(true);
    expect(t.onKeyDown!(new KeyboardEvent('keydown', { key: 'Escape' }), ctx)).toBe(true);
    expect(useEscapeRoute.getState().points).toHaveLength(0);
  });
  it('Doppelklick beendet und entfernt den doppelten Endpunkt', () => {
    const p = project();
    const ctx = makeCtx(p);
    const t = getTool('escape-route')!;
    t.onPointerDown!(ev({ x: 100, y: 100 }), ctx);
    t.onPointerDown!(ev({ x: 500, y: 100 }), ctx);
    t.onPointerDown!(ev({ x: 500, y: 103 }), ctx); // zweiter Klick des Doppelklicks (Raster → gleicher Punkt, wird ignoriert)
    t.onDoubleClick!(ev({ x: 500, y: 103 }), ctx);
    const list = routes();
    expect(list).toHaveLength(1);
    expect(list[0].points).toHaveLength(2);
  });
  it('Toast, wenn die Ebene „Anmerkungen“ ausgeblendet ist', () => {
    const p = project();
    p.layers.annotations = false;
    const ctx = makeCtx(p);
    commitRoute([{ x: 0, y: 0 }, { x: 300, y: 0 }], ctx);
    expect(ctx.ui.calls.some((c) => c.includes('Anmerkungen'))).toBe(true);
  });
  it('commitRoute lehnt zu kurze Wege ab', () => {
    const ctx = makeCtx(project());
    expect(commitRoute([{ x: 0, y: 0 }], ctx)).toBeNull();
    expect(commitRoute([{ x: 0, y: 0 }, { x: 0.2, y: 0 }], ctx)).toBeNull();
    expect(routes()).toHaveLength(0);
  });
});

describe('Bearbeiten gewählter Fluchtwege', () => {
  function withRoute(): { p: Project; route: EscapeRoute } {
    const p = project();
    const route: EscapeRoute = { id: 'r1', kind: 'escape-route', points: [{ x: 100, y: 100 }, { x: 900, y: 100 }, { x: 900, y: 700 }], label: 'Weg' };
    p.floors[0].annotations.push(route);
    useProjectStore.getState().setProject(p);
    return { p, route };
  }
  it('Griffe je Eckpunkt (nicht bei gesperrten)', () => {
    const { p, route } = withRoute();
    const hs = selectionHandles([{ kind: 'annotation', id: route.id }], { floor: p.floors[0], items: [], project: p }, 1);
    expect(hs.filter((h) => h.kind === 'escapeVertex').map((h) => h.index)).toEqual([0, 1, 2]);
    p.floors[0].annotations[0] = { ...route, locked: true };
    expect(selectionHandles([{ kind: 'annotation', id: route.id }], { floor: p.floors[0], items: [], project: p }, 1)).toHaveLength(0);
  });
  it('insertRoutePoint fügt auf dem nächsten Segment ein, removeRoutePoint hält mindestens 2 Punkte', () => {
    const { route } = withRoute();
    const fid = useProjectStore.getState().project.floors[0].id;
    const idx = insertRoutePoint(route, { x: 500, y: 130 }, fid);
    expect(idx).toBe(1);
    let cur = routes()[0];
    expect(cur.points).toHaveLength(4);
    expect(cur.points[1]).toEqual({ x: 500, y: 100 });
    expect(removeRoutePoint(cur, 1, fid)).toBe(true);
    cur = routes()[0];
    expect(cur.points).toHaveLength(3);
    expect(removeRoutePoint(cur, 0, fid)).toBe(true);
    cur = routes()[0];
    expect(removeRoutePoint(cur, 0, fid)).toBe(false);
    expect(routes()[0].points).toHaveLength(2);
  });
  it('Auswahl-Werkzeug: Entf über einem Griff entfernt den Punkt', () => {
    const { p, route } = withRoute();
    const ctx = makeCtx(useProjectStore.getState().project);
    const sel = getTool('select')!;
    useUiStore.getState().setSelection([{ kind: 'annotation', id: route.id }]);
    const ctx2 = { ...ctx, ui: { ...ctx.ui, selection: [{ kind: 'annotation' as const, id: route.id }] } };
    sel.onPointerMove!(ev({ x: 900, y: 100 }), ctx2);
    expect(sel.onKeyDown!(new KeyboardEvent('keydown', { key: 'Delete' }), ctx2)).toBe(true);
    expect(routes()[0].points).toEqual([{ x: 100, y: 100 }, { x: 900, y: 700 }]);
    // Weit weg vom Griff: nicht verarbeitet (globales Löschen greift)
    sel.onPointerMove!(ev({ x: 500, y: 400 }), ctx2);
    expect(sel.onKeyDown!(new KeyboardEvent('keydown', { key: 'Delete' }), ctx2)).toBe(false);
    expect(p.floors[0].annotations).toHaveLength(1);
  });
  it('Auswahl-Werkzeug: Griff ziehen verschiebt den Punkt (ein Undo-Schritt), Alt+Klick fügt Punkt ein', () => {
    const { route } = withRoute();
    const ctx = makeCtx(useProjectStore.getState().project);
    const sel = getTool('select')!;
    useUiStore.getState().setSelection([{ kind: 'annotation', id: route.id }]);
    const ctx2 = { ...ctx, ui: { ...ctx.ui, selection: [{ kind: 'annotation' as const, id: route.id }] } };
    sel.onPointerDown!(ev({ x: 900, y: 700 }, { buttons: 1 }), ctx2);
    sel.onPointerMove!(ev({ x: 950, y: 750 }, { buttons: 1 }), ctx2);
    sel.onPointerMove!(ev({ x: 1000, y: 800 }, { buttons: 1 }), ctx2);
    sel.onPointerUp!(ev({ x: 1000, y: 800 }), ctx2);
    expect(routes()[0].points[2]).toEqual({ x: 1000, y: 800 });
    // Alt+Klick auf das erste Segment
    const before = routes()[0].points.length;
    sel.onPointerDown!(ev({ x: 500, y: 100 }, { alt: true, buttons: 1 }), { ...ctx2, floor: useProjectStore.getState().project.floors[0] });
    sel.onPointerUp!(ev({ x: 500, y: 100 }), ctx2);
    expect(routes()[0].points.length).toBe(before + 1);
    expect(routes()[0].points[1]).toEqual({ x: 500, y: 100 });
  });
  it('hitTest trifft Segmente des Fluchtwegs', () => {
    const { p, route } = withRoute();
    const inp = { floor: p.floors[0], walls: allWalls(p.floors[0]), rooms: [], items: [], tolerance: 5, layers: { items: true, walls: true, rooms: true, openings: true, annotations: true, voids: true } };
    expect(hitTest({ x: 500, y: 102 }, inp)).toEqual({ kind: 'annotation', id: route.id });
    expect(hitTest({ x: 500, y: 300 }, inp)?.kind).not.toBe('annotation');
  });
});

describe('Darstellung, Export, Fokus (Smoke)', () => {
  it('Ebene und Knoten sind Komponenten; Name-Ersatz', () => {
    expect(AnnotationsLayer).toBeTruthy();
    expect(EscapeRouteNode).toBeTruthy();
    expect(escapeRouteName({ id: 'x', kind: 'escape-route', points: [] }, 2)).toBe('Fluchtweg 3');
    expect(escapeRouteName({ id: 'x', kind: 'escape-route', points: [], label: ' Haupt ' }, 2)).toBe('Haupt');
  });
  it('Export-Bounds enthalten die Fluchtweg-Punkte', () => {
    const p = project();
    p.floors[0].annotations.push({ id: 'r', kind: 'escape-route', points: [{ x: -500, y: 100 }, { x: 3000, y: 100 }] });
    const b = floorContentBounds(p.floors[0], p);
    expect(b.minX).toBeLessThanOrEqual(-500);
    expect(b.maxX).toBeGreaterThanOrEqual(3000);
  });
  it('resolveFocus löst Anmerkungen, Objekte und Punkte auf', () => {
    const p = project();
    p.floors[0].annotations.push({ id: 'r', kind: 'escape-route', points: [{ x: 0, y: 0 }, { x: 400, y: 200 }] });
    const f = resolveFocus(p, p.floors[0].id, { kind: 'annotation', id: 'r' });
    expect(f?.point).toEqual({ x: 200, y: 100 });
    expect(f?.selection).toEqual({ kind: 'annotation', id: 'r' });
    expect(resolveFocus(p, p.floors[0].id, { point: { x: 5, y: 6 } })?.point).toEqual({ x: 5, y: 6 });
    expect(resolveFocus(p, p.floors[0].id, { kind: 'annotation', id: 'nix' })).toBeNull();
  });
});
