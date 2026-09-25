import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, IconButton } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Maximale Breite in px. */
  width?: number;
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modaler Dialog: Backdrop (Klick schließt), Esc schließt, Fokus wandert in den Dialog und kehrt danach zurück,
 * Tab bleibt im Dialog. Tastendrücke im Dialog erreichen die globalen Kürzel nicht.
 */
export function Modal({ open, onClose, title, children, footer, width = 480, className = '' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  // Fokus verwalten (nur abhängig von open)
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const auto = panel.querySelector<HTMLElement>('[data-autofocus]');
      const first = auto ?? panel.querySelector<HTMLElement>('input, select, textarea') ?? panel.querySelector<HTMLElement>('[data-primary]');
      (first ?? panel).focus();
      if (first instanceof HTMLInputElement && first.type === 'text') first.select();
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus();
    };
  }, [open]);

  // Esc + Fokusfalle
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const els = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 23, 0.5)' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`gp-panel flex max-h-[90vh] w-full flex-col rounded-xl border shadow-2xl outline-none ${className}`}
        style={{ maxWidth: width }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 gp-border">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <IconButton title="Schließen" icon={<X size={18} />} onClick={onClose} data-close="true" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 gp-border">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bestätigungsdialog („Wirklich löschen?“). */
export function ConfirmDialog({ open, title, message, confirmLabel = 'OK', cancelLabel = 'Abbrechen', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            data-primary="true"
            data-autofocus="true"
            onClick={onConfirm}
            style={danger ? { background: 'var(--gp-danger)', color: 'white', borderColor: 'transparent' } : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm">{message}</div>
    </Modal>
  );
}

export interface PromptDialogProps {
  open: boolean;
  title: ReactNode;
  label?: ReactNode;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Rückgabe eines Fehlertexts blockiert das Absenden. */
  validate?: (v: string) => string | null;
  onSubmit: (v: string) => void;
  onCancel: () => void;
  /** Hilfetext unter dem Feld. */
  hint?: ReactNode;
  inputMode?: 'text' | 'decimal' | 'numeric';
}

/** Eingabedialog (Ersatz für window.prompt). */
export function PromptDialog({ open, title, label, initial = '', placeholder, confirmLabel = 'Übernehmen', validate, onSubmit, onCancel, hint, inputMode = 'text' }: PromptDialogProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setValue(initial);
      setError(null);
    }
  }, [open, initial]);
  const submit = () => {
    const err = validate ? validate(value) : null;
    if (err) {
      setError(err);
      return;
    }
    onSubmit(value);
  };
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <Button onClick={onCancel}>Abbrechen</Button>
          <Button variant="primary" data-primary="true" onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {label && <span className="gp-label">{label}</span>}
        <input
          data-autofocus="true"
          className="gp-input min-h-[36px]"
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error ? <span className="text-xs gp-danger">{error}</span> : hint ? <span className="text-xs gp-muted">{hint}</span> : null}
      </form>
    </Modal>
  );
}
