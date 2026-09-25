/**
 * JSON-Export/-Import eines Projekts.
 * Das Dateiformat ist ein Umschlag { format, app, schemaVersion, exportedAt, project }; parseProject akzeptiert
 * zusätzlich ein „nacktes“ Projektobjekt. Die Serialisierung ist stabil (sortierte Schlüssel, 2 Leerzeichen),
 * sodass identische Projekte identischen Text erzeugen.
 */
import type { Project } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { validateProject, migrateProject } from '@/store/migrate';
import { SCHEMA_VERSION } from '@/store/factories';

export const JSON_FORMAT = 'gymplanner-project';
export const JSON_FILE_SUFFIX = '.gymplanner.json';
/** Maximale Größe einer Importdatei (50 MB). */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/** Liefert eine Fehlermeldung, wenn die Datei das Importlimit überschreitet, sonst null. */
export function importSizeError(file: { name: string; size: number }): string | null {
  if (!Number.isFinite(file.size) || file.size <= MAX_IMPORT_BYTES) return null;
  const mb = (n: number) => `${Math.round((n / 1048576) * 10) / 10} MB`.replace('.', ',');
  return `Datei „${file.name}“ ist zu groß (${mb(file.size)}, maximal ${mb(MAX_IMPORT_BYTES)}).`;
}

/** JSON mit rekursiv sortierten Objektschlüsseln (Arrays behalten ihre Reihenfolge). */
export function stableStringify(value: unknown, indent = 2): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const val = (v as Record<string, unknown>)[k];
        if (val !== undefined) out[k] = sort(val);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value), null, indent);
}

export interface ProjectFileEnvelope {
  format: typeof JSON_FORMAT;
  app: string;
  schemaVersion: number;
  exportedAt: string;
  project: Project;
}

/** Serialisiert ein Projekt als Datei-Text (stabil, 2 Leerzeichen, mit Exportdatum). */
export function serializeProject(p: Project, exportedAt: string = new Date().toISOString()): string {
  const env: ProjectFileEnvelope = { format: JSON_FORMAT, app: 'GymPlanner', schemaVersion: SCHEMA_VERSION, exportedAt, project: p };
  return stableStringify(env);
}

export interface ParsedProject {
  project: Project;
  warnings: string[];
  /** Exportdatum aus dem Umschlag (falls vorhanden). */
  exportedAt?: string;
}

function unwrap(raw: unknown): { project: unknown; exportedAt?: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (r.format === JSON_FORMAT || (r.project && typeof r.project === 'object' && !('floors' in r))) {
      return { project: r.project, exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : undefined };
    }
  }
  return { project: raw };
}

/** Parst, validiert und migriert; wirft Error mit deutscher Meldung. Liefert zusätzlich Warnungen. */
export function parseProjectDetailed(json: string): ParsedProject {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Die Datei enthält kein gültiges JSON (${e instanceof Error ? e.message : String(e)}).`, { cause: e });
  }
  const { project, exportedAt } = unwrap(raw);
  const r = validateProject(project);
  if (!r.ok) {
    const shown = r.errors.slice(0, 5).join('; ');
    const more = r.errors.length > 5 ? ` (+${r.errors.length - 5} weitere)` : '';
    throw new Error(`Die Datei ist keine gültige GymPlanner-Projektdatei: ${shown}${more}`);
  }
  return { project: migrateProject(r.project), warnings: r.warnings, exportedAt };
}

/** Parst ein Projekt aus JSON-Text (validiert + migriert). Wirft Error mit deutscher Meldung. */
export function parseProject(json: string): Project {
  return parseProjectDetailed(json).project;
}

/**
 * Import aus Text mit Nutzer-Feedback: Warnungen (z. B. unbekannte Geräte-IDs) werden als Toast gemeldet.
 * Das Projekt wird NICHT geladen – der Aufrufer entscheidet (z. B. persistence.createProject(project)).
 */
export function importProjectFromText(text: string): Project {
  const r = parseProjectDetailed(text);
  if (r.warnings.length) {
    const ui = useUiStore.getState();
    const first = r.warnings.slice(0, 2);
    for (const w of first) ui.toast(w, 'warning');
    if (r.warnings.length > 2) ui.toast(`… und ${r.warnings.length - 2} weitere Hinweise beim Import.`, 'warning');
  }
  return r.project;
}

/* ------------------------------------------------------------------ */
/* Download-Helfer (auch von CSV/PNG/PDF genutzt)                       */
/* ------------------------------------------------------------------ */

/** Macht aus einem Namen einen sicheren Dateinamen (Umlaute bleiben erhalten). */
export function safeFileName(name: string, fallback = 'projekt'): string {
  const s = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .slice(0, 80)
    .trim();
  return s || fallback;
}

/** Löst einen Browser-Download eines Blobs aus. */
export function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Exportiert ein Projekt als „<Name>.gymplanner.json“. Ohne Argument: aktuelles Projekt aus dem Store. */
export function exportJson(project?: Project): void {
  const p = project ?? useProjectStore.getState().project;
  try {
    const text = serializeProject(p);
    const label = p.variantName ? `${p.name} – ${p.variantName}` : p.name;
    downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), `${safeFileName(label)}${JSON_FILE_SUFFIX}`);
    useUiStore.getState().toast(`Projekt „${p.name}“ als JSON exportiert.`, 'success');
  } catch (e) {
    useUiStore.getState().toast(`JSON-Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}

/** Öffnet einen Dateidialog (.json) und liefert die Datei als Text; null bei Abbruch. */
export function pickJsonFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    let done = false;
    const finish = (v: { name: string; text: string } | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(v);
    };
    // Abbruch erkennen: „cancel“-Ereignis (moderne Browser) oder Fokus-Rückkehr ohne Datei.
    const onFocus = () => { setTimeout(() => { if (!input.files?.length) finish(null); }, 600); };
    input.addEventListener('cancel', () => finish(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { finish(null); return; }
      const sizeError = importSizeError(file);
      if (sizeError) {
        useUiStore.getState().toast(sizeError, 'error');
        finish(null);
        return;
      }
      file.text().then((text) => finish({ name: file.name, text })).catch(() => finish(null));
    });
    document.body.appendChild(input);
    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  });
}

/**
 * Dateidialog + Import. Liefert das (validierte, migrierte) Projekt oder null bei Abbruch/Fehler.
 * Fehler werden als Toast gemeldet; das Projekt wird NICHT selbst geladen.
 */
export async function importJsonFile(): Promise<Project | null> {
  const picked = await pickJsonFile();
  if (!picked) return null;
  try {
    return importProjectFromText(picked.text);
  } catch (e) {
    useUiStore.getState().toast(`Import von „${picked.name}“ fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
    return null;
  }
}
