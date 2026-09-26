/**
 * Eigenschaften eines Fluchtwegs: Name, Punktliste mit editierbaren Koordinaten (Punkt einfügen/entfernen, mind. 2),
 * Lauflänge, Luftlinie Start→Ende, Ergebnis der Regularien-Prüfung für diesen Fluchtweg sowie Sperren/Ausblenden/Löschen.
 * Alle Änderungen laufen über den Store als je ein Undo-Schritt (transaction).
 */
import { useMemo } from 'react';
import { Route, Lock, Plus, X, ListOrdered, ShieldCheck, Crosshair } from 'lucide-react';
import type { EscapeRoute, Floor, Vec2 } from '@/types';
import { useProjectStore, transaction } from '@/store/projectStore';
import { distance } from '@/geometry/polygon';
import { polylineLength, removePolylinePoint } from '@/geometry/escapeRoutes';
import { formatLength, formatNumber } from '@/geometry/units';
import { regulations, REGULATION_STATUS_LABELS, type RegulationCheck } from '@/analysis/regulations';
import { Button } from './ui/Button';
import { LengthField, TextField, Section, KeyValue } from './fields';
import { PanelHeader, Pill, LockHideDelete } from './PropertiesPanel';
import { StatusIcon } from './RegulationsSection';
import { focusTarget } from './focusTarget';

function routeIndex(floor: Floor, id: string): number {
  return floor.annotations.filter((a) => a.kind === 'escape-route').findIndex((a) => a.id === id);
}

export function EscapeRouteProps({ ann, floor }: { ann: EscapeRoute; floor: Floor }) {
  const project = useProjectStore((s) => s.project);
  const locked = !!ann.locked;
  const name = ann.label?.trim() || `Fluchtweg ${routeIndex(floor, ann.id) + 1}`;
  const patch = (p: Partial<EscapeRoute>) => transaction(() => useProjectStore.getState().updateAnnotation(floor.id, ann.id, p));
  const setPoint = (i: number, q: Partial<Vec2>) => patch({ points: ann.points.map((p, k) => (k === i ? { ...p, ...q } : p)) });
  const removePoint = (i: number) => {
    const next = removePolylinePoint(ann.points, i, 2);
    if (next !== ann.points) patch({ points: next });
  };
  const addPoint = () => {
    const n = ann.points.length;
    const last = ann.points[n - 1];
    const prev = ann.points[n - 2] ?? last;
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    // 100 cm in Laufrichtung anhängen
    patch({ points: [...ann.points, { x: Math.round(last.x + (dx / len) * 100), y: Math.round(last.y + (dy / len) * 100) }] });
  };
  const walk = polylineLength(ann.points);
  const air = ann.points.length >= 2 ? distance(ann.points[0], ann.points[ann.points.length - 1]) : 0;
  const report = useMemo(() => regulations(project), [project]);
  const checks: RegulationCheck[] = useMemo(() => report.checks.filter((c) => c.id.startsWith(`route:${ann.id}:`)), [report, ann.id]);
  const status = report.routes[ann.id] ?? 'na';
  const statusTone = status === 'fail' ? 'danger' : status === 'warn' ? 'warn' : status === 'ok' ? 'ok' : 'muted';
  return (
    <div className="flex flex-col">
      <PanelHeader
        icon={<Route size={16} />}
        title={name}
        subtitle={`${formatLength(walk)} Lauflänge · ${ann.points.length} Punkte`}
        color={status === 'fail' ? 'var(--gp-danger)' : 'var(--gp-ok)'}
        badges={
          <>
            <Pill tone={statusTone}>{REGULATION_STATUS_LABELS[status]}</Pill>
            {locked && <Pill tone="warn"><Lock size={10} /> gesperrt</Pill>}
          </>
        }
      />
      <Section title="Fluchtweg" icon={<Route size={15} />} storageKey="props.escape-route">
        <TextField label="Name" value={ann.label ?? ''} placeholder={name} onChange={(v) => patch({ label: v.trim() ? v : undefined })} disabled={locked} />
        <div className="divide-y gp-border">
          <KeyValue label="Lauflänge" value={formatLength(walk)} mono />
          <KeyValue label="Luftlinie Start → Ende" value={formatLength(air)} mono />
          <KeyValue label="Verhältnis Lauf/Luftlinie" value={air > 0 ? formatNumber(walk / air, 2) : '–'} mono />
        </div>
      </Section>
      <Section title="Prüfung" icon={<ShieldCheck size={15} />} storageKey="props.escape-route.checks" badge={<Pill tone={statusTone}>{REGULATION_STATUS_LABELS[status]}</Pill>}>
        {checks.length === 0 ? (
          <p className="text-[11px] gp-muted">Keine Prüfung (Fluchtweg ausgeblendet oder zu kurz).</p>
        ) : (
          <ul className="space-y-1">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs gp-border">
                <StatusIcon status={c.status} />
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{c.titel.replace(`${name}: `, '')}</span>
                  <span className="block text-[11px] leading-snug gp-muted">{c.ist} → {c.soll}</span>
                </span>
                {c.target && !('kind' in c.target && c.target.kind === 'annotation') && (
                  <button type="button" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded gp-muted hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]" onClick={() => focusTarget(c.floorId, c.target)} title="Im Plan anzeigen" aria-label="Im Plan anzeigen">
                    <Crosshair size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] gp-muted">Details und Quellen unter Übersicht → Regularien &amp; Brandschutz.</p>
      </Section>
      <Section title="Punkte" icon={<ListOrdered size={15} />} storageKey="props.escape-route.points" badge={<span className="text-xs gp-muted">{ann.points.length}</span>}>
        <ol className="space-y-1.5">
          {ann.points.map((p, i) => (
            <li key={i} className="flex items-end gap-1.5">
              <span className="w-5 pb-2 text-[11px] tabular-nums gp-muted">{i === 0 ? 'S' : i === ann.points.length - 1 ? 'Z' : i}</span>
              <LengthField label={i === 0 ? 'Start X' : i === ann.points.length - 1 ? 'Ziel X' : `X`} value={p.x} onChange={(v) => v != null && setPoint(i, { x: v })} decimals={0} disabled={locked} className="min-w-0 flex-1" />
              <LengthField label={i === 0 ? 'Start Y' : i === ann.points.length - 1 ? 'Ziel Y' : `Y`} value={p.y} onChange={(v) => v != null && setPoint(i, { y: v })} decimals={0} disabled={locked} className="min-w-0 flex-1" />
              <button
                type="button"
                className="mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md gp-muted hover:[background:color-mix(in_srgb,var(--gp-danger)_14%,transparent)] disabled:opacity-40"
                onClick={() => removePoint(i)}
                disabled={locked || ann.points.length <= 2}
                title={ann.points.length <= 2 ? 'Mindestens 2 Punkte' : 'Punkt entfernen'}
                aria-label={`Punkt ${i + 1} entfernen`}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ol>
        <Button size="sm" icon={<Plus size={14} />} onClick={addPoint} disabled={locked} title="Punkt in Laufrichtung anhängen – im Plan: Alt+Klick oder Doppelklick auf ein Segment fügt dort einen Punkt ein">
          Punkt anhängen
        </Button>
        <p className="text-[11px] gp-muted">Im Plan: Griffe ziehen, Alt+Klick/Doppelklick auf ein Segment fügt einen Punkt ein, Entf über einem Griff entfernt ihn.</p>
      </Section>
      <LockHideDelete floor={floor} sel={[{ kind: 'annotation', id: ann.id }]} locked={locked} />
    </div>
  );
}
