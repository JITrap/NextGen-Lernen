import type { ReactNode } from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: ReactNode;
  /** Anzeige des Werts rechts neben dem Label. */
  format?: (v: number) => string;
  disabled?: boolean;
  className?: string;
}

/** Schieberegler (natives range-Input, groß genug für Touch). */
export function Slider({ value, min, max, step = 1, onChange, label, format, disabled, className = '' }: SliderProps) {
  return (
    <label className={`flex flex-col gap-1 ${disabled ? 'opacity-50' : ''} ${className}`}>
      {(label || format) && (
        <span className="flex items-center justify-between text-sm">
          <span>{label}</span>
          {format && <span className="tabular-nums gp-muted">{format(value)}</span>}
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-full cursor-pointer"
        style={{ accentColor: 'var(--gp-accent)' }}
        aria-label={typeof label === 'string' ? label : undefined}
      />
    </label>
  );
}
