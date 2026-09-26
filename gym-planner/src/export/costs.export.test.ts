import { describe, it, expect } from 'vitest';
import { costsCsvText, COSTS_CSV_HEADER } from './csv';
import { buildPdf } from './pdf';
import { costs, COST_ASSUMPTION_FIELDS } from '@/analysis';
import { getTemplate } from '@/data/templates';
import { createEmptyProject } from '@/store/factories';

describe('Kosten-CSV', () => {
  it('enthält Einmal- und laufende Kosten mit Summen, Kennzahlen und den Annahmen-Block', () => {
    const p = getTemplate('studio-400')!.create();
    const c = costs(p);
    const text = costsCsvText(p);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toBe(COSTS_CSV_HEADER.join(';'));
    expect(lines[0].split(';').length).toBe(7);
    for (const l of c.einmal) expect(lines.some((row) => row.startsWith(`${row.split(';')[0]};${l.bezeichnung};`))).toBe(true);
    const einmalSum = lines.find((l) => l.startsWith('Summe;Einmalkosten;'))!;
    expect(einmalSum.split(';')[5]).toBe(String(c.einmalSummeEur));
    const monatSum = lines.find((l) => l.startsWith('Summe;Laufend je Monat;'))!;
    expect(monatSum.split(';')[5]).toBe(String(c.monatlichSummeEur));
    expect(lines.find((l) => l.startsWith('Kennzahl;Jahr 1;'))!.split(';')[2]).toBe(String(c.jahr1SummeEur));
    expect(lines.find((l) => l.startsWith('Kennzahl;Break-even-Mitglieder;'))!.split(';')[2]).toBe(String(c.breakEvenMitglieder));
    const header = lines.indexOf('Annahme;Wert;Einheit;Erläuterung');
    expect(header).toBeGreaterThan(0);
    const annahmen = lines.slice(header + 1, header + 1 + COST_ASSUMPTION_FIELDS.length);
    expect(annahmen.length).toBe(COST_ASSUMPTION_FIELDS.length);
    expect(annahmen[0].split(';')[0]).toBe(COST_ASSUMPTION_FIELDS[0].label);
    expect(annahmen[0].split(';')[1]).toBe(String(c.assumptions[COST_ASSUMPTION_FIELDS[0].key]));
    expect(text).toContain('netto');
    expect(text.endsWith('\r\n')).toBe(true);
    // finanzierte Gerätezeilen tragen den Hinweis
    expect(lines.find((l) => l.startsWith('Geräte;Kraftgeräte;'))).toContain('Finanzierungsrate');
  });

  it('Zahlen mit Dezimalkomma, Summen ganzzahlig', () => {
    const p = createEmptyProject('Leer');
    p.costs = { mieteEurM2Monat: 9.5 };
    const text = costsCsvText(p);
    expect(text).toContain('Miete;9,5;€/m²');
    const monat = text.split('\r\n').find((l) => l.startsWith('Laufend;Miete;'))!;
    expect(monat.split(';')[4]).toBe('9,5');
  });
});

describe('Kosten-PDF', () => {
  it('buildPdf hängt Kostenseiten an (mit und ohne Finanzierung)', async () => {
    const p = getTemplate('studio-400')!.create();
    const withCosts = await buildPdf(p, { floorIds: ['x'], areaBalance: false, bom: false, regulations: false, costs: true });
    const without = await buildPdf(p, { floorIds: ['x'], areaBalance: false, bom: false, regulations: false, costs: false });
    expect(without.doc.getNumberOfPages()).toBe(1);
    expect(withCosts.doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    const bar = await buildPdf({ ...p, costs: { finanzierungJahre: 0 } }, { floorIds: ['x'], areaBalance: false, bom: false, regulations: false, costs: true });
    expect(bar.doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    const empty = await buildPdf(createEmptyProject('Leer'), { floorIds: ['x'], areaBalance: false, bom: false, regulations: false });
    expect(empty.doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
});
