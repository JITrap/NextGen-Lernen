# GymPlanner – Raum- und Einrichtungsplaner für Fitnessstudios

GymPlanner ist eine vollständig im Browser laufende Web-App, mit der ein Fitnessstudio
maßstabsgetreu geplant wird: Halle, Wände, Räume, Stockwerke, Türen und Fenster, Geräte
(Atlantis Strength und Prime Fitness mit verifizierten Originalmaßen), Umkleiden, Wellness,
Flächenbilanz, Bodenlast, Kapazität, Stückliste und Export als PNG/PDF/CSV/JSON.
Es wird kein Backend benötigt; alle Daten bleiben im Browser (IndexedDB/localStorage).

## Start

```bash
cd gym-planner
npm install
npm run dev        # Entwicklungsserver, Ausgabe zeigt die URL (Standard http://localhost:5173)
```

Weitere Befehle:

```bash
npm run build      # Produktions-Build nach dist/
npm run preview    # Produktions-Build lokal ansehen
npm test           # Vitest (Flächen, Snapping, Kollision, Einheiten, Bibliothek, Analyse, Export …)
npm run typecheck  # TypeScript-Prüfung
npm run lint       # ESLint
```

Voraussetzungen: Node.js 20 oder neuer.

## Vorlagen & Beispielprojekt

Beim ersten Start öffnet die App das **Beispielstudio 1.000 m²** (40 × 25 m): ein vollständig eingerichtetes
Muster-Studio mit Empfang/Lounge, Büro, Personalraum, barrierefreiem WC, Umkleiden mit Duschen und WCs, Freihantelbereich
mit zwei Power Racks, Half Rack, Kreuzheben-Plattform und Spiegelwand, zwei Reihen Prime-Hybrid-Maschinen, einer
Plate-Loaded-Reihe, 18 Cardio-Geräten am Fensterband, Functional-Bereich mit Rig und Sled-Bahn, Kursraum mit Spiegelwand
und Indoor-Cycling, Wellness mit Sauna, Infrarotkabine, Cold Plunge und Ruheliegen sowie Lager, Technik und Putzraum.
Die Vorlage startet ohne Kollisions-, Tür-, Notausgang- oder Laufweg-Warnungen; Spinde, Duschen und WCs reichen laut
Kapazitätsanalyse für die berechnete Personenzahl.

Weitere Vorlagen unter **Projekte → Neues Projekt**: leere Halle 20 × 25 m, kleines Studio 400 m², mittleres Studio 800 m².

Das Beispielstudio liegt zusätzlich als Projektdatei in `examples/Beispielstudio-1000.gymplanner.json` und lässt sich
über **Projekte → JSON importieren** in jede Installation laden.

## Technik

| Bereich | Wahl | Begründung |
|---|---|---|
| UI | React 19 + TypeScript + Vite 8 | schnelle Entwicklung, strikte Typen |
| 2D-Editor | Konva.js (react-konva) | Canvas-Rendering bleibt auch mit 500+ Objekten flüssig, da nur die Ebenen neu gezeichnet werden, die sich ändern; Hit-Tests laufen in eigener Geometrie (`src/editor/hitTest.ts`) statt über DOM-Knoten wie bei SVG |
| Zustand | Zustand + zundo (Undo/Redo, 200 Schritte) + Immer | kleine API, Historie ohne Boilerplate |
| Styling | Tailwind CSS 4, Hell-/Dunkelmodus über CSS-Variablen | |
| 3D | three.js / react-three-fiber | Wände, Öffnungen und Geräte mit echter Höhe |
| Speicherung | IndexedDB (idb-keyval) + localStorage, JSON-Import/-Export | |
| Tests | Vitest | Kernlogik: Flächen (Shoelace), Snapping, Kollision, Einheiten, Bibliothek gegen `data/*.json` |

Interne Einheit: **1 = 1 cm**. Anzeige in m, cm und m² mit Komma als Dezimaltrennzeichen.

## Bedienung in Kürze

- **Halle** (H): Rechteck aufziehen oder Polygon zeichnen; Eckpunkte und Kanten sind per Drag verschiebbar, Kantenlängen per Doppelklick numerisch eingebbar.
- **Wände** (W): Klick-Klick-Kette, Zahlen tippen für exakte Länge, Enter/Doppelklick beendet.
- **Räume** entstehen automatisch aus geschlossenen Wandzügen oder als Zonen (Z).
- **Türen/Fenster/Spiegel** sitzen immer in einer Wand und lassen sich an ihr entlang ziehen.
- **Geräte** per Drag & Drop aus der Bibliothek (rechts). Maße sind auf Originalmaß gesperrt; R dreht um 90°, der Griff frei mit 15°-Snapping.
- **Stockwerke** über die Tabs oben; Treppen und Aufzüge erscheinen auf allen verbundenen Stockwerken.
- **Übersicht** (rechts): Flächenbilanz, Gerätestatistik, Bodenlast, Kapazität, Stückliste, Planungs-Warnungen (Klick springt zum Problem).
- **?** zeigt alle Tastenkürzel. Alt hält Snapping vorübergehend aus.

## Objektbibliothek erweitern

Die Herstellerdaten liegen in `data/atlantis.json` (132 Geräte) und `data/prime.json` (70 Geräte).
Sie sind die Quelle der Wahrheit; ein Test (`src/data/equipment/library.test.ts`) prüft, dass die
Bibliothek exakt diese Maße enthält. Generische Objekte (Cardio, Umkleide, Wellness, Möbel,
Bauelemente …) liegen in `src/data/equipment/generic.json`.

### Neues Gerät in der App anlegen

Bibliothek → Bereich „Eigene“ → **+ Eigenes Gerät**. Das Formular enthält alle Felder
(Name, Hersteller, Serie, Modell, B × T × H, Gewicht, Sicherheitszone, Preis, Quelle, …).
Eigene Geräte werden im Projekt gespeichert und mit dem JSON-Export mitgenommen.

### Neues Gerät dauerhaft in die Bibliothek eintragen

1. Eintrag in `data/atlantis.json`, `data/prime.json` (verifizierte Herstellerdaten) oder
   `src/data/equipment/generic.json` (generische Objekte) ergänzen. Schema:

   ```jsonc
   {
     "id": "prime-hybrid-leg-press",          // eindeutig, klein, Bindestriche
     "kategorie": "Beine",                     // Muskelgruppe (Kraft) bzw. Bereichstext (generisch)
     "unterkategorie": "Hybrid",
     "hersteller": "Prime",                    // "Atlantis" | "Prime" | "Generisch" | frei
     "serie": "Hybrid", "modell": "Leg Press", "name": "Leg Press",
     "breite_cm": 120, "tiefe_cm": 191, "hoehe_cm": 181,   // Außenmaße; B = Width, T = Length, H = Height
     "gewicht_kg": 524,
     "extra": "Steckgewicht 229 kg",           // optional
     "hinweis": "…",                           // optional, wird in der App angezeigt
     "sicherheitszone_cm": { "vorne": 60, "hinten": 60, "links": 60, "rechts": 60 },
     "form": "rechteck",                       // "rechteck" | "polygon" | "kreis"
     "skalierbar": false,                      // Geräte: false; generische Objekte wie Bänke/Matten: true
     "preis_eur": 8990,                        // optional
     "quelle_url": "https://www.primefitnessusa.com/products/hybrid-leg-press",
     "verifiziert": true                       // true nur bei Maßen von der offiziellen Herstellerseite
   }
   ```

   Generische Einträge (`generic.json`) enthalten zusätzlich `"bereich"` (z. B. `"Cardio"`) und
   `"symbol"` (Draufsicht-Symbol, Liste `SymbolKind` in `src/types/model.ts`), optional `"params"`
   (z. B. `{ "faecher": 10 }` bei Spindreihen) und `"ohne_stellflaeche": true` für Mengenpositionen.
   Für Hersteller-Einträge werden Bereich, Muskelgruppe und Symbol automatisch abgeleitet
   (`src/data/equipment/index.ts`, Funktion `strengthSymbol`).
2. Bei Zoll-Angaben mit 1 in = 2,54 cm umrechnen und das im Feld `hinweis` vermerken.
3. `npm test` ausführen: prüft eindeutige IDs, Pflichtfelder und die Übereinstimmung mit den Datendateien.
4. Optional ein neues Draufsicht-Symbol in `src/editor/symbols/` registrieren.

Die Datendateien wurden aus den Tabellen der Spezifikation erzeugt (`scripts/build-data-from-spec.mjs`).

## Projektstruktur

Siehe `ARCHITECTURE.md`.

## Hinweise zu den Abnahmekriterien

- Eine 25 × 20 m Halle zeigt „500,00 m²“ (Brutto, Außenmaß). Der automatisch erkannte Innenraum zeigt die
  Nettofläche ohne Außenwand: bei 24 cm Wandstärke (2452 × 1952 cm²) = **478,63 m²**.
- Alle 202 Hersteller-Einträge tragen `verifiziert: true`; generische Objekte sind als „ungeprüft“ markiert und
  erscheinen in den Planungs-Warnungen als Hinweis.
- Undo/Redo umfasst 200 Schritte; zusammengesetzte Aktionen (Ziehen, Wandkette) sind jeweils ein Schritt.

## Speicherung & Export

- Autosave in IndexedDB (Fallback localStorage), mehrere Projekte und Varianten, Versionsverlauf.
- Export: PNG (hochauflösend), PDF (maßstäblich 1:50/1:100/1:200 mit Legende, Flächenbilanz und Stückliste), CSV (Stückliste, Excel-kompatibel), JSON (vollständiges Projekt; Import stellt es exakt wieder her).
