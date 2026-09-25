/**
 * Transiente Zieh-Vorschau für Objekte (Auswahl-Werkzeug: Verschieben, Drehen, Skalieren).
 *
 * Während des Ziehens wird der Projekt-Store NICHT je Bewegung verändert. Stattdessen hält dieser kleine Store
 * die Vorschau-Geometrie der gezogenen Objekte; die Ebenen zeigen sie an der Vorschauposition:
 * - `ids` (stabil für die Dauer des Zieh-Vorgangs): die statischen Ebenen (ItemsLayer, DimensionsLayer) lassen
 *   diese Objekte aus, damit sich dort nichts ändert und Konva die große Objekt-Ebene nicht neu zeichnet.
 * - `items`: vollständige Kopien mit Vorschaugeometrie – `DragPreviewLayer` zeichnet sie in der Overlay-Ebene,
 *   `SelectionLayer` zeichnet Umrisse/Griffe daran (`previewedItems`).
 * - `colliding`: Kollisionsvorschau (gezogene Objekte + berührte statische Objekte); die Instanz bleibt bei
 *   unverändertem Inhalt erhalten, damit Abonnenten nicht je Bewegung rendern.
 * Beim Loslassen schreibt das Werkzeug die Vorschau in EINEM Store-Update (eine Undo-Transaktion) und leert sie;
 * Esc verwirft sie.
 */
import { create } from 'zustand';
import type { PlacedItem } from '@/types';

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

export interface DragPreviewState {
  /** Vorschau-Objekte je ID; null = kein transienter Zieh-Vorgang. */
  items: ReadonlyMap<string, PlacedItem> | null;
  /** IDs der gezogenen Objekte (Instanz bleibt für die Dauer des Zieh-Vorgangs gleich). */
  ids: ReadonlySet<string> | null;
  /** IDs, die in der Vorschau kollidieren (leer, wenn keine Vorschau). */
  colliding: ReadonlySet<string>;
  /** Zieh-Vorgang beginnen (noch ohne Bewegung: Vorschau = Ausgangslage). */
  begin: (items: ReadonlyMap<string, PlacedItem>) => void;
  /** Vorschau je Bewegung setzen. */
  update: (items: ReadonlyMap<string, PlacedItem>, colliding: ReadonlySet<string>) => void;
  /** Vorschau beenden (Commit oder Abbruch erledigt das Werkzeug). */
  clear: () => void;
}

/** Zwei ID-Mengen mit gleichem Inhalt? */
export function sameIdSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export const useDragPreview = create<DragPreviewState>()((set, get) => ({
  items: null,
  ids: null,
  colliding: EMPTY_IDS,
  begin: (items) => set({ items, ids: new Set(items.keys()), colliding: EMPTY_IDS }),
  update: (items, colliding) => {
    const prev = get().colliding;
    set({ items, colliding: sameIdSet(prev, colliding) ? prev : colliding });
  },
  clear: () => {
    if (get().items) set({ items: null, ids: null, colliding: EMPTY_IDS });
  },
}));

/** Objektliste mit angewandter Vorschau (gezogene Objekte ersetzt); ohne Vorschau dieselbe Instanz. */
export function previewedItems(items: PlacedItem[], preview: ReadonlyMap<string, PlacedItem> | null): PlacedItem[] {
  if (!preview || !preview.size) return items;
  let changed = false;
  const out = items.map((it) => {
    const p = preview.get(it.id);
    if (p) changed = true;
    return p ?? it;
  });
  return changed ? out : items;
}
