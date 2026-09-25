import { formatPercent } from '@/geometry/units';

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

/**
 * Geschätzte Textbreite in px für Inter/System-Sans (ohne DOM-Messung – deterministisch, auch in Tests).
 * Ziffern ≈ 0,6 em, Großbuchstaben ≈ 0,68 em, schmale Zeichen (i, l, Satzzeichen, Leerzeichen) ≈ 0,3 em.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    if (ch === ' ' || ch === '.' || ch === ',' || ch === ':' || ch === '·' || ch === "'") em += 0.28;
    else if ('iljtfrI!|'.includes(ch)) em += 0.32;
    else if ('mwMW'.includes(ch)) em += 0.85;
    else if (ch === '%') em += 0.9;
    else if (ch === '²' || ch === '³' || ch === '°') em += 0.42;
    else if (ch >= '0' && ch <= '9') em += 0.6;
    else if (ch >= 'A' && ch <= 'Z' || ch === 'Ä' || ch === 'Ö' || ch === 'Ü') em += 0.68;
    else em += 0.56;
  }
  return em * fontSize;
}

/**
 * Balkendiagramm als reines SVG. Text über CSS-Variablen (Hell/Dunkel), Tooltip via <title>.
 * Die Wertspalte rechts wird nach der längsten Beschriftung bemessen (nichts wird abgeschnitten);
 * bei sehr langen Werten wandert die Beschriftung unter den Balken.
 */
export function BarChart({
  bars, horizontal = true, max, format = defaultFormat, showPercent = false, width = 280, barHeight = 16, labelWidth = 96, marker, markerLabel, emptyLabel = 'Keine Daten', className = '',
}: BarChartProps) {
  const valid = bars.filter((b) => Number.isFinite(b.value));
  if (!valid.length) return <div className={`text-xs gp-muted ${className}`}>{emptyLabel}</div>;
  const globalMax = max != null && max > 0 ? max : Math.max(...valid.map((b) => b.max ?? b.value), marker ?? 0, 0);
  const fillFor = (b: BarDatum) => (b.danger ? 'var(--gp-danger)' : b.color);
  const refOf = (b: BarDatum) => (b.max ?? globalMax) || 1;
  const valueText = (b: BarDatum) => `${b.valueLabel ?? format(b.value)}${showPercent ? ` · ${formatPercent((b.value / refOf(b)) * 100)}` : ''}`;
  const textFor = (b: BarDatum) => `${b.label}: ${b.valueLabel ?? format(b.value)}${showPercent ? ` (${formatPercent((b.value / refOf(b)) * 100)})` : ''}`;

  if (!horizontal) {
    const gap = 6;
    const h = 120;
    const labelH = 28;
    const bw = Math.max(8, (width - gap * (valid.length + 1)) / valid.length);
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${h + labelH}`} preserveAspectRatio="xMinYMin meet" role="img" className={className} style={{ color: 'var(--gp-text)', display: 'block' }}>
        {valid.map((b, i) => {
          const bh = Math.max(0, Math.min(1, b.value / refOf(b))) * (h - 4);
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

  const valueFont = 10;
  const values = valid.map(valueText);
  // Schätzung + 4 % Reserve + Abstand, damit auch breitere Systemschriften nicht über den Rand laufen
  const valueW = Math.ceil(Math.max(24, ...values.map((t) => estimateTextWidth(t, valueFont))) * 1.04) + 12;
  const trackX = labelWidth + 6;
  // Wertspalte rechts neben dem Balken, solange der Balken ≥ 60 px behält; sonst Wert unter dem Balken.
  const inline = width - trackX - valueW >= 60;
  const trackW = Math.max(20, inline ? width - trackX - valueW : width - trackX - 4);
  const rowH = barHeight + (inline ? 8 : 8 + valueFont + 2);
  const height = valid.length * rowH + (marker != null && markerLabel ? 12 : 0);
  const markerX = marker != null && globalMax > 0 ? trackX + Math.min(1, marker / globalMax) * trackW : null;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet" overflow="visible" role="img" className={className} style={{ color: 'var(--gp-text)', display: 'block' }}>
      {valid.map((b, i) => {
        const w = Math.max(0, Math.min(1, b.value / refOf(b))) * trackW;
        const y = i * rowH;
        const label = b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label;
        const valueStyle = { fill: b.danger ? 'var(--gp-danger)' : 'var(--gp-muted)' };
        return (
          <g key={`${b.label}-${i}`}>
            <title>{textFor(b)}</title>
            <text x={labelWidth} y={y + barHeight / 2 + 4} textAnchor="end" fontSize={11} fill="currentColor">{label}</text>
            <rect x={trackX} y={y + 4} width={trackW} height={barHeight - 4} rx={3} style={{ fill: 'var(--gp-border)', opacity: 0.6 }} />
            <rect x={trackX} y={y + 4} width={w} height={barHeight - 4} rx={3} style={{ fill: fillFor(b) }} />
            {inline ? (
              <text x={trackX + trackW + 6} y={y + barHeight / 2 + 4} fontSize={valueFont} style={valueStyle}>{values[i]}</text>
            ) : (
              <text x={trackX} y={y + barHeight + valueFont + 1} fontSize={valueFont} style={valueStyle}>{values[i]}</text>
            )}
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
