import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { useProjectStore, loadProject } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createEmptyProject, createFloor } from '@/store/factories';
import { TopBar } from './TopBar';
import { FloorTabs, suggestFloorName, suggestFloorOrder } from './FloorTabs';
import { Toolbar } from './Toolbar';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { StatusBar, describeSelection } from './StatusBar';
import { Toasts } from './Toasts';
import { Tutorial, TUTORIAL_STEPS } from './Tutorial';
import { ContextMenu } from './ContextMenu';

beforeAll(() => {
  // jsdom kennt kein matchMedia
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('min-width'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  cleanup();
  loadProject(createEmptyProject('Testprojekt'));
  useUiStore.setState({ tool: 'select', selection: [], showShortcuts: false, showTutorial: false, tutorialDone: true, toasts: [], contextMenu: null });
});

describe('TopBar', () => {
  it('rendert Projektname; Undo/Redo sind bei leerer Historie deaktiviert', () => {
    render(<TopBar />);
    expect(screen.getByText('Testprojekt')).toBeInTheDocument();
    const undoBtn = screen.getByTitle(/Rückgängig/);
    const redoBtn = screen.getByTitle(/Wiederholen/);
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
  });

  it('aktiviert Undo nach einer Änderung und benennt das Projekt um', () => {
    render(<TopBar />);
    act(() => {
      useProjectStore.getState().renameProject('Studio Nord');
    });
    expect(screen.getByText('Studio Nord')).toBeInTheDocument();
    expect(screen.getByTitle(/Rückgängig/)).not.toBeDisabled();
    // Inline-Umbenennen
    fireEvent.click(screen.getByText('Studio Nord'));
    const input = screen.getByLabelText('Projektname') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Studio Süd' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useProjectStore.getState().project.name).toBe('Studio Süd');
  });

  it('zeigt die Varianten-Marke', () => {
    act(() => {
      useProjectStore.getState().updateProject((p) => {
        p.variantName = 'Variante B';
      });
    });
    render(<TopBar />);
    expect(screen.getByText('Variante B')).toBeInTheDocument();
  });
});

describe('FloorTabs', () => {
  it('zeigt Stockwerke nach order sortiert und fügt eines hinzu', () => {
    const p = createEmptyProject('Stockwerke');
    p.floors = [createFloor({ name: 'OG 1', order: 1 }), createFloor({ name: 'EG', order: 0 }), createFloor({ name: 'UG', order: -1 })];
    p.activeFloorId = p.floors[1].id;
    loadProject(p);
    render(<FloorTabs />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['UG', 'EG', 'OG 1']);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByTitle('Stockwerk hinzufügen'));
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('OG 2');
    fireEvent.click(screen.getByRole('button', { name: /Hinzufügen/ }));
    const floors = useProjectStore.getState().project.floors;
    expect(floors.length).toBe(4);
    const added = floors.find((f) => f.name === 'OG 2');
    expect(added).toBeDefined();
    expect(added!.order).toBe(2);
    expect(useProjectStore.getState().project.activeFloorId).toBe(added!.id);
  });

  it('wechselt das aktive Stockwerk per Klick', () => {
    const p = createEmptyProject('Stockwerke');
    p.floors = [createFloor({ name: 'EG', order: 0 }), createFloor({ name: 'OG 1', order: 1 })];
    p.activeFloorId = p.floors[0].id;
    loadProject(p);
    render(<FloorTabs />);
    fireEvent.click(screen.getByText('OG 1'));
    expect(useProjectStore.getState().project.activeFloorId).toBe(p.floors[1].id);
  });

  it('schlägt sinnvolle Namen und Reihenfolgen vor', () => {
    const floors = [createFloor({ name: 'EG', order: 0 }), createFloor({ name: 'OG 1', order: 1 }), createFloor({ name: 'UG', order: -1 })];
    expect(suggestFloorName('OG', floors)).toBe('OG 2');
    expect(suggestFloorName('UG', floors)).toBe('UG 2');
    expect(suggestFloorName('Galerie', floors)).toBe('Galerie');
    expect(suggestFloorOrder('UG', floors)).toBe(-2);
    expect(suggestFloorOrder('OG', floors)).toBe(2);
  });
});

describe('Toolbar', () => {
  it('setzt das Werkzeug bei Klick und hebt es hervor', () => {
    render(<Toolbar />);
    const wall = screen.getByRole('button', { name: 'Wand (W)' });
    fireEvent.click(wall);
    expect(useUiStore.getState().tool).toBe('wall');
    expect(wall).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Messen (M)' }));
    expect(useUiStore.getState().tool).toBe('measure');
    expect(wall).toHaveAttribute('aria-pressed', 'false');
  });

  it('öffnet das Flyout beim zweiten Klick und setzt Werkzeug-Optionen', () => {
    render(<Toolbar />);
    const hall = screen.getByRole('button', { name: 'Halle (H)' });
    fireEvent.click(hall);
    expect(useUiStore.getState().tool).toBe('hall-rect');
    fireEvent.click(hall);
    const polygon = screen.getByRole('radio', { name: 'Polygon' });
    fireEvent.click(polygon);
    expect(useUiStore.getState().tool).toBe('hall-polygon');
    expect(hall).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Bodenbelag'), { target: { value: 'Parkett' } });
    expect(useUiStore.getState().toolOptions.floorCovering).toBe('Parkett');
  });
});

describe('ShortcutsOverlay', () => {
  it('öffnet und schließt sich über den UI-Store', () => {
    render(<ShortcutsOverlay />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      useUiStore.getState().setShowShortcuts(true);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Tastenkürzel')).toBeInTheDocument();
    expect(screen.getByText('Alles einpassen')).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'Schließen' });
    expect(closeButtons.length).toBe(2); // Kopfzeile (X) + Fußzeile
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(useUiStore.getState().showShortcuts).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('schließt mit Escape', () => {
    render(<ShortcutsOverlay />);
    act(() => {
      useUiStore.getState().setShowShortcuts(true);
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().showShortcuts).toBe(false);
  });
});

describe('StatusBar', () => {
  it('zeigt Hallenfläche, Zoom und Auswahl', () => {
    act(() => {
      const s = useProjectStore.getState();
      s.setHall(s.project.activeFloorId, { polygon: [{ x: 0, y: 0 }, { x: 2500, y: 0 }, { x: 2500, y: 2000 }, { x: 0, y: 2000 }], wallThickness: 24, floorCovering: 'Gummiboden' });
      useUiStore.getState().setViewport({ scale: 0.5, x: 0, y: 0 });
    });
    render(<StatusBar />);
    expect(screen.getByText('500,00 m²')).toBeInTheDocument();
    expect(screen.getByText('200 %')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle(/Zoom/));
    expect(useUiStore.getState().viewport.scale).toBeCloseTo(0.25);
    const floor = useProjectStore.getState().project.floors[0];
    expect(describeSelection({ kind: 'hallEdge', id: '0' }, floor, undefined)).toContain('25,00 m');
  });
});

describe('Toasts', () => {
  it('zeigt Toasts und schließt sie per Klick', () => {
    vi.useFakeTimers();
    render(<Toasts />);
    act(() => {
      useUiStore.getState().toast('Gespeichert!', 'success');
    });
    expect(screen.getByText('Gespeichert!')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Gespeichert!'));
    expect(screen.queryByText('Gespeichert!')).toBeNull();
    vi.useRealTimers();
  });
});

describe('Tutorial', () => {
  it('öffnet sich beim ersten Start und lässt sich überspringen', () => {
    useUiStore.setState({ tutorialDone: false, showTutorial: false });
    render(<Tutorial />);
    expect(useUiStore.getState().showTutorial).toBe(true);
    expect(screen.getByRole('dialog', { name: /Tutorial – Schritt 1 von/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByRole('dialog', { name: /Schritt 2 von/ })).toBeInTheDocument();
    // Schritt „Halle“ wartet auf Aktion: „Weiter“ ist durch „Schritt überspringen“ ersetzt
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull();
    act(() => {
      const st = useProjectStore.getState();
      st.setHall(st.project.activeFloorId, { polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }], wallThickness: 24, floorCovering: 'Gummiboden' });
    });
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Überspringen'));
    expect(useUiStore.getState().tutorialDone).toBe(true);
    expect(useUiStore.getState().showTutorial).toBe(false);
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('ContextMenu', () => {
  it('zeigt auf Leerfläche „Halle anlegen“ und setzt das Werkzeug', () => {
    render(<ContextMenu />);
    act(() => {
      useUiStore.getState().setContextMenu({ x: 100, y: 100, world: { x: 5000, y: 5000 } });
    });
    const item = screen.getByRole('menuitem', { name: /Halle anlegen \(Rechteck\)/ });
    fireEvent.click(item);
    expect(useUiStore.getState().tool).toBe('hall-rect');
    expect(useUiStore.getState().contextMenu).toBeNull();
  });

  it('wählt das getroffene Objekt aus und bietet Objekt-Aktionen', () => {
    act(() => {
      const st = useProjectStore.getState();
      st.addItem(st.project.activeFloorId, {
        id: 'i_test', kind: 'equipment', defId: 'unbekannt', x: 100, y: 100, rotation: 0, width: 100, depth: 100, height: 100,
        safetyZone: { vorne: 0, hinten: 0, links: 0, rechts: 0 }, safetyZoneEnabled: false, label: 'Testgerät',
      });
    });
    render(<ContextMenu />);
    act(() => {
      useUiStore.getState().setContextMenu({ x: 50, y: 50, world: { x: 100, y: 100 } });
    });
    expect(useUiStore.getState().selection).toEqual([{ kind: 'item', id: 'i_test' }]);
    expect(screen.getByText('Testgerät')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Drehen 90°/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().contextMenu).toBeNull();
  });
});
