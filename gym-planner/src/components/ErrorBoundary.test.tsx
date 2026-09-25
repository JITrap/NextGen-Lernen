import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import { loadProject } from '@/store/projectStore';
import { createEmptyProject } from '@/store/factories';
import { LS_INDEX_KEY } from '@/store/persistence';

function Boom({ fail }: { fail: boolean }) {
  if (fail) throw new Error('Kaputt');
  return <div>Alles gut</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
    loadProject(createEmptyProject('Boundary'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Bereichs-Variante zeigt das Fehlerbild und lässt sich zurücksetzen', () => {
    const { rerender } = render(
      <ErrorBoundary variant="section" label="Zeichenfläche">
        <Boom fail />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Da ist etwas schiefgelaufen');
    expect(alert).toHaveTextContent('Zeichenfläche');
    expect(alert).toHaveTextContent('Kaputt');
    rerender(
      <ErrorBoundary variant="section" label="Zeichenfläche">
        <Boom fail={false} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Bereich zurücksetzen'));
    expect(screen.getByText('Alles gut')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('App-Variante bietet Neu laden, JSON-Sicherung und Projektliste', () => {
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify([{ id: 'p_x', name: 'Anderes Studio', updatedAt: '2026-01-01', createdAt: '2026-01-01', floorCount: 2, totalAreaM2: 500 }]));
    const createUrl = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(
      <ErrorBoundary variant="app">
        <Boom fail />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Da ist etwas schiefgelaufen');
    expect(screen.getByText('Neu laden')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Projekt als JSON sichern'));
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Projekt als JSON-Datei gesichert.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Anderes Projekt öffnen'));
    const list = screen.getByLabelText('Gespeicherte Projekte');
    expect(list).toHaveTextContent('Anderes Studio');
    expect(list).toHaveTextContent('2 Stockwerke');
    vi.unstubAllGlobals();
  });
});
