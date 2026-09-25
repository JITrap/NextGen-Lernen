import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';
import { KbdCombo } from './Kbd';

/* ------------------------------------------------------------------ */
/* Popover                                                             */
/* ------------------------------------------------------------------ */

export type PopoverAnchor = HTMLElement | { x: number; y: number } | null;
export type Placement = 'bottom-start' | 'bottom-end' | 'right-start' | 'top-start';

export interface PopoverProps {
  open: boolean;
  anchor: PopoverAnchor;
  onClose: () => void;
  placement?: Placement;
  offset?: number;
  className?: string;
  children: ReactNode;
  /** Bei Scrollen/Mausrad außerhalb schließen (Kontextmenü). */
  closeOnScroll?: boolean;
  role?: string;
  ariaLabel?: string;
}

const MARGIN = 8;

function isElement(a: PopoverAnchor): a is HTMLElement {
  return typeof HTMLElement !== 'undefined' && a instanceof HTMLElement;
}

/**
 * Schwebendes Panel (Portal, position: fixed). Wird an ein Element oder einen Punkt gehängt,
 * bleibt im Viewport (klemmt/klappt um) und schließt bei Klick außerhalb / Esc.
 */
export function Popover({ open, anchor, onClose, placement = 'bottom-start', offset = 6, className = '', children, closeOnScroll, role, ariaLabel }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const place = useCallback(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (isElement(anchor)) {
      const a = anchor.getBoundingClientRect();
      switch (placement) {
        case 'bottom-end':
          left = a.right - w;
          top = a.bottom + offset;
          break;
        case 'right-start':
          left = a.right + offset;
          top = a.top;
          if (left + w > vw - MARGIN) left = a.left - w - offset; // nach links umklappen
          break;
        case 'top-start':
          left = a.left;
          top = a.top - h - offset;
          break;
        default:
          left = a.left;
          top = a.bottom + offset;
      }
      if ((placement === 'bottom-start' || placement === 'bottom-end') && top + h > vh - MARGIN && a.top - h - offset >= MARGIN) top = a.top - h - offset;
    } else {
      left = anchor.x;
      top = anchor.y;
      if (left + w > vw - MARGIN) left = anchor.x - w;
      if (top + h > vh - MARGIN) top = anchor.y - h;
    }
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
    setPos({ left, top });
  }, [anchor, placement, offset]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place, children]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      t instanceof Node && ((ref.current?.contains(t) ?? false) || (isElement(anchor) && anchor.contains(t)));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
      }
    };
    const onScroll = (e: Event) => {
      if (!inside(e.target)) onCloseRef.current();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    if (closeOnScroll) {
      window.addEventListener('wheel', onScroll, { capture: true, passive: true });
      window.addEventListener('scroll', onScroll, true);
    }
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', onScroll, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, anchor, closeOnScroll]);

  if (!open || !anchor || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      className={`gp-panel fixed z-[1080] rounded-lg border shadow-xl ${className}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden', maxHeight: `calc(100vh - ${MARGIN * 2}px)`, overflowY: 'auto' }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Menü-Einträge                                                       */
/* ------------------------------------------------------------------ */

export interface MenuItemDef {
  label: string;
  icon?: ReactNode;
  /** Tastenkürzel-Anzeige, z. B. „Strg+D“. */
  kbd?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Häkchen (Schalter). */
  checked?: boolean;
  title?: string;
  onSelect?: () => void;
  /** Untermenü. */
  children?: MenuEntry[];
  /** Menü nach Auswahl offen lassen (z. B. Schalter). */
  keepOpen?: boolean;
}
export type MenuEntry = MenuItemDef | { separator: true } | { heading: string };

export function isSeparator(e: MenuEntry): e is { separator: true } {
  return 'separator' in e;
}
export function isHeading(e: MenuEntry): e is { heading: string } {
  return 'heading' in e;
}

function SubMenu({ entries, onClose, side }: { entries: MenuEntry[]; onClose: () => void; side: 'right' | 'left' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const over = r.bottom - (window.innerHeight - MARGIN);
    setShift(over > 0 ? -Math.min(over, r.top - MARGIN) : 0);
  }, [entries]);
  return (
    <div
      ref={ref}
      className="gp-panel absolute top-0 z-10 rounded-lg border shadow-xl"
      style={{ [side === 'right' ? 'left' : 'right']: '100%', transform: `translateY(${shift}px)` }}
    >
      <MenuList entries={entries} onClose={onClose} />
    </div>
  );
}

/**
 * Menüliste mit Trennern, Überschriften, Häkchen, Kürzeln und Untermenüs.
 * Tastatur: ↑/↓ Fokus, → Untermenü öffnen, ← schließen, Enter/Leertaste auswählen.
 */
export function MenuList({ entries, onClose, className = '', minWidth = 200 }: { entries: MenuEntry[]; onClose: () => void; className?: string; minWidth?: number }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<number | null>(null);
  const [side, setSide] = useState<'right' | 'left'>('right');

  const openSubmenu = (i: number) => {
    const r = listRef.current?.getBoundingClientRect();
    setSide(r && r.right + 220 > window.innerWidth ? 'left' : 'right');
    setOpenSub(i);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(':scope > [role="menuitem"]:not([disabled]), :scope > div > [role="menuitem"]:not([disabled])') ?? []);
    if (!items.length) return;
    const idx = items.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1 + items.length) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'ArrowRight') {
      const i = Number((document.activeElement as HTMLElement | null)?.dataset.index ?? -1);
      const en = entries[i];
      if (en && !isSeparator(en) && !isHeading(en) && en.children) {
        e.preventDefault();
        e.stopPropagation();
        openSubmenu(i);
      }
    } else if (e.key === 'ArrowLeft') {
      if (openSub != null) {
        e.preventDefault();
        e.stopPropagation();
        setOpenSub(null);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  };

  return (
    <div ref={listRef} role="menu" className={`py-1 text-sm ${className}`} style={{ minWidth }} onKeyDown={onKeyDown}>
      {entries.map((en, i) => {
        if (isSeparator(en)) return <div key={`sep-${i}`} role="separator" className="my-1 border-t gp-border" />;
        if (isHeading(en))
          return (
            <div key={`h-${i}`} className="truncate px-3 pb-1 pt-1.5 gp-label" title={en.heading}>
              {en.heading}
            </div>
          );
        const hasSub = !!en.children?.length;
        const row = (
          <button
            type="button"
            role="menuitem"
            data-index={i}
            disabled={en.disabled}
            title={en.title}
            aria-haspopup={hasSub ? 'menu' : undefined}
            aria-expanded={hasSub ? openSub === i : undefined}
            className={`flex min-h-[36px] w-full items-center gap-2.5 px-3 py-1.5 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45 hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)] focus-visible:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)] ${
              en.danger ? 'gp-danger' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasSub) {
                if (openSub === i) setOpenSub(null); else openSubmenu(i);
                return;
              }
              en.onSelect?.();
              if (!en.keepOpen) onClose();
            }}
            onMouseEnter={() => {
              if (hasSub) openSubmenu(i);
              else if (openSub != null) setOpenSub(null);
            }}
          >
            <span className="inline-flex w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {en.checked ? <Check size={15} /> : en.icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{en.label}</span>
            {en.kbd && !hasSub && (
              <span className="ml-3 shrink-0 gp-muted">
                <KbdCombo combo={en.kbd} />
              </span>
            )}
            {hasSub && <ChevronRight size={14} className="shrink-0 gp-muted" aria-hidden="true" />}
          </button>
        );
        if (!hasSub) return <div key={`i-${i}`}>{row}</div>;
        return (
          <div key={`i-${i}`} className="relative" onMouseLeave={() => setOpenSub((s) => (s === i ? null : s))}>
            {row}
            {openSub === i && en.children && <SubMenu entries={en.children} onClose={onClose} side={side} />}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dropdown                                                            */
/* ------------------------------------------------------------------ */

export interface DropdownProps {
  /** Auslöser; bekommt Zustand und Toggle. Muss ein einzelnes Element sein. */
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  /** Menüeinträge – oder eigener Inhalt über `children`. */
  entries?: MenuEntry[];
  children?: (close: () => void) => ReactNode;
  placement?: Placement;
  className?: string;
  ariaLabel?: string;
  /** Steuerung von außen (optional). */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

/** Auslöser + Popover-Menü. Klick außerhalb / Esc schließt, ↑/↓ navigiert. */
export function Dropdown({ trigger, entries, children, placement = 'bottom-start', className = '', ariaLabel, open: controlled, onOpenChange }: DropdownProps) {
  const [internal, setInternal] = useState(false);
  const open = controlled ?? internal;
  const setOpen = useCallback(
    (v: boolean) => {
      setInternal(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) setAnchor(wrapRef.current);
  }, [open]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  // Erstes Element fokussieren, wenn per Tastatur geöffnet
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const first = document.querySelector<HTMLElement>('[data-gp-dropdown-open="true"] [role="menuitem"]:not([disabled])');
      if (first && wrapRef.current?.contains(document.activeElement)) first.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <>
      <span ref={wrapRef} className="inline-flex">
        {trigger({ open, toggle: () => setOpen(!open) })}
      </span>
      <Popover open={open} anchor={anchor} onClose={close} placement={placement} ariaLabel={ariaLabel} className={className}>
        <div data-gp-dropdown-open={open ? 'true' : undefined}>{entries ? <MenuList entries={entries} onClose={close} /> : children?.(close)}</div>
      </Popover>
    </>
  );
}
