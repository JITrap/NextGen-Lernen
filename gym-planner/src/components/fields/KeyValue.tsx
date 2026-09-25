import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

export interface KeyValueProps {
  label: ReactNode;
  value?: ReactNode;
  /** Tooltip auf dem Wert. */
  title?: string;
  /** Wert als externer Link (target _blank, rel noopener). */
  href?: string;
  /** Tabellarische Zahlen. */
  mono?: boolean;
  /** Farbton des Werts. */
  tone?: 'default' | 'muted' | 'warn' | 'danger' | 'ok';
  /** Wert unter das Label statt daneben (lange Texte). */
  stacked?: boolean;
  /** Anzeige, wenn value leer ist (Standard „–“). */
  empty?: ReactNode;
  className?: string;
}

const TONE: Record<NonNullable<KeyValueProps['tone']>, string | undefined> = {
  default: undefined,
  muted: 'var(--gp-muted)',
  warn: 'var(--gp-warn)',
  danger: 'var(--gp-danger)',
  ok: 'var(--gp-ok)',
};

/** Anzeigezeile „Bezeichnung … Wert“ (nicht editierbar). */
export function KeyValue({ label, value, title, href, mono, tone = 'default', stacked, empty = '–', className = '' }: KeyValueProps) {
  const isEmpty = value == null || value === '' || value === false;
  let content: ReactNode = isEmpty ? <span className="gp-muted">{empty}</span> : value;
  if (href && !isEmpty) {
    content = (
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate underline-offset-2 hover:underline" style={{ color: 'var(--gp-accent)' }} title={title ?? href}>
        <span className="truncate">{value}</span>
        <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
      </a>
    );
  }
  return (
    <div className={`${stacked ? 'flex flex-col gap-0.5' : 'flex items-baseline justify-between gap-3'} py-0.5 text-sm ${className}`}>
      <span className="shrink-0 text-xs gp-muted">{label}</span>
      <span className={`min-w-0 ${stacked ? '' : 'text-right'} ${mono ? 'tabular-nums' : ''} ${stacked ? 'break-words' : 'truncate'}`} style={{ color: TONE[tone] }} title={href ? undefined : title}>
        {content}
      </span>
    </div>
  );
}
