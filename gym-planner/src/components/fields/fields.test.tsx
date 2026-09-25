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

/** Enter übernimmt genau einmal: das durch blur() synchron ausgelöste onBlur darf nicht ein zweites Mal committen (sonst 2 Undo-Schritte). */
describe('Enter übernimmt genau einmal', () => {
  it('NumberField: onChange genau 1× bei Enter', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<NumberField value={100} onChange={onChange} ariaLabel="Länge" unit="cm" />);
    const input = getByLabelText('Länge') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Enter verlässt das Feld (blur → onBlur synchron) …
    expect(document.activeElement).not.toBe(input);
    // … und ein weiteres Blur darf nichts mehr übernehmen
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(250);
    // nächste Sitzung funktioniert normal (Flag zurückgesetzt)
    input.focus();
    fireEvent.change(input, { target: { value: '300' } });
    input.blur();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it('TextField: onChange genau 1× bei Enter', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<TextField value="Alt" onChange={onChange} ariaLabel="Name" />);
    const input = getByLabelText('Name') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Neu' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).not.toBe(input);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Neu');
    input.focus();
    fireEvent.change(input, { target: { value: 'Neu2' } });
    input.blur();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('Neu2');
  });
});
