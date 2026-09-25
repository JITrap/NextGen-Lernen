import type { ReactNode } from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  /** Kleiner Hinweistext unter dem Label. */
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
}

/** Schalter (role=switch) mit optionalem Label; gesamte Zeile ist klickbar (≥ 36 px). */
export function Toggle({ checked, onChange, label, hint, icon, disabled, title, className = '' }: ToggleProps) {
  return (
    <label
      title={title}
      className={`flex min-h-[36px] cursor-pointer select-none items-center justify-between gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      {(label || icon) && (
        <span className="flex min-w-0 items-center gap-2 text-sm">
          {icon && <span className="inline-flex shrink-0 gp-muted" aria-hidden="true">{icon}</span>}
          <span className="min-w-0">
            <span className="block truncate">{label}</span>
            {hint && <span className="block text-[11px] gp-muted">{hint}</span>}
          </span>
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        style={{
          background: checked ? 'var(--gp-accent)' : 'color-mix(in srgb, var(--gp-muted) 35%, transparent)',
          borderColor: checked ? 'transparent' : 'var(--gp-border)',
        }}
      >
        <span
          className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(21px)' : 'translateX(2px)' }}
        />
      </button>
    </label>
  );
}
