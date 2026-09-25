import { memo, useMemo, useRef } from 'react';
import type { Floor } from '@/types';
import type { Viewport } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';
import { floorBounds } from '../Canvas';
import { itemFootprint } from '@/geometry/transform';
import { flatten } from '@/geometry/polygon';

const W = 180;
const H = 120;

interface MapTransform {
  s: number;
  ox: number;
  oy: number;
}

/** Statischer Inhalt (Halle, Zonen, Wände, Objekte) – wird nur bei Änderung des Stockwerks neu aufgebaut. */
const MinimapContent = memo(function MinimapContent({ floor, t }: { floor: Floor; t: MapTransform }) {
  const tx = (x: number) => x * t.s + t.ox;
  const ty = (y: number) => y * t.s + t.oy;
  return (
    <>
      {floor.hall && (
        <polygon points={floor.hall.polygon.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ')} fill="var(--gp-hall)" stroke="var(--gp-wall)" strokeWidth={1.5} />
      )}
      {floor.zones.map((z) => (
        <polygon key={z.id} points={z.polygon.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ')} fill={z.color ?? '#94a3b8'} fillOpacity={0.25} stroke="none" />
      ))}
      {floor.walls.map((w) => (
        <line key={w.id} x1={tx(w.start.x)} y1={ty(w.start.y)} x2={tx(w.end.x)} y2={ty(w.end.y)} stroke="var(--gp-wall)" strokeWidth={Math.max(1, w.thickness * t.s)} />
      ))}
      {floor.items.map((it) => {
        const pts = flatten(itemFootprint(it));
        const str: string[] = [];
        for (let i = 0; i < pts.length; i += 2) str.push(`${tx(pts[i])},${ty(pts[i + 1])}`);
        return <polygon key={it.id} points={str.join(' ')} fill="#3b82f6" fillOpacity={0.6} />;
      })}
    </>
  );
});

/** Minikarte unten rechts: Halle, Wände, Objekte und sichtbarer Ausschnitt; Klick/Drag verschiebt die Ansicht. */
export const Minimap = memo(function Minimap({ floor, viewport, width, height }: { floor: Floor; viewport: Viewport; width: number; height: number }) {
  const setViewport = useUiStore((s) => s.setViewport);
  // Abbildung Welt → Karte hängt nur vom Stockwerk ab (nicht vom Viewport).
  const t = useMemo<MapTransform>(() => {
    const b = floorBounds(floor);
    const pad = 100;
    const bw = b.maxX - b.minX + pad * 2;
    const bh = b.maxY - b.minY + pad * 2;
    const s = Math.min(W / bw, H / bh);
    return { s, ox: (W - bw * s) / 2 - (b.minX - pad) * s, oy: (H - bh * s) / 2 - (b.minY - pad) * s };
  }, [floor]);
  const view = {
    x: (-viewport.x / viewport.scale) * t.s + t.ox,
    y: (-viewport.y / viewport.scale) * t.s + t.oy,
    w: (width / viewport.scale) * t.s,
    h: (height / viewport.scale) * t.s,
  };
  const dragging = useRef(false);
  const moveTo = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - t.ox) / t.s;
    const wy = (my - t.oy) / t.s;
    setViewport((v) => ({ ...v, x: width / 2 - wx * v.scale, y: height / 2 - wy * v.scale }));
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* Capture war nicht (mehr) aktiv */
    }
  };
  return (
    <svg
      width={W}
      height={H}
      role="img"
      aria-label="Minikarte: Übersicht des Stockwerks mit sichtbarem Ausschnitt"
      className="absolute bottom-3 right-3 rounded-md border shadow-sm"
      style={{ background: 'color-mix(in srgb, var(--gp-panel) 92%, transparent)', borderColor: 'var(--gp-border)', cursor: 'pointer' }}
      onPointerDown={(e) => {
        dragging.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* z. B. synthetische Ereignisse ohne aktiven Pointer */
        }
        moveTo(e);
      }}
      onPointerMove={(e) => { if (dragging.current) moveTo(e); }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <MinimapContent floor={floor} t={t} />
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth={1} />
    </svg>
  );
});
