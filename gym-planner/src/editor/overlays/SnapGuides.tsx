import { Group, Line, Circle } from 'react-konva';
import { create } from 'zustand';
import type { SnapGuide, SnapResult } from '@/geometry/snap';
import type { Viewport } from '@/store/uiStore';
import type { Vec2 } from '@/types';

interface SnapGuideState {
  guides: SnapGuide[];
  point: Vec2 | null;
  kind: SnapResult['kind'];
  set: (r: SnapResult | null) => void;
}
/** Werkzeuge melden hier ihr aktuelles Snap-Ergebnis; der Canvas zeichnet Hilfslinien und Fangpunkt. */
export const useSnapGuides = create<SnapGuideState>()((set) => ({
  guides: [],
  point: null,
  kind: 'none',
  set: (r) => set(r ? { guides: r.guides, point: r.kind === 'none' || r.kind === 'grid' ? null : r.point, kind: r.kind } : { guides: [], point: null, kind: 'none' }),
}));

export function SnapGuides({ viewport }: { viewport: Viewport }) {
  const { guides, point } = useSnapGuides();
  const s = 1 / viewport.scale;
  return (
    <Group listening={false}>
      {guides.map((g, i) => (
        <Line key={i} points={[g.from.x, g.from.y, g.to.x, g.to.y]} stroke="#f43f5e" strokeWidth={1 * s} dash={[6 * s, 4 * s]} />
      ))}
      {point && <Circle x={point.x} y={point.y} radius={5 * s} stroke="#f43f5e" strokeWidth={1.5 * s} />}
    </Group>
  );
}
