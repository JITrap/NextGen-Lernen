# Fluchtwege und Regularien-Prüfung

Werkzeug „Fluchtweg“ (Anmerkungstyp `EscapeRoute`), die Regularien-Prüfung `src/analysis/regulations.ts`, der Abschnitt
„Regularien & Brandschutz“ im Übersichts-Panel sowie die PDF-Seiten dazu. Die Prüfung ist eine **Planungshilfe** nach
ASR/DGUV/MBO – sie ersetzt kein Brandschutzkonzept und keine Abstimmung mit Bauaufsicht und Unfallversicherungsträger.

## Bedienung

### Fluchtweg zeichnen (Werkzeug `escape-route`, Kürzel **E**)

| Aktion | Wirkung |
|---|---|
| Klick | setzt einen Punkt (Snapping wie Messlinie: Raster, Wandknoten, Objektkanten; **Shift** = 45°-Winkel vom letzten Punkt) |
| Bewegung | Vorschau: gestrichelte Linie, Segmentlänge, Gesamtlänge und Punktzahl |
| Klick ≤ 60 cm neben einer Notausgangstür | rastet auf die Türmitte und **beendet** den Fluchtweg (ab 2 Punkten) |
| Doppelklick / **Enter** | beendet (mindestens 2 Punkte) |
| **Rücktaste** | entfernt den letzten Punkt |
| **Esc** | bricht ab |

Das Ergebnis ist eine Anmerkung mit Label „Fluchtweg n“ (n = Anzahl vorhandener Fluchtwege + 1) – ein Undo-Schritt.
Danach ist der Fluchtweg gewählt, das Eigenschaften-Panel offen und das Auswahl-Werkzeug aktiv. Ist die Ebene
„Anmerkungen“ ausgeblendet, erscheint ein Hinweis-Toast.

Als **Notausgang** zählen Türen vom Typ „Notausgang“ sowie aufschlagende Türen in Hallen-Außenwänden (`hall_*`);
Schiebetüren/Rolltore in der Außenwand zählen nicht (`src/geometry/escapeRoutes.ts → emergencyExitsOf`).

### Darstellung

Grüne Polylinie (Token `--gp-ok`, hell/dunkel) mit Pfeilspitze je Segment in Laufrichtung, Startpunkt-Marker und Label
„Name · Lauflänge“ am Endpunkt. **Rot** (`--gp-danger`), sobald eine der Fluchtweg-Prüfungen „nicht erfüllt“ meldet.
PNG/PDF-Export zeichnet Fluchtwege gleich (`src/export/planRenderer.ts`).

### Bearbeiten (Auswahl-Werkzeug)

* Griff je Eckpunkt ziehen (Snapping, Winkel zum Nachbarpunkt) – ein Undo-Schritt.
* **Alt+Klick** oder **Doppelklick** auf ein Segment des gewählten Fluchtwegs fügt dort einen Punkt ein (Alt+Klick zieht ihn sofort).
* **Entf/Rücktaste** über einem Griff entfernt den Punkt; mindestens 2 Punkte bleiben.
* Verschieben/Drehen/Spiegeln/Duplizieren wie bei anderen Anmerkungen.

### Eigenschaften-Panel (`EscapeRouteProps`)

Name, Lauflänge, Luftlinie Start→Ende, Verhältnis, Ergebnis der vier Fluchtweg-Prüfungen (mit Sprung zum Ziel),
Punktliste mit editierbaren X/Y-Koordinaten, Punkt anhängen/entfernen, Sperren/Ausblenden/Löschen.

### Übersicht → „Regularien & Brandschutz“ (`RegulationsSection`)

Kopf mit Bemessungspersonen und Zählern (nicht erfüllt / prüfen / erfüllt), Gruppen je Thema (auf-/zuklappbar, offen
wenn offene Punkte), Zeilen mit Status-Icon, Titel, „Ist → Soll“; Klick auf die Zeile klappt Erläuterung und Quelle
(Link) auf, das Fadenkreuz springt zum Ziel (Objekt, Raum, Tür, Fluchtweg oder Punkt – `src/components/focusTarget.ts`).
Umfang „aktives Stockwerk / alle“ wie im übrigen Panel; projektweite Prüfungen (AED, Versammlungsstätte, Organisation)
erscheinen immer.

### PDF

`src/export/pdfRegulations.ts` erzeugt die Seiten „Regularien & Brandschutz“ (A4 quer): Kopf mit Personenzahl und
Zählern, Tabelle Thema / Prüfung / Status / Ist / Soll / Quelle (Zebra, Seitenumbruch), Legende und Annahmen.

### Bibliothek

Neu in `src/data/equipment/generic.json` (Ausstattung › Sicherheit, wandmontiert):
`gen-ausstattung-rettungszeichenleuchte` (Sicherheitsleuchte / Rettungszeichenleuchte, Symbol `exit-sign`) und
`gen-ausstattung-fluchtplan` (Flucht- und Rettungsplan (Aushang), Symbol `screen`).

## Regeln und Quellen

Bemessungspersonen = Trainierende laut Kapazität (`capacity(project).persons`) + Beschäftigte (`STAFF_DEFAULT = 6`).
Alle Grenzwerte stehen in `REGULATION_RULES` (exportiert, zentral anpassbar).

| Thema | Prüfung | Regel | Status | Quelle |
|---|---|---|---|---|
| Fluchtwege | Fluchtweglänge je Raum | Luftlinie von jedem Rasterpunkt (50 cm) eines Raums/der Halle zum nächsten Notausgang ≤ 35 m (fail), > 30 m (warn); Ziel = schlimmster Punkt | fail/warn/ok | ASR A2.3 Abs. 5 |
| Fluchtwege | Gezeichneter Fluchtweg: Länge | Lauflänge ≤ 1,5 × 35 m = 52,5 m **und** Luftlinie Start→Ende ≤ 35 m | fail/ok | ASR A2.3 Abs. 5 (3) |
| Fluchtwege | Endpunkt | ≤ 100 cm zur Mitte einer Notausgangstür | fail/ok | ASR A2.3 Abs. 4 |
| Fluchtwege | Korridor frei | Rechteck `settings.minEscapeRouteCm` breit je Segment ohne Objekt-Grundflächen (Objekte `ohne_stellflaeche`, Wandmontage und Rampen ausgenommen) | fail/ok | ASR A2.3 Abs. 5 / ASR A1.8 |
| Fluchtwege | Wände nur durch Türen | Segment kreuzt Wandachsen nur innerhalb einer Türöffnung (± 2 cm) | fail/ok | ASR A2.3 Abs. 4 |
| Fluchtwege | Anzahl Notausgänge | ≥ 2 je Stockwerk ab 200 m² Nettofläche oder > 20 Personen; 0 = fail; Notausgangstür an Innenwand = warn | fail/warn/ok | MBO § 33, ASR A2.3 Abs. 4 |
| Fluchtwege | Ausgangsbreite gesamt | Summe lichte Breiten ≥ Soll nach Personen (ASR A2.3 2022, Spalte Weg: ≤ 5: 90 cm; ≤ 20: 100; ≤ 200: 120; ≤ 300: 180; ≤ 400: 240; je weitere 100 + 60 cm) | fail/ok | ASR A2.3 Tabelle 1 |
| Fluchtwege | Türbreite Hauptausgang | breiteste Notausgangstür ≥ Spalte Tür für die Personenzahl (≤ 5: 80 cm; ≤ 20: 90; ≤ 50: 90; ≤ 100: 100; ≤ 200: 105; ≤ 300: 165; ≤ 400: 225) | warn/ok | ASR A2.3 Tabelle 1 |
| Fluchtwege | Türbreite | jede Notausgangstür ≥ 80 cm | fail/ok | ASR A2.3 Tabelle 1 |
| Fluchtwege | Aufschlagrichtung | Hallenwand: Schwenkfläche außerhalb des Innenpolygons (sonst warn); Innenwand: info; Schiebe-/Rolltor als Notausgang: fail | fail/warn/info/ok | ASR A2.3 Abs. 6 |
| Verkehrswege | Laufwegbreite | Zusammenfassung der „escape-route“-Warnungen je Stockwerk (Anzahl Engpässe, schmalster); Soll = `minEscapeRouteCm`, Hinweis ≥ 120 cm bis 200 Personen; Einstellung < Soll = warn | warn/ok | ASR A1.8, ASR A2.3 Tabelle 1 |
| Brandschutz | Löschmitteleinheiten | Soll nach Grundfläche (≤ 50 m²: 6 LE … 1000 m²: 36 LE, je weitere 250 m² + 6 LE); Ist = Feuerlöscher × LE (`params.le`, Standard 6); reicht es nur mit 10 LE je Gerät → warn | fail/warn/ok | ASR A2.2 Abs. 5.2, Tabelle 3 |
| Brandschutz | Entfernung | jeder Rasterpunkt ≤ 20 m Luftlinie zum nächsten Feuerlöscher | fail/ok | ASR A2.2 Abs. 6.2 |
| Erste Hilfe | Verbandkasten | ≥ 1 je Stockwerk (fail); > 50 Personen ≥ 2 bzw. großer Kasten (info) | fail/info/ok | ASR A4.3, DGUV V1 § 25 |
| Erste Hilfe | AED | vorhanden (`gen-ausstattung-aed`) sonst warn | warn/ok | DGUV Information 204-010 |
| Kennzeichnung | Rettungszeichen | Schild `gen-ausstattung-notausgang-schild` ≤ 150 cm je Notausgang; Erkennungsweite-Hinweis | warn/ok | ASR A1.3, DIN EN ISO 7010 E001/E002 |
| Kennzeichnung | Sicherheitsbeleuchtung | Rettungszeichenleuchte ≤ 150 cm je Notausgang | warn/ok | ASR A3.4/7 |
| Barrierefreiheit | Barrierefreies WC | ≥ 1 `gen-sanitaer-wc-barrierefrei` (warn); Raumtür ≥ 90 cm, nach außen (info); Bewegungsfläche 150 × 150 cm (info, nicht prüfbar) | warn/info/ok | ASR V3a.2 / DIN 18040-1 |
| Barrierefreiheit | Ein-/Ausgänge | Notausgänge/Haupteingang ≥ 90 cm lichte Breite | info/ok | DIN 18040-1 Abs. 4.3.3 |
| Sanitär | Spinde / Duschen / WCs | Kapazitätszähler mit Richtwerten (unter Mindestbedarf = warn, unter Empfehlung = info) | warn/info/ok | Richtwert / ASR A4.1 |
| Sanitär | Beschäftigten-WC | bis 5 Beschäftigte 1 Toilette | info | ASR A4.1 Tabelle 2 |
| Gerätefreiräume | Kollisionen | Anzahl Kollisions-/Sicherheitszonen-Warnungen; 0 = ok | warn/ok | DIN EN ISO 20957-1 |
| Versammlungsstätte | VStättVO | > 200 Personen → info (Rettungswegbreite 1,20 m je 200 Personen, Sicherheitsbeleuchtung, BMA), sonst na | info/na | MVStättVO § 1 |
| Organisatorisches | Flucht- und Rettungsplan | ok, wenn Objekt `gen-ausstattung-fluchtplan` platziert, sonst info | info/ok | ASR A2.3 Abs. 9, DIN ISO 23601 |
| Organisatorisches | Brandschutzhelfer, Ersthelfer, Feuerlöscherprüfung (2 Jahre), Legionellen (Duschen) | nur Hinweise | info | ASR A2.2 Abs. 7, DGUV V1 § 26, TrinkwV § 31 |

Deckenhöhe und Bodenlast bleiben Planungs-Warnungen.

## Annahmen und Grenzen

* Fluchtweglängen werden als **Luftlinie** auf einem 50-cm-Raster gemessen (ASR A2.3 misst die Lauflänge; die
  Luftlinienregel mit Faktor 1,5 ist die übliche Näherung). Rasterpunkte je Raum aus `floorRooms(floor)`; ohne Räume
  gilt das Hallen-Innenpolygon.
* Notausgänge auf Innenwänden können nicht nach außen verfolgt werden (warn); die Fluchtrichtung innerer Türen ist
  nicht bestimmbar (info).
* Beschäftigte sind eine Konstante (`STAFF_DEFAULT = 6`), Trainierende kommen aus der Kapazität (m² je Person). Zwei
  Stockwerke: die Beschäftigten werden dem ersten Stockwerk zugerechnet.
* Löschmitteleinheiten: konservativ 6 LE je Feuerlöscher (6 l Schaum); 6 kg ABC-Pulver hätte 10 LE – deshalb „prüfen“,
  wenn das Soll nur damit erreicht würde. `params.le` am Objekt überschreibt.
* Beschäftigten-Toiletten werden nicht nach Geschlecht getrennt gezählt.
* Die Vorlage „Beispielstudio 1.000 m²“ liefert weder „nicht erfüllt“ noch „prüfen“ (Fluchtwege auf den Mittellinien der
  Gänge, Flucht- und Rettungsplan am Empfang; siehe `docs/beispielstudio.md`, Abschnitt „Fluchtwege und Regularien-Prüfung“);
  offen bleiben nur Hinweise (Organisatorisches, Beschäftigten-WC, Bewegungsfläche des barrierefreien WCs).

## Dateien

`src/geometry/escapeRoutes.ts` (reine Geometrie), `src/analysis/regulations.ts` (+ `regulations.test.ts`),
`src/editor/tools/escapeRouteTool.tsx` (+ `escapeRouteTool.test.ts`), `src/editor/layers/AnnotationsLayer.tsx`,
`src/editor/layers/SelectionLayer.tsx`, `src/editor/tools/selectTool.tsx`, `src/components/EscapeRouteProps.tsx`,
`src/components/RegulationsSection.tsx`, `src/components/focusTarget.ts`, `src/export/pdfRegulations.ts`,
`src/export/planRenderer.ts`, `src/components/Toolbar.tsx` / `src/hooks/useKeyboardShortcuts.ts` (Kürzel E),
`src/components/Tutorial.tsx` (Schritt „Fluchtwege & Regularien“), `src/data/equipment/generic.json`.
