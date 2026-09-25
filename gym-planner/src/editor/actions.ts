/**
 * Aktionen auf der aktuellen Auswahl (werden von Tastenkürzeln, Kontextmenü und Eigenschaften-Panel genutzt).
 * Basisimplementierung – wird vom Auswahl-/Objekt-Modul vervollständigt.
 */
import type { Selection } from '@/types';
import { useProjectStore, transaction, getActiveFloor } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';

export function currentSelection(): Selection[] {
  return useUiStore.getState().selection;
}
export function selectedItemIds(): string[] {
  return currentSelection().filter((s) => s.kind === 'item').map((s) => s.id);
}

export function deleteSelection() {
  const sel = currentSelection();
  if (!sel.length) return;
  const floor = getActiveFloor();
  transaction(() => useProjectStore.getState().deleteSelection(floor.id, sel));
  useUiStore.getState().clearSelection();
}
export function duplicateSelection() {}
export function copySelection() {}
export function pasteClipboard() {}
export function rotateSelection(_deltaDeg: number) {}
export function nudgeSelection(_dx: number, _dy: number) {}
export function groupSelection() {}
export function ungroupSelection() {}
export function toggleLockSelection() {}
export function toggleHideSelection() {}
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' | 'distributeX' | 'distributeY';
export function alignSelection(_mode: AlignMode) {}
export function selectAll() {}
export function flipSelection(_axis: 'x' | 'y') {}
