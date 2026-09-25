import { describe, it, expect } from 'vitest';
import { formatM2, formatM, formatCm, parseLength, inchToCm, cm2ToM2, formatDims, parseNumber, formatLength, round } from './units';

describe('Einheiten', () => {
  it('formatiert m² mit Komma', () => {
    expect(formatM2(12.45)).toBe('12,45 m²');
    expect(formatM2(500)).toBe('500,00 m²');
    expect(formatM2(1234.5)).toBe('1.234,50 m²');
  });
  it('formatiert Längen', () => {
    expect(formatM(350)).toBe('3,50 m');
    expect(formatCm(12.5)).toBe('12,5 cm');
    expect(formatCm(90)).toBe('90 cm');
    expect(formatLength(90)).toBe('90 cm');
    expect(formatLength(250)).toBe('2,50 m');
  });
  it('formatiert Maße B × T × H', () => {
    expect(formatDims(165, 203, 246)).toBe('165 × 203 × 246 cm');
    expect(formatDims(111.5, 169, null)).toBe('111,5 × 169 cm');
  });
  it('parst Eingaben', () => {
    expect(parseLength('3,5 m')).toBe(350);
    expect(parseLength('3.5m')).toBe(350);
    expect(parseLength('350')).toBe(350);
    expect(parseLength('12,5 cm')).toBe(12.5);
    expect(parseLength('1200 mm')).toBe(120);
    expect(parseLength('abc')).toBeNull();
    expect(parseLength('2,5', 'm')).toBe(250);
    expect(parseNumber('1,5')).toBe(1.5);
  });
  it('rundet symmetrisch und ohne −0 (N6)', () => {
    expect(round(-1.005, 2)).toBe(-1.01);
    expect(round(1.005, 2)).toBe(1.01);
    expect(Object.is(round(-0.001, 2), 0)).toBe(true);
    expect(formatM2(-0.001)).toBe('0,00 m²');
    expect(formatM2(-1.5)).toBe('-1,50 m²');
  });
  it('parst weitere Schreibweisen (N6)', () => {
    expect(parseLength('.5')).toBe(0.5);
    expect(parseLength('5.')).toBe(5);
    expect(parseLength('+5')).toBe(5);
    expect(parseLength('1e2')).toBe(100);
    expect(parseLength('1.000')).toBe(1000);
    expect(parseLength('12.500 m')).toBe(1250000);
    expect(parseLength('1.000,5')).toBe(1000.5);
    expect(parseLength('0.500')).toBe(0.5);
    expect(parseLength('2.5')).toBe(2.5);
    expect(parseLength('-3,5 m')).toBe(-350);
    expect(parseLength('1,5,5')).toBeNull();
    expect(parseLength('3,')).toBeNull(); // unfertige Komma-Eingabe (Wandwerkzeug)
    expect(parseLength(',5')).toBe(0.5);
    expect(parseLength('1.2.3')).toBeNull();
    expect(parseLength('m')).toBeNull();
    expect(parseNumber('1.000')).toBe(1000);
    expect(parseNumber('.5')).toBe(0.5);
  });
  it('Zoll → cm', () => {
    expect(inchToCm(62)).toBeCloseTo(157.48, 2);
  });
  it('cm² → m²', () => {
    expect(cm2ToM2(5_000_000)).toBe(500);
  });
});
