# Nutzerprojekt „No.1“ – Überarbeitung

Ausgangsdatei: das vom Nutzer gebaute Projekt „No.1“ (Halle 59,5 × 33,2 m = 1.975 m², 224 Objekte, 50 Wände, 34 Öffnungen,
36 Zonen). Ergebnis: `examples/No1-ueberarbeitet.gymplanner.json` (GymPlanner-Projektdatei, über Projekte → Importieren ladbar).
Die Datei wurde programmatisch erzeugt: ein Vitest-Skript lädt die Nutzerdatei per `parseProjectDetailed`, behält Halle,
Wände, Türen, Fenster und Spiegel sowie die Geräteauswahl, baut Zonen, Objekte, Notausgänge, Sicherheitsausstattung und
Fluchtwege mit den Layout-Regeln der Vorlagen neu auf (Belegungsbox = Grundfläche + Sicherheitszone, 10-cm-Raster, Reihen
Rücken an Rücken, Gänge ≥ 125 cm) und schreibt das Ergebnis per `serializeProject`. `src/data/examples.test.ts` prüft die
Datei bei jedem Testlauf (nur Info „Maße ungeprüft“, Regularien ohne „nicht erfüllt“/„prüfen“, Kapazität erfüllt, alle
Räume typisiert, Rack-Module angedockt).

## Vorher / nachher

| Kennzahl | Vorher | Nachher |
|---|---|---|
| Objekte / Zonen / Lufträume / Öffnungen | 224 / 36 / 4 / 34 | 369 / 8 / 0 / 54 |
| Planungs-Warnungen | 26 Laufweg-Engpässe (5 Warnungen, schmalster 40 cm), Umkleide ohne WC, 6 Rack-Module ohne Rack, zu wenige Spinde, Info „Maße ungeprüft“ | nur Info „Maße ungeprüft“ |
| Regularien (nicht erfüllt / prüfen / erfüllt / Hinweis) | 22 / 20 / 29 / 7 | 0 / 0 / 114 / 6 |
| Automatisch erkannte Räume ohne Typ | 12 | 0 |
| Notausgänge (Außenwand) | 1 (Haupteingang, schlägt nach innen auf) | 6 (Haupteingang nach außen + 5 neue) |
| Rettungszeichen / Rettungszeichenleuchten | 0 / 0 | 6 / 6 (je Notausgang ≤ 150 cm) |
| Feuerlöscher (Löschmitteleinheiten) | 0 (Soll 60 LE) | 21 × 6 LE = 126 LE, kein Punkt > 20 m |
| Erste-Hilfe / AED / Flucht- und Rettungsplan | 1 / 0 / 0 | 5 / 2 / 4 |
| Barrierefreies WC | – | 1 (WC Damen, Tür 90 cm nach außen) |
| Fluchtwege (Anmerkungen) | 0 | 12, alle Prüfungen erfüllt (14,7–35,2 m Lauflänge) |
| Kapazität (9 m² je Person) | 120 Personen, Spinde 59 (zu wenig), Duschen 16, WCs 10 | 126 Personen, Spinde 178, Duschen 18, WCs 11 (7 WC + 4 Urinale) |
| Trainingsfläche | 1.083 m² (Zonen überlappen, Flächenbilanz doppelt) | 1.139 m² (8 Zonen ohne Überlappung + Kursraum) |
| Geräte-Summe (Bibliothekspreise) | 423.350 € | 625.008 € |
| Einmalkosten (Standardannahmen, Geräte finanziert) | 1.150.289 € | 1.243.141 € (Gesamtinvestition 1.900.377 €) |
| Laufende Kosten je Monat | 58.017 € | 62.789 € |

## Was geändert wurde

### Räume und Zonen
- Alle 18 automatisch erkannten Räume sind typisiert (`roomMeta`): Empfang/Lounge, Büro, Personalraum, Lager, Technik/Lüftung,
  Putzraum, Umkleide Damen/Herren, Duschen ×2, WC ×2, Wellness/Sauna, Ruheraum, Kursraum, Flur Umkleiden, Flur WC/Wellness,
  Trainingshalle (Flur/Verkehrsfläche, Beschriftung ausgeblendet).
- Die 36 Zonen des Nutzers (davon 21 nur Raumtyp-Dopplungen, 3 getrennte Brust-Zonen, 5 HYROX-Teilzonen) sind durch 8 Zonen
  ohne Überlappung ersetzt: Freihantel 184 m², Beine 142, Brust 76, Rücken 159, Schultern & Arme 100 (neu), Core & Dehnen 88,
  HYROX 170 (Raumtyp HYROX), Cardio 71. Kursraum ist der Raum selbst (149 m²).
- Die 4 „Lufträume“ waren als Gänge missbraucht und minderten die Nettofläche (1.779 → 1.931 m²); sie sind entfernt.

### Trainingshalle (Reihen mit gemeinsamen Kanten, Gänge 130–200 cm, Laufweg-Heuristik ohne Engpässe)
- **Freihantel** (oben links, Spiegel Nord + West): Kurzhantel-Racks, Langhantel- und Scheibenständer an der Spiegelwand mit
  200 cm Freiraum, Power Rack (neu) + Kreuzheben-Plattform (neu) + Bank, dahinter die beiden Smith Machines (Rücken an
  Rücken), Flach-/Schrägbank vor dem Westspiegel, Single-Leg-Stand, Scheibenständer, Stretching-Matte. Notausgang West.
- **Beine**: Reihe 1 an der Nordwand (Leg Press 40°, Hack Squat, Horizontal Leg Press, Pendulum, Glute Abductor, Hip Thruster),
  Reihe 2 Front Nord (Scheibenständer für Plate Loaded, Leg Extension, Lying/Kneeling Leg Curl, Seated Calf, Inner Thigh).
- **Brust**: Reihe 3 Rücken an Rücken mit Beine 2 (2× Incline Pec Fly, Decline Chest Press, Pec/Rear Delt, 3× Converging Incline Press).
- **Rücken**: Plate-Loaded-Reihe mit Scheibenständer (T-Bar Row, Low Row, Row, Lat Pulldown, Assisted Chin/Dip) und die
  **Rack-Straße**: 3 Half Racks (Atlantis C511, neu) als Träger der 6 Rack-Module des Nutzers (2× MS6 Lat Pulldown,
  2× MS7 Low Row, 2× MS12 Unilateral Lat) – je Rack ein Modul links und rechts, angedockt (`dockedTo`), Front nach außen.
- **Schultern & Arme** (neu zusammengefasst): Biceps Isolator, Preacher Curl, Arm Curl, 2× Double-Sided Preacher, Triceps
  Pushdown; zweite Reihe Incline Triceps, Dip Bars, Converging Shoulder Press (neu), Standing Lateral Raise (neu).
- **Core & Dehnen** (Hallenmitte, vorher leer): Hyper Extension, Abdominal Crunch (neu), Mattenregal, 4 Trainingsmatten,
  Medizinball-Regal, Plyo-Boxen, Stretching-Matten.
- **Cardio** am neuen Fensterband Ost (7 Fenster 150 cm, 3 TVs): 5 Laufbänder, Curved Treadmill (neu), 4 Stairmaster,
  3 Crosstrainer (neu), 3 Ergometer (neu); Front zum Fenster, Sturzraum 200 cm nach innen.
- **HYROX** (oben rechts): Bahn 1 Kunstrasen 2 × 16 m (Sled Push/Pull), Bahn 2 Mattenstreifen (Burpee Broad Jump, Farmers Carry,
  Sandbag Lunges), 2 Schlitten am Bahnende, Stationsreihe (2 Rudergeräte und 2 SkiErg aus dem Cardio-Bereich, Kettlebell-,
  Sandbag-, Wall-Ball-Regal, Farmers-Carry-Griffe), Wall-Ball-Station mit 2 Wandzielen, 2 Intervall-Timer, Stationsbeschriftung
  als Textnotizen.
- Ausstattung: 11 Wasserspender, 10 Desinfektionsstationen, Mülleimer, 6 Lautsprecher, 5 Kameras, Handtuchhalter.

### Kursraum (vorher ohne Tür und leer)
Zweiflügelige Tür (150 cm) von der Halle, die in Fluchtrichtung in die Halle aufschlägt; Spiegelwand West (280 + 620 cm);
Trainerpodest mit Musikanlage; 12 Kursmatten (3 × 4); 8 Indoor-Cycling-Räder in 2 Reihen (Abstand ≥ 100 cm); Matten-,
Step-, Kurshantel- und Gymnastikball-Regal an der Südwand; 2 Sitzbänke; Wasserspender, Desinfektion, 2 Lüftungsauslässe,
2 Lautsprecher, TV, Erste-Hilfe, Feuerlöscher, Fluchtplan; eigener Notausgang Ost mit Rettungszeichen und Leuchte;
2 Fenster Ost, 2 Fenster Süd.

### Umkleiden, Duschen, WC
- Die 58 einstöckigen Einzelspinde sind durch 2-stöckige Spindreihen (30-cm-Abteile) ersetzt: je Umkleide Reihe A zwischen
  den Duschtüren, B/C beidseits der Flurtür, D an der Westwand → 178 Fächer (Bedarf 126). Bänke beidseits der vorhandenen
  Spiegel-Stummelwand, Einzelkabine, Föhnplatz, Wertfächer, Wäschesammler, Lüftung, Müll, Desinfektion, Feuerlöscher.
- Duschen: je 2 Reihenduschen (4 Plätze) + barrierefreie Dusche (neu), WC-Kabine, Doppelwaschtisch, Handtuchspender/-halter,
  Wäschesammler; Herren zusätzlich 3 Urinale.
- WC Damen: barrierefreies WC (neu, 150 × 220 inkl. Bewegungsfläche) + Kabine, Tür schlägt jetzt nach außen (Flur) auf.
  WC Herren: 3 Kabinen, Urinal, Waschtisch, Tür nach außen. Die 6 WC-Kabinen und 4 Urinale des Nutzers bleiben erhalten.
- Flur Umkleiden: Notausgang Süd (neu) mit Rettungszeichen/Leuchte, Wartebänke, Wasserspender, Feuerlöscher, Fluchtplan.

### Wellness, Ruheraum, Empfang, Nebenräume
- Wellness: Sauna 400, Dampfbad (auf 250 × 220 verkürzt, damit der Fluchtwegkorridor frei bleibt), Erlebnisdusche (neu),
  Cold Plunge, Wäschesammler, Handtuchspender; Vorraum mit Teestation, Wasserspender, Pflanze. Ruheraum: 3 Ruheliegen, TV.
- Empfang/Lounge: Empfangstheke mit Front zum Haupteingang, Back-Office-Theke, Shakebar mit 5 Barhockern, 2 Drehkreuze vor
  der Flurtür (Ausgang mit Paniköffnung), Besprechungstisch mit 6 Stühlen, Sofas + Loungetisch, Getränkeautomat,
  Info-Bildschirm, Pflanzen, Wasserspender, Desinfektion; AED, Erste-Hilfe, Feuerlöscher, Flucht- und Rettungsplan an der
  Wand; Rettungszeichen + Leuchte am Haupteingang.
- Büro (Schreibtisch, Bürostuhl, 2 Rollcontainer, 3 Aktenschränke, 2 Besucherstühle, Heizkörper), Personalraum (Pausentisch
  mit 4 Stühlen, 2 Personalschränke, Teeküche, Kühlschrank, Erste-Hilfe, Feuerlöscher), Lager (2 Schwerlastregale, 4 Regale,
  Waschmaschine/Trockner, Hantelscheiben), Technik (RLT-Gerät, Warmwasserspeicher, Serverschrank, Schaltschrank),
  Putzraum (Putzwagen, Regal, Ausgussbecken, Wäschesammler).

### Sicherheit
- Notausgänge an Außenwänden, alle nach außen aufschlagend: Haupteingang (200 cm, jetzt Typ Notausgang, Aufschlag nach
  außen), West (Freihantel, y −6 m), Nord (Beine/HYROX, 90 cm), Nord-Ost (Cardio/HYROX), Süd (Flur Umkleiden), Kursraum Ost.
  Jeder Rasterpunkt aller Räume liegt ≤ 30 m Luftlinie vom nächsten Notausgang (kein „prüfen“).
- 21 Feuerlöscher (Empfang, Personal, Lager, Technik, Umkleiden, Flure, Wellness, Kursraum, 10 in der Halle), 5 Erste-Hilfe-
  Kästen, 2 AED (Empfang, Halle), 4 Flucht- und Rettungspläne.
- 12 Fluchtwege als Anmerkungen (`kind: 'escape-route'`): Freihantel → West; Beine → Nord; Cardio → Nord-Ost; Rack-Straße
  → Nord-Ost; Schultern & Arme → Süd; Duschen/Umkleide Damen und Herren → Süd; Kursraum → Kursraum-Notausgang; Büro/Personal
  → Haupteingang; Technik/Lager → Haupteingang; Wellness → Süd; Kursraum → Halle → Süd. Alle enden ≤ 100 cm an der Tür,
  Lauflänge ≤ 35,2 m, Korridor (120 cm Halle / 100 cm Nebenräume) frei, Wände nur durch Türen.

### Geräteauswahl
Alle 76 Bibliotheks-IDs des Nutzers sind in mindestens gleicher Anzahl enthalten (Ausnahme: 58 Einzelspinde → Spindreihen,
Fächer zählen). Ergänzt (Auswahl): 3 Half Racks C511 für die Rack-Module, Power Rack C513, Plattform B4800, Shoulder Press
E449, Lateral Raise E252, Abdominal Crunch, 3 Scheibenständer, Cardio (Curved Treadmill, 3 Crosstrainer, 3 Ergometer),
komplette HYROX-Stationen, Kursraum-Ausstattung, Spindreihen, Sanitär (barrierefreie Duschen/WC), Sicherheitsausstattung.

## Begründungen
- Die Regularien-Prüfung meldet „prüfen“ ab 30 m Luftlinie; bei 59,5 m Hallenlänge sind deshalb vier Hallen-Notausgänge plus
  Kursraum-Ausgang nötig. Der Haupteingang wurde auf Aufschlag nach außen umgestellt (Panikbeschlag).
- Rack-Module (`nur_an_rack`) brauchen ein Rack in der Bibliothek; Half Racks sind die günstigste angedockbare Basis.
  Je Rack nur zwei Module (links/rechts), damit sich die Sicherheitszonen nicht überlappen.
- Reihen stehen 30 cm von der Nordwand, damit Wandobjekte (Feuerlöscher, Leuchten, Timer) nicht in Sicherheitszonen liegen.
- Cardio-Geräte stehen 10 cm vor der Ostwand (TVs), Ergometer direkt an der Wand (Zone 30 cm, Aufstellabstand < 40 cm).
- Umkleidebänke liegen außerhalb der 100-cm-Zonen vor den Spinden; die Fluchtwege laufen durch den 100-cm-Streifen zwischen
  Spindzone und Bänken und umgehen die Spiegel-Stummelwand.

## Offene Punkte für den Nutzer
- Aufschlagrichtung der Innentüren (Duschen, Umkleiden, Wellness) im Plan prüfen; die Prüfung gibt hierzu nur Hinweise.
- WC Herren ist knapp (3 Kabinen + 1 Urinal); 3 Urinale stehen im Herren-Duschraum. Sanitärplanung mit Fachplaner abstimmen.
- Der Technikraum ist nur über das Lager erreichbar (Bestand); für Wartung/Anlieferung ggf. eine Tür zur Halle ergänzen.
- Fenster Ost/Süd sind Annahmen (Fassade prüfen); die Bemessungspersonenzahl (126 + 6 Beschäftigte) liegt unter 200, damit
  gilt keine Versammlungsstättenverordnung – bei Erweiterung der Trainingsfläche neu prüfen.
- Bibliothekspreise sind Schätzungen nach Kategorie; Kosten mit Angeboten hinterlegen (`prices.json` bzw. Objektpreis).
- Die generischen Objekte (Maße ungeprüft) vor dem Kauf beim Hersteller bestätigen.
