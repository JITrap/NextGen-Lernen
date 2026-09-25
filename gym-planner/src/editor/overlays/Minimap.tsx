import { useMemo, useRef } from 'react';
import type { Floor } from '@/types';
import type { Viewport } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';
import { floorBounds } from '../Canvas';
import { itemFootprint } from '@/geometry/transform';
import { flatten } from '@/geometry/polygon';

const W = 180;
const H = 120;

/** Minikarte unten rechts: Halle, Wände, Objekte und sichtbarer Ausschnitt; Klick/Drag verschiebt die Ansicht. */
export function Minimap({ floor, viewport, width, height }: { floor: Floor; viewport: Viewport; width: number; height: number }) {
  const setViewport = useUiStore((s) => s.setViewport);
  const b = useMemo(() => floorBounds(floor), [floor]);
  const pad = 100;
  const bw = b.maxX - b.minX + pad * 2;
  const bh = b.maxY - b.minY + pad * 2;
  const s = Math.min(W / bw, H / bh);
  const ox = (W - bw * s) / 2 - (b.minX - pad) * s;
  const oy = (H - bh * s) / 2 - (b.minY - pad) * s;
  const tx = (x: number) => x * s + ox;
  const ty = (y: number) => y * s + oy;
  const view = {
    x: tx(-viewport.x / viewport.scale),
    y: ty(-viewport.y / viewport.scale),
    w: (width / viewport.scale) * s,
    h: (height / viewport.scale) * s,
  };
  const dragging = useRef(false);
  const moveTo = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - ox) / s;
    const wy = (my - oy) / s;
    setViewport((v) => ({ ...v, x: width / 2 - wx * v.scale, y: height / 2 - wy * v.scale }));
  };
  return (
    <svg
      width={W}
      height={H}
      className="absolute bottom-3 right-3 rounded-md border shadow-sm"
      style={{ background: 'color-mix(in srgb, var(--gp-panel) 92%, transparent)', borderColor: 'var(--gp-border)', cursor: 'pointer' }}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); moveTo(e); }}
      onPointerMove={(e) => { if (dragging.current) moveTo(e); }}
      onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
    >
      {floor.hall && (
        <polygon points={floor.hall.polygon.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ')} fill="var(--gp-hall)" stroke="var(--gp-wall)" strokeWidth={1.5} />
      )}
      {floor.zones.map((z) => (
        <polygon key={z.id} points={z.polygon.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ')} fill={z.color ?? '#94a3b8'} fillOpacity={0.25} stroke="none" />
      ))}
      {floor.walls.map((w) => (
        <line key={w.id} x1={tx(w.start.x)} y1={ty(w.start.y)} x2={tx(w.end.x)} y2={ty(w.end.y)} stroke="var(--gp-wall)" strokeWidth={Math.max(1, w.thickness * s)} />
      ))}
      {floor.items.map((it) => {
        const pts = flatten(itemFootprint(it));
        const str: string[] = [];
        for (let i = 0; i < pts.length; i += 2) str.push(`${tx(pts[i])},${ty(pts[i + 1])}`);
        return <polygon key={it.id} points={str.join(' ')} fill="#3b82f6" fillOpacity={0.6} />;
      })}
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth={1} />
    </svg>
  );
}
