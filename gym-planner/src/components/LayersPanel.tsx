import { useMemo, type ReactNode } from 'react';
import {
  Grid3x3, BrickWall, LayoutDashboard, Dumbbell, Shield, Ruler, Tag, Armchair, Layers, DoorOpen, MessageSquareText, SquareDashed,
  Eye, EyeOff, Sun, Moon, Monitor,
} from 'lucide-react';
import type { GridSize, LayerVisibility } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore, type Theme } from '@/store/uiStore';
import { Toggle } from './ui/Toggle';
import { Select } from './ui/Select';
import { Slider } from './ui/Slider';
import { NumberInput } from './ui/Input';
import { Button } from './ui/Button';

/** Beschreibung aller Ebenen (Reihenfolge = Anzeige). */
export const LAYER_DEFS: { key: keyof LayerVisibility; label: string; hint?: string; icon: ReactNode }[] = [
  { key: 'grid', label: 'Raster', icon: <Grid3x3 size={16} /> },
  { key: 'walls', label: 'Wände', icon: <BrickWall size={16} /> },
  { key: 'rooms', label: 'Räume / Zonen', icon: <LayoutDashboard size={16} /> },
  { key: 'items', label: 'Geräte', icon: <Dumbbell size={16} /> },
  { key: 'safetyZones', label: 'Sicherheitszonen', hint: 'DIN EN ISO 20957', icon: <Shield size={16} /> },
  { key: 'dimensions', label: 'Bemaßung', icon: <Ruler size={16} /> },
  { key: 'labels', label: 'Beschriftungen', hint: 'Raumnamen, m², Gerätenamen', icon: <Tag size={16} /> },
  { key: 'furniture', label: 'Möbel', icon: <Armchair size={16} /> },
  { key: 'lowerFloor', label: 'Unteres Stockwerk', hint: 'halbtransparent darunter', icon: <Layers size={16} /> },
  { key: 'openings', label: 'Öffnungen', hint: 'Türen, Fenster, Spiegel', icon: <DoorOpen size={16} /> },
  { key: 'annotations', label: 'Anmerkungen', hint: 'Texte, Messlinien', icon: <MessageSquareText size={16} /> },
  { key: 'voids', label: 'Lufträume', icon: <SquareDashed size={16} /> },
];

export const GRID_SIZES: GridSize[] = [5, 10, 25, 50, 100];
export const GRID_OPTIONS = GRID_SIZES.map((g) => ({ value: g, label: `${g} cm` }));
export const THEME_OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Hell', icon: <Sun size={16} /> },
  { value: 'dark', label: 'Dunkel', icon: <Moon size={16} /> },
  { value: 'system', label: 'System', icon: <Monitor size={16} /> },
];

/** Ebenen-Schalter (project.layers) mit Icons und „Alle ein/aus“. */
export function LayerToggles() {
  const layers = useProjectStore((s) => s.project.layers);
  const updateLayers = useProjectStore((s) => s.updateLayers);
  const allOn = useMemo(() => LAYER_DEFS.every((d) => layers[d.key]), [layers]);
  const setAll = (v: boolean) => updateLayers(Object.fromEntries(LAYER_DEFS.map((d) => [d.key, v])) as Partial<LayerVisibility>);
  return (
    <div data-tutorial="layers-panel">
      <div className="mb-1 flex items-center justify-between">
        <span className="gp-label">Ebenen</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setAll(true)} disabled={allOn} title="Alle Ebenen einblenden">
            Alle
          </Button>
          <Button size="sm" variant="ghost" icon={<EyeOff size={14} />} onClick={() => setAll(false)} title="Alle Ebenen ausblenden">
            Keine
          </Button>
        </div>
      </div>
      <div className="divide-y gp-border">
        {LAYER_DEFS.map((d) => (
          <Toggle key={d.key} icon={d.icon} label={d.label} hint={d.hint} checked={layers[d.key]} onChange={(v) => updateLayers({ [d.key]: v })} />
        ))}
      </div>
    </div>
  );
}

/** Projekt-Einstellungen (project.settings): Raster, Snapping, unteres Stockwerk, Grenzwerte. */
export function ProjectSettingsFields({ compact = false }: { compact?: boolean }) {
  const settings = useProjectStore((s) => s.project.settings);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      <span className="gp-label">Raster & Snapping</span>
      <Select label="Rastergröße" value={settings.gridSize} options={GRID_OPTIONS} onChange={(v) => updateSettings({ gridSize: v })} />
      <Toggle label="Raster anzeigen" checked={settings.showGrid} onChange={(v) => updateSettings({ showGrid: v })} />
      <Toggle label="Snapping" hint="Raster, Wandenden/-mitten, Objektkanten, 45°/90° (Alt = aus)" checked={settings.snapEnabled} onChange={(v) => updateSettings({ snapEnabled: v })} />

      <span className="mt-2 gp-label">Unteres Stockwerk</span>
      <Toggle label="Unteres Stockwerk anzeigen" hint="zum Ausrichten von Treppen und Wänden" checked={settings.showLowerFloor} onChange={(v) => updateSettings({ showLowerFloor: v })} />
      <Slider
        label="Deckkraft"
        value={Math.round(settings.lowerFloorOpacity * 100)}
        min={5}
        max={100}
        step={5}
        disabled={!settings.showLowerFloor}
        format={(v) => `${v} %`}
        onChange={(v) => updateSettings({ lowerFloorOpacity: v / 100 })}
      />

      <span className="mt-2 gp-label">Grenzwerte & Standards</span>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Bodenlast-Grenze" unit="kg/m²" value={settings.floorLoadLimitKgM2} min={50} max={5000} step={50} decimals={0} onChange={(v) => updateSettings({ floorLoadLimitKgM2: v })} />
        <NumberInput label="Fläche je Person" unit="m²" value={settings.m2PerPerson} min={1} max={50} step={0.5} decimals={1} onChange={(v) => updateSettings({ m2PerPerson: v })} />
        <NumberInput label="Min. Fluchtweg" unit="cm" value={settings.minEscapeRouteCm} min={60} max={400} step={10} decimals={0} onChange={(v) => updateSettings({ minEscapeRouteCm: v })} />
        <NumberInput label="Standard-Sicherheitszone" unit="cm" value={settings.defaultSafetyZoneCm} min={0} max={300} step={10} decimals={0} onChange={(v) => updateSettings({ defaultSafetyZoneCm: v })} />
      </div>
    </div>
  );
}

/** UI-Einstellungen (nicht im Projekt gespeichert): Lineale, Minikarte, Theme. */
export function UiSettingsFields() {
  const showRulers = useUiStore((s) => s.showRulers);
  const setShowRulers = useUiStore((s) => s.setShowRulers);
  const showMinimap = useUiStore((s) => s.showMinimap);
  const setShowMinimap = useUiStore((s) => s.setShowMinimap);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <div className="flex flex-col gap-2">
      <span className="gp-label">Ansicht</span>
      <Toggle label="Lineale" checked={showRulers} onChange={setShowRulers} />
      <Toggle label="Minikarte" checked={showMinimap} onChange={setShowMinimap} />
      <div className="flex flex-col gap-1">
        <span className="gp-label">Farbschema</span>
        <div role="radiogroup" aria-label="Farbschema" className="grid grid-cols-3 gap-1">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              className={`gp-btn min-h-[36px] justify-center ${theme === t.value ? 'gp-btn-active' : ''}`}
              onClick={() => setTheme(t.value)}
            >
              {t.icon}
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Rechtes Panel „Ebenen“: Ebenen-Schalter + Projekt- und UI-Einstellungen. */
export function LayersPanel() {
  return (
    <div className="flex flex-col gap-5 p-3">
      <LayerToggles />
      <ProjectSettingsFields />
      <UiSettingsFields />
    </div>
  );
}
