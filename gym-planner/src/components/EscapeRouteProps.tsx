/** Eigenschaften eines Fluchtwegs (Gerüst – wird mit dem Fluchtweg-Werkzeug ausgebaut). */
import type { EscapeRoute, Floor } from '@/types';

export function EscapeRouteProps({ ann }: { ann: EscapeRoute; floor: Floor }) {
  return <div className="px-3 py-2 text-sm">Fluchtweg · {ann.points.length} Punkte</div>;
}
