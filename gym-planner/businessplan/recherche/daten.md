# Datenauszug „No.1 (überarbeitet)“ für den Businessplan

Quelle: `gym-planner/examples/No1-ueberarbeitet.gymplanner.json` (exportedAt 2026-09-26T22:33:28Z, schemaVersion 1), ausgewertet mit den App-Funktionen
`areaBalance`, `capacity`, `regulations`, `warnings`, `bom`, `costs` (src/analysis). Alle Beträge **netto EUR, ganze Euro**, Geräte-Preise aus der App-Bibliothek
(prices.json: Listen-/Händlerpreise bzw. Schätzungen), Ausbau/Laufend aus `DEFAULT_COST_ASSUMPTIONS` (Projekt enthält keine eigenen Kostenannahmen, keine Preisüberschreibungen).
Vollständige Daten: `daten.json` (Schlüssel: meta, projekt, kapazitaet, sicherheit, kosten_app_9eur, kosten_app_850, kosten_barkauf_850, geraete, ausstattung_zaehlung).

## 1. Projekt / Flächen
- 1 Stockwerk „EG“, Halle 59,50 × 33,20 m, Außenwand 24 cm, Deckenhöhe **4,00 m**, Bodenbelag Gummiboden; 50 Wände, 54 Öffnungen (28 Türen, 13 Fenster, 13 Spiegel), 369 Objekte, 8 Zonen, 18 typisierte Räume (26 Räume/Zonen gesamt).
- **Bruttofläche 1.975,40 m²**, **Nettofläche 1.931,13 m²**, davon Innenwände 27,94 m² (unzugeordnet).
- Flächenklassen: Trainingsfläche **1.138,58 m² (59,0 %)**, Verkehrsfläche 340,26 m² (17,6 %), Nebenfläche 207,01 m² (10,7 %), Umkleide/Sanitär 158,99 m² (8,2 %), Wellness 58,35 m² (3,0 %).
- Flächen je Raumtyp (m²): Maschinen 476,17 (4 Zonen: Beine 141,90 · Rücken 158,68 · Schultern & Arme 99,50 · Brust 76,10) · Flur/Verkehr 340,26 · Freihantel 184,25 · HYROX 169,88 · Kursraum 149,01 · Functional/Stretching (Core & Dehnen) 88,11 · Empfang/Lounge 78,28 · Cardio 71,16 · Duschen 49,87 (Damen 25,14 / Herren 24,73) · Wellness/Sauna 45,99 · Umkleide Damen 44,92 · Umkleide Herren 44,18 · Lager 42,09 · Technik/Lüftung 24,04 · Putzraum 23,80 · WC 20,02 (Damen/barrierefrei 8,43 + Herren 11,58) · Büro 19,51 · Personalraum 19,30 · Ruheraum 12,36.

## 2. Kapazität (9 m²-Regel)
- **126 gleichzeitig Trainierende** (1.138,58 m² ÷ 9 m²), Bemessung Regularien 132 Personen (126 + 6 Beschäftigte).
- **Spindfächer 178** (8 Spindreihen 2-stöckig + 2 Wertfächer-Einheiten) – Soll ≥ 126 → ok.
- **Duschen 18** (4 Reihenduschen à 4 + 2 barrierefreie) – Soll ≥ 9 (empfohlen 13) → ok.
- **WCs 7 + 4 Urinale = 11** (davon 1 barrierefrei) – Soll ≥ 6 → ok; Waschtische 8.

## 3. Sicherheit / Regularien
- **6 Notausgänge** (alle typisiert, in Außenwänden): Breiten 200 / 100 / 90 / 100 / 100 / 100 cm = 690 cm gesamt (Soll ≥ 120 cm für 132 Personen).
- **12 gezeichnete Fluchtwege**, Lauflängen 14,7–35,2 m (Soll ≤ 52,5 m Lauflänge / ≤ 35 m Luftlinie), alle Status „ok“; max. Luftlinie je Raum 21,8 m.
- 21 Feuerlöscher (126 LE, Soll ≥ 60 LE), 2 AED, 5 Verbandkästen, 6 Notausgang-Schilder, 6 Rettungszeichenleuchten, 4 Flucht-/Rettungspläne, 1 barrierefreies WC.
- Regularien-Prüfung: **114 ok · 0 prüfen · 0 nicht erfüllt · 6 Hinweise · 1 nicht anwendbar** (VStättVO erst ab 200 Personen). Hinweise: Bewegungsfläche barrierefreies WC, Beschäftigten-Toiletten, Brandschutzhelfer, Ersthelfer, Legionellenprüfung, Feuerlöscherprüfung.
- Planungswarnungen: 1 Info (310 generische Objekte mit ungeprüften Maßen), keine Fehler/Warnungen.

## 4. Kosten laut App (netto)
| Kennzahl | App-Standard 9,00 €/m² (finanziert 5 J.) | **8,50 €/m² (finanziert 5 J.)** | 8,50 €/m² Barkauf |
|---|---|---|---|
| Geräte (Stückliste) | 590.968 € | 590.968 € | 590.968 € |
| Import-Nebenkosten 12 % auf 268.570 € Atlantis/Prime | 32.228 € | 32.228 € | 32.228 € |
| Einmalsumme (ohne finanzierte Geräte) | 1.243.141 € | 1.240.178 € | 1.938.158 € |
| **Gesamtinvestition** | 1.866.337 € | **1.863.374 €** | **1.938.158 €** |
| Monatliche Kosten | 61.997 € | **61.009 €** | 49.105 € (ohne Rate) |
| Jahr-1-Bedarf (Einmal + 12 Monate) | 1.987.105 € | 1.972.286 € | 2.527.418 € |
| Einmalkosten je m² brutto | 629 € | 628 € | 981 € |
| Break-even-Mitglieder (39 €/Monat) | 1.590 | **1.565** | 1.260 |

Einmalposten bei 8,50 €/m² (identisch bei 9 €, außer Kaution): Grundausbau 1.931,13 m² × 250 € = 482.784 · Lüftung (RLT) 1.931,13 m² × 110 € = 212.425 · Sportboden 1.138,58 m² × 55 € = 62.622 · Nassbereich-Boden 158,99 m² × 90 € = 14.309 · Spiegelwände 32,9 m × 660 € = 21.714 · Brandschutz/Sicherheitsbeleuchtung 1.931,13 m² × 30 € = 57.934 · Sanitärinstallation Duschen 18 × 1.500 = 27.000, WC/Urinale 11 × 800 = 8.800, Waschtische 8 × 500 = 4.000 · Planung 12 % von 891.588 = 106.991 · Sonstiges einmalig 32.000 · Unvorhergesehenes 12 % = 123.669 (finanziert) bzw. 198.453 (Barkauf) · Kaution 3 × 28.643 = 85.930 (bei 9 €: 3 × 29.631 = 88.893).

Geräte je Bereich (finanzierte Zeilen): Kraftgeräte 52 Stk. 268.570 · Cardio 20 Stk. 104.760 · Wellness 8 Stk. 55.850 · Umkleide 39 Stk. 32.310 · Ausstattung 111 Stk. 32.035 · Sanitär 18 Stk. 26.250 · Empfang & Lounge 28 Stk. 25.274 · Kursraum 28 Stk. 20.610 · Lager & Technik 14 Stk. 8.850 · Functional 22 Stk. 6.709 · Büro & Personal 12 Stk. 5.450 · Freihantel-Zubehör 10 Stk. 4.300 · Bauelemente 7 Stk. 0 €.

Monatlich bei 8,50 €/m²: Miete 1.975,40 m² × 8,50 = 16.791 · Nebenkosten × 6,00 = 11.852 · Personal 16.000 · Sonstiges 2.000 · Wartung 5 %/Jahr von 590.968 ÷ 12 = 2.462 · Finanzierungsrate 11.904 (Annuität auf 623.196 € bei 5,5 % p. a., 60 Monate). Miet-Effekt 9,00 → 8,50 €/m²: −988 €/Monat, −2.963 € Kaution.

## 5. Geräte / Stückliste
- 147 Positionen, 369 Objekte, Gesamt **590.968 €**, 23.484 kg; 0 Objekte ohne Preis.
- Import-Anteil (Atlantis 45 Objekte 250.070 € + Prime 7 Objekte 18.500 €) = **268.570 €** → Import-Nebenkosten 32.228 €.
- Preiskonfidenz: Listenpreis 7 Pos./22.580 € · Händler 58 Pos./372.319 € · Schätzung 82 Pos./196.069 €.
- Top-Positionen: Laufband 5 × 8.000 = 40.000 · Stairmaster 4 × 6.500 = 26.000 · Finnische Sauna 22.000 · Crosstrainer 3 × 7.000 = 21.000 · Dampfbad 20.000 · Converging incline bench press 3 × 5.080 = 15.240 · Wasserspender 10 × 1.500 = 15.000 · Indoor-Cycling-Räder 8 × 1.850 = 14.800 · Smith machine 2 × 7.240 = 14.480 · Unilateral lat pulldown 2 × 7.020 = 14.040 (Top 30 in daten.json).

## 6. Ausstattung (Zählung)
Cardio 20: Laufbänder 6 (5 motorisiert + 1 Curved), Crosstrainer 3, Stairmaster 4, Ergometer 3, Rudergeräte 2, SkiErg 2 · Kraftmaschinen 52 (Atlantis 45, Prime 7; Beine 12, Rücken 12, Arme 8, Brust 7, Racks 6, Bänke 3, Schultern 2, Rumpf 1, Plattform 1) · Racks 5 (3 Half rack, 1 Power rack, 1 Squat Stand) · Hantelbänke 3 (1 Flat, 2 Adjustable) · Kurzhantel-Racks 2, Scheibenständer 5, Hantelscheiben-Sätze 2 · Spindreihen 8 (178 Fächer), Wertfächer 2, Einzelkabinen 2, Umkleidebänke 10 · Duschen 18, WC 7, Urinale 4 · Wellness: Sauna 1, Dampfbad 1, Cold Plunge 1, Erlebnisdusche 1, Ruheliegen 3 · Kursraum: 8 Indoor-Cycling-Räder, 12 Kursmatten, Musikanlage, Trainerpodest · HYROX (8 Stationen laut Beschriftung): 2 Sleds + Sled-Bahn (2 × 12,5 m Kunstrasen), 2 SkiErg, 2 Rudergeräte, 2 Wall-Ball-Ziele + Regal, Sandbag-Regal, Farmers-Carry-Griffe, Kettlebell-Regal, Plyo-Box-Set, Medizinball-Regal, 2 Intervall-Timer · Functional-/Bodenmatten 9 · Ausstattung: 10 Wasserspender, 9 Desinfektionsstationen, 5 Kameras, 5 TV-Bildschirme, 2 Drehkreuze, 2 Theken.

## 7. Bilder
- `grundriss-no1.png` – PNG-Export der App (Export → PNG-Bild), 7500 × 4551 px, ohne UI, mit Legende und Fluchtwegen; `preview-grundriss.png` verkleinerte Fassung (1875 px breit).
- `scratchpad/agentU/nachher.png` – Vollbild-Screenshot 2000 × 1150 px **mit** App-Oberfläche (Toolbar, Kopf-/Statusleiste); als Übersicht brauchbar, für den Businessplan aber den PNG-Export verwenden.
