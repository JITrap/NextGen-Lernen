/**
 * Prüft die ausgelieferten Projektdateien in examples/: Sie müssen sich per parseProjectDetailed laden lassen.
 * Für „No1-ueberarbeitet“ (überarbeitetes Nutzerprojekt, siehe docs/no1-ueberarbeitung.md) gelten zusätzlich die
 * Planungsziele: nur die Info „Maße ungeprüft“, Regularien ohne „nicht erfüllt“/„prüfen“, Kapazität erfüllt,
 * alle automatisch erkannten Räume typisiert. Die Vorlagendatei wird nur auf Ladbarkeit und Kollisionsfreiheit geprüft.
 */
import { describe, it, expect } from 'vitest';
import { parseProjectDetailed } from '@/export/json';
import { warnings, regulations, capacity, areaBalance, costs } from '@/analysis';
import { emergencyExitsOf } from '@/geometry/escapeRoutes';
import { floorRooms } from '@/geometry/rooms';
import { getDef } from '@/data/equipment';

import beispielJson from '../../examples/Beispielstudio-1000.gymplanner.json';
import no1Json from '../../examples/No1-ueberarbeitet.gymplanner.json';

/** Lädt wie der Import in der App: aus dem Dateitext (Umschlag { format, project }). */
const load = (raw: unknown) => parseProjectDetailed(JSON.stringify(raw));

describe('examples/Beispielstudio-1000.gymplanner.json', () => {
  it('lässt sich ohne Fehler laden und hat keine Kollisionen', () => {
    const { project, warnings: parseWarnings } = load(beispielJson);
    expect(parseWarnings).toEqual([]);
    expect(project.floors.length).toBeGreaterThan(0);
    expect(warnings(project).filter((w) => w.kind === 'collision')).toEqual([]);
  });
});

describe('examples/No1-ueberarbeitet.gymplanner.json', () => {
  const { project, warnings: parseWarnings } = load(no1Json);
  const floor = project.floors[0];

  it('lädt ohne Hinweise, alle Bibliotheks-IDs bekannt', () => {
    expect(parseWarnings).toEqual([]);
    expect(project.floors.length).toBe(1);
    for (const it of floor.items) expect(getDef(it.defId, project), it.defId).toBeDefined();
  });

  it('Planungs-Warnungen: nur die Info „Maße ungeprüft“', () => {
    const list = warnings(project);
    expect(list.filter((w) => w.kind !== 'unverified')).toEqual([]);
    expect(list.every((w) => w.severity === 'info')).toBe(true);
  });

  it('Regularien: keine Prüfung „nicht erfüllt“ oder „prüfen“', () => {
    const r = regulations(project);
    const open = r.checks.filter((c) => c.status === 'fail' || c.status === 'warn').map((c) => `${c.status}: ${c.titel}`);
    expect(open).toEqual([]);
    expect(r.counts.fail).toBe(0);
    expect(r.counts.warn).toBe(0);
    expect(Object.values(r.routes).every((s) => s === 'ok')).toBe(true);
  });

  it('Kapazität erfüllt (Spinde, Duschen, WCs) und ≥ 120 Spindfächer', () => {
    const cap = capacity(project);
    expect(cap.counters.map((c) => c.status)).toEqual(['ok', 'ok', 'ok']);
    expect(cap.lockers).toBeGreaterThanOrEqual(120);
    expect(cap.lockers).toBeGreaterThanOrEqual(cap.persons);
  });

  it('Flächenbilanz: alle automatisch erkannten Räume typisiert', () => {
    const ab = areaBalance(project);
    expect(ab.total.untypedRoomCount).toBe(0);
    expect(floorRooms(floor).filter((r) => r.source === 'auto' && r.type === 'Sonstiges')).toEqual([]);
  });

  it('Sicherheit: ≥ 5 Notausgänge an Außenwänden, ≥ 10 Feuerlöscher, AED, Erste Hilfe, Fluchtplan, ≥ 8 Fluchtwege', () => {
    const exits = emergencyExitsOf(floor);
    expect(exits.length).toBeGreaterThanOrEqual(5);
    expect(exits.every((e) => e.onHallWall)).toBe(true);
    const count = (id: string) => floor.items.filter((it) => it.defId === id).length;
    expect(count('gen-ausstattung-feuerloescher')).toBeGreaterThanOrEqual(10);
    expect(count('gen-ausstattung-aed')).toBeGreaterThanOrEqual(1);
    expect(count('gen-ausstattung-erste-hilfe')).toBeGreaterThanOrEqual(2);
    expect(count('gen-ausstattung-fluchtplan')).toBeGreaterThanOrEqual(1);
    expect(count('gen-sanitaer-wc-barrierefrei')).toBeGreaterThanOrEqual(1);
    expect(floor.annotations.filter((a) => a.kind === 'escape-route').length).toBeGreaterThanOrEqual(8);
  });

  it('Rack-Module sind angedockt, Kosten sind bepreist', () => {
    for (const it of floor.items) {
      if (getDef(it.defId, project)?.nur_an_rack) expect(floor.items.some((o) => o.id === it.dockedTo), it.defId).toBe(true);
    }
    const co = costs(project);
    expect(co.itemsWithoutPrice).toBe(0);
    expect(co.geraeteSummeEur).toBeGreaterThan(400000);
  });
});
