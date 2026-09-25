/**
 * Eigenschaften-Panel (rechts): zeigt je nach Auswahl (immer auf dem aktiven Stockwerk) die editierbaren
 * Eigenschaften – Stockwerk & Halle (nichts gewählt), Objekt, Mehrfachauswahl, Wand, Raum/Zone, Öffnung,
 * Anmerkung, Luftraum, Hallen-Eckpunkt/-Kante. Alle Änderungen laufen über den Store bzw. src/editor/actions
 * als jeweils ein Undo-Schritt (transaction).
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Building2, Dumbbell, BrickWall, LayoutDashboard, DoorOpen, AppWindow, MessageSquareText, Ruler, SquareDashed, Lock, LockOpen, Eye, EyeOff,
  Trash2, Files, Library, RotateCw, RotateCcw, Group, Ungroup, Scissors, TriangleAlert, Info, OctagonAlert, X, Square, Pentagon, Layers,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, FlipHorizontal2, FlipVertical2, Move, Shield, Euro, Link2,
  ArrowLeftRight, MoveVertical, Anchor, MapPin, Boxes, Palette, Scan, Tag,
} from 'lucide-react';
import type {
  Floor, PlacedItem, Wall, Zone, Room, Opening, Annotation, VoidArea, Selection, RoomType, RoomMeta, RoomLabelMode, WallType, DoorType,
  SafetyZone, Vec2, Project,
} from '@/types';
import { useProjectStore, transaction } from '@/store/projectStore';
import { newId } from '@/utils/id';
import { useUiStore } from '@/store/uiStore';
import { useFloorRooms, useSortedFloors, useProjectFrozenWhileDragging, activeFloorOf } from '@/store/selectors';
import { getDef } from '@/data/equipment';
import { ROOM_TYPES, roomColor, FLOOR_COVERINGS } from '@/data/roomTypes';
import { WALL_THICKNESSES, WALL_TYPES, DOOR_TYPES, DOOR_TYPE_MAP, DOOR_WIDTHS } from '@/data/wallTypes';
import * as actions from '@/editor/actions';
import { polygonAreaM2, perimeter, bbox, distance, normalize, sub, add, scale } from '@/geometry/polygon';
import { hallInnerPolygon, findWall, isHallWallId, wallLength, wallMidpoint, wallDirection, splitWall, reassignOpeningsAfterSplit, clampOpeningOffset } from '@/geometry/walls';
import { formatM2, formatM, formatCm, formatDims, formatKg, formatEur, formatLength, normalizeAngle, formatNumber } from '@/geometry/units';
import { Button, SegmentedControl } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { ConfirmDialog } from './ui/Modal';
import { NumberField, LengthField, SelectField, TextField, ColorField, CheckboxField, Section, KeyValue } from './fields';

/* ------------------------------------------------------------------ */
/* Optionale Aktionen aus src/editor/actions (werden parallel ergänzt) */
/* ------------------------------------------------------------------ */

type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' | 'distributeX' | 'distributeY';

function optionalExport<T>(mod: object, name: string): T | undefined {
  const entry = Object.entries(mod).find(([k]) => k === name);
  return typeof entry?.[1] === 'function' ? (entry[1] as T) : undefined;
}
const A = {
  deleteSelection: optionalExport<() => void>(actions, 'deleteSelection'),
  duplicateSelection: optionalExport<() => void>(actions, 'duplicateSelection'),
  rotateSelection: optionalExport<(deg: number) => void>(actions, 'rotateSelection'),
  flipSelection: optionalExport<(axis: 'x' | 'y') => void>(actions, 'flipSelection'),
  alignSelection: optionalExport<(mode: AlignMode) => void>(actions, 'alignSelection'),
  groupSelection: optionalExport<() => void>(actions, 'groupSelection'),
  ungroupSelection: optionalExport<() => void>(actions, 'ungroupSelection'),
  toggleLockSelection: optionalExport<() => void>(actions, 'toggleLockSelection'),
  toggleHideSelection: optionalExport<() => void>(actions, 'toggleHideSelection'),
  splitWallAtPoint: optionalExport<(wallId: string, p: Vec2) => string | null>(actions, 'splitWallAtPoint'),
  setWallLength: optionalExport<(wallId: string, len: number) => boolean>(actions, 'setWallLength'),
  setHallEdgeLength: optionalExport<(edgeIndex: number, len: number) => boolean>(actions, 'setHallEdgeLength'),
  setItemRotation: optionalExport<(id: string, deg: number) => void>(actions, 'setItemRotation'),
  setItemPosition: optionalExport<(id: string, x: number, y: number) => void>(actions, 'setItemPosition'),
  setItemSize: optionalExport<(id: string, w: number, d: number) => boolean>(actions, 'setItemSize'),
  setSafetyZone: optionalExport<(id: string, zone: Partial<SafetyZone>) => void>(actions, 'setSafetyZone'),
  setSafetyZoneEnabled: optionalExport<(id: string, enabled: boolean) => void>(actions, 'setSafetyZoneEnabled'),
  setItemProps: optionalExport<(id: string, patch: Partial<PlacedItem>) => void>(actions, 'setItemProps'),
};

const store = () => useProjectStore.getState();
const ui = () => useUiStore.getState();

/* ------------------------------------------------------------------ */
/* Gemeinsame Bausteine                                                */
/* ------------------------------------------------------------------ */

/** Helle Hintergrundfarbe (z. B. Raumtyp „Sonstiges“ #e5e7eb) → dunkles Icon, sonst weiß. */
function iconColorOn(bg?: string): string {
  const m = bg ? /^#([0-9a-f]{6})$/i.exec(bg) : null;
  if (!m) return 'white';
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6 ? '#0f172a' : 'white';
}

function PanelHeader({ icon, title, subtitle, badges, color }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; badges?: ReactNode; color?: string }) {
  return (
    <header className="flex items-start gap-2.5 border-b px-3 py-2.5 gp-border">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: color ?? 'var(--gp-accent)', color: iconColorOn(color) }} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold leading-tight" title={typeof title === 'string' ? title : undefined}>{title}</h2>
        {subtitle && <div className="truncate text-[11px] leading-tight gp-muted">{subtitle}</div>}
        {badges && <div className="mt-1 flex flex-wrap gap-1">{badges}</div>}
      </div>
      <button type="button" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md gp-muted hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]" title="Auswahl aufheben (Esc)" aria-label="Auswahl aufheben" onClick={() => ui().clearSelection()}>
        <X size={15} />
      </button>
    </header>
  );
}

function Pill({ children, tone = 'muted', title }: { children: ReactNode; tone?: 'muted' | 'warn' | 'danger' | 'ok' | 'accent'; title?: string }) {
  const color = tone === 'warn' ? 'var(--gp-warn)' : tone === 'danger' ? 'var(--gp-danger)' : tone === 'ok' ? 'var(--gp-ok)' : tone === 'accent' ? 'var(--gp-accent)' : 'var(--gp-muted)';
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded px-1.5 text-[10px] font-semibold uppercase leading-4" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      {children}
    </span>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'muted' | 'warn' | 'danger'; children: ReactNode }) {
  const color = tone === 'warn' ? 'var(--gp-warn)' : tone === 'danger' ? 'var(--gp-danger)' : tone === 'info' ? 'var(--gp-accent)' : 'var(--gp-muted)';
  const Icon = tone === 'danger' ? OctagonAlert : tone === 'warn' ? TriangleAlert : Info;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className="flex items-start gap-2 rounded-md px-2.5 py-2 text-xs leading-snug" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color: 'var(--gp-text)' }}>
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color }} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function ActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5 px-3 py-3">{children}</div>;
}

function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

const THICKNESS_OPTIONS = WALL_THICKNESSES.map((t) => ({ value: t, label: formatCm(t) }));
const fmtThickness = (v: number) => `${formatCm(v)} (frei)`;

function ThicknessField({ value, onChange, label = 'Wandstärke' }: { value: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div className="grid grid-cols-[1fr_92px] items-end gap-2">
      <SelectField label={label} value={value} options={THICKNESS_OPTIONS} onChange={onChange} formatCurrent={fmtThickness} />
      <NumberField ariaLabel={`${label} frei eingeben`} value={value} onChange={(v) => v != null && onChange(v)} unit="cm" step={0.5} min={1} max={200} decimals={1} title="Freie Eingabe" />
    </div>
  );
}

const FLOOR_COVERING_OPTIONS = FLOOR_COVERINGS.map((c) => ({ value: c, label: c }));
const LABEL_MODE_OPTIONS: { value: RoomLabelMode; label: string }[] = [
  { value: 'name+area', label: 'Name + Fläche' },
  { value: 'name', label: 'Nur Name' },
  { value: 'area', label: 'Nur Fläche' },
  { value: 'none', label: 'Keine' },
];
const ROOM_TYPE_OPTIONS = ROOM_TYPES.map((r) => ({ value: r.type, label: r.type, color: r.color }));
const ROOM_COLOR_PRESETS = [...new Set(ROOM_TYPES.map((r) => r.color))];
const WALL_TYPE_OPTIONS = WALL_TYPES.map((w) => ({ value: w.type, label: w.type, color: w.color }));
const DOOR_TYPE_OPTIONS = DOOR_TYPES.map((d) => ({ value: d.type, label: d.type }));
const DOOR_WIDTH_OPTIONS = DOOR_WIDTHS.map((w) => ({ value: w, label: formatCm(w) }));

function deleteHallWithOpenings(floor: Floor) {
  const s = store();
  transaction(() => {
    const outer = floor.openings.filter((o) => isHallWallId(o.wallId)).map((o) => o.id);
    if (outer.length) s.deleteOpenings(floor.id, outer);
    s.setHall(floor.id, null);
  });
  ui().clearSelection();
  ui().toast('Halle entfernt (Strg+Z macht es rückgängig)', 'info');
}

function DeleteHallButton({ floor }: { floor: Floor }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
        Halle löschen
      </Button>
      <ConfirmDialog
        open={confirm}
        title="Halle entfernen"
        danger
        confirmLabel="Halle entfernen"
        message="Die Hallenkontur dieses Stockwerks wird entfernt. Türen und Fenster an den Außenwänden gehen verloren; Wände, Zonen und Geräte bleiben erhalten. Rückgängig mit Strg+Z."
        onConfirm={() => {
          setConfirm(false);
          deleteHallWithOpenings(floor);
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

/** Löschen der Auswahl über actions (fällt auf den Store zurück). */
function deleteSelectionFallback(floor: Floor) {
  if (A.deleteSelection) return A.deleteSelection();
  const sel = ui().selection;
  transaction(() => store().deleteSelection(floor.id, sel));
  ui().clearSelection();
}

function toggleLockFallback(floor: Floor, sel: Selection[]) {
  if (A.toggleLockSelection) return A.toggleLockSelection();
  const s = store();
  const items = floor.items.filter((it) => sel.some((x) => x.kind === 'item' && x.id === it.id));
  const walls = floor.walls.filter((w) => sel.some((x) => x.kind === 'wall' && x.id === w.id));
  const zones = floor.zones.filter((z) => sel.some((x) => x.kind === 'zone' && x.id === z.id));
  const openings = floor.openings.filter((o) => sel.some((x) => x.kind === 'opening' && x.id === o.id));
  const anns = floor.annotations.filter((a) => sel.some((x) => x.kind === 'annotation' && x.id === a.id));
  const all = [...items, ...walls, ...zones, ...openings, ...anns];
  if (!all.length) return;
  const locked = !all.every((x) => x.locked);
  transaction(() => {
    if (items.length) s.updateItems(floor.id, items.map((i) => i.id), (it) => { it.locked = locked; });
    for (const w of walls) s.updateWall(floor.id, w.id, { locked });
    for (const z of zones) s.updateZone(floor.id, z.id, { locked });
    for (const o of openings) s.updateOpening(floor.id, o.id, { locked });
    for (const a of anns) s.updateAnnotation(floor.id, a.id, { locked });
  });
}

function toggleHideFallback(floor: Floor, sel: Selection[]) {
  if (A.toggleHideSelection) return A.toggleHideSelection();
  const s = store();
  transaction(() => {
    for (const x of sel) {
      if (x.kind === 'item') s.updateItems(floor.id, [x.id], (it) => { it.hidden = true; });
      else if (x.kind === 'wall') s.updateWall(floor.id, x.id, { hidden: true });
      else if (x.kind === 'zone') s.updateZone(floor.id, x.id, { hidden: true });
      else if (x.kind === 'opening') s.updateOpening(floor.id, x.id, { hidden: true });
      else if (x.kind === 'annotation') s.updateAnnotation(floor.id, x.id, { hidden: true });
    }
  });
  ui().clearSelection();
}

function LockHideDelete({ floor, sel, locked, deleteLabel = 'Löschen', extra }: { floor: Floor; sel: Selection[]; locked: boolean; deleteLabel?: string; extra?: ReactNode }) {
  return (
    <ActionBar>
      {extra}
      <Button size="sm" icon={locked ? <LockOpen size={14} /> : <Lock size={14} />} onClick={() => toggleLockFallback(floor, sel)} title="Strg+L">
        {locked ? 'Entsperren' : 'Sperren'}
      </Button>
      <Button size="sm" icon={<EyeOff size={14} />} onClick={() => toggleHideFallback(floor, sel)} title="Ausblenden – wieder einblenden über „Ausgeblendete Objekte“ im Abschnitt „Stockwerk“ (Eigenschaften ohne Auswahl)">
        Ausblenden
      </Button>
      <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => deleteSelectionFallback(floor)} title="Entf">
        {deleteLabel}
      </Button>
    </ActionBar>
  );
}

/* ------------------------------------------------------------------ */
/* Nichts gewählt: Stockwerk + Halle                                   */
/* ------------------------------------------------------------------ */

function FloorHallProps({ floor, rooms }: { floor: Floor; rooms: Room[] }) {
  const floors = useSortedFloors();
  const idx = floors.findIndex((f) => f.id === floor.id);
  const hall = floor.hall;
  const stats = useMemo(() => {
    if (!hall) return null;
    const outer = hall.polygon;
    const inner = hallInnerPolygon(hall);
    const b = bbox(outer);
    return {
      width: b.maxX - b.minX,
      depth: b.maxY - b.minY,
      gross: polygonAreaM2(outer),
      net: polygonAreaM2(inner),
      perimeter: perimeter(outer),
      vertices: outer.length,
    };
  }, [hall]);
  const setVertex = (i: number, p: Partial<Vec2>) =>
    transaction(() => store().updateHall(floor.id, (h) => { if (h.polygon[i]) h.polygon[i] = { ...h.polygon[i], ...p }; }));
  const setEdgeLength = (i: number, len: number) => {
    if (!hall || !(len >= 1)) return;
    const n = hall.polygon.length;
    const a = hall.polygon[i];
    const b = hall.polygon[(i + 1) % n];
    const dir = normalize(sub(b, a));
    if (!dir.x && !dir.y) return;
    const nb = add(a, scale(dir, len));
    transaction(() => store().updateHall(floor.id, (h) => { h.polygon[(i + 1) % n] = nb; }));
  };
  const itemCount = floor.items.length;
  const hiddenItems = floor.items.filter((it) => it.hidden);
  const hiddenCount = hiddenItems.length;
  const project = useProjectStore((s) => s.project);
  /** Objekt wieder einblenden (ein Undo-Schritt) und auswählen. */
  const showHidden = (ids: string[]) => {
    if (!ids.length) return;
    transaction(() => { for (const id of ids) store().updateItem(floor.id, id, { hidden: false }); });
    ui().setSelection(ids.map((id) => ({ kind: 'item' as const, id })));
  };

  return (
    <div className="flex flex-col">
      <PanelHeader
        icon={<Layers size={16} />}
        title={floor.name}
        subtitle={`Stockwerk ${idx + 1} von ${floors.length} · ${hall ? formatM2(polygonAreaM2(hall.polygon)) : 'keine Halle'}`}
      />
      <Section title="Stockwerk" icon={<Layers size={15} />} storageKey="props.floor">
        <TextField label="Name" value={floor.name} onChange={(v) => v && transaction(() => store().renameFloor(floor.id, v))} />
        <LengthField label="Deckenhöhe" value={floor.ceilingHeight} onChange={(v) => v != null && transaction(() => store().setFloorCeilingHeight(floor.id, v))} min={100} max={3000} step={5} decimals={0} hint="Geräte, die höher sind als die Decke, werden gewarnt (z. B. Racks mit 246 cm)." />
        <p className="text-[11px] gp-muted">
          Reihenfolge {floor.order} – Stockwerke ordnest du über die Stockwerk-Tabs oben (Pfeile im Menü) um; das darunterliegende Stockwerk lässt sich halbtransparent einblenden.
        </p>
        <div className="divide-y gp-border">
          <KeyValue label="Wände" value={String(floor.walls.length)} mono />
          <KeyValue label="Räume / Zonen" value={`${rooms.filter((r) => r.source === 'auto').length} / ${floor.zones.length}`} mono />
          <KeyValue label="Objekte" value={hiddenCount ? `${itemCount} (${hiddenCount} ausgeblendet)` : String(itemCount)} mono />
          <KeyValue label="Öffnungen" value={String(floor.openings.length)} mono />
        </div>
        {hiddenCount > 0 && (
          <div className="flex flex-col gap-1" data-testid="hidden-items">
            <div className="flex items-center justify-between gap-2">
              <span className="gp-label">Ausgeblendete Objekte ({hiddenCount})</span>
              {hiddenCount > 1 && (
                <Button size="sm" icon={<Eye size={13} />} onClick={() => showHidden(hiddenItems.map((it) => it.id))} title="Alle ausgeblendeten Objekte dieses Stockwerks einblenden und auswählen">
                  Alle einblenden
                </Button>
              )}
            </div>
            <ul className="flex flex-col gap-0.5">
              {hiddenItems.map((it) => {
                const name = it.label || getDef(it.defId, project)?.name || 'Objekt';
                return (
                  <li key={it.id} className="flex items-center gap-2 text-xs">
                    <EyeOff size={12} className="shrink-0 gp-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
                    <Button size="sm" icon={<Eye size={13} />} onClick={() => showHidden([it.id])} title={`„${name}“ einblenden und auswählen`} aria-label={`${name} einblenden`}>
                      Einblenden
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>
      {hall && stats ? (
        <>
          <Section title="Halle" icon={<Building2 size={15} />} storageKey="props.hall" badge={formatM2(stats.gross)}>
            <div className="divide-y gp-border">
              <KeyValue label="Außenmaß B × T" value={`${formatLength(stats.width)} × ${formatLength(stats.depth)}`} mono title="Bounding-Box der Außenkante" />
              <KeyValue label="Fläche brutto" value={formatM2(stats.gross)} mono title="Außenkante (Shoelace)" />
              <KeyValue label="Fläche netto" value={formatM2(stats.net)} mono title="Innenkante, Außenwandstärke abgezogen" />
              <KeyValue label="Umfang" value={formatM(stats.perimeter)} mono />
              <KeyValue label="Eckpunkte" value={String(stats.vertices)} mono />
            </div>
            <ThicknessField label="Außenwandstärke" value={hall.wallThickness} onChange={(v) => transaction(() => store().updateHall(floor.id, (h) => { h.wallThickness = v; }))} />
            <SelectField label="Bodenbelag" value={hall.floorCovering} options={FLOOR_COVERING_OPTIONS} onChange={(v) => transaction(() => store().updateHall(floor.id, (h) => { h.floorCovering = v; }))} />
          </Section>
          <Section title="Eckpunkte & Kanten" icon={<Pentagon size={15} />} storageKey="props.hallVertices" defaultOpen={false} badge={`${stats.vertices} Punkte`}>
            <p className="text-[11px] gp-muted">Kantenlänge ändern verschiebt den nächsten Eckpunkt entlang der Kante. Eckpunkte lassen sich auch direkt auf dem Plan ziehen.</p>
            <div className="grid grid-cols-[28px_1fr_1fr_1fr] items-end gap-1 text-[11px]">
              <span />
              <span className="gp-label">X</span>
              <span className="gp-label">Y</span>
              <span className="gp-label" title="Länge der Kante zum nächsten Punkt">Kante →</span>
              {hall.polygon.map((p, i) => {
                const n = hall.polygon.length;
                const len = distance(p, hall.polygon[(i + 1) % n]);
                return (
                  <FragmentRow key={i}>
                    <button type="button" className="h-8 rounded text-left text-[11px] font-semibold gp-muted hover:underline" title="Eckpunkt auf dem Plan auswählen" onClick={() => ui().setSelection([{ kind: 'hallVertex', id: String(i) }])}>
                      P{i + 1}
                    </button>
                    <LengthField ariaLabel={`Eckpunkt ${i + 1} X`} value={p.x} onChange={(v) => v != null && setVertex(i, { x: v })} compact decimals={0} />
                    <LengthField ariaLabel={`Eckpunkt ${i + 1} Y`} value={p.y} onChange={(v) => v != null && setVertex(i, { y: v })} compact decimals={0} />
                    <LengthField ariaLabel={`Kante ${i + 1} Länge`} value={len} onChange={(v) => v != null && setEdgeLength(i, v)} compact decimals={0} min={1} />
                  </FragmentRow>
                );
              })}
            </div>
          </Section>
          <ActionBar>
            <Button size="sm" icon={<Scan size={14} />} onClick={() => ui().requestFit()} title="G">
              Alles einpassen
            </Button>
            <DeleteHallButton floor={floor} />
          </ActionBar>
        </>
      ) : (
        <Section title="Halle" icon={<Building2 size={15} />} collapsible={false}>
          <Banner tone="info">Dieses Stockwerk hat noch keine Halle. Ziehe die Außenmaße als Rechteck auf oder zeichne ein Polygon für unregelmäßige Grundrisse.</Banner>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" icon={<Square size={14} />} onClick={() => ui().setTool('hall-rect')} title="H">
              Rechteck aufziehen
            </Button>
            <Button size="sm" icon={<Pentagon size={14} />} onClick={() => ui().setTool('hall-polygon')}>
              Polygon zeichnen
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}

/** Hilfskomponente: mehrere Grid-Zellen ohne Wrapper. */
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Objekt                                                              */
/* ------------------------------------------------------------------ */

function isLockerRow(item: PlacedItem, defSymbol?: string): boolean {
  return defSymbol === 'locker-row' || item.params?.faecher != null;
}

function setItemProps(floor: Floor, id: string, patch: Partial<PlacedItem>) {
  if (A.setItemProps) A.setItemProps(id, patch);
  else transaction(() => store().updateItem(floor.id, id, patch));
}

function ItemProps({ item, floor, project }: { item: PlacedItem; floor: Floor; project: Project }) {
  const def = getDef(item.defId, project);
  const settings = project.settings;
  const floors = useSortedFloors();
  const [priceForAll, setPriceForAll] = useState(false);
  const locked = !!item.locked;
  const name = item.label || def?.name || 'Objekt';
  const height = item.height ?? def?.hoehe_cm ?? null;
  const tooHigh = height != null && height > floor.ceilingHeight;
  const scalable = def ? def.skalierbar : true;
  const lockerRow = isLockerRow(item, def?.symbol);
  const evolution = def?.serie === 'Evolution' || (def?.hinweis?.includes('Händler') ?? false);
  const sameDefCount = useMemo(() => project.floors.reduce((n, f) => n + f.items.filter((it) => it.defId === item.defId).length, 0), [project.floors, item.defId]);
  const price = item.priceEur ?? project.priceOverrides[item.defId] ?? def?.preis_eur ?? null;
  const priceSource = item.priceEur != null ? 'eigener Preis dieses Objekts' : project.priceOverrides[item.defId] != null ? 'projektweit überschrieben' : def?.preis_eur != null ? 'Bibliothekspreis' : 'kein Preis hinterlegt';
  const group = item.groupId ? floor.groups.find((g) => g.id === item.groupId) : undefined;
  const docked = item.dockedTo ? floor.items.find((it) => it.id === item.dockedTo) : undefined;
  const dockedName = docked ? docked.label || getDef(docked.defId, project)?.name || 'Rack' : undefined;
  const isStairs = item.kind === 'stairs' || item.kind === 'elevator';

  const setRotation = (deg: number) => {
    if (A.setItemRotation) A.setItemRotation(item.id, deg);
    else transaction(() => store().updateItem(floor.id, item.id, { rotation: normalizeAngle(deg) }));
  };
  const setPosition = (x: number, y: number) => {
    if (A.setItemPosition) A.setItemPosition(item.id, x, y);
    else transaction(() => store().updateItem(floor.id, item.id, { x, y }));
  };
  const setSize = (w: number, d: number) => {
    if (!(w >= 1) || !(d >= 1)) return;
    if (A.setItemSize) {
      if (!A.setItemSize(item.id, w, d)) ui().toast('Maße sind auf Originalmaß gesperrt', 'info');
    } else transaction(() => store().updateItem(floor.id, item.id, { width: w, depth: d }));
  };
  const setZone = (zone: Partial<SafetyZone>) => {
    if (A.setSafetyZone) A.setSafetyZone(item.id, zone);
    else {
      const next: SafetyZone = { ...item.safetyZone, ...zone };
      for (const k of ['vorne', 'hinten', 'links', 'rechts'] as const) if (!(next[k] >= 0)) next[k] = 0;
      transaction(() => store().updateItem(floor.id, item.id, { safetyZone: next }));
    }
  };
  const setZoneEnabled = (enabled: boolean) => {
    if (A.setSafetyZoneEnabled) A.setSafetyZoneEnabled(item.id, enabled);
    else transaction(() => store().updateItem(floor.id, item.id, { safetyZoneEnabled: enabled }));
  };
  const resetZone = () => {
    const z = def?.sicherheitszone_cm ?? { vorne: settings.defaultSafetyZoneCm, hinten: settings.defaultSafetyZoneCm, links: settings.defaultSafetyZoneCm, rechts: settings.defaultSafetyZoneCm };
    setZone({ ...z });
  };
  const setPrice = (v: number | null) => {
    if (priceForAll) {
      transaction(() => {
        const s = store();
        s.setPriceOverride(item.defId, v);
        for (const f of s.project.floors) {
          const ids = f.items.filter((it) => it.defId === item.defId).map((it) => it.id);
          if (ids.length) s.updateItems(f.id, ids, (it) => { if (v == null) delete it.priceEur; else it.priceEur = v; });
        }
      });
      ui().toast(v == null ? `Preis für ${sameDefCount} Objekte entfernt` : `Preis für ${sameDefCount} Objekte gesetzt: ${formatEur(v)}`, 'success');
    } else setItemProps(floor, item.id, { priceEur: v ?? undefined });
  };
  // Spindreihe: Breite = Abteile × Abteilbreite, Abteile = Fächer ÷ Stöcke (mehrstöckig: Fächer übereinander)
  const stoeckig = Math.min(4, Math.max(1, Math.round(Number(item.params?.stoeckig ?? def?.params?.stoeckig ?? 1)) || 1));
  const faecher = Math.max(1, Math.round(Number(item.params?.faecher ?? def?.params?.faecher ?? 1)));
  const abteile = Math.max(1, Math.ceil(faecher / stoeckig));
  const abteilbreite = Number(item.params?.abteilbreite ?? def?.params?.abteilbreite ?? Math.round(item.width / abteile)) || 30;
  const setLocker = (f: number, ab: number, st: number) => {
    const nst = Math.min(4, Math.max(1, Math.round(st)));
    const nf = Math.max(1, Math.round(f));
    const nab = Math.max(5, ab);
    setItemProps(floor, item.id, { width: Math.ceil(nf / nst) * nab, params: { ...(item.params ?? {}), faecher: nf, abteilbreite: nab, stoeckig: nst } });
  };
  const toggleLinkedFloor = (fid: string, on: boolean) => {
    const cur = new Set(item.linkedFloorIds ?? []);
    if (on) cur.add(fid);
    else cur.delete(fid);
    cur.delete(floor.id);
    setItemProps(floor, item.id, { linkedFloorIds: cur.size ? [...cur] : undefined });
  };

  const badges: ReactNode[] = [];
  if (locked) badges.push(<Pill key="l" tone="warn"><Lock size={10} /> gesperrt</Pill>);
  if (item.hidden) badges.push(<Pill key="h"><EyeOff size={10} /> ausgeblendet</Pill>);
  if (def?.verifiziert) badges.push(<Pill key="v" tone="ok" title="Maße von der offiziellen Herstellerseite">verifiziert</Pill>);
  else if (def) badges.push(<Pill key="u" title="Maße ungeprüft">ungeprüft</Pill>);
  if (def?.nur_an_rack) badges.push(<Pill key="r" tone="warn"><Anchor size={10} /> Rack-Modul</Pill>);
  if (group) badges.push(<Pill key="g" tone="accent"><Group size={10} /> Gruppe ({group.itemIds.length})</Pill>);

  return (
    <div className="flex flex-col">
      <PanelHeader
        icon={<Dumbbell size={16} />}
        title={name}
        subtitle={def ? [def.hersteller, def.serie, def.modell && def.modell !== def.name ? def.modell : null, item.label ? def.name : null].filter(Boolean).join(' · ') : `Bibliothekseintrag „${item.defId}“ fehlt`}
        badges={badges.length ? badges : undefined}
      />
      {(def?.hinweis || (def && !def.verifiziert) || tooHigh || !def || (def?.nur_an_rack && !item.dockedTo)) && (
        <div className="flex flex-col gap-1.5 px-3 pt-3">
          {!def && <Banner tone="danger">Bibliothekseintrag nicht gefunden – vermutlich wurde ein eigenes Gerät gelöscht. Maße und Position bleiben editierbar.</Banner>}
          {tooHigh && (
            <Banner tone="danger">
              Höhe {formatCm(height!)} überschreitet die Deckenhöhe von {formatCm(floor.ceilingHeight)} ({floor.name}).
            </Banner>
          )}
          {def?.hinweis && <Banner tone={evolution || def.nur_an_rack || def.hinweis.includes('fehlerhaft') ? 'warn' : 'info'}>{def.hinweis}</Banner>}
          {evolution && !def?.hinweis?.includes('Händler') && <Banner tone="warn">Maße vor Kauf beim Händler bestätigen.</Banner>}
          {def && !def.verifiziert && <Banner tone="muted">Maße ungeprüft – Standardwerte, bitte vor dem Kauf beim Hersteller bestätigen.</Banner>}
          {def?.nur_an_rack && !item.dockedTo && <Banner tone="warn">Rack-Modul ist an kein Rack angedockt – auf dem Plan an eine Rackseite eines Atlantis-Racks ziehen.</Banner>}
        </div>
      )}

      <Section title="Bezeichnung & Position" icon={<Move size={15} />} storageKey="props.item.pos">
        <TextField label="Bezeichnung" value={item.label ?? ''} placeholder={def?.name ?? 'Objekt'} onChange={(v) => setItemProps(floor, item.id, { label: v || undefined })} hint="Leer = Name aus der Bibliothek" />
        <Grid2>
          <LengthField label="Position X" value={item.x} onChange={(v) => v != null && setPosition(v, item.y)} decimals={1} disabled={locked} />
          <LengthField label="Position Y" value={item.y} onChange={(v) => v != null && setPosition(item.x, v)} decimals={1} disabled={locked} />
        </Grid2>
        <div className="flex flex-col gap-1">
          <NumberField label="Drehung" value={item.rotation} onChange={(v) => v != null && setRotation(v)} unit="°" step={1} decimals={1} disabled={locked} />
          <div className="flex flex-wrap gap-1">
            {[0, 90, 180, 270].map((d) => (
              <Button key={d} size="sm" active={Math.abs(normalizeAngle(item.rotation) - d) < 0.01} disabled={locked} onClick={() => setRotation(d)} title={`Drehung ${d}°`}>
                {d}°
              </Button>
            ))}
            <Button size="sm" icon={<RotateCcw size={13} />} disabled={locked} onClick={() => setRotation(item.rotation - 15)} title="−15°">
              15°
            </Button>
            <Button size="sm" icon={<RotateCw size={13} />} disabled={locked} onClick={() => setRotation(item.rotation + 15)} title="+15°">
              15°
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Maße & Gewicht" icon={<Ruler size={15} />} storageKey="props.item.dims" badge={formatDims(item.width, item.depth, height)}>
        {lockerRow && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="Fächer" value={faecher} onChange={(v) => v != null && setLocker(v, abteilbreite, stoeckig)} integer min={1} max={200} step={1} disabled={locked} />
              <NumberField label="Stöcke" value={stoeckig} onChange={(v) => v != null && setLocker(faecher, abteilbreite, v)} integer min={1} max={4} step={1} disabled={locked} title="Fächer übereinander je Abteil (1–4)" />
              <LengthField label="Abteilbreite" value={abteilbreite} onChange={(v) => v != null && setLocker(faecher, v, stoeckig)} min={5} max={200} decimals={0} disabled={locked} />
            </div>
            <p className="text-[11px] gp-muted">Breite = Abteile (Fächer ÷ Stöcke) × Abteilbreite = {abteile} × {formatCm(abteilbreite)} = {formatCm(abteile * abteilbreite)}</p>
          </>
        )}
        {scalable ? (
          <div className="grid grid-cols-3 gap-2">
            <LengthField label="Breite" value={item.width} onChange={(v) => v != null && setSize(v, item.depth)} min={1} decimals={1} disabled={locked || lockerRow} title={lockerRow ? 'Ergibt sich aus Abteilen × Abteilbreite' : undefined} />
            <LengthField label="Tiefe" value={item.depth} onChange={(v) => v != null && setSize(item.width, v)} min={1} decimals={1} disabled={locked} />
            <LengthField label="Höhe" value={item.height} onChange={(v) => setItemProps(floor, item.id, { height: v })} min={0} decimals={1} allowEmpty placeholder="–" disabled={locked} />
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs gp-border">
            <Lock size={14} className="mt-0.5 shrink-0 gp-muted" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-semibold tabular-nums">B × T × H: {formatDims(item.width, item.depth, height)}</div>
              <div className="gp-muted">Originalmaß, nicht skalierbar</div>
            </div>
          </div>
        )}
        <div className="divide-y gp-border">
          <KeyValue label="Gewicht" value={def?.gewicht_kg != null ? formatKg(def.gewicht_kg) : undefined} mono empty="– (unbekannt)" />
          <KeyValue label="Steckgewicht / Extra" value={def?.extra} />
          <KeyValue label="Grundfläche" value={formatM2((item.width * item.depth) / 10000)} mono />
          {def && <KeyValue label="Bereich" value={def.muskelgruppe ? `${def.bereich} · ${def.muskelgruppe}` : def.bereich} />}
        </div>
      </Section>

      <Section title="Sicherheitszone" icon={<Shield size={15} />} storageKey="props.item.zone" badge={item.safetyZoneEnabled ? undefined : 'aus'}>
        <Toggle label="Sicherheitszone aktiv" hint="DIN EN ISO 20957 – halbtransparente Nutzungsfläche" checked={item.safetyZoneEnabled} onChange={setZoneEnabled} />
        <Grid2>
          <LengthField label="Vorne" value={item.safetyZone.vorne} onChange={(v) => v != null && setZone({ vorne: v })} min={0} max={1000} decimals={0} step={5} />
          <LengthField label="Hinten" value={item.safetyZone.hinten} onChange={(v) => v != null && setZone({ hinten: v })} min={0} max={1000} decimals={0} step={5} />
          <LengthField label="Links" value={item.safetyZone.links} onChange={(v) => v != null && setZone({ links: v })} min={0} max={1000} decimals={0} step={5} />
          <LengthField label="Rechts" value={item.safetyZone.rechts} onChange={(v) => v != null && setZone({ rechts: v })} min={0} max={1000} decimals={0} step={5} />
        </Grid2>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={resetZone} title={def ? 'Werte aus der Bibliothek übernehmen' : `${settings.defaultSafetyZoneCm} cm rundum`}>
            Standard
          </Button>
          <Button size="sm" onClick={() => setZone({ vorne: 0, hinten: 0, links: 0, rechts: 0 })}>
            Keine
          </Button>
        </div>
      </Section>

      <Section title="Preis & Notiz" icon={<Euro size={15} />} storageKey="props.item.price" badge={price != null ? formatEur(price) : undefined}>
        <NumberField label="Preis (netto)" value={price} onChange={setPrice} unit="€" min={0} step={10} decimals={2} allowEmpty placeholder="–" hint={priceSource} />
        {sameDefCount > 1 && <CheckboxField checked={priceForAll} onChange={setPriceForAll} label={`Für alle ${sameDefCount} gleichen Geräte übernehmen`} hint="Setzt auch den projektweiten Preis (Stückliste)" />}
        {def?.quelle_url && <KeyValue label="Herstellerseite" value={def.quelle_url.replace(/^https?:\/\//, '').slice(0, 40)} href={def.quelle_url} />}
        <TextField label="Notiz" value={item.note ?? ''} multiline rows={3} onChange={(v) => setItemProps(floor, item.id, { note: v || undefined })} placeholder="z. B. Lieferung KW 12, gebraucht kaufen …" hint="Strg+Enter übernimmt" />
      </Section>

      {isStairs && (
        <Section title="Stockwerke verbinden" icon={<Layers size={15} />} storageKey="props.item.floors" badge={`${1 + (item.linkedFloorIds?.filter((id) => id !== floor.id && floors.some((f) => f.id === id)).length ?? 0)} Ebenen`}>
          <p className="text-[11px] gp-muted">Treppen und Aufzüge erscheinen auf allen verbundenen Stockwerken (dort gesperrt).</p>
          {floors.map((f) => (
            <CheckboxField
              key={f.id}
              checked={f.id === floor.id || (item.linkedFloorIds?.includes(f.id) ?? false)}
              disabled={f.id === floor.id}
              onChange={(on) => toggleLinkedFloor(f.id, on)}
              label={f.name}
              hint={f.id === floor.id ? 'Heimat-Stockwerk' : undefined}
            />
          ))}
        </Section>
      )}

      {(group || docked) && (
        <Section title="Verknüpfungen" icon={<Link2 size={15} />} storageKey="props.item.links">
          {group && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs">Gruppe mit {group.itemIds.length} Objekten</span>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => ui().setSelection(group.itemIds.map((id) => ({ kind: 'item', id }) as Selection))}>
                  Auswählen
                </Button>
                <Button size="sm" icon={<Ungroup size={13} />} onClick={() => transaction(() => store().ungroupItems(floor.id, [group.id]))}>
                  Auflösen
                </Button>
              </div>
            </div>
          )}
          {docked && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs">Angedockt an „{dockedName}“</span>
              <Button size="sm" onClick={() => setItemProps(floor, item.id, { dockedTo: undefined })}>
                Lösen
              </Button>
            </div>
          )}
        </Section>
      )}

      <ActionBar>
        <Button size="sm" icon={<Files size={14} />} onClick={() => (A.duplicateSelection ? A.duplicateSelection() : duplicateItemFallback(floor, item))} title="Strg+D">
          Duplizieren
        </Button>
        <Button size="sm" icon={locked ? <LockOpen size={14} /> : <Lock size={14} />} onClick={() => toggleLockFallback(floor, [{ kind: 'item', id: item.id }])} title="Strg+L">
          {locked ? 'Entsperren' : 'Sperren'}
        </Button>
        <Button size="sm" icon={item.hidden ? <Eye size={14} /> : <EyeOff size={14} />} onClick={() => (item.hidden ? setItemProps(floor, item.id, { hidden: false }) : toggleHideFallback(floor, [{ kind: 'item', id: item.id }]))}>
          {item.hidden ? 'Einblenden' : 'Ausblenden'}
        </Button>
        {def && (
          <Button
            size="sm"
            icon={<Library size={14} />}
            onClick={() => {
              ui().setToolOption('libraryFocusDefId', def.id);
              ui().setRightPanel('library');
            }}
            title="In der Bibliothek anzeigen (Filter auf Modell)"
          >
            Zur Bibliothek
          </Button>
        )}
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => deleteSelectionFallback(floor)} title="Entf">
          Löschen
        </Button>
      </ActionBar>
    </div>
  );
}

function duplicateItemFallback(floor: Floor, item: PlacedItem) {
  const copy: PlacedItem = { ...item, id: newId('i_'), x: item.x + 50, y: item.y + 50, groupId: undefined, dockedTo: undefined, locked: false, params: item.params ? { ...item.params } : undefined };
  transaction(() => store().addItem(floor.id, copy));
  ui().setSelection([{ kind: 'item', id: copy.id }]);
}

/** Objekt, das von einem anderen Stockwerk hierher verlinkt ist (Treppe/Aufzug). */
function LinkedItemProps({ item, fromFloor, project }: { item: PlacedItem; fromFloor: Floor; project: Project }) {
  const def = getDef(item.defId, project);
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<Layers size={16} />} title={item.label || def?.name || 'Objekt'} subtitle={`verankert auf „${fromFloor.name}“`} badges={<Pill tone="warn"><Lock size={10} /> hier gesperrt</Pill>} />
      <div className="flex flex-col gap-3 p-3">
        <Banner tone="info">Dieses Element gehört zum Stockwerk „{fromFloor.name}“ und wird hier nur angezeigt. Bearbeite es dort.</Banner>
        <div className="divide-y gp-border">
          <KeyValue label="Maße" value={formatDims(item.width, item.depth, item.height)} mono />
          <KeyValue label="Position" value={`${formatNumber(item.x, 0)} / ${formatNumber(item.y, 0)} cm`} mono />
        </div>
        <Button
          size="sm"
          variant="primary"
          icon={<Layers size={14} />}
          onClick={() => {
            store().setActiveFloor(fromFloor.id);
            ui().setSelection([{ kind: 'item', id: item.id }]);
          }}
        >
          Zu „{fromFloor.name}“ wechseln
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mehrfachauswahl                                                     */
/* ------------------------------------------------------------------ */

const ALIGN_BUTTONS: { mode: AlignMode; label: string; icon: ReactNode }[] = [
  { mode: 'left', label: 'Links ausrichten', icon: <AlignStartVertical size={15} /> },
  { mode: 'centerX', label: 'Horizontal zentrieren', icon: <AlignCenterVertical size={15} /> },
  { mode: 'right', label: 'Rechts ausrichten', icon: <AlignEndVertical size={15} /> },
  { mode: 'top', label: 'Oben ausrichten', icon: <AlignStartHorizontal size={15} /> },
  { mode: 'centerY', label: 'Vertikal zentrieren', icon: <AlignCenterHorizontal size={15} /> },
  { mode: 'bottom', label: 'Unten ausrichten', icon: <AlignEndHorizontal size={15} /> },
  { mode: 'distributeX', label: 'Horizontal gleichmäßig verteilen', icon: <AlignHorizontalDistributeCenter size={15} /> },
  { mode: 'distributeY', label: 'Vertikal gleichmäßig verteilen', icon: <AlignVerticalDistributeCenter size={15} /> },
];

function MultiItemProps({ items, floor, project, sel }: { items: PlacedItem[]; floor: Floor; project: Project; sel: Selection[] }) {
  const weight = items.reduce((s, it) => s + (getDef(it.defId, project)?.gewicht_kg ?? 0), 0);
  const unknownWeight = items.filter((it) => getDef(it.defId, project)?.gewicht_kg == null).length;
  const area = items.reduce((s, it) => s + (it.width * it.depth) / 10000, 0);
  const allLocked = items.every((it) => it.locked);
  const groupIds = new Set(items.map((it) => it.groupId).filter(Boolean));
  const inOneGroup = groupIds.size === 1 && items.every((it) => it.groupId);
  const zonesOn = items.filter((it) => it.safetyZoneEnabled).length;
  const canAlign = !!A.alignSelection;
  const groupFallback = () => transaction(() => store().groupItems(floor.id, items.map((i) => i.id)));
  const ungroupFallback = () => transaction(() => store().ungroupItems(floor.id, [...groupIds] as string[]));
  const rotateFallback = (deg: number) =>
    transaction(() => {
      const s = store();
      for (const it of items) if (!it.locked) s.updateItem(floor.id, it.id, { rotation: normalizeAngle(it.rotation + deg) });
    });
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<Boxes size={16} />} title={`${items.length} Objekte`} subtitle={`Gesamtgewicht ${formatKg(weight)}${unknownWeight ? ` (${unknownWeight} ohne Angabe)` : ''} · Grundfläche ${formatM2(area)}`} badges={allLocked ? <Pill tone="warn"><Lock size={10} /> gesperrt</Pill> : undefined} />
      <Section title="Ausrichten & Verteilen" icon={<AlignStartVertical size={15} />} storageKey="props.multi.align">
        {!canAlign && <Banner tone="muted">Ausrichten ist in dieser Version noch nicht verfügbar.</Banner>}
        <div className="grid grid-cols-4 gap-1">
          {ALIGN_BUTTONS.map((b) => (
            <button
              key={b.mode}
              type="button"
              className="gp-btn h-9 justify-center px-0"
              title={b.label}
              aria-label={b.label}
              disabled={!canAlign || (b.mode.startsWith('distribute') && items.length < 3)}
              onClick={() => A.alignSelection?.(b.mode)}
            >
              {b.icon}
            </button>
          ))}
        </div>
        <p className="text-[11px] gp-muted">Nach Bounding-Boxen; Verteilen benötigt mindestens drei Objekte. Gesperrte Objekte bleiben stehen.</p>
      </Section>
      <Section title="Gemeinsam bearbeiten" icon={<RotateCw size={15} />} storageKey="props.multi.edit">
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" icon={<RotateCw size={14} />} onClick={() => (A.rotateSelection ? A.rotateSelection(90) : rotateFallback(90))} title="R">
            +90°
          </Button>
          <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => (A.rotateSelection ? A.rotateSelection(-90) : rotateFallback(-90))} title="Shift+R">
            −90°
          </Button>
          {A.flipSelection && (
            <>
              <Button size="sm" icon={<FlipHorizontal2 size={14} />} onClick={() => A.flipSelection?.('x')} title="Spiegeln links ↔ rechts">
                Spiegeln
              </Button>
              <Button size="sm" icon={<FlipVertical2 size={14} />} onClick={() => A.flipSelection?.('y')} title="Spiegeln vorne ↔ hinten">
                Spiegeln
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {inOneGroup ? (
            <Button size="sm" icon={<Ungroup size={14} />} onClick={() => (A.ungroupSelection ? A.ungroupSelection() : ungroupFallback())} title="Strg+Shift+G">
              Gruppe auflösen
            </Button>
          ) : (
            <Button size="sm" icon={<Group size={14} />} onClick={() => (A.groupSelection ? A.groupSelection() : groupFallback())} title="Strg+G">
              Gruppieren
            </Button>
          )}
        </div>
        <Toggle
          label="Sicherheitszonen aktiv"
          hint={zonesOn === items.length ? 'bei allen aktiv' : zonesOn === 0 ? 'bei allen aus' : `bei ${zonesOn} von ${items.length} aktiv`}
          checked={zonesOn === items.length}
          onChange={(v) => transaction(() => store().updateItems(floor.id, items.map((i) => i.id), (it) => { it.safetyZoneEnabled = v; }))}
        />
      </Section>
      <LockHideDelete
        floor={floor}
        sel={sel}
        locked={allLocked}
        deleteLabel={`${items.length} löschen`}
        extra={
          <Button size="sm" icon={<Files size={14} />} onClick={() => A.duplicateSelection?.()} disabled={!A.duplicateSelection} title="Strg+D">
            Duplizieren
          </Button>
        }
      />
    </div>
  );
}

const KIND_LABELS: Record<Selection['kind'], string> = {
  item: 'Objekte', wall: 'Wände', zone: 'Zonen', room: 'Räume', opening: 'Öffnungen', annotation: 'Anmerkungen', void: 'Lufträume', hallVertex: 'Hallen-Eckpunkte', hallEdge: 'Hallenkanten',
};

function MixedProps({ sel, floor }: { sel: Selection[]; floor: Floor }) {
  const counts = new Map<Selection['kind'], number>();
  for (const s of sel) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  const lockable = sel.filter((s) => ['item', 'wall', 'zone', 'opening', 'annotation'].includes(s.kind));
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<Boxes size={16} />} title={`${sel.length} Elemente`} subtitle="gemischte Auswahl" />
      <div className="px-3 pt-3">
        <div className="divide-y gp-border">
          {[...counts.entries()].map(([k, n]) => (
            <KeyValue key={k} label={KIND_LABELS[k]} value={String(n)} mono />
          ))}
        </div>
        <p className="mt-2 text-[11px] gp-muted">Wähle ein einzelnes Element, um seine Eigenschaften zu bearbeiten.</p>
      </div>
      <LockHideDelete floor={floor} sel={lockable.length ? lockable : sel} locked={false} deleteLabel={`${sel.length} löschen`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wand                                                                */
/* ------------------------------------------------------------------ */

function WallProps({ wall, floor }: { wall: Wall; floor: Floor }) {
  const len = wallLength(wall);
  const locked = !!wall.locked;
  const openings = floor.openings.filter((o) => o.wallId === wall.id);
  const patch = (p: Partial<Wall>) =>
    transaction(() => {
      const s = store();
      s.updateWall(floor.id, wall.id, p);
      // Öffnungen auf der Wand halten
      const nw = { ...wall, ...p };
      for (const o of openings) {
        const off = clampOpeningOffset(o.offset, o.width, nw);
        if (Math.abs(off - o.offset) > 1e-6) s.updateOpening(floor.id, o.id, { offset: off });
      }
    });
  const setLength = (v: number) => {
    if (!(v >= 1)) return;
    if (A.setWallLength) {
      if (!A.setWallLength(wall.id, v)) ui().toast('Wandlänge konnte nicht gesetzt werden', 'warning');
      return;
    }
    const dir = wallDirection(wall);
    if (!dir.x && !dir.y) return;
    patch({ end: add(wall.start, scale(dir, v)) });
  };
  const split = () => {
    const mid = wallMidpoint(wall);
    if (A.splitWallAtPoint) {
      if (!A.splitWallAtPoint(wall.id, mid)) ui().toast('Wand ist zu kurz zum Teilen', 'warning');
      return;
    }
    const parts = splitWall(wall, mid);
    if (!parts) {
      ui().toast('Wand ist zu kurz zum Teilen', 'warning');
      return;
    }
    const reassigned = reassignOpeningsAfterSplit(floor.openings, wall, parts);
    transaction(() => {
      const s = store();
      reassigned.forEach((o, i) => {
        if (o !== floor.openings[i]) s.updateOpening(floor.id, o.id, { wallId: o.wallId, offset: o.offset });
      });
      s.replaceWalls(floor.id, [wall.id], parts);
    });
  };
  const typeInfo = WALL_TYPES.find((t) => t.type === wall.type);
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<BrickWall size={16} />} title={`Wand · ${wall.type}`} subtitle={`${formatLength(len)} · ${formatCm(wall.thickness)} · ${wall.height == null ? 'raumhoch' : formatCm(wall.height)}`} color={typeInfo?.color} badges={locked ? <Pill tone="warn"><Lock size={10} /> gesperrt</Pill> : undefined} />
      <Section title="Geometrie" icon={<Ruler size={15} />} storageKey="props.wall.geo">
        <LengthField label="Länge (Achsmaß)" value={len} onChange={(v) => v != null && setLength(v)} min={1} decimals={1} disabled={locked} hint="Verschiebt den Endpunkt entlang der Wand; verbundene Wände folgen." />
        <Grid2>
          <LengthField label="Anfang X" value={wall.start.x} onChange={(v) => v != null && patch({ start: { ...wall.start, x: v } })} decimals={0} disabled={locked} />
          <LengthField label="Anfang Y" value={wall.start.y} onChange={(v) => v != null && patch({ start: { ...wall.start, y: v } })} decimals={0} disabled={locked} />
          <LengthField label="Ende X" value={wall.end.x} onChange={(v) => v != null && patch({ end: { ...wall.end, x: v } })} decimals={0} disabled={locked} />
          <LengthField label="Ende Y" value={wall.end.y} onChange={(v) => v != null && patch({ end: { ...wall.end, y: v } })} decimals={0} disabled={locked} />
        </Grid2>
      </Section>
      <Section title="Aufbau" icon={<BrickWall size={15} />} storageKey="props.wall.build">
        <ThicknessField label="Stärke" value={wall.thickness} onChange={(v) => patch({ thickness: v })} />
        <SelectField label="Typ" value={wall.type} options={WALL_TYPE_OPTIONS} onChange={(v: WallType) => patch({ type: v })} />
        <LengthField label="Höhe" value={wall.height} onChange={(v) => patch({ height: v })} allowEmpty placeholder={`raumhoch (${formatCm(floor.ceilingHeight)})`} min={1} decimals={0} hint="Leer = bis zur Decke" />
        <div className="divide-y gp-border">
          <KeyValue label="Öffnungen" value={openings.length ? `${openings.length} (${openings.map((o) => (o.kind === 'door' ? 'Tür' : o.kind === 'window' ? 'Fenster' : 'Spiegel')).join(', ')})` : undefined} empty="keine" />
          <KeyValue label="Wandfläche" value={formatM2((len * (wall.height ?? floor.ceilingHeight)) / 10000)} mono />
        </div>
      </Section>
      <LockHideDelete
        floor={floor}
        sel={[{ kind: 'wall', id: wall.id }]}
        locked={locked}
        deleteLabel="Wand löschen"
        extra={
          <Button size="sm" icon={<Scissors size={14} />} onClick={split} disabled={locked || len < 2}>
            Wand teilen (Mitte)
          </Button>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Raum / Zone                                                         */
/* ------------------------------------------------------------------ */

function RoomProps({ room, zone, floor }: { room: Room; zone?: Zone; floor: Floor }) {
  const meta: RoomMeta = zone ?? { name: room.name, type: room.type, color: room.color, floorCovering: room.floorCovering, labelMode: room.labelMode, note: room.note };
  const patch = (p: Partial<RoomMeta>) =>
    transaction(() => {
      if (zone) store().updateZone(floor.id, zone.id, p);
      else if (room.loopKey) store().setRoomMeta(floor.id, room.loopKey, p);
    });
  const typeColor = roomColor(meta.type);
  const locked = !!zone?.locked;
  const isZone = !!zone;
  return (
    <div className="flex flex-col">
      <PanelHeader
        icon={<LayoutDashboard size={16} />}
        title={meta.name || (isZone ? 'Zone' : 'Raum')}
        subtitle={`${meta.type} · ${formatM2(room.areaM2)}`}
        color={roomColor(meta.type, meta.color)}
        badges={
          <>
            <Pill tone={isZone ? 'accent' : 'muted'}>{isZone ? 'Zone' : 'aus Wänden erkannt'}</Pill>
            {locked && <Pill tone="warn"><Lock size={10} /> gesperrt</Pill>}
          </>
        }
      />
      {!isZone && <div className="px-3 pt-3"><Banner tone="info">Dieser Raum entsteht automatisch aus einem geschlossenen Wandzug. Name, Typ und Farbe bleiben erhalten, solange der Raum ungefähr an derselben Stelle liegt.</Banner></div>}
      <Section title="Bezeichnung" icon={<Tag size={15} />} storageKey="props.room.name">
        <TextField label="Name" value={meta.name} onChange={(v) => patch({ name: v || (isZone ? 'Zone' : 'Raum') })} />
        <SelectField label="Typ" value={meta.type} options={ROOM_TYPE_OPTIONS} onChange={(v: RoomType) => patch({ type: v })} />
        <SelectField label="Bodenbelag" value={meta.floorCovering ?? ''} options={[{ value: '', label: floor.hall ? `wie Halle (${floor.hall.floorCovering})` : '– keine Angabe –' }, ...FLOOR_COVERING_OPTIONS]} onChange={(v) => patch({ floorCovering: v || undefined })} />
        <SelectField label="Beschriftung in der Raummitte" value={meta.labelMode ?? 'name+area'} options={LABEL_MODE_OPTIONS} onChange={(v: RoomLabelMode) => patch({ labelMode: v })} />
      </Section>
      <Section title="Farbe" icon={<Palette size={15} />} storageKey="props.room.color" badge={meta.color ? 'eigene' : 'Typfarbe'}>
        <ColorField value={meta.color} fallback={typeColor} onChange={(hex) => patch({ color: hex })} onReset={() => patch({ color: undefined })} resetLabel="Typfarbe verwenden" presets={ROOM_COLOR_PRESETS} hint={meta.color ? undefined : `Typfarbe von „${meta.type}“`} />
      </Section>
      <Section title="Fläche" icon={<Scan size={15} />} storageKey="props.room.area">
        <div className="divide-y gp-border">
          <KeyValue label="Fläche" value={formatM2(room.areaM2)} mono title={room.holes?.length ? 'Innenflächen (Raum im Raum) abgezogen' : 'Innenfläche ohne Wandstärke'} />
          <KeyValue label="Umfang" value={formatM(room.perimeterCm)} mono />
          <KeyValue label="Eckpunkte" value={String(room.polygon.length)} mono />
          {room.holes && room.holes.length > 0 && <KeyValue label="Aussparungen" value={String(room.holes.length)} mono />}
          <KeyValue label="Mittelpunkt" value={`${formatNumber(room.centroid.x, 0)} / ${formatNumber(room.centroid.y, 0)} cm`} mono />
        </div>
        <TextField label="Notiz" value={meta.note ?? ''} multiline rows={2} onChange={(v) => patch({ note: v || undefined })} hint="Strg+Enter übernimmt" />
      </Section>
      {isZone ? (
        <LockHideDelete floor={floor} sel={[{ kind: 'zone', id: zone.id }]} locked={locked} deleteLabel="Zone löschen" />
      ) : (
        <ActionBar>
          <Button size="sm" icon={<BrickWall size={14} />} onClick={() => ui().setTool('wall')} title="W">
            Wände bearbeiten
          </Button>
          <span className="self-center text-[11px] gp-muted">Zum Entfernen die umgebenden Wände löschen.</span>
        </ActionBar>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Öffnung                                                             */
/* ------------------------------------------------------------------ */

function OpeningProps({ opening, floor }: { opening: Opening; floor: Floor }) {
  const wall = findWall(floor, opening.wallId);
  const len = wall ? wallLength(wall) : 0;
  const locked = !!opening.locked;
  const label = opening.kind === 'door' ? 'Tür' : opening.kind === 'window' ? 'Fenster' : 'Spiegel';
  const Icon = opening.kind === 'door' ? DoorOpen : opening.kind === 'window' ? AppWindow : Square;
  const patch = (p: Partial<Opening>) => transaction(() => store().updateOpening(floor.id, opening.id, p));
  const setWidth = (w: number) => {
    if (!(w >= 10)) return;
    patch({ width: w, offset: wall ? clampOpeningOffset(opening.offset, w, wall) : opening.offset });
  };
  const setOffset = (o: number) => patch({ offset: wall ? clampOpeningOffset(o, opening.width, wall) : o });
  return (
    <div className="flex flex-col">
      <PanelHeader
        icon={<Icon size={16} />}
        title={opening.kind === 'door' ? `Tür · ${opening.doorType}` : label}
        subtitle={`Breite ${formatCm(opening.width)}${wall ? ` · in ${isHallWallId(wall.id) ? 'Außenwand' : wall.type}` : ' · Wand fehlt'}`}
        badges={locked ? <Pill tone="warn"><Lock size={10} /> gesperrt</Pill> : undefined}
      />
      {!wall && <div className="px-3 pt-3"><Banner tone="danger">Die zugehörige Wand existiert nicht mehr – Öffnung löschen.</Banner></div>}
      <Section title="Maße" icon={<Ruler size={15} />} storageKey="props.opening.dims">
        {opening.kind === 'door' && (
          <SelectField
            label="Türtyp"
            value={opening.doorType}
            options={DOOR_TYPE_OPTIONS}
            onChange={(v: DoorType) => {
              const info = DOOR_TYPE_MAP[v];
              patch({ doorType: v, height: info.defaultHeight });
            }}
            hint="Ändert die Standardhöhe des Typs"
            disabled={locked}
          />
        )}
        {opening.kind === 'door' ? (
          <div className="grid grid-cols-[1fr_92px] items-end gap-2">
            <SelectField label="Breite" value={opening.width} options={DOOR_WIDTH_OPTIONS} onChange={setWidth} formatCurrent={(v) => `${formatCm(v)} (frei)`} disabled={locked} />
            <LengthField ariaLabel="Breite frei eingeben" value={opening.width} onChange={(v) => v != null && setWidth(v)} min={10} max={len || undefined} decimals={0} disabled={locked} />
          </div>
        ) : (
          <LengthField label={opening.kind === 'mirror' ? 'Länge' : 'Breite'} value={opening.width} onChange={(v) => v != null && setWidth(v)} min={10} max={len || undefined} decimals={0} disabled={locked} />
        )}
        <Grid2>
          <LengthField label="Höhe" value={opening.height} onChange={(v) => v != null && patch({ height: v })} min={10} max={floor.ceilingHeight} decimals={0} disabled={locked} />
          {opening.kind === 'window' && <LengthField label="Brüstungshöhe" value={opening.sillHeight} onChange={(v) => v != null && patch({ sillHeight: v })} min={0} max={floor.ceilingHeight} decimals={0} disabled={locked} />}
        </Grid2>
        {opening.kind === 'window' && opening.sillHeight + opening.height > floor.ceilingHeight && <Banner tone="warn">Brüstung + Fensterhöhe überschreiten die Deckenhöhe ({formatCm(floor.ceilingHeight)}).</Banner>}
      </Section>
      <Section title="Lage in der Wand" icon={<MapPin size={15} />} storageKey="props.opening.pos">
        <LengthField label="Position ab Wandanfang (Mitte)" value={opening.offset} onChange={(v) => v != null && setOffset(v)} min={opening.width / 2} max={Math.max(opening.width / 2, len - opening.width / 2)} decimals={0} step={5} disabled={locked || !wall} hint={wall ? `Wandlänge ${formatLength(len)}` : undefined} />
        {opening.kind === 'door' && (
          <>
            <div className="flex flex-col gap-1">
              <span className="gp-label">Anschlag</span>
              <SegmentedControl
                value={opening.hinge}
                options={[
                  { value: 'left', label: 'Links' },
                  { value: 'right', label: 'Rechts' },
                ]}
                onChange={(v) => !locked && patch({ hinge: v })}
                ariaLabel="Anschlag"
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" icon={<ArrowLeftRight size={14} />} disabled={locked} onClick={() => patch({ hinge: opening.hinge === 'left' ? 'right' : 'left' })}>
                Anschlag umkehren
              </Button>
              <Button size="sm" icon={<MoveVertical size={14} />} disabled={locked} onClick={() => patch({ swingSide: opening.swingSide === 'a' ? 'b' : 'a' })} title="Öffnet zur anderen Wandseite">
                Aufschlagseite umkehren
              </Button>
            </div>
            <KeyValue label="Aufschlag" value={`${DOOR_TYPE_MAP[opening.doorType]?.swings === false ? 'ohne Schwenkbereich' : opening.swingSide === 'a' ? 'Seite A' : 'Seite B'}${DOOR_TYPE_MAP[opening.doorType]?.leaves === 2 ? ' · zweiflügelig' : ''}`} />
          </>
        )}
        {opening.kind === 'mirror' && (
          <div className="flex flex-col gap-1">
            <span className="gp-label">Wandseite</span>
            <SegmentedControl
              value={opening.side}
              options={[
                { value: 'a', label: 'Seite A' },
                { value: 'b', label: 'Seite B' },
              ]}
              onChange={(v) => !locked && patch({ side: v })}
              ariaLabel="Wandseite"
              className="w-full"
            />
          </div>
        )}
        <TextField label="Notiz" value={opening.note ?? ''} onChange={(v) => patch({ note: v || undefined })} />
      </Section>
      <LockHideDelete floor={floor} sel={[{ kind: 'opening', id: opening.id }]} locked={locked} deleteLabel={`${label} löschen`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Anmerkung, Luftraum                                                 */
/* ------------------------------------------------------------------ */

function AnnotationProps({ ann, floor }: { ann: Annotation; floor: Floor }) {
  const locked = !!ann.locked;
  const patch = (p: Partial<Annotation>) => transaction(() => store().updateAnnotation(floor.id, ann.id, p));
  if (ann.kind === 'text') {
    return (
      <div className="flex flex-col">
        <PanelHeader icon={<MessageSquareText size={16} />} title="Textnotiz" subtitle={ann.text.slice(0, 60) || '(leer)'} badges={locked ? <Pill tone="warn"><Lock size={10} /> gesperrt</Pill> : undefined} />
        <Section title="Text" icon={<MessageSquareText size={15} />} storageKey="props.text">
          <TextField label="Text" value={ann.text} multiline rows={3} onChange={(v) => patch({ text: v })} disabled={locked} hint="Strg+Enter übernimmt" />
          <Grid2>
            <NumberField label="Schriftgröße" value={ann.fontSize} onChange={(v) => v != null && patch({ fontSize: v })} unit="cm" min={4} max={500} step={2} decimals={0} disabled={locked} />
            <NumberField label="Drehung" value={ann.rotation} onChange={(v) => v != null && patch({ rotation: normalizeAngle(v) })} unit="°" step={15} decimals={0} disabled={locked} />
            <LengthField label="Position X" value={ann.x} onChange={(v) => v != null && patch({ x: v })} decimals={0} disabled={locked} />
            <LengthField label="Position Y" value={ann.y} onChange={(v) => v != null && patch({ y: v })} decimals={0} disabled={locked} />
          </Grid2>
          <ColorField label="Farbe" value={ann.color} fallback="#0f172a" onChange={(hex) => patch({ color: hex })} onReset={() => patch({ color: undefined })} resetLabel="Standardfarbe" disabled={locked} />
        </Section>
        <LockHideDelete floor={floor} sel={[{ kind: 'annotation', id: ann.id }]} locked={locked} />
      </div>
    );
  }
  const len = distance(ann.start, ann.end);
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<Ruler size={16} />} title="Messlinie" subtitle={formatLength(len)} badges={locked ? <Pill tone="warn"><Lock size={10} /> gesperrt</Pill> : undefined} />
      <Section title="Messung" icon={<Ruler size={15} />} storageKey="props.measure">
        <div className="divide-y gp-border">
          <KeyValue label="Länge" value={formatLength(len)} mono />
          <KeyValue label="Länge (cm)" value={formatNumber(len, 1)} mono />
        </div>
        <Grid2>
          <LengthField label="Start X" value={ann.start.x} onChange={(v) => v != null && patch({ start: { ...ann.start, x: v } })} decimals={0} disabled={locked} />
          <LengthField label="Start Y" value={ann.start.y} onChange={(v) => v != null && patch({ start: { ...ann.start, y: v } })} decimals={0} disabled={locked} />
          <LengthField label="Ende X" value={ann.end.x} onChange={(v) => v != null && patch({ end: { ...ann.end, x: v } })} decimals={0} disabled={locked} />
          <LengthField label="Ende Y" value={ann.end.y} onChange={(v) => v != null && patch({ end: { ...ann.end, y: v } })} decimals={0} disabled={locked} />
        </Grid2>
      </Section>
      <LockHideDelete floor={floor} sel={[{ kind: 'annotation', id: ann.id }]} locked={locked} />
    </div>
  );
}

function VoidProps({ v, floor }: { v: VoidArea; floor: Floor }) {
  const area = polygonAreaM2(v.polygon);
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<SquareDashed size={16} />} title={v.name || 'Luftraum'} subtitle={`${formatM2(area)} · offen nach unten`} />
      <Section title="Luftraum" icon={<SquareDashed size={15} />} storageKey="props.void">
        <Banner tone="info">Lufträume (Galerie/Empore) zählen nicht zur Nutzfläche des Stockwerks.</Banner>
        <TextField label="Name" value={v.name ?? ''} onChange={(t) => transaction(() => store().updateVoid(floor.id, v.id, { name: t || undefined }))} placeholder="Luftraum" />
        <div className="divide-y gp-border">
          <KeyValue label="Fläche" value={formatM2(area)} mono />
          <KeyValue label="Umfang" value={formatM(perimeter(v.polygon))} mono />
          <KeyValue label="Eckpunkte" value={String(v.polygon.length)} mono />
        </div>
      </Section>
      <ActionBar>
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 size={14} />}
          onClick={() => {
            transaction(() => store().deleteVoids(floor.id, [v.id]));
            ui().clearSelection();
          }}
          title="Entf"
        >
          Luftraum löschen
        </Button>
      </ActionBar>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hallen-Eckpunkt / -Kante                                            */
/* ------------------------------------------------------------------ */

function HallVertexProps({ index, floor }: { index: number; floor: Floor }) {
  const hall = floor.hall!;
  const n = hall.polygon.length;
  const p = hall.polygon[index];
  const prev = hall.polygon[(index - 1 + n) % n];
  const next = hall.polygon[(index + 1) % n];
  const set = (q: Partial<Vec2>) => transaction(() => store().updateHall(floor.id, (h) => { h.polygon[index] = { ...h.polygon[index], ...q }; }));
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<Pentagon size={16} />} title={`Hallen-Eckpunkt P${index + 1}`} subtitle={`${formatNumber(p.x, 0)} / ${formatNumber(p.y, 0)} cm · Halle ${formatM2(polygonAreaM2(hall.polygon))}`} />
      <Section title="Position" icon={<MapPin size={15} />} storageKey="props.hallVertex">
        <Grid2>
          <LengthField label="X" value={p.x} onChange={(v) => v != null && set({ x: v })} decimals={0} />
          <LengthField label="Y" value={p.y} onChange={(v) => v != null && set({ y: v })} decimals={0} />
        </Grid2>
        <div className="divide-y gp-border">
          <KeyValue label={`Kante P${((index - 1 + n) % n) + 1} → P${index + 1}`} value={formatLength(distance(prev, p))} mono />
          <KeyValue label={`Kante P${index + 1} → P${((index + 1) % n) + 1}`} value={formatLength(distance(p, next))} mono />
        </div>
        <ThicknessField label="Außenwandstärke" value={hall.wallThickness} onChange={(v) => transaction(() => store().updateHall(floor.id, (h) => { h.wallThickness = v; }))} />
      </Section>
      <ActionBar>
        <Button size="sm" icon={<Trash2 size={14} />} disabled={n <= 3} onClick={() => deleteSelectionFallback(floor)} title={n <= 3 ? 'Mindestens drei Eckpunkte' : 'Entf'}>
          Eckpunkt entfernen
        </Button>
        <DeleteHallButton floor={floor} />
      </ActionBar>
    </div>
  );
}

function HallEdgeProps({ index, floor }: { index: number; floor: Floor }) {
  const hall = floor.hall!;
  const n = hall.polygon.length;
  const a = hall.polygon[index];
  const b = hall.polygon[(index + 1) % n];
  const len = distance(a, b);
  const setLength = (v: number) => {
    if (!(v >= 1)) return;
    if (A.setHallEdgeLength) {
      if (!A.setHallEdgeLength(index, v)) ui().toast('Kantenlänge konnte nicht gesetzt werden', 'warning');
      return;
    }
    const dir = normalize(sub(b, a));
    if (!dir.x && !dir.y) return;
    const nb = add(a, scale(dir, v));
    transaction(() => store().updateHall(floor.id, (h) => { h.polygon[(index + 1) % n] = nb; }));
  };
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<Building2 size={16} />} title={`Hallenkante P${index + 1} → P${((index + 1) % n) + 1}`} subtitle={`${formatLength(len)} · Außenwand ${formatCm(hall.wallThickness)}`} />
      <Section title="Kante" icon={<Ruler size={15} />} storageKey="props.hallEdge">
        <LengthField label="Länge (Außenmaß)" value={len} onChange={(v) => v != null && setLength(v)} min={1} decimals={0} hint="Verschiebt den Endpunkt entlang der Kante; bei Rechtecken wandern die anschließenden Ecken mit." />
        <ThicknessField label="Außenwandstärke" value={hall.wallThickness} onChange={(v) => transaction(() => store().updateHall(floor.id, (h) => { h.wallThickness = v; }))} />
        <div className="divide-y gp-border">
          <KeyValue label="Von" value={`${formatNumber(a.x, 0)} / ${formatNumber(a.y, 0)} cm`} mono />
          <KeyValue label="Bis" value={`${formatNumber(b.x, 0)} / ${formatNumber(b.y, 0)} cm`} mono />
          <KeyValue label="Hallenfläche" value={formatM2(polygonAreaM2(hall.polygon))} mono />
        </div>
      </Section>
      <ActionBar>
        <Button size="sm" icon={<DoorOpen size={14} />} onClick={() => ui().setTool('door')} title="D">
          Tür einsetzen
        </Button>
        <Button size="sm" icon={<AppWindow size={14} />} onClick={() => ui().setTool('window')} title="F">
          Fenster einsetzen
        </Button>
        <DeleteHallButton floor={floor} />
      </ActionBar>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Verteiler                                                           */
/* ------------------------------------------------------------------ */

function StaleSelection({ sel }: { sel: Selection[] }) {
  return (
    <div className="flex flex-col">
      <PanelHeader icon={<Info size={16} />} title="Auswahl nicht gefunden" subtitle={`${sel.length} Element${sel.length === 1 ? '' : 'e'} nicht auf diesem Stockwerk`} />
      <div className="flex flex-col gap-3 p-3">
        <Banner tone="muted">Die gewählten Elemente liegen nicht (mehr) auf dem aktiven Stockwerk – vielleicht wurden sie gelöscht oder das Stockwerk gewechselt.</Banner>
        <Button size="sm" onClick={() => ui().clearSelection()} icon={<X size={14} />}>
          Auswahl aufheben
        </Button>
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  // Während eines Zieh-Vorgangs eingefrorener Stand (Objekte werden transient gezogen; Wände/Öffnungen je Bewegung im Store)
  const project = useProjectFrozenWhileDragging();
  const floor = activeFloorOf(project);
  const rooms = useFloorRooms(floor);
  const selection = useUiStore((s) => s.selection);

  const content = useMemo<ReactNode>(() => {
    // Hallen-Außenwände (hall_<i>) sind keine echten Wände – ignorieren
    const sel = selection.filter((s) => !(s.kind === 'wall' && isHallWallId(s.id)));
    if (!sel.length) return <FloorHallProps floor={floor} rooms={rooms} />;
    const kinds = new Set(sel.map((s) => s.kind));
    if (kinds.size === 1 && kinds.has('item')) {
      const ids = new Set(sel.map((s) => s.id));
      const items = floor.items.filter((it) => ids.has(it.id));
      if (items.length === 1 && sel.length === 1) return <ItemProps item={items[0]} floor={floor} project={project} />;
      if (items.length > 1) return <MultiItemProps items={items} floor={floor} project={project} sel={sel} />;
      if (sel.length === 1) {
        for (const f of project.floors) {
          if (f.id === floor.id) continue;
          const linked = f.items.find((it) => it.id === sel[0].id);
          if (linked) return <LinkedItemProps item={linked} fromFloor={f} project={project} />;
        }
      }
      return <StaleSelection sel={sel} />;
    }
    if (sel.length > 1) return <MixedProps sel={sel} floor={floor} />;
    const s = sel[0];
    switch (s.kind) {
      case 'wall': {
        const w = floor.walls.find((x) => x.id === s.id);
        return w ? <WallProps wall={w} floor={floor} /> : <StaleSelection sel={sel} />;
      }
      case 'zone':
      case 'room': {
        const room = rooms.find((r) => r.id === s.id);
        const zone = s.kind === 'zone' ? floor.zones.find((z) => z.id === s.id) : undefined;
        if (zone && !room) {
          // ausgeblendete Zone: floorRooms lässt sie aus – Kennzahlen direkt aus dem Polygon ableiten
          const b = bbox(zone.polygon);
          const { locked: _l, hidden: _h, ...meta } = zone;
          const fake: Room = { ...meta, source: 'zone', areaM2: polygonAreaM2(zone.polygon), perimeterCm: perimeter(zone.polygon), centroid: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } };
          return <RoomProps room={fake} zone={zone} floor={floor} />;
        }
        return room ? <RoomProps room={room} zone={zone} floor={floor} /> : <StaleSelection sel={sel} />;
      }
      case 'opening': {
        const o = floor.openings.find((x) => x.id === s.id);
        return o ? <OpeningProps opening={o} floor={floor} /> : <StaleSelection sel={sel} />;
      }
      case 'annotation': {
        const a = floor.annotations.find((x) => x.id === s.id);
        return a ? <AnnotationProps ann={a} floor={floor} /> : <StaleSelection sel={sel} />;
      }
      case 'void': {
        const v = floor.voids.find((x) => x.id === s.id);
        return v ? <VoidProps v={v} floor={floor} /> : <StaleSelection sel={sel} />;
      }
      case 'hallVertex': {
        const i = Number(s.id);
        return floor.hall && Number.isInteger(i) && i >= 0 && i < floor.hall.polygon.length ? <HallVertexProps index={i} floor={floor} /> : <StaleSelection sel={sel} />;
      }
      case 'hallEdge': {
        const i = Number(s.id);
        return floor.hall && Number.isInteger(i) && i >= 0 && i < floor.hall.polygon.length ? <HallEdgeProps index={i} floor={floor} /> : <StaleSelection sel={sel} />;
      }
      default:
        return <StaleSelection sel={sel} />;
    }
  }, [selection, floor, rooms, project]);

  return (
    <div data-tutorial="properties" className="flex flex-col text-sm">
      {content}
    </div>
  );
}
