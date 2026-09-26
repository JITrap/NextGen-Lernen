import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeCosts, validateAndMigrate, migrateProject, validateProject } from './migrate';
import { useProjectStore, undo, redo } from './projectStore';
import { createEmptyProject } from './factories';
import { DEFAULT_COST_ASSUMPTIONS } from '@/analysis/costs';

describe('Kosten-Annahmen: Validierung und Migration', () => {
  it('sanitizeCosts übernimmt nur bekannte Schlüssel mit Zahlen ≥ 0', () => {
    expect(sanitizeCosts(undefined)).toBeUndefined();
    expect(sanitizeCosts(null)).toBeUndefined();
    expect(sanitizeCosts('x')).toBeUndefined();
    expect(sanitizeCosts({})).toBeUndefined();
    expect(sanitizeCosts({ unbekannt: 5, ausbauEurM2: -1, mieteEurM2Monat: 'a', zinsProzent: Number.NaN })).toBeUndefined();
    expect(sanitizeCosts({ ausbauEurM2: 400, unbekannt: 5, mieteEurM2Monat: -3, zinsProzent: 0 })).toEqual({ ausbauEurM2: 400, zinsProzent: 0 });
  });

  it('verwirft __proto__/constructor in costs und behält gültige Werte', () => {
    const raw = JSON.parse('{"id":"p","name":"X","floors":[{"id":"f","name":"EG"}],"costs":{"__proto__":{"polluted":1},"constructor":{"x":1},"ausbauEurM2":420,"kaputt":"x"}}') as unknown;
    const r = validateAndMigrate(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.costs).toEqual({ ausbauEurM2: 420 });
      expect(Object.getPrototypeOf(r.project.costs)).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
  });

  it('costs muss ein Objekt sein; fehlende/leere costs → Feld entfällt', () => {
    const bad = validateProject({ id: 'p', name: 'X', floors: [{ id: 'f', name: 'EG' }], costs: 5 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join(' ')).toContain('project.costs');
    const r = validateAndMigrate({ id: 'p', name: 'X', floors: [{ id: 'f', name: 'EG' }], costs: { nichts: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect('costs' in r.project).toBe(false);
  });

  it('vollständiges Projekt mit sauberen costs bleibt referenzgleich, unsaubere werden bereinigt', () => {
    const p = createEmptyProject('A');
    p.costs = { ausbauEurM2: 300 };
    expect(migrateProject(p)).toBe(p);
    const dirty = { ...p, costs: { ausbauEurM2: 300, fremd: 1 } } as unknown as typeof p;
    const m = migrateProject(dirty);
    expect(m).not.toBe(dirty);
    expect(m.costs).toEqual({ ausbauEurM2: 300 });
    const empty = { ...p, costs: {} } as typeof p;
    expect('costs' in migrateProject(empty)).toBe(false);
  });
});

describe('Store: updateCosts / resetCosts', () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject('Kosten'));
    useProjectStore.temporal.getState().clear();
  });

  it('updateCosts speichert nur gültige Werte, identischer Patch ist kein Undo-Schritt', () => {
    const s = useProjectStore.getState();
    s.updateCosts({ ausbauEurM2: 400, mieteEurM2Monat: -5 } as never);
    expect(useProjectStore.getState().project.costs).toEqual({ ausbauEurM2: 400 });
    const ref = useProjectStore.getState().project;
    const pastLen = useProjectStore.temporal.getState().pastStates.length;
    useProjectStore.getState().updateCosts({ ausbauEurM2: 400 });
    expect(useProjectStore.getState().project).toBe(ref);
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(pastLen);
    useProjectStore.getState().updateCosts({ unbekannt: 1 } as never);
    expect(useProjectStore.getState().project).toBe(ref);
    useProjectStore.getState().updateCosts({ zinsProzent: 4.5 });
    expect(useProjectStore.getState().project.costs).toEqual({ ausbauEurM2: 400, zinsProzent: 4.5 });
  });

  it('resetCosts entfernt die Annahmen; Undo stellt sie wieder her', () => {
    useProjectStore.getState().updateCosts({ personalEurMonat: 20000 });
    expect(useProjectStore.getState().project.costs).toEqual({ personalEurMonat: 20000 });
    useProjectStore.getState().resetCosts();
    expect(useProjectStore.getState().project.costs).toBeUndefined();
    const ref = useProjectStore.getState().project;
    useProjectStore.getState().resetCosts();
    expect(useProjectStore.getState().project).toBe(ref);
    undo();
    expect(useProjectStore.getState().project.costs).toEqual({ personalEurMonat: 20000 });
    redo();
    expect(useProjectStore.getState().project.costs).toBeUndefined();
    expect(DEFAULT_COST_ASSUMPTIONS.personalEurMonat).toBeGreaterThan(0);
  });
});
