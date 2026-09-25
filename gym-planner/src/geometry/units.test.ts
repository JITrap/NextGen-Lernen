import { describe, it, expect } from 'vitest';
import { formatM2, formatM, formatCm, parseLength, inchToCm, cm2ToM2, formatDims, parseNumber, formatLength } from './units';

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
  it('Zoll → cm', () => {
    expect(inchToCm(62)).toBeCloseTo(157.48, 2);
  });
  it('cm² → m²', () => {
    expect(cm2ToM2(5_000_000)).toBe(500);
  });
});
