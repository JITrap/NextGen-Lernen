/**
 * Bibliothek (rechtes Panel): Suche (debounced), Filter (Bereich, Hersteller, Serie, Muskelgruppe, Favoriten,
 * verifiziert), gruppierte und fenster-virtualisierte Liste, Drag & Drop auf den Canvas, „Platzieren“ für
 * Touch/Tablet, Detail-Popover je Eintrag sowie Verwaltung eigener Geräte.
 *
 * Filter- und Aufklappzustand liegen in einem kleinen Zustand-Store (das Panel wird beim Tab-Wechsel
 * abgebaut); Aufklappzustand und Filterleiste werden im localStorage gemerkt.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Search, X, Star, Info, TriangleAlert, ChevronDown, ChevronRight, Plus, Pencil, Trash2, ListFilter, FilterX, BadgeCheck,
  ChevronsDownUp, ChevronsUpDown, Anchor, Hand, PackagePlus,
} from 'lucide-react';
import type { EquipmentDef, LibraryArea, MuscleGroup } from '@/types';
import { useProjectStore, transaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createItemFromDef } from '@/store/factories';
import { fullLibrary, LIBRARY_AREAS, MUSCLE_GROUPS, manufacturers, seriesOf } from '@/data/equipment';
import { DRAG_MIME } from '@/editor/useDropFromLibrary';
import { getStage } from '@/editor/stageRegistry';
import { screenToWorld } from '@/editor/viewport';
import { formatDims, formatKg, formatEur, formatCm } from '@/geometry/units';
import { IconButton, Button } from './ui/Button';
import { Popover } from './ui/Menu';
import { ConfirmDialog } from './ui/Modal';
import { useIsTouch } from './ui/hooks';
import { SelectField } from './fields/SelectField';
import { KeyValue } from './fields/KeyValue';
import { Section } from './fields/Section';
import { CustomEquipmentForm } from './CustomEquipmentForm';

/* ------------------------------------------------------------------ */
/* Konstanten                                                          */
/* ------------------------------------------------------------------ */

export const AREA_COLORS: Record<LibraryArea, string> = {
  'Kraftgeräte': '#3b82f6',
  'Freihantel-Zubehör': '#f59e0b',
  'Cardio': '#ef4444',
  'Functional': '#22c55e',
  'Empfang & Lounge': '#14b8a6',
  'Umkleide': '#ec4899',
  'Sanitär': '#38bdf8',
  'Wellness': '#fb923c',
  'Kursraum': '#a855f7',
  'Büro & Personal': '#94a3b8',
  'Lager & Technik': '#78716c',
  'Ausstattung': '#84cc16',
  'Bauelemente': '#64748b',
  'Eigene': '#8b5cf6',
};

export const EVOLUTION_HINT = 'Maße vor Kauf beim Händler bestätigen';
export const RACK_MODULE_HINT = 'Rack-Modul: nur an Atlantis-Racks andockbar (Snap an Rackseite)';
const CUSTOM_GROUP_KEY = '__custom';
const GROUP_H = 34;
const ITEM_H = 64;
const OVERSCAN_PX = 400;
const SEARCH_DEBOUNCE_MS = 150;

/** Prime-Evolution-Einträge: gelber Hinweis (L/W-Werte wirken vertauscht). */
export function isEvolution(def: EquipmentDef): boolean {
  return def.serie === 'Evolution' || (def.hinweis?.includes('Händler') ?? false);
}
export function areaColor(def: EquipmentDef): string {
  return AREA_COLORS[def.bereich] ?? AREA_COLORS.Eigene;
}

/* ------------------------------------------------------------------ */
/* Zustand                                                             */
/* ------------------------------------------------------------------ */

interface LibraryUiState {
  query: string;
  area: LibraryArea | '';
  manufacturer: string;
  series: string;
  muscle: MuscleGroup | '';
  favoritesOnly: boolean;
  verifiedOnly: boolean;
  filtersOpen: boolean;
  /** Gemerkter Aufklappzustand je Gruppe (ohne Suche). */
  openGroups: Record<string, boolean>;
  setQuery: (q: string) => void;
  setFilter: (patch: Partial<Pick<LibraryUiState, 'area' | 'manufacturer' | 'series' | 'muscle' | 'favoritesOnly' | 'verifiedOnly'>>) => void;
  resetFilters: () => void;
  setFiltersOpen: (v: boolean) => void;
  setGroupOpen: (key: string, open: boolean) => void;
  setGroupsOpen: (keys: string[], open: boolean) => void;
}

export const useLibraryUi = create<LibraryUiState>()(
  persist(
    (set) => ({
      query: '',
      area: '',
      manufacturer: '',
      series: '',
      muscle: '',
      favoritesOnly: false,
      verifiedOnly: false,
      filtersOpen: true,
      openGroups: {},
      setQuery: (query) => set({ query }),
      setFilter: (patch) => set((s) => {
        const next = { ...s, ...patch };
        // Serie zurücksetzen, wenn sie nicht zum neuen Hersteller passt (wird in der Komponente geprüft)
        if (patch.manufacturer !== undefined && patch.manufacturer !== s.manufacturer) next.series = '';
        if (patch.area !== undefined && patch.area !== '' && patch.area !== 'Kraftgeräte') next.muscle = '';
        return next;
      }),
      resetFilters: () => set({ query: '', area: '', manufacturer: '', series: '', muscle: '', favoritesOnly: false, verifiedOnly: false }),
      setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
      setGroupOpen: (key, open) => set((s) => ({ openGroups: { ...s.openGroups, [key]: open } })),
      setGroupsOpen: (keys, open) => set((s) => {
        const openGroups = { ...s.openGroups };
        for (const k of keys) openGroups[k] = open;
        return { openGroups };
      }),
    }),
    { name: 'gymplanner-library', partialize: (s) => ({ openGroups: s.openGroups, filtersOpen: s.filtersOpen }) },
  ),
);

/* ------------------------------------------------------------------ */
/* Suche & Gruppierung (rein, testbar)                                 */
/* ------------------------------------------------------------------ */

function haystack(d: EquipmentDef): string {
  return [d.name, d.modell, d.serie, d.hersteller, d.unterkategorie, d.kategorie, d.bereich, d.muskelgruppe, ...(d.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export interface LibraryFilter {
  query: string;
  area: LibraryArea | '';
  manufacturer: string;
  series: string;
  muscle: MuscleGroup | '';
  favoritesOnly: boolean;
  verifiedOnly: boolean;
}

function matchesArea(d: EquipmentDef, area: LibraryArea): boolean {
  return d.bereich === area || (area === 'Eigene' && !!d.benutzerdefiniert);
}

/** Filtert die Bibliothek; `index` = vorab berechnete Suchtexte je ID. */
export function filterLibrary(lib: EquipmentDef[], f: LibraryFilter, favorites: Set<string>, index: Map<string, string>): { base: EquipmentDef[]; filtered: EquipmentDef[] } {
  const tokens = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const base: EquipmentDef[] = [];
  for (const d of lib) {
    if (f.manufacturer && d.hersteller !== f.manufacturer) continue;
    if (f.series && d.serie !== f.series) continue;
    if (f.muscle && d.muskelgruppe !== f.muscle) continue;
    if (f.favoritesOnly && !favorites.has(d.id)) continue;
    if (f.verifiedOnly && !d.verifiziert) continue;
    if (tokens.length) {
      const h = index.get(d.id) ?? haystack(d);
      let ok = true;
      for (const t of tokens) {
        if (!h.includes(t)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    base.push(d);
  }
  const filtered = f.area ? base.filter((d) => matchesArea(d, f.area as LibraryArea)) : base;
  return { base, filtered };
}

export interface LibraryGroup {
  key: string;
  label: string;
  sub?: string;
  area: LibraryArea;
  defs: EquipmentDef[];
}

function groupKeyOf(d: EquipmentDef): string {
  if (d.benutzerdefiniert) return CUSTOM_GROUP_KEY;
  if (d.serie) return `${d.hersteller}::${d.serie}`;
  return `${d.bereich}::${d.unterkategorie || d.kategorie}`;
}

/** Gruppiert nach Serie (Herstellergeräte) bzw. Unterkategorie (generische Objekte); eigene Geräte zuerst. */
export function groupLibrary(defs: EquipmentDef[]): LibraryGroup[] {
  const map = new Map<string, LibraryGroup>();
  for (const d of defs) {
    const key = groupKeyOf(d);
    let g = map.get(key);
    if (!g) {
      g = d.benutzerdefiniert
        ? { key, label: 'Eigene Geräte', area: 'Eigene', defs: [] }
        : d.serie
          ? { key, label: d.serie, sub: d.hersteller, area: d.bereich, defs: [] }
          : { key, label: d.unterkategorie || d.kategorie, sub: d.bereich, area: d.bereich, defs: [] };
      map.set(key, g);
    }
    g.defs.push(d);
  }
  const areaIndex = (a: LibraryArea) => {
    const i = LIBRARY_AREAS.indexOf(a);
    return i < 0 ? LIBRARY_AREAS.length : i;
  };
  const groups = [...map.values()];
  for (const g of groups) g.defs.sort((a, b) => a.name.localeCompare(b.name, 'de') || (a.modell ?? '').localeCompare(b.modell ?? '', 'de'));
  groups.sort((a, b) => {
    if (a.key === CUSTOM_GROUP_KEY) return -1;
    if (b.key === CUSTOM_GROUP_KEY) return 1;
    return areaIndex(a.area) - areaIndex(b.area) || (a.sub ?? '').localeCompare(b.sub ?? '', 'de') || a.label.localeCompare(b.label, 'de');
  });
  return groups;
}

type Row = { kind: 'group'; group: LibraryGroup; open: boolean } | { kind: 'item'; def: EquipmentDef };

/* ------------------------------------------------------------------ */
/* Platzieren (Touch/Tablet-Alternative zu Drag & Drop)                */
/* ------------------------------------------------------------------ */

/** Legt ein Objekt in der Mitte des sichtbaren Ausschnitts an, wählt es aus und wechselt zum Auswahlwerkzeug. */
export function placeDefAtViewCenter(def: EquipmentDef): string | null {
  const store = useProjectStore.getState();
  const ui = useUiStore.getState();
  const project = store.project;
  const floor = project.floors.find((f) => f.id === project.activeFloorId) ?? project.floors[0];
  if (!floor) {
    ui.toast('Kein Stockwerk vorhanden – bitte zuerst ein Stockwerk anlegen.', 'warning');
    return null;
  }
  const stage = getStage();
  const width = stage?.width() ?? 800;
  const height = stage?.height() ?? 600;
  const c = screenToWorld({ x: width / 2, y: height / 2 }, ui.viewport);
  const grid = project.settings.gridSize || 10;
  const snap = project.settings.snapEnabled && !ui.snapOverride;
  const x = snap ? Math.round(c.x / grid) * grid : Math.round(c.x);
  const y = snap ? Math.round(c.y / grid) * grid : Math.round(c.y);
  const item = createItemFromDef(def, x, y);
  if (def.preis_eur != null) item.priceEur = project.priceOverrides[def.id] ?? def.preis_eur;
  transaction(() => store.addItem(floor.id, item));
  ui.setSelection([{ kind: 'item', id: item.id }]);
  ui.setTool('select');
  if (ui.view3d) ui.setView3d(false);
  ui.toast(def.nur_an_rack ? `„${def.name}“ platziert – Rack-Modul bitte an ein Atlantis-Rack andocken` : `„${def.name}“ in der Bildmitte platziert`, 'success');
  return item.id;
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/** Mini-Symbol: Rechteck/Ellipse in Bereichsfarbe mit Seitenverhältnis B:T, „vorne“ unten markiert. */
export function DefThumb({ def, size = 32 }: { def: EquipmentDef; size?: number }) {
  const color = areaColor(def);
  const w = Math.max(1, def.breite_cm);
  const d = Math.max(1, def.tiefe_cm);
  const inner = size - 6;
  const s = inner / Math.max(w, d);
  const rw = Math.max(4, w * s);
  const rd = Math.max(4, d * s);
  const x = size / 2 - rw / 2;
  const y = size / 2 - rd / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
      {def.form === 'kreis' ? (
        <ellipse cx={size / 2} cy={size / 2} rx={rw / 2} ry={rd / 2} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={1.5} />
      ) : (
        <rect x={x} y={y} width={rw} height={rd} rx={1.5} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={1.5} />
      )}
      <line x1={x + 2} y1={y + rd - 1.5} x2={x + rw - 2} y2={y + rd - 1.5} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

function Badge({ children, tone, title }: { children: ReactNode; tone: 'ok' | 'muted' | 'warn' | 'accent'; title?: string }) {
  const color = tone === 'ok' ? 'var(--gp-ok)' : tone === 'warn' ? 'var(--gp-warn)' : tone === 'accent' ? 'var(--gp-accent)' : 'var(--gp-muted)';
  return (
    <span title={title} className="inline-flex shrink-0 items-center rounded px-1 text-[9px] font-semibold uppercase leading-4" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      {children}
    </span>
  );
}

interface RowProps {
  def: EquipmentDef;
  favorite: boolean;
  highlighted: boolean;
  touch: boolean;
  onPlace: (def: EquipmentDef) => void;
  onToggleFavorite: (id: string) => void;
  onDetail: (def: EquipmentDef, anchor: HTMLElement) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, def: EquipmentDef) => void;
  onDragEnd: () => void;
}

const LibraryRow = memo(function LibraryRow({ def, favorite, highlighted, touch, onPlace, onToggleFavorite, onDetail, onDragStart, onDragEnd }: RowProps) {
  const evolution = isEvolution(def);
  const meta: string[] = [];
  if (def.benutzerdefiniert) meta.push(def.hersteller);
  else if (def.serie) meta.push(def.hersteller === 'Generisch' ? def.serie : `${def.hersteller} ${def.serie}`);
  if (def.modell && def.modell !== def.name) meta.push(def.modell);
  const title = `${def.name}${def.modell && def.modell !== def.name ? ` (${def.modell})` : ''} – ${formatDims(def.breite_cm, def.tiefe_cm, def.hoehe_cm)}${def.gewicht_kg != null ? `, ${formatKg(def.gewicht_kg)}` : ''}\nZiehen zum Platzieren · Doppelklick: in der Bildmitte platzieren`;
  return (
    <div
      role="listitem"
      tabIndex={0}
      draggable={!touch}
      title={title}
      data-def-id={def.id}
      onDragStart={(e) => onDragStart(e, def)}
      onDragEnd={onDragEnd}
      onDoubleClick={() => onPlace(def)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onPlace(def);
        }
      }}
      className={`group flex h-full cursor-grab select-none items-center gap-2 border-b px-2 outline-none transition-colors gp-border active:cursor-grabbing hover:[background:color-mix(in_srgb,var(--gp-accent)_8%,transparent)] focus-visible:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]`}
      style={highlighted ? { background: 'color-mix(in srgb, var(--gp-accent) 18%, transparent)', boxShadow: 'inset 3px 0 0 var(--gp-accent)' } : undefined}
    >
      <DefThumb def={def} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">{def.name}</span>
          {def.hinweis && !def.nur_an_rack && !evolution && (
            <span className="shrink-0" title={def.hinweis} aria-label={`Hinweis: ${def.hinweis}`} style={{ color: 'var(--gp-accent)' }}>
              <Info size={13} />
            </span>
          )}
          {evolution && (
            <span className="shrink-0" title={EVOLUTION_HINT} aria-label={`Warnung: ${EVOLUTION_HINT}`} style={{ color: 'var(--gp-warn)' }}>
              <TriangleAlert size={13} />
            </span>
          )}
          {def.nur_an_rack && (
            <span className="shrink-0" title={RACK_MODULE_HINT} aria-label={RACK_MODULE_HINT} style={{ color: 'var(--gp-warn)' }}>
              <Anchor size={13} />
            </span>
          )}
        </div>
        <div className="truncate text-[11px] leading-tight gp-muted">
          {meta.length > 0 && <span>{meta.join(' · ')} · </span>}
          <span className="tabular-nums">{formatDims(def.breite_cm, def.tiefe_cm, def.hoehe_cm)}</span>
          {def.gewicht_kg != null && <span className="tabular-nums"> · {formatKg(def.gewicht_kg)}</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          {def.verifiziert ? <Badge tone="ok" title="Maße von der offiziellen Herstellerseite">verifiziert</Badge> : <Badge tone="muted" title="Maße ungeprüft – vor Kauf bestätigen">ungeprüft</Badge>}
          {def.nur_an_rack && <Badge tone="warn" title={RACK_MODULE_HINT}>Rack-Modul</Badge>}
          {def.wandmontage && <Badge tone="accent" title="Muss an einer Wand hängen">Wand</Badge>}
          {def.ohne_stellflaeche && <Badge tone="muted" title="Mengenposition ohne Stellfläche – nur in der Stückliste">Stückliste</Badge>}
          {def.skalierbar && <Badge tone="accent" title="Maße frei einstellbar">skalierbar</Badge>}
          {def.benutzerdefiniert && <Badge tone="accent" title="Von dir angelegt">eigen</Badge>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:[background:color-mix(in_srgb,var(--gp-warn)_18%,transparent)]"
          title={favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
          aria-label={favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
          aria-pressed={favorite}
          style={{ color: favorite ? 'var(--gp-warn)' : 'var(--gp-muted)' }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(def.id);
          }}
        >
          <Star size={15} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md gp-muted transition-colors hover:[background:color-mix(in_srgb,var(--gp-accent)_14%,transparent)]"
            title="Details anzeigen"
            aria-label={`Details zu ${def.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onDetail(def, e.currentTarget);
            }}
          >
            <Info size={15} />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:[background:color-mix(in_srgb,var(--gp-accent)_14%,transparent)]"
            style={{ color: 'var(--gp-accent)' }}
            title="Platzieren (in der Bildmitte anlegen)"
            aria-label={`${def.name} platzieren`}
            onClick={(e) => {
              e.stopPropagation();
              onPlace(def);
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

function GroupRow({ group, open, onToggle }: { group: LibraryGroup; open: boolean; onToggle: (key: string) => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => onToggle(group.key)}
      className="flex h-full w-full items-center gap-2 border-b px-2 text-left text-xs font-semibold transition-colors gp-border hover:[background:color-mix(in_srgb,var(--gp-accent)_8%,transparent)]"
      style={{ background: 'color-mix(in srgb, var(--gp-bg) 70%, var(--gp-panel))' }}
    >
      {open ? <ChevronDown size={14} className="shrink-0 gp-muted" aria-hidden="true" /> : <ChevronRight size={14} className="shrink-0 gp-muted" aria-hidden="true" />}
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: AREA_COLORS[group.area] ?? AREA_COLORS.Eigene }} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {group.sub && <span className="font-normal gp-muted">{group.sub} · </span>}
        {group.label}
      </span>
      <span className="shrink-0 rounded-full px-1.5 text-[10px] font-medium tabular-nums gp-muted" style={{ background: 'color-mix(in srgb, var(--gp-muted) 15%, transparent)' }}>
        {group.defs.length}
      </span>
    </button>
  );
}

/** Detail-Popover mit allen Feldern eines Eintrags. */
function DefDetails({ def, favorite, onPlace, onToggleFavorite, onEdit, onDelete, onClose }: {
  def: EquipmentDef;
  favorite: boolean;
  onPlace: (def: EquipmentDef) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (def: EquipmentDef) => void;
  onDelete: (def: EquipmentDef) => void;
  onClose: () => void;
}) {
  const z = def.sicherheitszone_cm;
  const priceOverride = useProjectStore((s) => s.project.priceOverrides[def.id]);
  const price = priceOverride ?? def.preis_eur;
  return (
    <div className="w-[300px] max-w-[calc(100vw-32px)] p-3 text-sm">
      <div className="mb-2 flex items-start gap-2">
        <DefThumb def={def} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold" title={def.name}>{def.name}</div>
          <div className="truncate text-xs gp-muted">{[def.hersteller, def.serie, def.modell && def.modell !== def.name ? def.modell : null].filter(Boolean).join(' · ')}</div>
        </div>
        <IconButton size="sm" title="Schließen" icon={<X size={15} />} onClick={onClose} />
      </div>
      {def.hinweis && (
        <p className="mb-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs" style={{ background: `color-mix(in srgb, ${isEvolution(def) || def.nur_an_rack ? 'var(--gp-warn)' : 'var(--gp-accent)'} 12%, transparent)` }}>
          {isEvolution(def) || def.nur_an_rack ? <TriangleAlert size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--gp-warn)' }} /> : <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--gp-accent)' }} />}
          <span>{def.hinweis}</span>
        </p>
      )}
      {isEvolution(def) && !def.hinweis?.includes('Händler') && (
        <p className="mb-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs" style={{ background: 'color-mix(in srgb, var(--gp-warn) 12%, transparent)' }}>
          <TriangleAlert size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--gp-warn)' }} />
          <span>{EVOLUTION_HINT}</span>
        </p>
      )}
      <div className="divide-y gp-border">
        <KeyValue label="Bereich" value={def.bereich} />
        <KeyValue label="Kategorie" value={def.muskelgruppe ?? def.kategorie} />
        <KeyValue label="Unterkategorie" value={def.unterkategorie} />
        <KeyValue label="Maße B × T × H" value={formatDims(def.breite_cm, def.tiefe_cm, def.hoehe_cm)} mono />
        <KeyValue label="Gewicht" value={def.gewicht_kg != null ? formatKg(def.gewicht_kg) : undefined} mono />
        <KeyValue label="Extra" value={def.extra} />
        <KeyValue label="Sicherheitszone" value={`v ${formatCm(z.vorne)} · h ${formatCm(z.hinten)} · l ${formatCm(z.links)} · r ${formatCm(z.rechts)}`} mono title="vorne · hinten · links · rechts" />
        <KeyValue label="Form" value={def.form === 'kreis' ? 'Kreis' : def.form === 'polygon' ? 'Polygon' : 'Rechteck'} />
        <KeyValue label="Skalierbar" value={def.skalierbar ? 'ja' : 'nein (Originalmaß gesperrt)'} />
        <KeyValue label="Preis" value={price != null ? formatEur(price) : undefined} mono />
        <KeyValue label="Verifiziert" value={def.verifiziert ? 'ja – Herstellerseite' : 'nein – Maße ungeprüft'} tone={def.verifiziert ? 'ok' : 'muted'} />
        {def.quelle_url && <KeyValue label="Quelle" value="Herstellerseite öffnen" href={def.quelle_url} />}
        {def.nur_an_rack && <KeyValue label="Montage" value="nur an Atlantis-Racks andockbar" tone="warn" />}
        {def.wandmontage && <KeyValue label="Montage" value="Wandmontage" />}
        {def.ohne_stellflaeche && <KeyValue label="Stellfläche" value="keine (nur Stückliste)" />}
        {def.tags && def.tags.length > 0 && <KeyValue label="Tags" value={def.tags.join(', ')} stacked />}
        <KeyValue label="ID" value={def.id} mono title={def.id} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => { onPlace(def); onClose(); }}>
          Platzieren
        </Button>
        <Button size="sm" icon={<Star size={14} fill={favorite ? 'currentColor' : 'none'} />} active={favorite} onClick={() => onToggleFavorite(def.id)}>
          Favorit
        </Button>
        {def.benutzerdefiniert && (
          <>
            <Button size="sm" icon={<Pencil size={14} />} onClick={() => { onClose(); onEdit(def); }}>
              Bearbeiten
            </Button>
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => { onClose(); onDelete(def); }}>
              Löschen
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

function lowerBound(arr: number[], v: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function LibraryPanel() {
  const customEquipment = useProjectStore((s) => s.project.customEquipment);
  const favoritesArr = useProjectStore((s) => s.project.favorites);
  const focusDefId = useUiStore((s) => s.toolOptions.libraryFocusDefId);
  const touch = useIsTouch();

  const query = useLibraryUi((s) => s.query);
  const area = useLibraryUi((s) => s.area);
  const manufacturer = useLibraryUi((s) => s.manufacturer);
  const series = useLibraryUi((s) => s.series);
  const muscle = useLibraryUi((s) => s.muscle);
  const favoritesOnly = useLibraryUi((s) => s.favoritesOnly);
  const verifiedOnly = useLibraryUi((s) => s.verifiedOnly);
  const filtersOpen = useLibraryUi((s) => s.filtersOpen);
  const openGroups = useLibraryUi((s) => s.openGroups);
  const setQuery = useLibraryUi((s) => s.setQuery);
  const setFilter = useLibraryUi((s) => s.setFilter);
  const resetFilters = useLibraryUi((s) => s.resetFilters);
  const setFiltersOpen = useLibraryUi((s) => s.setFiltersOpen);
  const setGroupOpen = useLibraryUi((s) => s.setGroupOpen);
  const setGroupsOpen = useLibraryUi((s) => s.setGroupsOpen);

  /* ---- Suche (debounced) ---- */
  const [draft, setDraft] = useState(query);
  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => setQuery(draft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  useEffect(() => {
    setDraft(query);
  }, [query]);
  // In der Suche zugeklappte Gruppen (transient; Suche ändert sich → alles wieder offen)
  const [searchCollapsed, setSearchCollapsed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setSearchCollapsed(new Set());
  }, [query]);

  /* ---- Daten ---- */
  const lib = useMemo(() => fullLibrary({ customEquipment }), [customEquipment]);
  const index = useMemo(() => new Map(lib.map((d) => [d.id, haystack(d)])), [lib]);
  const favorites = useMemo(() => new Set(favoritesArr), [favoritesArr]);
  const manufacturerOptions = useMemo(() => [{ value: '', label: 'Alle Hersteller' }, ...manufacturers(lib).map((m) => ({ value: m, label: m }))], [lib]);
  const seriesList = useMemo(() => seriesOf(lib, manufacturer || undefined), [lib, manufacturer]);
  const seriesOptions = useMemo(() => [{ value: '', label: manufacturer ? 'Alle Serien' : 'Alle Serien (alle Hersteller)' }, ...seriesList.map((s) => ({ value: s, label: s }))], [seriesList, manufacturer]);
  const effectiveSeries = seriesList.includes(series) ? series : '';
  const muscleOptions = useMemo(() => [{ value: '' as MuscleGroup | '', label: 'Alle Muskelgruppen' }, ...MUSCLE_GROUPS.map((m) => ({ value: m as MuscleGroup | '', label: m }))], []);

  const filterSpec: LibraryFilter = useMemo(
    () => ({ query, area, manufacturer, series: effectiveSeries, muscle, favoritesOnly, verifiedOnly }),
    [query, area, manufacturer, effectiveSeries, muscle, favoritesOnly, verifiedOnly],
  );
  const { base, filtered } = useMemo(() => filterLibrary(lib, filterSpec, favorites, index), [lib, filterSpec, favorites, index]);
  const areaCounts = useMemo(() => {
    const m = new Map<LibraryArea, number>();
    for (const d of base) {
      m.set(d.bereich, (m.get(d.bereich) ?? 0) + 1);
      if (d.benutzerdefiniert && d.bereich !== 'Eigene') m.set('Eigene', (m.get('Eigene') ?? 0) + 1);
    }
    return m;
  }, [base]);
  const areaOptions = useMemo(
    () => [{ value: '' as LibraryArea | '', label: `Alle Bereiche (${base.length})` }, ...LIBRARY_AREAS.map((a) => ({ value: a as LibraryArea | '', label: `${a} (${areaCounts.get(a) ?? 0})`, disabled: (areaCounts.get(a) ?? 0) === 0 && a !== area }))],
    [base.length, areaCounts, area],
  );
  const showMuscle = !area || area === 'Kraftgeräte';
  const activeFilterCount = (area ? 1 : 0) + (manufacturer ? 1 : 0) + (effectiveSeries ? 1 : 0) + (muscle && showMuscle ? 1 : 0) + (favoritesOnly ? 1 : 0) + (verifiedOnly ? 1 : 0);
  const anyFilter = activeFilterCount > 0 || !!query;

  const groups = useMemo(() => groupLibrary(filtered), [filtered]);
  const searching = query.trim().length > 0;
  const defaultOpen = groups.length <= 2 || filtered.length <= 40;
  const isOpen = useCallback(
    (key: string) => (searching ? !searchCollapsed.has(key) : (openGroups[key] ?? defaultOpen)),
    [searching, searchCollapsed, openGroups, defaultOpen],
  );
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of groups) {
      const open = isOpen(g.key);
      out.push({ kind: 'group', group: g, open });
      if (open) for (const d of g.defs) out.push({ kind: 'item', def: d });
    }
    return out;
  }, [groups, isOpen]);
  const offsets = useMemo(() => {
    const o = new Array<number>(rows.length + 1);
    o[0] = 0;
    for (let i = 0; i < rows.length; i++) o[i + 1] = o[i] + (rows[i].kind === 'group' ? GROUP_H : ITEM_H);
    return o;
  }, [rows]);
  const totalH = offsets[rows.length];
  const allOpen = groups.length > 0 && groups.every((g) => isOpen(g.key));

  const toggleGroup = useCallback(
    (key: string) => {
      if (searching) {
        setSearchCollapsed((s) => {
          const n = new Set(s);
          if (n.has(key)) n.delete(key);
          else n.add(key);
          return n;
        });
      } else setGroupOpen(key, !(openGroups[key] ?? defaultOpen));
    },
    [searching, setGroupOpen, openGroups, defaultOpen],
  );
  const setAll = (open: boolean) => {
    if (searching) setSearchCollapsed(open ? new Set() : new Set(groups.map((g) => g.key)));
    else setGroupsOpen(groups.map((g) => g.key), open);
  };

  /* ---- Virtualisierung ---- */
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setViewH(el.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (listRef.current) setScrollTop(listRef.current.scrollTop);
    });
  };
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  const effectiveViewH = viewH > 0 ? viewH : 100000;
  const start = Math.max(0, lowerBound(offsets, scrollTop - OVERSCAN_PX) - 1);
  const end = Math.min(rows.length, lowerBound(offsets, scrollTop + effectiveViewH + OVERSCAN_PX) + 1);

  /* ---- Fokus aus Kontextmenü / Eigenschaften („In Bibliothek zeigen“) ---- */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const pendingScrollRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof focusDefId !== 'string' || !focusDefId) return;
    const def = lib.find((d) => d.id === focusDefId);
    useUiStore.getState().setToolOption('libraryFocusDefId', '');
    if (!def) {
      useUiStore.getState().toast('Bibliothekseintrag nicht gefunden.', 'warning');
      return;
    }
    resetFilters();
    const q = def.modell && def.modell !== def.name ? `${def.name} ${def.modell}` : def.name;
    setQuery(q);
    setDraft(q);
    setSearchCollapsed(new Set());
    setHighlightId(def.id);
    pendingScrollRef.current = def.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDefId, lib]);
  useLayoutEffect(() => {
    const id = pendingScrollRef.current;
    if (!id) return;
    const idx = rows.findIndex((r) => r.kind === 'item' && r.def.id === id);
    if (idx < 0) return;
    pendingScrollRef.current = null;
    const el = listRef.current;
    if (el) {
      el.scrollTop = Math.max(0, offsets[idx] - Math.max(0, (viewH || 300) / 2 - ITEM_H));
      setScrollTop(el.scrollTop);
    }
    window.setTimeout(() => {
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
      el?.querySelector<HTMLElement>(`[data-def-id="${esc}"]`)?.focus();
    }, 0);
  }, [rows, offsets, viewH]);
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 6000);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  /* ---- Aktionen ---- */
  const onToggleFavorite = useCallback((id: string) => {
    transaction(() => useProjectStore.getState().toggleFavorite(id));
  }, []);
  const onPlace = useCallback((def: EquipmentDef) => {
    placeDefAtViewCenter(def);
  }, []);
  const onDragStart = useCallback((e: DragEvent<HTMLDivElement>, def: EquipmentDef) => {
    try {
      e.dataTransfer.setData(DRAG_MIME, def.id);
      e.dataTransfer.setData('text/plain', def.name);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {
      /* jsdom / eingeschränkte DataTransfer */
    }
    useUiStore.getState().setDraggingDefId(def.id);
  }, []);
  const onDragEnd = useCallback(() => {
    useUiStore.getState().setDraggingDefId(null);
  }, []);

  const [detail, setDetail] = useState<{ def: EquipmentDef; anchor: HTMLElement } | null>(null);
  const onDetail = useCallback((def: EquipmentDef, anchor: HTMLElement) => setDetail((d) => (d && d.def.id === def.id ? null : { def, anchor })), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  // Detail aktuell halten (z. B. nach Bearbeiten), schließen wenn gelöscht
  const detailDef = detail ? (lib.find((d) => d.id === detail.def.id) ?? null) : null;
  useEffect(() => {
    if (detail && !detailDef) setDetail(null);
  }, [detail, detailDef]);

  const [formOpen, setFormOpen] = useState(false);
  const [editDef, setEditDef] = useState<EquipmentDef | undefined>(undefined);
  const [deleteDef, setDeleteDef] = useState<EquipmentDef | null>(null);
  const openNew = () => {
    setEditDef(undefined);
    setFormOpen(true);
  };
  const openEdit = useCallback((def: EquipmentDef) => {
    setEditDef(def);
    setFormOpen(true);
  }, []);
  const askDelete = useCallback((def: EquipmentDef) => setDeleteDef(def), []);
  const usageCount = useMemo(() => {
    if (!deleteDef) return 0;
    let n = 0;
    for (const f of useProjectStore.getState().project.floors) for (const it of f.items) if (it.defId === deleteDef.id) n++;
    return n;
  }, [deleteDef]);
  const confirmDelete = () => {
    if (!deleteDef) return;
    const id = deleteDef.id;
    transaction(() => {
      const s = useProjectStore.getState();
      s.deleteCustomEquipment(id);
      if (s.project.favorites.includes(id)) s.toggleFavorite(id);
      if (id in s.project.priceOverrides) s.setPriceOverride(id, null);
    });
    useUiStore.getState().toast(`„${deleteDef.name}“ aus der Bibliothek entfernt`, 'info');
    setDeleteDef(null);
  };

  const customCount = customEquipment.length;

  return (
    <div data-tutorial="library" className="flex h-full min-h-0 flex-col text-sm">
      {/* Suche + Filter */}
      <div className="shrink-0 border-b p-2 gp-border">
        <div className="flex items-center gap-1.5">
          <label className="relative flex min-w-0 flex-1 items-center">
            <Search size={15} className="pointer-events-none absolute left-2 gp-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Bibliothek durchsuchen"
              placeholder="Suchen: Name, Modell, Serie, Hersteller …"
              className="gp-input min-h-[36px] pl-7 pr-7"
              value={draft}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setDraft('');
                  setQuery('');
                }
              }}
            />
            {draft && (
              <button
                type="button"
                className="absolute right-1 inline-flex h-7 w-7 items-center justify-center rounded-md gp-muted hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]"
                title="Suche löschen"
                aria-label="Suche löschen"
                onClick={() => {
                  setDraft('');
                  setQuery('');
                }}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <IconButton title={filtersOpen ? 'Filter ausblenden' : 'Filter einblenden'} icon={<ListFilter size={17} />} active={filtersOpen} badge={activeFilterCount || null} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} />
        </div>
        {filtersOpen && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <SelectField ariaLabel="Bereich" value={area} options={areaOptions} onChange={(v) => setFilter({ area: v })} compact className="col-span-2" includeCurrent={false} />
            <SelectField ariaLabel="Hersteller" value={manufacturer} options={manufacturerOptions} onChange={(v) => setFilter({ manufacturer: v })} compact includeCurrent={false} />
            <SelectField ariaLabel="Serie" value={effectiveSeries} options={seriesOptions} onChange={(v) => setFilter({ series: v })} compact includeCurrent={false} disabled={seriesList.length === 0} />
            {showMuscle && <SelectField ariaLabel="Muskelgruppe" value={muscle} options={muscleOptions} onChange={(v) => setFilter({ muscle: v })} compact className="col-span-2" includeCurrent={false} />}
            <div className="col-span-2 flex flex-wrap items-center gap-1">
              <button
                type="button"
                aria-pressed={favoritesOnly}
                onClick={() => setFilter({ favoritesOnly: !favoritesOnly })}
                className={`gp-btn h-8 px-2 text-xs ${favoritesOnly ? 'gp-btn-active' : ''}`}
                title="Nur Favoriten anzeigen"
              >
                <Star size={13} fill={favoritesOnly ? 'currentColor' : 'none'} /> Nur Favoriten
              </button>
              <button
                type="button"
                aria-pressed={verifiedOnly}
                onClick={() => setFilter({ verifiedOnly: !verifiedOnly })}
                className={`gp-btn h-8 px-2 text-xs ${verifiedOnly ? 'gp-btn-active' : ''}`}
                title="Nur Einträge mit verifizierten Herstellermaßen"
              >
                <BadgeCheck size={13} /> Nur verifiziert
              </button>
              {anyFilter && (
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setDraft('');
                  }}
                  className="gp-btn ml-auto h-8 px-2 text-xs"
                  title="Alle Filter und die Suche zurücksetzen"
                >
                  <FilterX size={13} /> Zurücksetzen
                </button>
              )}
            </div>
          </div>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] gp-muted">
          <span className="truncate" role="status">
            {filtered.length === 0 ? 'Keine Treffer' : `${filtered.length} ${filtered.length === 1 ? 'Eintrag' : 'Einträge'} in ${groups.length} ${groups.length === 1 ? 'Gruppe' : 'Gruppen'}`}
            {favoritesArr.length > 0 && !favoritesOnly && ` · ${favoritesArr.length} Favorit${favoritesArr.length === 1 ? '' : 'en'}`}
          </span>
          {groups.length > 1 && (
            <button type="button" className="inline-flex shrink-0 items-center gap-1 rounded px-1 hover:underline" onClick={() => setAll(!allOpen)} title={allOpen ? 'Alle Gruppen zuklappen' : 'Alle Gruppen aufklappen'}>
              {allOpen ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
              {allOpen ? 'Alle zu' : 'Alle auf'}
            </button>
          )}
        </div>
        {touch && (
          <p className="mt-1 flex items-center gap-1 text-[11px] gp-muted">
            <Hand size={12} /> Tipp: „+“ legt das Objekt in der Bildmitte an.
          </p>
        )}
      </div>

      {/* Liste (virtualisiert) */}
      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="list" aria-label="Bibliothekseinträge">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center gp-muted">
            <Search size={22} />
            <p>Keine Einträge gefunden.</p>
            {anyFilter && (
              <Button size="sm" icon={<FilterX size={14} />} onClick={() => { resetFilters(); setDraft(''); }}>
                Filter zurücksetzen
              </Button>
            )}
          </div>
        ) : (
          <div style={{ height: totalH, position: 'relative' }}>
            {rows.slice(start, end).map((row, i) => {
              const idx = start + i;
              const top = offsets[idx];
              if (row.kind === 'group') {
                return (
                  <div key={`g:${row.group.key}`} style={{ position: 'absolute', top, left: 0, right: 0, height: GROUP_H }}>
                    <GroupRow group={row.group} open={row.open} onToggle={toggleGroup} />
                  </div>
                );
              }
              return (
                <div key={row.def.id} style={{ position: 'absolute', top, left: 0, right: 0, height: ITEM_H }}>
                  <LibraryRow
                    def={row.def}
                    favorite={favorites.has(row.def.id)}
                    highlighted={highlightId === row.def.id}
                    touch={touch}
                    onPlace={onPlace}
                    onToggleFavorite={onToggleFavorite}
                    onDetail={onDetail}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Eigene Geräte */}
      <div className="shrink-0 border-t gp-border">
        <Section
          title="Eigene Geräte"
          icon={<PackagePlus size={15} />}
          storageKey="library.custom"
          defaultOpen={false}
          dense
          badge={
            <span className="inline-flex items-center gap-2">
              <span>{customCount}</span>
            </span>
          }
          bodyClassName="max-h-44 overflow-y-auto"
        >
          {customCount === 0 ? (
            <p className="text-[11px] gp-muted">Noch keine eigenen Geräte. Lege Geräte mit allen Feldern (Maße, Gewicht, Sicherheitszone, Preis …) an – sie werden im Projekt gespeichert.</p>
          ) : (
            <ul className="divide-y gp-border">
              {customEquipment.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-1">
                  <DefThumb def={d} size={22} />
                  <span className="min-w-0 flex-1 truncate text-xs" title={`${d.name} – ${formatDims(d.breite_cm, d.tiefe_cm, d.hoehe_cm)}`}>{d.name}</span>
                  <IconButton size="sm" title="Bearbeiten" icon={<Pencil size={14} />} onClick={() => openEdit(d)} />
                  <IconButton size="sm" title="Löschen" icon={<Trash2 size={14} />} onClick={() => askDelete(d)} className="gp-danger" />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="p-2">
          <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={openNew} className="w-full justify-center" data-tutorial="library-custom">
            Eigenes Gerät
          </Button>
        </div>
      </div>

      <Popover open={!!detail && !!detailDef} anchor={detail?.anchor ?? null} onClose={closeDetail} placement="right-start" ariaLabel="Gerätedetails" role="dialog">
        {detailDef && (
          <DefDetails def={detailDef} favorite={favorites.has(detailDef.id)} onPlace={onPlace} onToggleFavorite={onToggleFavorite} onEdit={openEdit} onDelete={askDelete} onClose={closeDetail} />
        )}
      </Popover>

      <CustomEquipmentForm open={formOpen} initial={editDef} onClose={() => setFormOpen(false)} onSaved={(d) => { setHighlightId(d.id); pendingScrollRef.current = d.id; }} />

      <ConfirmDialog
        open={!!deleteDef}
        title="Eigenes Gerät löschen"
        danger
        confirmLabel="Löschen"
        message={
          <>
            <p>„{deleteDef?.name}“ wird aus der Bibliothek entfernt.</p>
            {usageCount > 0 && (
              <p className="mt-2 gp-warn">
                {usageCount === 1 ? 'Ein platziertes Objekt verweist' : `${usageCount} platzierte Objekte verweisen`} auf diesen Eintrag – sie bleiben im Plan, verlieren aber Herstellerdaten, Symbol und Preis.
              </p>
            )}
            <p className="mt-2 text-xs gp-muted">Rückgängig mit Strg+Z.</p>
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDef(null)}
      />
    </div>
  );
}
