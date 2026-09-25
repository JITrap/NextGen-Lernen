import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { parseNumber } from '@/geometry/units';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (v: string) => void;
  label?: ReactNode;
}

/** Textfeld mit optionalem Label. */
export function TextInput({ value, onChange, label, className = '', ...rest }: TextInputProps) {
  const control = <input type="text" className={`gp-input min-h-[36px] ${className}`} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
  if (!label) return control;
  return (
    <label className="flex flex-col gap-1">
      <span className="gp-label">{label}</span>
      {control}
    </label>
  );
}

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'min' | 'max' | 'step'> {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: ReactNode;
  /** Einheit rechts im Feld („cm“, „kg/m²“). */
  unit?: string;
  decimals?: number;
}

/**
 * Zahlenfeld mit Komma/Punkt-Eingabe: Der Wert wird erst bei Enter/Blur übernommen (kein Flackern beim Tippen),
 * ungültige Eingaben fallen auf den letzten gültigen Wert zurück; min/max werden geklemmt.
 */
export function NumberInput({ value, onChange, min, max, step, label, unit, decimals = 2, className = '', ...rest }: NumberInputProps) {
  const fmt = (v: number) => String(Math.round(v * 10 ** decimals) / 10 ** decimals).replace('.', ',');
  const [text, setText] = useState(() => fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);
  const commit = () => {
    const n = parseNumber(text);
    if (n == null) {
      setText(fmt(value));
      return;
    }
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    setText(fmt(v));
    if (v !== value) onChange(v);
  };
  const control = (
    <span className="relative inline-flex w-full items-center">
      <input
        type="text"
        inputMode="decimal"
        className={`gp-input min-h-[36px] tabular-nums ${unit ? 'pr-12' : ''} ${className}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setText(fmt(value));
            (e.target as HTMLInputElement).blur();
          } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && step) {
            e.preventDefault();
            const cur = parseNumber(text) ?? value;
            let v = cur + (e.key === 'ArrowUp' ? step : -step);
            if (min != null) v = Math.max(min, v);
            if (max != null) v = Math.min(max, v);
            setText(fmt(v));
            onChange(v);
          }
        }}
        {...rest}
      />
      {unit && <span className="pointer-events-none absolute right-2 text-xs gp-muted">{unit}</span>}
    </span>
  );
  if (!label) return control;
  return (
    <label className="flex flex-col gap-1">
      <span className="gp-label">{label}</span>
      {control}
    </label>
  );
}
