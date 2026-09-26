import { describe, it, expect } from 'vitest';
import type { Door, Project, Vec2, Wall } from '@/types';
import { createEmptyProject, createHall, createWall, createItemFromDef } from '@/store/factories';
import { getDef } from '@/data/equipment';
import { getTemplate } from '@/data/templates';
import { allWalls, openingPlacement, findWall } from '@/geometry/walls';
import {
  regulations, regulationChecksFor, countRegulationChecks, sortRegulationChecks, requiredExitWidthCm, requiredExtinguisherLe,
  requiredStaffToilets, requiredFirstAiders, requiredFireWardens, gridPointsInRoom, worstDistanceInRoom, worstStatus, escapeRouteStatus,
  REGULATION_RULES, STAFF_DEFAULT, THEMA, DEF_EXIT_LIGHT, DEF_ESCAPE_PLAN, type RegulationCheck,
} from './regulations';
import { emergencyExitsOf, polylineLength, insertPolylinePoint, removePolylinePoint, corridorPolygon, wallCrossings, exitSnap } from '@/geometry/escapeRoutes';
import { regulationRows } from '@/export/pdfRegulations';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

let n = 0;
function door(wallId: string, offset: number, width = 100, extra: Partial<Door> = {}): Door {
  return { id: `d${++n}`, kind: 'door', wallId, offset, width, doorType: 'Notausgang', height: 210, hinge: 'left', swingSide: 'a', ...extra };
}
function put(project: Project, defId: string, x: number, y: number, extra: Parameters<typeof createItemFromDef>[3] = {}) {
  const def = getDef(defId)!;
  expect(def, defId).toBeDefined();
  const it = createItemFromDef(def, x, y, extra);
  project.floors[0].items.push(it);
  return it;
}
function doorCenter(project: Project, d: Door): Vec2 {
  const floor = project.floors[0];
  return openingPlacement(d, findWall(floor, d.wallId)!).center;
}
function checks(project: Project, pred: (c: RegulationCheck) => boolean): RegulationCheck[] {
  return regulations(project).checks.filter(pred);
}
function one(project: Project, idPrefix: string): RegulationCheck {
  const list = checks(project, (c) => c.id.startsWith(idPrefix));
  expect(list.length, idPrefix).toBe(1);
  return list[0];
}

/** Leere Halle 20 × 15 m (Außenwand 24 cm). */
function hallProject(): Project {
  const p = createEmptyProject('Test');
  p.floors[0].hall = createHall(2000, 1500);
  return p;
}

/** Halle mit zwei Notausgängen (oben bei x≈500, unten bei x≈1500), voller Sicherheitsausstattung. */
function equippedProject(): { project: Project; top: Door; bottom: Door } {
  const p = hallProject();
  const f = p.floors[0];
  const top = door('hall_0', 500);
  const bottom = door('hall_2', 500); // hall_2 läuft von rechts nach links → offset 500 ≈ x 1500
  f.openings.push(top, bottom);
  const ct = doorCenter(p, top);
  const cb = doorCenter(p, bottom);
  // Feuerlöscher (3 × 6 LE = 18 ≥ 15 LE für 300 m²), so verteilt, dass kein Punkt weiter als 20 m entfernt ist
  put(p, 'gen-ausstattung-feuerloescher', 300, 40);
  put(p, 'gen-ausstattung-feuerloescher', 1700, 40);
  put(p, 'gen-ausstattung-feuerloescher', 1000, 1460);
  put(p, 'gen-ausstattung-erste-hilfe', 1200, 40);
  put(p, 'gen-ausstattung-aed', 1300, 40);
  put(p, 'gen-ausstattung-notausgang-schild', ct.x + 80, ct.y + 20);
  put(p, 'gen-ausstattung-notausgang-schild', cb.x + 80, cb.y - 20);
  put(p, DEF_EXIT_LIGHT, ct.x - 80, ct.y + 20);
  put(p, DEF_EXIT_LIGHT, cb.x - 80, cb.y - 20);
  put(p, DEF_ESCAPE_PLAN, 1400, 40);
  put(p, 'gen-sanitaer-wc-barrierefrei', 1800, 1300);
  return { project: p, top, bottom };
}

/* ------------------------------------------------------------------ */
/* Regelfunktionen                                                     */
/* ------------------------------------------------------------------ */

describe('Regeltabellen (ASR A2.3 Tabelle 1, ASR A2.2 Tabelle 3, ASR A4.1, DGUV V1)', () => {
  it('Sollbreite der Ausgänge nach Personenzahl', () => {
    expect(requiredExitWidthCm(0)).toBe(87.5);
    expect(requiredExitWidthCm(5)).toBe(87.5);
    expect(requiredExitWidthCm(6)).toBe(100);
    expect(requiredExitWidthCm(20)).toBe(100);
    expect(requiredExitWidthCm(66)).toBe(120);
    expect(requiredExitWidthCm(200)).toBe(120);
    expect(requiredExitWidthCm(250)).toBe(180);
    expect(requiredExitWidthCm(400)).toBe(240);
    expect(requiredExitWidthCm(500)).toBe(300);
    expect(requiredExitWidthCm(650)).toBe(420);
  });
  it('Löschmitteleinheiten nach Grundfläche', () => {
    expect(requiredExtinguisherLe(0)).toBe(6);
    expect(requiredExtinguisherLe(50)).toBe(6);
    expect(requiredExtinguisherLe(51)).toBe(9);
    expect(requiredExtinguisherLe(283)).toBe(15);
    expect(requiredExtinguisherLe(1000)).toBe(36);
    expect(requiredExtinguisherLe(1250)).toBe(42);
    expect(requiredExtinguisherLe(1251)).toBe(48);
  });
  it('Beschäftigten-Toiletten, Ersthelfer, Brandschutzhelfer', () => {
    expect(requiredStaffToilets(STAFF_DEFAULT)).toBe(1);
    expect(requiredStaffToilets(25)).toBe(2);
    expect(requiredFirstAiders(1)).toBe(0);
    expect(requiredFirstAiders(6)).toBe(1);
    expect(requiredFirstAiders(30)).toBe(3);
    expect(requiredFireWardens(6)).toBe(1);
    expect(requiredFireWardens(100)).toBe(5);
  });
  it('worstStatus liefert den schwersten Status', () => {
    expect(worstStatus([])).toBe('na');
    expect(worstStatus(['ok', 'info'])).toBe('info');
    expect(worstStatus(['ok', 'warn', 'fail'])).toBe('fail');
  });
});

describe('Rasterpunkte', () => {
  const room = { polygon: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], centroid: { x: 100, y: 50 } };
  it('liegt das 50-cm-Raster im Raum', () => {
    const pts = gridPointsInRoom(room, 50);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(200);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });
  it('kleiner Raum ohne Rasterpunkt → Schwerpunkt', () => {
    const tiny = { polygon: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }], centroid: { x: 15, y: 15 } };
    expect(gridPointsInRoom(tiny, 50)).toEqual([{ x: 15, y: 15 }]);
  });
  it('schlimmster Punkt ist der am weitesten vom Ziel entfernte', () => {
    const w = worstDistanceInRoom(room, [{ x: 0, y: 50 }], 50);
    expect(w).not.toBeNull();
    expect(w!.point.x).toBe(200);
    expect(worstDistanceInRoom(room, [])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Geometrie-Helfer                                                    */
/* ------------------------------------------------------------------ */

describe('Fluchtweg-Geometrie', () => {
  it('Notausgänge: Notausgangstüren und aufschlagende Türen in Hallenwänden, keine Rolltore', () => {
    const p = hallProject();
    const f = p.floors[0];
    const inner = createWall({ id: 'wi', start: { x: 1000, y: 100 }, end: { x: 1000, y: 800 } });
    f.walls.push(inner);
    f.openings.push(door('hall_0', 300), door('hall_1', 300, 300, { doorType: 'Rolltor' }), door('hall_2', 300, 90, { doorType: 'einflügelig' }), door('wi', 200, 90, { doorType: 'einflügelig' }), door('wi', 500, 90));
    const exits = emergencyExitsOf(f);
    expect(exits.map((e) => e.door.wallId)).toEqual(['hall_0', 'hall_2', 'wi']);
    expect(exits[0].onHallWall).toBe(true);
    expect(exits[2].onHallWall).toBe(false);
    expect(exits[2].typed).toBe(true);
  });
  it('polylineLength, Punkt einfügen/entfernen', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    expect(polylineLength(pts)).toBe(200);
    const ins = insertPolylinePoint(pts, { x: 50, y: 10 });
    expect(ins.index).toBe(1);
    expect(ins.points[1]).toEqual({ x: 50, y: 0 });
    expect(ins.points).toHaveLength(4);
    expect(removePolylinePoint(pts, 1)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 100 }]);
    expect(removePolylinePoint([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0)).toHaveLength(2);
    expect(insertPolylinePoint([{ x: 0, y: 0 }], { x: 5, y: 5 })).toEqual({ points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], index: 1 });
  });
  it('corridorPolygon ist ein Rechteck der Breite w um das Segment', () => {
    const r = corridorPolygon({ x: 0, y: 0 }, { x: 100, y: 0 }, 120);
    expect(r).toHaveLength(4);
    expect(r).toEqual(expect.arrayContaining([{ x: 0, y: -60 }, { x: 0, y: 60 }, { x: 100, y: 60 }, { x: 100, y: -60 }]));
    expect(corridorPolygon({ x: 0, y: 0 }, { x: 0, y: 0 }, 120)).toEqual([]);
  });
  it('wallCrossings: Wand ohne Tür wird gemeldet, Durchgang durch die Tür nicht', () => {
    const p = hallProject();
    const f = p.floors[0];
    const w: Wall = createWall({ id: 'wi', start: { x: 1000, y: 0 }, end: { x: 1000, y: 1500 } });
    f.walls.push(w);
    const route = [{ x: 500, y: 700 }, { x: 1500, y: 700 }];
    expect(wallCrossings(route, f)).toHaveLength(1);
    expect(wallCrossings(route, f)[0].wallId).toBe('wi');
    f.openings.push(door('wi', 700, 100, { doorType: 'einflügelig' }));
    expect(wallCrossings(route, f)).toHaveLength(0);
    // Hallenwand nach außen ohne Tür
    expect(wallCrossings([{ x: 500, y: 700 }, { x: 500, y: -100 }], f)).toHaveLength(1);
  });
  it('exitSnap rastet nur innerhalb des Fangabstands', () => {
    const p = hallProject();
    const d = door('hall_0', 500);
    p.floors[0].openings.push(d);
    const exits = emergencyExitsOf(p.floors[0]);
    const c = doorCenter(p, d);
    expect(exitSnap({ x: c.x + 30, y: c.y + 40 }, exits, 60)?.door.id).toBe(d.id);
    expect(exitSnap({ x: c.x + 100, y: c.y }, exits, 60)).toBeNull();
    expect(exitSnap(c, [], 60)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Prüfungen                                                           */
/* ------------------------------------------------------------------ */

describe('Regularien-Prüfung: leere Halle', () => {
  const p = hallProject();
  const r = regulations(p);
  it('Bemessungspersonen = Kapazität + Beschäftigte', () => {
    expect(r.staff).toBe(STAFF_DEFAULT);
    expect(r.persons).toBe(r.trainees + STAFF_DEFAULT);
  });
  it('ohne Notausgang: Anzahl und Fluchtweglänge nicht erfüllt', () => {
    expect(one(p, 'exits:count:').status).toBe('fail');
    const len = checks(p, (c) => c.id.startsWith('escape-length:'));
    expect(len.length).toBeGreaterThanOrEqual(1);
    expect(len.every((c) => c.status === 'fail' && c.ist === 'kein Notausgang')).toBe(true);
  });
  it('fehlende Ausstattung wird gemeldet', () => {
    expect(one(p, 'fire:le:').status).toBe('fail');
    expect(one(p, 'fire:distance:').status).toBe('fail');
    expect(one(p, 'firstaid:f').status).toBe('fail');
    expect(one(p, 'firstaid:aed').status).toBe('warn');
    expect(one(p, 'access:wc').status).toBe('warn');
    expect(one(p, 'orga:escape-plan').status).toBe('info');
    expect(one(p, 'assembly').status).toBe('na');
  });
  it('jede Prüfung hat Thema, Ist, Soll, Erläuterung und Quelle; Zähler stimmen', () => {
    for (const c of r.checks) {
      expect(c.thema).toBeTruthy();
      expect(c.titel).toBeTruthy();
      expect(c.ist).toBeTruthy();
      expect(c.soll).toBeTruthy();
      expect(c.erlaeuterung.length).toBeGreaterThan(20);
      expect(c.quelle).toBeTruthy();
      expect(c.quelleUrl).toMatch(/^https:\/\//);
    }
    expect(r.counts).toEqual(countRegulationChecks(r.checks));
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(r.checks.length);
    expect(sortRegulationChecks(r.checks).map((c) => c.id)).toEqual(r.checks.map((c) => c.id));
  });
  it('ist am Projekt-Objekt memoisiert', () => {
    expect(regulations(p)).toBe(r);
  });
});

describe('Regularien-Prüfung: ausgestattete Halle', () => {
  const { project: p, top, bottom } = equippedProject();
  const r = regulations(p);
  it('keine Prüfung „nicht erfüllt“', () => {
    expect(r.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.ist}`)).toEqual([]);
  });
  it('Notausgänge, Breiten, Aufschlagrichtung erfüllt', () => {
    expect(one(p, 'exits:count:').status).toBe('ok');
    expect(one(p, 'exits:width:').status).toBe('ok');
    expect(one(p, `exit:${top.id}:width`).status).toBe('ok');
    expect(one(p, `exit:${top.id}:swing`).status).toBe('ok');
    expect(one(p, `exit:${bottom.id}:swing`).ist).toContain('außen');
  });
  it('Fluchtweglänge, Feuerlöscher, Erste Hilfe, Kennzeichnung, Barrierefreiheit erfüllt', () => {
    expect(checks(p, (c) => c.id.startsWith('escape-length:')).every((c) => c.status === 'ok')).toBe(true);
    expect(one(p, 'fire:le:').status).toBe('ok');
    expect(one(p, 'fire:distance:').status).toBe('ok');
    expect(one(p, 'firstaid:f').status).toBe('ok');
    expect(one(p, 'firstaid:aed').status).toBe('ok');
    expect(one(p, `sign:${top.id}`).status).toBe('ok');
    expect(one(p, `light:${bottom.id}`).status).toBe('ok');
    expect(one(p, 'access:wc').status).toBe('ok');
    expect(one(p, 'orga:escape-plan').status).toBe('ok');
    expect(one(p, 'equipment:clearance').status).toBe('ok');
  });
  it('Schiebetür als Notausgang und nach innen aufschlagende Tür werden gemeldet', () => {
    const q = equippedProject().project;
    const f = q.floors[0];
    const slide = door('hall_1', 400, 125, { doorType: 'Schiebetür' });
    const inward = door('hall_3', 400, 100, { swingSide: 'b' });
    f.openings.push(slide, inward);
    // Schiebetür ist kein Notausgang (zählt nicht), typisierter Notausgang mit Schiebe-Typ ist nicht möglich → als „Notausgang“ typisiert testen
    const slideTyped = { ...slide, id: 'slide-typed', doorType: 'Rolltor' as const, wallId: 'hall_1', offset: 900 };
    f.openings.push(slideTyped);
    const exits = emergencyExitsOf(f);
    expect(exits.some((e) => e.door.id === slide.id)).toBe(false);
    expect(one(q, `exit:${inward.id}:swing`).status).toBe('warn');
    expect(one(q, `exit:${inward.id}:swing`).ist).toContain('innen');
  });
  it('zu schmale Notausgangstür → nicht erfüllt', () => {
    const q = equippedProject().project;
    const narrow = door('hall_1', 400, 80);
    q.floors[0].openings.push(narrow);
    expect(one(q, `exit:${narrow.id}:width`).status).toBe('fail');
  });
  it('Löschmitteleinheiten: mit 10-LE-Geräten erreichbar → prüfen, sonst nicht erfüllt; params.le zählt', () => {
    const q = hallProject();
    q.floors[0].openings.push(door('hall_0', 500));
    put(q, 'gen-ausstattung-feuerloescher', 300, 40);
    put(q, 'gen-ausstattung-feuerloescher', 1700, 40); // 12 LE < 15, 20 LE ≥ 15
    expect(one(q, 'fire:le:').status).toBe('warn');
    const q2 = hallProject();
    q2.floors[0].openings.push(door('hall_0', 500));
    put(q2, 'gen-ausstattung-feuerloescher', 300, 40);
    expect(one(q2, 'fire:le:').status).toBe('fail');
    const q3 = hallProject();
    q3.floors[0].openings.push(door('hall_0', 500));
    put(q3, 'gen-ausstattung-feuerloescher', 300, 40, { params: { le: 21 } });
    expect(one(q3, 'fire:le:').status).toBe('ok');
  });
  it('Entfernung zum Feuerlöscher > 20 m → nicht erfüllt, Ziel ist der schlimmste Punkt', () => {
    const q = hallProject();
    q.floors[0].hall = createHall(4000, 1500);
    q.floors[0].openings.push(door('hall_0', 500));
    put(q, 'gen-ausstattung-feuerloescher', 100, 40);
    const c = one(q, 'fire:distance:');
    expect(c.status).toBe('fail');
    expect(c.target && 'point' in c.target && c.target.point.x > 3000).toBe(true);
  });
  it('Fluchtweglänge > 35 m → nicht erfüllt, > 30 m → prüfen', () => {
    const q = hallProject();
    q.floors[0].hall = createHall(5000, 1000);
    q.floors[0].openings.push(door('hall_3', 500)); // linke Wand
    const c = checks(q, (x) => x.id.startsWith('escape-length:'))[0];
    expect(c.status).toBe('fail');
    expect(c.target && 'point' in c.target && c.target.point.x > 4000).toBe(true);
    const q2 = hallProject();
    q2.floors[0].hall = createHall(3300, 600);
    q2.floors[0].openings.push(door('hall_3', 300));
    expect(checks(q2, (x) => x.id.startsWith('escape-length:'))[0].status).toBe('warn');
  });
  it('zweiter Rettungsweg ab 200 m²', () => {
    const q = hallProject();
    q.floors[0].openings.push(door('hall_0', 500));
    expect(one(q, 'exits:count:').status).toBe('fail');
    const small = createEmptyProject();
    small.floors[0].hall = createHall(1200, 1200);
    small.floors[0].openings.push(door('hall_0', 500));
    expect(one(small, 'exits:count:').status).toBe('ok');
  });
  it('Versammlungsstätte ab 200 Personen', () => {
    const q = hallProject();
    q.floors[0].hall = createHall(6000, 4000);
    q.floors[0].openings.push(door('hall_0', 500), door('hall_2', 500));
    put(q, 'gen-ausstattung-feuerloescher', 300, 40);
    expect(regulations(q).persons).toBeGreaterThan(200);
    expect(one(q, 'assembly').status).toBe('info');
  });
  it('Umfang: aktives Stockwerk filtert stockwerksbezogene Prüfungen', () => {
    const all = regulationChecksFor(r, 'all', p.activeFloorId);
    expect(all).toBe(r.checks);
    const active = regulationChecksFor(r, 'active', 'unbekannt');
    expect(active.every((c) => !c.floorId)).toBe(true);
    expect(active.some((c) => c.id === 'assembly')).toBe(true);
  });
});

describe('Regularien-Prüfung: gezeichnete Fluchtwege', () => {
  function withRoute(points: Vec2[] | ((center: Vec2) => Vec2[]), mutate?: (p: Project) => void) {
    const { project, top } = equippedProject();
    const center = doorCenter(project, top);
    project.floors[0].annotations.push({ id: 'route1', kind: 'escape-route', points: typeof points === 'function' ? points(center) : points, label: 'Weg A' });
    mutate?.(project);
    return { project, top, center };
  }
  it('Fluchtweg bis zur Tür: alle vier Prüfungen erfüllt, Status ok', () => {
    const { project: p } = withRoute((center) => [{ x: 1600, y: 1300 }, { x: 1600, y: 300 }, center]);
    const list = checks(p, (c) => c.id.startsWith('route:route1:'));
    expect(list.map((c) => c.status)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(list.every((c) => c.thema === THEMA.flucht && c.titel.startsWith('Weg A: '))).toBe(true);
    expect(escapeRouteStatus(p, 'route1')).toBe('ok');
    expect(escapeRouteStatus(p, 'nix')).toBe('na');
  });
  it('Endpunkt fern vom Notausgang → nicht erfüllt', () => {
    const { project: p } = withRoute([{ x: 1600, y: 1300 }, { x: 1000, y: 700 }]);
    const c = one(p, 'route:route1:end');
    expect(c.status).toBe('fail');
    expect(regulations(p).routes.route1).toBe('fail');
  });
  it('zu lange Lauflänge → nicht erfüllt', () => {
    const { project: p } = withRoute((center) => [{ x: 100, y: 1400 }, { x: 1900, y: 1400 }, { x: 100, y: 1300 }, { x: 1900, y: 1200 }, center]);
    const c = one(p, 'route:route1:length');
    expect(c.status).toBe('fail');
    expect(c.ist).toMatch(/Lauflänge/);
  });
  it('Objekt im Korridor → nicht erfüllt mit Objektname als Ziel', () => {
    const { project: p } = withRoute([{ x: 1600, y: 1300 }, { x: 1600, y: 300 }, { x: 512, y: 12 }], (q) => {
      put(q, 'gen-freihantel-kurzhantel-rack', 1600, 800);
    });
    const c = one(p, 'route:route1:corridor');
    expect(c.status).toBe('fail');
    expect(c.target && 'kind' in c.target && c.target.kind).toBe('item');
    expect(c.ist).toMatch(/Objekt/);
  });
  it('Wanddurchdringung ohne Tür → nicht erfüllt; mit Tür erfüllt', () => {
    const mk = (withDoor: boolean) => withRoute([{ x: 1800, y: 700 }, { x: 600, y: 700 }, { x: 512, y: 12 }], (q) => {
      const w = createWall({ id: 'wi', start: { x: 1000, y: 0 }, end: { x: 1000, y: 1500 } });
      q.floors[0].walls.push(w);
      if (withDoor) q.floors[0].openings.push(door('wi', 700, 100, { doorType: 'einflügelig' }));
    });
    expect(one(mk(false).project, 'route:route1:walls').status).toBe('fail');
    expect(one(mk(true).project, 'route:route1:walls').status).toBe('ok');
  });
  it('ausgeblendete Fluchtwege werden nicht geprüft', () => {
    const { project: p } = withRoute([{ x: 1600, y: 1300 }, { x: 1000, y: 700 }], (q) => { q.floors[0].annotations[0].hidden = true; });
    expect(checks(p, (c) => c.id.startsWith('route:'))).toHaveLength(0);
  });
});

describe('Vorlagen', () => {
  it('Beispielstudio 1.000 m²: keine Prüfung „nicht erfüllt“', () => {
    const p = getTemplate('beispiel-1000')!.create();
    const r = regulations(p);
    expect(r.checks.filter((c) => c.status === 'fail').map((c) => `${c.titel}: ${c.ist}`)).toEqual([]);
    expect(r.persons).toBeGreaterThan(STAFF_DEFAULT);
    expect(allWalls(p.floors[0]).length).toBeGreaterThan(4);
  });
  it('alle Vorlagen liefern eine vollständige Prüfung', () => {
    for (const id of ['empty-20x25', 'studio-400', 'studio-800']) {
      const r = regulations(getTemplate(id)!.create());
      expect(r.checks.length, id).toBeGreaterThan(10);
      expect(r.checks.some((c) => c.thema === THEMA.orga), id).toBe(true);
    }
  });
});

describe('PDF-Zeilen', () => {
  it('regulationRows liefert sechs Spalten je Prüfung', () => {
    const p = getTemplate('beispiel-1000')!.create();
    const rows = regulationRows(p);
    expect(rows.length).toBe(regulations(p).checks.length);
    for (const r of rows) expect(r).toHaveLength(6);
    expect(rows[0][0]).toBe(THEMA.flucht);
  });
  it('REGULATION_RULES ist vollständig', () => {
    expect(REGULATION_RULES.fluchtweglaengeM).toBe(35);
    expect(REGULATION_RULES.lauflaengeFaktor).toBe(1.5);
    expect(REGULATION_RULES.ausgangsbreite.length).toBe(5);
    expect(REGULATION_RULES.loeschmittel.length).toBe(11);
  });
});
