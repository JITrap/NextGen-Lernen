import { useUiStore } from '@/store/uiStore';
import { Modal } from './ui/Modal';
import { KbdCombo } from './ui/Kbd';
import { Button } from './ui/Button';

interface ShortcutRow {
  keys: string[];
  label: string;
}
interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

/** Alle Tastenkürzel, gruppiert (Quelle für Übersicht und Tooltips). */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Werkzeuge',
    rows: [
      { keys: ['V'], label: 'Auswahl' },
      { keys: ['H'], label: 'Halle (Rechteck)' },
      { keys: ['W'], label: 'Wand' },
      { keys: ['Z'], label: 'Raum / Zone' },
      { keys: ['D'], label: 'Tür' },
      { keys: ['F'], label: 'Fenster' },
      { keys: ['M'], label: 'Messen' },
      { keys: ['T'], label: 'Text / Notiz' },
      { keys: ['Esc'], label: 'Abbrechen / zurück zur Auswahl' },
    ],
  },
  {
    title: 'Bearbeiten',
    rows: [
      { keys: ['R', 'Shift+R'], label: 'Drehen 90° / −90°' },
      { keys: ['Entf', 'Backspace'], label: 'Löschen' },
      { keys: ['Strg+Z'], label: 'Rückgängig' },
      { keys: ['Strg+Y', 'Strg+Shift+Z'], label: 'Wiederholen' },
      { keys: ['Strg+C', 'Strg+V'], label: 'Kopieren / Einfügen' },
      { keys: ['Strg+D'], label: 'Duplizieren' },
      { keys: ['Strg+G', 'Strg+Shift+G'], label: 'Gruppieren / Gruppe auflösen' },
      { keys: ['Strg+L'], label: 'Sperren / Entsperren' },
      { keys: ['←', '→', '↑', '↓'], label: 'Verschieben um 1 cm' },
      { keys: ['Shift+Pfeil'], label: 'Verschieben um 10 cm' },
    ],
  },
  {
    title: 'Ansicht',
    rows: [
      { keys: ['G'], label: 'Alles einpassen' },
      { keys: ['3'], label: '3D-Ansicht ein/aus' },
      { keys: ['Shift+P'], label: 'Präsentationsmodus' },
      { keys: ['Mausrad'], label: 'Zoomen' },
      { keys: ['Shift+Mausrad'], label: 'Ansicht verschieben' },
      { keys: ['Leertaste+Ziehen', 'Mittlere Maustaste'], label: 'Ansicht verschieben (Pan)' },
      { keys: ['Zwei Finger'], label: 'Zoomen und Verschieben (Touch)' },
    ],
  },
  {
    title: 'Auswahl & Zeichnen',
    rows: [
      { keys: ['Klick'], label: 'Objekt auswählen' },
      { keys: ['Shift+Klick'], label: 'Zur Auswahl hinzufügen' },
      { keys: ['Ziehen'], label: 'Rahmen aufziehen / verschieben' },
      { keys: ['Strg+A'], label: 'Alles auswählen' },
      { keys: ['Alt'], label: 'Snapping vorübergehend aus' },
      { keys: ['Rechtsklick'], label: 'Kontextmenü' },
      { keys: ['Doppelklick'], label: 'Stockwerk umbenennen (Tab)' },
      { keys: ['?'], label: 'Diese Übersicht' },
    ],
  },
];

/** Modal mit allen Tastenkürzeln (ui.showShortcuts). */
export function ShortcutsOverlay() {
  const open = useUiStore((s) => s.showShortcuts);
  const setOpen = useUiStore((s) => s.setShowShortcuts);
  const close = () => setOpen(false);
  return (
    <Modal
      open={open}
      onClose={close}
      title="Tastenkürzel"
      width={760}
      footer={
        <Button variant="primary" onClick={close} data-primary="true">
          Schließen
        </Button>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-1.5 gp-label">{g.title}</h3>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.label} className="border-t gp-border">
                    <td className="w-[46%] py-1.5 pr-2 align-top">
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        {r.keys.map((k, i) => (
                          <span key={k} className="inline-flex items-center gap-1.5">
                            {i > 0 && <span className="text-[10px] gp-muted">oder</span>}
                            <KbdCombo combo={k} />
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-1.5 align-top">{r.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs gp-muted">Auf dem Mac gilt ⌘ statt Strg. Kürzel wirken nicht, während ein Eingabefeld aktiv ist.</p>
    </Modal>
  );
}
