import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor, within } from '@testing-library/react';
import { useProjectStore, loadProject } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { createEmptyProject } from '@/store/factories';
import { BUILTIN_LIBRARY, getDef } from '@/data/equipment';
import { LibraryPanel, useLibraryUi, filterLibrary, groupLibrary, placeDefAtViewCenter, RACK_MODULE_HINT, EVOLUTION_HINT } from './LibraryPanel';
import { RightPanel } from './RightPanel';

beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
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

function resetLibraryUi() {
  useLibraryUi.setState({ query: '', area: '', manufacturer: '', series: '', muscle: '', favoritesOnly: false, verifiedOnly: false, filtersOpen: true, openGroups: {} });
}

beforeEach(() => {
  cleanup();
  loadProject(createEmptyProject('Testprojekt'));
  useUiStore.setState({ tool: 'select', selection: [], toolOptions: {}, toasts: [], viewport: { scale: 0.25, x: 80, y: 60 }, rightPanel: 'library', draggingDefId: null });
  resetLibraryUi();
});

const search = async (text: string) => {
  const input = screen.getByLabelText('Bibliothek durchsuchen') as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  await waitFor(() => expect(useLibraryUi.getState().query).toBe(text));
};
const list = () => screen.getByRole('list', { name: 'Bibliothekseinträge' });
const rows = () => within(list()).getAllByRole('listitem');

describe('LibraryPanel – Suche & Filter (reine Funktionen)', () => {
  it('filterLibrary findet „Leg Press“ in Name/Modell und gruppiert nach Serie', () => {
    const index = new Map(BUILTIN_LIBRARY.map((d) => [d.id, [d.name, d.modell, d.serie, d.hersteller, d.unterkategorie, d.kategorie].join(' ').toLowerCase()]));
    const { filtered } = filterLibrary(BUILTIN_LIBRARY, { query: 'leg press', area: '', manufacturer: '', series: '', muscle: '', favoritesOnly: false, verifiedOnly: false }, new Set(), index);
    expect(filtered.length).toBeGreaterThan(0);
    for (const d of filtered) expect(`${d.name} ${d.modell ?? ''} ${d.unterkategorie}`.toLowerCase()).toContain('leg press');
    const groups = groupLibrary(filtered);
    expect(groups.some((g) => g.label === 'Hybrid' && g.sub === 'Prime')).toBe(true);
    // Prime-Filter
    const prime = filterLibrary(BUILTIN_LIBRARY, { query: '', area: '', manufacturer: 'Prime', series: '', muscle: '', favoritesOnly: false, verifiedOnly: false }, new Set(), index).filtered;
    expect(prime.length).toBe(70);
    expect(prime.every((d) => d.hersteller === 'Prime')).toBe(true);
    // Muskelgruppe + Favoriten
    const fav = filterLibrary(BUILTIN_LIBRARY, { query: '', area: 'Kraftgeräte', manufacturer: '', series: '', muscle: 'Beine', favoritesOnly: true, verifiedOnly: true }, new Set(['atlantis-c403']), index).filtered;
    expect(fav.map((d) => d.id)).toEqual(['atlantis-c403']);
  });

  it('Suche „C513“: exakter Modelltreffer (Power rack) steht vor Einträgen, die das Modell nur erwähnen', () => {
    const index = new Map(BUILTIN_LIBRARY.map((d) => [d.id, [d.name, d.modell, d.serie, d.hersteller, d.unterkategorie, d.kategorie, ...(d.tags ?? [])].join(' ').toLowerCase()]));
    const { filtered } = filterLibrary(BUILTIN_LIBRARY, { query: 'c513', area: '', manufacturer: '', series: '', muscle: '', favoritesOnly: false, verifiedOnly: false }, new Set(), index);
    expect(filtered.some((d) => d.id === 'atlantis-c513')).toBe(true);
    const groups = groupLibrary(filtered, 'c513');
    expect(groups[0].defs[0].id).toBe('atlantis-c513');
    // ohne Suchanfrage bleibt die Standardreihenfolge (Bereich, Hersteller, Serie)
    const plain = groupLibrary(filtered);
    expect(plain.map((g) => g.key).sort()).toEqual(groups.map((g) => g.key).sort());
  });
});

describe('LibraryPanel – Komponente', () => {
  it('rendert Suchfeld, Filter und Einträge', () => {
    render(<LibraryPanel />);
    expect(screen.getByLabelText('Bibliothek durchsuchen')).toBeInTheDocument();
    expect(screen.getByLabelText('Hersteller')).toBeInTheDocument();
    expect(screen.getByLabelText('Bereich')).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toMatch(/Einträge in \d+ Gruppen/);
    expect(document.querySelector('[data-tutorial="library"]')).not.toBeNull();
    // Gruppen sind bei vielen Einträgen eingeklappt (Überschriften vorhanden)
    expect(within(list()).getAllByRole('button', { expanded: false }).length).toBeGreaterThan(3);
  });

  it('Suche „Leg Press“ filtert auf passende Einträge (debounced)', async () => {
    render(<LibraryPanel />);
    await search('Leg Press');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const visible = rows();
    for (const r of visible) {
      const def = getDef(r.getAttribute('data-def-id') ?? '', useProjectStore.getState().project)!;
      expect(def).toBeDefined();
      // Treffer in Name, Modell oder Unterkategorie (z. B. Atlantis C706 „Adjustable Leg Platform“, Unterkategorie „Leg Press“)
      expect(`${def.name} ${def.modell ?? ''} ${def.unterkategorie}`.toLowerCase()).toContain('leg press');
    }
    expect(visible.some((r) => r.textContent?.includes('Horizontal leg press'))).toBe(true);
    expect(visible.some((r) => r.textContent?.includes('Power rack'))).toBe(false);
    expect(screen.getByRole('status').textContent).toMatch(/^\d+ Einträge/);
  });

  it('Filter Hersteller „Prime“ zeigt nur Prime-Einträge', async () => {
    render(<LibraryPanel />);
    fireEvent.change(screen.getByLabelText('Hersteller'), { target: { value: 'Prime' } });
    expect(useLibraryUi.getState().manufacturer).toBe('Prime');
    // Gruppenköpfe: nur Prime
    const headers = within(list()).getAllByRole('button', { expanded: false });
    expect(headers.length).toBeGreaterThan(0);
    for (const h of headers) expect(h.textContent).toContain('Prime');
    // Serien-Select hängt vom Hersteller ab
    const series = screen.getByLabelText('Serie') as HTMLSelectElement;
    const options = Array.from(series.options).map((o) => o.value).filter(Boolean);
    expect(options).toContain('Evolution');
    expect(options).not.toContain('Precision Series');
    // alle aufklappen → jede Zeile Prime, keine Atlantis
    fireEvent.click(screen.getByTitle('Alle Gruppen aufklappen'));
    await waitFor(() => expect(rows().length).toBe(70));
    for (const r of rows()) {
      expect(r.textContent).toContain('Prime');
      expect(r.textContent).not.toContain('Atlantis');
    }
    // Zurücksetzen
    fireEvent.click(screen.getByTitle('Alle Filter und die Suche zurücksetzen'));
    expect(useLibraryUi.getState().manufacturer).toBe('');
  });

  it('Favoriten-Stern ruft toggleFavorite und markiert den Eintrag', async () => {
    render(<LibraryPanel />);
    await search('Power rack C513');
    await waitFor(() => expect(rows().length).toBe(1));
    const spy = vi.spyOn(useProjectStore.getState(), 'toggleFavorite');
    fireEvent.click(screen.getByRole('button', { name: 'Als Favorit markieren' }));
    expect(spy).toHaveBeenCalledWith('atlantis-c513');
    expect(useProjectStore.getState().project.favorites).toContain('atlantis-c513');
    expect(screen.getByRole('button', { name: 'Favorit entfernen' })).toHaveAttribute('aria-pressed', 'true');
    spy.mockRestore();
    // „Nur Favoriten“ zeigt genau diesen Eintrag
    fireEvent.change(screen.getByLabelText('Bibliothek durchsuchen'), { target: { value: '' } });
    await waitFor(() => expect(useLibraryUi.getState().query).toBe(''));
    fireEvent.click(screen.getByRole('button', { name: /Nur Favoriten/ }));
    await waitFor(() => expect(rows().length).toBe(1));
    expect(rows()[0].textContent).toContain('Power rack');
  });

  it('Rack-Modul zeigt den Andock-Hinweis', async () => {
    render(<LibraryPanel />);
    await search('MS8');
    await waitFor(() => expect(rows().length).toBe(1));
    expect(screen.getAllByTitle(RACK_MODULE_HINT).length).toBeGreaterThan(0);
    expect(rows()[0].textContent).toContain('Rack-Modul');
  });

  it('Prime Evolution trägt den gelben Händler-Hinweis, ungeprüfte Einträge das graue Badge', async () => {
    render(<LibraryPanel />);
    await search('Evolution Leg Press');
    await waitFor(() => expect(rows().length).toBe(1));
    expect(screen.getAllByTitle(EVOLUTION_HINT).length).toBeGreaterThan(0);
    expect(rows()[0].textContent).toContain('verifiziert');
  });

  it('„Platzieren“ legt das Objekt mit Originalmaßen in der Bildmitte an und wählt es aus', async () => {
    render(<LibraryPanel />);
    await search('Power rack C513');
    await waitFor(() => expect(rows().length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Power rack platzieren' }));
    const floor = useProjectStore.getState().project.floors[0];
    expect(floor.items.length).toBe(1);
    expect([floor.items[0].width, floor.items[0].depth, floor.items[0].height]).toEqual([165, 203, 246]);
    expect(floor.items[0].defId).toBe('atlantis-c513');
    expect(useUiStore.getState().selection).toEqual([{ kind: 'item', id: floor.items[0].id }]);
    expect(useUiStore.getState().tool).toBe('select');
    // Doppelklick auf die Zeile platziert ebenfalls
    fireEvent.doubleClick(rows()[0]);
    expect(useProjectStore.getState().project.floors[0].items.length).toBe(2);
  });

  it('Drag-Start setzt draggingDefId, Drag-Ende löscht es', async () => {
    render(<LibraryPanel />);
    await search('Power rack C513');
    await waitFor(() => expect(rows().length).toBe(1));
    const row = rows()[0];
    expect(row).toHaveAttribute('draggable', 'true');
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => { data[k] = v; }, effectAllowed: '' };
    fireEvent.dragStart(row, { dataTransfer });
    expect(useUiStore.getState().draggingDefId).toBe('atlantis-c513');
    expect(data['application/x-gymplanner-def']).toBe('atlantis-c513');
    fireEvent.dragEnd(row, { dataTransfer });
    expect(useUiStore.getState().draggingDefId).toBeNull();
  });

  it('reagiert auf libraryFocusDefId („In Bibliothek zeigen“) und setzt den Schlüssel zurück', async () => {
    render(<LibraryPanel />);
    act(() => {
      useUiStore.getState().setToolOption('libraryFocusDefId', 'prime-hybrid-leg-press');
    });
    await waitFor(() => expect(useUiStore.getState().toolOptions.libraryFocusDefId).toBe(''));
    expect(useLibraryUi.getState().query).toBe('Leg Press');
    await waitFor(() => expect(document.querySelector('[data-def-id="prime-hybrid-leg-press"]')).not.toBeNull());
  });

  it('Detail-Popover zeigt alle Felder inkl. Herstellerlink', async () => {
    render(<LibraryPanel />);
    await search('Power rack C513');
    await waitFor(() => expect(rows().length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Details zu Power rack' }));
    const dialog = await screen.findByRole('dialog', { name: 'Gerätedetails' });
    expect(dialog.textContent).toContain('165 × 203 × 246 cm');
    expect(dialog.textContent).toContain('253 kg');
    const link = dialog.querySelector('a[target="_blank"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.rel).toContain('noopener');
    expect(link.href).toContain('atlantisstrength.com');
  });

  it('legt eigene Geräte über das Formular an (Validierung, ID „custom-…“) und listet sie', async () => {
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Eigenes Gerät/ }));
    const dialog = await screen.findByRole('dialog', { name: /Eigenes Gerät anlegen/ });
    // leeres Absenden → Fehler
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    expect(dialog.textContent).toContain('Bitte einen Namen eingeben.');
    fireEvent.change(screen.getByPlaceholderText('z. B. Kabelzugturm 2 Stationen'), { target: { value: 'Testturm' } });
    fireEvent.change(screen.getByLabelText(/^Breite \*/), { target: { value: '120,5' } });
    fireEvent.change(screen.getByLabelText(/^Tiefe \*/), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText(/^Höhe/), { target: { value: '230' } });
    fireEvent.change(screen.getByLabelText(/^Preis/), { target: { value: '1999,90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(useProjectStore.getState().project.customEquipment.length).toBe(1));
    const def = useProjectStore.getState().project.customEquipment[0];
    expect(def.id.startsWith('custom-')).toBe(true);
    expect([def.breite_cm, def.tiefe_cm, def.hoehe_cm, def.preis_eur]).toEqual([120.5, 80, 230, 1999.9]);
    expect(def.benutzerdefiniert).toBe(true);
    expect(getDef(def.id, useProjectStore.getState().project)).toBeDefined();
    // erscheint in der Liste (Gruppe „Eigene Geräte“ zuerst) und in der Bereichszählung
    await waitFor(() => expect(screen.getAllByText('Testturm').length).toBeGreaterThan(0));
    expect((screen.getByLabelText('Bereich') as HTMLSelectElement).textContent).toContain('Eigene (1)');
    // platzieren funktioniert auch für eigene Geräte
    const id = placeDefAtViewCenter(def);
    expect(id).not.toBeNull();
    expect(useProjectStore.getState().project.floors[0].items[0].width).toBe(120.5);
  });
});

describe('RightPanel', () => {
  it('zeigt die Tabs mit Auswahl-Marke und wechselt das Panel', () => {
    useUiStore.setState({ selection: [{ kind: 'item', id: 'a' }, { kind: 'item', id: 'b' }] });
    render(<RightPanel />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/\d+/g, '').trim())).toEqual(['Bibliothek', 'Eigenschaften', 'Übersicht', 'Ebenen', 'Projekte']);
    expect(screen.getByTestId('properties-badge').textContent).toBe('2');
    expect(document.querySelector('[data-tutorial="right-panel"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Eigenschaften/ }));
    expect(useUiStore.getState().rightPanel).toBe('properties');
    expect(document.querySelector('[data-tutorial="properties"]')).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Felder & Eigenschaften-Panel                                        */
/* ------------------------------------------------------------------ */

import { NumberField, LengthField, formatPlain } from './fields';
import { PropertiesPanel } from './PropertiesPanel';
import { createItemFromDef } from '@/store/factories';

describe('NumberField / LengthField', () => {
  it('formatiert ohne Tausenderpunkt und übernimmt nur geänderte Eingaben (Komma, Einheit, Pfeiltasten)', () => {
    expect(formatPlain(1250, 0)).toBe('1250');
    expect(formatPlain(12.5, 1)).toBe('12,5');
    expect(formatPlain(12.5, 0)).toBe('13');
    expect(formatPlain(3.14159, 2)).toBe('3,14');
    expect(formatPlain(-0.001, 2)).toBe('0');
    // Feld mit 0 Nachkommastellen zeigt vorhandene Präzision trotzdem (12,5 statt 13)
    const r = render(<LengthField ariaLabel="Halb" value={12.5} onChange={() => {}} decimals={0} />);
    expect((screen.getByLabelText('Halb') as HTMLInputElement).value).toBe('12,5');
    r.unmount();
    const onChange = vi.fn();
    render(<LengthField ariaLabel="Länge" value={1250} onChange={onChange} decimals={0} step={1} />);
    const input = screen.getByLabelText('Länge') as HTMLInputElement;
    expect(input.value).toBe('1250');
    // Fokus + Blur ohne Änderung → kein onChange (keine Rundungsänderung)
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    // Eingabe mit Einheit und Komma
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '3,5 m' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(350);
    // Pfeiltasten: ±Schritt, Shift ±10×
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(1251);
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(1241);
    // Ungültig → verworfen
    onChange.mockClear();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('NumberField klemmt min/max und erlaubt leer bei allowEmpty', () => {
    const onChange = vi.fn();
    render(<NumberField ariaLabel="Preis" value={100} onChange={onChange} min={0} max={500} allowEmpty />);
    const input = screen.getByLabelText('Preis') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '900' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(500);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('PropertiesPanel', () => {
  const placeRack = () => {
    const st = useProjectStore.getState();
    const def = getDef('atlantis-c513')!;
    const item = createItemFromDef(def, 500, 400);
    st.addItem(st.project.activeFloorId, item);
    return item;
  };

  it('ohne Auswahl und Halle: Stockwerk-Felder und Halle-Buttons', () => {
    render(<PropertiesPanel />);
    expect(document.querySelector('[data-tutorial="properties"]')).not.toBeNull();
    expect(screen.getByText('EG')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Rechteck aufziehen/ }));
    expect(useUiStore.getState().tool).toBe('hall-rect');
    const ceiling = screen.getByLabelText('Deckenhöhe') as HTMLInputElement;
    fireEvent.focus(ceiling);
    fireEvent.change(ceiling, { target: { value: '2,4 m' } });
    fireEvent.keyDown(ceiling, { key: 'Enter' });
    expect(useProjectStore.getState().project.floors[0].ceilingHeight).toBe(240);
  });

  it('mit Halle: Flächen, Wandstärke, Eckpunkte editierbar, Kantenlänge verschiebt den nächsten Punkt', () => {
    act(() => {
      const st = useProjectStore.getState();
      st.setHall(st.project.activeFloorId, { polygon: [{ x: 0, y: 0 }, { x: 2500, y: 0 }, { x: 2500, y: 2000 }, { x: 0, y: 2000 }], wallThickness: 24, floorCovering: 'Gummiboden' });
    });
    render(<PropertiesPanel />);
    expect(screen.getAllByText('500,00 m²').length).toBeGreaterThan(0);
    expect(screen.getByText('Fläche netto')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Außenwandstärke'), { target: { value: '17.5' } });
    expect(useProjectStore.getState().project.floors[0].hall!.wallThickness).toBe(17.5);
    // Eckpunkte-Abschnitt öffnen und Kante 1 (P1→P2) auf 30 m setzen
    fireEvent.click(screen.getByRole('button', { name: /Eckpunkte & Kanten/ }));
    const edge = screen.getByLabelText('Kante 1 Länge') as HTMLInputElement;
    fireEvent.focus(edge);
    fireEvent.change(edge, { target: { value: '30 m' } });
    fireEvent.keyDown(edge, { key: 'Enter' });
    expect(useProjectStore.getState().project.floors[0].hall!.polygon[1]).toEqual({ x: 3000, y: 0 });
  });

  it('Objekt: gesperrte Originalmaße, Drehung, Preis, „Zur Bibliothek“', () => {
    const item = placeRack();
    useUiStore.setState({ selection: [{ kind: 'item', id: item.id }] });
    render(<PropertiesPanel />);
    expect(screen.getByRole('heading', { name: 'Power rack' })).toBeInTheDocument();
    expect(screen.getByText('Originalmaß, nicht skalierbar')).toBeInTheDocument();
    expect(screen.getByText(/B × T × H: 165 × 203 × 246 cm/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Drehung 90°'));
    expect(useProjectStore.getState().project.floors[0].items[0].rotation).toBe(90);
    const price = screen.getByLabelText('Preis (netto)') as HTMLInputElement;
    fireEvent.focus(price);
    fireEvent.change(price, { target: { value: '4999,50' } });
    fireEvent.keyDown(price, { key: 'Enter' });
    expect(useProjectStore.getState().project.floors[0].items[0].priceEur).toBe(4999.5);
    fireEvent.click(screen.getByRole('button', { name: /Zur Bibliothek/ }));
    expect(useUiStore.getState().toolOptions.libraryFocusDefId).toBe('atlantis-c513');
    expect(useUiStore.getState().rightPanel).toBe('library');
  });

  it('Objekt höher als Decke zeigt rote Warnung; Mehrfachauswahl zeigt Anzahl und Summengewicht', () => {
    act(() => {
      const st = useProjectStore.getState();
      st.setFloorCeilingHeight(st.project.activeFloorId, 240);
    });
    const a = placeRack();
    const b = placeRack();
    useUiStore.setState({ selection: [{ kind: 'item', id: a.id }] });
    const { unmount } = render(<PropertiesPanel />);
    expect(screen.getByRole('alert').textContent).toContain('überschreitet die Deckenhöhe');
    unmount();
    useUiStore.setState({ selection: [{ kind: 'item', id: a.id }, { kind: 'item', id: b.id }] });
    render(<PropertiesPanel />);
    expect(screen.getByRole('heading', { name: '2 Objekte' })).toBeInTheDocument();
    expect(screen.getByText(/Gesamtgewicht 506 kg/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gruppieren' }));
    expect(useProjectStore.getState().project.floors[0].groups.length).toBe(1);
  });

  it('Wand: Länge numerisch setzen, Typ ändern, teilen', () => {
    act(() => {
      const st = useProjectStore.getState();
      st.addWall(st.project.activeFloorId, { id: 'w_1', start: { x: 0, y: 0 }, end: { x: 300, y: 0 }, thickness: 12.5, type: 'Trockenbau', height: null });
    });
    useUiStore.setState({ selection: [{ kind: 'wall', id: 'w_1' }] });
    render(<PropertiesPanel />);
    const len = screen.getByLabelText(/Länge \(Achsmaß\)/) as HTMLInputElement;
    expect(len.value).toBe('300');
    fireEvent.focus(len);
    fireEvent.change(len, { target: { value: '450' } });
    fireEvent.keyDown(len, { key: 'Enter' });
    expect(useProjectStore.getState().project.floors[0].walls[0].end).toEqual({ x: 450, y: 0 });
    fireEvent.change(screen.getByLabelText('Typ'), { target: { value: 'Glaswand' } });
    expect(useProjectStore.getState().project.floors[0].walls[0].type).toBe('Glaswand');
    fireEvent.click(screen.getByRole('button', { name: /Wand teilen/ }));
    expect(useProjectStore.getState().project.floors[0].walls.length).toBe(2);
  });

  it('Öffnung (Tür): Typ ändert Standardhöhe, Anschlag umkehrbar', () => {
    act(() => {
      const st = useProjectStore.getState();
      st.addWall(st.project.activeFloorId, { id: 'w_1', start: { x: 0, y: 0 }, end: { x: 400, y: 0 }, thickness: 12.5, type: 'Trockenbau', height: null });
      st.addOpening(st.project.activeFloorId, { id: 'o_1', kind: 'door', wallId: 'w_1', offset: 200, width: 90, height: 210, doorType: 'einflügelig', hinge: 'left', swingSide: 'a' });
    });
    useUiStore.setState({ selection: [{ kind: 'opening', id: 'o_1' }] });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Türtyp'), { target: { value: 'Rolltor' } });
    const o = () => useProjectStore.getState().project.floors[0].openings[0] as { height: number; hinge: string; offset: number };
    expect(o().height).toBe(300);
    fireEvent.click(screen.getByRole('button', { name: /Anschlag umkehren/ }));
    expect(o().hinge).toBe('right');
    const pos = screen.getByLabelText(/Position ab Wandanfang/) as HTMLInputElement;
    fireEvent.focus(pos);
    fireEvent.change(pos, { target: { value: '10' } });
    fireEvent.keyDown(pos, { key: 'Enter' });
    expect(o().offset).toBe(45); // auf halbe Breite geklemmt
  });
});
