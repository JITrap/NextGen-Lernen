/**
 * Werkzeug „Fluchtweg“ ('escape-route'): Klicks setzen die Punkte einer Polylinie (mit Snapping), Doppelklick/Enter
 * schließt ab und legt eine Fluchtweg-Anmerkung an. Esc bricht ab. (Gerüst – Implementierung folgt.)
 */
import { registerTool } from './registry';

registerTool({
  id: 'escape-route',
  cursor: 'crosshair',
  hint: 'Fluchtweg: Klicks setzen Punkte · Doppelklick/Enter beendet am Notausgang · Esc bricht ab',
});
