import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Hervorgehoben (z. B. Schalter „an“). */
  active?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  default: 'gp-btn',
  primary: 'gp-btn gp-btn-primary',
  ghost: 'gp-btn border-transparent bg-transparent',
  danger: 'gp-btn gp-danger',
};

/** Standard-Button (min. 36 px Zielhöhe, Tailwind + gp-btn). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon, active, className = '', children, type = 'button', ...rest },
  ref,
) {
  const sizeCls = size === 'sm' ? 'min-h-[32px] px-2 py-1 text-xs' : 'min-h-[36px]';
  return (
    <button
      ref={ref}
      type={type}
      className={`${VARIANT[variant]} ${sizeCls} ${active ? 'gp-btn-active' : ''} ${className}`}
      {...rest}
    >
      {icon && <span className="inline-flex shrink-0 items-center" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tooltip + aria-label (Pflicht, weil kein Text). */
  title: string;
  icon: ReactNode;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Kleine Zahl/Marke oben rechts (z. B. Undo-Zähler). */
  badge?: string | number | null;
  /** Sichtbarer Text neben dem Icon (optional, z. B. auf breiten Bildschirmen). */
  label?: string;
}

const ICON_SIZE = { sm: 'h-8 min-w-8 px-1.5', md: 'h-9 min-w-9 px-2', lg: 'h-11 min-w-11 px-2.5' };

/** Icon-Button mit Pflicht-Tooltip; Zielfläche ≥ 36 px (md). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { title, icon, active, size = 'md', badge, label, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={title}
      aria-label={label ? undefined : title}
      aria-pressed={active === undefined ? undefined : active}
      className={`relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors select-none disabled:cursor-not-allowed disabled:opacity-45 ${ICON_SIZE[size]} ${
        active ? 'gp-btn-active border-transparent' : 'border-transparent hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]'
      } ${className}`}
      style={active ? undefined : { color: 'var(--gp-text)' }}
      {...rest}
    >
      <span className="inline-flex items-center" aria-hidden="true">{icon}</span>
      {label && <span className="whitespace-nowrap">{label}</span>}
      {badge != null && badge !== '' && badge !== 0 && (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 rounded-full px-1 text-[9px] font-semibold leading-[14px] text-white"
          style={{ background: 'var(--gp-accent)', minWidth: 14 }}
          aria-hidden="true"
        >
          {badge}
        </span>
      )}
    </button>
  );
});

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: ReactNode;
  title?: string;
}

/** Segmentierte Auswahl (z. B. Rechteck/Polygon). */
export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  className = '',
  ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex overflow-hidden rounded-md border gp-border ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title ?? o.label}
            onClick={() => onChange(o.value)}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 px-2.5 text-xs font-medium transition-colors"
            style={active ? { background: 'var(--gp-accent)', color: 'white' } : { background: 'var(--gp-panel)', color: 'var(--gp-text)' }}
          >
            {o.icon && <span aria-hidden="true" className="inline-flex">{o.icon}</span>}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
