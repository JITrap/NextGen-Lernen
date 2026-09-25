import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy, ClipboardPaste, Trash2, RotateCw, RotateCcw, FlipHorizontal2, FlipVertical2, Lock, LockOpen, Eye, EyeOff, Group, Ungroup,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Library, SlidersHorizontal, Scissors, Pencil, LayoutDashboard,
  SquareDashedMousePointer, Maximize2, Square, Pentagon, DoorOpen, Grid3x3, Magnet, ArrowLeftRight, MoveVertical, Files,
} from 'lucide-react';
import type { Floor, Selection, Vec2, RoomType } from '@/types';
import { useUiStore } from '@/store/uiStore';
import { useProjectStore, transaction, getActiveFloor } from '@/store/projectStore';
import { useActiveFloor, floorVisibleItems } from '@/store/selectors';
import { hitTest } from '@/editor/hitTest';
import * as actions from '@/editor/actions';
import { allWalls, findWall, isHallWallId, splitWall, reassignOpeningsAfterSplit } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { ROOM_TYPES } from '@/data/roomTypes';
import { getDef } from '@/data/equipment';
import { formatM2 } from '@/geometry/units';
import { Popover, MenuList, type MenuEntry } from './ui/Menu';
import { PromptDialog, ConfirmDialog } from './ui/Modal';

/** Liest einen optionalen Export per Namen (zur Compile-Zeit nicht garantiert; kein statischer Member-Zugriff → keine Bundler-Warnung). */
function optionalExport<T>(mod: object, name: string): T | undefined {
  const entry = Object.entries(mod).find(([k]) => k === name);
  return entry ? (entry[1] as T) : undefined;
}
const externalSplitWall = optionalExport<(id: string, p: Vec2) => void>(actions, 'splitWallAtPoint');

/** Teilt eine (echte) Wand am Punkt p; Öffnungen wandern auf die passende Hälfte. Ein Undo-Schritt. */
export function splitWallHere(floor: Floor, wallId: string, p: Vec2): boolean {
  if (isHallWallId(wallId)) return false;
  if (typeof externalSplitWall === 'function') {
    externalSplitWall(wallId, p);
    return true;
  }
  const w = floor.walls.find((x) => x.id === wallId);
  if (!w) return false;
  const parts = splitWall(w, p);
  if (!parts) return false;
  const reassigned = reassignOpeningsAfterSplit(floor.openings, w, parts);
  transaction(() => {
    const s = useProjectStore.getState();
    reassigned.forEach((o, i) => {
      if (o !== floor.openings[i]) s.updateOpening(floor.id, o.id, { wallId: o.wallId, offset: o.offset });
    });
    s.replaceWalls(floor.id, [w.id], parts);
  });
  return true;
}

const ALIGN_ENTRIES: { mode: actions.AlignMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'left', label: 'Links', icon: <AlignStartVertical size={15} /> },
  { mode: 'centerX', label: 'Horizontal zentrieren', icon: <AlignCenterVertical size={15} /> },
  { mode: 'right', label: 'Rechts', icon: <AlignEndVertical size={15} /> },
  { mode: 'top', label: 'Oben', icon: <AlignStartHorizontal size={15} /> },
  { mode: 'centerY', label: 'Vertikal zentrieren', icon: <AlignCenterHorizontal size={15} /> },
  { mode: 'bottom', label: 'Unten', icon: <AlignEndHorizontal size={15} /> },
  { mode: 'distributeX', label: 'Horizontal verteilen', icon: <AlignHorizontalDistributeCenter size={15} /> },
  { mode: 'distributeY', label: 'Vertikal verteilen', icon: <AlignVerticalDistributeCenter size={15} /> },
];

function sameSel(a: Selection, b: Selection) {
  return a.kind === b.kind && a.id === b.id;
}

/**
 * Rechtsklick-Kontextmenü (ui.contextMenu). Ziel wird per hitTest ermittelt und – falls nicht Teil der Auswahl –
 * ausgewählt. Einträge je Zieltyp; schließt bei Klick außerhalb, Esc, Scrollen. Bleibt im Viewport.
 */
export function ContextMenu() {
  const menu = useUiStore((s) => s.contextMenu);
  const setContextMenu = useUiStore((s) => s.setContextMenu);
  const selection = useUiStore((s) => s.selection);
  const floor = useActiveFloor();
  const floors = useProjectStore((s) => s.project.floors);
  const layers = useProjectStore((s) => s.project.layers);
  const settings = useProjectStore((s) => s.project.settings);
  const customEquipment = useProjectStore((s) => s.project.customEquipment);
  const [rename, setRename] = useState<{ kind: 'zone' | 'room'; id: string; name: string } | null>(null);
  const [confirmHall, setConfirmHall] = useState(false);

  const close = useCallback(() => setContextMenu(null), [setContextMenu]);

  // Ziel bestimmen (nur wenn Menü offen; Räume/Wände werden hier bewusst nur bei Bedarf berechnet)
  const target = useMemo<Selection | null>(() => {
    if (!menu) return null;
    if (menu.target) return menu.target;
    if (!menu.world) return null;
    const scale = useUiStore.getState().viewport.scale;
    return hitTest(menu.world, {
      floor,
      walls: allWalls(floor),
      rooms: floorRooms(floor),
      items: floorVisibleItems(floor, floors),
      tolerance: 6 / scale,
      layers,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  // Ziel in die Auswahl übernehmen, wenn es nicht enthalten ist
  useEffect(() => {
    if (!menu || !target) return;
    const sel = useUiStore.getState().selection;
    if (!sel.some((s) => sameSel(s, target))) useUiStore.getState().setSelection([target]);
  }, [menu, target]);

  const entries = useMemo<MenuEntry[]>(() => {
    if (!menu) return [];
    const ui = useUiStore.getState();
    const store = useProjectStore.getState();
    const fid = floor.id;
    const world = menu.world;
    const clipboardEmpty = !ui.clipboard?.length;
    const paste: MenuEntry = { label: 'Einfügen', icon: <ClipboardPaste size={15} />, kbd: 'Strg+V', disabled: clipboardEmpty, onSelect: () => actions.pasteClipboard() };
    const del = (label = 'Löschen'): MenuEntry => ({ label, icon: <Trash2 size={15} />, kbd: 'Entf', danger: true, onSelect: () => actions.deleteSelection() });
    const props: MenuEntry = { label: 'Eigenschaften', icon: <SlidersHorizontal size={15} />, onSelect: () => ui.setRightPanel('properties') };
    // Ausgeblendete Elemente des Stockwerks wieder einblenden (nur anbieten, wenn es welche gibt)
    const hiddenN = actions.hiddenCount(floor);
    const showHidden: MenuEntry[] = hiddenN
      ? [{
          label: `Ausgeblendete Objekte einblenden (${hiddenN})`,
          icon: <Eye size={15} />,
          onSelect: () => {
            const n = actions.showAllHidden(fid);
            if (n) ui.toast(n === 1 ? '1 Element eingeblendet' : `${n} Elemente eingeblendet`, 'success');
          },
        }]
      : [];

    if (!target) {
      // Leerfläche
      const list: MenuEntry[] = [paste, { label: 'Alles auswählen', icon: <SquareDashedMousePointer size={15} />, kbd: 'Strg+A', onSelect: () => actions.selectAll() }, ...showHidden, { label: 'Alles einpassen', icon: <Maximize2 size={15} />, kbd: 'G', onSelect: () => ui.requestFit() }, { separator: true }];
      if (!floor.hall) {
        list.push(
          { label: 'Halle anlegen (Rechteck)', icon: <Square size={15} />, kbd: 'H', onSelect: () => ui.setTool('hall-rect') },
          { label: 'Halle anlegen (Polygon)', icon: <Pentagon size={15} />, onSelect: () => ui.setTool('hall-polygon') },
        );
      } else {
        list.push({ label: 'Zone zeichnen', icon: <LayoutDashboard size={15} />, kbd: 'Z', onSelect: () => ui.setTool('zone-rect') });
      }
      list.push(
        { separator: true },
        { label: 'Raster anzeigen', icon: <Grid3x3 size={15} />, checked: settings.showGrid, onSelect: () => store.updateSettings({ showGrid: !settings.showGrid }) },
        { label: 'Snapping', icon: <Magnet size={15} />, checked: settings.snapEnabled, onSelect: () => store.updateSettings({ snapEnabled: !settings.snapEnabled }) },
      );
      return list;
    }

    // Auswahl (Ziel ist enthalten oder wird gerade gesetzt)
    const sel = selection.some((s) => sameSel(s, target)) ? selection : [target];
    const itemSel = sel.filter((s) => s.kind === 'item');
    const multi = sel.length > 1;

    switch (target.kind) {
      case 'item': {
        const items = itemSel.map((s) => floor.items.find((i) => i.id === s.id)).filter((x): x is Floor['items'][number] => !!x);
        const it = floor.items.find((i) => i.id === target.id);
        const def = it ? getDef(it.defId, { customEquipment }) : undefined;
        const heading = multi ? `${sel.length} Objekte` : it?.label ?? def?.name ?? 'Objekt';
        const allLocked = items.length > 0 && items.every((i) => i.locked);
        const groupIds = new Set(items.map((i) => i.groupId).filter(Boolean));
        const inOneGroup = items.length >= 2 && groupIds.size === 1 && items.every((i) => i.groupId);
        const list: MenuEntry[] = [
          { heading },
          { label: 'Duplizieren', icon: <Files size={15} />, kbd: 'Strg+D', onSelect: () => actions.duplicateSelection() },
          { label: 'Kopieren', icon: <Copy size={15} />, kbd: 'Strg+C', onSelect: () => actions.copySelection() },
          paste,
          { separator: true },
          { label: 'Drehen 90°', icon: <RotateCw size={15} />, kbd: 'R', onSelect: () => actions.rotateSelection(90) },
          { label: 'Drehen −90°', icon: <RotateCcw size={15} />, kbd: 'Shift+R', onSelect: () => actions.rotateSelection(-90) },
          {
            label: 'Spiegeln',
            icon: <FlipHorizontal2 size={15} />,
            children: [
              { label: 'Horizontal (links ↔ rechts)', icon: <FlipHorizontal2 size={15} />, onSelect: () => actions.flipSelection('x') },
              { label: 'Vertikal (vorne ↔ hinten)', icon: <FlipVertical2 size={15} />, onSelect: () => actions.flipSelection('y') },
            ],
          },
          { separator: true },
          { label: allLocked ? 'Entsperren' : 'Sperren', icon: allLocked ? <LockOpen size={15} /> : <Lock size={15} />, kbd: 'Strg+L', onSelect: () => actions.toggleLockSelection() },
          { label: 'Ausblenden', icon: <EyeOff size={15} />, onSelect: () => actions.toggleHideSelection() },
        ];
        if (multi || inOneGroup) {
          list.push(
            inOneGroup
              ? { label: 'Gruppe auflösen', icon: <Ungroup size={15} />, kbd: 'Strg+Shift+G', onSelect: () => actions.ungroupSelection() }
              : { label: 'Gruppieren', icon: <Group size={15} />, kbd: 'Strg+G', disabled: itemSel.length < 2, onSelect: () => actions.groupSelection() },
          );
        }
        list.push({
          label: 'Ausrichten',
          icon: <AlignStartVertical size={15} />,
          disabled: itemSel.length < 2,
          title: itemSel.length < 2 ? 'Mindestens zwei Objekte auswählen' : undefined,
          children: ALIGN_ENTRIES.map((a) => ({ label: a.label, icon: a.icon, disabled: a.mode.startsWith('distribute') && itemSel.length < 3, onSelect: () => actions.alignSelection(a.mode) })),
        });
        list.push({ separator: true });
        if (def && !multi) {
          list.push({
            label: 'In Bibliothek zeigen',
            icon: <Library size={15} />,
            onSelect: () => {
              ui.setToolOption('libraryFocusDefId', def.id);
              ui.setRightPanel('library');
            },
          });
        }
        list.push(props, del(multi ? `${sel.length} Objekte löschen` : 'Löschen'));
        return list;
      }
      case 'wall': {
        const w = findWall(floor, target.id);
        const isHall = isHallWallId(target.id);
        const list: MenuEntry[] = [{ heading: w ? `${isHall ? 'Außenwand' : w.type} · ${String(w.thickness).replace('.', ',')} cm` : 'Wand' }];
        if (!isHall && w) {
          list.push(
            {
              label: 'Teilen hier',
              icon: <Scissors size={15} />,
              disabled: !world,
              onSelect: () => {
                if (world && !splitWallHere(getActiveFloor(), target.id, world)) ui.toast('Wand kann an dieser Stelle nicht geteilt werden', 'warning');
              },
            },
            { label: w.locked ? 'Entsperren' : 'Sperren', icon: w.locked ? <LockOpen size={15} /> : <Lock size={15} />, onSelect: () => transaction(() => store.updateWall(fid, w.id, { locked: !w.locked })) },
            { label: 'Ausblenden', icon: <EyeOff size={15} />, onSelect: () => transaction(() => store.updateWall(fid, w.id, { hidden: true })) },
            { separator: true },
            props,
            del(multi ? `${sel.length} Elemente löschen` : 'Wand löschen'),
          );
        } else {
          list.push({ label: 'Tür einsetzen', icon: <DoorOpen size={15} />, kbd: 'D', onSelect: () => ui.setTool('door') }, { separator: true }, props, {
            label: 'Halle entfernen …',
            icon: <Trash2 size={15} />,
            danger: true,
            onSelect: () => setConfirmHall(true),
          });
        }
        return list;
      }
      case 'zone':
      case 'room': {
        const isZone = target.kind === 'zone';
        const zone = isZone ? floor.zones.find((z) => z.id === target.id) : undefined;
        const room = !isZone ? floorRooms(floor).find((r) => r.id === target.id) : undefined;
        const name = zone?.name ?? room?.name ?? (isZone ? 'Zone' : 'Raum');
        const type = zone?.type ?? room?.type ?? 'Sonstiges';
        const area = room ? formatM2(room.areaM2) : undefined;
        const setType = (t: RoomType) =>
          transaction(() => {
            if (zone) store.updateZone(fid, zone.id, { type: t });
            else if (room?.loopKey) store.setRoomMeta(fid, room.loopKey, { type: t });
          });
        const list: MenuEntry[] = [
          { heading: area ? `${name} · ${area}` : name },
          { label: 'Umbenennen …', icon: <Pencil size={15} />, onSelect: () => setRename({ kind: target.kind as 'zone' | 'room', id: target.id, name }) },
          {
            label: `Typ: ${type}`,
            icon: <LayoutDashboard size={15} />,
            children: ROOM_TYPES.map((r) => ({
              label: r.type,
              checked: r.type === type,
              icon: <span className="inline-block h-3 w-3 rounded-sm" style={{ background: r.color }} />,
              onSelect: () => setType(r.type),
            })),
          },
          { separator: true },
        ];
        if (zone) {
          list.push(
            { label: zone.locked ? 'Entsperren' : 'Sperren', icon: zone.locked ? <LockOpen size={15} /> : <Lock size={15} />, onSelect: () => transaction(() => store.updateZone(fid, zone.id, { locked: !zone.locked })) },
            { label: 'Ausblenden', icon: <EyeOff size={15} />, onSelect: () => transaction(() => store.updateZone(fid, zone.id, { hidden: true })) },
          );
        }
        if (!zone) list.push(...showHidden);
        list.push(props);
        if (zone) list.push(del('Zone löschen'));
        else list.push({ label: 'Raum entsteht aus Wänden – zum Entfernen Wände löschen', disabled: true });
        return list;
      }
      case 'opening': {
        const o = floor.openings.find((x) => x.id === target.id);
        if (!o) return [props, del()];
        const label = o.kind === 'door' ? `Tür (${o.doorType})` : o.kind === 'window' ? 'Fenster' : 'Spiegel';
        const list: MenuEntry[] = [{ heading: `${label} · ${o.width} cm` }];
        if (o.kind === 'door') {
          list.push(
            { label: 'Anschlag umkehren (links/rechts)', icon: <ArrowLeftRight size={15} />, onSelect: () => transaction(() => store.updateOpening(fid, o.id, { hinge: o.hinge === 'left' ? 'right' : 'left' })) },
            { label: 'Aufschlagseite wechseln', icon: <MoveVertical size={15} />, onSelect: () => transaction(() => store.updateOpening(fid, o.id, { swingSide: o.swingSide === 'a' ? 'b' : 'a' })) },
          );
        } else if (o.kind === 'mirror') {
          list.push({ label: 'Wandseite wechseln', icon: <MoveVertical size={15} />, onSelect: () => transaction(() => store.updateOpening(fid, o.id, { side: o.side === 'a' ? 'b' : 'a' })) });
        }
        list.push(
          { label: o.locked ? 'Entsperren' : 'Sperren', icon: o.locked ? <LockOpen size={15} /> : <Lock size={15} />, onSelect: () => transaction(() => store.updateOpening(fid, o.id, { locked: !o.locked })) },
          { separator: true },
          props,
          del(`${label} löschen`),
        );
        return list;
      }
      case 'annotation':
        return [{ heading: 'Anmerkung' }, { label: 'Duplizieren', icon: <Files size={15} />, kbd: 'Strg+D', onSelect: () => actions.duplicateSelection() }, { separator: true }, props, del()];
      case 'void': {
        const v = floor.voids.find((x) => x.id === target.id);
        return [{ heading: v?.name ? `Luftraum „${v.name}“` : 'Luftraum' }, props, del('Luftraum löschen')];
      }
      case 'hallVertex':
      case 'hallEdge':
        return [
          { heading: target.kind === 'hallVertex' ? 'Hallen-Eckpunkt' : 'Hallenkante' },
          { label: 'Tür einsetzen', icon: <DoorOpen size={15} />, kbd: 'D', onSelect: () => ui.setTool('door') },
          { separator: true },
          props,
          { label: 'Halle entfernen …', icon: <Trash2 size={15} />, danger: true, onSelect: () => setConfirmHall(true) },
        ];
      default:
        return [props, del()];
    }
  }, [menu, target, selection, floor, customEquipment, settings.showGrid, settings.snapEnabled]);

  const anchor = useMemo(() => (menu ? { x: menu.x, y: menu.y } : null), [menu]);

  return (
    <>
      <Popover open={!!menu} anchor={anchor} onClose={close} closeOnScroll ariaLabel="Kontextmenü">
        <MenuList entries={entries} onClose={close} minWidth={220} />
      </Popover>
      <PromptDialog
        open={!!rename}
        title={rename?.kind === 'zone' ? 'Zone umbenennen' : 'Raum umbenennen'}
        label="Name"
        initial={rename?.name ?? ''}
        validate={(v) => (v.trim() ? null : 'Bitte einen Namen eingeben.')}
        onSubmit={(v) => {
          if (rename) {
            const f = getActiveFloor();
            const s = useProjectStore.getState();
            transaction(() => {
              if (rename.kind === 'zone') s.updateZone(f.id, rename.id, { name: v.trim() });
              else {
                const room = floorRooms(f).find((r) => r.id === rename.id);
                if (room?.loopKey) s.setRoomMeta(f.id, room.loopKey, { name: v.trim() });
              }
            });
          }
          setRename(null);
        }}
        onCancel={() => setRename(null)}
      />
      <ConfirmDialog
        open={confirmHall}
        title="Halle entfernen"
        danger
        confirmLabel="Halle entfernen"
        message="Die Hallenkontur dieses Stockwerks wird entfernt. Türen und Fenster an den Außenwänden gehen verloren; Wände, Zonen und Geräte bleiben erhalten. Rückgängig mit Strg+Z."
        onConfirm={() => {
          const f = getActiveFloor();
          const s = useProjectStore.getState();
          transaction(() => {
            const outer = f.openings.filter((o) => isHallWallId(o.wallId)).map((o) => o.id);
            if (outer.length) s.deleteOpenings(f.id, outer);
            s.setHall(f.id, null);
          });
          useUiStore.getState().clearSelection();
          setConfirmHall(false);
        }}
        onCancel={() => setConfirmHall(false)}
      />
    </>
  );
}
