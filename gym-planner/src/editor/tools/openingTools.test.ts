import { describe, it, expect } from 'vitest';
import type { Door, Opening, Wall, Window } from '@/types';
import {
  placeOpeningOnWall, openingOverlaps, openingFitsWall, wallSideOf, openingSpecFromOptions, createOpening, validatePlacement, oppositeSide,
} from './openingTools';
import { createFloor, createHall } from '@/store/factories';
import { allWalls, wallLength } from '@/geometry/walls';
import { DOOR_TYPE_MAP, WINDOW_DEFAULT, MIRROR_DEFAULT } from '@/data/wallTypes';
import { getTool } from './registry';
import './zoneTools';
import './voidTool';
import './measureTool';
import './textTool';
import { RoomsLayer, labelAnchor } from '../layers/RoomsLayer';
import { OpeningsLayer, readableAngle } from '../layers/OpeningsLayer';
import { AnnotationsLayer } from '../layers/AnnotationsLayer';
import { onlyNoteAdded } from './textTool';
import { snapMeasurePoint } from './measureTool';
import { zoneTypeFromOptions } from './zoneTools';
import { createEmptyProject } from '@/store/factories';
import type { Project, Vec2 } from '@/types';

describe('Registrierung & Ebenen (Smoke)', () => {
  it('registriert alle Werkzeuge dieses Moduls', () => {
    for (const id of ['door', 'window', 'mirror', 'zone-rect', 'zone-polygon', 'void', 'measure', 'text'] as const) {
      const t = getTool(id);
      expect(t, id).toBeDefined();
      expect(t!.hint, id).toBeTruthy();
    }
    expect(getTool('door')!.Overlay).toBeDefined();
    expect(getTool('text')!.HtmlOverlay).toBeDefined();
  });
  it('Ebenen sind Komponenten', () => {
    expect(RoomsLayer).toBeTruthy();
    expect(OpeningsLayer).toBeTruthy();
    expect(AnnotationsLayer).toBeTruthy();
  });
  it('readableAngle stellt Text nie kopfüber', () => {
    expect(readableAngle(0)).toBe(0);
    expect(readableAngle(180)).toBe(0);
    expect(readableAngle(135)).toBe(-45);
    expect(readableAngle(-135)).toBe(45);
    expect(readableAngle(90)).toBe(-90);
    expect(readableAngle(-90)).toBe(-90);
  });
  it('labelAnchor: Schwerpunkt bei Rechteck, Punkt im Inneren bei L-Form', () => {
    const rect: Vec2[] = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];
    expect(labelAnchor(rect, { x: 200, y: 150 })).toEqual({ x: 200, y: 150 });
    // L-Form, Schwerpunkt liegt in der Aussparung
    const l: Vec2[] = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 1000 }, { x: 0, y: 1000 }];
    const c = { x: 500, y: 500 };
    const a = labelAnchor(l, c);
    expect(a).not.toEqual(c);
    const inside = (p: Vec2) => (p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 100) || (p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 1000);
    expect(inside(a)).toBe(true);
  });
  it('zoneTypeFromOptions: gültiger Typ oder Standard', () => {
    expect(zoneTypeFromOptions({ roomType: 'Cardio' })).toBe('Cardio');
    expect(zoneTypeFromOptions({ roomType: 'Quatsch' })).toBe('Trainingsfläche Freihantel');
    expect(zoneTypeFromOptions({})).toBe('Trainingsfläche Freihantel');
  });
  it('onlyNoteAdded erkennt, ob nur die Notiz hinzukam', () => {
    const before: Project = createEmptyProject();
    const fid = before.floors[0].id;
    const note = { id: 'a_1', kind: 'text' as const, x: 0, y: 0, text: 'Notiz', fontSize: 30, rotation: 0 };
    const after: Project = { ...before, floors: [{ ...before.floors[0], annotations: [note] }] };
    expect(onlyNoteAdded(before, after, fid, 'a_1')).toBe(true);
    const other: Project = { ...before, floors: [{ ...before.floors[0], annotations: [note], name: 'Anders' }] };
    expect(onlyNoteAdded(before, other, fid, 'a_1')).toBe(false);
    expect(onlyNoteAdded(before, after, fid, 'a_2')).toBe(false);
    expect(onlyNoteAdded(before, before, fid, 'a_1')).toBe(false);
  });
  it('snapMeasurePoint: Shift rastet auf 45° und Raster entlang des Strahls', () => {
    const project = createEmptyProject();
    const ctx = {
      project,
      ui: { snapOverride: false },
      snap: (p: Vec2) => ({ point: p, kind: 'none' as const, guides: [] }),
    } as unknown as Parameters<typeof snapMeasurePoint>[0];
    const r = snapMeasurePoint(ctx, { world: { x: 100, y: 12 }, shift: true }, { x: 0, y: 0 });
    expect(r.kind).toBe('angle');
    expect(r.point.y).toBeCloseTo(0);
    expect(r.point.x).toBe(100);
    const free = snapMeasurePoint(ctx, { world: { x: 100, y: 12 }, shift: false }, { x: 0, y: 0 });
    expect(free.point).toEqual({ x: 100, y: 12 });
  });
});

let counter = 0;
function wall(x1: number, y1: number, x2: number, y2: number, thickness = 10, extra: Partial<Wall> = {}): Wall {
  return { id: `w${++counter}`, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, type: 'Trockenbau', height: null, ...extra };
}
function door(wallId: string, offset: number, width: number, extra: Partial<Door> = {}): Door {
  return { id: `d${++counter}`, kind: 'door', wallId, offset, width, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a', ...extra };
}

describe('wallSideOf', () => {
  it('Seite a liegt in Normalenrichtung (links von start→end), b gegenüber', () => {
    const w = wall(0, 0, 500, 0);
    // Wand nach +x: Normale (d.y, -d.x) = (0, -1) → „a“ = oben (negatives y)
    expect(wallSideOf(w, { x: 250, y: -20 })).toBe('a');
    expect(wallSideOf(w, { x: 250, y: 20 })).toBe('b');
    expect(oppositeSide('a')).toBe('b');
  });
});

describe('placeOpeningOnWall', () => {
  it('projiziert auf die nächste Wand, rastet den Offset und liefert die Cursorseite', () => {
    const w = wall(0, 0, 500, 0);
    const r = placeOpeningOnWall({ x: 247, y: 8 }, [w], 90, 30, 10);
    expect(r).not.toBeNull();
    expect(r!.wall.id).toBe(w.id);
    expect(r!.offset).toBe(250);
    expect(r!.side).toBe('b');
    expect(r!.point.x).toBeCloseTo(250);
    expect(r!.point.y).toBeCloseTo(0);
    expect(r!.distance).toBeCloseTo(3); // 8 − halbe Wandstärke
  });

  it('ohne Raster bleibt der Offset exakt', () => {
    const w = wall(0, 0, 500, 0);
    expect(placeOpeningOnWall({ x: 247, y: 0 }, [w], 90, 30)!.offset).toBeCloseTo(247);
  });

  it('begrenzt den Offset auf die Wandlänge (Öffnung ragt nie über das Wandende)', () => {
    const w = wall(0, 0, 500, 0);
    expect(placeOpeningOnWall({ x: 10, y: 0 }, [w], 90, 30, 10)!.offset).toBe(45);
    expect(placeOpeningOnWall({ x: 495, y: 0 }, [w], 90, 30, 10)!.offset).toBe(455);
  });

  it('liefert null, wenn keine Wand innerhalb der Schwelle liegt', () => {
    const w = wall(0, 0, 500, 0);
    expect(placeOpeningOnWall({ x: 250, y: 60 }, [w], 90, 30)).toBeNull();
    expect(placeOpeningOnWall({ x: 250, y: 60 }, [], 90, 30)).toBeNull();
  });

  it('ignoriert versteckte und degenerierte Wände, wählt die nächste', () => {
    const hidden = wall(0, 0, 500, 0, 10, { hidden: true });
    const far = wall(0, 40, 500, 40);
    const zero = wall(250, 5, 250, 5);
    expect(placeOpeningOnWall({ x: 250, y: 5 }, [hidden, far, zero], 90, 60)!.wall.id).toBe(far.id);
  });

  it('funktioniert an Hallen-Außenwänden (hall_0)', () => {
    const floor = createFloor({ hall: createHall(1000, 800) });
    const walls = allWalls(floor);
    expect(walls.some((w) => w.id === 'hall_0')).toBe(true);
    // Obere Außenwand: Achse bei y = 12 (halbe Wandstärke 24)
    const r = placeOpeningOnWall({ x: 500, y: 20 }, walls, 100, 30, 10);
    expect(r).not.toBeNull();
    expect(r!.wall.id).toBe('hall_0');
    expect(r!.offset).toBe(490); // 500 − 12 (Achse beginnt bei x = 12), auf 10 gerundet
    expect(r!.point.y).toBeCloseTo(12);
    expect(openingFitsWall(r!.offset, 100, r!.wall)).toBe(true);
  });
});

describe('openingFitsWall / openingOverlaps', () => {
  it('Öffnung breiter als die Wand passt nicht', () => {
    const w = wall(0, 0, 80, 0);
    expect(openingFitsWall(40, 90, w)).toBe(false);
    expect(openingFitsWall(40, 80, w)).toBe(true);
    expect(openingFitsWall(30, 80, w)).toBe(false);
  });

  it('erkennt Überlappung auf derselben Wand, Berührung und andere Wände nicht', () => {
    const existing: Opening[] = [door('w1', 100, 90)];
    expect(openingOverlaps({ wallId: 'w1', offset: 150, width: 90 }, existing)?.id).toBe(existing[0].id);
    expect(openingOverlaps({ wallId: 'w1', offset: 190, width: 90 }, existing)).toBeNull(); // Kante an Kante
    expect(openingOverlaps({ wallId: 'w1', offset: 400, width: 90 }, existing)).toBeNull();
    expect(openingOverlaps({ wallId: 'w2', offset: 100, width: 90 }, existing)).toBeNull();
    // Eigene ID wird ignoriert (z. B. beim Verschieben)
    expect(openingOverlaps({ wallId: 'w1', offset: 100, width: 90, id: existing[0].id }, existing)).toBeNull();
  });
});

describe('validatePlacement', () => {
  it('meldet zu kurze Wand und Überlappung mit Begründung', () => {
    const w = wall(0, 0, 80, 0);
    const short = validatePlacement({ wall: w, offset: 40 }, 90, []);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toContain('Wand zu kurz');
    const long = wall(0, 0, 500, 0);
    const busy = validatePlacement({ wall: long, offset: 120, width: 90 } as never, 90, [door(long.id, 100, 90)]);
    expect(busy.ok).toBe(false);
    if (!busy.ok) expect(busy.reason).toContain('Überlappt');
    expect(validatePlacement({ wall: long, offset: 300 }, 90, [door(long.id, 100, 90)]).ok).toBe(true);
  });
});

describe('openingSpecFromOptions / createOpening', () => {
  it('Tür: Typ und Breite aus den Optionen, sonst Standard des Türtyps', () => {
    const def = openingSpecFromOptions('door', {});
    expect(def.doorType).toBe('einflügelig');
    expect(def.width).toBe(DOOR_TYPE_MAP['einflügelig'].defaultWidth);
    expect(def.height).toBe(DOOR_TYPE_MAP['einflügelig'].defaultHeight);
    const two = openingSpecFromOptions('door', { doorType: 'zweiflügelig' });
    expect(two.width).toBe(200);
    const custom = openingSpecFromOptions('door', { doorType: 'Notausgang', doorWidth: 125 });
    expect(custom.width).toBe(125);
    expect(openingSpecFromOptions('door', { doorType: 'Unsinn', doorWidth: -5 }).width).toBe(90);
    const d = createOpening(custom, 'o1', 'w9', 200, 'b', 'right') as Door;
    expect(d).toMatchObject({ kind: 'door', wallId: 'w9', offset: 200, width: 125, doorType: 'Notausgang', height: 210, hinge: 'right', swingSide: 'b' });
  });

  it('Fenster: Breite/Höhe/Brüstung aus windowWidth/windowHeight/windowSillHeight (Brüstung 0 erlaubt)', () => {
    const spec = openingSpecFromOptions('window', { windowWidth: 150, windowHeight: 140, windowSillHeight: 0 });
    const w = createOpening(spec, 'o2', 'w1', 100, 'a', 'left') as Window;
    expect(w).toMatchObject({ kind: 'window', width: 150, height: 140, sillHeight: 0 });
    const def = openingSpecFromOptions('window', {});
    expect(def).toMatchObject({ width: WINDOW_DEFAULT.width, height: WINDOW_DEFAULT.height, sillHeight: WINDOW_DEFAULT.sillHeight });
  });

  it('Spiegel: Länge aus mirrorLength, Höhe aus mirrorHeight, Seite = Cursorseite', () => {
    const spec = openingSpecFromOptions('mirror', { mirrorLength: 350, mirrorHeight: 180 });
    const m = createOpening(spec, 'o3', 'w1', 300, 'b', 'left');
    expect(m).toMatchObject({ kind: 'mirror', width: 350, height: 180, side: 'b' });
    expect(openingSpecFromOptions('mirror', {}).width).toBe(MIRROR_DEFAULT.width);
  });

  it('Hallenwand: Tür passt und überlappt nicht mit Fenster daneben', () => {
    const floor = createFloor({ hall: createHall(1000, 800) });
    const walls = allWalls(floor);
    const pl = placeOpeningOnWall({ x: 300, y: 0 }, walls, 90, 30, 10)!;
    const win = createOpening(openingSpecFromOptions('window', {}), 'win', 'hall_0', 600, 'a', 'left');
    expect(validatePlacement(pl, 90, [win]).ok).toBe(true);
    expect(wallLength(pl.wall)).toBeCloseTo(976);
  });
});
