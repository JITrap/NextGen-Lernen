import { useEffect, useState, type RefObject } from 'react';

/** Reaktive Media-Query (SSR-/jsdom-sicher: ohne matchMedia immer false). */
export function useMediaQuery(query: string): boolean {
  const read = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
  const [matches, setMatches] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    return undefined;
  }, [query]);
  return matches;
}

/** Grobe Zeigereingabe (Tablet/Touch) → größere Zielflächen. */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/**
 * Schließt bei Klick/Tipp außerhalb der angegebenen Elemente und bei Esc.
 * `active` steuert, ob die Listener registriert sind.
 */
export function useOutsideClose(
  refs: Array<RefObject<HTMLElement | null>>,
  onClose: () => void,
  active: boolean,
  opts: { closeOnScroll?: boolean } = {},
) {
  useEffect(() => {
    if (!active) return;
    const inside = (t: EventTarget | null) => refs.some((r) => r.current && t instanceof Node && r.current.contains(t));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onScroll = (e: Event) => {
      if (!inside(e.target)) onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    if (opts.closeOnScroll) {
      window.addEventListener('wheel', onScroll, { capture: true, passive: true });
      window.addEventListener('scroll', onScroll, true);
    }
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', onScroll, true);
      window.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onClose, opts.closeOnScroll, ...refs]);
}

/** Datum/Uhrzeit kurz formatiert („25.09.2026, 14:03“). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
