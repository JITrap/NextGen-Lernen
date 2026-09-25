import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, EllipsisVertical, Pencil, Copy, ArrowLeft, ArrowRight, Trash2, MoveVertical } from 'lucide-react';
import type { Floor, Id } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useSortedFloors } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';
import { formatM } from '@/geometry/units';
import { DEFAULT_CEILING_HEIGHT } from '@/store/factories';
import { Popover, MenuList, type MenuEntry } from './ui/Menu';
import { Modal, ConfirmDialog, PromptDialog } from './ui/Modal';
import { Button, IconButton } from './ui/Button';
import { Select } from './ui/Select';
import { TextInput, NumberInput } from './ui/Input';
import { parseNumber } from '@/geometry/units';

export type FloorKind = 'OG' | 'UG' | 'Galerie' | 'EG' | 'custom';

const KIND_OPTIONS: { value: FloorKind; label: string }[] = [
  { value: 'OG', label: 'Obergeschoss (OG)' },
  { value: 'UG', label: 'Untergeschoss (UG)' },
  { value: 'Galerie', label: 'Galerie / Empore' },
  { value: 'EG', label: 'Erdgeschoss (EG)' },
  { value: 'custom', label: 'Eigener Name' },
];

const MIN_CEILING = 150;
const MAX_CEILING = 1500;

/** Namensvorschlag für ein neues Stockwerk („OG 2“, „UG“, „Galerie“). */
export function suggestFloorName(kind: FloorKind, floors: Floor[]): string {
  const names = floors.map((f) => f.name.trim());
  const nextNumbered = (prefix: string, firstPlain: boolean) => {
    const re = new RegExp(`^${prefix}\\s*(\\d+)?$`, 'i');
    let max = 0;
    let plain = false;
    for (const n of names) {
      const m = n.match(re);
      if (!m) continue;
      if (m[1]) max = Math.max(max, Number(m[1]));
      else plain = true;
    }
    if (firstPlain) {
      if (!plain && max === 0) return prefix;
      return `${prefix} ${Math.max(max, 1) + 1}`;
    }
    return `${prefix} ${max + 1}`;
  };
  switch (kind) {
    case 'OG':
      return nextNumbered('OG', false);
    case 'UG':
      return nextNumbered('UG', true);
    case 'Galerie':
      return nextNumbered('Galerie', true);
    case 'EG':
      return names.some((n) => /^EG$/i.test(n)) ? nextNumbered('EG', true) : 'EG';
    default:
      return `Stockwerk ${floors.length + 1}`;
  }
}

/** Sortierwert für ein neues Stockwerk: UG unter das unterste, alles andere über das oberste. */
export function suggestFloorOrder(kind: FloorKind, floors: Floor[]): number {
  const orders = floors.map((f) => f.order);
  const max = orders.length ? Math.max(...orders) : -1;
  const min = orders.length ? Math.min(...orders) : 1;
  return kind === 'UG' ? min - 1 : max + 1;
}

function AddFloorDialog({ open, onClose, floors, activeCeiling }: { open: boolean; onClose: () => void; floors: Floor[]; activeCeiling: number }) {
  const addFloor = useProjectStore((s) => s.addFloor);
  const toast = useUiStore((s) => s.toast);
  const [kind, setKind] = useState<FloorKind>('OG');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [ceiling, setCeiling] = useState(activeCeiling);

  useEffect(() => {
    if (!open) return;
    setKind('OG');
    setNameTouched(false);
    setName(suggestFloorName('OG', floors));
    setCeiling(activeCeiling || DEFAULT_CEILING_HEIGHT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const changeKind = (k: FloorKind) => {
    setKind(k);
    if (!nameTouched || k !== 'custom') setName(suggestFloorName(k, floors));
  };
  const valid = name.trim().length > 0 && ceiling >= MIN_CEILING && ceiling <= MAX_CEILING;
  const submit = () => {
    if (!valid) return;
    const order = suggestFloorOrder(kind, floors);
    addFloor({ name: name.trim(), order, ceilingHeight: ceiling });
    toast(`Stockwerk „${name.trim()}“ angelegt`, 'success');
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stockwerk hinzufügen"
      width={440}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" data-primary="true" onClick={submit} disabled={!valid} icon={<Plus size={16} />}>
            Hinzufügen
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Select label="Art" value={kind} options={KIND_OPTIONS} onChange={changeKind} />
        <TextInput
          label="Name"
          value={name}
          data-autofocus="true"
          maxLength={40}
          onChange={(v) => {
            setName(v);
            setNameTouched(true);
          }}
        />
        <NumberInput label="Deckenhöhe" unit="cm" value={ceiling} min={MIN_CEILING} max={MAX_CEILING} step={10} decimals={0} onChange={setCeiling} />
        <p className="text-xs gp-muted">
          {kind === 'UG' ? 'Wird unter dem untersten Stockwerk eingeordnet.' : 'Wird über dem obersten Stockwerk eingeordnet.'} Reihenfolge und Name lassen sich später über das Tab-Menü ändern.
        </p>
      </form>
    </Modal>
  );
}

interface TabProps {
  floor: Floor;
  active: boolean;
  onSelect: () => void;
  onMenu: (el: HTMLElement | { x: number; y: number }) => void;
  renaming: boolean;
  onRenameStart: () => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
}

function FloorTab({ floor, active, onSelect, onMenu, renaming, onRenameStart, onRenameCommit, onRenameCancel }: TabProps) {
  const [draft, setDraft] = useState(floor.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (renaming) {
      setDraft(floor.name);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [renaming, floor.name]);

  const title = `${floor.name} · Deckenhöhe ${formatM(floor.ceilingHeight)} · ${floor.items.length} Objekte (Doppelklick: umbenennen, Rechtsklick: Menü)`;

  if (renaming) {
    return (
      <div className="flex h-9 shrink-0 items-center px-1" role="tab" aria-selected={active}>
        <input
          ref={inputRef}
          className="gp-input h-8 w-32 py-0 text-sm"
          value={draft}
          maxLength={40}
          aria-label="Stockwerk umbenennen"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onRenameCommit(draft)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') onRenameCommit(draft);
            else if (e.key === 'Escape') onRenameCancel();
          }}
        />
      </div>
    );
  }
  return (
    <div
      role="tab"
      aria-selected={active}
      className={`group flex h-9 shrink-0 items-center rounded-md pl-1 transition-colors ${active ? 'gp-tab active' : 'gp-tab'}`}
      style={active ? undefined : { color: 'var(--gp-text)' }}
      title={title}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect();
        onMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <button
        type="button"
        className="h-full max-w-[160px] truncate px-1.5 text-sm font-medium outline-none"
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.preventDefault();
          onRenameStart();
        }}
      >
        {floor.name}
      </button>
      <button
        ref={menuBtnRef}
        type="button"
        aria-label={`Menü für Stockwerk ${floor.name}`}
        title="Stockwerk-Menü"
        className={`inline-flex h-full w-7 items-center justify-center rounded-r-md opacity-70 transition-opacity hover:opacity-100 ${active ? '' : 'group-hover:opacity-100 md:opacity-40'}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
          if (menuBtnRef.current) onMenu(menuBtnRef.current);
        }}
      >
        <EllipsisVertical size={14} />
      </button>
    </div>
  );
}

/**
 * Stockwerk-Tabs (sortiert nach order: UG … EG … OG). Klick wählt, Doppelklick benennt um,
 * „+“ legt ein neues an, Menü je Tab: Umbenennen, Duplizieren, Verschieben, Deckenhöhe, Löschen.
 */
export function FloorTabs({ className = '' }: { className?: string }) {
  const floors = useSortedFloors();
  const activeId = useProjectStore((s) => s.project.activeFloorId);
  const setActiveFloor = useProjectStore((s) => s.setActiveFloor);
  const renameFloor = useProjectStore((s) => s.renameFloor);
  const duplicateFloor = useProjectStore((s) => s.duplicateFloor);
  const deleteFloor = useProjectStore((s) => s.deleteFloor);
  const moveFloor = useProjectStore((s) => s.moveFloor);
  const setFloorCeilingHeight = useProjectStore((s) => s.setFloorCeilingHeight);
  const toast = useUiStore((s) => s.toast);
  const clearSelection = useUiStore((s) => s.clearSelection);

  const [renamingId, setRenamingId] = useState<Id | null>(null);
  const [menu, setMenu] = useState<{ floorId: Id; anchor: HTMLElement | { x: number; y: number } } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [ceilingFor, setCeilingFor] = useState<Floor | null>(null);
  const [deleteFor, setDeleteFor] = useState<Floor | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = floors.find((f) => f.id === activeId) ?? floors[0];

  // Aktiven Tab in Sicht scrollen
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeId, floors.length]);

  const select = useCallback(
    (id: Id) => {
      if (id !== activeId) {
        setActiveFloor(id);
        clearSelection();
      }
    },
    [activeId, setActiveFloor, clearSelection],
  );

  const commitRename = (floor: Floor, name: string) => {
    const n = name.trim();
    if (n && n !== floor.name) renameFloor(floor.id, n);
    setRenamingId(null);
  };

  const menuFloor = menu ? floors.find((f) => f.id === menu.floorId) ?? null : null;
  const menuEntries = useMemo<MenuEntry[]>(() => {
    if (!menuFloor) return [];
    const idx = floors.findIndex((f) => f.id === menuFloor.id);
    const canDelete = floors.length > 1;
    return [
      { heading: `${menuFloor.name} · ${formatM(menuFloor.ceilingHeight)}` },
      { label: 'Umbenennen', icon: <Pencil size={15} />, onSelect: () => setRenamingId(menuFloor.id) },
      {
        label: 'Duplizieren',
        icon: <Copy size={15} />,
        onSelect: () => {
          const id = duplicateFloor(menuFloor.id);
          if (id) {
            clearSelection();
            toast(`Stockwerk „${menuFloor.name}“ dupliziert`, 'success');
          }
        },
      },
      { label: 'Deckenhöhe ändern …', icon: <MoveVertical size={15} />, onSelect: () => setCeilingFor(menuFloor) },
      { separator: true },
      { label: 'Nach links (tiefer)', icon: <ArrowLeft size={15} />, disabled: idx <= 0, onSelect: () => moveFloor(menuFloor.id, -1) },
      { label: 'Nach rechts (höher)', icon: <ArrowRight size={15} />, disabled: idx < 0 || idx >= floors.length - 1, onSelect: () => moveFloor(menuFloor.id, 1) },
      { separator: true },
      {
        label: 'Löschen …',
        icon: <Trash2 size={15} />,
        danger: true,
        disabled: !canDelete,
        title: canDelete ? undefined : 'Das letzte Stockwerk kann nicht gelöscht werden',
        onSelect: () => setDeleteFor(menuFloor),
      },
    ];
  }, [menuFloor, floors, duplicateFloor, moveFloor, clearSelection, toast]);

  const closeMenu = useCallback(() => setMenu(null), []);

  const confirmDelete = () => {
    if (!deleteFor) return;
    if (floors.length <= 1) {
      toast('Das letzte Stockwerk kann nicht gelöscht werden', 'warning');
      setDeleteFor(null);
      return;
    }
    deleteFloor(deleteFor.id);
    clearSelection();
    toast(`Stockwerk „${deleteFor.name}“ gelöscht`, 'info');
    setDeleteFor(null);
  };

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`} data-tutorial="floor-tabs">
      <div ref={scrollRef} role="tablist" aria-label="Stockwerke" className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {floors.map((f) => (
          <FloorTab
            key={f.id}
            floor={f}
            active={f.id === active?.id}
            onSelect={() => select(f.id)}
            onMenu={(anchor) => setMenu({ floorId: f.id, anchor })}
            renaming={renamingId === f.id}
            onRenameStart={() => setRenamingId(f.id)}
            onRenameCommit={(n) => commitRename(f, n)}
            onRenameCancel={() => setRenamingId(null)}
          />
        ))}
      </div>
      <IconButton title="Stockwerk hinzufügen" icon={<Plus size={18} />} onClick={() => setAddOpen(true)} data-tutorial="floor-add" />

      <Popover open={!!menu} anchor={menu?.anchor ?? null} onClose={closeMenu} placement="bottom-start" ariaLabel="Stockwerk-Menü">
        <MenuList entries={menuEntries} onClose={closeMenu} />
      </Popover>

      <AddFloorDialog open={addOpen} onClose={() => setAddOpen(false)} floors={floors} activeCeiling={active?.ceilingHeight ?? DEFAULT_CEILING_HEIGHT} />

      <PromptDialog
        open={!!ceilingFor}
        title={`Deckenhöhe – ${ceilingFor?.name ?? ''}`}
        label="Deckenhöhe in cm"
        initial={String(ceilingFor?.ceilingHeight ?? DEFAULT_CEILING_HEIGHT)}
        inputMode="decimal"
        hint={`Zwischen ${MIN_CEILING} und ${MAX_CEILING} cm. Geräte, die höher sind, erzeugen eine Warnung.`}
        validate={(v) => {
          const n = parseNumber(v);
          if (n == null) return 'Bitte eine Zahl eingeben.';
          if (n < MIN_CEILING || n > MAX_CEILING) return `Zulässig sind ${MIN_CEILING} bis ${MAX_CEILING} cm.`;
          return null;
        }}
        onSubmit={(v) => {
          const n = parseNumber(v);
          if (ceilingFor && n != null) setFloorCeilingHeight(ceilingFor.id, Math.round(n * 10) / 10);
          setCeilingFor(null);
        }}
        onCancel={() => setCeilingFor(null)}
      />

      <ConfirmDialog
        open={!!deleteFor}
        title="Stockwerk löschen"
        danger
        confirmLabel="Löschen"
        message={
          deleteFor ? (
            <>
              Stockwerk <strong>„{deleteFor.name}“</strong> mit {deleteFor.items.length} Objekten, {deleteFor.walls.length} Wänden und {deleteFor.zones.length} Zonen wirklich löschen?
              Verknüpfte Treppen/Aufzüge verlieren die Verbindung zu diesem Stockwerk. Die Aktion lässt sich rückgängig machen (Strg+Z).
            </>
          ) : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteFor(null)}
      />
    </div>
  );
}
