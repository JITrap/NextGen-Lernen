/**
 * Preiseinheiten skalierbarer Bibliotheksobjekte. Der Bibliothekspreis (prices.json) gilt je nach Objekt
 * je Stück, je Abteil (Spindreihe: Fächer ÷ Stöcke) oder je m² (Kunstrasen/Sled-Bahn: Objektfläche).
 * Eigene Objektpreise (item.priceEur) und Projekt-Überschreibungen (priceOverrides) gelten immer je Stück.
 */
import type { EquipmentDef, PlacedItem } from '@/types';

export type PriceUnit = 'Stück' | 'Abteil' | 'm²';

export interface PriceQuantity {
  einheit: PriceUnit;
  /** Menge des Objekts in dieser Einheit (Stück → 1). */
  menge: number;
}

/** Einheit des Bibliothekspreises einer Definition. */
export function priceUnitOf(def: Pick<EquipmentDef, 'symbol' | 'skalierbar'> | undefined): PriceUnit {
  if (!def || !def.skalierbar) return 'Stück';
  if (def.symbol === 'locker-row') return 'Abteil';
  if (def.symbol === 'turf') return 'm²';
  return 'Stück';
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Menge eines Objekts in der Preiseinheit seiner Definition (Abteile, m² oder 1 Stück). */
export function priceQuantity(item: Pick<PlacedItem, 'width' | 'depth' | 'params'>, def: EquipmentDef | undefined): PriceQuantity {
  const einheit = priceUnitOf(def);
  if (einheit === 'Abteil') {
    const faecher = num(item.params?.faecher ?? def?.params?.faecher);
    const stoeckig = Math.min(4, Math.max(1, Math.round(num(item.params?.stoeckig ?? def?.params?.stoeckig) ?? 1)));
    const ab = num(item.params?.abteilbreite ?? def?.params?.abteilbreite);
    // wie lockerColumns() im Symbol: Fächer ÷ Stöcke aufgerundet, sonst Breite ÷ Abteilbreite gerundet
    const abteile = faecher != null ? Math.ceil(faecher / stoeckig) : Math.round(item.width / (ab != null && ab >= 5 ? ab : 40));
    return { einheit, menge: Math.max(1, abteile) };
  }
  if (einheit === 'm²') return { einheit, menge: Math.max(0, (item.width * item.depth) / 10000) };
  return { einheit, menge: 1 };
}

/**
 * Objektpreis, den ein neu platziertes Objekt mitbekommt: Projekt-Überschreibung, sonst Bibliothekspreis je Stück.
 * Bei Preisen je Abteil/m² bleibt das Objekt ohne eigenen Preis, damit der Bibliothekspreis × Menge über itemPrice()
 * weiter mit der Objektgröße skaliert.
 */
export function placementPrice(def: EquipmentDef, priceOverrides: Record<string, number>): number | undefined {
  const override = priceOverrides[def.id];
  if (typeof override === 'number' && Number.isFinite(override)) return override;
  if (def.preis_eur == null || priceUnitOf(def) !== 'Stück') return undefined;
  return def.preis_eur;
}

/** Bibliothekspreis eines Objekts (Preis je Einheit × Menge); null ohne Bibliothekspreis. */
export function libraryItemPrice(item: Pick<PlacedItem, 'width' | 'depth' | 'params'>, def: EquipmentDef | undefined): number | null {
  const p = def?.preis_eur;
  if (typeof p !== 'number' || !Number.isFinite(p)) return null;
  const q = priceQuantity(item, def);
  return q.einheit === 'Stück' ? p : Math.round(p * q.menge * 100) / 100;
}
