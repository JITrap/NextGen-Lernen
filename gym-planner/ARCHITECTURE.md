# GymPlanner – Architektur & Konventionen

Alle Längen intern in **cm** (1 Einheit = 1 cm), Winkel in Grad (im Uhrzeigersinn, y nach unten), Gewichte in kg.
Anzeige über `src/geometry/units.ts` (Komma als Dezimaltrennzeichen: `formatM2(12.45) → "12,45 m²"`).
Oberflächensprache: **Deutsch** (alle Labels, Hinweise, Tooltips).

## Verzeichnisse

| Pfad | Inhalt |
|---|---|
| `data/atlantis.json`, `data/prime.json` | Herstellerdaten (verifiziert). **Nie von Hand ändern**, Quelle der Wahrheit. |
| `src/types/model.ts` | Domänenmodell (Project, Floor, Hall, Wall, Zone/Room, Opening, PlacedItem, EquipmentDef …). |
| `src/geometry/` | Reine Funktionen: `polygon` (Shoelace, Offset, Schnitt), `units`, `transform` (Objekt-Footprints), `walls`, `rooms`, `snap`, `collision`. |
| `src/store/projectStore.ts` | Zustand-Store des Projekts, **alle Mutationen laufen hier durch** (Immer). Undo/Redo via zundo (`undo()`, `redo()`, `transaction(fn)`, `beginTransaction()/endTransaction()` für Drags). |
| `src/store/uiStore.ts` | Transienter UI-Zustand (Werkzeug, Auswahl, Viewport, Panels, Theme, Toasts, Kontextmenü). Nicht in der Undo-Historie. |
| `src/store/selectors.ts` | Hooks: `useActiveFloor()`, `useFloorRooms(floor)`, `useFloorWalls(floor)`, `useFloorVisibleItems(floor)`, `useLowerFloor()`. |
| `src/store/factories.ts` | `createEmptyProject`, `createFloor`, `createHall`, `createWall`, `createZone`, `createItemFromDef`, `duplicateFloor`. |
| `src/data/equipment/index.ts` | Bibliothek: `BUILTIN_LIBRARY`, `getDef(id, project)`, `fullLibrary(project)`. Generische Objekte in `generic.json` (EquipmentDef-Format inkl. `bereich`, `symbol`). |
| `src/data/roomTypes.ts`, `wallTypes.ts` | Raumtypen (Farbe, Flächenklasse), Wandtypen/-stärken, Türtypen/-breiten. |
| `src/editor/Canvas.tsx` | Konva-Stage, Viewport (Zoom/Pan/Pinch), Ebenen-Reihenfolge, Werkzeug-Dispatch, Drop aus Bibliothek. |
| `src/editor/layers/*` | Eine Komponente je Ebene; erhält `LayerProps` und rendert eine Konva-`<Group>` in **Weltkoordinaten** (Stage ist bereits skaliert; Linienbreiten mit `1 / viewport.scale` konstant halten). |
| `src/editor/tools/*` | Ein Werkzeug je Datei, registriert per `registerTool({...})` (Interface in `tools/types.ts`). Transienter Zustand über `createToolStore()`. |
| `src/editor/actions.ts` | Aktionen auf der Auswahl (Löschen, Duplizieren, Drehen, Ausrichten, Gruppieren …) – von Kürzeln, Kontextmenü, Panels genutzt. |
| `src/editor/hitTest.ts` | Objekt unter dem Cursor bestimmen. |
| `src/editor/overlays/SnapGuides.tsx` | `useSnapGuides.getState().set(result)` – Werkzeuge melden ihr Snap-Ergebnis, Canvas zeichnet Hilfslinien. |
| `src/editor/stageRegistry.ts` | `getStage()` für PNG/PDF-Export. |
| `src/components/*` | UI-Panels (TopBar, Toolbar, RightPanel mit Bibliothek/Eigenschaften/Übersicht/Ebenen/Projekte, StatusBar, ContextMenu, ShortcutsOverlay, Tutorial, Toasts). |
| `src/analysis/*` | Flächenbilanz, Gerätestatistik, Bodenlast, Kapazität, Stückliste, Warnungen. |
| `src/export/*` | PNG, PDF, CSV, JSON. |
| `src/three/View3D.tsx` | 3D-Vorschau (react-three-fiber). |

## Konventionen

- Objekt-Koordinaten: `x/y` = Mittelpunkt, `width` entlang lokaler x-Achse, `depth` entlang lokaler y-Achse, `rotation` in Grad. **„Vorne“ = +y lokal** (bei rotation 0 unten). Footprint: `itemFootprint(item)`, Sicherheitszone: `itemSafetyPolygon(item, zone)`.
- Wände: Achse `start→end`, `thickness`. Hallen-Außenwände sind virtuelle Wände mit IDs `hall_<i>` (`allWalls(floor)`, `findWall(floor, id)`), Öffnungen können daran hängen.
- Räume: automatisch aus geschlossenen Wandzügen (`floorRooms(floor)`, Metadaten in `floor.roomMeta[loopKey]`) oder Zonen (`floor.zones`).
- Treppen/Aufzüge: `PlacedItem` mit `linkedFloorIds`; erscheinen auf allen verlinkten Stockwerken (`useFloorVisibleItems`).
- Alle Mutationen im Store; während Drag `beginTransaction()` … `endTransaction()` (ein Undo-Schritt).
- Styling: Tailwind 4 + CSS-Variablen `--gp-*` (Hell/Dunkel über `.dark`). Helferklassen: `gp-panel`, `gp-btn`, `gp-btn-primary`, `gp-input`, `gp-label`, `gp-card`, `gp-tool`, `gp-tab`, `gp-kbd`.
- Icons: `lucide-react`.
- Tests: Vitest, Dateien `*.test.ts` neben dem Modul.
