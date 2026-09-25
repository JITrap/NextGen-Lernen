import { parseLength } from '@/geometry/units';
import { NumberField, type NumberFieldProps } from './NumberField';

export interface LengthFieldProps extends Omit<NumberFieldProps, 'parse' | 'unit' | 'value' | 'onChange'> {
  /** Wert in cm. */
  value: number | null;
  onChange: (cm: number | null) => void;
  /** Einheit ohne Angabe in der Eingabe (Standard cm). */
  defaultUnit?: 'cm' | 'm';
}

/**
 * Längenfeld: intern cm, Eingabe auch mit Einheit („3,5 m“, „350“, „12,5 cm“, „120mm“) über parseLength.
 * Zeigt immer cm an. ↑/↓ ändern um `step` cm (Standard 1), Shift ×10.
 */
export function LengthField({ value, onChange, defaultUnit = 'cm', step = 1, decimals = 1, ...rest }: LengthFieldProps) {
  return <NumberField value={value} onChange={onChange} unit="cm" step={step} decimals={decimals} parse={(s) => parseLength(s, defaultUnit)} {...rest} />;
}
