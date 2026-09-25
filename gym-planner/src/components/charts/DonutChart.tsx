export interface DonutSlice {
  label: string;
  value: number;
  /** Beliebige CSS-Farbe, auch `var(--gp-…)`. */
  color: string;
  /** Vorformatierter Wert für Legende/Tooltip (sonst `format(value)`). */
  valueLabel?: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  /** Bezugsgröße für Prozent (Standard: Summe der Werte). */
  total?: number;
  centerLabel?: string;
  centerSub?: string;
  size?: number;
  thickness?: number;
  format?: (v: number) => string;
  showLegend?: boolean;
  emptyLabel?: string;
  className?: string;
}

const defaultFormat = (v: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(v);
const pctFormat = (v: number) => `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(v)} %`;

/** Ring-/Donut-Diagramm als reines SVG (Kreis mit stroke-dasharray je Segment), Legende mit Prozent, Tooltip via <title>. */
export function DonutChart({
  slices, total, centerLabel, centerSub, size = 140, thickness = 22, format = defaultFormat, showLegend = true, emptyLabel = 'Keine Daten', className = '',
}: DonutChartProps) {
  const valid = slices.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const sum = valid.reduce((s, x) => s + x.value, 0);
  const base = total != null && total > 0 ? total : sum;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = base > 0
    ? valid.map((s) => {
      const frac = Math.min(1, s.value / base);
      const len = frac * circumference;
      const seg = { ...s, frac, len, offset };
      offset += len;
      return seg;
    })
    : [];

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel ? `${centerLabel} ${centerSub ?? ''}` : 'Diagramm'} style={{ color: 'var(--gp-text)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} style={{ stroke: 'var(--gp-border)' }} />
        {segments.map((s, i) => (
          <circle
            key={`${s.label}-${i}`}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            strokeDasharray={`${s.len} ${Math.max(0, circumference - s.len)}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ stroke: s.color }}
          >
            <title>{`${s.label}: ${s.valueLabel ?? format(s.value)} (${pctFormat(s.frac * 100)})`}</title>
          </circle>
        ))}
        {segments.length === 0 && (
          <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: 'var(--gp-muted)' }}>{emptyLabel}</text>
        )}
        {segments.length > 0 && centerLabel && (
          <text x={size / 2} y={centerSub ? size / 2 - 4 : size / 2} textAnchor="middle" dominantBaseline="central" fontSize={size >= 120 ? 18 : 14} fontWeight={600} fill="currentColor">{centerLabel}</text>
        )}
        {segments.length > 0 && centerSub && (
          <text x={size / 2} y={size / 2 + 14} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: 'var(--gp-muted)' }}>{centerSub}</text>
        )}
      </svg>
      {showLegend && segments.length > 0 && (
        <ul className="w-full space-y-0.5 text-xs">
          {segments.map((s, i) => (
            <li key={`${s.label}-${i}`} className="flex items-center gap-2" title={`${s.label}: ${s.valueLabel ?? format(s.value)}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="shrink-0 tabular-nums">{s.valueLabel ?? format(s.value)}</span>
              <span className="w-12 shrink-0 text-right tabular-nums gp-muted">{pctFormat(s.frac * 100)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
