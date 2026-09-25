import { describe, it, expect } from 'vitest';
import { validateProject, migrateProject, validateAndMigrate } from './migrate';
import { createEmptyProject, createHall, createWall, createZone, createItemFromDef, SCHEMA_VERSION, DEFAULT_SETTINGS, DEFAULT_LAYERS } from './factories';
import { getDef } from '@/data/equipment';
import type { Project } from '@/types';

function sampleProject(): Project {
  const p = createEmptyProject('Beispiel');
  const f = p.floors[0];
  f.hall = createHall(2500, 2000);
  f.walls.push(createWall({ start: { x: 100, y: 100 }, end: { x: 900, y: 100 } }));
  f.zones.push(createZone({ polygon: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 500 }, { x: 0, y: 500 }], name: 'Cardio', type: 'Cardio' }));
  f.items.push(createItemFromDef(getDef('atlantis-a301')!, 300, 300));
  return p;
}

describe('validateProject', () => {
  it('akzeptiert ein vollständiges Projekt ohne Warnungen', () => {
    const r = validateProject(sampleProject());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  it('lehnt Nicht-Objekte und fehlende Pflichtfelder mit deutschen Meldungen ab', () => {
    expect(validateProject(null).ok).toBe(false);
    expect(validateProject('x').ok).toBe(false);
    const r = validateProject({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith('project.id'))).toBe(true);
      expect(r.errors.some((e) => e.startsWith('project.name'))).toBe(true);
      expect(r.errors.some((e) => e.includes('Stockwerke'))).toBe(true);
    }
    const empty = validateProject({ id: 'p', name: 'x', floors: [] });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors[0]).toContain('mindestens ein Stockwerk');
  });

  it('meldet Fehler mit Pfad in verschachtelten Strukturen', () => {
    const p = sampleProject() as unknown as Record<string, unknown>;
    const floors = p.floors as Array<Record<string, unknown>>;
    const walls = floors[0].walls as Array<Record<string, unknown>>;
    walls[0].thickness = -5;
    const items = floors[0].items as Array<Record<string, unknown>>;
    items[0].x = 'abc';
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(expect.stringContaining('project.floors[0].walls[0].thickness'));
      expect(r.errors).toContainEqual(expect.stringContaining('project.floors[0].items[0].x'));
    }
  });

  it('prüft Öffnungen und Anmerkungen', () => {
    const p = sampleProject();
    p.floors[0].openings.push({ id: 'o1', kind: 'door', wallId: p.floors[0].walls[0].id, offset: 200, width: 90, doorType: 'einflügelig', height: 210, hinge: 'left', swingSide: 'a' });
    p.floors[0].annotations.push({ id: 'a1', kind: 'measure', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } });
    expect(validateProject(p).ok).toBe(true);
    const bad = structuredClone(p) as unknown as { floors: Array<{ openings: Array<Record<string, unknown>> }> };
    bad.floors[0].openings[0].hinge = 'mitte';
    const r = validateProject(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('hinge');
  });

  it('erlaubt unbekannte Geräte-IDs und listet sie als Warnung', () => {
    const p = sampleProject();
    p.floors[0].items[0].defId = 'gibt-es-nicht';
    const r = validateProject(p);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.length).toBe(1);
      expect(r.warnings[0]).toContain('gibt-es-nicht');
    }
  });

  it('warnt bei neuerer Schema-Version, lehnt aber nicht ab', () => {
    const p = sampleProject();
    p.schemaVersion = SCHEMA_VERSION + 5;
    const r = validateProject(p);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings[0]).toContain('neueren Programmversion');
  });
});

describe('migrateProject', () => {
  it('gibt ein vollständiges Projekt unverändert (gleiche Referenz) zurück', () => {
    const p = sampleProject();
    expect(migrateProject(p)).toBe(p);
  });

  it('ergänzt fehlende Felder eines alten Projekts mit Defaults', () => {
    const def = getDef('atlantis-a301')!;
    const old = {
      id: 'p_alt',
      name: 'Altes Projekt',
      schemaVersion: 0,
      floors: [
        {
          id: 'f_1',
          name: 'EG',
          hall: { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }] },
          walls: [{ id: 'w_1', start: { x: 0, y: 0 }, end: { x: 500, y: 0 }, thickness: 12.5 }],
          items: [{ id: 'i_1', defId: 'atlantis-a301', x: 100, y: 100, rotation: 0, width: 123, depth: 138 }],
        },
      ],
    };
    const r = validateProject(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = migrateProject(r.project);
    expect(m).not.toBe(r.project);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.settings).toEqual(DEFAULT_SETTINGS);
    expect(m.layers).toEqual(DEFAULT_LAYERS);
    expect(m.favorites).toEqual([]);
    expect(m.priceOverrides).toEqual({});
    expect(m.customEquipment).toEqual([]);
    expect(m.activeFloorId).toBe('f_1');
    expect(typeof m.createdAt).toBe('string');
    expect(typeof m.updatedAt).toBe('string');
    const f = m.floors[0];
    expect(f.order).toBe(0);
    expect(f.ceilingHeight).toBeGreaterThan(0);
    expect(f.hall?.wallThickness).toBeGreaterThan(0);
    expect(f.hall?.floorCovering).toBeTruthy();
    expect(f.zones).toEqual([]);
    expect(f.roomMeta).toEqual({});
    expect(f.openings).toEqual([]);
    expect(f.groups).toEqual([]);
    expect(f.voids).toEqual([]);
    expect(f.annotations).toEqual([]);
    expect(f.walls[0].type).toBe('Trockenbau');
    expect(f.walls[0].height).toBeNull();
    const it = f.items[0];
    expect(it.kind).toBe('equipment');
    expect(it.height).toBe(def.hoehe_cm);
    expect(it.safetyZone).toEqual(def.sicherheitszone_cm);
    expect(it.safetyZoneEnabled).toBe(true);
    // Migriertes Projekt ist vollständig → zweite Migration ändert nichts
    expect(migrateProject(m)).toBe(m);
    expect(validateProject(m).ok).toBe(true);
  });

  it('repariert eine ungültige activeFloorId und ergänzt Teil-Settings', () => {
    const p = sampleProject();
    const partial = { ...p, activeFloorId: 'nicht-da', settings: { gridSize: 25 }, layers: { grid: false } } as unknown as Project;
    const m = migrateProject(partial);
    expect(m.activeFloorId).toBe(p.floors[0].id);
    expect(m.settings.gridSize).toBe(25);
    expect(m.settings.floorLoadLimitKgM2).toBe(DEFAULT_SETTINGS.floorLoadLimitKgM2);
    expect(m.layers.grid).toBe(false);
    expect(m.layers.walls).toBe(true);
  });

  it('validateAndMigrate kombiniert beides', () => {
    const r = validateAndMigrate({ id: 'x', name: 'Y', floors: [{ id: 'f', name: 'EG' }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.schemaVersion).toBe(SCHEMA_VERSION);
      expect(r.project.floors[0].items).toEqual([]);
    }
  });
});
