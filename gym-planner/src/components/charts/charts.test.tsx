import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StatTile } from './StatTile';
import { DonutChart } from './DonutChart';
import { BarChart } from './BarChart';
import { OverviewPanel, useOverviewUi } from '../OverviewPanel';
import { loadProject, useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createEmptyProject, createHall, createItemFromDef, createZone } from '@/store/factories';
import { getDef } from '@/data/equipment';
import { rectPolygon } from '@/geometry/polygon';

describe('Diagramm-Bausteine', () => {
  it('StatTile zeigt Label, Wert und Zusatz', () => {
    render(<StatTile label="Netto" value="478,63 m²" sub="ohne Außenwände" tone="accent" />);
    expect(screen.getByText('Netto')).toBeInTheDocument();
    expect(screen.getByText('478,63 m²')).toBeInTheDocument();
    expect(screen.getByText('ohne Außenwände')).toBeInTheDocument();
  });
  it('DonutChart rendert Segmente, Legende mit Prozent und Tooltip', () => {
    const { container } = render(
      <DonutChart slices={[{ label: 'Training', value: 300, color: '#3b82f6' }, { label: 'Wellness', value: 100, color: '#f97316' }]} centerLabel="400" centerSub="m²" />,
    );
    expect(container.querySelectorAll('circle').length).toBe(3); // Hintergrund + 2 Segmente
    expect(screen.getByText('75,0 %')).toBeInTheDocument();
    expect(screen.getByText('25,0 %')).toBeInTheDocument();
    expect(container.querySelector('title')?.textContent).toContain('Training');
    expect(screen.getByText('400')).toBeInTheDocument();
  });
  it('DonutChart ohne Daten zeigt Leertext', () => {
    render(<DonutChart slices={[]} emptyLabel="Keine Fläche" />);
    expect(screen.getByText('Keine Fläche')).toBeInTheDocument();
  });
  it('BarChart rendert horizontale Balken, Markierung und Leerzustand', () => {
    const { container, rerender } = render(<BarChart bars={[{ label: 'EG', value: 300, color: 'blue' }, { label: 'OG', value: 600, color: 'blue', danger: true }]} max={625} marker={500} markerLabel="Grenzwert" />);
    expect(container.querySelectorAll('rect').length).toBe(4); // je Balken Spur + Wert
    expect(container.querySelector('line')).not.toBeNull();
    expect(screen.getByText('Grenzwert')).toBeInTheDocument();
    rerender(<BarChart bars={[]} emptyLabel="Nichts" />);
    expect(screen.getByText('Nichts')).toBeInTheDocument();
    rerender(<BarChart bars={[{ label: 'A', value: 1, color: 'red' }]} horizontal={false} />);
    expect(container.querySelectorAll('rect').length).toBe(2);
  });
});

function demoProject() {
  const p = createEmptyProject('Demo');
  const f = p.floors[0];
  f.hall = createHall(2500, 2000);
  f.ceilingHeight = 240;
  f.zones.push(createZone({ polygon: rectPolygon({ x: 100, y: 100 }, { x: 1100, y: 1100 }), type: 'Trainingsfläche Freihantel', name: 'Freihantel' }));
  const rack = getDef('atlantis-c513')!;
  f.items.push(createItemFromDef(rack, 500, 500), createItemFromDef(rack, 800, 500));
  return p;
}

describe('OverviewPanel', () => {
  beforeEach(() => {
    useOverviewUi.setState({ scope: 'active', open: { area: true, equipment: true, load: true, capacity: true, bom: true, warnings: true }, warningFilter: 'all' });
    useUiStore.setState({ focusRequest: null, view3d: false });
  });

  it('leeres Projekt: Hinweis auf fehlende Halle, keine Warnungen', () => {
    act(() => loadProject(createEmptyProject('Leer')));
    render(<OverviewPanel />);
    expect(screen.getByText(/Keine Halle gezeichnet/)).toBeInTheDocument();
    expect(screen.getByText(/Keine Warnungen/)).toBeInTheDocument();
    expect(screen.getAllByText(/Noch keine Objekte platziert/).length).toBeGreaterThan(0);
  });

  it('zeigt Flächen, Stückliste und Warnungen; Klick springt hin, Preis ist editierbar', () => {
    act(() => loadProject(demoProject()));
    render(<OverviewPanel />);
    // Flächenbilanz
    expect(screen.getAllByText('500,00 m²').length).toBeGreaterThan(0);
    expect(screen.getAllByText('478,63 m²').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100,00 m²').length).toBeGreaterThan(0);
    // Warnung Deckenhöhe (246 cm > 240 cm) → hinspringen
    const warn = screen.getAllByText(/ist 246 cm hoch/)[0];
    fireEvent.click(warn.closest('button')!);
    const focus = useUiStore.getState().focusRequest;
    expect(focus).not.toBeNull();
    expect(focus!.selection?.kind).toBe('item');
    expect(focus!.point).toEqual({ x: 500, y: 500 });
    // Filter nach Art
    const select = screen.getByLabelText('Warnungen filtern') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ceiling-height' } });
    expect(useOverviewUi.getState().warningFilter).toBe('ceiling-height');
    expect(screen.getAllByText(/ist 246 cm hoch/).length).toBe(2);
    // Stückliste: 2 × Power rack, Preis setzen
    const price = screen.getByLabelText('Stückpreis Power rack') as HTMLInputElement;
    fireEvent.focus(price);
    fireEvent.change(price, { target: { value: '1500' } });
    fireEvent.blur(price);
    const project = useProjectStore.getState().project;
    expect(project.priceOverrides['atlantis-c513']).toBe(1500);
    expect(project.floors[0].items.every((it) => it.priceEur === 1500)).toBe(true);
    // Grenzwert editieren (Komma als Dezimaltrennzeichen)
    const limit = screen.getByLabelText('Grenzwert Bodenlast in kg/m²') as HTMLInputElement;
    fireEvent.focus(limit);
    fireEvent.change(limit, { target: { value: '450,5' } });
    fireEvent.keyDown(limit, { key: 'Enter' });
    fireEvent.blur(limit);
    expect(useProjectStore.getState().project.settings.floorLoadLimitKgM2).toBe(450.5);
  });

  it('Abschnitte lassen sich ein- und ausklappen', () => {
    act(() => loadProject(demoProject()));
    render(<OverviewPanel />);
    // „Kapazität“ kommt auch als Art-Label einer Warnung vor → den Abschnittskopf (aria-expanded) wählen
    const header = screen.getAllByText('Kapazität').map((e) => e.closest('button')).find((b) => b?.hasAttribute('aria-expanded'))!;
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(useOverviewUi.getState().open.capacity).toBe(false);
  });
});
