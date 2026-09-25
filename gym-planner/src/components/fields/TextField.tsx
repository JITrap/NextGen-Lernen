import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface TextFieldProps {
  value: string;
  /** Wird bei Enter/Blur (bzw. Strg+Enter bei mehrzeilig) mit geändertem Wert aufgerufen. */
  onChange: (v: string) => void;
  label?: ReactNode;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Mehrzeilig (Textarea, Strg+Enter übernimmt, Enter = Zeilenumbruch). */
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  /** Leerstring beim Übernehmen in Leerzeichen-freien Text wandeln (Standard true). */
  trim?: boolean;
  hint?: ReactNode;
  error?: string;
  compact?: boolean;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  name?: string;
  /** Sofortiges onChange bei jedem Tastendruck (für Formulare mit lokalem Zustand). */
  live?: boolean;
  title?: string;
}

/**
 * Textfeld mit Entwurf: Änderungen werden erst bei Enter/Blur übernommen (kein Undo-Schritt pro Tastendruck),
 * Esc verwirft. Mit `live` verhält es sich wie ein normales kontrolliertes Feld.
 */
export function TextField({
  value, onChange, label, ariaLabel, placeholder, disabled, readOnly, multiline, rows = 3, maxLength, trim = true, hint, error, compact,
  className = '', inputClassName = '', autoFocus, name, live, title,
}: TextFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = live ? value : (draft ?? value);

  const commit = () => {
    if (live || draft == null) return;
    const v = trim ? draft.trim() : draft;
    setDraft(null);
    if (v !== value) onChange(v);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDraft(null);
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
      e.currentTarget.blur();
    }
  };
  const common = {
    id,
    name,
    placeholder,
    disabled,
    readOnly,
    maxLength,
    title,
    'aria-label': label ? undefined : ariaLabel,
    'aria-invalid': error ? true : undefined,
    'data-autofocus': autoFocus ? 'true' : undefined,
    value: shown,
    onChange: (e: { target: { value: string } }) => (live ? onChange(e.target.value) : setDraft(e.target.value)),
    onBlur: commit,
    onKeyDown,
  };
  const cls = `gp-input ${compact ? 'h-8 py-0.5 text-xs' : multiline ? 'py-1.5' : 'min-h-[36px]'} ${error ? 'ring-2 ring-red-500/50' : ''} ${inputClassName}`;
  const control = multiline ? <textarea {...common} rows={rows} className={`${cls} resize-y leading-snug`} /> : <input {...common} type="text" autoComplete="off" className={cls} />;
  const below = error ? <span className="text-[11px] gp-danger">{error}</span> : hint ? <span className="text-[11px] gp-muted">{hint}</span> : null;
  if (!label) {
    return (
      <span className={`flex flex-col gap-0.5 ${className}`}>
        {control}
        {below}
      </span>
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
