/**
 * Reine Hilfsfunktionen für die 3D-Darstellung platzierter Objekte (keine three-Abhängigkeit).
 */
import type { EquipmentDef, Floor, PlacedItem, StairsType } from '@/types';
import { areaColor, COLUMN_COLOR, ELEVATOR_COLOR, STAIRS_COLOR } from './colors';
import { cm, type FloorLevel } from './coords';

/** Standard-Auftrittstiefe einer Stufe (cm). */
export const STEP_DEPTH_CM = 28;
export const DEFAULT_ITEM_HEIGHT_CM = 100;
export const PLATFORM_HEIGHT_CM = 5;

const FLAT_SYMBOLS = new Set<string>(['platform', 'mat', 'turf']);

/**
 * Höhe eines Objekts in cm: item.height ?? def.hoehe_cm ?? 100.
 * Ohne Angabe: 5 cm für Plattformen/Matten/Kunstrasen, Säulen/Aufzüge bis zur Decke.
 */
export function itemHeightCm(item: Pick<PlacedItem, 'height' | 'kind'>, def: EquipmentDef | undefined, ceilingCm: number): number {
  const h = item.height ?? def?.hoehe_cm ?? null;
  if (h != null && Number.isFinite(h) && h > 0) return h;
  if (item.kind === 'column' || item.kind === 'elevator') return ceilingCm;
  if (item.kind === 'ramp') return 15;
  if (def && FLAT_SYMBOLS.has(def.symbol)) return PLATFORM_HEIGHT_CM;
  return DEFAULT_ITEM_HEIGHT_CM;
}

function paramString(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined, key: string): string {
  const v = item.params?.[key] ?? def?.params?.[key];
  return v == null ? '' : String(v);
}

/** Treppentyp aus params.typ oder dem Bibliotheks-Symbol. */
export function stairsTypeOf(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined): StairsType {
  const typ = paramString(item, def, 'typ').toLowerCase();
  if (typ.startsWith('wendel') || typ === 'spiral') return 'Wendeltreppe';
  if (typ === 'l' || typ.startsWith('l-')) return 'L';
  if (typ === 'u' || typ.startsWith('u-')) return 'U';
  if (typ.startsWith('gerade')) return 'gerade';
  switch (def?.symbol) {
    case 'stairs-l': return 'L';
    case 'stairs-u': return 'U';
    case 'stairs-spiral': return 'Wendeltreppe';
    default: return 'gerade';
  }
}

/** Säule rund? (params.form „rund“/params.rund oder Symbol column-round) */
export function columnIsRound(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined): boolean {
  const form = paramString(item, def, 'form').toLowerCase();
  if (form === 'rund') return true;
  if (form === 'eckig') return false;
  const rund = item.params?.rund ?? def?.params?.rund;
  if (typeof rund === 'boolean') return rund;
  return def?.symbol === 'column-round';
}

/** Stufenzahl: params.stufen, sonst Lauflänge / 28 cm (mindestens 3, höchstens 80). */
export function stepCount(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined, runLengthCm: number): number {
  const raw = Number(item.params?.stufen ?? def?.params?.stufen);
  if (Number.isFinite(raw) && raw >= 2) return Math.min(80, Math.round(raw));
  return Math.min(80, Math.max(3, Math.round(runLengthCm / STEP_DEPTH_CM)));
}

/** Farbe eines Objekts je Bereich/Art. */
export function itemColor(item: Pick<PlacedItem, 'kind'>, def: EquipmentDef | undefined): string {
  switch (item.kind) {
    case 'column': return COLUMN_COLOR;
    case 'elevator': return ELEVATOR_COLOR;
    case 'stairs': return STAIRS_COLOR;
    default: return areaColor(def?.bereich);
  }
}

/** Anzeigename eines Objekts. */
export function itemLabel(item: Pick<PlacedItem, 'label' | 'defId' | 'params'>, def: EquipmentDef | undefined): string {
  const base = item.label?.trim() || def?.name || item.defId;
  const faecher = Number(item.params?.faecher);
  if (Number.isFinite(faecher) && faecher > 0) return `${base} · ${faecher} Fächer`;
  return base;
}

/** Ist dieses Objekt eine verlinkte Kopie eines anderen Stockwerks (useFloorVisibleItems)? */
export function isLinkedCopy(item: Pick<PlacedItem, 'params'>): boolean {
  return typeof item.params?.__linkedFrom === 'string';
}

export interface VerticalSpan {
  /** Unterkante (m, absolut). */
  bottom: number;
  /** Oberkante (m, absolut). */
  top: number;
  /** Stockwerke, die das Element durchläuft (sortiert, unten → oben). */
  floors: FloorLevel[];
}

/**
 * Vertikale Ausdehnung eines Treppen-/Aufzug-Elements über alle verlinkten Stockwerke.
 * - Treppe: vom untersten beteiligten Stockwerk bis zum nächsthöheren beteiligten (sonst bis zur eigenen Decke + Deckenstärke).
 * - Aufzug: vom untersten bis zur Deckenunterkante des obersten beteiligten Stockwerks.
 */
export function verticalSpan(item: Pick<PlacedItem, 'kind' | 'linkedFloorIds'>, homeFloor: Pick<Floor, 'id'>, levels: FloorLevel[]): VerticalSpan {
  const ids = new Set<string>([homeFloor.id, ...(item.linkedFloorIds ?? [])]);
  const involved = levels.filter((l) => ids.has(l.floor.id));
  const home = levels.find((l) => l.floor.id === homeFloor.id);
  if (!involved.length) {
    const base = home ?? levels[0];
    const bottom = base?.level ?? 0;
    const top = base ? base.top : bottom + 3;
    return { bottom, top, floors: base ? [base] : [] };
  }
  const bottomLevel = involved[0];
  if (item.kind === 'elevator') {
    const topLevel = involved[involved.length - 1];
    return { bottom: bottomLevel.level, top: topLevel.top, floors: involved };
  }
  const next = involved[1] ?? levels[bottomLevel.index + 1];
  const top = next ? next.level : bottomLevel.top + cm(30);
  return { bottom: bottomLevel.level, top, floors: involved };
}
