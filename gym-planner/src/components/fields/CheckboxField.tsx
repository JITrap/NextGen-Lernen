import { useId, type ReactNode } from 'react';

export interface CheckboxFieldProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Unbestimmt (teilweise ausgewählt). */
  indeterminate?: boolean;
  name?: string;
}

/** Beschriftete Checkbox (native, Touch-freundliche Zeile ≥ 32 px). */
export function CheckboxField({ checked, onChange, label, hint, disabled, title, className = '', indeterminate, name }: CheckboxFieldProps) {
  const id = useId();
  return (
    <label htmlFor={id} title={title} className={`flex min-h-[32px] cursor-pointer select-none items-start gap-2 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}>
      <input
        id={id}
        name={name}
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--gp-accent)] disabled:cursor-not-allowed"
        checked={checked}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate && !checked;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block leading-tight">{label}</span>
        {hint && <span className="block text-[11px] gp-muted">{hint}</span>}
      </span>
    </label>
  );
}
