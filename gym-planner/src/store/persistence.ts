/**
 * Speicherung: Autosave, Projektverwaltung, Varianten und Versionsverlauf.
 *
 * Ablage:
 * - localStorage 'gymplanner.projects'      Projektindex (ProjectSummary[])
 * - localStorage 'gymplanner.activeProject' ID des aktiven Projekts
 * - localStorage 'gymplanner.lastProject'   Notfallkopie des aktiven Projekts (synchron bei beforeunload)
 * - IndexedDB (idb-keyval) 'project:<id>'   Projektdaten, 'versions:<id>' Versionsverlauf (max. MAX_VERSIONS)
 * Ist IndexedDB nicht verfügbar (oder schlägt fehl), werden dieselben Schlüssel unter 'gymplanner.data.<key>'
 * im localStorage abgelegt.
 *
 * usePersistence() wird einmal in App.tsx aufgerufen: lädt beim Start das aktive Projekt (oder legt eines aus der
 * ersten Vorlage an), speichert nach jeder Änderung debounced (800 ms) und legt alle 2 Minuten automatisch eine
 * Version an, wenn sich das Projekt geändert hat.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';
import type { Project, ProjectSummary, ProjectVersion } from '@/types';
import { useProjectStore, loadProject, newProjectFrom, transaction } from './projectStore';
import { useUiStore } from './uiStore';
import { createEmptyProject, cloneDeep } from './factories';
import { validateProject, migrateProject } from './migrate';
import { TEMPLATES, type ProjectTemplate } from '@/data/templates';
import { polygonArea } from '@/geometry/polygon';
import { newId } from '@/utils/id';

export const LS_INDEX_KEY = 'gymplanner.projects';
export const LS_ACTIVE_KEY = 'gymplanner.activeProject';
export const LS_LAST_KEY = 'gymplanner.lastProject';
const LS_DATA_PREFIX = 'gymplanner.data.';
export const MAX_VERSIONS = 20;
/** Weniger Versionen im localStorage-Fallback (5 MB Limit). */
export const MAX_VERSIONS_LOCAL = 5;
export const AUTOSAVE_DEBOUNCE_MS = 800;
export const AUTO_VERSION_INTERVAL_MS = 2 * 60 * 1000;

export const projectKey = (id: string) => `project:${id}`;
export const versionsKey = (id: string) => `versions:${id}`;

const toast = (text: string, kind: 'info' | 'success' | 'warning' | 'error' = 'info') => useUiStore.getState().toast(text, kind);

/* ------------------------------------------------------------------ */
/* Speicher-Backend (IndexedDB mit localStorage-Fallback)               */
/* ------------------------------------------------------------------ */

export type StorageMode = 'idb' | 'local';
let mode: StorageMode | null = null;
let fallbackAnnounced = false;

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}
function detectMode(): StorageMode {
  if (mode) return mode;
  mode = typeof indexedDB !== 'undefined' && indexedDB !== null ? 'idb' : 'local';
  return mode;
}
function switchToLocal(reason: unknown) {
  if (mode === 'local') return;
  mode = 'local';
  useProjectIndex.setState({ storage: 'local' });
  if (!fallbackAnnounced) {
    fallbackAnnounced = true;
    const msg = reason instanceof Error ? reason.message : String(reason ?? '');
    toast(`IndexedDB nicht verfügbar${msg ? ` (${msg})` : ''} – Projekte werden im localStorage gespeichert (begrenzter Platz).`, 'warning');
  }
}
export function storageMode(): StorageMode {
  return detectMode();
}

function localGet<T>(key: string): T | undefined {
  if (!hasLocalStorage()) return undefined;
  const raw = localStorage.getItem(LS_DATA_PREFIX + key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
function localSet(key: string, value: unknown) {
  if (!hasLocalStorage()) throw new Error('Kein Speicher verfügbar (localStorage gesperrt).');
  localStorage.setItem(LS_DATA_PREFIX + key, JSON.stringify(value));
}
function localDel(key: string) {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(LS_DATA_PREFIX + key);
}
function localKeys(): string[] {
  if (!hasLocalStorage()) return [];
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_DATA_PREFIX)) out.push(k.slice(LS_DATA_PREFIX.length));
  }
  return out;
}

async function storeGet<T>(key: string): Promise<T | undefined> {
  if (detectMode() === 'idb') {
    try {
      return await idbGet<T>(key);
    } catch (e) {
      switchToLocal(e);
    }
  }
  return localGet<T>(key);
}
async function storeSet(key: string, value: unknown): Promise<void> {
  if (detectMode() === 'idb') {
    try {
      await idbSet(key, value);
      return;
    } catch (e) {
      switchToLocal(e);
    }
  }
  localSet(key, value);
}
async function storeDel(key: string): Promise<void> {
  if (detectMode() === 'idb') {
    try {
      await idbDel(key);
      return;
    } catch (e) {
      switchToLocal(e);
    }
  }
  localDel(key);
}
async function storeKeys(): Promise<string[]> {
  if (detectMode() === 'idb') {
    try {
      return (await idbKeys<string>()).filter((k): k is string => typeof k === 'string');
    } catch (e) {
      switchToLocal(e);
    }
  }
  return localKeys();
}

/* ------------------------------------------------------------------ */
/* Projektindex (localStorage) + reaktiver Zustand                     */
/* ------------------------------------------------------------------ */

export interface ProjectIndexState {
  projects: ProjectSummary[];
  activeId: string | null;
  /** Wird bei jeder Änderung des Versionsverlaufs erhöht (Panels laden neu). */
  versionsNonce: number;
  /** Startladen abgeschlossen. */
  ready: boolean;
  storage: StorageMode | null;
}

function isSummary(v: unknown): v is ProjectSummary {
  return !!v && typeof v === 'object' && typeof (v as ProjectSummary).id === 'string' && typeof (v as ProjectSummary).name === 'string';
}
function readIndex(): ProjectSummary[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(LS_INDEX_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? sortSummaries(arr.filter(isSummary)) : [];
  } catch {
    return [];
  }
}
function readActiveId(): string | null {
  if (!hasLocalStorage()) return null;
  try {
    return localStorage.getItem(LS_ACTIVE_KEY);
  } catch {
    return null;
  }
}
function sortSummaries(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export const useProjectIndex = create<ProjectIndexState>()(() => ({
  projects: readIndex(),
  activeId: readActiveId(),
  versionsNonce: 0,
  ready: false,
  storage: null,
}));

function writeIndex(list: ProjectSummary[]) {
  const sorted = sortSummaries(list);
  try {
    if (hasLocalStorage()) localStorage.setItem(LS_INDEX_KEY, JSON.stringify(sorted));
  } catch (e) {
    toast(`Projektliste konnte nicht gespeichert werden: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
  useProjectIndex.setState({ projects: sorted });
}
function setActiveId(id: string) {
  try {
    if (hasLocalStorage()) localStorage.setItem(LS_ACTIVE_KEY, id);
  } catch {
    /* ignorieren */
  }
  useProjectIndex.setState({ activeId: id });
}

/** Brutto-Hallenfläche aller Stockwerke in m². */
export function projectTotalAreaM2(p: Project): number {
  let sum = 0;
  for (const f of p.floors) if (f.hall && f.hall.polygon.length >= 3) sum += polygonArea(f.hall.polygon) / 10000;
  return Math.round(sum * 100) / 100;
}
export function summaryOf(p: Project): ProjectSummary {
  const s: ProjectSummary = {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    floorCount: p.floors.length,
    totalAreaM2: projectTotalAreaM2(p),
  };
  if (p.parentId) s.parentId = p.parentId;
  if (p.variantName) s.variantName = p.variantName;
  return s;
}
function upsertSummary(p: Project) {
  const list = readIndex().filter((s) => s.id !== p.id);
  list.push(summaryOf(p));
  writeIndex(list);
}
function removeSummary(id: string) {
  writeIndex(readIndex().filter((s) => s.id !== id));
}

/** Baut den Index aus den gespeicherten Projekten neu auf (z. B. nach gelöschtem localStorage). */
async function rebuildIndexFromStorage(): Promise<ProjectSummary[]> {
  const keys = await storeKeys();
  const list: ProjectSummary[] = [];
  for (const k of keys) {
    if (!k.startsWith('project:')) continue;
    const raw = await storeGet<unknown>(k);
    const r = validateProject(raw);
    if (r.ok) list.push(summaryOf(migrateProject(r.project)));
  }
  if (list.length) writeIndex(list);
  return sortSummaries(list);
}

/* ------------------------------------------------------------------ */
/* Speicherstatus                                                      */
/* ------------------------------------------------------------------ */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export interface SaveState {
  status: SaveStatus;
  lastSavedAt: string | null;
  error: string | null;
  /** Ungespeicherte Änderungen vorhanden. */
  dirty: boolean;
}
/** Zustand-Store: `useSaveStatus()` oder `useSaveStatus((s) => s.status)`. */
export const useSaveStatus = create<SaveState>()(() => ({ status: 'idle', lastSavedAt: null, error: null, dirty: false }));

/* ------------------------------------------------------------------ */
/* Autosave                                                            */
/* ------------------------------------------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Project | null = null;
let saving: Promise<void> | null = null;
let suppressSave = false;
const deletedIds = new Set<string>();

function currentProject(): Project {
  return useProjectStore.getState().project;
}

/** Lädt ein Projekt in den Store, ohne dadurch einen Autosave auszulösen. */
function applyProject(p: Project) {
  suppressSave = true;
  try {
    loadProject(p);
  } finally {
    suppressSave = false;
  }
  const ui = useUiStore.getState();
  ui.clearSelection();
  ui.setContextMenu(null);
}

function writeLastProjectSync(p: Project) {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(LS_LAST_KEY, JSON.stringify(p));
  } catch {
    /* Quota – ignorieren */
  }
}
function readLastProjectSync(): Project | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(LS_LAST_KEY);
    if (!raw) return null;
    const r = validateProject(JSON.parse(raw));
    return r.ok ? migrateProject(r.project) : null;
  } catch {
    return null;
  }
}

async function persistProject(p: Project): Promise<boolean> {
  if (deletedIds.has(p.id)) return false;
  useSaveStatus.setState({ status: 'saving', error: null });
  try {
    await storeSet(projectKey(p.id), p);
    upsertSummary(p);
    useSaveStatus.setState({ status: 'saved', lastSavedAt: new Date().toISOString(), error: null, dirty: pending !== null });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    useSaveStatus.setState({ status: 'error', error: msg, dirty: true });
    toast(`Speichern fehlgeschlagen: ${msg}`, 'error');
    writeLastProjectSync(p);
    return false;
  }
}

/** Plant einen Autosave (debounced). */
export function scheduleSave(project: Project) {
  pending = project;
  useSaveStatus.setState({ dirty: true });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushSave();
  }, AUTOSAVE_DEBOUNCE_MS);
}

/** Schreibt ausstehende Änderungen sofort. */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (saving) await saving;
  if (!pending) return;
  const p = pending;
  pending = null;
  saving = persistProject(p).then(() => undefined).finally(() => {
    saving = null;
  });
  await saving;
  if (pending) await flushSave();
}

/** Explizites Speichern (Schaltfläche „Speichern“). Liefert true bei Erfolg. */
export async function saveNow(): Promise<boolean> {
  pending = currentProject();
  await flushSave();
  return useSaveStatus.getState().status !== 'error';
}

/* ------------------------------------------------------------------ */
/* Laden                                                               */
/* ------------------------------------------------------------------ */

interface LoadResult {
  project: Project;
  migrated: boolean;
}

/** Liest ein Projekt aus dem Speicher (validiert + migriert). null, wenn nicht vorhanden oder beschädigt. */
async function loadStoredProject(id: string, quiet = false): Promise<LoadResult | null> {
  const raw = await storeGet<unknown>(projectKey(id));
  if (raw === undefined || raw === null) return null;
  const r = validateProject(raw);
  if (!r.ok) {
    if (!quiet) toast(`Gespeichertes Projekt ist beschädigt und kann nicht geladen werden (${r.errors[0]}).`, 'error');
    return null;
  }
  const migrated = migrateProject(r.project);
  return { project: migrated, migrated: migrated !== r.project };
}

/** Projektdaten lesen: aktives Projekt aus dem Store, andere aus dem Speicher. */
export async function getStoredProject(id: string): Promise<Project | null> {
  const cur = currentProject();
  if (cur.id === id) return cur;
  const r = await loadStoredProject(id, true);
  return r?.project ?? null;
}

function createFromTemplate(t: ProjectTemplate | undefined, name?: string): Project {
  const trimmed = name?.trim();
  const p = t ? t.create(trimmed || undefined) : createEmptyProject(trimmed || undefined);
  if (trimmed) p.name = trimmed;
  return migrateProject(p);
}

let initPromise: Promise<void> | null = null;

async function doInit(): Promise<void> {
  try {
    let index = readIndex();
    if (!index.length) index = await rebuildIndexFromStorage();
    const activeId = readActiveId();
    const last = readLastProjectSync();
    let project: Project | null = null;
    let needsPersist = false;

    if (activeId) {
      const r = await loadStoredProject(activeId);
      if (r) {
        project = r.project;
        needsPersist = r.migrated;
      }
    }
    // Notfallkopie verwenden, wenn IDB leer ist oder die Kopie neuer ist.
    if (last && (project ? last.id === project.id && last.updatedAt > project.updatedAt : !activeId || last.id === activeId)) {
      project = last;
      needsPersist = true;
    }
    if (!project) {
      for (const s of index) {
        const r = await loadStoredProject(s.id, true);
        if (r) {
          project = r.project;
          needsPersist = r.migrated;
          break;
        }
      }
    }
    if (!project) {
      project = createFromTemplate(TEMPLATES[0]);
      needsPersist = true;
    }
    applyProject(project);
    setActiveId(project.id);
    upsertSummary(project);
    if (needsPersist) await persistProject(project);
    else useSaveStatus.setState({ status: 'saved', dirty: false, error: null, lastSavedAt: project.updatedAt });
    useUiStore.getState().requestFit();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast(`Projekt konnte nicht geladen werden: ${msg}. Ein leeres Projekt wurde angelegt.`, 'error');
    const p = createEmptyProject();
    applyProject(p);
    setActiveId(p.id);
    upsertSummary(p);
  } finally {
    useProjectIndex.setState({ ready: true, storage: detectMode() });
  }
}

/** Startladen (idempotent, StrictMode-sicher). */
export function initPersistence(): Promise<void> {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

/* ------------------------------------------------------------------ */
/* Versionsverlauf                                                     */
/* ------------------------------------------------------------------ */

let lastVersionedUpdatedAt: string | null = null;

export async function listVersions(id: string = currentProject().id): Promise<ProjectVersion[]> {
  const raw = await storeGet<unknown>(versionsKey(id));
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is ProjectVersion => !!v && typeof v === 'object' && typeof (v as ProjectVersion).id === 'string' && !!(v as ProjectVersion).project);
}

/** Legt eine Version des aktiven (oder übergebenen) Projekts an. Ältere über MAX_VERSIONS hinaus werden verworfen. */
export async function saveVersion(label?: string, projectArg?: Project): Promise<ProjectVersion | null> {
  const project = projectArg ?? currentProject();
  const list = await listVersions(project.id);
  const v: ProjectVersion = {
    id: newId('v_'),
    projectId: project.id,
    savedAt: new Date().toISOString(),
    project: cloneDeep(project),
  };
  const trimmed = label?.trim();
  if (trimmed) v.label = trimmed;
  const max = detectMode() === 'local' ? MAX_VERSIONS_LOCAL : MAX_VERSIONS;
  const next = [v, ...list].slice(0, max);
  try {
    await storeSet(versionsKey(project.id), next);
  } catch (e) {
    try {
      await storeSet(versionsKey(project.id), next.slice(0, 3));
    } catch {
      toast(`Version konnte nicht gesichert werden: ${e instanceof Error ? e.message : String(e)}`, 'error');
      return null;
    }
  }
  lastVersionedUpdatedAt = project.updatedAt;
  useProjectIndex.setState((s) => ({ versionsNonce: s.versionsNonce + 1 }));
  return v;
}

/** Automatische Version, wenn sich das Projekt seit der letzten Version geändert hat. */
export async function autoVersion(): Promise<void> {
  if (!useProjectIndex.getState().ready) return;
  const p = currentProject();
  if (lastVersionedUpdatedAt === null) {
    const list = await listVersions(p.id);
    lastVersionedUpdatedAt = list[0]?.project.updatedAt ?? null;
  }
  if (p.updatedAt === lastVersionedUpdatedAt) return;
  await saveVersion(undefined, p);
}

/** Stellt eine Version wieder her (vorher wird der aktuelle Stand als Version gesichert). */
export async function restoreVersion(versionId: string): Promise<boolean> {
  const cur = currentProject();
  const list = await listVersions(cur.id);
  const v = list.find((x) => x.id === versionId);
  if (!v) {
    toast('Version nicht gefunden.', 'error');
    return false;
  }
  const r = validateProject(v.project);
  if (!r.ok) {
    toast(`Version ist beschädigt und kann nicht wiederhergestellt werden (${r.errors[0]}).`, 'error');
    return false;
  }
  await flushSave();
  await saveVersion('Vor Wiederherstellung', cur);
  const restored: Project = { ...migrateProject(r.project), id: cur.id, updatedAt: new Date().toISOString() };
  applyProject(restored);
  await persistProject(restored);
  lastVersionedUpdatedAt = null;
  toast(`Version vom ${formatDateTime(v.savedAt)} wiederhergestellt.`, 'success');
  return true;
}

export async function deleteVersion(versionId: string, projectId: string = currentProject().id): Promise<void> {
  const list = await listVersions(projectId);
  await storeSet(versionsKey(projectId), list.filter((v) => v.id !== versionId));
  useProjectIndex.setState((s) => ({ versionsNonce: s.versionsNonce + 1 }));
}

/* ------------------------------------------------------------------ */
/* Projekte                                                            */
/* ------------------------------------------------------------------ */

export function listProjects(): ProjectSummary[] {
  return readIndex();
}
export function getActiveProjectId(): string | null {
  return useProjectIndex.getState().activeId ?? readActiveId();
}
/** Anzeigename: „Projekt – Variante“. */
export function displayName(p: Pick<Project, 'name' | 'variantName'>): string {
  return p.variantName && p.variantName !== p.name ? `${p.name} – ${p.variantName}` : p.name;
}

async function projectExists(id: string): Promise<boolean> {
  if (readIndex().some((s) => s.id === id)) return true;
  return (await storeGet<unknown>(projectKey(id))) !== undefined;
}

/**
 * Legt ein neues Projekt an und öffnet es.
 * - ohne Argument: erste Vorlage (TEMPLATES[0])
 * - ProjectTemplate: Vorlage
 * - Project (z. B. aus JSON-Import): wird übernommen; existiert die ID bereits, entsteht eine Kopie mit neuer ID.
 */
export async function createProject(template?: ProjectTemplate | Project, name?: string): Promise<Project> {
  await flushSave();
  let p: Project;
  if (template && 'floors' in template) {
    const src = migrateProject(template);
    const trimmed = name?.trim();
    if (await projectExists(src.id)) {
      p = newProjectFrom(src, trimmed || src.name);
    } else {
      p = cloneDeep(src);
      if (trimmed) p.name = trimmed;
    }
  } else {
    p = createFromTemplate(template ?? TEMPLATES[0], name);
  }
  applyProject(p);
  setActiveId(p.id);
  await persistProject(p);
  lastVersionedUpdatedAt = null;
  useUiStore.getState().requestFit();
  return p;
}

/** Öffnet ein gespeichertes Projekt. */
export async function openProject(id: string): Promise<boolean> {
  if (currentProject().id === id && useProjectIndex.getState().activeId === id) return true;
  await flushSave();
  const r = await loadStoredProject(id);
  if (!r) {
    toast('Projekt wurde nicht gefunden.', 'error');
    removeSummary(id);
    return false;
  }
  applyProject(r.project);
  setActiveId(id);
  upsertSummary(r.project);
  lastVersionedUpdatedAt = null;
  if (r.migrated) await persistProject(r.project);
  else useSaveStatus.setState({ status: 'saved', dirty: false, error: null, lastSavedAt: r.project.updatedAt });
  useUiStore.getState().requestFit();
  return true;
}

export async function renameProject(id: string, name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const cur = currentProject();
  if (cur.id === id) {
    transaction(() => useProjectStore.getState().renameProject(trimmed));
    await flushSave();
    return true;
  }
  const r = await loadStoredProject(id);
  if (!r) return false;
  const p: Project = { ...r.project, name: trimmed, updatedAt: new Date().toISOString() };
  try {
    await storeSet(projectKey(id), p);
    upsertSummary(p);
    return true;
  } catch (e) {
    toast(`Umbenennen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
    return false;
  }
}

async function sourceProject(id: string): Promise<Project | null> {
  const cur = currentProject();
  if (cur.id === id) {
    await flushSave();
    return cur;
  }
  const r = await loadStoredProject(id);
  return r?.project ?? null;
}

/** Dupliziert ein Projekt (eigenständige Kopie, keine Variante) und öffnet die Kopie. */
export async function duplicateProject(id: string, name?: string): Promise<Project | null> {
  const src = await sourceProject(id);
  if (!src) {
    toast('Projekt wurde nicht gefunden.', 'error');
    return null;
  }
  const copy = newProjectFrom(src, name?.trim() || `${src.name} (Kopie)`);
  applyProject(copy);
  setActiveId(copy.id);
  await persistProject(copy);
  lastVersionedUpdatedAt = null;
  toast(`Kopie „${copy.name}“ angelegt.`, 'success');
  return copy;
}

/** Legt eine Variante an (gleicher Projektname, eigener Variantenname, parentId = Ursprungsprojekt) und öffnet sie. */
export async function createVariant(id: string, variantName: string): Promise<Project | null> {
  const src = await sourceProject(id);
  if (!src) {
    toast('Projekt wurde nicht gefunden.', 'error');
    return null;
  }
  const vn = variantName.trim() || `Variante ${String.fromCharCode(65 + Math.min(25, readIndex().filter((s) => s.parentId === (src.parentId ?? src.id)).length))}`;
  const v = newProjectFrom(src, vn, true);
  v.name = src.name;
  v.variantName = vn;
  applyProject(v);
  setActiveId(v.id);
  await persistProject(v);
  lastVersionedUpdatedAt = null;
  toast(`Variante „${vn}“ angelegt.`, 'success');
  return v;
}

/** Löscht ein Projekt samt Versionen. Das letzte Projekt kann nicht gelöscht werden; ist es aktiv, wird ein anderes geöffnet. */
export async function deleteProject(id: string): Promise<boolean> {
  const list = readIndex();
  if (list.length <= 1 && (list.length === 0 || list[0].id === id)) {
    toast('Das letzte Projekt kann nicht gelöscht werden.', 'warning');
    return false;
  }
  const wasActive = currentProject().id === id;
  deletedIds.add(id);
  if (wasActive) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    pending = null;
    if (saving) await saving;
  }
  try {
    await storeDel(projectKey(id));
    await storeDel(versionsKey(id));
  } catch (e) {
    toast(`Löschen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
    deletedIds.delete(id);
    return false;
  }
  removeSummary(id);
  if (hasLocalStorage()) {
    try {
      const last = localStorage.getItem(LS_LAST_KEY);
      if (last && last.includes(`"id":"${id}"`)) localStorage.removeItem(LS_LAST_KEY);
    } catch {
      /* ignorieren */
    }
  }
  if (wasActive) {
    const next = readIndex()[0];
    const ok = next ? await openProject(next.id) : false;
    if (!ok) await createProject(TEMPLATES[0]);
  }
  toast('Projekt gelöscht.', 'info');
  return true;
}

/* ------------------------------------------------------------------ */
/* Sicherung aller Projekte                                            */
/* ------------------------------------------------------------------ */

export interface BackupFile {
  format: 'gymplanner-backup';
  exportedAt: string;
  projects: Project[];
}

/** Alle gespeicherten Projekte als JSON-Text (Backup). */
export async function exportAll(): Promise<string> {
  await flushSave();
  const projects: Project[] = [];
  for (const s of readIndex()) {
    const p = await getStoredProject(s.id);
    if (p) projects.push(p);
  }
  const file: BackupFile = { format: 'gymplanner-backup', exportedAt: new Date().toISOString(), projects };
  return JSON.stringify(file, null, 2);
}

/** Importiert ein Backup; vorhandene IDs werden als Kopien mit neuer ID angelegt. Liefert die Anzahl importierter Projekte. */
export async function importAll(json: string): Promise<number> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  const file = raw as Partial<BackupFile>;
  if (!file || file.format !== 'gymplanner-backup' || !Array.isArray(file.projects)) throw new Error('Keine GymPlanner-Sicherungsdatei.');
  let count = 0;
  for (const item of file.projects) {
    const r = validateProject(item);
    if (!r.ok) continue;
    let p = migrateProject(r.project);
    if (await projectExists(p.id)) p = newProjectFrom(p, p.name, !!p.parentId);
    await storeSet(projectKey(p.id), p);
    upsertSummary(p);
    count += 1;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* React-Hook                                                          */
/* ------------------------------------------------------------------ */

/** Datum/Uhrzeit kurz (de-DE). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * In App.tsx aufrufen: lädt das aktive Projekt beim Start, speichert Änderungen debounced,
 * sichert bei beforeunload synchron in den localStorage-Fallback und legt periodisch Versionen an.
 */
export function usePersistence() {
  useEffect(() => {
    void initPersistence();
    const unsub = useProjectStore.subscribe((s, prev) => {
      if (s.project === prev.project || suppressSave) return;
      scheduleSave(s.project);
    });
    const onUnload = () => {
      const p = currentProject();
      if (deletedIds.has(p.id)) return;
      writeLastProjectSync(p);
      if (pending && detectMode() === 'local') {
        try {
          localSet(projectKey(pending.id), pending);
          upsertSummary(pending);
          pending = null;
        } catch {
          /* Quota – Notfallkopie reicht */
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        onUnload();
        void flushSave();
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_INDEX_KEY) useProjectIndex.setState({ projects: readIndex() });
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    const versionTimer = setInterval(() => void autoVersion(), AUTO_VERSION_INTERVAL_MS);
    return () => {
      unsub();
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      clearInterval(versionTimer);
    };
  }, []);
}

/** Nur für Tests: setzt den Modulzustand zurück. */
export function __resetPersistenceForTests() {
  mode = null;
  fallbackAnnounced = false;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  pending = null;
  saving = null;
  suppressSave = false;
  deletedIds.clear();
  initPromise = null;
  lastVersionedUpdatedAt = null;
  useProjectIndex.setState({ projects: readIndex(), activeId: readActiveId(), versionsNonce: 0, ready: false, storage: null });
  useSaveStatus.setState({ status: 'idle', lastSavedAt: null, error: null, dirty: false });
}
