# Auftrag: Web-App „GymPlanner“ – vollständiger Raum- und Einrichtungsplaner für ein Fitnessstudio

## 1. Rolle & Ziel
Du bist ein erfahrener Frontend-Entwickler mit Erfahrung in CAD- und Grundriss-Editoren.
Du baust eine vollständige, sofort nutzbare Web-App. Mit ihr planen zwei Gründer ihr zukünftiges Fitnessstudio maßstabsgetreu: Halle, Wände, Räume, Stockwerke, Geräte, Umkleiden, Wellness und alles Weitere.
Alle Maße entsprechen der Realität (Zentimeter-genau). Alle Flächen werden live in m² berechnet.
Die Oberflächensprache ist **Deutsch**.

## 2. Technik
- **React + TypeScript + Vite**
- **2D-Editor:** Konva.js (react-konva) oder SVG, entscheide begründet. Der Editor muss auch mit 500+ Objekten flüssig laufen.
- **State:** Zustand (oder Redux Toolkit) mit **Undo/Redo-Historie** (mind. 100 Schritte)
- **Styling:** Tailwind CSS, Hell-/Dunkelmodus
- **Optionale 3D-Vorschau:** Three.js / react-three-fiber (Wände und Geräte werden mit echter Höhe extrudiert)
- **Speicherung:** automatisch in localStorage/IndexedDB, dazu Import/Export als JSON-Datei
- Kein Backend nötig. Die App muss komplett im Browser laufen.
- **Tests:** Vitest für die Kernlogik (Flächen, Snapping, Kollision, Einheiten)

## 3. Koordinatensystem & Einheiten
- Intern gilt **1 Einheit = 1 cm**. Angezeigt werden m, cm und m² (mit Komma als Dezimaltrennzeichen, z. B. „12,45 m²“).
- Das Raster ist einstellbar (5 / 10 / 25 / 50 / 100 cm) und ein-/ausblendbar.
- **Snapping** an Raster, Wandenden, Wandmitten, Objektkanten und 90°/45°-Winkel. Mit gedrückter Alt-Taste wird Snapping vorübergehend ausgeschaltet.
- Ein Maßstabsbalken und das Lineal am Rand sind immer sichtbar.
- Flächen werden mit der Gaußschen Trapezformel (Shoelace) berechnet und müssen auch bei L-Formen und Polygonen stimmen.

## 4. Kernfunktionen

### 4.1 Gebäude / Halle
- Die Außenmaße der Halle legt man fest per **Rechteck aufziehen** (Maße werden live angezeigt) oder per **Polygon-Zeichnen** für unregelmäßige Grundrisse.
- Eckpunkte und Kanten lassen sich per Drag verschieben. Längen kann man zusätzlich numerisch eingeben (Kante anklicken, Länge eintippen).
- Einstellbar sind **Deckenhöhe**, Bodenbelag und Wandstärke der Außenwände.
- Die Gesamtfläche der Halle wird immer angezeigt.

### 4.2 Stockwerke
- Stockwerke hinzufügen, umbenennen, duplizieren, löschen und umsortieren (EG, OG 1, OG 2, UG, Galerie/Empore).
- Jedes Stockwerk hat eine eigene Deckenhöhe und einen eigenen Grundriss.
- Das darunterliegende Stockwerk ist optional halbtransparent eingeblendet, damit man Treppen und Wände ausrichten kann.
- **Treppen und Aufzüge** werden auf allen verbundenen Stockwerken angezeigt.
- Für eine Galerie oder Empore kann man einen **Luftraum** („offen nach unten“) markieren. Diese Fläche zählt nicht zur Nutzfläche.

### 4.3 Wände
- Werkzeug „Wand“: Wände per Klick-Klick zeichnen, auch als Kette. Die Länge wird live angezeigt, per Tastatur ist eine exakte Länge eingebbar.
- Einstellbar pro Wand: Stärke (z. B. 10 / 12,5 / 17,5 / 24 cm), Typ (Trockenbau, Mauerwerk, Glaswand, Halbhohe Wand/Brüstung, Trennwand/Netz) und Höhe.
- Wände verbinden sich an Ecken und T-Stößen sauber.
- Wände lassen sich verschieben, teilen und löschen. Angrenzende Wände passen sich dabei an.

### 4.4 Räume / Zonen
- Räume entstehen **automatisch aus geschlossenen Wandzügen** oder manuell als Zonen (Rechteck/Polygon), auch ohne Wände (z. B. „Freihantelbereich“ in der offenen Halle).
- Jeder Raum hat Name, Typ, Farbe und Bodenbelag. Er zeigt live seine **m²** und seinen Umfang.
- Raumtypen (jeweils mit eigener Farbe): Trainingsfläche Freihantel, Maschinen, Cardio, Functional/Stretching, Kursraum, Empfang/Lounge, Umkleide Damen, Umkleide Herren, Umkleide Divers, Duschen, WC, Wellness/Sauna, Ruheraum, Büro, Lager, Technik/Lüftung, Putzraum, Personalraum, Kinderbetreuung, Physio/Massage, Flur/Verkehrsfläche, Treppenhaus.
- Der m²-Wert und der Name werden in der Raummitte angezeigt. Man kann auswählen, was angezeigt wird.

### 4.5 Öffnungen & Bauelemente
- **Türen:** einflügelig, zweiflügelig, Schiebetür, Glastür, Notausgang, Rolltor. Die Breite ist wählbar (80 / 90 / 100 / 125 / 200 cm …). Aufschlagrichtung und Schwenkbereich werden angezeigt und sind umkehrbar.
- **Fenster:** Breite, Brüstungshöhe, Höhe. Fenster sitzen immer in einer Wand und lassen sich an ihr entlang ziehen.
- **Spiegel(wände):** frei wählbare Länge und Höhe, an einer Wand platziert.
- Außerdem: Säulen/Stützen (rund und eckig), Heizkörper, Lüftungsauslässe, Treppen (gerade, L-, U-Treppe, Wendeltreppe mit echten Maßen), Aufzug, Rampe.

### 4.6 Objekte platzieren
- Objekte werden per **Drag & Drop aus der Bibliothek** auf die Fläche gezogen.
- **Maße sind fest auf Originalmaß gesperrt.** Geräte kann man nicht skalieren. Frei skalierbar sind nur generische Objekte wie Bänke, Matten, Spiegel und Theken.
- Drehen in 90°-Schritten per Taste R, frei per Griff mit 15°-Snapping.
- Jedes Gerät zeigt:
  - seine **Grundfläche** als Draufsicht-Symbol (vereinfachte Silhouette, keine Fotos oder Logos der Hersteller)
  - seine **Sicherheits- und Nutzungszone** als halbtransparente Fläche nach DIN EN ISO 20957: standardmäßig 60 cm rundum bei Kraftgeräten, beim Laufband 200 cm × Gerätebreite hinter dem Gerät. Pro Gerät ist der Wert anpassbar.
- **Kollisionsprüfung:** Überlappen sich Geräte, Wände oder Sicherheitszonen, wird das rot markiert.
- Mehrfachauswahl (Rahmen aufziehen, Shift-Klick), Gruppieren, Ausrichten (links, zentriert, gleichmäßig verteilen), Duplizieren, Sperren, Ausblenden.
- Das Eigenschaften-Panel zeigt Hersteller, Serie, Modell, Maße B × T × H, Gewicht, Steckgewicht, Sicherheitszone, Preis (optional, editierbar), Link zur Herstellerseite und Notiz.

## 5. Objektbibliothek (das Herzstück)

### 5.1 Datenmodell für jeden Eintrag
```ts
{
  id: string,
  kategorie: string, unterkategorie: string,
  hersteller: "Atlantis" | "Prime" | "Generisch" | string,
  serie?: string, modell?: string, name: string,
  breite_cm: number, tiefe_cm: number, hoehe_cm: number | null,
  gewicht_kg?: number | null,
  extra?: string,            // z. B. „Steckgewicht 141 kg“
  hinweis?: string,          // z. B. „aus Zoll umgerechnet“
  sicherheitszone_cm: { vorne: number, hinten: number, links: number, rechts: number },
  form: "rechteck" | "polygon" | "kreis", polygon?: [x,y][],
  skalierbar: boolean,
  preis_eur?: number,
  quelle_url?: string,
  verifiziert: boolean   // true = Maße aus offizieller Herstellerseite
}
```
- Die Bibliothek liegt als eigene, leicht erweiterbare Datei vor (z. B. `src/data/equipment/*.json`).
- **Nutzer können eigene Geräte anlegen** (Formular mit allen Feldern) und sie im Projekt speichern.
- Suchfeld, Filter nach Hersteller, Serie, Kategorie und Muskelgruppe, Favoriten.
- Jedes Gerät bekommt eine deutsche Kategorie (Beine, Brust, Rücken, Schultern, Arme, Rumpf, Kabel/Functional, Racks, Bänke, Plattformen, Ablagen) und die Originalbezeichnung des Herstellers bleibt als Name erhalten.

### 5.2 Kraftgeräte Atlantis & Prime – ORIGINALMASSE (bereits recherchiert)

Die folgenden Maße wurden am 25.09.2026 direkt von den offiziellen Hersteller-Websites ausgelesen:
- Atlantis Strength: https://atlantisstrength.com/gym-equipment/<modell>
- Prime Fitness: https://www.primefitnessusa.com/products/<handle>

**Übernimm sie exakt, nichts schätzen oder runden.** Die vollständigen Daten inkl. Quell-URL je Gerät liegen maschinenlesbar in `gym-planner/data/atlantis.json` und `gym-planner/data/prime.json`. Nutze diese Dateien als Grundlage der Bibliothek und alle Einträge mit `verifiziert: true`.

**Bedeutung der Spalten:**
- **B** = Breite (Hersteller: „Width“ bzw. „W“)
- **T** = Tiefe/Länge, also die lange Seite in Trainingsrichtung (Hersteller: „Length“ bzw. „L“)
- **H** = Höhe (wichtig für die Prüfung gegen die Deckenhöhe)
- **kg** = Eigengewicht des Geräts (wichtig für die Bodenlast)
- Alle Werte sind in cm bzw. kg. Wenn ein Hersteller nur Zoll angibt, wurde umgerechnet (1 in = 2,54 cm). Das steht dann in der Spalte Hinweis.
- Die Maße sind die Außenmaße des Geräts. Den Freiraum für die Benutzung (Sicherheitszone) addiert die App separat.

**Nicht enthalten, weil ohne eigene Stellfläche:** Griffe, Seile, Stangen, Hantelscheiben, Kurzhanteln sowie kleine Rack-Anbauteile wie Safeties, Landmine, J-Hooks und Scheibenhörner. Die ReGen-Cold-Plunge-Wannen und das Red-Light-Panel bei Prime haben keine Maßangaben auf der Website; sie kommen als generische Wellness-Objekte (Abschnitt 5.3) mit `verifiziert: false`.

**Bekannte Auffälligkeiten (so übernehmen, in der App mit Hinweis anzeigen):**
- Prime Prodigy HLP Plate Loaded Rack: Die Website nennt „57L cm“. Das ist ein Tippfehler (62 in = 157 cm). 157 cm wird verwendet.
- Kombigeräte „Leg Extension / Leg Curl Combo“: Maße in Beinbeuger-Stellung, weil das die größere Aufstellung ist.
- Atlantis „Rack-Module“ werden nur an Atlantis-Racks/Multistationen angebaut. In der App lassen sie sich nur an einem Rack andocken (Snap an Rackseite).
- Bei Prime Evolution sind die L/W-Werte wie vom Hersteller angegeben übernommen. Einige wirken im Vergleich zur Hybrid-Serie vertauscht, deshalb gibt es in der App einen gelben Hinweis „Maße vor Kauf beim Händler bestätigen“.
- Atlantis B7272: Das Gewicht (123 kg) ist auf der Herstellerseite vermutlich falsch (das kleinere Modell B4872 wiegt 251 kg).


#### ATLANTIS STRENGTH – 132 Geräte

#### Atlantis – Precision Series (39 Geräte)

| Modell | Bezeichnung | Kategorie | B cm | T cm | H cm | kg | Extra |
|---|---|---|---|---|---|---|---|
| A301 | Dual seated crunch | Ab Crunch Machines | 123 | 138 | 163 | 284 | Steckgewicht 113 kg |
| B157 | Biceps curl | Biceps Machines | 108 | 128 | 156 | 207 | Steckgewicht 93 kg |
| B160 | Biceps isolator | Biceps Machines | 141 | 144 | 154 | 227 | Steckgewicht 93 kg |
| B260 | Horizontal biceps isolator | Biceps Machines | 158 | 93 | 154 | 227 | Steckgewicht 93 kg |
| B158 | Horizontal curl | Biceps Machines | 72 | 163 | 184 | 239 | Steckgewicht 73 kg |
| B257 | Standing Bicep Curl | Biceps Machines | 78 | 161 | 174 | 114 | Steckgewicht 89 kg |
| P156 | Pec / Rear delt fly combo | Chest Fly Machines | 69 | 130 | 204 | 274 | Steckgewicht 141 kg |
| P356 | Vertical pec fly | Chest Fly Machines | 129 | 139 | 208 | 334 | Steckgewicht 141 kg |
| C329 | Hip Abductor Machine | Abductors | 71 | 195 | 154 | 302 | Steckgewicht 181 kg |
| P143 | Incline Converging Chest Press | Chest Press | 160 | 250 | 184 | 337 | Steckgewicht 113 kg |
| P140 | Seated converging chest press | Chest Press | 152 | 150 | 185 | 326 | Steckgewicht 141 kg |
| A201 | Multi-forearm | Forearm Machines | 96 | 156 | 187 | 263 | Steckgewicht 93 kg |
| C122 | Glute machine | Glute And Hamstring Machines | 111.5 | 169 | 160 | 226 | Steckgewicht 93 kg |
| E352 | Seated side / Rear deltoid | Lateral Raise Machines | 137 | 142 | 155 | 244 | Steckgewicht 93 kg |
| E252 | Standing lateral raise | Lateral Raise Machines | 69 | 127 | 206 | 277 | Steckgewicht 93 kg |
| P144 | Pullover | Pullover Machines | 115 | 187 | 173 | 296 | Steckgewicht 113 kg |
| D337 | Diverging row | Rowing Machines | 87 | 163 | 184 | 244 | Steckgewicht 113 kg |
| D132 | Incline row | Rowing Machines | 70.5 | 181 | 241.5 | 295 | Steckgewicht 141 kg |
| D124 | Low row | Rowing Machines | 69 | 229 | 243 | 281 | Steckgewicht 141 kg |
| D433 | Vertical row | Rowing Machines | 114 | 84 | 173 | 236 | Steckgewicht 141 kg |
| E149 | Converging shoulder press | Shoulder Press | 149.5 | 212 | 171.5 | 329 | Steckgewicht 113 kg |
| M318 | Incline calf raise | Standing Calf Raise Machines | 97 | 160 | 173 | 375 | Steckgewicht 181 kg |
| M118 | Standing calf | Standing Calf Raise Machines | 82 | 128 | 187 | 294 | Steckgewicht 181 kg |
| D123 | Lat pulldown | Lat Pulldown Machines | 71 | 125 | 242 | 268 | Steckgewicht 141 kg |
| D438 | Lat pulldown/ Low row combo (heavy stack) | Lat Pulldown Machines | 71 | 183 | 244 | 313 | Steckgewicht 141 kg |
| C118 | Kneeling leg curl | Leg Curl Machines | 143 | 133 | 156 | 175 | Steckgewicht 59 kg |
| C106 | Lying leg curl | Leg Curl Machines | 93 | 168 | 174 | 221 | Steckgewicht 93 kg |
| C108 | Seated leg curl | Leg Curl Machines | 103 | 122.5 | 173.5 | 248 | Steckgewicht 89 kg |
| C107 | Standing leg curl | Leg Curl Machines | 102 | 119 | 145 | 176 | Steckgewicht 59 kg |
| C105 | Leg extension | Leg Extension Machines | 97 | 117 | 173 | 273 | Steckgewicht 141 kg |
| C230 | Leg extension/Leg curl combo | Leg Extension Machines | 94 | 127.5 | 173 | 239 | Steckgewicht 93 kg |
| C403 | Horizontal leg press | Leg Press | 107 | 233 | 206 | 452 | Steckgewicht 186 kg |
| D131 | Assisted chin/dip | Pull-up Machines | 142 | 145 | 234 | 320 | Steckgewicht 52 kg |
| T215 | Incline triceps pushdown | Triceps Machines | 71 | 150 | 185 | 200 |  |
| T162 | Overhead triceps | Triceps Machines | 106 | 169 | 172 | 253 | Steckgewicht 93 kg |
| T161 | Overhead triceps (cable motion) | Triceps Machines | 71 | 213 | 185 | 195 | Steckgewicht 73 kg |
| T262 | Selectorized French press | Triceps Machines | 113 | 127 | 154 | 227 | Steckgewicht 93 kg |
| T164 | Triceps extension | Triceps Machines | 102 | 122 | 155 | 220 |  |
| T163 | Triceps pushdown | Triceps Machines | 115 | 196 | 174 | 278 | Steckgewicht 136 kg |

#### Atlantis – Power Series (26 Geräte)

| Modell | Bezeichnung | Kategorie | B cm | T cm | H cm | kg | Extra |
|---|---|---|---|---|---|---|---|
| PW357 | Preacher curl | Biceps Machines | 127 | 135 | 110 | 139 |  |
| PW256 | Incline pec fly | Chest Fly Machines | 178 | 192.5 | 90 | 110 |  |
| P443 | Converging incline bench press | Chest Press | 152 | 164 | 109 | 125 | max. 245 kg |
| P439 | Decline / Flat converging bench press | Chest Press | 152 | 228 | 104 | 147 | max. 245 kg |
| PW739 | Decline vertical chest press | Chest Press | 186 | 182 | 133 | 211 | max. 245 kg |
| P441 | Lying converging bench press | Chest Press | 150 | 187 | 102 | 126 | max. 245 kg |
| PW737 | Vertical chest press | Chest Press | 184 | 198 | 133 | 211 | max. 245 kg |
| PW322 | Assisted glute and ham developer | Glute And Hamstring Machines | 141 | 163 | 154 | 152 | max. 123 kg |
| PW429 | Glute Abductor | Glute And Hamstring Machines | 170 | 187 | 136 | 226 | max. 204 kg |
| PW120 | Total neck | Neck Strengthening Machines | 174 | 85 | 154.5 | 91 |  |
| PW625 | Incline T-Bar Row | Rowing Machines | 133 | 144 | 124 | 137 | max. 122 kg |
| PW637 | Low row | Rowing Machines | 162 | 148 | 157 | 132 |  |
| PW437 | Row | Rowing Machines | 165 | 155 | 122 | 132 |  |
| D533 | Seal row | Rowing Machines | 131 | 161 | 90 | 94 | max. 245 kg |
| E449 | Converging shoulder press | Shoulder Press | 152 | 140 | 132 | 122 | max. 245 kg |
| PW549 | Viking press | Shoulder Press | 130 | 158 | 160 | 125 |  |
| PW335 | Shrug and Deadlift Machine | Shrug Machines | 163 | 146 | 89 | 125 | max. 409 kg |
| D215 | Reverse Hyper Extension Machine | Hyper Extension Machines | 132 | 154 | 149 | 144 |  |
| PW423 | Front pulldown | Lat Pulldown Machines | 110 | 189 | 208 | 149 |  |
| PW623 | Unilateral Lat Pulldown | Lat Pulldown Machines | 144 | 224 | 236 | 255 | max. 245 kg |
| C401 | 40 Degree leg press | Leg Press | 148 | 264 | 150 | 280 | max. 694 kg |
| PW511 | Belt squat | Leg Press | 196 | 154 | 126 | 193 |  |
| C412 | Hack squat | Leg Press | 157 | 226 | 150 | 232 | max. 245 kg |
| C201 | Pivot press | Leg Press | 181 | 221 | 148 | 211 | max. 490 kg |
| M219 | Seated calf | Seated Calf Machines | 120 | 158 | 99 | 81 | max. 163 kg |
| PW319 | Seated calf press | Seated Calf Machines | 130 | 168 | 100 | 100 |  |

#### Atlantis – Pro Series (8 Geräte)

| Modell | Bezeichnung | Kategorie | B cm | T cm | H cm | kg | Extra |
|---|---|---|---|---|---|---|---|
| B856 | Poliquin seated preacher curl | Biceps Machines | 123 | 115 | 99 | 95 |  |
| PW702 | Hip Thruster Pro | Hip Machines | 141 | 187 | 113 | 178 | max. 163 kg |
| D828 | Incline Hyper Extension Pro | Hyper Extension Machines | 95.5 | 165 | 109 | 100 |  |
| D828F | Incline Hyper Extension Pro (flat version) | Hyper Extension Machines | 96 | 165 | 109 | 100 |  |
| PW212 | Pendulum Squat Pro | Leg Press | 99 | 241 | 181 | 346 | max. 164 kg |
| PW412 | Plate Loaded Hack Squat Machine | Leg Press | 170 | 264 | 140 | 337 | max. 653 kg |
| PW611 | Power Squat Pro | Leg Press | 173 | 260 | 187 | 293 | max. 164 kg |
| PW419 | Unilateral leg press pro | Leg Press | 160 | 250 | 159 | 345 | max. 490 kg |

#### Atlantis – Bench Series (25 Geräte)

| Modell | Bezeichnung | Kategorie | B cm | T cm | H cm | kg | Extra |
|---|---|---|---|---|---|---|---|
| B177 | Adjustable bench | Benches | 76.5 | 118.5 | 43 | 33 |  |
| B179 | Adjustable decline bench | Benches | 89 | 167 | 111 | 47 |  |
| B275 | Flat bench | Benches | 76 | 130 | 41 | 32 |  |
| B176 | Long incline bench | Benches | 97 | 169 | 108 | 50 |  |
| B178 | Straight bench | Benches | 79 | 127 | 99 | 33 |  |
| B100 | Utility Bench | Benches | 53.5 | 57.5 | 40 | 14 |  |
| B256 | Seated preacher curl | Biceps Machines | 117 | 91 | 107 | 48 |  |
| C220 | Adjustable Single Leg Squat Stand | Glute And Hamstring Machines | 89 | 55 | 56 | 20 |  |
| A169 | Standing Leg Raise | Leg Raise Machines | 74 | 111 | 169.5 | 68 |  |
| E348 | Shoulder press (with pivot) | Shoulder Press | 168 | 189.5 | 177 | 144 |  |
| A264 | Adjustable sit up bench | Sit-Up Benches | 89 | 105.5 | 115 | 43 |  |
| S187 | Dumbbell rack (10 Pairs) | Dumbbell racks | 239 | 77 | 75 | 104 |  |
| S189 | Dumbbell rack (15 Pairs) | Dumbbell racks | 239 | 71 | 119 | 151 |  |
| S287B | Hex dumbbell rack (10 Pairs) | Dumbbell racks | 239 | 76 | 81 | 113 |  |
| S289 | Hex dumbbell rack (15 Pairs) | Dumbbell racks | 241 | 69 | 119 | 151 |  |
| D227 | Glute and ham developer | Hyper Extension Machines | 89 | 164 | 124 | 92 |  |
| C117 | Sissy squat | Leg Extension Machines | 71 | 91 | 56 | 33 |  |
| P339 | Olympic flat / Decline bench press (with pivot) | Olympic Bench Press | 168 | 236 | 132 | 137 |  |
| P337 | Olympic flat bench press (with pivot) | Olympic Bench Press | 168 | 180 | 124 | 98 |  |
| P338 | Olympic incline bench press (with pivot) | Olympic Bench Press | 168 | 165 | 144 | 120 |  |
| M126 | Tibia dorsi flexion | Tibia Dorsi Calf Machine | 86 | 38 | 33 | 29 |  |
| S185 | Accessory rack | Weight Racks | 56 | 61 | 117 | 41 |  |
| S190 | Barbell rack | Weight Racks | 102 | 81 | 147 | 62 |  |
| S182 | Olympic bar holder | Weight Racks | 64 | 61 | 33 | 26 |  |
| S181 | Plate rack | Weight Racks | 76 | 86 | 117 | 34 |  |

#### Atlantis – Athletic Series (18 Geräte)

| Modell | Bezeichnung | Kategorie | B cm | T cm | H cm | kg | Extra |
|---|---|---|---|---|---|---|---|
| R400 | Heel raise platform | Accessories For Gyms | 63.5 | 22 | 5 | 7.5 |  |
| E155 | Smith machine | Bodybuilding machines | 216 | 136 | 210 | 287 |  |
| M123 | Calf platform | Calf Platforms | 63 | 37 | 15.5 | 13 |  |
| C322 | Poor man’s glute and ham developer | Glute And Hamstring Machines | 61 | 122 | 46 | 36 |  |
| P245 | Dip bars | Dip Station | 101 | 106 | 144 | 74 |  |
| C511 | Half rack | Gym Racks | 165 | 153 | 246 | 134 |  |
| RS611 | Half rack | Gym Racks | 168 | 135 | 246 | 175 |  |
| C513 | Power rack | Gym Racks | 165 | 203 | 246 | 253 |  |
| RS613 | Power rack | Gym Racks | 168 | 185 | 246 | 254 |  |
| C706 | Adjustable Leg Platform with Slide Adjustment | Leg Press | 76 | 80 | 127 | 56 |  |
| R264 | Deluxe farmer’s walk handles | Strongman | 20.5 | 150 | 59 | 20 |  |
| R263 | Extreme sled | Strongman | 73 | 132 | 106 | 57 |  |
| B4800 | Platform with hardwood surface | Weightlifting Platforms | 244 | 135 | – | 117 |  |
| B7200 | Platform with hardwood surface | Weightlifting Platforms | 244 | 193 | – | 177 |  |
| B4854 | Platform with hardwood surface (C511 & RS611) | Weightlifting Platforms | 244 | 272 | – | 221 |  |
| B7254 | Platform with hardwood surface (C511 & RS611) | Weightlifting Platforms | 244 | 350 | – | 281 |  |
| B4872 | Platform with hardwood surface (C513 & RS613) | Weightlifting Platforms | 244 | 318 | – | 251 |  |
| B7272 | Platform with hardwood surface (C513 & RS613) | Weightlifting Platforms | 244 | 376 | – | 123 | Gewicht auf Herstellerseite vermutlich fehlerhaft |

#### Atlantis – Functional Trainer (2 Geräte)

| Modell | Bezeichnung | Kategorie | B cm | T cm | H cm | kg | Extra |
|---|---|---|---|---|---|---|---|
| NM205 | Dynamic functional training system | Functional Trainers | 213 | 98 | 234 | 558 | Steckgewicht 363 kg |
| NM200 | Functional training system | Functional Trainers | 213 | 98 | 234 | 416 | Steckgewicht 213 kg |

#### Atlantis – Rack-Module (nur als Anbau an Atlantis-Racks/Multistationen) (14 Geräte)

| Modell | Bezeichnung | Kategorie | B cm | T cm | H cm | kg | Extra |
|---|---|---|---|---|---|---|---|
| MS8 | Incline Row (D132 Model) | Rowing Machines | 64.5 | 174.5 | 245.5 | 295 | Steckgewicht 141 kg |
| RD124 | Low Row | Rowing Machines | 46 | 268 | 244 | – |  |
| MS7 | Low Row (D124 model) | Rowing Machines | 69 | 229 | 243 | 281 | Steckgewicht 141 kg |
| MS13 | Unilateral low row (NM510 model) | Rowing Machines | 79 | 259 | 246 | 242 | Steckgewicht 113 kg |
| RX200-L | Adjustable Pulley | Functional Trainers | 40 | 82 | 244 | – |  |
| RX200-R | Adjustable Pulley | Functional Trainers | 40 | 81.5 | 244 | – |  |
| MS14 | Adjustable dual pulley station (NM210 model) | Functional Trainers | 135 | 155 | 234 | 231 | Steckgewicht 107 kg |
| MS2 | Adjustable pulley | Functional Trainers | 61 | 81 | 245 | 191 | Steckgewicht 91 kg |
| RD123 | Lat Pulldown | Lat Pulldown Machines | 57 | 123 | 244 | – |  |
| MS6 | Lat Pulldown (D123 model) | Lat Pulldown Machines | 125 | 156.5 | 248.5 | 268 | Steckgewicht 141 kg |
| RD438 | Lat pulldown/ Low row combo (heavy stack) | Lat Pulldown Machines | 53 | 201 | 244.5 | – |  |
| MS12 | Unilateral lat pulldown (NM500 model) | Lat Pulldown Machines | 60.5 | 110 | 251.5 | 222 | Steckgewicht 113 kg |
| MS10 | Chin-up beam | Multistations | 272 | 35 | 8 | 21 |  |
| MS3 | Triceps pulley | Triceps Machines | 65 | 79 | 245 | 114 | Steckgewicht 68 kg |

#### PRIME FITNESS – 70 Geräte

#### Prime – Benches (3 Geräte)

| Modell | B cm | T cm | H cm | kg | Extra / Hinweis |
|---|---|---|---|---|---|
| Adjustable Bench | 69 | 130 | 46 | 43 | mit Beinpolster-Aufsatz: T 168 cm |
| PRIME STEEL – XL Bench | 79 | 216 | 46 | 88 |  |
| Shorty Adjustable Bench | 69 | 130 | 46 | 43 |  |

#### Prime – Evolution (12 Geräte)

| Modell | B cm | T cm | H cm | kg | Extra / Hinweis |
|---|---|---|---|---|---|
| Abdominal Crunch | 114 | 125 | 150 | 284 | Steckgewicht 116 kg |
| Arm Curl | 124 | 97 | 150 | 235 | Steckgewicht 93 kg |
| Chest Press | 140 | 142 | 150 | 314 | Steckgewicht 120 kg |
| Lat Pulldown | 157 | 119 | 201 | 325 | Steckgewicht 120 kg |
| Leg Extension | 119 | 104 | 150 | 273 | Steckgewicht 120 kg |
| Leg Press | 157 | 104 | 180 | 514 | Steckgewicht 229 kg |
| Low Back Extension | 112 | 99 | 150 | 295 | Steckgewicht 116 kg |
| Prone Leg Curl | 168 | 94 | 150 | 275 | Steckgewicht 120 kg |
| Seated Leg Curl | 152 | 97 | 150 | 286 | Steckgewicht 120 kg |
| Seated Row | 122 | 168 | 150 | 306 | Steckgewicht 116 kg |
| Shoulder Press | 140 | 145 | 150 | 291 | Steckgewicht 93 kg |
| Tricep Extension | 114 | 94 | 150 | 235 | Steckgewicht 93 kg |

#### Prime – Hybrid (25 Geräte)

| Modell | B cm | T cm | H cm | kg | Extra / Hinweis |
|---|---|---|---|---|---|
| Abdominal Crunch | 107 | 143 | 150 | 301 | Steckgewicht 120 kg |
| Arm Curl | 115 | 137 | 150 | 236 | Steckgewicht 75 kg |
| Chest Press | 161 | 155 | 186 | 383 | Steckgewicht 166 kg |
| Incline Press | 188 | 161 | 150 | 382 | Steckgewicht 166 kg |
| Inner Thigh | 150 | 178 | 150 | 283 | Steckgewicht 147 kg |
| Inner/Outer Thigh | 150 | 178 | 150 | 283 | Steckgewicht 120 kg |
| Lat Pulldown | 140 | 161 | 183 | 373 | Steckgewicht 120 kg |
| Lateral Raise | 143 | 110 | 150 | 298 | Steckgewicht 120 kg |
| Leg Extension | 125 | 120 | 150 | 322 | Steckgewicht 120 kg |
| Leg Extension/ Leg Curl Combo | 114 | 168 | 150 | 315 | Steckgewicht 120 kg, Kombigerät: Maße in Beinbeuger-Stellung (größte Aufstellung); Hersteller nennt nur Zoll, umgerechnet |
| Leg Press | 120 | 191 | 181 | 524 | Steckgewicht 229 kg |
| Low Back Extension | 110 | 130 | 150 | 302 | Steckgewicht 120 kg |
| Multi-Hip | 133 | 153 | 150 | 276 | Steckgewicht 75 kg |
| Outer Thigh | 150 | 178 | 150 | 283 | Steckgewicht 147 kg |
| Pec Fly | 150 | 94 | 150 | 290 | Steckgewicht 120 kg |
| Pec/Rear Delt | 150 | 94 | 193 | 306 | Steckgewicht 166 kg |
| Prone Leg Curl | 112 | 194 | 150 | 314 | Steckgewicht 120 kg |
| Pullover | 133 | 158 | 150 | 318 | Steckgewicht 120 kg |
| Rotary Torso | 127 | 115 | 150 | 248 | Steckgewicht 75 kg |
| Seated Calf Press | 125 | 168 | 150 | 308 | Steckgewicht 120 kg |
| Seated Leg Curl | 117 | 183 | 150 | 333 | Steckgewicht 120 kg |
| Seated Pushdown | 133 | 148 | 150 | 346 | Steckgewicht 120 kg |
| Seated Row | 130 | 130 | 180 | 370 | Steckgewicht 166 kg |
| Shoulder Press | 160 | 158 | 150 | 352 | Steckgewicht 120 kg |
| Tricep Extension | 115 | 127 | 150 | 270 | Steckgewicht 75 kg |

#### Prime – Plate Loaded (17 Geräte)

| Modell | B cm | T cm | H cm | kg | Extra / Hinweis |
|---|---|---|---|---|---|
| Pendulum Squat | 120 | 282 | 181 | 215 |  |
| Abdominal Crunch | 117 | 117 | 125 | 73 |  |
| Arm Curl | 122 | 120 | 124 | 136 |  |
| Chest Press | 188 | 188 | 137 | 218 |  |
| Extreme Row | 163 | 199 | 138 | 204 |  |
| Hack Squat | 150 | 259 | 140 | 227 |  |
| Incline Press | 178 | 188 | 149 | 195 |  |
| Lat Pulldown | 82 | 209 | 234 | 168 |  |
| Leg Ext/ Leg Curl Combo | 117 | 194 | 125 | 152 | Kombigerät: Maße in Beinbeuger-Stellung (größte Aufstellung) |
| Leg Extension | 122 | 148 | 125 | 150 |  |
| Leg Press | 150 | 237 | 143 | 227 |  |
| Low Back Extension | 115 | 143 | 125 | 109 |  |
| Prone Leg Curl | 117 | 194 | 125 | 145 |  |
| Pulldown | 112 | 211 | 216 | – |  |
| Seated Row | 142 | 150 | 125 | 159 |  |
| Shoulder Press | 161 | 155 | 138 | 195 |  |
| Tricep Extension | 122 | 125 | 133 | 136 |  |

#### Prime – Prodigy Racks (8 Geräte)

| Modell | B cm | T cm | H cm | kg | Extra / Hinweis |
|---|---|---|---|---|---|
| HLP Selectorized Rack 2:1 | 145 | 157 | 234 | – | Hersteller nennt nur Zoll, umgerechnet |
| HLP Selectorized Rack 4:1 | 145 | 157 | 234 | – | Hersteller nennt nur Zoll, umgerechnet |
| HLP Plate Loaded Rack | 190 | 157 | 234 | 240 | Website nennt 57L cm (Tippfehler, 62 in = 157 cm); aus Zoll umgerechnet |
| HLP Plate Loaded Single Stack | 124 | 122 | 234 | – | Hersteller nennt nur Zoll, umgerechnet |
| HLP Selectorized Single Stack 2:1 | 124 | 122 | 234 | – | Hersteller nennt nur Zoll, umgerechnet |
| HLP Selectorized Single Stack 4:1 | 124 | 122 | 234 | – | Hersteller nennt nur Zoll, umgerechnet |
| Half Rack | 137 | 124 | 226 | 145 |  |
| Power Rack | 198 | 155 | 226 | 211 |  |

#### Prime – Specialty (4 Geräte)

| Modell | B cm | T cm | H cm | kg | Extra / Hinweis |
|---|---|---|---|---|---|
| 4-TIER DUMBBELL RACK | 246 | 81 | 112 | 213 | Hersteller nennt nur Zoll/lbs, umgerechnet |
| CHIN – DIP ASSIST | 102 | 110 | 211 | 245 | Steckgewicht 120 kg |
| DOUBLE-SIDED PREACHER | 84 | 130 | 132 | – |  |
| Functional Trainer | 168 | 119 | 239 | 451 | Steckgewicht 120 kg |

#### Prime – Wall Mounts (1 Geräte)

| Modell | B cm | T cm | H cm | kg | Extra / Hinweis |
|---|---|---|---|---|---|
| WALL MOUNT – SMART ARM | 152 | 51 | 122 | – | Wandmontage; nur Zoll angegeben, umgerechnet |

### 5.3 Weitere Kategorien (generische Einträge mit realistischen Standardmaßen, `verifiziert: false`, Maße editierbar)
- **Freihantel-Zubehör:** Kurzhantelsätze, Langhantelstangen, Hantelscheiben (als Mengenposition in der Stückliste, keine Stellfläche), Scheibenständer (ca. 60 × 60 cm), Langhantelständer
- **Cardio:**

  | Gerät | B × T × H cm |
  |---|---|
  | Laufband | 90 × 210 × 160 |
  | Curved Treadmill | 90 × 190 × 170 |
  | Crosstrainer | 75 × 210 × 170 |
  | Ergometer | 60 × 120 × 140 |
  | Liegeergometer | 70 × 170 × 130 |
  | Spinning-Bike | 55 × 125 × 110 |
  | Air Bike | 65 × 130 × 130 |
  | Rudergerät | 60 × 245 × 50 |
  | Stairmaster | 80 × 150 × 210 |
  | SkiErg | 60 × 125 × 215 |

- **Functional:** Sled-Bahn (Kunstrasen, Breite 150 cm, Länge frei), Kettlebell-Regal, Plyo-Boxen, Matten, Medizinball-Regal, Battle-Rope-Anker, Rig/Functional-Gerüst (frei skalierbar), Sprossenwand, Boxsack
- **Empfang & Lounge:** Theke (frei skalierbar), Drehkreuz/Zugangsschranke, Shakebar, Kühlschrank, Getränkeautomat (ca. 90 × 90), Sofas, Stehtische, Stühle, Garderobe, Info-Bildschirm
- **Umkleide:**
  - Spinde 1-/2-/3-/4-stöckig (Abteilbreite 30 oder 40 cm, Tiefe 50 cm, Höhe 180 cm). Das Objekt „Spindreihe“ hat eine frei wählbare Anzahl an Abteilen und zeigt die Anzahl der Fächer an.
  - Umkleidebänke (freistehend 150 × 40 cm, Wandbank, Bank mit Schuhrost, Mittelbank vor Spindreihe)
  - Spiegel, Föhnplatz, Waschtisch, Einzelkabine
  - Einzeldusche 90 × 90, Reihendusche, Duschtrennwand, barrierefreie Dusche 150 × 150
  - WC-Kabine 90 × 150, Urinal, barrierefreies WC (Bewegungsfläche 150 × 150), Wickeltisch
  - Handtuchspender, Wäschesammler, Wertfächer
- **Wellness:**
  - Finnische Sauna (200 × 200, 300 × 300, 400 × 300, frei skalierbar), Bio-Sauna, Infrarotkabine (120 × 105), Dampfbad
  - Cold Plunge / Tauchbecken (z. B. ReGen OG Plunge / The Blast, ca. 180 × 80 × 75, als ungeprüft markieren), Eisbrunnen, Kneipp-Becken, Erlebnisdusche, Schwallbrause
  - Ruheliegen (200 × 70), Wasserbett, Solarium, Red-Light-Panel, Massagestuhl, Massageliege, Whirlpool, Teestation
- **Kursraum:** Steps, Mattenregal, Spinning-Räder, Trainer-Podest, Musikanlage
- **Büro & Personal:** Schreibtisch, Bürostuhl, Aktenschrank, Besprechungstisch
- **Lager & Technik:** Regale, Lüftungsanlage, Waschmaschine/Trockner, Putzwagen, Schaltschrank
- **Ausstattung:** Pflanzen, Lautsprecher, TVs an der Wand, Wasserspender, Desinfektionsstation, Mülleimer, Feuerlöscher, Erste-Hilfe-Kasten, AED/Defibrillator, Notausgang-Schild, Kameras

## 6. Auswertung & Analyse (Seitenpanel „Übersicht“)
- **Flächenbilanz** (Gesamt, pro Stockwerk, pro Raumtyp in m² und %):
  - Brutto-Hallenfläche, Netto-Nutzfläche, Trainingsfläche, Wellness, Umkleide/Sanitär, Nebenflächen, Verkehrsflächen
  - Kreis- oder Balkendiagramm
- **Geräte-Statistik:**
  - Anzahl je Kategorie, Hersteller und Serie
  - Summe der reinen Gerätegrundfläche, Summe inklusive Sicherheitszonen, freie Restfläche je Raum
- **Gewicht & Bodenlast:** Gesamtgewicht der Geräte pro Raum/Stockwerk und kg/m², mit Warnung ab einem einstellbaren Grenzwert (Standard 500 kg/m²). Das ist besonders wichtig fürs Obergeschoss.
- **Kapazität:** geschätzte Anzahl gleichzeitig Trainierender (einstellbar, Standard 8–10 m² Trainingsfläche pro Person). Außerdem Spinde, Duschen und WCs im Verhältnis dazu, mit Hinweis wenn zu wenige.
- **Stückliste (BOM)** mit Hersteller, Serie, Modell, Maße, Gewicht, Anzahl, Stückpreis und Summe. Die Preise sind editierbar, die Gesamtkosten werden berechnet.
- **Planungs-Warnungen** (Liste, Klick springt zum Problem):
  - Geräte oder Sicherheitszonen überlappen sich
  - Gerät steht in einer Tür-Schwenkfläche oder vor einem Notausgang
  - Laufweg bzw. Fluchtweg schmaler als 120 cm (Wert einstellbar)
  - Gerät höher als die Deckenhöhe des Stockwerks (z. B. Racks mit 246 cm)
  - Bodenlast überschritten
  - Umkleide ohne Dusche/WC, Sauna ohne Ruhebereich/Dusche in der Nähe
  - Gerät außerhalb der Halle
  - Maße ungeprüft (`verifiziert: false`)

## 7. Ansichten & Ebenen
- 2D-Draufsicht (Hauptansicht) mit Zoom (Mausrad, Pinch) und Pan (Leertaste + Ziehen, mittlere Maustaste), „Alles einpassen“, Minikarte
- Ebenen ein-/ausblendbar: Raster, Wände, Räume, Geräte, Sicherheitszonen, Bemaßung, Beschriftungen, Möbel, unteres Stockwerk
- **Bemaßungswerkzeug:** Messlinie zwischen zwei Punkten, automatische Wandbemaßung, Abstand zum nächsten Objekt beim Ziehen anzeigen
- **3D-Vorschau** (umschaltbar): Wände, Fenster, Türen und Geräte in echter Höhe als vereinfachte Körper, frei drehbar, pro Stockwerk oder alle
- Präsentationsmodus ohne Werkzeugleisten

## 8. Bedienung
- Links die **Werkzeugleiste** (Auswahl, Halle, Wand, Raum, Tür, Fenster, Spiegel, Treppe, Messen, Text/Notiz), rechts die **Bibliothek** und das **Eigenschaften-Panel**, oben Projektname, Stockwerk-Tabs, Undo/Redo, Speichern und Export
- **Tastenkürzel:** V Auswahl, W Wand, M Messen, R Drehen, Entf Löschen, Strg+Z/Y Undo/Redo, Strg+C/V/D Kopieren/Einfügen/Duplizieren, Pfeiltasten verschieben um 1 cm (mit Shift um 10 cm), Strg+G Gruppieren, Esc Abbrechen, ? zeigt eine Kürzel-Übersicht
- Rechtsklick-Kontextmenü an allen Objekten
- Alle Werte sind auch numerisch eingebbar: Position X/Y, Drehung, Maße, Wandlänge
- Beim ersten Start gibt es ein kurzes interaktives Tutorial (überspringbar)

## 9. Projekte, Speicherung & Export
- Mehrere Projekte verwalten (anlegen, umbenennen, duplizieren, löschen), dazu Varianten eines Projekts zum Vergleichen („Variante A: 450 m² / Variante B: 600 m²“)
- Autosave, Versionsverlauf (letzte Stände wiederherstellen)
- **Export:**
  - Plan als PNG und PDF (maßstäblich, z. B. 1:100, mit Legende, Flächenbilanz und Stückliste)
  - Stückliste als CSV/Excel
  - Projekt als JSON (Import muss das exakt wiederherstellen)
- **Vorlagen:** leere Halle 20 × 25 m, „Kleines Studio 400 m²“, „Mittleres Studio 800 m²“, jeweils sinnvoll mit Atlantis- und Prime-Geräten aus der Liste oben vorbelegt

## 10. Design
- Modern, clean, professionell (Referenz: Figma, Floorplanner, SketchUp Web)
- Gut lesbare Raumfarben, klare Draufsicht-Symbole je Gerätetyp (Beinpresse sieht anders aus als Laufband)
- Die App ist für Desktop optimiert und auf dem Tablet mit Touch bedienbar
- Hell- und Dunkelmodus

## 11. Qualität & Abnahmekriterien
- [ ] Eine 25 × 20 m Halle zeigt exakt „500,00 m²“. Eine L-förmige Halle wird korrekt berechnet.
- [ ] Ein Raum aus Wänden zeigt seine Innenfläche (ohne Wandstärke) korrekt in m².
- [ ] Ein zweites Stockwerk lässt sich anlegen, bearbeiten und mit einer Treppe verbinden.
- [ ] Alle 132 Atlantis- und 70 Prime-Einträge aus Abschnitt 5.2 sind in der Bibliothek, mit exakt den dort genannten Maßen. Ein Test vergleicht die Bibliothek gegen `gym-planner/data/*.json`.
- [ ] Ein platziertes Gerät hat exakt seine hinterlegten Maße und lässt sich nicht verzerren. Beispiel: Atlantis C513 Power Rack belegt 165 × 203 cm, Prime Hybrid Leg Press 120 × 191 cm.
- [ ] Die Sicherheitszone eines Laufbands wird angezeigt, eine Überlappung wird rot gewarnt.
- [ ] Ein Rack mit 246 cm Höhe in einem Raum mit 240 cm Deckenhöhe erzeugt eine Warnung.
- [ ] Türen und Fenster sitzen in Wänden und bewegen sich mit der Wand.
- [ ] Undo/Redo funktioniert für jede Aktion.
- [ ] Nach einem Neuladen der Seite ist der Plan vollständig wiederhergestellt. JSON-Export und -Import ergeben ein identisches Projekt.
- [ ] Der PDF-Export ist maßstäblich und enthält Flächenbilanz und Stückliste.
- [ ] Mit 500 Objekten bleibt das Ziehen flüssig (≥ 50 fps).
- [ ] Unit-Tests für Flächenberechnung, Snapping, Kollision und Einheitenumrechnung sind grün.

## 12. Vorgehen
Arbeite in dieser Reihenfolge und liefere nach jeder Phase einen lauffähigen Stand:
1. Projektgerüst, Canvas mit Raster, Zoom/Pan, Einheiten, Halle zeichnen + m²
2. Wände, Räume, Türen, Fenster, Spiegel
3. Bibliothek aus `gym-planner/data/*.json` + Drag & Drop, Drehen, Sicherheitszonen, Kollision
4. Alle weiteren Kategorien (Cardio, Umkleide, Wellness usw.)
5. Stockwerke, Treppen, Luftraum
6. Übersicht (Flächenbilanz, Stückliste, Bodenlast, Kapazität, Warnungen)
7. Speichern, Projekte, Varianten, Export (PNG/PDF/CSV/JSON), Vorlagen
8. 3D-Vorschau, Tutorial, Feinschliff, Tests

Zum Schluss erstellst du eine README mit Start-Anleitung (`npm install && npm run dev`) und einer Anleitung, wie man neue Geräte in die Bibliothek einträgt.
