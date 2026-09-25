import type { ReactNode, SelectHTMLAttributes } from 'react';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'size'> {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  label?: ReactNode;
  /** Kompakt (Kopfleiste). */
  compact?: boolean;
}

/**
 * Natives Select (Tastatur/Touch-tauglich). Der Wert wird typsicher über die Optionsliste zurückgegeben
 * (Zahlen bleiben Zahlen).
 */
export function Select<T extends string | number>({ value, options, onChange, label, compact, className = '', title, ...rest }: SelectProps<T>) {
  const control = (
    <select
      className={`gp-input ${compact ? 'h-8 w-auto py-0 text-xs' : 'min-h-[36px]'} cursor-pointer ${className}`}
      value={String(value)}
      title={title}
      aria-label={typeof label === 'string' ? label : title}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
      {...rest}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (!label) return control;
  return (
    <label className="flex flex-col gap-1">
      <span className="gp-label">{label}</span>
      {control}
    </label>
  );
}
