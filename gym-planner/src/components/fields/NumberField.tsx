import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { parseNumber } from '@/geometry/units';

/**
 * Anzeigeformat ohne Tausendertrennzeichen (sonst würde „1.250“ als 1,25 gelesen), Komma als Dezimaltrennzeichen,
 * ohne nachlaufende Nullen. Zeigt bis zu max(decimals, 2) Stellen, damit z. B. 12,5 in einem 0-Stellen-Feld
 * nicht als „13“ erscheint (übernommen wird nur, was der Nutzer tatsächlich ändert).
 */
export function formatPlain(v: number, decimals = 2): string {
  const d = Math.max(0, Math.min(6, decimals));
  const f = 10 ** d;
  let r = Math.round((v + Number.EPSILON * Math.sign(v)) * f) / f;
  if (Object.is(r, -0)) r = 0;
  let s = r.toFixed(d);
  if (d > 0) s = s.replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

export interface NumberFieldProps {
  /** Aktueller Wert; null = leer (nur sinnvoll mit allowEmpty). */
  value: number | null;
  /** Wird nur bei Enter/Blur/Pfeiltasten mit einem gültigen, geänderten Wert aufgerufen. null nur bei allowEmpty. */
  onChange: (v: number | null) => void;
  label?: ReactNode;
  /** Einheit rechts im Feld („cm“, „kg“, „°“, „€“). */
  unit?: string;
  /** Schrittweite für ↑/↓ (Shift = 10×). Ohne step keine Pfeiltasten-Änderung. */
  step?: number;
  min?: number;
  max?: number;
  /** Nachkommastellen in der Anzeige (Standard 2). */
  decimals?: number;
  /** Nur ganze Zahlen (rundet beim Übernehmen). */
  integer?: boolean;
  /** Leere Eingabe erlaubt → onChange(null). */
  allowEmpty?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  /** Pflicht, wenn kein sichtbares Label vorhanden ist. */
  ariaLabel?: string;
  title?: string;
  /** Eigener Parser (z. B. parseLength für „3,5 m“). Standard: parseNumber. */
  parse?: (s: string) => number | null;
  /** Eigene Anzeige-Formatierung (ohne Einheit). */
  format?: (v: number) => string;
  /** Hilfetext unter dem Feld. */
  hint?: ReactNode;
  /** Fehlertext (rot) unter dem Feld. */
  error?: string;
  /** Kompakte Höhe (Listen, Tabellen). */
  compact?: boolean;
  className?: string;
  inputClassName?: string;
  /** Beim Fokussieren gesamten Text markieren (Standard true). */
  selectOnFocus?: boolean;
  /** Fokus beim Öffnen eines Dialogs (data-autofocus). */
  autoFocus?: boolean;
  name?: string;
}

function clamp(v: number, min?: number, max?: number): number {
  let r = v;
  if (min != null && r < min) r = min;
  if (max != null && r > max) r = max;
  return r;
}

/**
 * Zahlenfeld: Komma und Punkt als Dezimaltrennzeichen, Einheit als Suffix, Enter/Blur übernimmt,
 * Esc verwirft, ↑/↓ ändert um `step` (Shift: 10 × step) und übernimmt sofort. Ungültige Eingaben fallen
 * auf den letzten gültigen Wert zurück; min/max werden geklemmt. Während des Tippens wird kein onChange
 * ausgelöst (keine Undo-Schritte pro Tastendruck).
 */
export function NumberField({
  value, onChange, label, unit, step, min, max, decimals = 2, integer, allowEmpty, disabled, readOnly, placeholder, ariaLabel, title,
  parse = parseNumber, format, hint, error, compact, className = '', inputClassName = '', selectOnFocus = true, autoFocus, name,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  /** Text beim Fokussieren – unveränderter Text wird beim Verlassen nicht übernommen (keine Rundungsänderung). */
  const focusText = useRef<string | null>(null);
  const fmt = (v: number) => (format ? format(v) : formatPlain(v, integer ? 0 : Math.max(decimals, 2)));
  const shown = value == null ? '' : fmt(value);

  const normalize = (v: number): number => {
    const r = integer ? Math.round(v) : v;
    return clamp(r, min, max);
  };

  const commit = () => {
    if (draft == null) return;
    const text = draft.trim();
    const unchanged = draft === focusText.current;
    focusText.current = null;
    setDraft(null);
    if (unchanged) return;
    if (!text) {
      if (allowEmpty && value != null) onChange(null);
      return;
    }
    const parsed = parse(text);
    if (parsed == null || !Number.isFinite(parsed)) return;
    const v = normalize(parsed);
    if (value == null || Math.abs(v - value) > 1e-9) onChange(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDraft(null);
      focusText.current = null;
      e.currentTarget.blur();
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && step && !readOnly && !disabled) {
      e.preventDefault();
      const base = draft != null && draft.trim() ? parse(draft.trim()) : value;
      const cur = base ?? min ?? 0;
      const delta = step * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      const v = normalize(cur + delta);
      // Fließkomma-Rauschen bei Schritten wie 0,5 vermeiden
      const rounded = Math.round(v * 1e6) / 1e6;
      setDraft(fmt(rounded));
      if (value == null || Math.abs(rounded - value) > 1e-9) onChange(rounded);
    }
  };

  const control = (
    <span className="relative inline-flex w-full items-center">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`gp-input tabular-nums ${compact ? 'h-8 py-0.5 text-xs' : 'min-h-[36px]'} ${unit ? 'pr-9' : ''} ${error ? 'ring-2 ring-red-500/50' : ''} ${inputClassName}`}
        value={draft ?? shown}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        title={title}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        data-autofocus={autoFocus ? 'true' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          if (readOnly) return;
          setDraft(shown);
          focusText.current = shown;
          if (selectOnFocus) e.target.select();
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {unit && <span className="pointer-events-none absolute right-2 text-[11px] gp-muted">{unit}</span>}
    </span>
  );

  const below = error ? <span className="text-[11px] gp-danger">{error}</span> : hint ? <span className="text-[11px] gp-muted">{hint}</span> : null;
  if (!label) {
    return below ? (
      <span className={`flex flex-col gap-0.5 ${className}`}>
        {control}
        {below}
      </span>
    ) : (
      <span className={`inline-flex w-full ${className}`}>{control}</span>
    );
  }
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="gp-label">
        {label}
      </label>
      {control}
      {below}
    </div>
  );
}
