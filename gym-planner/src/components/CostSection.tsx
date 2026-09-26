/** Abschnitt „Kosten“ im Übersichts-Panel (Gerüst). */
import type { Project, Id } from '@/types';
import { costs } from '@/analysis';
import { formatEur } from '@/geometry/units';

export function CostSection({ project }: { project: Project; scope: 'active' | 'all'; activeFloorId: Id | null }) {
  const c = costs(project);
  return <p className="text-[11px] gp-muted">Einmalkosten {formatEur(c.einmalSummeEur)} · laufend {formatEur(c.monatlichSummeEur)}/Monat.</p>;
}
