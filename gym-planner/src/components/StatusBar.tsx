import { memo, useMemo } from 'react';
import { Magnet } from 'lucide-react';
import type { Floor, Selection } from '@/types';
import { useUiStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { useActiveFloor } from '@/store/selectors';
import { polygonAreaM2 } from '@/geometry/polygon';
import { formatM2, formatM, formatDims, formatCm, formatLength } from '@/geometry/units';
import { findWall, wallLength } from '@/geometry/walls';
import { floorRooms } from '@/geometry/rooms';
import { getDef } from '@/data/equipment';
import { getStage } from '@/editor/stageRegistry';
import { zoomAt } from '@/editor/viewport';
import { useIsTouch } from './ui/hooks';

/** 0,25 px/cm entspricht 100 % (Standard-Viewport). */
export const ZOOM_100_SCALE = 0.25;

const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Cursor-Position separat, damit nur dieser Teil bei jeder Mausbewegung neu rendert. */
const CursorReadout = memo(function CursorReadout() {
  const cursor = useUiStore((s) => s.cursorWorld);
  return (
    <span className="tabular-nums" title="Cursor-Position (Weltkoordinaten)">
      {cursor ? (
        <>
          X {nf2.format(cursor.x / 100)} m · Y {nf2.format(cursor.y / 100)} m
        </>
      ) : (
        <span className="gp-muted">X – · Y –</span>
      )}
    </span>
  );
});

const KIND_LABEL: Record<Selection['kind'], string> = {
  item: 'Objekt',
  wall: 'Wand',
  zone: 'Zone',
  room: 'Raum',
  opening: 'Öffnung',
  annotation: 'Anmerkung',
  void: 'Luftraum',
  hallVertex: 'Hallen-Eckpunkt',
  hallEdge: 'Hallenkante',
};

/** Beschreibung eines einzelnen ausgewählten Objekts (Name + Maße). */
export function describeSelection(sel: Selection, floor: Floor, customEquipment: Parameters<typeof getDef>[1]): string {
  switch (sel.kind) {
    case 'item': {
      const it = floor.items.find((i) => i.id === sel.id);
      if (!it) return KIND_LABEL.item;
      const def = getDef(it.defId, customEquipment);
      const name = it.label ?? def?.name ?? 'Objekt';
      return `${name} · ${formatDims(it.width, it.depth, it.height)}`;
    }
    case 'wall': {
      const w = findWall(floor, sel.id);
      if (!w) return KIND_LABEL.wall;
      return `${w.type} · ${formatLength(wallLength(w))} · ${formatCm(w.thickness)}`;
    }
    case 'zone':
    case 'room': {
      const r = floorRooms(floor).find((x) => x.id === sel.id);
      if (!r) return KIND_LABEL[sel.kind];
      return `${r.name} (${r.type}) · ${formatM2(r.areaM2)} · Umfang ${formatM(r.perimeterCm)}`;
    }
    case 'opening': {
      const o = floor.openings.find((x) => x.id === sel.id);
      if (!o) return KIND_LABEL.opening;
      const label = o.kind === 'door' ? `Tür (${o.doorType})` : o.kind === 'window' ? 'Fenster' : 'Spiegel';
      return `${label} · Breite ${formatCm(o.width)}`;
    }
    case 'annotation': {
      const a = floor.annotations.find((x) => x.id === sel.id);
      if (!a) return KIND_LABEL.annotation;
      return a.kind === 'text' ? `Text „${a.text.slice(0, 30)}${a.text.length > 30 ? '…' : ''}“` : `Messlinie · ${formatLength(Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y))}`;
    }
    case 'void': {
      const v = floor.voids.find((x) => x.id === sel.id);
      return v ? `Luftraum${v.name ? ` „${v.name}“` : ''} · ${formatM2(polygonAreaM2(v.polygon))}` : KIND_LABEL.void;
    }
    case 'hallVertex':
      return `Hallen-Eckpunkt ${Number(sel.id) + 1}`;
    case 'hallEdge': {
      const poly = floor.hall?.polygon;
      if (!poly) return KIND_LABEL.hallEdge;
      const i = Number(sel.id);
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      return a && b ? `Hallenkante ${i + 1} · ${formatLength(Math.hypot(b.x - a.x, b.y - a.y))}` : KIND_LABEL.hallEdge;
    }
    default:
      return 'Auswahl';
  }
}

const SelectionReadout = memo(function SelectionReadout() {
  const selection = useUiStore((s) => s.selection);
  const floor = useActiveFloor();
  const customEquipment = useProjectStore((s) => s.project.customEquipment);
  const text = useMemo(() => {
    if (!selection.length) return '';
    if (selection.length === 1) return describeSelection(selection[0], floor, { customEquipment });
    const items = selection.filter((s) => s.kind === 'item').length;
    return items === selection.length ? `${selection.length} Objekte gewählt` : `${selection.length} Elemente gewählt`;
  }, [selection, floor, customEquipment]);
  if (!text) return <span className="gp-muted">Nichts ausgewählt</span>;
  return (
    <span className="truncate" title={text}>
      {text}
    </span>
  );
});

/** Statusleiste: Cursor, Werkzeughinweis, Snapping · Auswahl · Hallenfläche, Stockwerk, Zoom. */
export function StatusBar() {
  const hint = useUiStore((s) => s.statusHint);
  const snapOverride = useUiStore((s) => s.snapOverride);
  const snapEnabled = useProjectStore((s) => s.project.settings.snapEnabled);
  const scale = useUiStore((s) => s.viewport.scale);
  const setViewport = useUiStore((s) => s.setViewport);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const floor = useActiveFloor();
  const floorCount = useProjectStore((s) => s.project.floors.length);
  const touch = useIsTouch();

  const hallArea = useMemo(() => (floor.hall ? polygonAreaM2(floor.hall.polygon) : null), [floor.hall]);
  const zoomPct = Math.round((scale / ZOOM_100_SCALE) * 100);
  const snapOff = !snapEnabled || snapOverride;

  const resetZoom = () => {
    const stage = getStage();
    const w = stage?.width() ?? window.innerWidth;
    const h = stage?.height() ?? window.innerHeight;
    setViewport((v) => zoomAt(v, { x: w / 2, y: h / 2 }, ZOOM_100_SCALE / v.scale));
  };

  return (
    <footer
      className={`flex ${touch ? 'h-9' : 'h-7'} shrink-0 items-center gap-3 overflow-hidden border-t px-3 text-xs gp-panel`}
      role="contentinfo"
      aria-label="Statusleiste"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <CursorReadout />
        {hint && (
          <span className="hidden max-w-[40vw] truncate gp-muted md:inline" title={hint}>
            {hint}
          </span>
        )}
        <button
          type="button"
          className={`inline-flex h-full items-center gap-1 rounded px-1 ${snapOff ? 'gp-warn' : 'gp-muted'} hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]`}
          title={snapOverride ? 'Snapping vorübergehend aus (Alt gedrückt)' : snapEnabled ? 'Snapping an – klicken zum Ausschalten' : 'Snapping aus – klicken zum Einschalten'}
          onClick={() => updateSettings({ snapEnabled: !snapEnabled })}
        >
          <Magnet size={12} className={snapOff ? 'opacity-60' : ''} />
          <span>{snapOverride ? 'Snapping aus (Alt)' : snapEnabled ? 'Snapping an' : 'Snapping aus'}</span>
        </button>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <SelectionReadout />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span title="Hallenfläche (Außenmaß) des aktiven Stockwerks" className="tabular-nums">
          {hallArea != null ? (
            <>
              Halle <strong className="font-semibold">{formatM2(hallArea)}</strong>
            </>
          ) : (
            <span className="gp-muted">Keine Halle</span>
          )}
        </span>
        <span className="hidden sm:inline" title={`Aktives Stockwerk (${floorCount} gesamt)`}>
          {floor.name}
        </span>
        <button
          type="button"
          className="inline-flex h-full min-w-[52px] items-center justify-center rounded px-1 tabular-nums hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]"
          title="Zoom – klicken setzt auf 100 % zurück"
          onClick={resetZoom}
        >
          {zoomPct} %
        </button>
      </div>
    </footer>
  );
}
