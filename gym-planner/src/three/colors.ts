/**
 * Farbzuordnung der 3D-Vorschau (reine Daten, keine three-Abhängigkeit).
 */
import type { DoorType, FloorCovering, LibraryArea, WallType } from '@/types';

/** Farbe je Bibliotheks-Bereich (Kraft blau-grau, Cardio rot, Umkleide cyan, Wellness orange, Möbel neutral, Bauelemente dunkel). */
export const AREA_COLORS: Record<LibraryArea, string> = {
  'Kraftgeräte': '#5f7a99',
  'Freihantel-Zubehör': '#7b8fa6',
  'Cardio': '#ef4444',
  'Functional': '#22c55e',
  'Empfang & Lounge': '#14b8a6',
  'Umkleide': '#06b6d4',
  'Sanitär': '#38bdf8',
  'Wellness': '#f97316',
  'Kursraum': '#a855f7',
  'Büro & Personal': '#a3a3a3',
  'Lager & Technik': '#78716c',
  'Ausstattung': '#a8a29e',
  'Bauelemente': '#374151',
  'Eigene': '#8b5cf6',
};
export const FALLBACK_ITEM_COLOR = '#9ca3af';

export function areaColor(area: LibraryArea | string | undefined): string {
  if (!area) return FALLBACK_ITEM_COLOR;
  return (AREA_COLORS as Record<string, string>)[area] ?? FALLBACK_ITEM_COLOR;
}

/** Bereiche, die als „Möbel“ gelten (Ebene „Möbel“ in der 2D-Ansicht). */
export const FURNITURE_AREAS: ReadonlySet<string> = new Set<LibraryArea>([
  'Empfang & Lounge', 'Umkleide', 'Sanitär', 'Wellness', 'Kursraum', 'Büro & Personal', 'Lager & Technik', 'Ausstattung',
]);

/** Bodenfarbe je Belag. */
export const FLOOR_COVERING_COLORS: Record<string, string> = {
  'Gummiboden': '#3f3f46',
  'Kautschuk': '#44403c',
  'Vinyl/PVC': '#9ca3af',
  'Kunstrasen': '#4d9a3a',
  'Parkett': '#b8864e',
  'Holz': '#c19a6b',
  'Fliesen': '#d4d4d8',
  'Beton': '#a1a1aa',
  'Teppich': '#6b7280',
  'Epoxid': '#94a3b8',
};
export const FALLBACK_FLOOR_COLOR = '#a8a29e';

export function floorCoveringColor(covering: FloorCovering | undefined | null): string {
  if (!covering) return FALLBACK_FLOOR_COLOR;
  return FLOOR_COVERING_COLORS[covering] ?? FALLBACK_FLOOR_COLOR;
}

export interface WallAppearance {
  color: string;
  opacity: number;
}

/** Wandfarbe je Typ; Glaswand transparent hellblau. Dunkelmodus etwas gedämpfter. */
export function wallAppearance(type: WallType | string, dark: boolean): WallAppearance {
  switch (type) {
    case 'Glaswand':
      return { color: '#7dd3fc', opacity: 0.35 };
    case 'Trennwand/Netz':
      return { color: '#86efac', opacity: 0.55 };
    case 'Mauerwerk':
      return { color: dark ? '#a89f94' : '#d6cfc4', opacity: 1 };
    case 'Außenwand':
      return { color: dark ? '#9aa6b8' : '#cbd5e1', opacity: 1 };
    case 'Brüstung':
      return { color: dark ? '#a3aebf' : '#d1d9e4', opacity: 1 };
    default:
      return { color: dark ? '#b4bccb' : '#e2e8f0', opacity: 1 };
  }
}

export interface DoorAppearance {
  color: string;
  opacity: number;
}

export function doorAppearance(type: DoorType | string): DoorAppearance {
  switch (type) {
    case 'Glastür':
      return { color: '#7dd3fc', opacity: 0.4 };
    case 'Notausgang':
      return { color: '#16a34a', opacity: 1 };
    case 'Schiebetür':
      return { color: '#94a3b8', opacity: 0.95 };
    case 'Rolltor':
      return { color: '#6b7280', opacity: 1 };
    default:
      return { color: '#b08968', opacity: 1 };
  }
}

export const GLASS_COLOR = '#7dd3fc';
export const GLASS_OPACITY = 0.35;
export const MIRROR_COLOR = '#dbeafe';
export const SAFETY_ZONE_COLOR = '#f59e0b';
export const SAFETY_ZONE_OPACITY = 0.28;
export const SELECTION_EMISSIVE = '#2563eb';
export const ELEVATOR_COLOR = '#475569';
export const ELEVATOR_DOOR_COLOR = '#94a3b8';
export const STAIRS_COLOR = '#6b7280';
export const LANDING_COLOR = '#9ca3af';
export const COLUMN_COLOR = '#4b5563';
export const CEILING_COLOR = '#e5e7eb';
export const CEILING_COLOR_DARK = '#94a3b8';
export const DOOR_FRAME_COLOR = '#9ca3af';

/** Hintergrund/Himmel je Theme. */
export function backgroundColor(dark: boolean): string {
  return dark ? '#111827' : '#e8ecf1';
}
export function gridColors(dark: boolean): { cell: string; section: string } {
  return dark ? { cell: '#2b364a', section: '#465469' } : { cell: '#cfd8e3', section: '#a3b1c2' };
}
