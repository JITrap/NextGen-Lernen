/** Abschnitt „Regularien & Brandschutz“ im Übersichts-Panel (Gerüst). */
import type { Project, Id } from '@/types';
import { regulations } from '@/analysis';

export function RegulationsSection({ project }: { project: Project; scope: 'active' | 'all'; activeFloorId: Id | null }) {
  const r = regulations(project);
  return <p className="text-[11px] gp-muted">Regularien-Prüfung: {r.checks.length} Prüfungen.</p>;
}
