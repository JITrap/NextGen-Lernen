import type { ReactNode } from 'react';
import { Library, SlidersHorizontal, ChartPie, Layers, FolderOpen } from 'lucide-react';
import { useUiStore, type RightPanel as PanelId } from '@/store/uiStore';
import { LibraryPanel } from './LibraryPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { OverviewPanel } from './OverviewPanel';
import { LayersPanel } from './LayersPanel';
import { ProjectsPanel } from './ProjectsPanel';
import { useMediaQuery } from './ui/hooks';

const TABS: { id: PanelId; label: string; icon: ReactNode; title: string }[] = [
  { id: 'library', label: 'Bibliothek', icon: <Library size={18} />, title: 'Bibliothek – Geräte und Objekte per Drag & Drop platzieren' },
  { id: 'properties', label: 'Eigenschaften', icon: <SlidersHorizontal size={18} />, title: 'Eigenschaften der Auswahl bzw. von Stockwerk und Halle' },
  { id: 'overview', label: 'Übersicht', icon: <ChartPie size={18} />, title: 'Übersicht – Flächenbilanz, Statistik, Stückliste, Warnungen' },
  { id: 'layers', label: 'Ebenen', icon: <Layers size={18} />, title: 'Ebenen und Einstellungen' },
  { id: 'projects', label: 'Projekte', icon: <FolderOpen size={18} />, title: 'Projekte, Varianten und Versionen' },
];

/**
 * Rechtes Seitenpanel: Tabs Bibliothek / Eigenschaften / Übersicht / Ebenen / Projekte.
 * Breite 320 px, unter 1100 px Fensterbreite 280 px (dann nur Icons in den Tabs). Der Tab
 * „Eigenschaften“ trägt eine Marke mit der Anzahl gewählter Elemente; die Auswahl wechselt
 * das Panel nicht automatisch (das tun die Werkzeuge).
 */
export function RightPanel() {
  const panel = useUiStore((s) => s.rightPanel);
  const setPanel = useUiStore((s) => s.setRightPanel);
  const selectionCount = useUiStore((s) => s.selection.length);
  const narrow = useMediaQuery('(max-width: 1099px)');

  return (
    <aside data-tutorial="right-panel" className="flex w-[320px] shrink-0 flex-col border-l gp-panel max-[1099px]:w-[280px]" aria-label="Seitenpanel">
      <nav role="tablist" aria-label="Panel wählen" className="flex shrink-0 border-b p-1 gp-border" style={{ background: 'color-mix(in srgb, var(--gp-bg) 60%, var(--gp-panel))' }}>
        {TABS.map((t) => {
          const active = panel === t.id;
          const badge = t.id === 'properties' && selectionCount > 0 ? selectionCount : null;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`right-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`right-panel-${t.id}`}
              title={badge ? `${t.title} (${badge} gewählt)` : t.title}
              onClick={() => setPanel(t.id)}
              className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[10px] font-medium leading-none transition-colors ${
                active ? '' : 'hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]'
              }`}
              style={active ? { background: 'var(--gp-accent)', color: 'white' } : { color: 'var(--gp-muted)' }}
            >
              <span className="relative inline-flex" aria-hidden="true">
                {t.icon}
                {badge != null && (
                  <span
                    className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full px-1 text-center text-[9px] font-semibold leading-4"
                    style={active ? { background: 'white', color: 'var(--gp-accent)' } : { background: 'var(--gp-accent)', color: 'white' }}
                    data-testid="properties-badge"
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              {!narrow && <span className="max-w-full truncate">{t.label}</span>}
              {narrow && <span className="sr-only">{t.label}</span>}
              {active && <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full" style={{ background: 'var(--gp-accent)' }} aria-hidden="true" />}
            </button>
          );
        })}
      </nav>
      {panel === 'library' ? (
        <div id="right-panel-library" role="tabpanel" aria-labelledby="right-tab-library" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <LibraryPanel />
        </div>
      ) : (
        <div id={`right-panel-${panel}`} role="tabpanel" aria-labelledby={`right-tab-${panel}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {panel === 'properties' && <PropertiesPanel />}
          {panel === 'overview' && <OverviewPanel />}
          {panel === 'layers' && <LayersPanel />}
          {panel === 'projects' && <ProjectsPanel />}
        </div>
      )}
    </aside>
  );
}
