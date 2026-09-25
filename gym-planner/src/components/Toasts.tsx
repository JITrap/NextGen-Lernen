import { memo } from 'react';
import { Info, CircleCheck, TriangleAlert, CircleX, X } from 'lucide-react';
import { useUiStore, type ToastMsg } from '@/store/uiStore';

const STYLE: Record<ToastMsg['kind'], { color: string; icon: React.ReactNode; label: string }> = {
  info: { color: 'var(--gp-accent)', icon: <Info size={16} />, label: 'Hinweis' },
  success: { color: 'var(--gp-ok)', icon: <CircleCheck size={16} />, label: 'Erfolg' },
  warning: { color: 'var(--gp-warn)', icon: <TriangleAlert size={16} />, label: 'Warnung' },
  error: { color: 'var(--gp-danger)', icon: <CircleX size={16} />, label: 'Fehler' },
};

const ToastItem = memo(function ToastItem({ t, onDismiss }: { t: ToastMsg; onDismiss: (id: string) => void }) {
  const s = STYLE[t.kind] ?? STYLE.info;
  return (
    <div
      role={t.kind === 'error' || t.kind === 'warning' ? 'alert' : 'status'}
      className="gp-panel pointer-events-auto flex max-w-[min(440px,calc(100vw-32px))] cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm shadow-lg"
      style={{ borderLeft: `4px solid ${s.color}` }}
      onClick={() => onDismiss(t.id)}
      title="Klicken zum Schließen"
    >
      <span className="mt-0.5 shrink-0" style={{ color: s.color }} aria-hidden="true">
        {s.icon}
      </span>
      <span className="sr-only">{s.label}: </span>
      <span className="min-w-0 flex-1 break-words">{t.text}</span>
      <button
        type="button"
        className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded gp-muted hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]"
        aria-label="Schließen"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(t.id);
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
});

/** Stapel der Benachrichtigungen unten Mitte (über der Statusleiste). Klick schließt. */
export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-10 z-[1300] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
