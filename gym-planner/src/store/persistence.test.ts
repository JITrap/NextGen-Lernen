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
  restoreVersion, saveNow, scheduleSave, flushSave, initPersistence, usePersistence, useProjectIndex, useSaveStatus, storageMode, summaryOf,
  exportAll, importAll, getStoredProject, handleChannelMessage, __resetPersistenceForTests, AUTOSAVE_DEBOUNCE_MS, LS_INDEX_KEY, LS_ACTIVE_KEY,
  LS_LAST_KEY, LS_SAVED_KEY, MAX_VERSIONS, CHANNEL_NAME, CONFLICT_MESSAGE, DELETED_MESSAGE, LOCAL_MODE_MESSAGE, QUOTA_MESSAGE,
  isQuotaError, storageErrorMessage,
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
  vi.unstubAllGlobals();
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
    expect(warnings[0].kind).toBe('warning');
    expect(warnings[0].text).toContain(LOCAL_MODE_MESSAGE);
    expect(warnings[0].text).toContain('IDB kaputt');
  });

  it('meldet den localStorage-Modus beim Start genau einmal als Info', async () => {
    disableIdb();
    __resetPersistenceForTests();
    await initPersistence();
    expect(storageMode()).toBe('local');
    expect(useProjectIndex.getState().storage).toBe('local');
    const toasts = useUiStore.getState().toasts.filter((t) => t.text.includes(LOCAL_MODE_MESSAGE));
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('info');
    // Weitere Speichervorgänge wiederholen den Hinweis nicht
    await createProject(TEMPLATES[0], 'Noch eins');
    await saveVersion('V');
    expect(useUiStore.getState().toasts.filter((t) => t.text.includes(LOCAL_MODE_MESSAGE)).length).toBe(1);
    // Mit IndexedDB kein Hinweis
    enableIdb();
    __resetPersistenceForTests();
    useUiStore.setState({ toasts: [] });
    await initPersistence();
    expect(useUiStore.getState().toasts.some((t) => t.text.includes('IndexedDB'))).toBe(false);
  });

  it('voller Speicher → deutsche Meldung „Speicher voll“ statt Browsertext', async () => {
    expect(isQuotaError(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 })).toBe(true);
    expect(isQuotaError(new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota."))).toBe(true);
    expect(isQuotaError(new Error('IDB kaputt'))).toBe(false);
    expect(storageErrorMessage(new Error('IDB kaputt'))).toBe('IDB kaputt');
    expect(storageErrorMessage(new DOMException('x', 'QuotaExceededError'))).toBe(QUOTA_MESSAGE);

    disableIdb();
    __resetPersistenceForTests();
    const p = await createProject(TEMPLATES[0], 'Voll');
    useUiStore.setState({ toasts: [] });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      if (key.startsWith('gymplanner.data.')) throw new DOMException("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.", 'QuotaExceededError');
    });
    try {
      useProjectStore.getState().renameProject('Voll 2');
      expect(await saveNow()).toBe(false);
      expect(useSaveStatus.getState().status).toBe('error');
      expect(useSaveStatus.getState().error).toBe(QUOTA_MESSAGE);
      const errs = useUiStore.getState().toasts.filter((t) => t.kind === 'error');
      expect(errs.length).toBe(1);
      expect(errs[0].text).toContain(QUOTA_MESSAGE);
      expect(errs[0].text).not.toContain('exceeded the quota');
      // Version ebenfalls mit deutscher Meldung
      useUiStore.setState({ toasts: [] });
      expect(await saveVersion('V')).toBeNull();
      expect(useUiStore.getState().toasts.some((t) => t.kind === 'error' && t.text.includes(QUOTA_MESSAGE))).toBe(true);
    } finally {
      spy.mockRestore();
    }
    // Nach Freigabe funktioniert das Speichern wieder
    expect(await saveNow()).toBe(true);
    expect(useSaveStatus.getState().status).toBe('saved');
    expect(JSON.parse(localStorage.getItem(`gymplanner.data.project:${p.id}`)!).name).toBe('Voll 2');
  });
});

describe('Review-Befunde Persistenz', () => {
  it('H1: ein mit gelöschter ID erneut angelegtes Projekt (JSON-Import) wird wieder gespeichert', async () => {
    const a = await createProject(TEMPLATES[0], 'A');
    const b = await createProject(TEMPLATES[0], 'B');
    const exported = structuredClone(useProjectStore.getState().project);
    expect(await deleteProject(b.id)).toBe(true);
    expect(useProjectStore.getState().project.id).toBe(a.id);
    const again = await createProject(exported);
    expect(again.id).toBe(b.id);
    expect(stored(b.id)).toBeDefined();
    useProjectStore.getState().renameProject('B wieder da');
    expect(await saveNow()).toBe(true);
    expect(useSaveStatus.getState().status).toBe('saved');
    expect(stored(b.id)!.name).toBe('B wieder da');
    // auch über Backup-Import + Öffnen
    const backup = await exportAll();
    expect(await deleteProject(b.id)).toBe(true);
    await importAll(backup);
    const restoredId = listProjects().find((s) => s.name === 'B wieder da')!.id;
    expect(await openProject(restoredId)).toBe(true);
    useProjectStore.getState().renameProject('B erneut');
    expect(await saveNow()).toBe(true);
    expect(stored(restoredId)!.name).toBe('B erneut');
  });

  it('H1: abgelehntes Speichern des aktiven Projekts ist sichtbar (Status error), explizites Speichern stellt es wieder her', async () => {
    await createProject(TEMPLATES[0], 'A');
    const b = await createProject(TEMPLATES[0], 'B');
    // Anderer Tab hat B gelöscht
    handleChannelMessage({ type: 'project-deleted', id: b.id });
    expect(useSaveStatus.getState().status).toBe('error');
    useUiStore.setState({ toasts: [] });
    useProjectStore.getState().renameProject('B geändert');
    scheduleSave(useProjectStore.getState().project);
    await flushSave();
    expect(useSaveStatus.getState().status).toBe('error');
    expect(useSaveStatus.getState().error).toBe(DELETED_MESSAGE);
    expect(useUiStore.getState().toasts.some((t) => t.kind === 'error' && t.text === DELETED_MESSAGE)).toBe(true);
    expect(stored(b.id)!.name).toBe('B');
    expect(await saveNow()).toBe(true);
    expect(stored(b.id)!.name).toBe('B geändert');
    expect(useSaveStatus.getState().status).toBe('saved');
  });

  it('M3: behält den Indexeintrag bei einem temporären Speicherfehler, entfernt ihn nur bei bestätigt fehlendem Projekt', async () => {
    const a = await createProject(TEMPLATES[0], 'A');
    const b = await createProject(TEMPLATES[0], 'B');
    ctl.fail = true;
    expect(await openProject(a.id)).toBe(false);
    expect(listProjects().map((s) => s.id)).toContain(a.id);
    expect(useUiStore.getState().toasts.some((t) => t.kind === 'error' && t.text.includes('konnte nicht geladen werden'))).toBe(true);
    expect(useProjectStore.getState().project.id).toBe(b.id);
    ctl.fail = false;
    // bestätigt fehlend (Index-Leiche) → Eintrag wird entfernt
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify([...listProjects(), { id: 'leiche', name: 'Leiche', updatedAt: '', createdAt: '', floorCount: 1, totalAreaM2: 0 }]));
    expect(await openProject('leiche')).toBe(false);
    expect(listProjects().map((s) => s.id)).not.toContain('leiche');
    expect(listProjects().map((s) => s.id)).toContain(a.id);
  });

  it('M4: überschreibt keinen in einem anderen Tab geänderten Stand; explizites Speichern schon', async () => {
    const p = await createProject(TEMPLATES[0], 'Tab A');
    mem.set(`project:${p.id}`, { ...stored(p.id)!, name: 'Aus Tab B', updatedAt: '2099-01-01T00:00:00.000Z' });
    useProjectStore.getState().renameProject('Meine Änderung');
    scheduleSave(useProjectStore.getState().project);
    await flushSave();
    expect(stored(p.id)!.name).toBe('Aus Tab B');
    expect(useSaveStatus.getState().status).toBe('error');
    expect(useSaveStatus.getState().error).toBe(CONFLICT_MESSAGE);
    expect(useSaveStatus.getState().dirty).toBe(true);
    expect(useUiStore.getState().toasts.filter((t) => t.text.includes(CONFLICT_MESSAGE)).length).toBe(1);
    // Zweiter Autosave: weiterhin blockiert, kein zweiter Toast
    scheduleSave(useProjectStore.getState().project);
    await flushSave();
    expect(useUiStore.getState().toasts.filter((t) => t.text.includes(CONFLICT_MESSAGE)).length).toBe(1);
    expect(stored(p.id)!.name).toBe('Aus Tab B');
    // Explizites Speichern überschreibt und hebt den Konflikt auf
    expect(await saveNow()).toBe(true);
    expect(stored(p.id)!.name).toBe('Meine Änderung');
    expect(useSaveStatus.getState().status).toBe('saved');
    scheduleSave(useProjectStore.getState().project);
    await flushSave();
    expect(useSaveStatus.getState().status).toBe('saved');
  });

  it('M4: BroadcastChannel (falls vorhanden) meldet Speichern/Löschen an andere Tabs und meldet Konflikte', async () => {
    class FakeChannel {
      static instances: FakeChannel[] = [];
      onmessage: ((ev: MessageEvent) => void) | null = null;
      posted: unknown[] = [];
      constructor(public name: string) {
        FakeChannel.instances.push(this);
      }
      postMessage(m: unknown) {
        this.posted.push(m);
      }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    const { unmount } = renderHook(() => usePersistence());
    await initPersistence();
    const ch = FakeChannel.instances.at(-1)!;
    expect(ch.name).toBe(CHANNEL_NAME);
    const p = await createProject(TEMPLATES[0], 'Zwei');
    expect(ch.posted).toContainEqual({ type: 'project-saved', id: p.id, updatedAt: p.updatedAt });
    // Anderer Tab speichert dasselbe Projekt → Konflikt sofort sichtbar
    ch.onmessage!({ data: { type: 'project-saved', id: p.id, updatedAt: '2099-01-01T00:00:00.000Z' } } as MessageEvent);
    expect(useSaveStatus.getState().status).toBe('error');
    expect(useSaveStatus.getState().error).toBe(CONFLICT_MESSAGE);
    // Unbekannte Nachrichten sind harmlos
    ch.onmessage!({ data: 'unsinn' } as MessageEvent);
    ch.onmessage!({ data: { type: 'project-saved' } } as MessageEvent);
    // Löschen wird gemeldet
    const other = listProjects().find((s) => s.id !== p.id)!;
    expect(await deleteProject(other.id)).toBe(true);
    expect(ch.posted).toContainEqual({ type: 'project-deleted', id: other.id });
    unmount();
  });

  it('M4: gelöschte Projekte aus anderen Tabs werden nicht durch späte Autosaves wiederbelebt', async () => {
    const a = await createProject(TEMPLATES[0], 'A');
    const b = await createProject(TEMPLATES[0], 'B');
    expect(await openProject(a.id)).toBe(true);
    mem.delete(`project:${b.id}`);
    handleChannelMessage({ type: 'project-deleted', id: b.id });
    expect(useSaveStatus.getState().status).not.toBe('error');
    scheduleSave({ ...b, name: 'Zombie' });
    await flushSave();
    expect(mem.has(`project:${b.id}`)).toBe(false);
    expect(useSaveStatus.getState().status).not.toBe('error');
  });

  it('L4: Notfallkopie wird per savedAt verglichen (updatedAt kann nach Undo älter sein)', async () => {
    const p = createEmptyProject('Undo');
    p.updatedAt = '2026-03-01T00:00:00.000Z';
    mem.set(`project:${p.id}`, structuredClone(p));
    localStorage.setItem(LS_ACTIVE_KEY, p.id);
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify([summaryOf(p)]));
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify({ id: p.id, savedAt: '2026-03-01T00:00:10.000Z' }));
    localStorage.setItem(LS_LAST_KEY, JSON.stringify({ savedAt: '2026-03-01T00:01:00.000Z', project: { ...p, name: 'Nach Undo', updatedAt: '2026-02-01T00:00:00.000Z' } }));
    await initPersistence();
    expect(useProjectStore.getState().project.name).toBe('Nach Undo');
    expect(stored(p.id)!.name).toBe('Nach Undo');
    // Speichern schreibt einen neuen monotonen Stempel
    const stamp = JSON.parse(localStorage.getItem(LS_SAVED_KEY)!) as { id: string; savedAt: string };
    expect(stamp.id).toBe(p.id);
    expect(stamp.savedAt > '2026-03-01T00:01:00.000Z').toBe(true);

    // Ältere Notfallkopie (savedAt vor dem Speicherstempel) wird ignoriert
    __resetPersistenceForTests();
    mem.set(`project:${p.id}`, structuredClone({ ...p, name: 'Gespeichert' }));
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify({ id: p.id, savedAt: '2026-03-02T00:00:00.000Z' }));
    localStorage.setItem(LS_LAST_KEY, JSON.stringify({ savedAt: '2026-03-01T00:01:00.000Z', project: { ...p, name: 'Alt', updatedAt: '2026-04-01T00:00:00.000Z' } }));
    await initPersistence();
    expect(useProjectStore.getState().project.name).toBe('Gespeichert');
    // deleteProject räumt Notfallkopie und Stempel des gelöschten Projekts auf
    await createProject(TEMPLATES[0], 'Zweites');
    localStorage.setItem(LS_LAST_KEY, JSON.stringify({ savedAt: '2026-05-01T00:00:00.000Z', project: p }));
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify({ id: p.id, savedAt: '2026-05-01T00:00:00.000Z' }));
    expect(await deleteProject(p.id)).toBe(true);
    expect(localStorage.getItem(LS_LAST_KEY)).toBeNull();
    expect(localStorage.getItem(LS_SAVED_KEY)).toBeNull();
  });
});
