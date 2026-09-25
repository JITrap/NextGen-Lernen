import type { Viewport } from '@/store/uiStore';
import { niceStep } from '../viewport';
import { formatLength } from '@/geometry/units';

/** Maßstabsbalken unten links (immer sichtbar). */
export function ScaleBar({ viewport }: { viewport: Viewport }) {
  const step = niceStep(viewport.scale, 120);
  const px = step * viewport.scale;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-start gap-0.5 text-[11px]" style={{ color: 'var(--gp-text)' }}>
      <div className="flex items-end">
        <div className="h-2 border-b-2 border-l-2 border-r-2" style={{ width: px, borderColor: 'var(--gp-text)' }} />
      </div>
      <div className="rounded px-1" style={{ background: 'color-mix(in srgb, var(--gp-panel) 80%, transparent)' }}>
        {formatLength(step)} · Zoom {Math.round(viewport.scale * 100) / 100} px/cm
      </div>
    </div>
  );
}
