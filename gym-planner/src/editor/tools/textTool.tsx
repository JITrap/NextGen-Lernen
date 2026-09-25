/**
 * Werkzeug „Text / Notiz“ ('text'): Klick platziert eine Textnotiz und öffnet sofort ein Textfeld (HTML-Overlay)
 * an der Bildschirmposition. Enter oder Verlassen des Feldes speichert, Esc verwirft. Leere Notizen werden
 * gelöscht. Anlegen + Eintippen ergeben zusammen genau einen Undo-Schritt. Danach ist „Auswahl“ aktiv.
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { Annotation, Project, Vec2 } from '@/types';
import type { ToolContext } from './types';
import { registerTool } from './registry';
import { createToolStore } from './toolState';
import { worldToScreen } from '../viewport';
import { useProjectStore, beginTransaction, endTransaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { newId } from '@/utils/id';

/** Schriftgröße neuer Notizen in Welt-cm. */
export const DEFAULT_NOTE_FONT_CM = 30;
export const DEFAULT_NOTE_TEXT = 'Notiz';

export interface TextEditState {
  editing: {
    id: string;
    floorId: string;
    world: Vec2;
    /** Projektzustand vor dem Anlegen – zum spurlosen Verwerfen. */
    snapshot: Project;
  } | null;
}

export const useTextEdit = createToolStore<TextEditState>({ editing: null });

/**
 * Prüft, ob sich das Projekt seit `snapshot` ausschließlich um die Notiz `id` im Stockwerk `floorId`
 * unterscheidet (Immer erhält Referenzen unveränderter Teile). Nur dann darf der Snapshot zurückgesetzt werden.
 */
export function onlyNoteAdded(snapshot: Project, current: Project, floorId: string, id: string): boolean {
  if (snapshot.floors.length !== current.floors.length) return false;
  let found = false;
  for (let i = 0; i < current.floors.length; i++) {
    const a = snapshot.floors[i];
    const b = current.floors[i];
    if (a === b) continue;
    if (a.id !== floorId || b.id !== floorId) return false;
    for (const key of Object.keys(b) as (keyof typeof b)[]) {
      if (key === 'annotations') continue;
      if (a[key] !== b[key]) return false;
    }
    if (b.annotations.length !== a.annotations.length + 1) return false;
    for (let k = 0; k < a.annotations.length; k++) if (a.annotations[k] !== b.annotations[k]) return false;
    if (b.annotations[b.annotations.length - 1].id !== id) return false;
    found = true;
  }
  return found;
}

/**
 * Beendet die Bearbeitung: speichert den Text (nicht leer) oder verwirft die Notiz.
 * Idempotent – mehrfache Aufrufe (Blur + Enter + Werkzeugwechsel) sind unschädlich.
 */
export function finishTextEdit(mode: 'save' | 'discard', text = '') {
  const st = useTextEdit.getState();
  const editing = st.editing;
  if (!editing) return;
  st.patch({ editing: null });
  const store = useProjectStore.getState();
  const ui = useUiStore.getState();
  const t = text.trim();
  if (mode === 'save' && t) {
    store.updateAnnotation(editing.floorId, editing.id, { text: t } as Partial<Annotation>);
    endTransaction();
    ui.setSelection([{ kind: 'annotation', id: editing.id }]);
    ui.setRightPanel('properties');
  } else {
    if (onlyNoteAdded(editing.snapshot, store.project, editing.floorId, editing.id)) {
      // Spurlos zurück auf den Zustand vor dem Anlegen (kein Undo-Eintrag).
      useProjectStore.setState({ project: editing.snapshot });
    } else {
      store.deleteAnnotations(editing.floorId, [editing.id]);
    }
    endTransaction();
    ui.clearSelection();
  }
  if (ui.tool === 'text') ui.setTool('select');
}

function TextEditor({ ctx, editing }: { ctx: ToolContext; editing: NonNullable<TextEditState['editing']> }) {
  const [value, setValue] = useState('');
  const valueRef = useRef('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    // Der Mausklick, der die Notiz angelegt hat, feuert nach pointerdown noch ein mousedown auf dem Canvas.
    // Dessen Standardaktion (Fokuswechsel) würde das Textfeld sofort wieder verlassen → auf dem Canvas unterdrücken.
    const onDown = (ev: MouseEvent) => {
      const t = ev.target;
      if (t instanceof Element && t.closest('.konvajs-content')) ev.preventDefault();
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, []);
  const screen = worldToScreen(editing.world, ctx.viewport);
  const fontPx = Math.max(13, Math.min(40, DEFAULT_NOTE_FONT_CM * ctx.viewport.scale));
  const left = Math.max(4, Math.min(ctx.stageSize.width - 200, screen.x));
  const top = Math.max(4, Math.min(ctx.stageSize.height - 60, screen.y));
  return (
    <div className="absolute z-20 flex flex-col gap-1" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        className="gp-input resize-none shadow-lg"
        style={{ fontSize: fontPx, lineHeight: 1.2, minWidth: 180, width: Math.min(420, Math.max(180, value.length * fontPx * 0.6 + 40)), userSelect: 'text' }}
        rows={Math.max(1, Math.min(6, value.split('\n').length))}
        placeholder={DEFAULT_NOTE_TEXT}
        aria-label="Notiztext"
        value={value}
        onChange={(e) => {
          valueRef.current = e.target.value;
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finishTextEdit('save', valueRef.current);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finishTextEdit('discard');
          }
        }}
        onBlur={() => finishTextEdit('save', valueRef.current)}
      />
      <div className="gp-panel rounded border px-2 py-0.5 text-[10px] shadow gp-muted">Enter: speichern · Shift+Enter: neue Zeile · Esc: verwerfen</div>
    </div>
  );
}

const TextHtmlOverlay = memo(function TextHtmlOverlay({ ctx }: { ctx: ToolContext }) {
  const editing = useTextEdit((s) => s.editing);
  if (!editing) return null;
  return <TextEditor key={editing.id} ctx={ctx} editing={editing} />;
});

registerTool({
  id: 'text',
  cursor: 'text',
  hint: 'Klicken, um eine Notiz zu platzieren · Enter: speichern · Esc: verwerfen',
  HtmlOverlay: TextHtmlOverlay,
  onPointerDown: (e, ctx) => {
    if (e.button !== 0) return;
    if (useTextEdit.getState().editing) {
      // Klick auf den Canvas während der Eingabe: aktuelle Notiz übernehmen (Blur folgt ohnehin).
      finishTextEdit('save', currentDraft());
      return;
    }
    const r = ctx.snap(e.world, { targets: { grid: true, 'wall-end': false, 'wall-mid': false, 'hall-vertex': false, 'item-edge': false, angle: false } });
    const id = newId('a_');
    const snapshot = useProjectStore.getState().project;
    beginTransaction();
    ctx.store.addAnnotation(ctx.floor.id, { id, kind: 'text', x: r.point.x, y: r.point.y, text: DEFAULT_NOTE_TEXT, fontSize: DEFAULT_NOTE_FONT_CM, rotation: 0 });
    useTextEdit.getState().patch({ editing: { id, floorId: ctx.floor.id, world: r.point, snapshot } });
    ctx.ui.setSelection([{ kind: 'annotation', id }]);
    if (!ctx.project.layers.annotations) ctx.ui.toast('Ebene „Anmerkungen“ ist ausgeblendet – die Notiz ist nach dem Speichern nicht sichtbar', 'info');
  },
  onCancel: () => {
    // Werkzeugwechsel während der Eingabe: Text übernehmen (leer → verwerfen).
    finishTextEdit('save', currentDraft());
  },
});

/** Aktueller Entwurf im Textfeld (falls geöffnet) – über das DOM, da der Zustand im Editor liegt. */
function currentDraft(): string {
  if (typeof document === 'undefined') return '';
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement && el.getAttribute('aria-label') === 'Notiztext') return el.value;
  const any = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Notiztext"]');
  return any?.value ?? '';
}
