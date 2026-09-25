import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/** In-Memory-Ersatz für idb-keyval (Werte werden wie in IndexedDB strukturiert kopiert). */
const { mem, ctl } = vi.hoisted(() => ({ mem: new Map<string, unknown>(), ctl: { fail: false } }));
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => {
    if (ctl.fail) throw new Error('IDB kaputt');
    return mem.has(k) ? structuredClone(mem.get(k)) : undefined;
  }),
  set: vi.fn(async (k: string, v: unknown) => {
    if (ctl.fail) throw new Error('IDB kaputt');
    mem.set(k, structuredClone(v));
  }),
  del: vi.fn(async (k: string) => {
    if (ctl.fail) throw new Error('IDB kaputt');
    mem.delete(k);
  }),
  keys: vi.fn(async () => {
    if (ctl.fail) throw new Error('IDB kaputt');
    return [...mem.keys()];
  }),
}));

import {
  createProject, openProject, renameProject, duplicateProject, deleteProject, createVariant, listProjects, listVersions, saveVersion,
  restoreVersion, saveNow, scheduleSave, initPersistence, usePersistence, useProjectIndex, useSaveStatus, storageMode, summaryOf,
  exportAll, importAll, getStoredProject, __resetPersistenceForTests, AUTOSAVE_DEBOUNCE_MS, LS_INDEX_KEY, LS_ACTIVE_KEY, LS_LAST_KEY, MAX_VERSIONS,
} from './persistence';
import { useProjectStore, loadProject } from './projectStore';
import { useUiStore } from './uiStore';
import { createEmptyProject, createWall, createItemFromDef } from './factories';
import { getDef } from '@/data/equipment';
import { TEMPLATES } from '@/data/templates';
import type { Project } from '@/types';

function enableIdb() {
  Object.defineProperty(globalThis, 'indexedDB', { value: {}, configurable: true, writable: true });
}
function disableIdb() {
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
}
const stored = (id: string) => mem.get(`project:${id}`) as Project | undefined;

beforeEach(() => {
  localStorage.clear();
  mem.clear();
  ctl.fail = false;
  enableIdb();
  __resetPersistenceForTests();
  useUiStore.setState({ toasts: [] });
  loadProject(createEmptyProject('Start'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Projekte speichern und laden', () => {
  it('speichern → laden ergibt ein identisches Projekt', async () => {
    const p = await createProject(TEMPLATES[0], 'Halle A');
    expect(useProjectStore.getState().project.id).toBe(p.id);
    expect(localStorage.getItem(LS_ACTIVE_KEY)).toBe(p.id);
    const s = useProjectStore.getState();
    const fid = p.floors[0].id;
    s.addWall(fid, createWall({ start: { x: 100, y: 100 }, end: { x: 900, y: 100 } }));
    s.addItem(fid, createItemFromDef(getDef('atlantis-a301')!, 300, 300, { rotation: 90, note: 'Test' }));
    s.setPriceOverride('atlantis-a301', 1234.5);
    expect(await saveNow()).toBe(true);
    const cur = useProjectStore.getState().project;
    expect(stored(p.id)).toEqual(cur);

    const q = await createProject(TEMPLATES[0], 'Halle B');
    expect(useProjectStore.getState().project.id).toBe(q.id);
    expect(await openProject(p.id)).toBe(true);
    expect(useProjectStore.getState().project).toEqual(cur);
    expect(listProjects().map((x) => x.id).sort()).toEqual([p.id, q.id].sort());
    const summary = listProjects().find((x) => x.id === p.id)!;
    expect(summary.totalAreaM2).toBe(500);
    expect(summary.floorCount).toBe(1);
    expect(useSaveStatus.getState().status).toBe('saved');
  });

  it('Autosave speichert debounced nach 800 ms', async () => {
    vi.useFakeTimers();
    const p = await createProject(TEMPLATES[0], 'Auto');
    useProjectStore.getState().renameProject('Auto 2');
    scheduleSave(useProjectStore.getState().project);
    expect(useSaveStatus.getState().dirty).toBe(true);
    expect(stored(p.id)!.name).toBe('Auto');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 50);
    expect(stored(p.id)!.name).toBe('Auto 2');
    expect(useSaveStatus.getState().status).toBe('saved');
    expect(useSaveStatus.getState().dirty).toBe(false);
    expect(listProjects()[0].name).toBe('Auto 2');
  });

  it('usePersistence lädt beim Start und speichert Store-Änderungen automatisch', async () => {
    const { unmount } = renderHook(() => usePersistence());
    await initPersistence();
    expect(useProjectIndex.getState().ready).toBe(true);
    const id = useProjectStore.getState().project.id;
    expect(listProjects().length).toBe(1);
    expect(useProjectStore.getState().project.floors[0].hall).not.toBeNull();
    useProjectStore.getState().renameProject('Per Hook');
    await new Promise((r) => setTimeout(r, AUTOSAVE_DEBOUNCE_MS + 200));
    expect(stored(id)!.name).toBe('Per Hook');
    unmount();
  });

  it('nutzt beim Start die Notfallkopie, wenn sie neuer als der IndexedDB-Stand ist', async () => {
    const p = createEmptyProject('Alt');
    p.updatedAt = '2026-01-01T00:00:00.000Z';
    mem.set(`project:${p.id}`, structuredClone(p));
    localStorage.setItem(LS_ACTIVE_KEY, p.id);
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify([summaryOf(p)]));
    localStorage.setItem(LS_LAST_KEY, JSON.stringify({ ...p, name: 'Neu', updatedAt: '2026-02-01T00:00:00.000Z' }));
    await initPersistence();
    expect(useProjectStore.getState().project.name).toBe('Neu');
    expect(stored(p.id)!.name).toBe('Neu');
  });

  it('baut den Index aus IndexedDB neu auf, wenn localStorage leer ist', async () => {
    const p = createEmptyProject('Wiedergefunden');
    mem.set(`project:${p.id}`, structuredClone(p));
    await initPersistence();
    expect(listProjects().map((s) => s.id)).toContain(p.id);
    expect(useProjectStore.getState().project.id).toBe(p.id);
  });

  it('legt bei beschädigten Daten ein Projekt aus der Vorlage an und meldet den Fehler', async () => {
    localStorage.setItem(LS_ACTIVE_KEY, 'kaputt');
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify([{ id: 'kaputt', name: 'Kaputt', updatedAt: '', createdAt: '', floorCount: 1, totalAreaM2: 0 }]));
    mem.set('project:kaputt', { id: 'kaputt', name: 'Kaputt', floors: 'nein' });
    await initPersistence();
    expect(useUiStore.getState().toasts.some((t) => t.kind === 'error')).toBe(true);
    expect(useProjectStore.getState().project.id).not.toBe('kaputt');
    expect(useProjectIndex.getState().ready).toBe(true);
  });
});

describe('Versionsverlauf', () => {
  it('begrenzt die Versionsliste auf MAX_VERSIONS (neueste zuerst)', async () => {
    const p = await createProject(TEMPLATES[0], 'V');
    for (let i = 0; i < 25; i++) {
      useProjectStore.getState().renameProject(`V${i}`);
      const v = await saveVersion(`L${i}`);
      expect(v).not.toBeNull();
    }
    const list = await listVersions(p.id);
    expect(list.length).toBe(MAX_VERSIONS);
    expect(list[0].label).toBe('L24');
    expect(list[MAX_VERSIONS - 1].label).toBe('L5');
    expect(list[0].project.name).toBe('V24');
    expect(list[0].projectId).toBe(p.id);
  });

  it('stellt eine Version wieder her und sichert vorher den aktuellen Stand', async () => {
    const p = await createProject(TEMPLATES[0], 'R');
    const fid = p.floors[0].id;
    const wall = createWall({ start: { x: 0, y: 0 }, end: { x: 400, y: 0 } });
    useProjectStore.getState().addWall(fid, wall);
    await saveVersion('mit Wand');
    useProjectStore.getState().deleteWalls(fid, [wall.id]);
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(0);
    const versions = await listVersions(p.id);
    expect(versions[0].label).toBe('mit Wand');
    expect(await restoreVersion(versions[0].id)).toBe(true);
    const cur = useProjectStore.getState().project;
    expect(cur.id).toBe(p.id);
    expect(cur.floors[0].walls.length).toBe(1);
    expect(stored(p.id)!.floors[0].walls.length).toBe(1);
    const after = await listVersions(p.id);
    expect(after[0].label).toBe('Vor Wiederherstellung');
    expect(after[0].project.floors[0].walls.length).toBe(0);
    expect(await restoreVersion('gibt-es-nicht')).toBe(false);
  });
});

describe('Projektverwaltung', () => {
  it('umbenennen, duplizieren, Variante anlegen', async () => {
    const p = await createProject(TEMPLATES[0], 'Studio');
    expect(await renameProject(p.id, '  Studio Nord ')).toBe(true);
    expect(useProjectStore.getState().project.name).toBe('Studio Nord');
    expect(stored(p.id)!.name).toBe('Studio Nord');

    const v = await createVariant(p.id, 'B: 600 m²');
    expect(v).not.toBeNull();
    expect(v!.parentId).toBe(p.id);
    expect(v!.name).toBe('Studio Nord');
    expect(v!.variantName).toBe('B: 600 m²');
    expect(v!.id).not.toBe(p.id);
    expect(useProjectStore.getState().project.id).toBe(v!.id);
    const vv = await createVariant(v!.id, 'C');
    expect(vv!.parentId).toBe(p.id); // Varianten hängen immer am Ursprungsprojekt

    const dup = await duplicateProject(p.id, 'Kopie');
    expect(dup!.parentId).toBeUndefined();
    expect(dup!.name).toBe('Kopie');
    expect(dup!.floors[0].hall).toEqual(p.floors[0].hall);
    expect(listProjects().length).toBe(4);

    // Nicht aktives Projekt umbenennen
    expect(await renameProject(p.id, 'Studio Süd')).toBe(true);
    expect(stored(p.id)!.name).toBe('Studio Süd');
    expect(listProjects().find((s) => s.id === p.id)!.name).toBe('Studio Süd');
    expect(await renameProject(p.id, '   ')).toBe(false);
  });

  it('löscht nicht das letzte Projekt und öffnet nach dem Löschen ein anderes', async () => {
    const p = await createProject(TEMPLATES[0], 'Einzig');
    expect(await deleteProject(p.id)).toBe(false);
    expect(listProjects().length).toBe(1);
    const q = await createProject(TEMPLATES[0], 'Zwei');
    await saveVersion('x');
    expect(useProjectStore.getState().project.id).toBe(q.id);
    expect(await deleteProject(q.id)).toBe(true);
    expect(useProjectStore.getState().project.id).toBe(p.id);
    expect(mem.has(`project:${q.id}`)).toBe(false);
    expect(mem.has(`versions:${q.id}`)).toBe(false);
    expect(listProjects().map((s) => s.id)).toEqual([p.id]);
    // Gelöschtes Projekt wird durch einen späten Autosave nicht wiederbelebt
    scheduleSave({ ...q, name: 'Zombie' });
    await new Promise((r) => setTimeout(r, AUTOSAVE_DEBOUNCE_MS + 100));
    expect(mem.has(`project:${q.id}`)).toBe(false);
  });

  it('importiert ein Projekt mit bestehender ID als Kopie', async () => {
    const p = await createProject(TEMPLATES[0], 'Original');
    const again = await createProject(structuredClone(useProjectStore.getState().project), 'Import');
    expect(again.id).not.toBe(p.id);
    expect(again.name).toBe('Import');
    const fresh = createEmptyProject('Fremd');
    const kept = await createProject(fresh);
    expect(kept.id).toBe(fresh.id);
    expect(await getStoredProject(p.id)).not.toBeNull();
  });

  it('Sicherung aller Projekte exportieren und importieren', async () => {
    const p = await createProject(TEMPLATES[0], 'S1');
    await createProject(TEMPLATES[0], 'S2');
    const text = await exportAll();
    const parsed = JSON.parse(text) as { format: string; projects: Project[] };
    expect(parsed.format).toBe('gymplanner-backup');
    expect(parsed.projects.length).toBe(2);
    const n = await importAll(text);
    expect(n).toBe(2);
    expect(listProjects().length).toBe(4);
    expect(listProjects().filter((s) => s.name === 'S1').length).toBe(2);
    expect(stored(p.id)).toBeDefined();
    await expect(importAll('{"format":"x"}')).rejects.toThrow('Sicherungsdatei');
  });
});

describe('localStorage-Fallback', () => {
  it('speichert ohne IndexedDB im localStorage', async () => {
    disableIdb();
    __resetPersistenceForTests();
    const p = await createProject(TEMPLATES[0], 'Lokal');
    expect(storageMode()).toBe('local');
    expect(mem.size).toBe(0);
    expect(localStorage.getItem(`gymplanner.data.project:${p.id}`)).toBeTruthy();
    await createProject(TEMPLATES[0], 'Lokal 2');
    expect(await openProject(p.id)).toBe(true);
    expect(useProjectStore.getState().project).toEqual(p);
    for (let i = 0; i < 8; i++) await saveVersion(`L${i}`);
    expect((await listVersions(p.id)).length).toBeLessThanOrEqual(MAX_VERSIONS);
  });

  it('wechselt bei IndexedDB-Fehlern auf localStorage und meldet dies einmal', async () => {
    ctl.fail = true;
    const p = await createProject(TEMPLATES[0], 'Kaputt');
    expect(storageMode()).toBe('local');
    expect(localStorage.getItem(`gymplanner.data.project:${p.id}`)).toBeTruthy();
    expect(useSaveStatus.getState().status).toBe('saved');
    const warnings = useUiStore.getState().toasts.filter((t) => t.text.includes('IndexedDB'));
    expect(warnings.length).toBe(1);
  });
});
