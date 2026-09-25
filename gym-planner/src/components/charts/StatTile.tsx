import type { ReactNode } from 'react';

export type StatTone = 'default' | 'accent' | 'ok' | 'warn' | 'danger';

export interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
  icon?: ReactNode;
  /** Tooltip. */
  title?: string;
  className?: string;
}

const TONE_COLOR: Record<StatTone, string> = {
  default: 'var(--gp-text)',
  accent: 'var(--gp-accent)',
  ok: 'var(--gp-ok)',
  warn: 'var(--gp-warn)',
  danger: 'var(--gp-danger)',
};

/** Kennzahl-Kachel (Label, Wert, Zusatzzeile). Farben ausschließlich über CSS-Variablen. */
export function StatTile({ label, value, sub, tone = 'default', icon, title, className = '' }: StatTileProps) {
  return (
    <div className={`gp-card flex min-w-0 flex-col gap-0.5 p-2.5! ${className}`} title={title}>
      <div className="flex items-center gap-1 gp-label">
        {icon && <span className="shrink-0 opacity-80">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate text-lg font-semibold leading-tight tabular-nums" style={{ color: TONE_COLOR[tone] }}>{value}</div>
      {sub && <div className="truncate text-[11px] gp-muted">{sub}</div>}
    </div>
  );
}
