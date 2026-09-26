/**
 * Abschnitt „Kosten“ im Übersichts-Panel: Kennzahl-Kacheln, Tabellen Einmalkosten (nach Gruppen) und laufende
 * Kosten je Monat, Hinweis auf Objekte ohne Preis, bearbeitbare Annahmen (project.costs) sowie CSV-Export.
 * Die Zahlen kommen aus `costs(project)` (src/analysis); alle Änderungen laufen über den Store (updateCosts/resetCosts).
 * Der Umfang (aktives Stockwerk / alle) wird ignoriert – Kosten sind projektweit.
 */
import type { ReactNode } from 'react';
import { Download, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Project, Id, CostAssumptions } from '@/types';
import {
  costs, COST_GROUP_LABELS, COST_ASSUMPTION_FIELDS, COST_ASSUMPTION_GROUP_LABELS, DEFAULT_COST_ASSUMPTIONS,
  type CostLine, type CostGroup, type CostAssumptionGroup,
} from '@/analysis';
import { useProjectStore } from '@/store/projectStore';
import { formatEur, formatNumber } from '@/geometry/units';
import { exportCostsCsv } from '@/export/csv';
import { StatTile } from './charts/StatTile';
import { NumberField, Section } from './fields';

const TILES = 'grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2';
const TABLE = 'w-full border-collapse text-[11px] tabular-nums';
const TH = 'py-1 pr-2 text-left font-semibold gp-muted whitespace-nowrap';
const TD = 'py-1 pr-2 align-top';
const TD_R = `${TD} text-right whitespace-nowrap`;

const ASSUMPTION_GROUPS: CostAssumptionGroup[] = ['ausbau', 'sanitaer', 'prozent', 'einmal', 'laufend', 'finanzierung'];

function Hint({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return <p className="text-[11px] leading-snug" style={{ color: tone === 'warn' ? 'var(--gp-warn)' : 'var(--gp-muted)' }}>{children}</p>;
}

/** Rechenweg einer Zeile: „185,8 m² × 350,00 €“, „18 % von 123.456 €“, „3 Stk. × 2.500,00 €“. */
function lineDetail(l: CostLine): string {
  if (l.einheit === 'pauschal') return 'pauschal';
  if (l.einheit === '%' || l.einheit === '%/Jahr') return `${formatNumber(l.menge, 1)} ${l.einheit} von ${formatEur(l.einzelpreisEur)}`;
  const menge = l.einheit === 'm²' || l.einheit === 'm' ? formatNumber(l.menge, 1) : formatNumber(l.menge, 0);
  return `${menge} ${l.einheit} × ${formatEur(l.einzelpreisEur)}`;
}

/** Zeilen in Anzeigereihenfolge; mit groupHeaders eine Überschrift vor jeder neuen Gruppe. */
function tableRows(lines: CostLine[], groupHeaders: boolean): ({ kind: 'header'; gruppe: CostGroup } | { kind: 'line'; line: CostLine })[] {
  const rows: ({ kind: 'header'; gruppe: CostGroup } | { kind: 'line'; line: CostLine })[] = [];
  let lastGroup: CostGroup | null = null;
  for (const l of lines) {
    if (groupHeaders && l.gruppe !== lastGroup) rows.push({ kind: 'header', gruppe: l.gruppe });
    lastGroup = l.gruppe;
    rows.push({ kind: 'line', line: l });
  }
  return rows;
}

function CostTable({ lines, total, totalLabel, groupHeaders = false, testId }: { lines: CostLine[]; total: number; totalLabel: string; groupHeaders?: boolean; testId?: string }) {
  const rows = tableRows(lines, groupHeaders);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className={`${TABLE} table-auto`} data-testid={testId}>
        <thead>
          <tr>
            <th className={TH}>Position</th>
            <th className={`${TH} pr-0 text-right`}>Summe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.kind === 'header' ? (
              <tr key={`h:${r.gruppe}`}>
                <td colSpan={2} className="gp-label pt-2">{COST_GROUP_LABELS[r.gruppe]}</td>
              </tr>
            ) : (
              <tr key={r.line.id} className="border-t gp-border">
                <td className={`${TD} w-full max-w-0`}>
                  <div className="truncate font-medium" title={r.line.bezeichnung}>{r.line.bezeichnung}</div>
                  <div className="truncate gp-muted" title={lineDetail(r.line)}>{lineDetail(r.line)}</div>
                  {r.line.hinweis && <div className="truncate gp-muted" title={r.line.hinweis} style={r.line.itemsWithoutPrice ? { color: 'var(--gp-warn)' } : undefined}>{r.line.hinweis}</div>}
                </td>
                <td className={`${TD_R} pr-0`}>
                  {r.line.finanziert ? (
                    <span className="gp-muted" title="Wird über die Finanzierungsrate bezahlt – nicht in der Einmalsumme">({formatEur(r.line.summeEur)})</span>
                  ) : (
                    formatEur(r.line.summeEur)
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 gp-border font-semibold">
            <td className={TD}>{totalLabel}</td>
            <td className={`${TD_R} pr-0`} data-testid={testId ? `${testId}-total` : undefined}>{formatEur(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function CostSection({ project, scope }: { project: Project; scope: 'active' | 'all'; activeFloorId: Id | null }) {
  const c = costs(project);
  const a = c.assumptions;
  const updateCosts = useProjectStore((s) => s.updateCosts);
  const resetCosts = useProjectStore((s) => s.resetCosts);
  const hasCustom = !!project.costs && Object.keys(project.costs).length > 0;
  const noHall = c.flaechen.bruttoM2 <= 0;

  const setField = (key: keyof CostAssumptions, v: number | null) => {
    if (v == null || !Number.isFinite(v) || v < 0) return;
    updateCosts({ [key]: v } as Partial<CostAssumptions>);
  };

  return (
    <>
      {scope === 'active' && project.floors.length > 1 && <Hint>Kosten werden projektweit über alle Stockwerke berechnet (Umfang wird hier nicht angewendet).</Hint>}
      {noHall && <Hint tone="warn">Ohne Halle fehlen Brutto-/Nettofläche – Ausbau, Miete und Kaution ergeben 0 €.</Hint>}

      <div className={TILES}>
        <StatTile label="Einmalkosten" value={formatEur(c.einmalSummeEur)} sub={c.finanziert ? 'ohne finanzierte Geräte' : 'inkl. Geräte'} tone="accent" title="Summe aller Einmalposten (netto)" />
        <StatTile label="davon Geräte" value={formatEur(c.geraeteSummeEur)} sub={c.finanziert ? `finanziert, + Import ${formatEur(c.importSummeEur)}` : `+ Import ${formatEur(c.importSummeEur)}`} title="Gerätesumme aus der Stückliste (Bibliothekspreise, Überschreibungen, Objektpreise)" />
        <StatTile label="Laufend / Monat" value={formatEur(c.monatlichSummeEur)} sub={c.finanziert ? 'inkl. Finanzierungsrate' : 'Miete, Personal, Wartung …'} title="Laufende Kosten je Monat" />
        <StatTile label="Jahr 1" value={formatEur(c.jahr1SummeEur)} sub="Einmal + 12 × laufend" title="Gesamtbedarf im ersten Jahr" />
        <StatTile label="€ je m²" value={noHall ? '–' : `${formatNumber(c.kostenJeM2, 0)} €`} sub={noHall ? 'keine Halle' : `Einmalkosten je m² Brutto (${formatNumber(c.flaechen.bruttoM2, 0)} m²)`} title="Einmalkosten ÷ Bruttofläche" />
        <StatTile label="Break-even" value={a.mitgliedsbeitragEurMonat > 0 ? String(c.breakEvenMitglieder) : '–'} sub={`Mitglieder bei ${formatEur(a.mitgliedsbeitragEurMonat)}/Monat`} tone={c.breakEvenMitglieder > 0 ? 'warn' : 'default'} title="Laufende Kosten ÷ Mitgliedsbeitrag, aufgerundet" />
      </div>
      {c.finanziert && (
        <Hint>
          Geräte und Import werden über {a.finanzierungJahre} Jahre zu {formatNumber(a.zinsProzent, 2)} % finanziert: sie zählen nicht zu den Einmalkosten, die Rate steckt in den
          laufenden Kosten. Gesamtinvestition {formatEur(c.investitionSummeEur)}.
        </Hint>
      )}
      {c.itemsWithoutPrice > 0 && (
        <Hint tone="warn">{c.itemsWithoutPrice} {c.itemsWithoutPrice === 1 ? 'Objekt' : 'Objekte'} ohne Preis – nicht in der Gerätesumme enthalten (siehe Stückliste).</Hint>
      )}

      <h4 className="gp-label pt-1">Einmalkosten</h4>
      <CostTable lines={c.einmal} total={c.einmalSummeEur} totalLabel="Summe Einmalkosten" groupHeaders testId="cost-einmal" />

      <h4 className="gp-label pt-1">Laufende Kosten je Monat</h4>
      <CostTable lines={c.monatlich} total={c.monatlichSummeEur} totalLabel="Summe je Monat" testId="cost-monatlich" />

      <Section title="Annahmen" icon={<SlidersHorizontal size={15} />} storageKey="overview.costs.assumptions" defaultOpen={false} dense className="-mx-3 border-t" badge={hasCustom ? 'angepasst' : 'Standard'}>
        <Hint>Netto-Richtwerte; Änderungen werden im Projekt gespeichert (Rückgängig möglich).</Hint>
        {ASSUMPTION_GROUPS.map((g) => (
          <div key={g} className="space-y-2">
            <h5 className="gp-label">{COST_ASSUMPTION_GROUP_LABELS[g]}</h5>
            <div className="grid grid-cols-2 gap-2">
              {COST_ASSUMPTION_FIELDS.filter((f) => f.gruppe === g).map((f) => (
                <NumberField
                  key={f.key}
                  label={f.label}
                  value={a[f.key]}
                  onChange={(v) => setField(f.key, v)}
                  unit={f.einheit}
                  min={0}
                  max={f.max}
                  step={f.step}
                  decimals={f.decimals ?? 0}
                  integer={(f.decimals ?? 0) === 0}
                  compact
                  title={f.erklaerung}
                  hint={f.erklaerung}
                  name={`cost-${f.key}`}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="gp-btn" onClick={() => resetCosts()} disabled={!hasCustom} title={`Alle Annahmen auf die Standardwerte zurücksetzen (z. B. Grundausbau ${DEFAULT_COST_ASSUMPTIONS.ausbauEurM2} €/m²)`}>
            <RotateCcw size={14} /> Standardwerte
          </button>
        </div>
      </Section>

      <button type="button" className="gp-btn w-full justify-center" onClick={() => exportCostsCsv(project)} data-testid="cost-csv">
        <Download size={14} /> Kosten als CSV
      </button>
      <Hint>Alle Beträge netto ohne MwSt.; Gerätepreise laut Bibliothek (Schätzung/Liste), Ausbau als Richtwerte. Unverbindliche Kalkulation.</Hint>
    </>
  );
}
