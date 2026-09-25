import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dumbbell, Undo2, Redo2, Maximize2, Grid3x3, Magnet, Layers, Box, Presentation, Sun, Moon, Monitor, FolderOpen, CircleHelp,
  GraduationCap, Settings, Ellipsis, Check, LoaderCircle, TriangleAlert, Pencil, Building2, Keyboard, PanelLeft, PanelRight,
} from 'lucide-react';
import * as persistence from '@/store/persistence';
import { useProjectStore, undo, redo, useTemporalStore } from '@/store/projectStore';
import { useUiStore, type Theme } from '@/store/uiStore';
import { FloorTabs } from './FloorTabs';
import { ExportMenu } from './ExportMenu';
import { SettingsDialog } from './SettingsDialog';
import { GRID_OPTIONS, THEME_OPTIONS } from './LayersPanel';
import { IconButton, Button } from './ui/Button';
import { Select } from './ui/Select';
import { Dropdown, type MenuEntry } from './ui/Menu';
import { useMediaQuery, formatDateTime } from './ui/hooks';

/* ------------------------------------------------------------------ */
/* Speicherstatus (defensiv: persistence.useSaveStatus ist optional)   */
/* ------------------------------------------------------------------ */

export type SaveStatus = 'saved' | 'saving' | 'error';

function normalizeSaveStatus(v: unknown): SaveStatus {
  const s = typeof v === 'string' ? v : v && typeof v === 'object' && 'status' in v ? String((v as { status: unknown }).status) : 'saved';
  if (s === 'saving' || s === 'pending' || s === 'dirty' || s === 'unsaved') return 'saving';
  if (s === 'error' || s === 'failed') return 'error';
  return 'saved';
}
// Einmal beim Modulladen entscheiden (Hooks-Regel): externer Hook oder konstanter Ersatz.
const externalUseSaveStatus = (persistence as unknown as { useSaveStatus?: () => unknown }).useSaveStatus;
const useSaveStatus: () => SaveStatus =
  typeof externalUseSaveStatus === 'function' ? () => normalizeSaveStatus(externalUseSaveStatus()) : () => 'saved';

function SaveIndicator({ compact }: { compact: boolean }) {
  const status = useSaveStatus();
  const updatedAt = useProjectStore((s) => s.project.updatedAt);
  const cfg = {
    saved: { icon: <Check size={14} />, text: 'Gespeichert', cls: 'gp-ok' },
    saving: { icon: <LoaderCircle size={14} className="animate-spin" />, text: 'Speichert …', cls: 'gp-muted' },
    error: { icon: <TriangleAlert size={14} />, text: 'Nicht gespeichert', cls: 'gp-danger' },
  }[status];
  return (
    <span
      className={`inline-flex h-9 items-center gap-1 px-1.5 text-xs ${cfg.cls}`}
      title={`${cfg.text} · zuletzt geändert ${formatDateTime(updatedAt)} (Autosave im Browser)`}
      role="status"
      data-tutorial="topbar-save"
    >
      {cfg.icon}
      {!compact && <span>{cfg.text}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Projektname                                                         */
/* ------------------------------------------------------------------ */

function ProjectName({ compact }: { compact: boolean }) {
  const name = useProjectStore((s) => s.project.name);
  const variant = useProjectStore((s) => s.project.variantName);
  const renameProject = useProjectStore((s) => s.renameProject);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      setDraft(name);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [editing, name]);
  const commit = () => {
    const n = draft.trim();
    if (n && n !== name) renameProject(n);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        ref={inputRef}
        className="gp-input h-8 w-48 py-0 text-sm font-medium"
        value={draft}
        maxLength={80}
        aria-label="Projektname"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        className={`group inline-flex h-9 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium hover:[background:color-mix(in_srgb,var(--gp-accent)_10%,transparent)] ${compact ? 'max-w-[120px]' : 'max-w-[260px]'}`}
        title={`${name} – klicken zum Umbenennen`}
        onClick={() => setEditing(true)}
      >
        <span className="truncate">{name}</span>
        <Pencil size={12} className="shrink-0 opacity-0 gp-muted transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </button>
      {variant && (
        <span className="gp-badge shrink-0 border gp-border" style={{ color: 'var(--gp-accent)', background: 'color-mix(in srgb, var(--gp-accent) 12%, transparent)' }} title={`Variante „${variant}“`}>
          {variant}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Kopfleiste                                                          */
/* ------------------------------------------------------------------ */

const THEME_ICON: Record<Theme, React.ReactNode> = { light: <Sun size={18} />, dark: <Moon size={18} />, system: <Monitor size={18} /> };

/**
 * Kopfleiste: Logo, Projektname (editierbar), Variante, Stockwerk-Tabs, Undo/Redo, Speicherstatus,
 * Ansicht (Einpassen, Raster, Snapping, Ebenen, 3D, Präsentation), Theme, Export, Projekte, Hilfe.
 * Responsive: unter 1200 px nur Icons, unter 960 px wandern Nebenfunktionen ins „Mehr“-Menü.
 */
export function TopBar() {
  const wide = useMediaQuery('(min-width: 1200px)');
  const medium = useMediaQuery('(min-width: 960px)');
  const compact = !wide;

  const past = useTemporalStore((s) => s.pastStates.length);
  const future = useTemporalStore((s) => s.futureStates.length);

  const gridSize = useProjectStore((s) => s.project.settings.gridSize);
  const showGrid = useProjectStore((s) => s.project.settings.showGrid);
  const snapEnabled = useProjectStore((s) => s.project.settings.snapEnabled);
  const updateSettings = useProjectStore((s) => s.updateSettings);

  const requestFit = useUiStore((s) => s.requestFit);
  const rightPanel = useUiStore((s) => s.rightPanel);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const setRightPanel = useUiStore((s) => s.setRightPanel);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen);
  const toggleLeftPanel = useUiStore((s) => s.toggleLeftPanel);
  const view3d = useUiStore((s) => s.view3d);
  const setView3d = useUiStore((s) => s.setView3d);
  const view3dAll = useUiStore((s) => s.view3dAllFloors);
  const setView3dAll = useUiStore((s) => s.setView3dAllFloors);
  const setPresentation = useUiStore((s) => s.setPresentationMode);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setShowShortcuts = useUiStore((s) => s.setShowShortcuts);
  const setShowTutorial = useUiStore((s) => s.setShowTutorial);
  const toast = useUiStore((s) => s.toast);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const panelToggle = (panel: 'layers' | 'projects') => {
    if (rightPanelOpen && rightPanel === panel) toggleRightPanel();
    else setRightPanel(panel);
  };
  const startPresentation = () => {
    setPresentation(true);
    toast('Präsentationsmodus – Esc beendet', 'info');
  };

  const themeEntries: MenuEntry[] = THEME_OPTIONS.map((t) => ({ label: t.label, icon: t.icon, checked: theme === t.value, onSelect: () => setTheme(t.value) }));

  const moreEntries = useMemo<MenuEntry[]>(() => {
    const entries: MenuEntry[] = [];
    if (!medium) {
      entries.push(
        { heading: 'Ansicht' },
        { label: 'Raster anzeigen', icon: <Grid3x3 size={15} />, checked: showGrid, keepOpen: true, onSelect: () => updateSettings({ showGrid: !showGrid }) },
        { label: 'Snapping', icon: <Magnet size={15} />, checked: snapEnabled, keepOpen: true, onSelect: () => updateSettings({ snapEnabled: !snapEnabled }) },
        {
          label: `Rastergröße: ${gridSize} cm`,
          icon: <Grid3x3 size={15} />,
          children: GRID_OPTIONS.map((g) => ({ label: g.label, checked: gridSize === g.value, onSelect: () => updateSettings({ gridSize: g.value }) })),
        },
        { label: 'Ebenen & Einstellungen', icon: <Layers size={15} />, kbd: undefined, onSelect: () => panelToggle('layers') },
        { label: '3D-Ansicht', icon: <Box size={15} />, kbd: '3', checked: view3d, onSelect: () => setView3d(!view3d) },
        ...(view3d ? [{ label: 'Alle Stockwerke in 3D', checked: view3dAll, keepOpen: true, onSelect: () => setView3dAll(!view3dAll) } satisfies MenuEntry] : []),
        { label: 'Präsentationsmodus', icon: <Presentation size={15} />, kbd: 'Shift+P', onSelect: startPresentation },
        { label: 'Farbschema', icon: THEME_ICON[theme], children: themeEntries },
        { separator: true },
        { label: 'Projekte & Varianten', icon: <FolderOpen size={15} />, onSelect: () => panelToggle('projects') },
      );
    }
    entries.push(
      { label: leftPanelOpen ? 'Werkzeugleiste ausblenden' : 'Werkzeugleiste einblenden', icon: <PanelLeft size={15} />, onSelect: toggleLeftPanel },
      { label: rightPanelOpen ? 'Seitenpanel ausblenden' : 'Seitenpanel einblenden', icon: <PanelRight size={15} />, onSelect: toggleRightPanel },
      { separator: true },
      { label: 'Einstellungen …', icon: <Settings size={15} />, onSelect: () => setSettingsOpen(true) },
      { label: 'Tastenkürzel', icon: <Keyboard size={15} />, kbd: '?', onSelect: () => setShowShortcuts(true) },
      { label: 'Tutorial starten', icon: <GraduationCap size={15} />, onSelect: () => setShowTutorial(true) },
    );
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medium, showGrid, snapEnabled, gridSize, view3d, view3dAll, theme, leftPanelOpen, rightPanelOpen, rightPanel]);

  const helpEntries: MenuEntry[] = [
    { label: 'Tastenkürzel', icon: <Keyboard size={15} />, kbd: '?', onSelect: () => setShowShortcuts(true) },
    { label: 'Tutorial starten', icon: <GraduationCap size={15} />, onSelect: () => setShowTutorial(true) },
  ];

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2 gp-panel" role="banner">
      {/* Logo + Projekt */}
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: 'var(--gp-accent)' }} aria-hidden="true">
          <Dumbbell size={18} />
        </span>
        {wide && <span className="text-sm font-bold tracking-tight">GymPlanner</span>}
        <span className="mx-1 h-6 w-px gp-border border-l" aria-hidden="true" />
        <ProjectName compact={compact} />
      </div>

      {/* Stockwerke */}
      <FloorTabs className="ml-1 flex-1" />

      {/* Verlauf + Speichern */}
      <div className="flex shrink-0 items-center gap-0.5" data-tutorial="topbar-undo">
        <IconButton title={`Rückgängig (Strg+Z)${past ? ` · ${past} ${past === 1 ? 'Schritt' : 'Schritte'}` : ' – nichts rückgängig zu machen'}`} icon={<Undo2 size={18} />} disabled={past === 0} badge={past || null} onClick={() => undo()} />
        <IconButton title={`Wiederholen (Strg+Y)${future ? ` · ${future} ${future === 1 ? 'Schritt' : 'Schritte'}` : ''}`} icon={<Redo2 size={18} />} disabled={future === 0} badge={future || null} onClick={() => redo()} />
        <SaveIndicator compact={compact} />
      </div>

      <span className="mx-0.5 h-6 w-px shrink-0 gp-border border-l" aria-hidden="true" />

      {/* Ansicht */}
      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton title="Alles einpassen (G)" icon={<Maximize2 size={18} />} label={wide ? 'Einpassen' : undefined} onClick={requestFit} />
        {medium && (
          <>
            <Select compact value={gridSize} options={GRID_OPTIONS} onChange={(v) => updateSettings({ gridSize: v })} title="Rastergröße" aria-label="Rastergröße" className="ml-0.5" />
            <IconButton title={showGrid ? 'Raster ausblenden' : 'Raster einblenden'} icon={<Grid3x3 size={18} />} active={showGrid} onClick={() => updateSettings({ showGrid: !showGrid })} />
            <IconButton title={snapEnabled ? 'Snapping ausschalten (Alt = vorübergehend aus)' : 'Snapping einschalten'} icon={<Magnet size={18} />} active={snapEnabled} onClick={() => updateSettings({ snapEnabled: !snapEnabled })} />
            <IconButton title="Ebenen & Einstellungen" icon={<Layers size={18} />} active={rightPanelOpen && rightPanel === 'layers'} onClick={() => panelToggle('layers')} data-tutorial="topbar-layers" />
            <IconButton title={view3d ? '3D-Ansicht beenden (3)' : '3D-Vorschau (3)'} icon={<Box size={18} />} label={wide ? '3D' : undefined} active={view3d} onClick={() => setView3d(!view3d)} />
            {view3d && (
              <Button size="sm" active={view3dAll} icon={<Building2 size={14} />} title="In 3D alle Stockwerke zeigen" onClick={() => setView3dAll(!view3dAll)} aria-pressed={view3dAll}>
                {wide ? 'Alle Stockwerke' : 'Alle'}
              </Button>
            )}
            <IconButton title="Präsentationsmodus (Shift+P)" icon={<Presentation size={18} />} onClick={startPresentation} />
            <Dropdown
              placement="bottom-end"
              entries={themeEntries}
              ariaLabel="Farbschema"
              trigger={({ open, toggle }) => <IconButton title={`Farbschema: ${THEME_OPTIONS.find((t) => t.value === theme)?.label ?? ''}`} icon={THEME_ICON[theme]} active={open} onClick={toggle} aria-haspopup="menu" aria-expanded={open} />}
            />
          </>
        )}
      </div>

      <span className="mx-0.5 h-6 w-px shrink-0 gp-border border-l" aria-hidden="true" />

      {/* Export, Projekte, Hilfe */}
      <div className="flex shrink-0 items-center gap-0.5">
        <ExportMenu compact={compact} />
        {medium && <IconButton title="Projekte & Varianten" icon={<FolderOpen size={18} />} label={wide ? 'Projekte' : undefined} active={rightPanelOpen && rightPanel === 'projects'} onClick={() => panelToggle('projects')} />}
        <Dropdown
          placement="bottom-end"
          entries={helpEntries}
          ariaLabel="Hilfe"
          trigger={({ open, toggle }) => <IconButton title="Hilfe: Tastenkürzel (?) und Tutorial" icon={<CircleHelp size={18} />} active={open} onClick={toggle} aria-haspopup="menu" aria-expanded={open} data-tutorial="topbar-help" />}
        />
        <Dropdown
          placement="bottom-end"
          entries={moreEntries}
          ariaLabel="Mehr"
          trigger={({ open, toggle }) => <IconButton title="Mehr (Einstellungen, Panels, Tutorial)" icon={medium ? <Ellipsis size={18} /> : <Settings size={18} />} active={open} onClick={toggle} aria-haspopup="menu" aria-expanded={open} />}
        />
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
