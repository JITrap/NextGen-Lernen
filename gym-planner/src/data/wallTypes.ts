import type { WallType, DoorType } from '@/types';

export const WALL_THICKNESSES = [10, 12.5, 17.5, 24, 30, 36.5];

export interface WallTypeInfo {
  type: WallType;
  color: string;
  /** Muster für die Draufsicht. */
  pattern: 'solid' | 'hatch' | 'glass' | 'dashed' | 'net';
  defaultThickness: number;
  /** Standardhöhe (null = raumhoch) */
  defaultHeight: number | null;
}

export const WALL_TYPES: WallTypeInfo[] = [
  { type: 'Außenwand', color: '#1e293b', pattern: 'solid', defaultThickness: 24, defaultHeight: null },
  { type: 'Trockenbau', color: '#475569', pattern: 'solid', defaultThickness: 12.5, defaultHeight: null },
  { type: 'Mauerwerk', color: '#334155', pattern: 'hatch', defaultThickness: 17.5, defaultHeight: null },
  { type: 'Glaswand', color: '#38bdf8', pattern: 'glass', defaultThickness: 10, defaultHeight: null },
  { type: 'Brüstung', color: '#64748b', pattern: 'dashed', defaultThickness: 12.5, defaultHeight: 110 },
  { type: 'Trennwand/Netz', color: '#22c55e', pattern: 'net', defaultThickness: 10, defaultHeight: 300 },
];
export const WALL_TYPE_MAP = Object.fromEntries(WALL_TYPES.map((w) => [w.type, w])) as Record<WallType, WallTypeInfo>;

export const DOOR_WIDTHS = [80, 90, 100, 125, 150, 200, 250, 300];

export interface DoorTypeInfo {
  type: DoorType;
  defaultWidth: number;
  defaultHeight: number;
  /** Hat Schwenkbereich */
  swings: boolean;
  /** Zweiflügelig: zwei Schwenkbögen */
  leaves: 1 | 2;
  emergency?: boolean;
}

export const DOOR_TYPES: DoorTypeInfo[] = [
  { type: 'einflügelig', defaultWidth: 90, defaultHeight: 210, swings: true, leaves: 1 },
  { type: 'zweiflügelig', defaultWidth: 200, defaultHeight: 210, swings: true, leaves: 2 },
  { type: 'Schiebetür', defaultWidth: 125, defaultHeight: 210, swings: false, leaves: 1 },
  { type: 'Glastür', defaultWidth: 90, defaultHeight: 210, swings: true, leaves: 1 },
  { type: 'Notausgang', defaultWidth: 100, defaultHeight: 210, swings: true, leaves: 1, emergency: true },
  { type: 'Rolltor', defaultWidth: 300, defaultHeight: 300, swings: false, leaves: 1 },
];
export const DOOR_TYPE_MAP = Object.fromEntries(DOOR_TYPES.map((d) => [d.type, d])) as Record<DoorType, DoorTypeInfo>;

export const WINDOW_DEFAULT = { width: 120, height: 120, sillHeight: 90 };
export const MIRROR_DEFAULT = { width: 200, height: 200 };
