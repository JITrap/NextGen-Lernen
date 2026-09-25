import { describe, it, expect } from 'vitest';
import { validateProject, migrateProject, validateAndMigrate, sanitizeSettings, sanitizeLayers, isValidSetting } from './migrate';
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

describe('Datenintegrität (Review-Befunde)', () => {
  it('H2: sanitisiert ungültige Einstellungen und Ebenen (kein Endlos-Raster)', () => {
    const p = sampleProject();
    const bad = {
      ...p,
      settings: { ...p.settings, gridSize: 0, floorLoadLimitKgM2: -1, lowerFloorOpacity: 5, showGrid: 'ja', m2PerPerson: 9, fremd: 'bleibt' },
      layers: { ...p.layers, walls: 'nein', grid: false },
    } as unknown as Project;
    expect(validateProject(bad).ok).toBe(true);
    const m = migrateProject(bad);
    expect(m).not.toBe(bad);
    expect(m.settings.gridSize).toBe(DEFAULT_SETTINGS.gridSize);
    expect(m.settings.floorLoadLimitKgM2).toBe(DEFAULT_SETTINGS.floorLoadLimitKgM2);
    expect(m.settings.lowerFloorOpacity).toBe(DEFAULT_SETTINGS.lowerFloorOpacity);
    expect(m.settings.showGrid).toBe(true);
    expect(m.settings.m2PerPerson).toBe(9);
    expect((m.settings as unknown as Record<string, unknown>).fremd).toBe('bleibt');
    expect(m.layers.walls).toBe(true);
    expect(m.layers.grid).toBe(false);
    // Sanitisiertes Projekt ist vollständig → keine erneute Migration
    expect(migrateProject(m)).toBe(m);
    // Negative/NaN Rastergröße oder Zahl außerhalb des Bereichs zwingt zur Migration
    expect(migrateProject({ ...p, settings: { ...p.settings, gridSize: -10 } } as unknown as Project).settings.gridSize).toBe(10);
    expect(migrateProject({ ...p, settings: { ...p.settings, gridSize: Number.NaN } } as unknown as Project).settings.gridSize).toBe(10);
    expect(migrateProject({ ...p, settings: { ...p.settings, minEscapeRouteCm: 10 } } as Project).settings.minEscapeRouteCm).toBe(DEFAULT_SETTINGS.minEscapeRouteCm);
    expect(isValidSetting('gridSize', 7)).toBe(false);
    expect(isValidSetting('gridSize', 25)).toBe(true);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ gridSize: 50, defaultSafetyZoneCm: 999 })).toEqual({ ...DEFAULT_SETTINGS, gridSize: 50 });
    expect(sanitizeLayers({ rooms: 0 })).toEqual(DEFAULT_LAYERS);
  });

  it('H4: prüft eigene Geräte (Form, Polygon) und fällt bei unbekanntem Bereich auf „Eigene“ zurück', () => {
    const base = { id: 'c1', name: 'Eigen', breite_cm: 100, tiefe_cm: 50 };
    const mk = (extra: Record<string, unknown>) => ({ ...sampleProject(), customEquipment: [{ ...base, ...extra }] });
    expect(validateProject(mk({ form: 'dreieck' })).ok).toBe(false);
    expect(validateProject(mk({ form: 'polygon', polygon: 'abc' })).ok).toBe(false);
    expect(validateProject(mk({ form: 'polygon', polygon: [1, 2, 3] })).ok).toBe(false);
    expect(validateProject(mk({ form: 'polygon', polygon: [[0, 0], [1, 0]] })).ok).toBe(false);
    expect(validateProject(mk({ form: 'polygon', polygon: [[0, 0], [1, 'x'], [1, 1]] })).ok).toBe(false);
    expect(validateProject(mk({ form: 'polygon' })).ok).toBe(false);
    expect(validateProject(mk({ symbol: 42 })).ok).toBe(false);
    const ok = validateAndMigrate(mk({ form: 'polygon', polygon: [[0, 0], [1, 0], [1, 1]], bereich: 'Unbekannt', symbol: 'nicht-registriert' }));
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const d = ok.project.customEquipment[0];
      expect(d.bereich).toBe('Eigene');
      expect(d.form).toBe('polygon');
      expect(d.polygon).toEqual([[0, 0], [1, 0], [1, 1]]);
      expect(d.symbol).toBe('nicht-registriert'); // Renderer fällt auf „generic“ zurück
      expect(migrateProject(ok.project)).toBe(ok.project);
    }
    // Vollständiges Projekt mit ungültigem Bereich wird beim Laden repariert
    const p = sampleProject();
    p.customEquipment.push({ ...base, kategorie: 'Eigene', unterkategorie: '', hersteller: 'Generisch', hoehe_cm: null, sicherheitszone_cm: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, form: 'rechteck', skalierbar: true, verifiziert: false, bereich: 'Falsch' as never, symbol: 'generic' });
    const m = migrateProject(p);
    expect(m).not.toBe(p);
    expect(m.customEquipment[0].bereich).toBe('Eigene');
  });

  it('M6: doppelte Element-IDs werden gemeldet und bei der Migration ersetzt (Referenzen zeigen auf das erste Element)', () => {
    const p = sampleProject();
    const f = p.floors[0];
    const first = f.items[0];
    f.items.push({ ...first, x: 900 });
    f.groups.push({ id: 'g1', itemIds: [first.id, 'x'] });
    f.walls.push({ ...f.walls[0], start: { x: 0, y: 500 }, end: { x: 300, y: 500 } });
    const r = validateProject(p);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.includes('Doppelte IDs') && w.includes(first.id))).toBe(true);
    const m = migrateProject(p);
    expect(m).not.toBe(p);
    const ids = m.floors[0].items.map((i) => i.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(first.id);
    expect(ids[1]).toMatch(/^i_/);
    const wids = m.floors[0].walls.map((w) => w.id);
    expect(new Set(wids).size).toBe(2);
    expect(wids[0]).toBe(f.walls[0].id);
    expect(m.floors[0].groups[0].itemIds).toContain(first.id);
    expect(migrateProject(m)).toBe(m);
    expect(validateProject(m).ok).toBe(true);
    if (validateProject(m).ok) expect((validateProject(m) as { warnings: string[] }).warnings).toEqual([]);
  });

  it('L3: übernimmt keine __proto__/constructor-Schlüssel (roomMeta, priceOverrides, settings)', () => {
    const raw = JSON.parse(
      '{"id":"p","name":"X","floors":[{"id":"f","name":"EG","roomMeta":{"__proto__":{"name":"a","type":"b"},"constructor":{"name":"c","type":"d"},"ok":{"name":"Raum","type":"Büro"}}}],'
      + '"priceOverrides":{"__proto__":{"polluted":1},"atlantis-a301":5,"kaputt":"x"},"settings":{"__proto__":{"polluted":2},"gridSize":25}}',
    ) as unknown;
    const r = validateAndMigrate(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.project.floors[0].roomMeta)).toEqual(['ok']);
      expect(Object.keys(r.project.priceOverrides)).toEqual(['atlantis-a301']);
      expect(Object.keys(r.project.settings)).not.toContain('__proto__');
      expect(r.project.settings.gridSize).toBe(25);
      expect(Object.getPrototypeOf(r.project.floors[0].roomMeta)).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
    // Vollständiges Projekt mit unsicherem Schlüssel wird bei der Migration bereinigt
    const p = sampleProject();
    Object.defineProperty(p.floors[0].roomMeta, '__proto__', { value: { name: 'x', type: 'y' }, enumerable: true, configurable: true, writable: true });
    const m = migrateProject(p);
    expect(m).not.toBe(p);
    expect(Object.keys(m.floors[0].roomMeta)).toEqual([]);
  });

  it('L6: vergibt doppelte order-Werte bei der Migration neu (stabil)', () => {
    const p = sampleProject();
    p.floors = [
      { ...p.floors[0], id: 'a', order: 1 },
      { ...p.floors[0], id: 'b', order: 0 },
      { ...p.floors[0], id: 'c', order: 0 },
    ];
    p.activeFloorId = 'a';
    const m = migrateProject(p);
    expect(m).not.toBe(p);
    expect(m.floors.map((f) => [f.id, f.order])).toEqual([['a', 2], ['b', 0], ['c', 1]]);
    expect(migrateProject(m)).toBe(m);
    // Eindeutige (auch negative) Reihenfolgen bleiben unverändert
    const q = sampleProject();
    q.floors = [{ ...q.floors[0], id: 'ug', order: -1 }, { ...q.floors[0], id: 'eg', order: 0 }];
    q.activeFloorId = 'eg';
    expect(migrateProject(q)).toBe(q);
  });
});
