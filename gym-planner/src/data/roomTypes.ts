import type { RoomType } from '@/types';

export type AreaClass = 'Trainingsfläche' | 'Wellness' | 'Umkleide/Sanitär' | 'Nebenfläche' | 'Verkehrsfläche';

export interface RoomTypeInfo {
  type: RoomType;
  color: string;
  /** Flächenklasse für die Flächenbilanz. */
  areaClass: AreaClass;
}

export const ROOM_TYPES: RoomTypeInfo[] = [
  { type: 'Trainingsfläche Freihantel', color: '#f59e0b', areaClass: 'Trainingsfläche' },
  { type: 'Maschinen', color: '#3b82f6', areaClass: 'Trainingsfläche' },
  { type: 'Cardio', color: '#ef4444', areaClass: 'Trainingsfläche' },
  { type: 'Functional/Stretching', color: '#22c55e', areaClass: 'Trainingsfläche' },
  { type: 'Kursraum', color: '#a855f7', areaClass: 'Trainingsfläche' },
  { type: 'Empfang/Lounge', color: '#14b8a6', areaClass: 'Nebenfläche' },
  { type: 'Umkleide Damen', color: '#ec4899', areaClass: 'Umkleide/Sanitär' },
  { type: 'Umkleide Herren', color: '#0ea5e9', areaClass: 'Umkleide/Sanitär' },
  { type: 'Umkleide Divers', color: '#8b5cf6', areaClass: 'Umkleide/Sanitär' },
  { type: 'Duschen', color: '#38bdf8', areaClass: 'Umkleide/Sanitär' },
  { type: 'WC', color: '#67e8f9', areaClass: 'Umkleide/Sanitär' },
  { type: 'Wellness/Sauna', color: '#fb923c', areaClass: 'Wellness' },
  { type: 'Ruheraum', color: '#fdba74', areaClass: 'Wellness' },
  { type: 'Büro', color: '#94a3b8', areaClass: 'Nebenfläche' },
  { type: 'Lager', color: '#a8a29e', areaClass: 'Nebenfläche' },
  { type: 'Technik/Lüftung', color: '#78716c', areaClass: 'Nebenfläche' },
  { type: 'Putzraum', color: '#d6d3d1', areaClass: 'Nebenfläche' },
  { type: 'Personalraum', color: '#84cc16', areaClass: 'Nebenfläche' },
  { type: 'Kinderbetreuung', color: '#facc15', areaClass: 'Nebenfläche' },
  { type: 'Physio/Massage', color: '#2dd4bf', areaClass: 'Wellness' },
  { type: 'Flur/Verkehrsfläche', color: '#cbd5e1', areaClass: 'Verkehrsfläche' },
  { type: 'Treppenhaus', color: '#9ca3af', areaClass: 'Verkehrsfläche' },
  { type: 'Sonstiges', color: '#e5e7eb', areaClass: 'Nebenfläche' },
];

export const ROOM_TYPE_MAP: Record<RoomType, RoomTypeInfo> = Object.fromEntries(ROOM_TYPES.map((r) => [r.type, r])) as Record<RoomType, RoomTypeInfo>;

export function roomColor(type: RoomType, override?: string): string {
  return override ?? ROOM_TYPE_MAP[type]?.color ?? '#e5e7eb';
}

export const AREA_CLASSES: AreaClass[] = ['Trainingsfläche', 'Wellness', 'Umkleide/Sanitär', 'Nebenfläche', 'Verkehrsfläche'];

export const FLOOR_COVERINGS = ['Gummiboden', 'Kautschuk', 'Vinyl/PVC', 'Kunstrasen', 'Parkett', 'Fliesen', 'Beton', 'Teppich', 'Holz', 'Epoxid'];
