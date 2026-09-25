import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { undo, redo } from '@/store/projectStore';
import * as actions from '@/editor/actions';
import type { Tool } from '@/types';

const TOOL_KEYS: Record<string, Tool> = { v: 'select', w: 'wall', m: 'measure', h: 'hall-rect', z: 'zone-rect', t: 'text', d: 'door', f: 'window' };

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/**
 * Globale Tastenkürzel (siehe Kürzel-Übersicht „?“).
 * Werkzeugspezifische Tasten werden zuvor vom aktiven Werkzeug (Canvas, capture) behandelt.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const ui = useUiStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // Während eines Zieh-Vorgangs (offene Transaktion) keine Historie und keinen Ansichts-/Werkzeugwechsel:
      // Undo würde die Historie vermischen, ein Unmount des Canvas ließe die Transaktion offen.
      const dragging = ui.dragging;
      if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); if (!dragging) undo(); return; }
      if ((mod && key === 'y') || (mod && e.shiftKey && key === 'z')) { e.preventDefault(); if (!dragging) redo(); return; }
      if (mod && key === 'c') { e.preventDefault(); actions.copySelection(); return; }
      if (mod && key === 'v') { e.preventDefault(); actions.pasteClipboard(); return; }
      if (mod && key === 'd') { e.preventDefault(); actions.duplicateSelection(); return; }
      if (mod && key === 'g') { e.preventDefault(); if (e.shiftKey) actions.ungroupSelection(); else actions.groupSelection(); return; }
      if (mod && key === 'a') { e.preventDefault(); actions.selectAll(); return; }
      if (mod && key === 'l') { e.preventDefault(); actions.toggleLockSelection(); return; }
      if (mod) return;
      if (e.key === 'Escape') {
        if (ui.contextMenu) { ui.setContextMenu(null); return; }
        if (ui.showShortcuts) { ui.setShowShortcuts(false); return; }
        if (ui.presentationMode) { ui.setPresentationMode(false); return; }
        if (ui.tool !== 'select') ui.setTool('select'); else ui.clearSelection();
        return;
      }
      if (e.key === '?' || (e.shiftKey && key === 'ß')) { ui.setShowShortcuts(!ui.showShortcuts); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); actions.deleteSelection(); return; }
      if (key === 'r' && !e.altKey) { e.preventDefault(); actions.rotateSelection(e.shiftKey ? -90 : 90); return; }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        actions.nudgeSelection(dx, dy);
        return;
      }
      if (key === 'g' && !e.shiftKey) { useUiStore.getState().requestFit(); return; }
      if (dragging) return;
      if (key === '3') { ui.setView3d(!ui.view3d); return; }
      if (key === 'p' && e.shiftKey) { ui.setPresentationMode(!ui.presentationMode); return; }
      const t = TOOL_KEYS[key];
      if (t && !e.shiftKey && !e.altKey) { ui.setTool(t); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
