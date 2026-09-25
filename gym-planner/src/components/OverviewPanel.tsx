/**
 * Panel „Übersicht“: Flächenbilanz, Geräte-Statistik, Gewicht & Bodenlast, Kapazität, Stückliste und
 * Planungs-Warnungen. Alle Berechnungen kommen aus src/analysis (memoisiert am Projekt-Objekt);
 * das Projekt wird per useDeferredValue verwendet, damit Drags im Canvas nicht durch die Analyse gebremst werden.
 */
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ChevronDown, ChevronRight, LayoutGrid, Dumbbell, Weight, Users, ClipboardList, TriangleAlert, OctagonAlert, Info,
  Download, CircleCheck, Crosshair, Layers,
} from 'lucide-react';
import type { PlanningWarning, WarningKind, Id } from '@/types';
import { useProjectStore, transaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import {
  areaBalance, equipmentStats, floorLoad, capacity, bom, warnings, warningFocus, countWarnings,
  WARNING_KIND_LABELS, WARNING_KINDS, SEVERITY_LABELS, UNASSIGNED_COLOR, POINT_LOAD_THRESHOLD_KG,
  type BomLine, type CapacityStatus,
} from '@/analysis';
import { formatM2, formatKg, formatKgM2, formatEur, formatPercent, formatNumber, parseNumber } from '@/geometry/units';
import { exportCsv } from '@/export';
import { DonutChart } from './charts/DonutChart';
import { BarChart } from './charts/BarChart';
import { StatTile } from './charts/StatTile';

/* ------------------------------------------------------------------ */
/* Lokaler UI-Zustand (Abschnitte, Umfang, Filter) – bleibt erhalten   */
/* ------------------------------------------------------------------ */

type SectionId = 'area' | 'equipment' | 'load' | 'capacity' | 'bom' | 'warnings';
type Scope = 'active' | 'all';

const DEFAULT_OPEN: Record<SectionId, boolean> = { area: true, equipment: false, load: false, capacity: true, bom: false, warnings: true };

interface OverviewUiState {
  scope: Scope;
  setScope: (s: Scope) => void;
  open: Partial<Record<SectionId, boolean>>;
  toggleSection: (id: SectionId) => void;
  warningFilter: WarningKind | 'all';
  setWarningFilter: (k: WarningKind | 'all') => void;
}

export const useOverviewUi = create<OverviewUiState>()(
  persist(
    (set) => ({
      scope: 'active',
      setScope: (scope) => set({ scope }),
      open: { ...DEFAULT_OPEN },
      toggleSection: (id) => set((s) => ({ open: { ...s.open, [id]: !(s.open[id] ?? DEFAULT_OPEN[id]) } })),
      warningFilter: 'all',
      setWarningFilter: (warningFilter) => set({ warningFilter }),
    }),
    { name: 'gymplanner-overview', partialize: (s) => ({ scope: s.scope, open: s.open, warningFilter: s.warningFilter }) },
  ),
);

/* ------------------------------------------------------------------ */
/* Kleine Bausteine                                                    */
/* ------------------------------------------------------------------ */

function Section({ id, title, icon, badge, children }: { id: SectionId; title: string; icon: ReactNode; badge?: ReactNode; children: ReactNode }) {
  const open = useOverviewUi((s) => s.open[id] ?? DEFAULT_OPEN[id]);
  const toggle = useOverviewUi((s) => s.toggleSection);
  return (
    <section className="border-b gp-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--gp-accent)_8%,transparent)]"
        onClick={() => toggle(id)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} className="shrink-0 gp-muted" /> : <ChevronRight size={16} className="shrink-0 gp-muted" />}
        <span className="shrink-0" style={{ color: 'var(--gp-accent)' }}>{icon}</span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {badge}
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </section>
  );
}

function Hint({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' | 'danger' }) {
  const color = tone === 'warn' ? 'var(--gp-warn)' : tone === 'danger' ? 'var(--gp-danger)' : 'var(--gp-muted)';
  return <p className="text-[11px] leading-snug" style={{ color }}>{children}</p>;
}

function SubTitle({ children }: { children: ReactNode }) {
  return <h4 className="gp-label pt-1">{children}</h4>;
}

/** Eingabeformat: Komma als Dezimaltrennzeichen, ohne Tausenderpunkte (sonst würde „1.000“ als 1 gelesen). */
const plainNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, useGrouping: false });

/** Zahlenfeld mit Entwurf: übernimmt bei Enter/Blur, Komma und Punkt erlaubt. */
function NumberField({ value, onCommit, min = 0, suffix, ariaLabel, allowEmpty = false, placeholder, className = '' }: {
  value: number | null;
  onCommit: (v: number | null) => void;
  min?: number;
  suffix?: string;
  ariaLabel: string;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const shownValue = value == null ? '' : plainNumber.format(value);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      if (allowEmpty && value != null) onCommit(null);
    } else {
      const v = parseNumber(trimmed);
      if (v != null && v >= min && v !== value) onCommit(v);
    }
    setDraft(null);
  };
  return (
    <div className={`relative ${className}`}>
      <input
        className="gp-input py-0.5! pr-7 text-right tabular-nums"
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft ?? shownValue}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => { setDraft(shownValue); e.target.select(); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
        }}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] gp-muted">{suffix}</span>}
    </div>
  );
}

const TABLE = 'w-full border-collapse text-[11px] tabular-nums';
const TH = 'py-1 pr-2 text-left font-semibold gp-muted whitespace-nowrap';
const TD = 'py-1 pr-2 align-top';
const TD_R = `${TD} text-right whitespace-nowrap`;

function Swatch({ color }: { color: string }) {
  return <span className="mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm align-middle" style={{ background: color }} aria-hidden />;
}

function TrafficLight({ status }: { status: CapacityStatus }) {
  const color = status === 'ok' ? 'var(--gp-ok)' : status === 'warn' ? 'var(--gp-warn)' : 'var(--gp-danger)';
  const label = status === 'ok' ? 'ausreichend' : status === 'warn' ? 'knapp' : 'zu wenige';
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: color }} title={label} aria-label={label} />;
}

function SeverityIcon({ severity }: { severity: PlanningWarning['severity'] }) {
  if (severity === 'error') return <OctagonAlert size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--gp-danger)' }} aria-label="Fehler" />;
  if (severity === 'warning') return <TriangleAlert size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--gp-warn)' }} aria-label="Warnung" />;
  return <Info size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--gp-accent)' }} aria-label="Hinweis" />;
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function OverviewPanel() {
  const liveProject = useProjectStore((s) => s.project);
  const project = useDeferredValue(liveProject);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const setActiveFloor = useProjectStore((s) => s.setActiveFloor);
  const scopeSetting = useOverviewUi((s) => s.scope);
  const setScope = useOverviewUi((s) => s.setScope);
  const warningFilter = useOverviewUi((s) => s.warningFilter);
  const setWarningFilter = useOverviewUi((s) => s.setWarningFilter);

  const floors = useMemo(() => [...project.floors].sort((a, b) => a.order - b.order), [project.floors]);
  const activeFloor = floors.find((f) => f.id === project.activeFloorId) ?? floors[0];
  const multiFloor = floors.length > 1;
  const scope: Scope = multiFloor ? scopeSetting : 'active';
  const activeId: Id = activeFloor?.id ?? '';

  const balance = useMemo(() => areaBalance(project), [project]);
  const stats = useMemo(() => equipmentStats(project), [project]);
  const load = useMemo(() => floorLoad(project), [project]);
  const cap = useMemo(() => capacity(project), [project]);
  const list = useMemo(() => bom(project), [project]);
  const allWarnings = useMemo(() => warnings(project), [project]);

  const pick = <T extends { floorId: Id }>(perFloor: T[], total: T): T => (scope === 'all' ? total : perFloor.find((f) => f.floorId === activeId) ?? total);
  const ab = pick(balance.floors, balance.total);
  const es = pick(stats.floors, stats.total);
  const fl = pick(load.floors, load.total);
  const scopeLabel = scope === 'all' ? 'Alle Stockwerke' : activeFloor?.name ?? 'Stockwerk';

  const scopedWarnings = useMemo(
    () => (scope === 'all' ? allWarnings : allWarnings.filter((w) => w.floorId === activeId || w.kind === 'capacity')),
    [allWarnings, scope, activeId],
  );
  const kindCounts = useMemo(() => {
    const m = new Map<WarningKind, number>();
    for (const w of scopedWarnings) m.set(w.kind, (m.get(w.kind) ?? 0) + 1);
    return m;
  }, [scopedWarnings]);
  const filteredWarnings = useMemo(
    () => (warningFilter === 'all' ? scopedWarnings : scopedWarnings.filter((w) => w.kind === warningFilter)),
    [scopedWarnings, warningFilter],
  );
  const counts = countWarnings(scopedWarnings);

  const jump = (w: PlanningWarning) => {
    const current = useProjectStore.getState().project;
    const ui = useUiStore.getState();
    const f = warningFocus(current, w);
    if (!f) { ui.toast('Kein Ziel zum Hinspringen vorhanden.', 'info'); return; }
    if (w.floorId !== current.activeFloorId && current.floors.some((x) => x.id === w.floorId)) setActiveFloor(w.floorId);
    if (ui.view3d) ui.setView3d(false);
    ui.requestFocus(f.point, f.selection);
  };
  const jumpToItem = (itemId: Id, floorId: Id) => jump({ id: `jump:${itemId}`, kind: 'collision', severity: 'info', message: '', floorId, target: { kind: 'item', id: itemId } });

  const setPrice = (line: BomLine, price: number | null) => {
    transaction(() => {
      const store = useProjectStore.getState();
      store.setPriceOverride(line.defId, price);
      for (const f of store.project.floors) {
        const ids = f.items.filter((it) => it.defId === line.defId).map((it) => it.id);
        if (!ids.length) continue;
        store.updateItems(f.id, ids, (it) => { if (price == null) delete it.priceEur; else it.priceEur = price; });
      }
    });
  };

  const noHall = !ab.hasHall;
  const limit = project.settings.floorLoadLimitKgM2;
  const activeCap = cap.floors.find((x) => x.floorId === activeId);

  /* ---- Stückliste im gewählten Umfang ---- */
  const bomLines = useMemo(() => {
    if (scope === 'all') return list.lines;
    return list.lines
      .map((l) => {
        const fc = l.floorCounts.find((f) => f.floorId === activeId);
        const count = fc?.count ?? 0;
        return { ...l, count, totalEur: l.unitPriceEur != null ? l.unitPriceEur * count : null, totalWeightKg: l.weightKg != null ? l.weightKg * count : null };
      })
      .filter((l) => l.count > 0);
  }, [list, scope, activeId]);
  const bomTotals = useMemo(() => {
    let count = 0; let weight = 0; let eur = 0; let noPrice = 0;
    for (const l of bomLines) {
      count += l.count;
      weight += l.totalWeightKg ?? 0;
      if (l.totalEur != null) eur += l.totalEur; else noPrice += 1;
    }
    return { count, weight, eur, noPrice };
  }, [bomLines]);

  return (
    <div className="flex flex-col text-sm">
      {/* Umfang */}
      <div className="flex items-center gap-2 border-b px-3 py-2 gp-border">
        <Layers size={15} className="shrink-0 gp-muted" />
        {multiFloor ? (
          <div className="flex flex-1 gap-1 rounded-md border p-0.5 gp-border" role="tablist" aria-label="Auswertungsumfang">
            <button type="button" role="tab" aria-selected={scope === 'active'} className={`gp-tab flex-1 px-2! py-1! text-xs ${scope === 'active' ? 'active' : ''}`} onClick={() => setScope('active')}>
              {activeFloor?.name ?? 'Aktives Stockwerk'}
            </button>
            <button type="button" role="tab" aria-selected={scope === 'all'} className={`gp-tab flex-1 px-2! py-1! text-xs ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}>
              Alle Stockwerke
            </button>
          </div>
        ) : (
          <span className="flex-1 truncate text-xs gp-muted">Stockwerk {activeFloor?.name ?? '–'}</span>
        )}
      </div>

      {/* Flächenbilanz */}
      <Section id="area" title="Flächenbilanz" icon={<LayoutGrid size={16} />} badge={<span className="text-xs gp-muted">{formatM2(ab.nettoM2)}</span>}>
        {noHall && <Hint tone="warn">Keine Halle gezeichnet – Nettofläche = Summe der Räume/Zonen. Halle mit dem Werkzeug „Halle“ anlegen.</Hint>}
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Brutto" value={formatM2(ab.bruttoM2)} sub="Außenmaß" title="Fläche des Hallen-Außenpolygons" />
          <StatTile label="Netto" value={formatM2(ab.nettoM2)} sub={ab.voidM2 > 0 ? `abzgl. Luftraum ${formatM2(ab.voidM2)}` : 'ohne Außenwände'} tone="accent" title="Halle innen (Wandstärke abgezogen) minus Lufträume" />
          <StatTile label="Training" value={formatM2(ab.trainingM2)} sub={formatPercent(ab.nettoM2 > 0 ? (ab.trainingM2 / ab.nettoM2) * 100 : 0)} tone="ok" title="Flächenklasse Trainingsfläche" />
        </div>
        <DonutChart
          slices={[
            ...ab.byClass.filter((c) => c.m2 > 0).map((c) => ({ label: c.areaClass, value: c.m2, color: c.color, valueLabel: formatM2(c.m2) })),
            ...(ab.unassignedM2 > 0.005 ? [{ label: 'Nicht zugeordnet', value: ab.unassignedM2, color: UNASSIGNED_COLOR, valueLabel: formatM2(ab.unassignedM2) }] : []),
          ]}
          total={ab.nettoM2}
          centerLabel={formatNumber(ab.nettoM2, 0)}
          centerSub="m² netto"
          emptyLabel="Keine Fläche"
        />
        {ab.untypedRoomCount > 0 && (
          <Hint>{ab.untypedRoomCount === 1 ? 'Ein erkannter Raum hat noch keinen Typ' : `${ab.untypedRoomCount} erkannte Räume haben noch keinen Typ`} und zählen als „nicht zugeordnet“ – Typ im Eigenschaften-Panel wählen.</Hint>
        )}
        {ab.byType.length > 0 && (
          <>
            <SubTitle>Je Raumtyp</SubTitle>
            <BarChart
              bars={ab.byType.map((t) => ({ label: t.type, value: t.m2, color: t.color, valueLabel: `${formatM2(t.m2)} · ${formatPercent(t.percent)}` }))}
              max={Math.max(ab.nettoM2, ...ab.byType.map((t) => t.m2))}
              labelWidth={104}
            />
          </>
        )}
        {multiFloor && (
          <>
            <SubTitle>Je Stockwerk</SubTitle>
            <table className={TABLE}>
              <thead>
                <tr><th className={TH}>Stockwerk</th><th className={`${TH} text-right`}>Brutto</th><th className={`${TH} text-right`}>Netto</th><th className={`${TH} text-right`}>Training</th></tr>
              </thead>
              <tbody>
                {balance.floors.map((f) => (
                  <tr key={f.floorId} className={f.floorId === activeId ? 'font-semibold' : ''}>
                    <td className={TD}>{f.floorName}</td>
                    <td className={TD_R}>{formatM2(f.bruttoM2)}</td>
                    <td className={TD_R}>{formatM2(f.nettoM2)}</td>
                    <td className={TD_R}>{formatM2(f.trainingM2)}</td>
                  </tr>
                ))}
                <tr className="border-t gp-border font-semibold">
                  <td className={TD}>Gesamt</td>
                  <td className={TD_R}>{formatM2(balance.total.bruttoM2)}</td>
                  <td className={TD_R}>{formatM2(balance.total.nettoM2)}</td>
                  <td className={TD_R}>{formatM2(balance.total.trainingM2)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </Section>

      {/* Geräte-Statistik */}
      <Section id="equipment" title="Geräte-Statistik" icon={<Dumbbell size={16} />} badge={<span className="text-xs gp-muted">{es.itemCount} Objekte</span>}>
        {es.itemCount === 0 ? (
          <Hint>Noch keine Objekte platziert – Geräte aus der Bibliothek auf den Plan ziehen.</Hint>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Objekte" value={String(es.itemCount)} sub={es.noFootprintCount ? `${es.noFootprintCount} ohne Stellfläche` : scopeLabel} />
              <StatTile label="Grundfläche" value={formatM2(es.footprintM2)} sub="Breite × Tiefe" />
              <StatTile label="inkl. Zonen" value={formatM2(es.withZonesM2)} sub="Sicherheitszonen" title="Grundfläche inkl. aktiver Sicherheitszonen (Überlappungen nicht abgezogen)" />
            </div>
            <Hint>Überlappende Sicherheitszonen werden nicht abgezogen – die Summe kann größer sein als die tatsächlich belegte Fläche.</Hint>
            {es.unknownDefCount > 0 && <Hint tone="warn">{es.unknownDefCount} Objekte ohne Bibliothekseintrag (Maße/Gewicht unbekannt).</Hint>}
            <SubTitle>Je Bereich</SubTitle>
            <BarChart bars={es.byArea.map((e) => ({ label: e.label, value: e.count, color: e.color, valueLabel: `${e.count}` }))} format={(v) => String(v)} labelWidth={104} />
            {es.byMuscle.length > 0 && (
              <>
                <SubTitle>Kraftgeräte je Muskelgruppe</SubTitle>
                <BarChart bars={es.byMuscle.map((e) => ({ label: e.label, value: e.count, color: e.color, valueLabel: `${e.count}` }))} format={(v) => String(v)} labelWidth={104} />
              </>
            )}
            <SubTitle>Hersteller und Serien</SubTitle>
            <table className={TABLE}>
              <thead><tr><th className={TH}>Hersteller</th><th className={TH}>Serie</th><th className={`${TH} text-right`}>Anzahl</th></tr></thead>
              <tbody>
                {es.bySeries.map((e) => {
                  const [man, serie] = e.label.split(' – ');
                  return (
                    <tr key={e.key}>
                      <td className={TD}><Swatch color={e.color} />{man}</td>
                      <td className={TD}>{serie}</td>
                      <td className={TD_R}>{e.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <SubTitle>Freie Restfläche je Raum</SubTitle>
            {es.freeByRoom.length === 0 ? (
              <Hint>Keine Räume oder Zonen vorhanden.</Hint>
            ) : (
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Raum</th>
                    {scope === 'all' && <th className={TH}>Etage</th>}
                    <th className={`${TH} text-right`}>Fläche</th>
                    <th className={`${TH} text-right`}>Geräte</th>
                    <th className={`${TH} text-right`}>Frei</th>
                  </tr>
                </thead>
                <tbody>
                  {es.freeByRoom.map((r) => (
                    <tr key={`${r.floorId}:${r.roomId}`}>
                      <td className={TD} title={r.roomType}>{r.roomName}</td>
                      {scope === 'all' && <td className={TD}>{r.floorName}</td>}
                      <td className={TD_R}>{formatM2(r.roomM2)}</td>
                      <td className={TD_R}>{r.itemCount} · {formatM2(r.itemsM2)}</td>
                      <td className={TD_R} style={{ color: r.freeM2 <= 0 ? 'var(--gp-danger)' : undefined }}>{formatM2(r.freeM2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Section>

      {/* Gewicht & Bodenlast */}
      <Section
        id="load"
        title="Gewicht & Bodenlast"
        icon={<Weight size={16} />}
        badge={<span className="text-xs" style={{ color: fl.exceeded || fl.roomsExceeded > 0 ? 'var(--gp-danger)' : 'var(--gp-muted)' }}>{fl.kgM2 != null ? formatKgM2(fl.kgM2) : formatKg(fl.weightKg)}</span>}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="gp-label">Grenzwert</span>
          <NumberField className="w-28" value={limit} min={1} suffix="kg/m²" ariaLabel="Grenzwert Bodenlast in kg/m²" onCommit={(v) => { if (v != null) updateSettings({ floorLoadLimitKgM2: v }); }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Gesamtgewicht" value={formatKg(fl.weightKg)} sub={`${fl.itemCount} Objekte`} />
          <StatTile label="Bodenlast" value={fl.kgM2 != null ? formatKgM2(fl.kgM2) : '–'} sub={`Grenzwert ${formatKgM2(limit)}`} tone={fl.exceeded ? 'danger' : 'ok'} title="Gesamtgewicht / Nettofläche" />
        </div>
        {fl.roomsExceeded > 0 && <Hint tone="danger">{fl.roomsExceeded === 1 ? 'Ein Raum überschreitet' : `${fl.roomsExceeded} Räume überschreiten`} den Grenzwert (siehe Tabelle).</Hint>}
        {fl.missingWeightCount > 0 && <Hint tone="warn">{fl.missingWeightCount} Objekte ohne Gewichtsangabe (als 0 kg gerechnet).</Hint>}
        <SubTitle>Je Stockwerk (relativ zum Grenzwert)</SubTitle>
        <BarChart
          bars={(scope === 'all' ? load.floors : load.floors.filter((f) => f.floorId === activeId)).map((f) => ({
            label: f.floorName,
            value: f.kgM2 ?? 0,
            color: 'var(--gp-accent)',
            danger: f.kgM2 != null && f.kgM2 > limit,
            valueLabel: `${f.kgM2 != null ? formatKgM2(f.kgM2) : '–'} · ${formatKg(f.weightKg)}`,
          }))}
          max={Math.max(limit * 1.25, ...load.floors.map((f) => f.kgM2 ?? 0))}
          marker={limit}
          markerLabel="Grenzwert"
          labelWidth={64}
        />
        <SubTitle>Je Raum</SubTitle>
        {fl.rooms.length === 0 ? (
          <Hint>Keine Räume oder Zonen vorhanden.</Hint>
        ) : (
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Raum</th>
                {scope === 'all' && <th className={TH}>Etage</th>}
                <th className={`${TH} text-right`}>Gewicht</th>
                <th className={`${TH} text-right`}>kg/m²</th>
              </tr>
            </thead>
            <tbody>
              {fl.rooms.map((r) => (
                <tr key={`${r.floorId}:${r.roomId}`}>
                  <td className={TD}>{r.roomName}</td>
                  {scope === 'all' && <td className={TD}>{r.floorName}</td>}
                  <td className={TD_R}>{formatKg(r.weightKg)}</td>
                  <td className={TD_R} style={{ color: r.exceeded ? 'var(--gp-danger)' : undefined, fontWeight: r.exceeded ? 600 : undefined }}>{r.kgM2 != null ? formatKgM2(r.kgM2) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {fl.heavyItems.length > 0 && (
          <>
            <SubTitle>Punktlasten über {formatKg(POINT_LOAD_THRESHOLD_KG)}</SubTitle>
            <ul className="space-y-0.5 text-[11px]">
              {fl.heavyItems.slice(0, 30).map((h) => (
                <li key={h.itemId}>
                  <button type="button" className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-[color-mix(in_srgb,var(--gp-accent)_10%,transparent)]" onClick={() => jumpToItem(h.itemId, h.floorId)} title="Im Plan anzeigen">
                    <Crosshair size={12} className="shrink-0 gp-muted" />
                    <span className="min-w-0 flex-1 truncate">{h.name}{h.roomName ? ` · ${h.roomName}` : ''}{scope === 'all' ? ` · ${h.floorName}` : ''}</span>
                    <span className="shrink-0 tabular-nums" style={{ color: 'var(--gp-warn)' }}>{formatKg(h.weightKg)}</span>
                  </button>
                </li>
              ))}
              {fl.heavyItems.length > 30 && <li className="px-1 gp-muted">… und {fl.heavyItems.length - 30} weitere</li>}
            </ul>
            <Hint>Schwere Einzelgeräte belasten den Boden punktuell – Statik prüfen, besonders im Obergeschoss.</Hint>
          </>
        )}
      </Section>

      {/* Kapazität */}
      <Section id="capacity" title="Kapazität" icon={<Users size={16} />} badge={<span className="text-xs gp-muted">{cap.persons} Pers.</span>}>
        <div className="flex items-center justify-between gap-2">
          <span className="gp-label">Trainingsfläche je Person</span>
          <NumberField className="w-28" value={cap.m2PerPerson} min={1} suffix="m²" ariaLabel="Quadratmeter Trainingsfläche pro Person" onCommit={(v) => { if (v != null) updateSettings({ m2PerPerson: v }); }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Gleichzeitig Trainierende" value={String(cap.persons)} sub={`${formatM2(cap.trainingM2)} Trainingsfläche`} tone="accent" title="Trainingsfläche ÷ m² je Person, abgerundet (alle Stockwerke)" />
          <StatTile label="Richtwert" value={`${formatNumber(cap.m2PerPerson, 1)} m²`} sub="je Person (8–10 m² üblich)" />
        </div>
        {cap.usedNettoFallback && <Hint>Ohne typisierte Räume/Zonen gilt die gesamte Nettofläche als Trainingsfläche.</Hint>}
        {multiFloor && scope === 'active' && (
          <Hint>Kapazität und Ausstattung werden über alle Stockwerke ausgewertet{activeCap ? ` (${activeCap.floorName}: ${activeCap.persons} Personen, ${formatM2(activeCap.trainingM2)})` : ''}.</Hint>
        )}
        <ul className="space-y-1.5">
          {cap.counters.map((c) => (
            <li key={c.key} className="gp-card p-2!">
              <div className="flex items-center gap-2">
                <TrafficLight status={c.status} />
                <span className="flex-1 font-medium">{c.label}</span>
                <span className="tabular-nums text-xs">
                  <span style={{ color: c.status === 'danger' ? 'var(--gp-danger)' : c.status === 'warn' ? 'var(--gp-warn)' : 'var(--gp-ok)' }} className="font-semibold">{c.actual}</span>
                  <span className="gp-muted"> / {c.required}{c.recommended > c.required ? `–${c.recommended}` : ''} Soll</span>
                </span>
              </div>
              <div className="mt-0.5 text-[11px] gp-muted">{c.detail}</div>
              {c.hint && <div className="mt-0.5 text-[11px]" style={{ color: 'var(--gp-danger)' }}>{c.hint}</div>}
            </li>
          ))}
        </ul>
      </Section>

      {/* Stückliste */}
      <Section id="bom" title="Stückliste" icon={<ClipboardList size={16} />} badge={<span className="text-xs gp-muted">{bomTotals.count} Stk.</span>}>
        {bomLines.length === 0 ? (
          <Hint>Noch keine Objekte platziert.</Hint>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <table className={`${TABLE} min-w-[290px]`}>
                <thead>
                  <tr>
                    <th className={TH}>Gerät</th>
                    <th className={`${TH} text-right`}>Anz.</th>
                    <th className={`${TH} text-right`}>Stückpreis</th>
                    <th className={`${TH} text-right`}>Summe</th>
                  </tr>
                </thead>
                <tbody>
                  {bomLines.map((l) => (
                    <tr key={l.defId} className="border-t gp-border">
                      <td className={`${TD} min-w-0`}>
                        <div className="max-w-[150px] truncate font-medium" title={l.name}>{l.name}</div>
                        <div className="max-w-[150px] truncate gp-muted" title={`${l.hersteller}${l.serie ? ` · ${l.serie}` : ''}${l.modell ? ` · ${l.modell}` : ''}`}>
                          {l.hersteller}{l.serie ? ` · ${l.serie}` : ''}{l.modell ? ` · ${l.modell}` : ''}
                        </div>
                        <div className="max-w-[150px] truncate gp-muted">
                          {l.ohneStellflaeche ? 'ohne Stellfläche' : l.dims}{l.weightKg != null ? ` · ${formatKg(l.weightKg)}` : ''}
                          {!l.verifiziert && !l.unknownDef && <span title="Maße ungeprüft" style={{ color: 'var(--gp-warn)' }}> · ungeprüft</span>}
                          {l.unknownDef && <span style={{ color: 'var(--gp-danger)' }}> · unbekannt</span>}
                        </div>
                      </td>
                      <td className={TD_R}>{l.count}</td>
                      <td className={`${TD} text-right`}>
                        <NumberField
                          className="w-[84px]"
                          value={l.unitPriceEur}
                          min={0}
                          suffix="€"
                          allowEmpty
                          placeholder="–"
                          ariaLabel={`Stückpreis ${l.name}`}
                          onCommit={(v) => setPrice(l, v)}
                        />
                        {l.priceMixed && <div className="text-[10px]" style={{ color: 'var(--gp-warn)' }} title="Objekte dieser Position haben unterschiedliche Preise; angezeigt wird der Mittelwert">Ø gemischt</div>}
                      </td>
                      <td className={TD_R}>{l.totalEur != null ? formatEur(l.totalEur) : <span className="gp-muted">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 gp-border font-semibold">
                    <td className={TD}>Gesamt · {bomLines.length} Pos.</td>
                    <td className={TD_R}>{bomTotals.count}</td>
                    <td className={TD_R}>{formatKg(bomTotals.weight)}</td>
                    <td className={TD_R}>{formatEur(bomTotals.eur)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {bomTotals.noPrice > 0 && <Hint tone="warn">{bomTotals.noPrice} {bomTotals.noPrice === 1 ? 'Position' : 'Positionen'} ohne Preis – nicht in den Gesamtkosten enthalten.</Hint>}
            {(scope === 'all' ? list.itemsWithoutWeight : 0) > 0 && <Hint>{list.itemsWithoutWeight} Objekte ohne Gewichtsangabe.</Hint>}
          </>
        )}
        <button type="button" className="gp-btn w-full justify-center" onClick={() => exportCsv()} disabled={list.lines.length === 0}>
          <Download size={14} /> CSV exportieren
        </button>
      </Section>

      {/* Planungs-Warnungen */}
      <Section
        id="warnings"
        title="Planungs-Warnungen"
        icon={<TriangleAlert size={16} />}
        badge={
          <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums">
            {counts.error > 0 && <span className="rounded px-1.5 py-0.5 text-white" style={{ background: 'var(--gp-danger)' }}>{counts.error}</span>}
            {counts.warning > 0 && <span className="rounded px-1.5 py-0.5 text-white" style={{ background: 'var(--gp-warn)' }}>{counts.warning}</span>}
            {counts.info > 0 && <span className="rounded px-1.5 py-0.5 text-white" style={{ background: 'var(--gp-accent)' }}>{counts.info}</span>}
            {counts.total === 0 && <CircleCheck size={16} style={{ color: 'var(--gp-ok)' }} aria-label="Keine Warnungen" />}
          </span>
        }
      >
        {scopedWarnings.length > 0 && (
          <select className="gp-input" value={warningFilter} onChange={(e) => setWarningFilter(e.target.value as WarningKind | 'all')} aria-label="Warnungen filtern">
            <option value="all">Alle Arten ({scopedWarnings.length})</option>
            {WARNING_KINDS.filter((k) => (kindCounts.get(k) ?? 0) > 0).map((k) => (
              <option key={k} value={k}>{WARNING_KIND_LABELS[k]} ({kindCounts.get(k)})</option>
            ))}
          </select>
        )}
        {scopedWarnings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border p-2 text-xs gp-border" style={{ color: 'var(--gp-ok)' }}>
            <CircleCheck size={16} className="shrink-0" /> Keine Warnungen – der Plan ist im grünen Bereich.
          </div>
        ) : filteredWarnings.length === 0 ? (
          <Hint>Keine Warnungen dieser Art.</Hint>
        ) : (
          <ul className="space-y-1">
            {filteredWarnings.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors gp-border hover:bg-[color-mix(in_srgb,var(--gp-accent)_10%,transparent)]"
                  onClick={() => jump(w)}
                  title={`${SEVERITY_LABELS[w.severity]} · ${WARNING_KIND_LABELS[w.kind]} – klicken, um hinzuspringen`}
                >
                  <SeverityIcon severity={w.severity} />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">{w.message}</span>
                    <span className="block text-[10px] gp-muted">
                      {WARNING_KIND_LABELS[w.kind]}
                      {scope === 'all' && w.kind !== 'capacity' ? ` · ${floors.find((f) => f.id === w.floorId)?.name ?? ''}` : ''}
                    </span>
                  </span>
                  <Crosshair size={12} className="mt-0.5 shrink-0 gp-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
