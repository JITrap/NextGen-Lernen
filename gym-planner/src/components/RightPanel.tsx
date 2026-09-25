import { useUiStore, type RightPanel as PanelId } from '@/store/uiStore';
import { LibraryPanel } from './LibraryPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { OverviewPanel } from './OverviewPanel';
import { LayersPanel } from './LayersPanel';
import { ProjectsPanel } from './ProjectsPanel';

const TABS: { id: PanelId; label: string }[] = [
  { id: 'library', label: 'Bibliothek' },
  { id: 'properties', label: 'Eigenschaften' },
  { id: 'overview', label: 'Übersicht' },
  { id: 'layers', label: 'Ebenen' },
  { id: 'projects', label: 'Projekte' },
];

/** Platzhalter-Rahmen – wird durch die vollständige Implementierung ersetzt. */
export function RightPanel() {
  const panel = useUiStore((s) => s.rightPanel);
  const setPanel = useUiStore((s) => s.setRightPanel);
  return (
    <aside className="flex w-80 flex-col border-l gp-panel">
      <nav className="flex gap-1 border-b p-1 gp-border">
        {TABS.map((t) => (
          <button key={t.id} className={`gp-tab ${panel === t.id ? 'active' : ''}`} onClick={() => setPanel(t.id)}>{t.label}</button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {panel === 'library' && <LibraryPanel />}
        {panel === 'properties' && <PropertiesPanel />}
        {panel === 'overview' && <OverviewPanel />}
        {panel === 'layers' && <LayersPanel />}
        {panel === 'projects' && <ProjectsPanel />}
      </div>
    </aside>
  );
}
