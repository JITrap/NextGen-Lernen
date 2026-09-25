import { create } from 'zustand';

type WithHelpers<T> = T & { reset: () => void; patch: (p: Partial<T>) => void };

/**
 * Kleiner Helfer für transienten Werkzeug-Zustand (z. B. aktuelle Wandkette),
 * damit Overlay-Komponenten reaktiv darauf zugreifen können.
 */
export function createToolStore<T extends object>(initial: T) {
  return create<WithHelpers<T>>()((set) => ({
    ...initial,
    reset: () => set({ ...initial } as Partial<WithHelpers<T>>),
    patch: (p) => set(p as Partial<WithHelpers<T>>),
  }));
}
