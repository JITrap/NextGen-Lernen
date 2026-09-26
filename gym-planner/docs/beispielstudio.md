# Beispielstudio 1.000 m² – Layoutbeschreibung

Die Vorlage `beispiel-1000` (`src/data/templates.ts`, Funktion `createExampleStudio`) ist das Standardprojekt beim
ersten Start und liegt als exportierte Projektdatei unter `examples/Beispielstudio-1000.gymplanner.json`.
Alle Maße in cm, Ursprung oben links, Hallen-Außenwand 24 cm (Innenkante bei 24 / 3976 bzw. 24 / 2476).

## Halle und Raumstruktur (40 × 25 m, 1.000 m² brutto, 969 m² netto)

| Bereich | Lage (Innenmaße) | Fläche | Inhalt |
|---|---|---|---|
| Empfang / Lounge | x 24–895, y 24–545 | 45,4 m² | Haupteingang (200 cm, zweiflügelig) oben, Theke mit Front zum Eingang, Drehkreuz (Eintritt) und Zugangsschranke mit Paniköffnung (Ausgang/Fluchtweg) münden in die zweiflügelige Glastür zur Halle (220 cm, y 290–510), Sofa/Sessel/Loungetisch als Wartebereich an der Westwand, daneben links unten Getränkeautomat und Shakebar mit 3 Barhockern (x ≤ 320) und Getränkekühlschrank, Garderobe, Info-Stele, Info-Bildschirm, Flucht- und Rettungsplan (Aushang) an der Wand zur Halle, 3 Pflanzen, Wasserspender, Desinfektionsstation, AED, Erste-Hilfe-Kasten, Feuerlöscher, Rettungszeichen + Sicherheitsleuchte am Eingang, Kamera; der Korridor des Fluchtwegs 5 (y 350–470 von der Glastür, x 270–390 zum Haupteingang) bleibt frei |
| Büro | x 24–345, y 555–895 | 10,9 m² | Schreibtisch, Bürostuhl, Rollcontainer, Aktenschrank, Heizkörper unter dem Fenster |
| Personalraum | x 355–645 | 9,9 m² | Pausentisch mit 2 Stühlen, Personalschrank, Teeküche, Feuerlöscher, Erste-Hilfe-Kasten |
| WC barrierefrei | x 655–895 | 8,2 m² | Barrierefreies WC quer an der Nordwand, Bewegungsfläche 150 × 150 cm (x 730–880, y 715–865) frei, Waschtisch, Handtuchspender; Tür (100 cm) schlägt nach außen in die Halle |
| Umkleide Damen / Herren | x 405–895, y 905–1495 bzw. 1505–2095 | je 28,9 m² | Spindreihe A (16 Abteile, 32 Fächer, 2-stöckig) an der Südwand, Spindreihe B (9 Abteile, 18 Fächer) an der Sanitärwand, Einzelkabine, Mittelbank mit Garderobe, Bank mit Schuhrost, Spiegel, Föhnplatz, Wertfächer, Mülleimer, Lüftungsauslass, Feuerlöscher |
| Duschen / WC Damen / Herren | x 24–395 | je 21,9 m² | 4 Einzelduschen, barrierefreie Dusche, 2 WC-Kabinen, Doppelwaschtisch, Handtuchspender, Wäschesammler; Damen: Wickeltisch, Herren: 2 Urinale |
| Lager | x 405–895, y 2105–2476 | 18,2 m² | Rolltor (250 cm) an der Südwand, Tür von der Halle, 2 Schwerlastregale, Regal (Ostwand ab y 2290, unterhalb des Fluchtweg-Korridors), Waschmaschine + Trockner, Hantelscheiben-Sätze, Feuerlöscher; Türen zu Technik und Putzraum schlagen ins Lager |
| Technik / Lüftung | x 24–395, y 2105–2355 | 9,3 m² | RLT-Gerät mit 60 cm Wartungsraum, Warmwasserspeicher, Serverschrank, Schaltschrank |
| Putzraum | x 24–395, y 2365–2476 | 4,1 m² | Putzwagen, Regal, Ausgussbecken |
| Wellness | x 3105–3976, y 575–1295 | 62,7 m² | Sauna 300 × 300, Infrarotkabine, Erlebnisdusche, Eisbrunnen, Cold Plunge, Red-Light-Panel, 4 Ruheliegen, Wasserbett und Massagestuhl (Grundflächen bis y 1075, davor 120 cm Gang zu den Ruheliegen), Teestation, Wasserspender, Wäschesammler, Handtuchspender, Feuerlöscher; Glastür von der Halle bei y 900 |
| Kursraum | x 3105–3976, y 1305–2476 | 102 m² | Spiegelwand (840 cm) an der Westwand, Trainerpodest mit Musikanlage davor, Mattenraster 3 × 4 = 12 Kursmatten ab x 3400 (≈ 3 m² je Platz; 135 cm Gang zwischen Trainerpodest und Matten), 6 Indoor-Cycling-Räder in 2 Reihen (≥ 100 cm Abstand), Mattenregal, Step-Wagen, Kurshantel-Regal, Gymnastikball-Regal an der Südwand, Wasserspender, Desinfektionsstation, 2 Lüftungsauslässe, 2 Lautsprecher, 2 Fenster, Erste-Hilfe-Kasten, Feuerlöscher, eigener Notausgang (Ostwand, y 2300) mit Rettungszeichen und Sicherheitsleuchte, zweiflügelige Tür (150 cm) von der Halle |
| Trainingshalle | x 905–3095 (oben rechts bis 3976 × 565) | 584,7 m² | L-förmig; Raum-Label ausgeblendet, die Zonen tragen die Beschriftung |

Die rechte Servicezeile beginnt erst bei y 570, dadurch gehört die Ecke oben rechts (8,7 × 5,4 m) zur Halle und
nimmt die HYROX-Bahnen auf. Gegenüber der Vorversion wurde die rechte Zeile auf 871 cm verschmälert
(Lager/Technik/Putzraum in die linke Zeile verlegt), sodass die Halle von 512 auf 585 m² wächst.

## Trainingshalle – Zonen (ohne Überlappung)

Gänge: 125 cm entlang beider Servicewände (Türen), ≥ 125 cm zwischen gegenüberliegenden Reihen, Reihen
Rücken an Rücken berühren sich mit ihren Sicherheitszonen. Alle Mittelpunkte auf dem 10-cm-Raster.

| Zone | Typ | Fläche | Geräte (Front → Gang) |
|---|---|---|---|
| Freihantel (oben links, L-förmig) | Trainingsfläche Freihantel | 65,2 m² | An der Spiegelwand (Nordwand, 1.100 cm Spiegel): Kurzhantel-Rack 15 Paar (S189), Kurzhantel-Rack 10 Paar (S187), Power Rack C513, Half Rack RS611, Heel-Raise-Plattform; ≥ 150 cm Freiraum vor den Kurzhantel-Racks. Zweite Reihe: Kreuzheben-Plattform B4800, Scheibenständer, Langhantelständer. Sichtachse vom Empfang (Glastür y 400) durch den Gang zwischen Rack-Reihe und zweiter Reihe |
| Core | Maschinen | 13,7 m² | Abdominal Crunch, Low Back Extension (Prime Hybrid), rechts in der zweiten Freihantel-Reihe |
| HYROX (oben rechts, L-förmig) | HYROX (neuer Raumtyp, gelb) | 110,1 m² | siehe unten |
| Brust | Maschinen | 56,7 m² | Reihe A (Front nach oben): Chest Press, Incline Press, Pec/Rear Delt, Functional Trainer (Cable Crossover), Olympic Flachbank P337, Olympic Schrägbank P338 |
| Rücken | Maschinen | 40,4 m² | Reihe B (Rücken an Rücken mit A, Front nach unten): T-Bar Row PW625 und Low Row PW637 (Plate Loaded, Scheibenständer gegenüber), Lat Pulldown, Seated Row, Chin/Dip Assist |
| Schultern & Arme | Maschinen | 50,3 m² | Rechter Teil von Reihe B: Shoulder Press, Lateral Raise; gegenüber Reihe D1 (Front nach oben): Arm Curl, Tricep Extension, Preacher Curl B256 |
| Beine | Maschinen | 73,4 m² | Reihe C (links, Front nach oben): Scheibenständer, Leg Press, Hack Squat, Pendulum Squat (alle Plate Loaded), Scheibenständer; Reihe D2 (rechts, Rücken an Rücken mit D1, Front nach unten): Leg Extension/Leg Curl Combo, Hip Thruster PW702, Inner/Outer Thigh (Abduktor/Adduktor) |
| Cardio (unten, L-förmig) | Cardio | 71,2 m² | Fensterband Süd (5 Fenster 200 cm) mit 3 TVs 65″ zwischen den Fenstern: 4 Laufbänder, Curved Treadmill, Crosstrainer, Stairmaster, Ergometer (links) und 4 Crosstrainer (rechts vor dem Beine-Block); Front zum Fenster, 200 cm Sturzraum nach innen |

Ausstattung in der Halle: 7 Wasserspender, 5 Desinfektionsstationen, Mülleimer, Handtuch-/Sprühflaschenhalter,
5 Lautsprecher, 3 Kameras. Gesamt 254 Objekte (30 Kraftgeräte, 16 Cardio-Geräte, 11 Functional-Objekte,
12 Atlantis-, 18 Prime-Geräte).

## HYROX-Bereich (8 Stationen)

- **Bahn 1** (Kunstrasen, 190 × 1.520 cm, x 2440–3960 entlang der Nordwand): Sled Push (2) und Sled Pull (3);
  zwei Schlitten stehen am Bahnanfang, Wall-Ball-Ziele (8) hängen an der Nordwand über dem Bahnende.
- **Bahn 2** (Mattenstreifen 190 × 1.520 cm): Burpee Broad Jump (4), Farmers Carry (6), Sandbag Lunges (7).
- **Stationsreihe** unter den Bahnen (Front zum Gang): 2 Rudergeräte (5 Rowing), 2 SkiErg (1), Kettlebell-Regal,
  Sandbag-Regal 10–30 kg, Wall-Ball-Regal, Farmers-Carry-Griffe.
- Intervall-Timer an der Nordwand, Wasserspender und Mülleimer am Bahnanfang, Stationsbeschriftung als
  Textnotizen (`kind: 'text'`), Überschrift „HYROX – 8 Stationen“ im Streifen über der Wellness.
- Gang von 120 cm zwischen Bahn 2 und der Wellness-Wand; Notausgang Ost (y 500) mit 150 cm Freihaltefläche.

Neue generische Objekte (`src/data/equipment/generic.json`, angehängt): `gen-hyrox-farmers-carry-griffe` (40 × 120),
`gen-hyrox-sandbag-regal` (120 × 50), `gen-hyrox-wall-ball-ziel` (60 × 10, Wandmontage), `gen-hyrox-wall-ball-regal`
(100 × 50), `gen-hyrox-intervall-timer` (60 × 8, Wandmontage), `gen-ausstattung-rettungszeichenleuchte` (30 × 8, Wandmontage).
Neuer Raumtyp `HYROX` (Farbe `#eab308`, Flächenklasse Trainingsfläche) in `src/types/model.ts` und `src/data/roomTypes.ts`.

## Sicherheit und Regularien

| Merkmal | Ausführung |
|---|---|
| Notausgänge (4) | Haupteingang Nord (x 300, 200 cm zweiflügelig), Halle Ost (x 3976, y 500, 100 cm), Halle Süd (x 2100, 100 cm), Kursraum Ost (y 2300, 100 cm) – alle an Außenwänden, 150 cm Freihaltefläche innen und außen frei |
| Rettungszeichen | je Notausgang ein Notausgang-Schild ≤ 150 cm neben der Tür (gleiche Wand) |
| Sicherheitsbeleuchtung | je Notausgang eine Sicherheitsleuchte / Rettungszeichenleuchte neben dem Schild |
| Feuerlöscher (15) | Empfang, Personalraum, beide Umkleiden, Lager, Wellness, Kursraum, Halle: 3 × Westwand (y 800/1400/2050), 2 × Ostwand (y 1150/1950), Nordwand (x 2400/3200), Südwand (x 2250); kein Punkt der Halle ist mehr als 20 m vom nächsten Gerät entfernt (Test: 100-cm-Raster), ≈ 1,5 Geräte je 100 m² |
| Erste Hilfe (5) | Empfang, Personalraum, Halle (Westwand y 1440), HYROX (Nordwand), Kursraum |
| AED (2) | Empfang (Nordwand) und Halle (Westwand y 1490) |
| Flucht- und Rettungsplan | Aushang (`gen-ausstattung-fluchtplan`, Wandobjekt) an der Empfangswand zur Halle (y 60), damit die Prüfung „Flucht- und Rettungsplan aushängen“ erfüllt ist |
| Desinfektion / Wasser | 5 Desinfektionsstationen, 7 Wasserspender |
| Barrierefreiheit | WC mit 150 × 150 cm Bewegungsfläche, Tür nach außen; barrierefreie Duschen in beiden Sanitärräumen |

### Fluchtwege (`floor.annotations`, `kind: 'escape-route'`)

Alle Wege verlaufen auf den Mittellinien der Gänge (keine Grundflächen gekreuzt, Wände nur an Türen; die Zugangsschranke im
Empfang hat Paniköffnung und ist Teil des Fluchtwegs) und enden ≤ 100 cm vor einem Notausgang.

| Nr. | Von | Nach | Weglänge | Luftlinie | Wegführung |
|---|---|---|---|---|---|
| 1 | Kursraum (Gang neben dem Trainerpodest, x 3330) | Notausgang Kursraum | 15,2 m | 10,9 m | Gang zwischen Podest und Mattenraster, dann bei y 2290 zwischen Matten und Regalen |
| 2 | Wellness (Ruhebereich Ost, y 1160) | Notausgang Halle Ost | 24,0 m | 6,6 m | Gang zwischen Wasserbett/Massagestuhl und Ruheliegen, Glastür, Hallen-Gang vor der Wellness-Wand |
| 3 | Umkleide Herren (Raumtür, y 1565) | Notausgang Halle Süd | 21,1 m | 15,0 m | Gang zwischen Reihe B (Rücken) und Reihe C (Beine), Gang zwischen Beine-Block und Arme-Block |
| 4 | Cardio, Ecke Südwest | Notausgang Halle Süd | 13,2 m | 10,8 m | Gang zwischen Beine-Reihe und Cardio |
| 5 | Freihantel (Rack-Gang) | Haupteingang | 11,4 m | 8,5 m | Glastür, Zugangsschranke, an Theke und Shakebar vorbei zum Haupteingang |
| 6 | Technik / Lager (Techniktür, y 2280) | Notausgang Halle Süd | 33,3 m | 17,2 m | durch das Lager (Korridor 100 cm) zur Lagertür, Gang entlang der Servicezeile, weiter wie Weg 3 |

### Fluchtwege und Regularien-Prüfung

Die Regularien-Prüfung (`regulations(project)`, Übersicht → „Regularien & Brandschutz“) meldet für die Vorlage **keine Prüfung
„nicht erfüllt“ und keine „prüfen“** (78 erfüllt, 6 Hinweise, 1 nicht anwendbar). Dafür gelten beim Aufbau der Fluchtwege diese
Regeln: Der Korridor jedes Segments (120 cm in der Halle, im Empfang, in Wellness und Kursraum; 100 cm in Nebenräumen wie
Lager, Technik oder Umkleiden) ist frei von Objekt-Grundflächen – Wege laufen deshalb auf der Mittellinie der Gänge mit
≥ 60 cm (Nebenräume ≥ 50 cm) Abstand zu Grundflächen; Drehkreuz und Zugangsschranke (Paniköffnung) zählen nicht, Kursmatten
würden als „prüfen“ gemeldet und werden deshalb ebenfalls umgangen. Wege aus Nebenräumen unter 40 m² (Umkleide Herren
28,9 m², Technik 9,3 m², Lager 18,2 m²) beginnen an der Raumtür. Dazu wurden das Mattenraster im Kursraum nach rechts
(x ≥ 3400) gerückt, Wasserbett und Massagestuhl in der Wellness nach oben (Grundflächen bis y 1075), das Lager-Regal unter den
Korridor der Techniktür (y ≥ 2290) und im Empfang Shakebar, Barhocker und Getränkeautomat links unten neben die Lounge
gesetzt, sodass der Korridor von der Glastür (y 350–470) und zum Haupteingang (x 270–390) frei bleibt. Der Aushang „Flucht-
und Rettungsplan“ an der Empfangswand erfüllt die organisatorische Prüfung; übrig bleiben nur Hinweise (Beschäftigten-WC,
Brandschutzhelfer/Ersthelfer, Feuerlöscherprüfung, Legionellen, Bewegungsfläche des barrierefreien WCs). Der Test
„Regularien: keine Prüfung „nicht erfüllt“ oder „prüfen““ in `src/data/templates.test.ts` sichert diesen Stand ab.

## Kennzahlen

- Brutto 1.000 m², netto 969 m², Trainingsfläche 583 m² (Zonen + Kursraum), 14 automatisch erkannte Räume + 8 Zonen.
- Kapazität (9 m² je Person): 64 Personen; Spinde 100 (Bedarf 64), Duschen 10 (Bedarf 5), WCs 7 inkl. Urinale (Bedarf 3).
- Warnungen ab Werk: nur die Info „Maße ungeprüft“ (generische Bibliothek); keine Kollisionen, Tür-, Notausgang- oder Laufweg-Warnungen.
- Regularien-Prüfung: 78 erfüllt, 0 nicht erfüllt, 0 prüfen, 6 Hinweise (Bemessung 70 Personen, 4 Notausgänge, 90 LE, 5 Verbandkästen, 2 AED).
- Türen 18 (inkl. Rolltor), Fenster 13, Spiegelwände 2, Anmerkungen 16 (6 Fluchtwege, 10 Textnotizen).

## Tests

`src/data/templates.test.ts` prüft für die Vorlage u. a.: Räume und Zonen (inkl. Rasterprobe auf Überlappung), Geräte je
Muskelgruppen-Zone und Reihenausrichtung, Gänge ≥ 120/125 cm, Scheibenständer ≤ 6 m von Plate-Loaded-Geräten,
Cardio am Fensterband, HYROX-Stationen und -Bahnen, Kursraum (Matten, Räder-Abstand, Regale, Notausgang), Ausstattung
aller Räume, Sicherheitsausstattung (Rettungszeichen/Sicherheitsleuchte je Notausgang, Feuerlöscher-Abdeckung ≤ 20 m,
Erste Hilfe, AED), Fluchtwege (Ende am Notausgang, Länge ≤ 52,5 m, Luftlinie ≤ 35 m, keine Grundflächen, Wände nur an
Türen), Kapazität, Warnungsfreiheit und die Regularien-Prüfung ohne „nicht erfüllt“/„prüfen“ (inkl. Korridor-Prüfung je
Fluchtweg und Flucht- und Rettungsplan im Empfang).
