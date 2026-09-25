import { registerTool } from './registry';
import { hitTest } from '../hitTest';

/** Platzhalter: Klick wählt aus. Wird durch das vollständige Auswahl-Werkzeug ersetzt. */
registerTool({
  id: 'select',
  hint: 'Klicken: auswählen · Shift+Klick: mehrfach · Ziehen: verschieben/Rahmen',
  onPointerDown: (e, ctx) => {
    const hit = hitTest(e.world, { floor: ctx.floor, walls: ctx.walls, rooms: ctx.rooms, items: ctx.items, tolerance: ctx.pxToWorld(6), layers: ctx.project.layers });
    if (hit) ctx.ui.select(hit, e.shift); else if (!e.shift) ctx.ui.clearSelection();
  },
});
