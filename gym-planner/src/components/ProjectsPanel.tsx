/**
 * Panel „Projekte“: Projektliste (gruppiert nach Ursprungsprojekt, Varianten eingerückt), Neu/Import,
 * Aktionen je Projekt, Versionsverlauf des aktiven Projekts und Variantenvergleich.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FolderOpen, Plus, Upload, Download, Copy, GitBranch, Pencil, Trash, RotateCcw, Save, Check, X, Clock, LoaderCircle,
  TriangleAlert, Columns2, Archive, Database, HardDrive, FolderPlus,
} from 'lucide-react';
import type { Project, ProjectSummary, ProjectVersion } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import {
  useProjectIndex, useSaveStatus, createProject, openProject, renameProject, duplicateProject, deleteProject, createVariant,
  listVersions, saveVersion, restoreVersion, getStoredProject, exportAll, importAll, formatDateTime, displayName, saveNow,
  MAX_VERSIONS, MAX_VERSIONS_LOCAL,
} from '@/store/persistence';
import { TEMPLATES, type ProjectTemplate } from '@/data/templates';
import { exportJson, pickJsonFile, importProjectFromText, downloadBlob, safeFileName } from '@/export/json';
import { bomRows, bomTotals } from '@/export/csv';
import { projectAreaBalance } from '@/export/pdf';
import { formatM2, formatKg, formatEur } from '@/geometry/units';

/* ------------------------------------------------------------------ */
/* Helfer                                                              */
/* ------------------------------------------------------------------ */

interface GroupedProject {
  root: ProjectSummary;
  variants: ProjectSummary[];
}

/** Gruppiert nach Ursprungsprojekt; Varianten ohne (noch) vorhandenes Ursprungsprojekt werden als eigene Wurzel gezeigt. */
export function groupProjects(list: ProjectSummary[]): GroupedProject[] {
  const ids = new Set(list.map((p) => p.id));
  const roots = list.filter((p) => !p.parentId || !ids.has(p.parentId));
  return roots.map((root) => ({
    root,
    variants: list.filter((p) => p.parentId === root.id && p.id !== root.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}

interface ProjectStats {
  name: string;
  grossM2: number;
  netM2: number;
  rooms: number;
  items: number;
  weightKg: number;
  costEur: number;
  costIncomplete: boolean;
  floors: number;
}

export function projectStats(p: Project): ProjectStats {
  const balance = projectAreaBalance(p);
  const rows = bomRows(p);
  const totals = bomTotals(rows);
  return {
    name: displayName(p),
    grossM2: balance.grossM2,
    netM2: balance.netM2,
    rooms: balance.byType.reduce((s, t) => s + t.count, 0),
    items: totals.anzahl,
    weightKg: totals.gewicht,
    costEur: totals.summe,
    costIncomplete: totals.ohnePreis > 0,
    floors: p.floors.length,
  };
}

function IconButton({ title, onClick, children, danger, disabled }: { title: string; onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="gp-btn h-7 w-7 justify-center px-0 py-0"
      style={danger ? { color: 'var(--gp-danger)' } : undefined}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="gp-label">{children}</h3>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Neues Projekt                                                       */
/* ------------------------------------------------------------------ */

function NewProjectForm({ onClose }: { onClose: () => void }) {
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]?.id ?? '');
  const template: ProjectTemplate | undefined = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  const [name, setName] = useState(template?.name ?? 'Neues Projekt');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useUiStore((s) => s.toast);

  const choose = (t: ProjectTemplate) => {
    setTemplateId(t.id);
    if (!touched) setName(t.name);
  };
  const submit = async () => {
    setBusy(true);
    try {
      const p = await createProject(template, name.trim() || template?.name);
      toast(`Projekt „${p.name}“ angelegt.`, 'success');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="gp-card flex flex-col gap-2" style={{ borderColor: 'var(--gp-accent)' }}>
      <label className="flex flex-col gap-1">
        <span className="gp-label">Name</span>
        <input
          className="gp-input"
          value={name}
          autoFocus
          onChange={(e) => { setName(e.target.value); setTouched(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); if (e.key === 'Escape') onClose(); }}
        />
      </label>
      <span className="gp-label">Vorlage</span>
      <div className="flex flex-col gap-1.5">
        {TEMPLATES.map((t) => {
          const active = t.id === template?.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t)}
              className="rounded-md border px-2.5 py-2 text-left transition-colors"
              style={{
                borderColor: active ? 'var(--gp-accent)' : 'var(--gp-border)',
                background: active ? 'color-mix(in srgb, var(--gp-accent) 12%, var(--gp-panel))' : 'var(--gp-bg)',
              }}
            >
              <div className="flex items-center gap-2 font-medium">
                {active ? <Check size={14} style={{ color: 'var(--gp-accent)' }} /> : <FolderPlus size={14} className="gp-muted" />}
                <span className="truncate">{t.name}</span>
              </div>
              <div className="gp-muted mt-0.5 text-xs">{t.description}</div>
            </button>
          );
        })}
        {!TEMPLATES.length && <div className="gp-muted text-xs">Keine Vorlagen verfügbar – es wird ein leeres Projekt angelegt.</div>}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="gp-btn" onClick={onClose} disabled={busy}>Abbrechen</button>
        <button type="button" className="gp-btn gp-btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />} Anlegen
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Projektzeile                                                        */
/* ------------------------------------------------------------------ */

type RowMode = null | 'rename' | 'variant' | 'delete';

function ProjectRow({ p, active, variant, isLast, parentName }: { p: ProjectSummary; active: boolean; variant: boolean; isLast: boolean; parentName?: string }) {
  const [mode, setMode] = useState<RowMode>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useUiStore((s) => s.toast);
  const liveName = useProjectStore((s) => (s.project.id === p.id ? s.project.name : null));
  const liveVariant = useProjectStore((s) => (s.project.id === p.id ? s.project.variantName : null));
  const name = liveName ?? p.name;
  const variantName = liveVariant ?? p.variantName;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setMode(null);
    }
  };
  const start = (m: RowMode) => {
    setMode(m);
    if (m === 'rename') setText(name);
    if (m === 'variant') setText('');
  };
  const confirm = () => {
    if (mode === 'rename') void run(async () => { if (text.trim() && text.trim() !== name) { const ok = await renameProject(p.id, text); if (ok) toast('Projekt umbenannt.', 'success'); } });
    if (mode === 'variant') void run(() => createVariant(p.id, text));
    if (mode === 'delete') void run(() => deleteProject(p.id));
  };
  const exportProject = () => void run(async () => {
    const proj = await getStoredProject(p.id);
    if (proj) exportJson(proj); else toast('Projekt wurde nicht gefunden.', 'error');
  });

  const label = variant ? (variantName ?? name) : name;
  const meta = `${formatDateTime(p.updatedAt)} · ${p.floorCount} ${p.floorCount === 1 ? 'Stockwerk' : 'Stockwerke'} · ${formatM2(p.totalAreaM2)}`;

  return (
    <div
      className={`relative rounded-md border px-2 py-1.5 ${variant ? 'ml-4' : ''}`}
      style={{
        borderColor: active ? 'var(--gp-accent)' : 'var(--gp-border)',
        background: active ? 'color-mix(in srgb, var(--gp-accent) 8%, var(--gp-panel))' : 'var(--gp-panel)',
      }}
    >
      {variant && (
        <span
          aria-hidden
          className="absolute -left-3 top-0 h-full border-l"
          style={{ borderColor: 'var(--gp-border)', height: isLast ? '50%' : '100%' }}
        />
      )}
      {variant && <span aria-hidden className="absolute -left-3 top-1/2 w-3 border-t" style={{ borderColor: 'var(--gp-border)' }} />}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {variant ? <GitBranch size={13} className="gp-muted shrink-0" /> : <FolderOpen size={13} className="gp-muted shrink-0" />}
            <span className="truncate font-medium" title={variant && parentName ? `${parentName} – ${label}` : label}>
              {variant ? `Variante ${label}: ${formatM2(p.totalAreaM2)}` : label}
            </span>
            {active && <span className="gp-badge shrink-0" style={{ background: 'var(--gp-accent)', color: 'white' }}>aktiv</span>}
          </div>
          <div className="gp-muted truncate text-[11px]" title={meta}>{meta}</div>
        </div>
      </div>

      {mode === null && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {!active && <IconButton title="Öffnen" onClick={() => void run(() => openProject(p.id))} disabled={busy}><FolderOpen size={14} /></IconButton>}
          <IconButton title="Umbenennen" onClick={() => start('rename')} disabled={busy}><Pencil size={14} /></IconButton>
          <IconButton title="Duplizieren" onClick={() => void run(() => duplicateProject(p.id))} disabled={busy}><Copy size={14} /></IconButton>
          <IconButton title="Variante anlegen" onClick={() => start('variant')} disabled={busy}><GitBranch size={14} /></IconButton>
          <IconButton title="Als JSON exportieren" onClick={exportProject} disabled={busy}><Download size={14} /></IconButton>
          <IconButton title="Löschen" onClick={() => start('delete')} disabled={busy} danger><Trash size={14} /></IconButton>
          {busy && <LoaderCircle size={14} className="animate-spin gp-muted self-center" />}
        </div>
      )}
      {(mode === 'rename' || mode === 'variant') && (
        <div className="mt-1.5 flex items-center gap-1">
          <input
            className="gp-input"
            autoFocus
            placeholder={mode === 'rename' ? 'Neuer Name' : 'Variantenname, z. B. „B: 600 m²“'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setMode(null); }}
          />
          <IconButton title={mode === 'rename' ? 'Umbenennen' : 'Variante anlegen'} onClick={confirm} disabled={busy}><Check size={14} /></IconButton>
          <IconButton title="Abbrechen" onClick={() => setMode(null)} disabled={busy}><X size={14} /></IconButton>
        </div>
      )}
      {mode === 'delete' && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1" style={{ color: 'var(--gp-danger)' }}><TriangleAlert size={13} /> Wirklich löschen?</span>
          <span className="flex gap-1">
            <button type="button" className="gp-btn px-2 py-0.5 text-xs" onClick={confirm} disabled={busy} style={{ color: 'var(--gp-danger)' }}>Löschen</button>
            <button type="button" className="gp-btn px-2 py-0.5 text-xs" onClick={() => setMode(null)} disabled={busy}>Abbrechen</button>
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Versionsverlauf                                                     */
/* ------------------------------------------------------------------ */

function VersionHistory({ projectId }: { projectId: string }) {
  const nonce = useProjectIndex((s) => s.versionsNonce);
  const storage = useProjectIndex((s) => s.storage);
  const maxVersions = storage === 'local' ? MAX_VERSIONS_LOCAL : MAX_VERSIONS;
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useUiStore((s) => s.toast);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listVersions(projectId)
      .then((v) => { if (alive) setVersions(v); })
      .catch(() => { if (alive) setVersions([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId, nonce]);

  const save = async () => {
    setBusy('save');
    try {
      const v = await saveVersion(label);
      if (v) { toast('Version gesichert.', 'success'); setLabel(''); }
    } finally {
      setBusy(null);
    }
  };
  const restore = async (id: string) => {
    setBusy(id);
    try {
      await restoreVersion(id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle right={loading ? <LoaderCircle size={12} className="animate-spin gp-muted" /> : <span className="gp-muted text-[11px]">{versions.length} / {maxVersions}</span>}>
        Versionsverlauf
      </SectionTitle>
      <div className="flex items-center gap-1">
        <input
          className="gp-input"
          placeholder="Bezeichnung (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
        />
        <button type="button" className="gp-btn shrink-0" onClick={() => void save()} disabled={busy !== null} title="Aktuellen Stand als Version sichern">
          <Save size={14} /> Sichern
        </button>
      </div>
      {versions.length === 0 && !loading && (
        <p className="gp-muted text-xs">Noch keine Versionen. Alle 2 Minuten wird bei Änderungen automatisch eine Version angelegt.</p>
      )}
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {versions.map((v) => {
          const items = v.project.floors.reduce((s, f) => s + f.items.length, 0);
          return (
            <li key={v.id} className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: 'var(--gp-border)', background: 'var(--gp-bg)' }}>
              <Clock size={13} className="gp-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{v.label ?? 'Automatisch gesichert'}</div>
                <div className="gp-muted truncate text-[11px]">{formatDateTime(v.savedAt)} · {v.project.floors.length} Stockw. · {items} Objekte</div>
              </div>
              <IconButton title="Diese Version wiederherstellen" onClick={() => void restore(v.id)} disabled={busy !== null}>
                {busy === v.id ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              </IconButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Variantenvergleich                                                  */
/* ------------------------------------------------------------------ */

function VariantCompare({ projects, activeId }: { projects: ProjectSummary[]; activeId: string | null }) {
  const [aId, setAId] = useState<string>('');
  const [bId, setBId] = useState<string>('');
  const [stats, setStats] = useState<{ a: ProjectStats | null; b: ProjectStats | null }>({ a: null, b: null });
  const [loading, setLoading] = useState(false);
  const project = useProjectStore((s) => s.project);
  const ids = useMemo(() => projects.map((p) => p.id), [projects]);

  // Sinnvolle Vorbelegung: aktives Projekt und die erste andere Variante/Projekt
  useEffect(() => {
    if (!ids.length) return;
    const a = ids.includes(aId) ? aId : (activeId && ids.includes(activeId) ? activeId : ids[0]);
    let b = ids.includes(bId) && bId !== a ? bId : '';
    if (!b) {
      const aSum = projects.find((p) => p.id === a);
      const sibling = projects.find((p) => p.id !== a && (p.parentId === (aSum?.parentId ?? aSum?.id) || p.id === aSum?.parentId));
      b = sibling?.id ?? ids.find((x) => x !== a) ?? '';
    }
    if (a !== aId) setAId(a);
    if (b !== bId) setBId(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, activeId]);

  useEffect(() => {
    let alive = true;
    if (!aId && !bId) { setStats({ a: null, b: null }); return; }
    setLoading(true);
    Promise.all([aId ? getStoredProject(aId) : null, bId ? getStoredProject(bId) : null])
      .then(([pa, pb]) => { if (alive) setStats({ a: pa ? projectStats(pa) : null, b: pb ? projectStats(pb) : null }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // project als Abhängigkeit: das aktive Projekt ändert sich live
  }, [aId, bId, project]);

  if (projects.length < 2) return null;

  const optionLabel = (p: ProjectSummary) => (p.variantName ? `${p.name} – ${p.variantName}` : p.name);
  const rows: { label: string; a: string; b: string; better?: 'a' | 'b' | null }[] = [];
  const A = stats.a;
  const B = stats.b;
  const cmp = (x: number | undefined, y: number | undefined, higherIsBetter: boolean): 'a' | 'b' | null => {
    if (x == null || y == null || x === y) return null;
    return (x > y) === higherIsBetter ? 'a' : 'b';
  };
  if (A || B) {
    rows.push({ label: 'Fläche brutto', a: A ? formatM2(A.grossM2) : '–', b: B ? formatM2(B.grossM2) : '–', better: cmp(A?.grossM2, B?.grossM2, true) });
    rows.push({ label: 'Fläche netto', a: A ? formatM2(A.netM2) : '–', b: B ? formatM2(B.netM2) : '–', better: cmp(A?.netM2, B?.netM2, true) });
    rows.push({ label: 'Stockwerke', a: A ? String(A.floors) : '–', b: B ? String(B.floors) : '–' });
    rows.push({ label: 'Räume/Zonen', a: A ? String(A.rooms) : '–', b: B ? String(B.rooms) : '–' });
    rows.push({ label: 'Geräte/Objekte', a: A ? String(A.items) : '–', b: B ? String(B.items) : '–', better: cmp(A?.items, B?.items, true) });
    rows.push({ label: 'Gewicht', a: A ? formatKg(A.weightKg) : '–', b: B ? formatKg(B.weightKg) : '–', better: cmp(A?.weightKg, B?.weightKg, false) });
    rows.push({ label: 'Kosten', a: A ? `${formatEur(A.costEur)}${A.costIncomplete ? ' *' : ''}` : '–', b: B ? `${formatEur(B.costEur)}${B.costIncomplete ? ' *' : ''}` : '–', better: cmp(A?.costEur, B?.costEur, false) });
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle right={loading ? <LoaderCircle size={12} className="animate-spin gp-muted" /> : undefined}>Varianten vergleichen</SectionTitle>
      <div className="grid grid-cols-2 gap-1">
        <select className="gp-input" value={aId} onChange={(e) => setAId(e.target.value)} aria-label="Variante A">
          {projects.map((p) => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
        </select>
        <select className="gp-input" value={bId} onChange={(e) => setBId(e.target.value)} aria-label="Variante B">
          {projects.map((p) => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
        </select>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="gp-muted">
            <th className="py-1 text-left font-medium"><Columns2 size={12} className="inline" /></th>
            <th className="max-w-[90px] truncate py-1 text-right font-medium" title={A?.name}>{A?.name ?? 'A'}</th>
            <th className="max-w-[90px] truncate py-1 text-right font-medium" title={B?.name}>{B?.name ?? 'B'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t" style={{ borderColor: 'var(--gp-border)' }}>
              <td className="py-1 pr-1">{r.label}</td>
              <td className="py-1 text-right tabular-nums" style={r.better === 'a' ? { color: 'var(--gp-ok)', fontWeight: 600 } : undefined}>{r.a}</td>
              <td className="py-1 text-right tabular-nums" style={r.better === 'b' ? { color: 'var(--gp-ok)', fontWeight: 600 } : undefined}>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(A?.costIncomplete || B?.costIncomplete) && <p className="gp-muted text-[11px]">* Kosten unvollständig – nicht alle Positionen haben einen Preis.</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

function SaveStatusLine() {
  const status = useSaveStatus((s) => s.status);
  const lastSavedAt = useSaveStatus((s) => s.lastSavedAt);
  const error = useSaveStatus((s) => s.error);
  const storage = useProjectIndex((s) => s.storage);
  const text =
    status === 'saving' ? 'Wird gespeichert …'
      : status === 'error' ? `Fehler: ${error ?? 'unbekannt'}`
        : status === 'saved' && lastSavedAt ? `Gespeichert ${formatDateTime(lastSavedAt)}`
          : 'Automatisches Speichern aktiv';
  const color = status === 'error' ? 'var(--gp-danger)' : status === 'saved' ? 'var(--gp-ok)' : 'var(--gp-muted)';
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="flex items-center gap-1" style={{ color }}>
        {status === 'saving' ? <LoaderCircle size={12} className="animate-spin" /> : status === 'error' ? <TriangleAlert size={12} /> : <Check size={12} />}
        <span className="truncate">{text}</span>
      </span>
      <span className="gp-muted flex shrink-0 items-center gap-1" title={storage === 'local' ? 'IndexedDB nicht verfügbar – Speicherung im localStorage' : 'Speicherung in IndexedDB'}>
        {storage === 'local' ? <HardDrive size={12} /> : <Database size={12} />}
        {storage === 'local' ? 'localStorage' : 'IndexedDB'}
      </span>
    </div>
  );
}

export function ProjectsPanel() {
  const projects = useProjectIndex((s) => s.projects);
  const activeId = useProjectIndex((s) => s.activeId);
  const ready = useProjectIndex((s) => s.ready);
  const projectId = useProjectStore((s) => s.project.id);
  const toast = useUiStore((s) => s.toast);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => groupProjects(projects), [projects]);
  const currentId = activeId ?? projectId;

  const importFile = async () => {
    setBusy(true);
    try {
      const picked = await pickJsonFile();
      if (!picked) return;
      let isBackup = false;
      try {
        const raw = JSON.parse(picked.text) as { format?: string };
        isBackup = raw?.format === 'gymplanner-backup';
      } catch {
        /* Fehler wird unten gemeldet */
      }
      if (isBackup) {
        const n = await importAll(picked.text);
        toast(`${n} Projekt(e) aus Sicherung importiert.`, 'success');
        return;
      }
      const project = importProjectFromText(picked.text);
      const p = await createProject(project);
      toast(`Projekt „${p.name}“ importiert.`, 'success');
    } catch (e) {
      toast(`Import fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  const backupAll = async () => {
    setBusy(true);
    try {
      const text = await exportAll();
      downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), `${safeFileName('GymPlanner-Sicherung')}-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Sicherung aller Projekte exportiert.', 'success');
    } catch (e) {
      toast(`Sicherung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-3 text-sm">
      <section className="flex flex-col gap-2">
        <SectionTitle
          right={
            <span className="flex gap-1">
              <button type="button" className="gp-btn px-2 py-1 text-xs" title="Jetzt speichern" onClick={() => void saveNow().then((ok) => ok && toast('Projekt gespeichert.', 'success'))}>
                <Save size={13} />
              </button>
              <button type="button" className="gp-btn px-2 py-1 text-xs" title="Sicherung aller Projekte herunterladen" onClick={() => void backupAll()} disabled={busy}>
                <Archive size={13} />
              </button>
            </span>
          }
        >
          Projekte
        </SectionTitle>
        <SaveStatusLine />
        <div className="flex gap-1.5">
          <button type="button" className="gp-btn gp-btn-primary flex-1 justify-center" onClick={() => setNewOpen((v) => !v)} disabled={busy}>
            <Plus size={14} /> Neues Projekt
          </button>
          <button type="button" className="gp-btn flex-1 justify-center" onClick={() => void importFile()} disabled={busy} title="Projekt (.gymplanner.json) oder Sicherung importieren">
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />} Importieren
          </button>
        </div>
        {newOpen && <NewProjectForm onClose={() => setNewOpen(false)} />}
      </section>

      <section className="flex flex-col gap-1.5">
        {!ready && <div className="gp-muted flex items-center gap-1 text-xs"><LoaderCircle size={12} className="animate-spin" /> Projekte werden geladen …</div>}
        {ready && !groups.length && <div className="gp-muted text-xs">Keine Projekte vorhanden.</div>}
        {groups.map((g) => (
          <div key={g.root.id} className="flex flex-col gap-1.5">
            <ProjectRow p={g.root} active={g.root.id === currentId} variant={false} isLast />
            {g.variants.map((v, i) => (
              <ProjectRow key={v.id} p={v} active={v.id === currentId} variant isLast={i === g.variants.length - 1} parentName={g.root.name} />
            ))}
          </div>
        ))}
      </section>

      {currentId && <VersionHistory projectId={currentId} />}
      <VariantCompare projects={projects} activeId={currentId} />
    </div>
  );
}
