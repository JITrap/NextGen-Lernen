import type { ReactNode } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';

export interface SelectFieldOption<T extends string | number> extends SelectOption<T> {
  /** Farbpunkt vor dem Feld, wenn diese Option gewählt ist (z. B. Raumtyp). */
  color?: string;
}

export interface SelectFieldProps<T extends string | number> {
  value: T;
  options: SelectFieldOption<T>[];
  onChange: (v: T) => void;
  label?: ReactNode;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  hint?: ReactNode;
  compact?: boolean;
  className?: string;
  /** Ist der aktuelle Wert nicht in den Optionen, wird er als zusätzliche Option angezeigt (Standard true). */
  includeCurrent?: boolean;
  /** Beschriftung für den zusätzlichen Eintrag des aktuellen Werts. */
  formatCurrent?: (v: T) => string;
}

/**
 * Beschriftetes Auswahlfeld (natives Select, Touch-/Tastatur-tauglich) mit optionalem Farbpunkt
 * und Hilfetext. Unbekannte aktuelle Werte (z. B. freie Wandstärke 15 cm) bleiben sichtbar.
 */
export function SelectField<T extends string | number>({
  value, options, onChange, label, ariaLabel, title, disabled, hint, compact, className = '', includeCurrent = true, formatCurrent,
}: SelectFieldProps<T>) {
  const known = options.some((o) => o.value === value);
  const all = known || !includeCurrent ? options : [{ value, label: formatCurrent ? formatCurrent(value) : String(value) }, ...options];
  const color = options.find((o) => o.value === value)?.color;
  const control = (
    <span className="relative inline-flex w-full items-center">
      {color && <span className="pointer-events-none absolute left-2 h-3 w-3 shrink-0 rounded-sm border border-black/10" style={{ background: color }} aria-hidden="true" />}
      <Select
        value={value}
        options={all}
        onChange={onChange}
        compact={compact}
        disabled={disabled}
        title={title}
        aria-label={typeof label === 'string' ? label : ariaLabel}
        className={`${color ? 'pl-7' : ''} w-full`}
      />
    </span>
  );
  const below = hint ? <span className="text-[11px] gp-muted">{hint}</span> : null;
  if (!label) {
    return (
      <span className={`flex flex-col gap-0.5 ${className}`}>
        {control}
        {below}
      </span>
    );
  }
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="gp-label">{label}</span>
      {control}
      {below}
    </label>
  );
}
