import type { ReactNode } from 'react';

/** Tastenkappe („Strg“, „Z“, „Entf“ …). */
export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <kbd className={`gp-kbd whitespace-nowrap ${className}`}>{children}</kbd>;
}

/** Kombination wie „Strg + Z“ – Teile durch „+“ getrennt, jedes als eigene Kappe. */
export function KbdCombo({ combo }: { combo: string }) {
  const parts = combo.split('+').map((p) => p.trim()).filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <span className="gp-muted text-[10px]">+</span>}
          <Kbd>{p}</Kbd>
        </span>
      ))}
    </span>
  );
}
