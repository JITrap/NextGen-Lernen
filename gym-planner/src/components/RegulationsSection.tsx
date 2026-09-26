/**
 * Abschnitt „Regularien & Brandschutz“ im Übersichts-Panel: Zähler (nicht erfüllt / prüfen / erfüllt), Gruppen je
 * Thema (auf-/zuklappbar), Zeilen mit Status-Icon, Titel, „Ist → Soll“, aufklappbarer Erläuterung mit Quelle (Link).
 * Klick auf eine Zeile springt zum Ziel im Plan (focusTarget). Umfang „aktives Stockwerk/alle“ über `scope`.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, TriangleAlert, OctagonAlert, Info, Minus, Crosshair, ExternalLink, Users } from 'lucide-react';
import type { Project, Id } from '@/types';
import { regulations, regulationChecksFor, countRegulationChecks, REGULATION_STATUS_LABELS, THEMA_ORDER, STAFF_DEFAULT, type RegulationCheck, type RegulationStatus } from '@/analysis/regulations';
import { focusTarget } from './focusTarget';

const STATUS_ICON: Record<RegulationStatus, { Icon: typeof CircleCheck; color: string }> = {
  ok: { Icon: CircleCheck, color: 'var(--gp-ok)' },
  warn: { Icon: TriangleAlert, color: 'var(--gp-warn)' },
  fail: { Icon: OctagonAlert, color: 'var(--gp-danger)' },
  info: { Icon: Info, color: 'var(--gp-accent)' },
  na: { Icon: Minus, color: 'var(--gp-muted)' },
};

export function StatusIcon({ status, size = 14 }: { status: RegulationStatus; size?: number }) {
  const { Icon, color } = STATUS_ICON[status];
  return <Icon size={size} className="mt-0.5 shrink-0" style={{ color }} aria-label={REGULATION_STATUS_LABELS[status]} />;
}

function CountPill({ n, color, label }: { n: number; color: string; label: string }) {
  if (!n) return null;
  return <span className="rounded px-1.5 py-0.5 text-white" style={{ background: color }} title={label}>{n}</span>;
}

/** Kopfzeile mit Zählern – auch als Badge im Abschnittskopf verwendbar. */
export function RegulationCounts({ counts }: { counts: Record<RegulationStatus, number> }) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums">
      <CountPill n={counts.fail} color="var(--gp-danger)" label="nicht erfüllt" />
      <CountPill n={counts.warn} color="var(--gp-warn)" label="prüfen" />
      <CountPill n={counts.ok} color="var(--gp-ok)" label="erfüllt" />
    </span>
  );
}

function CheckRow({ c, showFloor, floorName }: { c: RegulationCheck; showFloor: boolean; floorName?: string }) {
  const [open, setOpen] = useState(false);
  const canJump = !!c.target;
  return (
    <li className="rounded-md border gp-border">
      <div className="flex items-start gap-2 px-2 py-1.5 text-xs">
        <StatusIcon status={c.status} />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={open ? 'Erläuterung ausblenden' : 'Erläuterung anzeigen'}
        >
          <span className="block leading-snug">{c.titel}{showFloor && floorName ? <span className="gp-muted"> · {floorName}</span> : null}</span>
          <span className="block text-[11px] leading-snug gp-muted">
            <span style={{ color: c.status === 'fail' ? 'var(--gp-danger)' : c.status === 'warn' ? 'var(--gp-warn)' : undefined }}>{c.ist}</span>
            {' → '}
            {c.soll}
          </span>
        </button>
        {canJump && (
          <button
            type="button"
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded gp-muted hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]"
            onClick={() => focusTarget(c.floorId, c.target)}
            title="Im Plan anzeigen"
            aria-label={`${c.titel} im Plan anzeigen`}
          >
            <Crosshair size={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t px-2 py-1.5 text-[11px] leading-snug gp-border">
          <p>{c.erlaeuterung}</p>
          <p className="mt-1 gp-muted">
            Quelle:{' '}
            {c.quelleUrl ? (
              <a href={c.quelleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline" style={{ color: 'var(--gp-accent)' }}>
                {c.quelle} <ExternalLink size={10} aria-hidden="true" />
              </a>
            ) : c.quelle}
          </p>
          <p className="mt-1 gp-muted">Status: {REGULATION_STATUS_LABELS[c.status]}</p>
        </div>
      )}
    </li>
  );
}

function Group({ thema, checks, showFloor, floorNames, defaultOpen }: { thema: string; checks: RegulationCheck[]; showFloor: boolean; floorNames: Map<Id, string>; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const counts = useMemo(() => countRegulationChecks(checks), [checks]);
  return (
    <section className="rounded-md border gp-border">
      <button type="button" className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown size={14} className="shrink-0 gp-muted" /> : <ChevronRight size={14} className="shrink-0 gp-muted" />}
        <span className="min-w-0 flex-1 truncate">{thema}</span>
        <RegulationCounts counts={counts} />
        {counts.fail === 0 && counts.warn === 0 && counts.ok === 0 && <Info size={14} style={{ color: 'var(--gp-accent)' }} aria-label="Hinweise" />}
      </button>
      {open && (
        <ul className="space-y-1 px-2 pb-2">
          {checks.map((c) => <CheckRow key={c.id} c={c} showFloor={showFloor} floorName={c.floorId ? floorNames.get(c.floorId) : undefined} />)}
        </ul>
      )}
    </section>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-snug gp-muted">{children}</p>;
}

export function RegulationsSection({ project, scope, activeFloorId }: { project: Project; scope: 'active' | 'all'; activeFloorId: Id | null }) {
  const report = useMemo(() => regulations(project), [project]);
  const checks = useMemo(() => regulationChecksFor(report, scope, activeFloorId), [report, scope, activeFloorId]);
  const counts = useMemo(() => countRegulationChecks(checks), [checks]);
  const floorNames = useMemo(() => new Map(project.floors.map((f) => [f.id, f.name])), [project.floors]);
  const groups = useMemo(() => {
    const m = new Map<string, RegulationCheck[]>();
    for (const c of checks) {
      const g = m.get(c.thema);
      if (g) g.push(c);
      else m.set(c.thema, [c]);
    }
    return [...m.entries()].sort((a, b) => THEMA_ORDER.indexOf(a[0]) - THEMA_ORDER.indexOf(b[0]));
  }, [checks]);
  const showFloor = scope === 'all' && project.floors.length > 1;
  return (
    <div className="space-y-2" data-tutorial="regulations">
      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs gp-border">
        <Users size={14} className="shrink-0 gp-muted" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold tabular-nums">{report.persons} Personen</span>
          <span className="gp-muted"> = {report.trainees} Trainierende + {report.staff} Beschäftigte</span>
        </span>
        <RegulationCounts counts={counts} />
      </div>
      {counts.fail === 0 && counts.warn === 0 && (
        <div className="flex items-center gap-2 rounded-md border p-2 text-xs gp-border" style={{ color: 'var(--gp-ok)' }}>
          <CircleCheck size={16} className="shrink-0" /> Keine offenen Punkte – alle prüfbaren Anforderungen sind erfüllt.
        </div>
      )}
      {groups.map(([thema, list]) => (
        <Group key={thema} thema={thema} checks={list} showFloor={showFloor} floorNames={floorNames} defaultOpen={list.some((c) => c.status === 'fail' || c.status === 'warn')} />
      ))}
      <Hint>
        Planungshilfe nach ASR, DGUV und Landesbauordnung – ersetzt kein Brandschutzkonzept. Bemessung: Trainierende laut Kapazität plus {STAFF_DEFAULT} Beschäftigte (Konstante).
        Klick auf eine Zeile zeigt die Erläuterung mit Quelle, das Fadenkreuz springt zum Ziel im Plan.
      </Hint>
    </div>
  );
}
