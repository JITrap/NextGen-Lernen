import { useId, useRef, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

export const COLOR_PRESETS = [
  '#f59e0b', '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#14b8a6', '#ec4899', '#0ea5e9', '#8b5cf6', '#38bdf8',
  '#fb923c', '#84cc16', '#facc15', '#2dd4bf', '#94a3b8', '#78716c', '#1e293b', '#e5e7eb',
];

export interface ColorFieldProps {
  /** Aktuelle Farbe (#rrggbb). Bei undefined wird `fallback` angezeigt (z. B. Typfarbe). */
  value?: string;
  onChange: (hex: string) => void;
  /** Anzeige, wenn kein eigener Wert gesetzt ist. */
  fallback?: string;
  label?: ReactNode;
  ariaLabel?: string;
  presets?: string[];
  /** Zurücksetzen auf den Standard (z. B. „Typfarbe verwenden“) – Button erscheint nur, wenn ein eigener Wert gesetzt ist. */
  onReset?: () => void;
  resetLabel?: string;
  disabled?: boolean;
  hint?: ReactNode;
  className?: string;
}

function normalizeHex(v: string): string | null {
  const s = v.trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) return `#${m[1].toLowerCase()}`;
  const m3 = /^#?([0-9a-f]{3})$/i.exec(s);
  if (m3) return `#${m3[1].split('').map((c) => c + c).join('').toLowerCase()}`;
  return null;
}

/** Farbfeld (nativer Farbwähler) + Preset-Swatches + Hex-Eingabe; optional „Standard verwenden“. */
export function ColorField({ value, onChange, fallback = '#e5e7eb', label, ariaLabel, presets = COLOR_PRESETS, onReset, resetLabel = 'Standard verwenden', disabled, hint, className = '' }: ColorFieldProps) {
  const id = useId();
  const shown = value ?? fallback;
  const hexRef = useRef<HTMLInputElement>(null);
  const commitHex = () => {
    const el = hexRef.current;
    if (!el) return;
    const n = normalizeHex(el.value);
    if (n && n !== shown) onChange(n);
    else el.value = shown;
  };
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="gp-label">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-md border gp-border" style={{ background: shown }}>
          <input
            id={id}
            type="color"
            aria-label={typeof label === 'string' ? label : ariaLabel ?? 'Farbe'}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            value={shown}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
        <input
          ref={hexRef}
          key={shown}
          type="text"
          defaultValue={shown}
          disabled={disabled}
          aria-label="Farbe als Hex-Wert"
          className="gp-input h-9 w-24 font-mono text-xs uppercase"
          maxLength={7}
          spellCheck={false}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitHex();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.currentTarget.value = shown;
              e.currentTarget.blur();
            }
          }}
        />
        {onReset && value != null && (
          <button type="button" className="gp-btn h-9 px-2 text-xs" onClick={onReset} disabled={disabled} title={resetLabel}>
            <RotateCcw size={13} />
            <span className="truncate">{resetLabel}</span>
          </button>
        )}
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Farbvorgaben">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              title={c}
              aria-label={`Farbe ${c}`}
              aria-pressed={shown.toLowerCase() === c.toLowerCase()}
              onClick={() => onChange(c)}
              className="h-5 w-5 rounded-sm border transition-transform hover:scale-110 disabled:cursor-not-allowed"
              style={{ background: c, borderColor: shown.toLowerCase() === c.toLowerCase() ? 'var(--gp-text)' : 'rgba(0,0,0,0.15)', outline: shown.toLowerCase() === c.toLowerCase() ? '2px solid var(--gp-accent)' : undefined, outlineOffset: 1 }}
            />
          ))}
        </div>
      )}
      {hint && <span className="text-[11px] gp-muted">{hint}</span>}
    </div>
  );
}
