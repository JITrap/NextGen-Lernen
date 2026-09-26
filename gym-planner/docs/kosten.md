# Kostenkalkulation und Bibliothekspreise

Die Kostenkalkulation (`src/analysis/costs.ts`) rechnet projektweit (alle Stockwerke) aus der Stückliste, der
Flächenbilanz und den Sanitär-Symbolen eine Einmal- und eine laufende Kostenschätzung. Alle Beträge sind
**netto in EUR ohne MwSt.**, auf ganze Euro gerundet. Anzeige im Panel „Übersicht → Kosten“
(`src/components/CostSection.tsx`), im PDF (`src/export/pdfCosts.ts`, Seiten „Kostenkalkulation“) und als CSV
(`exportCostsCsv`, Menü „Export → Kosten (CSV)“).

## Preise in der Bibliothek

`src/data/equipment/prices.json` liefert je Bibliotheks-ID einen Preis; `src/data/equipment/index.ts` mergt ihn beim
Laden (`withPrice`) in die `EquipmentDef`:

```json
{
  "stand": "2026-09",
  "hinweis": "Netto-Listen-/Marktpreise EUR ohne Fracht/Zoll/MwSt.",
  "preise": {
    "<def-id>": {
      "preis_eur": 8990,
      "quelle": "Text (Händler, Liste, „Schätzung nach Kategorie“)",
      "quelle_url": "https://… (optional)",
      "stand": "2026-09",
      "konfidenz": "liste" | "haendler" | "schaetzung",
      "hinweis": "optional (z. B. „je Abteil“, „je m²“, „Bestand/Bauleistung“)"
    }
  }
}
```

Regeln:

- Hat der Rohdatensatz (`data/atlantis.json`, `data/prime.json`, `generic.json`) bereits `preis_eur`, bleibt dieser
  erhalten und wird als `preisKonfidenz: 'liste'`, `preisQuelle: 'Herstellerdaten'` ausgewiesen.
- Sonst werden `preis_eur`, `preisQuelle`, `preisQuelleUrl`, `preisStand`, `preisKonfidenz`, `preisHinweis` gesetzt.
- IDs in `prices.json`, die es in der Bibliothek nicht gibt, werden ignoriert (`priceEntry` prüft zusätzlich auf
  endliche Zahl ≥ 0 und sichere Schlüssel).
- Bauelemente (Säulen, Heizkörper, Treppen, Aufzug, Lüftungsauslass …) tragen 0 € mit Hinweis „Bestand/Bauleistung“.
  Ebenfalls 0 € mit Hinweis „im Kostenblock … enthalten“ (sonst doppelt gezählt): Lüftungsanlage (Zentralgerät steckt
  in „Lüftung (RLT)“ je m²), Schaltschrank (Elektro im „Grundausbau“ je m²) und Rettungszeichenleuchte
  („Brandschutz / Sicherheitsbeleuchtung“ je m²). `library.test.ts` erlaubt höchstens 3 solcher generischen 0-€-Einträge.
- Tests: `src/data/equipment/library.test.ts` (alle 373 IDs bepreist, jede prices.json-ID existiert, Richtwerte).

Derzeit sind **alle** Einträge Schätzungen nach Kategorie (`konfidenz: "schaetzung"`), erzeugt aus Richtwerten je
Serie/Unterkategorie (Prime Hybrid 9.900–11.900 €, Prime Plate Loaded 5.900–8.900 €, Atlantis Precision 6.900–8.500 €,
Atlantis Power 4.800–6.500 €, Racks 3.900–5.500 €, Plattformen nach Fläche, kommerzielles Laufband 9.000 € …). Sie
sollen durch recherchierte Preise ersetzt werden – nur `prices.json` anfassen, das Schema bleibt.

Im Eigenschaften-Panel steht unter dem Preisfeld die Herkunft des Bibliothekspreises
(„Bibliothekspreis · Schätzung nach Kategorie · Schätzung · Stand 2026-09“), der Preishinweis, ggf. die Umrechnung
je Einheit und ein Link „Preisquelle öffnen“, sobald `quelle_url` gesetzt ist.

### Preiseinheiten skalierbarer Objekte (`src/analysis/priceUnits.ts`)

| Objekt | Einheit | Menge |
|---|---|---|
| Spindreihe (`symbol: locker-row`, skalierbar) | je Abteil | `faecher ÷ stoeckig`, sonst Breite ÷ Abteilbreite (40 cm) |
| Kunstrasen / Sled-Bahn (`symbol: turf`, skalierbar) | je m² | Breite × Tiefe des Objekts |
| alles andere | je Stück | 1 |

`libraryItemPrice(item, def)` = Preis × Menge. Die Stückliste (`bom`) nutzt diese Funktion für Objekte ohne eigenen
Preis; ein Objektpreis (`item.priceEur`) oder eine Projekt-Überschreibung (`priceOverrides`) gilt immer je Stück.

## Modell

Annahmen `CostAssumptions` (`src/types/model.ts`), Standardwerte `DEFAULT_COST_ASSUMPTIONS`; ein Projekt speichert
nur Abweichungen in `project.costs` (Partial). `costAssumptions(project)` ergänzt Standardwerte und ersetzt
ungültige Werte (keine endliche Zahl ≥ 0).

Eingaben aus der Analyse:

- `bom(project)`: Gerätesumme je Bibliotheksbereich (Objekte ohne Preis werden gezählt, nicht summiert).
- `areaBalance(project).total`: Brutto (Hallen-Außenpolygon), Netto (innen minus Lufträume), Flächenklasse
  „Umkleide/Sanitär“ (Nassfläche).
- `capacity(project).trainingM2`: Flächenklasse „Trainingsfläche“; ohne typisierte Räume gilt die Nettofläche.
- Öffnungen vom Typ Spiegel (nicht ausgeblendet): Summe der Breiten in m.
- Sanitär-Symbole: `shower`/`shower-row` (Duschen, Plätze via `params.plaetze`/`anzahl` oder Breite ÷ 90 cm),
  `toilet`, `urinal`, `sink` (Waschplätze via `params.plaetze`/`anzahl` oder Breite ÷ 60 cm).

### Formeln – Einmalkosten (Reihenfolge = Anzeige)

| Position | Formel |
|---|---|
| Geräte je Bereich | Σ Objektpreise des Bereichs (Stückliste) |
| Import-Nebenkosten | `importNebenkostenProzent` % × Gerätesumme der Hersteller Atlantis und Prime |
| Grundausbau | `ausbauEurM2` × Netto-m² |
| Sportboden | `bodenTrainingEurM2` × Trainings-m² |
| Nassbereich-Boden | `bodenNassEurM2` × Umkleide/Sanitär-m² |
| Lüftung (RLT) | `lueftungEurM2` × Netto-m² |
| Spiegelwände | `spiegelEurM` × Spiegel-m |
| Brandschutz / Sicherheitsbeleuchtung | `brandschutzEurM2` × Netto-m² |
| Duschen / WCs + Urinale / Waschtische (Installation) | Anzahl × `sanitaerDuscheEur` / `sanitaerWcEur` / `sanitaerWaschtischEur` |
| Planung / Genehmigung | `planungProzent` % × (Ausbau + Sanitär) |
| Sonstiges einmalig | `sonstigeEinmalEur` |
| Unvorhergesehenes | `unvorhergesehenProzent` % × Σ der bis dahin gezählten Einmalposten (ohne finanzierte Zeilen) |
| Kaution | `kautionMonate` × (`mieteEurM2Monat` + `nebenkostenEurM2Monat`) × Brutto-m² (nach „Unvorhergesehenes“, daher nicht darin enthalten) |

### Laufende Kosten je Monat

| Position | Formel |
|---|---|
| Miete / Nebenkosten | `mieteEurM2Monat` bzw. `nebenkostenEurM2Monat` × Brutto-m² |
| Personal / Sonstiges | `personalEurMonat`, `sonstigesEurMonat` |
| Wartung | `wartungProzentJahr` % × Gerätesumme ÷ 12 |
| Finanzierungsrate | Annuität auf (Geräte + Import) mit `zinsProzent` p. a. über `finanzierungJahre` (monatlich: `P·r / (1 − (1+r)^−n)`, `r = Zins/12`, `n = Jahre·12` gerundet; Zins 0 → `P/n`) – nur bei `n ≥ 1` Monat; Zeile als Pauschale (Menge 1), Basis und Laufzeit im Hinweis |

### Finanzierung vs. Barkauf

Bei `finanzierungJahre` ≥ 1/12 Jahr (Standard 5; entscheidend ist die gerundete Laufzeit in Monaten) zählen Geräte und Import **nicht** zur Einmalsumme – sie werden über die
Rate bezahlt. Die Gerätezeilen bleiben zur Information (`CostLine.finanziert`, Panel zeigt sie in Klammern), die
Gesamtinvestition (`investitionSummeEur` = Einmalsumme + Geräte + Import) wird zusätzlich ausgewiesen. Bei
`finanzierungJahre = 0` (Barkauf) zählen Geräte und Import zur Einmalsumme, und es gibt keine Rate.

### Kennzahlen

- `einmalSummeEur`, `geraeteSummeEur`, `importSummeEur`, `monatlichSummeEur`
- `jahr1SummeEur` = Einmalsumme + 12 × monatlich
- `kostenJeM2` = Einmalsumme ÷ Brutto-m² (0 ohne Halle)
- `breakEvenMitglieder` = ⌈monatlich ÷ `mitgliedsbeitragEurMonat`⌉ (0 ohne Beitrag)
- `itemsWithoutPrice` = Objekte ohne Preis (Hinweis im Panel, in der Gerätezeile und im PDF)

## Annahmen (Standardwerte)

| Feld | Standard | Einheit | Bezug |
|---|---|---|---|
| ausbauEurM2 | 250 | €/m² | Netto |
| bodenTrainingEurM2 | 55 | €/m² | Trainingsfläche |
| bodenNassEurM2 | 90 | €/m² | Umkleide/Sanitär |
| lueftungEurM2 | 110 | €/m² | Netto |
| spiegelEurM | 660 | €/m | Spiegelbreite |
| brandschutzEurM2 | 30 | €/m² | Netto |
| sanitaerDuscheEur / sanitaerWcEur / sanitaerWaschtischEur | 1 500 / 800 / 500 | €/Stk. | Symbole |
| planungProzent | 12 | % | Ausbau + Sanitär |
| importNebenkostenProzent | 12 | % | Geräte Atlantis/Prime |
| unvorhergesehenProzent | 12 | % | vorherige Einmalposten |
| kautionMonate | 3 | Monate | Miete + NK × Brutto |
| sonstigeEinmalEur | 32 000 | € | pauschal |
| mieteEurM2Monat / nebenkostenEurM2Monat | 9 / 6 | €/m²/Monat | Brutto |
| personalEurMonat / sonstigesEurMonat | 16 000 / 2 000 | €/Monat | pauschal |
| wartungProzentJahr | 5 | %/Jahr | Gerätewert |
| finanzierungJahre / zinsProzent | 5 / 5,5 | Jahre / % p. a. | Geräte + Import |
| mitgliedsbeitragEurMonat | 39 | €/Monat | Break-even |

Die Werte sind die Quelle der Wahrheit in `DEFAULT_COST_ASSUMPTIONS` (`src/analysis/costs.ts`); die Tests lesen sie von
dort, statt Zahlen zu wiederholen.

Die Feldbeschreibungen (Label, Einheit, Erklärung, Gruppe, Schritt) stehen zentral in `COST_ASSUMPTION_FIELDS`
und speisen Panel, PDF und CSV.

## Persistenz und Store

- `project.costs?: Partial<CostAssumptions>` – `migrate.ts` (`sanitizeCosts`) übernimmt nur bekannte Schlüssel mit
  Zahlen ≥ 0, verwirft unbekannte und unsichere Schlüssel (`__proto__` …); leere Objekte werden entfernt.
- Store: `updateCosts(patch)` (Immer, identischer Patch = kein Undo-Schritt), `resetCosts()` (entfernt `costs`).

## Exporte

- **CSV** (`costsCsvText`): `Gruppe;Bezeichnung;Menge;Einheit;Einzelpreis EUR;Summe EUR;Hinweis` für Einmal- und
  laufende Kosten mit Summenzeilen, Kennzahlen-Block, danach `Annahme;Wert;Einheit;Erläuterung`. Bei
  Prozent-Positionen steht in „Menge“ der Prozentsatz und in „Einzelpreis“ die Basis. UTF-8 mit BOM, Semikolon,
  Dezimalkomma, CRLF.
- **PDF** (`drawCostPages`): A4 quer – Kennzahlen als Textblock, Tabellen Einmalkosten (finanzierte Zeilen in
  Klammern) und laufende Kosten, Annahmen-Tabelle, Hinweis netto/ohne MwSt.

## Größenordnung (Vorlage „Beispielstudio 1.000 m²“, Standardannahmen)

Geräte ≈ 387 000 € (+ Import ≈ 16 000 €, finanziert), Einmalkosten ≈ 653 000 € (Gesamtinvestition ≈ 1,06 Mio. €;
Barkauf: Einmalkosten ≈ 1,10 Mio. €), laufend ≈ 42 300 €/Monat (Barkauf ≈ 34 600 €/Monat), Break-even ≈ 1 085 Mitglieder
bei 39 €/Monat (Barkauf ≈ 888). Die Zahlen folgen `prices.json` und `DEFAULT_COST_ASSUMPTIONS` und ändern sich mit ihnen. Tests: `src/analysis/costs.test.ts`, `src/store/costs.store.test.ts`,
`src/export/costs.export.test.ts`, `src/components/CostSection.test.tsx`.
