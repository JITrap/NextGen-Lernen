import type { ReactNode } from 'react';

/**
 * Einfacher, title-basierter Tooltip (nativ, barrierearm, ohne Portal).
 * Für Icon-Buttons reicht das `title`-Attribut des Buttons; dieser Wrapper ist für beliebige Kinder.
 */
export function Tooltip({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <span title={title} className={`inline-flex ${className}`}>
      {children}
    </span>
  );
}
