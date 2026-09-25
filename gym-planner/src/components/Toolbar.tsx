import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  MousePointer2, Square, Pentagon, BrickWall, LayoutDashboard, SquareDashed, DoorOpen, AppWindow, MirrorRectangular,
  DoorStairwell, ArrowUpFromLine, Cylinder, Ruler, Type, Hand, Undo2, Redo2, CircleHelp, ChevronRight,
} from 'lucide-react';
import type { Tool, DoorType, WallType, RoomType, StairsType, FloorCovering } from '@/types';
import { useUiStore } from '@/store/uiStore';
import { undo, redo, useTemporalStore } from '@/store/projectStore';
import { DEFAULT_OUTER_WALL_THICKNESS, DEFAULT_WALL_THICKNESS } from '@/store/factories';
import { WALL_THICKNESSES, WALL_TYPES, DOOR_TYPES, DOOR_WIDTHS, WINDOW_DEFAULT, MIRROR_DEFAULT } from '@/data/wallTypes';
import { ROOM_TYPES, FLOOR_COVERINGS } from '@/data/roomTypes';
import { Popover } from './ui/Menu';
import { SegmentedControl, IconButton } from './ui/Button';
import { Select } from './ui/Select';
import { NumberInput } from './ui/Input';
import { useIsTouch } from './ui/hooks';

/* ------------------------------------------------------------------ */
/* Werkzeug-Optionen (toolOptions-Schlüssel, von den Werkzeugen gelesen) */
/* ------------------------------------------------------------------ */

/** Schlüssel in ui.toolOptions, die die Werkzeugleiste setzt. */
export const TOOL_OPTION_KEYS = {
  /** Wandstärke in cm (Halle: Außenwand, Standard 24; Wand: Standard 12,5). */
  wallThickness: 'wallThickness',
  floorCovering: 'floorCovering',
  wallType: 'wallType',
  /** Wandhöhe in cm, 0 = bis zur Decke. */
  wallHeight: 'wallHeight',
  roomType: 'roomType',
  doorType: 'doorType',
  doorWidth: 'doorWidth',
  windowWidth: 'windowWidth',
  windowHeight: 'windowHeight',
  windowSillHeight: 'windowSillHeight',
  mirrorLength: 'mirrorLength',
  mirrorHeight: 'mirrorHeight',
  stairsType: 'stairsType',
  /** 'rund' | 'eckig' */
  columnShape: 'columnShape',
} as const;

const STAIRS_TYPES: { value: StairsType; label: string }[] = [
  { value: 'gerade', label: 'Gerade' },
  { value: 'L', label: 'L-Treppe' },
  { value: 'U', label: 'U-Treppe' },
  { value: 'Wendeltreppe', label: 'Wendel' },
];

interface ToolDef {
  id: Tool;
  label: string;
  /** Tastenkürzel (Anzeige im Tooltip). */
  key?: string;
  icon: ReactNode;
  /** Alle Werkzeug-IDs, die diesen Button „aktiv“ schalten (z. B. Rechteck + Polygon). */
  tools?: Tool[];
  /** Flyout mit Optionen (rechts neben dem Button). */
  flyout?: boolean;
  tutorial?: string;
}

export const TOOL_DEFS: ToolDef[] = [
  { id: 'select', label: 'Auswahl', key: 'V', icon: <MousePointer2 size={20} />, tutorial: 'toolbar-select' },
  { id: 'hall-rect', label: 'Halle', key: 'H', icon: <Square size={20} />, tools: ['hall-rect', 'hall-polygon'], flyout: true, tutorial: 'toolbar-hall' },
  { id: 'wall', label: 'Wand', key: 'W', icon: <BrickWall size={20} />, flyout: true, tutorial: 'toolbar-wall' },
  { id: 'zone-rect', label: 'Raum / Zone', key: 'Z', icon: <LayoutDashboard size={20} />, tools: ['zone-rect', 'zone-polygon'], flyout: true, tutorial: 'toolbar-zone' },
  { id: 'void', label: 'Luftraum (offen nach unten)', icon: <SquareDashed size={20} />, tutorial: 'toolbar-void' },
  { id: 'door', label: 'Tür', key: 'D', icon: <DoorOpen size={20} />, flyout: true, tutorial: 'toolbar-door' },
  { id: 'window', label: 'Fenster', key: 'F', icon: <AppWindow size={20} />, flyout: true, tutorial: 'toolbar-window' },
  { id: 'mirror', label: 'Spiegel', icon: <MirrorRectangular size={20} />, flyout: true, tutorial: 'toolbar-mirror' },
  { id: 'stairs', label: 'Treppe', icon: <DoorStairwell size={20} />, flyout: true, tutorial: 'toolbar-stairs' },
  { id: 'elevator', label: 'Aufzug', icon: <ArrowUpFromLine size={20} />, tutorial: 'toolbar-elevator' },
  { id: 'column', label: 'Säule / Stütze', icon: <Cylinder size={20} />, flyout: true, tutorial: 'toolbar-column' },
  { id: 'measure', label: 'Messen', key: 'M', icon: <Ruler size={20} />, tutorial: 'toolbar-measure' },
  { id: 'text', label: 'Text / Notiz', key: 'T', icon: <Type size={20} />, tutorial: 'toolbar-text' },
  { id: 'pan', label: 'Hand (Ansicht verschieben)', key: 'Leertaste', icon: <Hand size={20} />, tutorial: 'toolbar-pan' },
];

/* ------------------------------------------------------------------ */
/* Flyout-Inhalte                                                      */
/* ------------------------------------------------------------------ */

function useOpt<T extends string | number | boolean>(key: string, fallback: T): [T, (v: T) => void] {
  const raw = useUiStore((s) => s.toolOptions[key]);
  const set = useUiStore((s) => s.setToolOption);
  const value = (raw === undefined ? fallback : raw) as T;
  return [value, useCallback((v: T) => set(key, v), [key, set])];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="gp-label">{label}</span>
      {children}
    </label>
  );
}

const thicknessOptions = WALL_THICKNESSES.map((t) => ({ value: t, label: `${String(t).replace('.', ',')} cm` }));
const coveringOptions = FLOOR_COVERINGS.map((c) => ({ value: c as FloorCovering, label: c }));
const wallTypeOptions = WALL_TYPES.filter((w) => w.type !== 'Außenwand').map((w) => ({ value: w.type, label: w.type }));
const roomTypeOptions = ROOM_TYPES.map((r) => ({ value: r.type, label: r.type }));
const doorTypeOptions = DOOR_TYPES.map((d) => ({ value: d.type, label: d.type }));
const doorWidthOptions = DOOR_WIDTHS.map((w) => ({ value: w, label: `${w} cm` }));

function HallFlyout() {
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const [thickness, setThickness] = useOpt<number>(TOOL_OPTION_KEYS.wallThickness, DEFAULT_OUTER_WALL_THICKNESS);
  const [covering, setCovering] = useOpt<string>(TOOL_OPTION_KEYS.floorCovering, 'Gummiboden');
  return (
    <>
      <SegmentedControl
        ariaLabel="Hallenform"
        value={tool === 'hall-polygon' ? 'hall-polygon' : 'hall-rect'}
        options={[
          { value: 'hall-rect' as Tool, label: 'Rechteck', icon: <Square size={14} />, title: 'Rechteck aufziehen' },
          { value: 'hall-polygon' as Tool, label: 'Polygon', icon: <Pentagon size={14} />, title: 'Unregelmäßigen Grundriss zeichnen' },
        ]}
        onChange={setTool}
      />
      <Field label="Außenwand-Stärke">
        <Select value={thickness} options={thicknessOptions} onChange={setThickness} />
      </Field>
      <Field label="Bodenbelag">
        <Select value={covering} options={coveringOptions} onChange={setCovering} />
      </Field>
      <p className="text-[11px] gp-muted">Ziehe ein Rechteck auf oder klicke Eckpunkte (Doppelklick/Enter schließt). Maße werden live angezeigt.</p>
    </>
  );
}

function WallFlyout() {
  const [thickness, setThickness] = useOpt<number>(TOOL_OPTION_KEYS.wallThickness, DEFAULT_WALL_THICKNESS);
  const [type, setType] = useOpt<WallType>(TOOL_OPTION_KEYS.wallType, 'Trockenbau');
  const [height, setHeight] = useOpt<number>(TOOL_OPTION_KEYS.wallHeight, 0);
  const setOpt = useUiStore((s) => s.setToolOption);
  return (
    <>
      <Field label="Stärke">
        <Select value={thickness} options={thicknessOptions} onChange={setThickness} />
      </Field>
      <Field label="Typ">
        <Select
          value={type}
          options={wallTypeOptions}
          onChange={(t) => {
            setType(t);
            const info = WALL_TYPES.find((w) => w.type === t);
            if (info) {
              setOpt(TOOL_OPTION_KEYS.wallThickness, info.defaultThickness);
              setOpt(TOOL_OPTION_KEYS.wallHeight, info.defaultHeight ?? 0);
            }
          }}
        />
      </Field>
      <NumberInput label="Höhe (0 = bis zur Decke)" unit="cm" value={height} min={0} max={1500} step={10} decimals={0} onChange={setHeight} />
      <p className="text-[11px] gp-muted">Klick–Klick zeichnet eine Wandkette. Länge tippen für exakte Maße, Esc beendet.</p>
    </>
  );
}

function ZoneFlyout() {
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const [roomType, setRoomType] = useOpt<RoomType>(TOOL_OPTION_KEYS.roomType, 'Trainingsfläche Freihantel');
  const color = ROOM_TYPES.find((r) => r.type === roomType)?.color;
  return (
    <>
      <SegmentedControl
        ariaLabel="Zonenform"
        value={tool === 'zone-polygon' ? 'zone-polygon' : 'zone-rect'}
        options={[
          { value: 'zone-rect' as Tool, label: 'Rechteck', icon: <Square size={14} /> },
          { value: 'zone-polygon' as Tool, label: 'Polygon', icon: <Pentagon size={14} /> },
        ]}
        onChange={setTool}
      />
      <Field label="Raumtyp">
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded border gp-border" style={{ background: color }} aria-hidden="true" />
          <Select value={roomType} options={roomTypeOptions} onChange={setRoomType} />
        </span>
      </Field>
      <p className="text-[11px] gp-muted">Zonen brauchen keine Wände. Räume aus geschlossenen Wandzügen entstehen automatisch.</p>
    </>
  );
}

function DoorFlyout() {
  const [doorType, setDoorType] = useOpt<DoorType>(TOOL_OPTION_KEYS.doorType, 'einflügelig');
  const [width, setWidth] = useOpt<number>(TOOL_OPTION_KEYS.doorWidth, 90);
  const setOpt = useUiStore((s) => s.setToolOption);
  return (
    <>
      <Field label="Türtyp">
        <Select
          value={doorType}
          options={doorTypeOptions}
          onChange={(t) => {
            setDoorType(t);
            const info = DOOR_TYPES.find((d) => d.type === t);
            if (info) setOpt(TOOL_OPTION_KEYS.doorWidth, info.defaultWidth);
          }}
        />
      </Field>
      <Field label="Breite">
        <Select value={DOOR_WIDTHS.includes(width) ? width : DOOR_WIDTHS[1]} options={doorWidthOptions} onChange={setWidth} />
      </Field>
      <p className="text-[11px] gp-muted">Auf eine Wand klicken. Anschlag und Aufschlagseite später per Rechtsklick umkehren.</p>
    </>
  );
}

function WindowFlyout() {
  const [width, setWidth] = useOpt<number>(TOOL_OPTION_KEYS.windowWidth, WINDOW_DEFAULT.width);
  const [height, setHeight] = useOpt<number>(TOOL_OPTION_KEYS.windowHeight, WINDOW_DEFAULT.height);
  const [sill, setSill] = useOpt<number>(TOOL_OPTION_KEYS.windowSillHeight, WINDOW_DEFAULT.sillHeight);
  return (
    <>
      <NumberInput label="Breite" unit="cm" value={width} min={20} max={2000} step={10} decimals={0} onChange={setWidth} />
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Höhe" unit="cm" value={height} min={20} max={600} step={10} decimals={0} onChange={setHeight} />
        <NumberInput label="Brüstung" unit="cm" value={sill} min={0} max={300} step={10} decimals={0} onChange={setSill} />
      </div>
      <p className="text-[11px] gp-muted">Fenster sitzen immer in einer Wand und lassen sich an ihr entlang ziehen.</p>
    </>
  );
}

function MirrorFlyout() {
  const [length, setLength] = useOpt<number>(TOOL_OPTION_KEYS.mirrorLength, MIRROR_DEFAULT.width);
  const [height, setHeight] = useOpt<number>(TOOL_OPTION_KEYS.mirrorHeight, MIRROR_DEFAULT.height);
  return (
    <>
      <NumberInput label="Länge" unit="cm" value={length} min={30} max={3000} step={10} decimals={0} onChange={setLength} />
      <NumberInput label="Höhe" unit="cm" value={height} min={30} max={400} step={10} decimals={0} onChange={setHeight} />
      <p className="text-[11px] gp-muted">Spiegelwand an einer Wand platzieren.</p>
    </>
  );
}

function StairsFlyout() {
  const [type, setType] = useOpt<StairsType>(TOOL_OPTION_KEYS.stairsType, 'gerade');
  return (
    <>
      <Field label="Treppentyp">
        <SegmentedControl ariaLabel="Treppentyp" value={type} options={STAIRS_TYPES} onChange={setType} />
      </Field>
      <p className="text-[11px] gp-muted">Treppen erscheinen auf allen verbundenen Stockwerken (Eigenschaften → verbundene Stockwerke).</p>
    </>
  );
}

function ColumnFlyout() {
  const [shape, setShape] = useOpt<'rund' | 'eckig'>(TOOL_OPTION_KEYS.columnShape, 'eckig');
  return (
    <Field label="Form">
      <SegmentedControl
        ariaLabel="Säulenform"
        value={shape}
        options={[
          { value: 'rund', label: 'Rund', icon: <Cylinder size={14} /> },
          { value: 'eckig', label: 'Eckig', icon: <Square size={14} /> },
        ]}
        onChange={setShape}
      />
    </Field>
  );
}

const FLYOUTS: Partial<Record<Tool, () => ReactNode>> = {
  'hall-rect': HallFlyout,
  wall: WallFlyout,
  'zone-rect': ZoneFlyout,
  door: DoorFlyout,
  window: WindowFlyout,
  mirror: MirrorFlyout,
  stairs: StairsFlyout,
  column: ColumnFlyout,
};

/* ------------------------------------------------------------------ */
/* Werkzeugleiste                                                      */
/* ------------------------------------------------------------------ */

const ToolButton = memo(function ToolButton({
  def,
  active,
  large,
  onActivate,
  onOpenFlyout,
}: {
  def: ToolDef;
  active: boolean;
  large: boolean;
  onActivate: (def: ToolDef) => void;
  onOpenFlyout: (def: ToolDef, el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const title = def.key ? `${def.label} (${def.key})` : def.label;
  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        title={def.flyout ? `${title} – erneut klicken für Optionen` : title}
        aria-label={title}
        aria-pressed={active}
        data-tool={def.id}
        data-tutorial={def.tutorial}
        className={`gp-tool ${large ? 'h-12 w-12' : ''} ${active ? 'active' : ''}`}
        onClick={() => {
          if (active && def.flyout && ref.current) onOpenFlyout(def, ref.current);
          else onActivate(def);
        }}
        onContextMenu={(e) => {
          if (!def.flyout || !ref.current) return;
          e.preventDefault();
          onActivate(def);
          onOpenFlyout(def, ref.current);
        }}
      >
        {def.icon}
      </button>
      {def.flyout && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${def.label}: Optionen`}
          title={`${def.label}: Optionen`}
          className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl rounded-br-lg opacity-60 hover:opacity-100"
          style={{ color: active ? 'white' : 'var(--gp-muted)' }}
          onClick={(e) => {
            e.stopPropagation();
            onActivate(def);
            if (ref.current) onOpenFlyout(def, ref.current);
          }}
        >
          <ChevronRight size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
});

/**
 * Vertikale Werkzeugleiste links (56 px, auf Touch 64 px). Aktives Werkzeug hervorgehoben,
 * Flyouts mit Optionen rechts neben dem Button; unten Undo/Redo und „?“.
 */
export function Toolbar() {
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const setShowShortcuts = useUiStore((s) => s.setShowShortcuts);
  const past = useTemporalStore((s) => s.pastStates.length);
  const future = useTemporalStore((s) => s.futureStates.length);
  const touch = useIsTouch();
  const [flyout, setFlyout] = useState<{ def: ToolDef; anchor: HTMLElement } | null>(null);

  const activate = useCallback(
    (def: ToolDef) => {
      // Innerhalb einer Gruppe (Rechteck/Polygon) bleibt die zuletzt gewählte Variante erhalten.
      const current = useUiStore.getState().tool;
      if (!(def.tools?.includes(current) ?? false)) setTool(def.id);
      setFlyout(null);
    },
    [setTool],
  );
  const openFlyout = useCallback((def: ToolDef, anchor: HTMLElement) => setFlyout((f) => (f && f.def.id === def.id ? null : { def, anchor })), []);
  const closeFlyout = useCallback(() => setFlyout(null), []);

  const Flyout = flyout ? FLYOUTS[flyout.def.id] : undefined;
  const isActive = useMemo(() => (def: ToolDef) => def.id === tool || (def.tools?.includes(tool) ?? false), [tool]);

  return (
    <aside
      className={`flex ${touch ? 'w-16' : 'w-14'} shrink-0 flex-col items-center border-r gp-panel`}
      role="toolbar"
      aria-label="Werkzeuge"
      aria-orientation="vertical"
      data-tutorial="toolbar"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TOOL_DEFS.map((def, i) => (
          <div key={def.id} className="contents">
            {(i === 1 || i === 5 || i === 11) && <div className="my-0.5 h-px w-8 shrink-0 gp-border border-t" aria-hidden="true" />}
            <ToolButton def={def} active={isActive(def)} large={touch} onActivate={activate} onOpenFlyout={openFlyout} />
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5 border-t py-1.5 gp-border">
        <IconButton title={`Rückgängig (Strg+Z)${past ? ` · ${past}` : ''}`} icon={<Undo2 size={16} />} size="sm" disabled={!past} onClick={() => undo()} />
        <IconButton title={`Wiederholen (Strg+Y)${future ? ` · ${future}` : ''}`} icon={<Redo2 size={16} />} size="sm" disabled={!future} onClick={() => redo()} />
        <IconButton title="Tastenkürzel (?)" icon={<CircleHelp size={16} />} size="sm" onClick={() => setShowShortcuts(true)} />
      </div>

      <Popover open={!!flyout} anchor={flyout?.anchor ?? null} onClose={closeFlyout} placement="right-start" ariaLabel={flyout ? `${flyout.def.label}: Optionen` : undefined}>
        {flyout && Flyout && (
          <div className="flex w-[260px] flex-col gap-3 p-3" onKeyDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{flyout.def.label}</span>
              {flyout.def.key && <kbd className="gp-kbd">{flyout.def.key}</kbd>}
            </div>
            <Flyout />
          </div>
        )}
      </Popover>
    </aside>
  );
}
