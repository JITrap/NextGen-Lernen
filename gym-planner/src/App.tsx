import { lazy, Suspense } from 'react';
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
import { usePersistence } from '@/store/persistence';

const View3D = lazy(() => import('@/three/View3D').then((m) => ({ default: m.View3D })));

export default function App() {
  useTheme();
  useKeyboardShortcuts();
  usePersistence();
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
            <Suspense fallback={<div className="flex h-full items-center justify-center gp-muted">3D-Ansicht wird geladen …</div>}>
              <View3D />
            </Suspense>
          ) : (
            <Canvas />
          )}
        </main>
        {!presentation && rightOpen && <RightPanel />}
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
