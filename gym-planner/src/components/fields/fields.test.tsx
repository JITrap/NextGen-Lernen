import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { NumberField } from './NumberField';
import { TextField } from './TextField';
import { NumberInput } from '../ui/Input';

afterEach(cleanup);

/** Esc: Feld verlässt den Fokus (blur löst onBlur synchron aus) – der getippte Wert darf nicht übernommen werden. */
describe('Esc verwirft den Entwurf (M1)', () => {
  it('NumberField', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<NumberField value={0} onChange={onChange} ariaLabel="Drehung" unit="°" />);
    const input = getByLabelText('Drehung') as HTMLInputElement;
    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '45' } });
    expect(input.value).toBe('45');
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('0');
    // Enter übernimmt weiterhin
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('TextField', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<TextField value="" onChange={onChange} ariaLabel="Bezeichnung" />);
    const input = getByLabelText('Bezeichnung') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Test-Esc' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'Neu' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('Neu');
  });

  it('NumberInput', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<NumberInput value={10} onChange={onChange} aria-label="Wert" />);
    const input = getByLabelText('Wert') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('10');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12,5' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(12.5);
  });
});
