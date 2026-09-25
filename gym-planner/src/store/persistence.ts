/**
 * Speicherung: Autosave, Projektverwaltung, Varianten und Versionsverlauf.
 *
 * Ablage:
 * - localStorage 'gymplanner.projects'      Projektindex (ProjectSummary[])
 * - localStorage 'gymplanner.activeProject' ID des aktiven Projekts
 * - localStorage 'gymplanner.lastProject'   Notfallkopie des aktiven Projekts { savedAt, project } (synchron bei beforeunload)
 * - localStorage 'gymplanner.lastSaved'     { id, savedAt } der letzten erfolgreichen Speicherung (monoton, unabhängig von updatedAt)
 * - IndexedDB (idb-keyval) 'project:<id>'   Projektdaten, 'versions:<id>' Versionsverlauf (max. MAX_VERSIONS)
 * Ist IndexedDB nicht verfügbar (oder schlägt fehl), werden dieselben Schlüssel unter 'gymplanner.data.<key>'
 * im localStorage abgelegt.
 *
 * usePersistence() wird einmal in App.tsx aufgerufen: lädt beim Start das aktive Projekt (oder legt eines aus der
 * ersten Vorlage an), speichert nach jeder Änderung debounced (800 ms) und legt alle 2 Minuten automatisch eine
 * Version an, wenn sich das Projekt geändert hat.
 *
 * Mehrere Tabs: Vor jedem Autosave wird der gespeicherte Stand gelesen; weicht er vom zuletzt in diesem Tab
 * gelesenen/geschriebenen Stand ab, wird nicht überschrieben (Status 'error', Hinweis „In einem anderen Tab geändert“).
 * Explizites saveNow() überschreibt. Über BroadcastChannel('gymplanner') (falls verfügbar) erfahren andere Tabs von
 * Löschungen und Speicherungen.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';
import type { Project, ProjectSummary, ProjectVersion } from '@/types';
import { useProjectStore, loadProject, newProjectFrom, transaction } from './projectStore';
import { useUiStore } from './uiStore';
import { createEmptyProject, cloneDeep } from './factories';
import { validateProject, migrateProject } from './migrate';
import { defaultTemplate, type ProjectTemplate } from '@/data/templates';
import { polygonArea } from '@/geometry/polygon';
import { newId } from '@/utils/id';

export const LS_INDEX_KEY = 'gymplanner.projects';
export const LS_ACTIVE_KEY = 'gymplanner.activeProject';
export const LS_LAST_KEY = 'gymplanner.lastProject';
export const LS_SAVED_KEY = 'gymplanner.lastSaved';
export const CHANNEL_NAME = 'gymplanner';
export const CONFLICT_MESSAGE = 'In einem anderen Tab geändert – Seite neu laden';
export const DELETED_MESSAGE = 'Projekt wurde gelöscht – Speichern abgebrochen (Projekt als JSON sichern oder Seite neu laden)';
/** Hinweis beim Start bzw. Wechsel in den localStorage-Modus (einmalig je Sitzung). */
export const LOCAL_MODE_MESSAGE = 'IndexedDB nicht verfügbar – Speicherung im localStorage (begrenzt)';
/** Deutsche Meldung bei vollem Browserspeicher (QuotaExceededError). */
export const QUOTA_MESSAGE = 'Speicher voll – bitte alte Projekte oder Versionen löschen';
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
/** Meldet den localStorage-Modus genau einmal (Start: Info; Laufzeitfehler von IndexedDB: Warnung mit Grund). */
function announceLocalMode(reason?: unknown) {
  if (fallbackAnnounced) return;
  fallbackAnnounced = true;
  const msg = reason == null ? '' : reason instanceof Error ? reason.message : String(reason);
  toast(msg ? `${LOCAL_MODE_MESSAGE} – Grund: ${msg}.` : `${LOCAL_MODE_MESSAGE}.`, reason == null ? 'info' : 'warning');
}
function switchToLocal(reason: unknown) {
  if (mode === 'local') return;
  mode = 'local';
  useProjectIndex.setState({ storage: 'local' });
  announceLocalMode(reason);
}
export function storageMode(): StorageMode {
  return detectMode();
}

/** Voller Speicher: QuotaExceededError (Chromium/Safari, code 22) bzw. NS_ERROR_DOM_QUOTA_REACHED (Firefox, code 1014). */
export function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { name, code, message } = e as { name?: unknown; code?: unknown; message?: unknown };
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (code === 22 || code === 1014) return true;
  return typeof message === 'string' && /quota/i.test(message);
}
/** Fehlertext für Speicherfehler: bei vollem Speicher die deutsche Meldung, sonst die Fehlermeldung. */
export function storageErrorMessage(e: unknown): string {
  if (isQuotaError(e)) return QUOTA_MESSAGE;
  return e instanceof Error ? e.message : String(e);
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

type StoreReadResult<T> = { ok: true; value: T | undefined } | { ok: false; error: string };

/**
 * Liest einen Schlüssel. Ein Lesefehler (z. B. IndexedDB temporär gestört) ist vom Fehlen des Schlüssels
 * unterscheidbar: { ok: false } – der Aufrufer darf dann keine Einträge verwerfen.
 */
async function storeRead<T>(key: string): Promise<StoreReadResult<T>> {
  if (detectMode() === 'idb') {
    try {
      return { ok: true, value: await idbGet<T>(key) };
    } catch (e) {
      switchToLocal(e);
      return { ok: false, error: storageErrorMessage(e) };
    }
  }
  return { ok: true, value: localGet<T>(key) };
}
/** Bequemer Lesezugriff: Fehler → undefined (für unkritische Aufrufer). */
async function storeGet<T>(key: string): Promise<T | undefined> {
  const r = await storeRead<T>(key);
  return r.ok ? r.value : undefined;
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
    toast(`Projektliste konnte nicht gespeichert werden: ${storageErrorMessage(e)}`, 'error');
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
/** Nächster Schreibvorgang ist ein explizites Speichern (überschreibt Konflikte/Löschsperre). */
let forceNextSave = false;
/** IDs gelöschter Projekte (auch aus anderen Tabs): späte Autosaves dürfen sie nicht wiederbeleben. */
const deletedIds = new Set<string>();
/** Projekt wieder freigeben, sobald es bewusst (neu) angelegt oder geöffnet wird. */
function undelete(id: string) {
  deletedIds.delete(id);
}
/**
 * updatedAt des gespeicherten Stands je Projekt, wie ihn dieser Tab zuletzt gelesen oder geschrieben hat.
 * Weicht der Speicher davon ab, hat ein anderer Tab geschrieben (Konflikt).
 */
const knownSavedAt = new Map<string, string>();
/** Projekt-ID, für die der Konflikt bereits gemeldet wurde (Toast nur einmal). */
let conflictFlagged: string | null = null;

function storedUpdatedAt(raw: unknown): string {
  const v = raw && typeof raw === 'object' ? (raw as { updatedAt?: unknown }).updatedAt : undefined;
  return typeof v === 'string' ? v : '';
}
function markConflict(id: string) {
  useSaveStatus.setState({ status: 'error', error: CONFLICT_MESSAGE, dirty: true });
  if (conflictFlagged !== id) {
    conflictFlagged = id;
    toast(`${CONFLICT_MESSAGE}. Ungespeicherte Änderungen können über „Speichern“ erzwungen werden.`, 'error');
  }
}

/* ---- Tab-übergreifende Benachrichtigungen (BroadcastChannel, optional) ---- */

export type ChannelMessage =
  | { type: 'project-deleted'; id: string }
  | { type: 'project-saved'; id: string; updatedAt: string };

let channel: BroadcastChannel | null = null;

/** Verarbeitet eine Nachricht eines anderen Tabs (exportiert für Tests). */
export function handleChannelMessage(msg: unknown) {
  if (!msg || typeof msg !== 'object') return;
  const m = msg as Partial<ChannelMessage>;
  if (typeof m.id !== 'string') return;
  if (m.type === 'project-deleted') {
    deletedIds.add(m.id);
    useProjectIndex.setState({ projects: readIndex() });
    if (currentProject().id === m.id) {
      useSaveStatus.setState({ status: 'error', error: DELETED_MESSAGE, dirty: true });
      toast('Dieses Projekt wurde in einem anderen Tab gelöscht. Über „Speichern“ kann es wiederhergestellt werden.', 'warning');
    }
  } else if (m.type === 'project-saved') {
    useProjectIndex.setState({ projects: readIndex() });
    const at = typeof m.updatedAt === 'string' ? m.updatedAt : '';
    if (currentProject().id === m.id && knownSavedAt.get(m.id) !== at) markConflict(m.id);
  }
}
function openChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev: MessageEvent) => handleChannelMessage(ev.data);
  } catch {
    channel = null;
  }
}
function closeChannel() {
  try {
    channel?.close();
  } catch {
    /* ignorieren */
  }
  channel = null;
}
function broadcast(msg: ChannelMessage) {
  try {
    channel?.postMessage(msg);
  } catch {
    /* ignorieren */
  }
}

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

interface LastCopy {
  /** Zeitpunkt der Sicherung (monoton, unabhängig von updatedAt, das durch Undo zurückwandern kann). */
  savedAt: string;
  project: Project;
}
function writeLastProjectSync(p: Project) {
  if (!hasLocalStorage()) return;
  try {
    const copy: LastCopy = { savedAt: new Date().toISOString(), project: p };
    localStorage.setItem(LS_LAST_KEY, JSON.stringify(copy));
  } catch {
    /* Quota – ignorieren */
  }
}
/** Liest die Notfallkopie; akzeptiert auch das alte Format (nacktes Projekt, savedAt = updatedAt). */
function readLastProjectSync(): LastCopy | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(LS_LAST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const rec = parsed && typeof parsed === 'object' ? (parsed as { project?: unknown; savedAt?: unknown; floors?: unknown }) : null;
    const wrapped = !!rec && rec.project !== undefined && rec.floors === undefined;
    const projRaw = wrapped ? rec.project : parsed;
    const r = validateProject(projRaw);
    if (!r.ok) return null;
    const project = migrateProject(r.project);
    const savedAt = wrapped && typeof rec.savedAt === 'string' ? rec.savedAt : project.updatedAt;
    return { savedAt, project };
  } catch {
    return null;
  }
}
function removeLastProjectSync(id: string) {
  if (!hasLocalStorage()) return;
  try {
    const last = readLastProjectSync();
    if (last && last.project.id === id) localStorage.removeItem(LS_LAST_KEY);
    const stamp = readSavedStamp();
    if (stamp && stamp.id === id) localStorage.removeItem(LS_SAVED_KEY);
  } catch {
    /* ignorieren */
  }
}
interface SavedStamp {
  id: string;
  savedAt: string;
}
function writeSavedStamp(id: string, savedAt: string) {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify({ id, savedAt } satisfies SavedStamp));
  } catch {
    /* ignorieren */
  }
}
function readSavedStamp(): SavedStamp | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(LS_SAVED_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return !!v && typeof v === 'object' && typeof (v as SavedStamp).id === 'string' && typeof (v as SavedStamp).savedAt === 'string' ? (v as SavedStamp) : null;
  } catch {
    return null;
  }
}

/**
 * Schreibt ein Projekt in den Speicher.
 * - Gelöschte Projekte werden nicht wiederbelebt (späte Autosaves still verworfen; ist das aktive Projekt betroffen,
 *   wird das sichtbar: Status 'error').
 * - Konfliktprüfung: Hat ein anderer Tab den gespeicherten Stand geändert, wird nicht überschrieben.
 * force (explizites Speichern) setzt beides außer Kraft.
 */
async function persistProject(p: Project, force = false): Promise<boolean> {
  if (deletedIds.has(p.id)) {
    if (!force) {
      if (currentProject().id === p.id) {
        useSaveStatus.setState({ status: 'error', error: DELETED_MESSAGE, dirty: true });
        toast(DELETED_MESSAGE, 'error');
      }
      return false;
    }
    undelete(p.id);
  }
  if (!force) {
    const known = knownSavedAt.get(p.id);
    const stored = await storeRead<unknown>(projectKey(p.id));
    if (stored.ok && stored.value !== undefined && storedUpdatedAt(stored.value) !== (known ?? '')) {
      markConflict(p.id);
      return false;
    }
  }
  useSaveStatus.setState({ status: 'saving', error: null });
  try {
    await storeSet(projectKey(p.id), p);
    upsertSummary(p);
    knownSavedAt.set(p.id, p.updatedAt);
    if (conflictFlagged === p.id) conflictFlagged = null;
    const savedAt = new Date().toISOString();
    writeSavedStamp(p.id, savedAt);
    broadcast({ type: 'project-saved', id: p.id, updatedAt: p.updatedAt });
    useSaveStatus.setState({ status: 'saved', lastSavedAt: savedAt, error: null, dirty: pending !== null });
    return true;
  } catch (e) {
    const msg = storageErrorMessage(e);
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
  const force = forceNextSave;
  forceNextSave = false;
  saving = persistProject(p, force).then(() => undefined).finally(() => {
    saving = null;
  });
  await saving;
  if (pending) await flushSave();
}

/** Explizites Speichern (Schaltfläche „Speichern“): überschreibt auch einen Stand aus einem anderen Tab. Liefert true bei Erfolg. */
export async function saveNow(): Promise<boolean> {
  pending = currentProject();
  forceNextSave = true;
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
type LoadOutcome =
  | ({ kind: 'ok' } & LoadResult)
  /** Schlüssel bestätigt nicht vorhanden. */
  | { kind: 'missing' }
  /** Daten vorhanden, aber ungültig. */
  | { kind: 'corrupt'; error: string }
  /** Lesefehler (z. B. IndexedDB gestört) – Eintrag nicht verwerfen. */
  | { kind: 'error'; error: string };

/** Liest ein Projekt aus dem Speicher (validiert + migriert) und unterscheidet Fehlen, Beschädigung und Lesefehler. */
async function readStoredProject(id: string): Promise<LoadOutcome> {
  const res = await storeRead<unknown>(projectKey(id));
  if (!res.ok) return { kind: 'error', error: res.error };
  const raw = res.value;
  if (raw === undefined || raw === null) return { kind: 'missing' };
  const r = validateProject(raw);
  if (!r.ok) return { kind: 'corrupt', error: r.errors[0] };
  knownSavedAt.set(id, storedUpdatedAt(raw));
  const migrated = migrateProject(r.project);
  return { kind: 'ok', project: migrated, migrated: migrated !== r.project };
}

/** Wie readStoredProject, aber null bei allen Fehlschlägen (beschädigte Daten werden gemeldet, außer quiet). */
async function loadStoredProject(id: string, quiet = false): Promise<LoadResult | null> {
  const r = await readStoredProject(id);
  if (r.kind === 'ok') return r;
  if (r.kind === 'corrupt' && !quiet) toast(`Gespeichertes Projekt ist beschädigt und kann nicht geladen werden (${r.error}).`, 'error');
  return null;
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
    if (detectMode() === 'local') announceLocalMode();
    let index = readIndex();
    if (!index.length) index = await rebuildIndexFromStorage();
    const activeId = readActiveId();
    const last = readLastProjectSync();
    const stamp = readSavedStamp();
    let project: Project | null = null;
    let needsPersist = false;

    if (activeId) {
      const r = await loadStoredProject(activeId);
      if (r) {
        project = r.project;
        needsPersist = r.migrated;
      }
    }
    // Notfallkopie verwenden, wenn IDB leer ist oder die Kopie jünger als die letzte Speicherung ist
    // (Vergleich über savedAt, nicht updatedAt – das wandert mit Undo zurück).
    if (last) {
      const storedAt = project && stamp && stamp.id === project.id ? stamp.savedAt : project?.updatedAt ?? '';
      const useLast = project ? last.project.id === project.id && last.savedAt > storedAt : !activeId || last.project.id === activeId;
      if (useLast) {
        project = last.project;
        needsPersist = true;
      }
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
      project = createFromTemplate(defaultTemplate());
      needsPersist = true;
    }
    undelete(project.id);
    applyProject(project);
    setActiveId(project.id);
    upsertSummary(project);
    if (needsPersist) await persistProject(project, true);
    else useSaveStatus.setState({ status: 'saved', dirty: false, error: null, lastSavedAt: project.updatedAt });
    useUiStore.getState().requestFit();
  } catch (e) {
    const msg = storageErrorMessage(e);
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
      toast(`Version konnte nicht gesichert werden: ${storageErrorMessage(e)}`, 'error');
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
  await persistProject(restored, true);
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
 * - ohne Argument: Standardvorlage (Beispielstudio, sonst leere Halle)
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
    p = createFromTemplate(template ?? defaultTemplate(), name);
  }
  undelete(p.id);
  applyProject(p);
  setActiveId(p.id);
  await persistProject(p, true);
  lastVersionedUpdatedAt = null;
  useUiStore.getState().requestFit();
  return p;
}

/** Öffnet ein gespeichertes Projekt. */
export async function openProject(id: string): Promise<boolean> {
  if (currentProject().id === id && useProjectIndex.getState().activeId === id) return true;
  await flushSave();
  const r = await readStoredProject(id);
  if (r.kind === 'missing') {
    // Bestätigt nicht vorhanden → Indexeintrag entfernen.
    toast('Projekt wurde nicht gefunden.', 'error');
    removeSummary(id);
    return false;
  }
  if (r.kind === 'error') {
    // Temporärer Speicherfehler: Eintrag behalten.
    toast(`Projekt konnte nicht geladen werden: ${r.error}`, 'error');
    return false;
  }
  if (r.kind === 'corrupt') {
    toast(`Gespeichertes Projekt ist beschädigt und kann nicht geladen werden (${r.error}).`, 'error');
    return false;
  }
  undelete(id);
  applyProject(r.project);
  setActiveId(id);
  upsertSummary(r.project);
  lastVersionedUpdatedAt = null;
  if (r.migrated) await persistProject(r.project, true);
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
    return saveNow();
  }
  const r = await loadStoredProject(id);
  if (!r) return false;
  const p: Project = { ...r.project, name: trimmed, updatedAt: new Date().toISOString() };
  try {
    await storeSet(projectKey(id), p);
    upsertSummary(p);
    knownSavedAt.set(id, p.updatedAt);
    broadcast({ type: 'project-saved', id, updatedAt: p.updatedAt });
    return true;
  } catch (e) {
    toast(`Umbenennen fehlgeschlagen: ${storageErrorMessage(e)}`, 'error');
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
  undelete(copy.id);
  applyProject(copy);
  setActiveId(copy.id);
  await persistProject(copy, true);
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
  undelete(v.id);
  applyProject(v);
  setActiveId(v.id);
  await persistProject(v, true);
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
    toast(`Löschen fehlgeschlagen: ${storageErrorMessage(e)}`, 'error');
    deletedIds.delete(id);
    return false;
  }
  removeSummary(id);
  removeLastProjectSync(id);
  knownSavedAt.delete(id);
  broadcast({ type: 'project-deleted', id });
  if (wasActive) {
    const next = readIndex()[0];
    const ok = next ? await openProject(next.id) : false;
    if (!ok) await createProject(defaultTemplate());
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
    undelete(p.id);
    await storeSet(projectKey(p.id), p);
    upsertSummary(p);
    knownSavedAt.set(p.id, p.updatedAt);
    broadcast({ type: 'project-saved', id: p.id, updatedAt: p.updatedAt });
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
    openChannel();
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
      closeChannel();
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
  forceNextSave = false;
  deletedIds.clear();
  knownSavedAt.clear();
  conflictFlagged = null;
  closeChannel();
  initPromise = null;
  lastVersionedUpdatedAt = null;
  useProjectIndex.setState({ projects: readIndex(), activeId: readActiveId(), versionsNonce: 0, ready: false, storage: null });
  useSaveStatus.setState({ status: 'idle', lastSavedAt: null, error: null, dirty: false });
}
