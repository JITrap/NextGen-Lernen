/**
 * Fehlergrenze (Error Boundary): fängt Render-Ausnahmen ab, statt eine weiße Seite zu zeigen.
 *
 * - variant="app": ganzseitige Fehleranzeige mit „Neu laden“, „Projekt als JSON sichern“ (serializeProject) und
 *   „Anderes Projekt öffnen“ (Projektliste aus der Speicherung). Wird in main.tsx um <App/> gelegt.
 * - variant="section": kompakte Anzeige für einen Teilbereich (Zeichenfläche, 3D-Ansicht, Seitenpanel) mit
 *   „Bereich zurücksetzen“ – die übrige Oberfläche bleibt bedienbar.
 *
 * Styling über gp-Klassen und --gp-Variablen (hell/dunkel).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert, RefreshCw, Download, FolderOpen, RotateCcw } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { listProjects, openProject, displayName, getActiveProjectId } from '@/store/persistence';
import { serializeProject, downloadBlob, safeFileName, JSON_FILE_SUFFIX } from '@/export';

interface Props {
  children: ReactNode;
  /** Ganzseitig (App) oder kompakt für einen Teilbereich. Standard: 'section'. */
  variant?: 'app' | 'section';
  /** Name des Bereichs (nur variant="section"), z. B. „Zeichenfläche“. */
  label?: string;
  /** Zusätzliche Klassen für den Fallback-Container (z. B. Panelbreite beibehalten). */
  className?: string;
}

interface State {
  error: Error | null;
  showProjects: boolean;
  /** Rückmeldung der Aktionen (z. B. Export fehlgeschlagen). */
  note: string | null;
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  return String(e);
}

/** Aktuelles Projekt als JSON-Datei sichern (auch wenn die Oberfläche nicht mehr rendert). */
export function downloadCurrentProjectJson(): string | null {
  try {
    const p = useProjectStore.getState().project;
    const text = serializeProject(p);
    const label = p.variantName ? `${p.name} – ${p.variantName}` : p.name;
    downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), `${safeFileName(label)}${JSON_FILE_SUFFIX}`);
    return null;
  } catch (e) {
    return `Sicherung fehlgeschlagen: ${errorText(e)}`;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, showProjects: false, note: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)), showProjects: false, note: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GymPlanner] Render-Fehler', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null, showProjects: false, note: null });

  private reload = () => {
    window.location.reload();
  };

  private exportJson = () => {
    const note = downloadCurrentProjectJson();
    this.setState({ note: note ?? 'Projekt als JSON-Datei gesichert.' });
  };

  private open = async (id: string) => {
    try {
      const ok = await openProject(id);
      if (ok) this.reset();
      else this.setState({ note: 'Projekt konnte nicht geöffnet werden.' });
    } catch (e) {
      this.setState({ note: `Öffnen fehlgeschlagen: ${errorText(e)}` });
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const variant = this.props.variant ?? 'section';
    if (variant === 'section') return this.renderSection(error);
    return this.renderApp(error);
  }

  private renderSection(error: Error) {
    const label = this.props.label ?? 'Bereich';
    return (
      <div role="alert" className={`flex h-full items-center justify-center p-4 ${this.props.className ?? 'w-full'}`} style={{ background: 'var(--gp-bg)', color: 'var(--gp-text)' }}>
        <div className="gp-card max-w-md text-sm">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <TriangleAlert size={18} className="gp-danger" aria-hidden="true" />
            Da ist etwas schiefgelaufen ({label})
          </div>
          <p className="gp-muted mb-3 break-words">{errorText(error)}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="gp-btn gp-btn-primary" onClick={this.reset}>
              <RotateCcw size={14} aria-hidden="true" /> Bereich zurücksetzen
            </button>
            <button type="button" className="gp-btn" onClick={this.reload}>
              <RefreshCw size={14} aria-hidden="true" /> Neu laden
            </button>
          </div>
        </div>
      </div>
    );
  }

  private renderApp(error: Error) {
    const { showProjects, note } = this.state;
    const projects = showProjects ? listProjects() : [];
    const activeId = showProjects ? getActiveProjectId() : null;
    return (
      <div role="alert" className="flex h-full w-full items-center justify-center p-6" style={{ background: 'var(--gp-bg)', color: 'var(--gp-text)' }}>
        <div className="gp-card w-full max-w-lg shadow-lg">
          <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <TriangleAlert size={22} className="gp-danger" aria-hidden="true" />
            Da ist etwas schiefgelaufen
          </div>
          <p className="mb-1 text-sm">Die Oberfläche konnte nicht dargestellt werden. Dein Projekt ist im Speicher weiterhin vorhanden.</p>
          <pre className="gp-muted mb-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border p-2 text-xs gp-border" style={{ background: 'var(--gp-bg)' }}>
            {errorText(error)}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="gp-btn gp-btn-primary" onClick={this.reload}>
              <RefreshCw size={14} aria-hidden="true" /> Neu laden
            </button>
            <button type="button" className="gp-btn" onClick={this.exportJson}>
              <Download size={14} aria-hidden="true" /> Projekt als JSON sichern
            </button>
            <button type="button" className="gp-btn" aria-expanded={showProjects} onClick={() => this.setState((s) => ({ showProjects: !s.showProjects, note: null }))}>
              <FolderOpen size={14} aria-hidden="true" /> Anderes Projekt öffnen
            </button>
          </div>
          {note && <p className="mt-3 text-sm" aria-live="polite">{note}</p>}
          {showProjects && (
            <ul className="mt-3 max-h-56 divide-y overflow-auto rounded border text-sm gp-border" aria-label="Gespeicherte Projekte">
              {projects.length === 0 && <li className="gp-muted px-3 py-2">Keine gespeicherten Projekte gefunden.</li>}
              {projects.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:[background:color-mix(in_srgb,var(--gp-accent)_10%,transparent)] disabled:opacity-50"
                    disabled={s.id === activeId}
                    title={s.id === activeId ? 'Dieses Projekt ist bereits geöffnet' : `„${displayName(s)}“ öffnen`}
                    onClick={() => void this.open(s.id)}
                  >
                    <span className="truncate">{displayName(s)}</span>
                    <span className="gp-muted shrink-0 text-xs">{s.floorCount} Stockwerk{s.floorCount === 1 ? '' : 'e'} · {s.totalAreaM2} m²</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }
}
