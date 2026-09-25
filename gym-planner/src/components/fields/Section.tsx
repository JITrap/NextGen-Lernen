import { useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SectionStore {
  open: Record<string, boolean>;
  toggle: (key: string, fallback: boolean) => void;
  set: (key: string, v: boolean) => void;
}

/** Gemerkter Auf-/Zuklapp-Zustand aller Abschnitte (per storageKey), überlebt Neuladen. */
export const useSectionStore = create<SectionStore>()(
  persist(
    (set) => ({
      open: {},
      toggle: (key, fallback) => set((s) => ({ open: { ...s.open, [key]: !(s.open[key] ?? fallback) } })),
      set: (key, v) => set((s) => ({ open: { ...s.open, [key]: v } })),
    }),
    { name: 'gymplanner-sections', partialize: (s) => ({ open: s.open }) },
  ),
);

export interface SectionProps {
  title: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  /** Rechts im Kopf (Zähler, Marke, Aktion). */
  badge?: ReactNode;
  /** Schlüssel zum Merken des Zustands (ohne: lokaler Zustand). */
  storageKey?: string;
  defaultOpen?: boolean;
  /** Von außen gesteuert. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** Nicht zuklappbar (nur Überschrift). */
  collapsible?: boolean;
  /** Ton der Überschrift. */
  tone?: 'default' | 'warn' | 'danger';
  className?: string;
  bodyClassName?: string;
  /** Kompakter Kopf. */
  dense?: boolean;
}

/** Aufklappbare Gruppe mit Titel, Icon und optionaler Marke; Zustand optional gemerkt (storageKey). */
export function Section({ title, children, icon, badge, storageKey, defaultOpen = true, open: controlled, onToggle, collapsible = true, tone = 'default', className = '', bodyClassName = '', dense }: SectionProps) {
  const stored = useSectionStore((s) => (storageKey ? s.open[storageKey] : undefined));
  const toggleStored = useSectionStore((s) => s.toggle);
  const [local, setLocal] = useState(defaultOpen);
  const open = !collapsible ? true : controlled ?? (storageKey ? (stored ?? defaultOpen) : local);
  const toggle = () => {
    if (!collapsible) return;
    const next = !open;
    if (onToggle) onToggle(next);
    if (controlled !== undefined) return;
    if (storageKey) toggleStored(storageKey, defaultOpen);
    else setLocal(next);
  };
  const color = tone === 'warn' ? 'var(--gp-warn)' : tone === 'danger' ? 'var(--gp-danger)' : 'var(--gp-accent)';
  const Head = collapsible ? 'button' : 'div';
  return (
    <section className={`border-b gp-border ${className}`}>
      <Head
        {...(collapsible ? { type: 'button', onClick: toggle, 'aria-expanded': open } : {})}
        className={`flex w-full items-center gap-2 px-3 text-left text-sm font-semibold ${dense ? 'py-1.5' : 'py-2.5'} ${collapsible ? 'transition-colors hover:bg-[color-mix(in_srgb,var(--gp-accent)_8%,transparent)]' : ''}`}
      >
        {collapsible && (open ? <ChevronDown size={16} className="shrink-0 gp-muted" aria-hidden="true" /> : <ChevronRight size={16} className="shrink-0 gp-muted" aria-hidden="true" />)}
        {icon && (
          <span className="shrink-0" style={{ color }} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {badge != null && <span className="shrink-0 text-xs font-normal gp-muted">{badge}</span>}
      </Head>
      {open && <div className={`space-y-3 px-3 pb-3 ${bodyClassName}`}>{children}</div>}
    </section>
  );
}
