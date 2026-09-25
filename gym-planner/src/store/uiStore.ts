import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tool, Selection, Id, Vec2 } from '@/types';

export type Theme = 'light' | 'dark' | 'system';
export type RightPanel = 'library' | 'properties' | 'overview' | 'layers' | 'projects';

export interface Viewport {
  /** Pixel pro cm */
  scale: number;
  /** Verschiebung in Pixeln */
  x: number;
  y: number;
}

export interface ToastMsg {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'warning' | 'error';
}

export interface UiState {
  tool: Tool;
  setTool: (t: Tool) => void;
  /** Für Werkzeuge mit Untertyp (z. B. Türtyp, Treppentyp). */
  toolOptions: Record<string, string | number | boolean>;
  setToolOption: (k: string, v: string | number | boolean) => void;

  selection: Selection[];
  setSelection: (s: Selection[]) => void;
  select: (s: Selection, additive?: boolean) => void;
  clearSelection: () => void;
  hoverId: Id | null;
  setHover: (id: Id | null) => void;

  viewport: Viewport;
  setViewport: (v: Viewport | ((v: Viewport) => Viewport)) => void;
  fitRequest: number;
  requestFit: () => void;
  /** Zuletzt vom Canvas ausgeführte Einpass-Anfrage (fitRequest-Zähler). */
  fitApplied: number;
  setFitApplied: (n: number) => void;
  /** Projekt-ID, für die der Viewport bereits eingepasst wurde – beim Remount des Canvas (z. B. nach der 3D-Ansicht) kein erneutes Auto-Einpassen. */
  viewportInitialized: Id | null;
  setViewportInitialized: (id: Id | null) => void;

  theme: Theme;
  setTheme: (t: Theme) => void;
  rightPanel: RightPanel;
  setRightPanel: (p: RightPanel) => void;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  presentationMode: boolean;
  setPresentationMode: (v: boolean) => void;
  view3d: boolean;
  setView3d: (v: boolean) => void;
  view3dAllFloors: boolean;
  setView3dAllFloors: (v: boolean) => void;
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  tutorialDone: boolean;
  setTutorialDone: (v: boolean) => void;
  showMinimap: boolean;
  setShowMinimap: (v: boolean) => void;
  showRulers: boolean;
  setShowRulers: (v: boolean) => void;
  snapOverride: boolean;
  setSnapOverride: (v: boolean) => void;

  /** Objekt, das gerade aus der Bibliothek gezogen wird. */
  draggingDefId: string | null;
  setDraggingDefId: (id: string | null) => void;
  /** Ein Zieh-Vorgang mit offener Transaktion läuft (Auswahl-Werkzeug) – Ansichtswechsel/Undo/Werkzeugtasten warten. */
  dragging: boolean;
  setDragging: (v: boolean) => void;
  /** Zwischenablage (kopierte Objekte, als JSON-Klone). */
  clipboard: unknown[] | null;
  setClipboard: (c: unknown[] | null) => void;

  contextMenu: { x: number; y: number; target?: Selection; world?: Vec2 } | null;
  setContextMenu: (m: UiState['contextMenu']) => void;

  toasts: ToastMsg[];
  toast: (text: string, kind?: ToastMsg['kind']) => void;
  dismissToast: (id: string) => void;

  /** Ziel eines „Hinspringen“-Befehls (Warnungen). */
  focusRequest: { point: Vec2; selection?: Selection; nonce: number } | null;
  requestFocus: (point: Vec2, selection?: Selection) => void;
  /** Vom Canvas nach dem Ausführen aufgerufen (die Anfrage ist verbraucht). */
  clearFocusRequest: () => void;

  /** Statusleisten-Info (Cursor-Position etc.). */
  cursorWorld: Vec2 | null;
  setCursorWorld: (p: Vec2 | null) => void;
  statusHint: string;
  setStatusHint: (s: string) => void;
}

let toastCounter = 0;
/** Laufende Ausblend-Timer je Toast (werden beim manuellen Schließen gelöscht). */
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      tool: 'select',
      setTool: (tool) => set({ tool, contextMenu: null }),
      toolOptions: {},
      setToolOption: (k, v) => set((s) => ({ toolOptions: { ...s.toolOptions, [k]: v } })),

      selection: [],
      setSelection: (selection) => set({ selection }),
      select: (sel, additive) => set((s) => {
        if (!additive) return { selection: [sel] };
        const exists = s.selection.some((x) => x.kind === sel.kind && x.id === sel.id);
        return { selection: exists ? s.selection.filter((x) => !(x.kind === sel.kind && x.id === sel.id)) : [...s.selection, sel] };
      }),
      clearSelection: () => set({ selection: [] }),
      hoverId: null,
      setHover: (hoverId) => set({ hoverId }),

      viewport: { scale: 0.25, x: 80, y: 60 },
      setViewport: (v) => set((s) => ({ viewport: typeof v === 'function' ? v(s.viewport) : v })),
      fitRequest: 0,
      requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
      fitApplied: 0,
      setFitApplied: (fitApplied) => set({ fitApplied }),
      viewportInitialized: null,
      setViewportInitialized: (viewportInitialized) => set({ viewportInitialized }),

      theme: 'system',
      setTheme: (theme) => set({ theme }),
      rightPanel: 'library',
      setRightPanel: (rightPanel) => set({ rightPanel, rightPanelOpen: true }),
      leftPanelOpen: true,
      rightPanelOpen: true,
      toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      presentationMode: false,
      setPresentationMode: (presentationMode) => set({ presentationMode }),
      view3d: false,
      setView3d: (view3d) => set({ view3d }),
      view3dAllFloors: false,
      setView3dAllFloors: (view3dAllFloors) => set({ view3dAllFloors }),
      showShortcuts: false,
      setShowShortcuts: (showShortcuts) => set({ showShortcuts }),
      showTutorial: false,
      setShowTutorial: (showTutorial) => set({ showTutorial }),
      tutorialDone: false,
      setTutorialDone: (tutorialDone) => set({ tutorialDone }),
      showMinimap: true,
      setShowMinimap: (showMinimap) => set({ showMinimap }),
      showRulers: true,
      setShowRulers: (showRulers) => set({ showRulers }),
      snapOverride: false,
      setSnapOverride: (snapOverride) => set({ snapOverride }),

      draggingDefId: null,
      setDraggingDefId: (draggingDefId) => set({ draggingDefId }),
      dragging: false,
      setDragging: (dragging) => set((s) => (s.dragging === dragging ? s : { dragging })),
      clipboard: null,
      setClipboard: (clipboard) => set({ clipboard }),

      contextMenu: null,
      setContextMenu: (contextMenu) => set({ contextMenu }),

      toasts: [],
      toast: (text, kind = 'info') => {
        const id = `t${++toastCounter}`;
        set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
        toastTimers.set(id, setTimeout(() => get().dismissToast(id), 4000));
      },
      dismissToast: (id) => {
        const t = toastTimers.get(id);
        if (t !== undefined) {
          clearTimeout(t);
          toastTimers.delete(id);
        }
        set((s) => (s.toasts.some((t) => t.id === id) ? { toasts: s.toasts.filter((t) => t.id !== id) } : s));
      },

      focusRequest: null,
      requestFocus: (point, selection) => set((s) => ({ focusRequest: { point, selection, nonce: (s.focusRequest?.nonce ?? 0) + 1 } })),
      clearFocusRequest: () => set((s) => (s.focusRequest ? { focusRequest: null } : s)),

      cursorWorld: null,
      setCursorWorld: (cursorWorld) => set({ cursorWorld }),
      statusHint: '',
      setStatusHint: (statusHint) => set({ statusHint }),
    }),
    {
      name: 'gymplanner-ui',
      partialize: (s) => ({
        theme: s.theme,
        tutorialDone: s.tutorialDone,
        showMinimap: s.showMinimap,
        showRulers: s.showRulers,
        leftPanelOpen: s.leftPanelOpen,
        rightPanelOpen: s.rightPanelOpen,
        rightPanel: s.rightPanel,
      }),
    },
  ),
);
