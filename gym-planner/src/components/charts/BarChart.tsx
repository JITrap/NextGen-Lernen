export interface BarDatum {
  label: string;
  value: number;
  /** Beliebige CSS-Farbe, auch `var(--gp-…)`. */
  color: string;
  /** Bezugsgröße dieses Balkens (Standard: props.max bzw. größter Wert). */
  max?: number;
  /** Vorformatierter Wert (sonst `format(value)`). */
  valueLabel?: string;
  /** Hervorhebung (z. B. Grenzwert überschritten): Balken in Gefahrenfarbe. */
  danger?: boolean;
}

export interface BarChartProps {
  bars: BarDatum[];
  /** true (Standard): Balken laufen horizontal, ein Balken je Zeile. */
  horizontal?: boolean;
  /** Gemeinsame Bezugsgröße (Standard: größter Wert). */
  max?: number;
  format?: (v: number) => string;
  /** Prozent vom Bezugswert zusätzlich anzeigen. */
  showPercent?: boolean;
  /** Nominale Breite in px (skaliert per viewBox auf 100 %). */
  width?: number;
  barHeight?: number;
  labelWidth?: number;
  /** Markierung (z. B. Grenzwert) als senkrechte Linie bei diesem Wert. */
  marker?: number;
  markerLabel?: string;
  emptyLabel?: string;
  className?: string;
}

const defaultFormat = (v: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(v);
const pctFormat = (v: number) => `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(v)} %`;

/** Balkendiagramm als reines SVG. Text über CSS-Variablen (Hell/Dunkel), Tooltip via <title>. */
export function BarChart({
  bars, horizontal = true, max, format = defaultFormat, showPercent = false, width = 280, barHeight = 16, labelWidth = 96, marker, markerLabel, emptyLabel = 'Keine Daten', className = '',
}: BarChartProps) {
  const valid = bars.filter((b) => Number.isFinite(b.value));
  if (!valid.length) return <div className={`text-xs gp-muted ${className}`}>{emptyLabel}</div>;
  const globalMax = max != null && max > 0 ? max : Math.max(...valid.map((b) => b.max ?? b.value), marker ?? 0, 0);
  const fillFor = (b: BarDatum) => (b.danger ? 'var(--gp-danger)' : b.color);
  const textFor = (b: BarDatum) => `${b.label}: ${b.valueLabel ?? format(b.value)}${showPercent ? ` (${pctFormat(((b.value) / ((b.max ?? globalMax) || 1)) * 100)})` : ''}`;

  if (!horizontal) {
    const gap = 6;
    const h = 120;
    const labelH = 28;
    const bw = Math.max(8, (width - gap * (valid.length + 1)) / valid.length);
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${h + labelH}`} preserveAspectRatio="xMinYMin meet" role="img" className={className} style={{ color: 'var(--gp-text)', display: 'block' }}>
        {valid.map((b, i) => {
          const ref = (b.max ?? globalMax) || 1;
          const bh = Math.max(0, Math.min(1, b.value / ref)) * (h - 4);
          const x = gap + i * (bw + gap);
          return (
            <g key={`${b.label}-${i}`}>
              <title>{textFor(b)}</title>
              <rect x={x} y={2} width={bw} height={h - 4} rx={2} style={{ fill: 'var(--gp-border)', opacity: 0.6 }} />
              <rect x={x} y={2 + (h - 4 - bh)} width={bw} height={bh} rx={2} style={{ fill: fillFor(b) }} />
              <text x={x + bw / 2} y={h + 12} textAnchor="middle" fontSize={9} fill="currentColor">{b.label.length > 8 ? `${b.label.slice(0, 7)}…` : b.label}</text>
              <text x={x + bw / 2} y={h + 23} textAnchor="middle" fontSize={9} style={{ fill: 'var(--gp-muted)' }}>{b.valueLabel ?? format(b.value)}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  const rowH = barHeight + 8;
  const valueW = 78;
  const trackX = labelWidth + 6;
  const trackW = Math.max(20, width - trackX - valueW);
  const height = valid.length * rowH + (marker != null && markerLabel ? 12 : 0);
  const markerX = marker != null && globalMax > 0 ? trackX + Math.min(1, marker / globalMax) * trackW : null;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet" role="img" className={className} style={{ color: 'var(--gp-text)', display: 'block' }}>
      {valid.map((b, i) => {
        const ref = (b.max ?? globalMax) || 1;
        const w = Math.max(0, Math.min(1, b.value / ref)) * trackW;
        const y = i * rowH;
        const label = b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label;
        return (
          <g key={`${b.label}-${i}`}>
            <title>{textFor(b)}</title>
            <text x={labelWidth} y={y + barHeight / 2 + 4} textAnchor="end" fontSize={11} fill="currentColor">{label}</text>
            <rect x={trackX} y={y + 4} width={trackW} height={barHeight - 4} rx={3} style={{ fill: 'var(--gp-border)', opacity: 0.6 }} />
            <rect x={trackX} y={y + 4} width={w} height={barHeight - 4} rx={3} style={{ fill: fillFor(b) }} />
            <text x={trackX + trackW + 6} y={y + barHeight / 2 + 4} fontSize={10} style={{ fill: b.danger ? 'var(--gp-danger)' : 'var(--gp-muted)' }}>
              {b.valueLabel ?? format(b.value)}
              {showPercent ? ` · ${pctFormat((b.value / ref) * 100)}` : ''}
            </text>
          </g>
        );
      })}
      {markerX != null && (
        <g>
          <line x1={markerX} x2={markerX} y1={0} y2={valid.length * rowH} strokeDasharray="3 3" strokeWidth={1} style={{ stroke: 'var(--gp-danger)' }} />
          {markerLabel && <text x={markerX} y={valid.length * rowH + 10} textAnchor={markerX > width - 60 ? 'end' : 'middle'} fontSize={9} style={{ fill: 'var(--gp-danger)' }}>{markerLabel}</text>}
        </g>
      )}
    </svg>
  );
}
