import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CostSection } from './CostSection';
import { useProjectStore } from '@/store/projectStore';
import { useSectionStore } from './fields';
import { getTemplate } from '@/data/templates';
import { costs } from '@/analysis';
import { formatEur } from '@/geometry/units';

function Harness() {
  const project = useProjectStore((s) => s.project);
  return <CostSection project={project} scope="all" activeFloorId={project.activeFloorId} />;
}

describe('CostSection', () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(getTemplate('studio-400')!.create());
    useProjectStore.temporal.getState().clear();
    useSectionStore.getState().set('overview.costs.assumptions', true);
  });

  it('zeigt Kennzahlen und Tabellensummen aus costs(project)', () => {
    render(<Harness />);
    const c = costs(useProjectStore.getState().project);
    expect(screen.getByTestId('cost-einmal-total').textContent).toBe(formatEur(c.einmalSummeEur));
    expect(screen.getByTestId('cost-monatlich-total').textContent).toBe(formatEur(c.monatlichSummeEur));
    expect(screen.getByText('Einmalkosten', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Break-even')).toBeInTheDocument();
    expect(screen.getByText('Kosten als CSV')).toBeInTheDocument();
    expect(screen.getByText(/über 5 Jahre zu 6 % finanziert/)).toBeInTheDocument();
  });

  it('Annahme ändern aktualisiert die Summe; Standardwerte setzt zurück', () => {
    render(<Harness />);
    const before = costs(useProjectStore.getState().project).einmalSummeEur;
    const input = document.querySelector<HTMLInputElement>('input[name="cost-ausbauEurM2"]')!;
    expect(input).toBeTruthy();
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.blur(input);
    });
    expect(useProjectStore.getState().project.costs).toEqual({ ausbauEurM2: 500 });
    const after = costs(useProjectStore.getState().project).einmalSummeEur;
    expect(after).toBeGreaterThan(before);
    expect(screen.getByTestId('cost-einmal-total').textContent).toBe(formatEur(after));
    const reset = screen.getByText('Standardwerte').closest('button')!;
    expect(reset).not.toBeDisabled();
    act(() => { fireEvent.click(reset); });
    expect(useProjectStore.getState().project.costs).toBeUndefined();
    expect(screen.getByTestId('cost-einmal-total').textContent).toBe(formatEur(before));
    expect(screen.getByText('Standardwerte').closest('button')).toBeDisabled();
  });
});
