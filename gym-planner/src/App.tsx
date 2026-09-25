import { lazy, Suspense, useEffect } from 'react';
import { Canvas } from '@/editor/Canvas';
import { useTheme } from '@/hooks/useTheme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUiStore } from '@/store/uiStore';
import { TopBar } from '@/components/TopBar';
import { Toolbar } from '@/components/Toolbar';
import { RightPanel } from '@/components/RightPanel';
import { StatusBar } from '@/components/StatusBar';
import { ContextMenu } from '@/components/ContextMenu';
import { ShortcutsOverlay } from '@/components/ShortcutsOverlay';
import { Tutorial } from '@/components/Tutorial';
import { Toasts } from '@/components/Toasts';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePersistence } from '@/store/persistence';

const loadView3D = () => import('@/three/View3D');
const View3D = lazy(() => loadView3D().then((m) => ({ default: m.View3D })));

/** 3D-Chunk nach dem Start im Leerlauf vorladen: kein Suspense-Fallback und keine Wartezeit beim ersten Umschalten. */
function usePreloadView3D() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let timer: number | null = null;
    let idle: number | null = null;
    const load = () => { void loadView3D().catch(() => undefined); };
    if (typeof w.requestIdleCallback === 'function') idle = w.requestIdleCallback(load, { timeout: 3000 });
    else timer = window.setTimeout(load, 1500);
    return () => {
      if (idle != null && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idle);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);
}

export default function App() {
  useTheme();
  useKeyboardShortcuts();
  usePersistence();
  usePreloadView3D();
  const presentation = useUiStore((s) => s.presentationMode);
  const view3d = useUiStore((s) => s.view3d);
  const leftOpen = useUiStore((s) => s.leftPanelOpen);
  const rightOpen = useUiStore((s) => s.rightPanelOpen);

  return (
    <div className="flex h-full w-full flex-col" style={{ background: 'var(--gp-bg)', color: 'var(--gp-text)' }}>
      {!presentation && <TopBar />}
      <div className="flex min-h-0 flex-1">
        {!presentation && leftOpen && <Toolbar />}
        <main className="relative min-w-0 flex-1">
          {view3d ? (
            <ErrorBoundary variant="section" label="3D-Ansicht">
              <Suspense fallback={<div className="flex h-full items-center justify-center gp-muted">3D-Ansicht wird geladen …</div>}>
                <View3D />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <ErrorBoundary variant="section" label="Zeichenfläche">
              <Canvas />
            </ErrorBoundary>
          )}
        </main>
        {!presentation && rightOpen && (
          <ErrorBoundary variant="section" label="Seitenpanel" className="w-[320px] shrink-0 border-l gp-panel max-[1099px]:w-[280px]">
            <RightPanel />
          </ErrorBoundary>
        )}
      </div>
      {!presentation && <StatusBar />}
      <ContextMenu />
      <ShortcutsOverlay />
      <Tutorial />
      <Toasts />
      {presentation && (
        <button className="gp-btn absolute right-3 top-3 z-50" onClick={() => useUiStore.getState().setPresentationMode(false)}>
          Präsentation beenden (Esc)
        </button>
      )}
    </div>
  );
}
