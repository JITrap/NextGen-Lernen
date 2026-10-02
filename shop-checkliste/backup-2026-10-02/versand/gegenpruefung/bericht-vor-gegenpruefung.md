# Versand: Versandart auf Deutsch (Stand 02.10.2026)

## Ergebnis in einem Satz

Im Checkout und in den Shopify-Mails heißt die Versandart jetzt **„Standardversand (4–10 Werktage)“** statt „Standard Delivery“. Der Versand kostet Kunden weiterhin **0,00 €**, das ist per Probeberechnung belegt.

Eine Sache musst du selbst prüfen: Printify gibt für Deutschland **7–15 Werktage** an, der Shop verspricht überall **4–10 Werktage** (siehe „Wichtig“ unten).

---

## 1. Was geändert wurde

| | Vorher | Nachher |
|---|---|---|
| Name der Versandart (Checkout, Bestell- und Versandmails) | `Standard Delivery` | `Standardversand (4–10 Werktage)` |
| Zeile unter dem Namen im Checkout (Beschreibung) | `7-15 business days` | leer |
| Preise der 12 Gewichtsstufen | 26,39–416,28 USD je Stufe | unverändert |
| Gewichtsstufen (0–0,22 lb, 0,22–0,44 lb, …) | 12 Stufen | unverändert |
| Aktiv | ja | ja |

**Geändert:** 5 Printify-Profile × Zone **Germany** × 12 Methoden = **60 Methoden**, per `deliveryProfileUpdate` → `methodDefinitionsToUpdate` (nur `name` und `description`). Gelöscht oder neu angelegt wurde nichts.

| Profil (Printify) | Varianten | Zone Germany | Version vorher → nachher |
|---|---|---|---|
| Standard: Print Pigeons … 11″ x 14″, 12″ x 18″ … (28×36 und 30×46 cm) | 450 | `DeliveryZone/678674268493` | 346 → 347 (Testprofil) |
| … 18″ x 24″ (46×61 cm) | 224 | `DeliveryZone/678676562253` | 342 → 343 |
| … 24″ x 36″ (61×91 cm) | 226 | `DeliveryZone/678678528333` | 345 → 346 |
| … 16″ x 20″ (41×51 cm) | 224 | `DeliveryZone/678680494413` | 342 → 343 |
| … 20″ x 30″ (51×76 cm) | 226 | `DeliveryZone/678682296653` | 345 → 346 |

**Nicht angefasst:**
- Je Profil die 59 anderen Länderzonen (zusammen 3.540 Methoden, darunter auch die Namen „Standard Delivery“ für EU- und Nicht-EU-Länder). Sie sind für Kunden ohne Wirkung, weil nur der Markt Deutschland aktiv ist.
- „Allgemeines Profil“ (0 Varianten, Tarif „Standardversand (kostenlos)“, Version 10 unverändert).
- Profil „… 11″ x 8″“ (0 Varianten, Zone „Deutschland + EU“ hieß schon „Standardversand (kostenlos)“, Version 15 unverändert).
- Der automatische Rabatt „Kostenloser Versand Deutschland“ (aktiv, kein Enddatum).

## 2. Warum dieser Name

Die Lieferzeit, die der Shop Kunden nennt, ist überall gleich:

| Stelle | Text |
|---|---|
| Seite „Hilfe & FAQ“ (live) | „insgesamt kannst du mit ca. **4–10 Werktagen** rechnen“ (Produktion 2–5 + Versand 2–5) |
| AGB § 5 (2) (live) | „voraussichtliche Lieferzeit … ca. 4–10 Werktage“ |
| Alle 113 Produkttexte (live) | „versandkostenfrei innerhalb Deutschlands geliefert, in der Regel in 4–10 Werktagen“ |
| Vorlage `Checkout-Richtlinie Versand (neu, DE-only).html` | „Lieferzeit von ca. 4–10 Werktagen“ |
| Baustein Bestellbestätigung | „in der Regel 4–10 Werktage“ |

Deshalb lautet der Name „Standardversand (4–10 Werktage)“. Die Lieferzeit steht im Namen, weil die Shopify-Mails nur den Namen zeigen, nicht die Beschreibung.

Die englische Beschreibung „7-15 business days“ habe ich geleert. Sonst stünde im Checkout direkt unter „4–10 Werktage“ eine andere, englische Lieferzeit. Das wäre widersprüchlich.

## 3. Wie geprüft wurde

1. **Sicherung zuerst:** Alle 7 Versandprofile vollständig gesichert, mit allen Zonen und Methoden, jeweils inklusive Name, Beschreibung, aktiv, Preis und Bedingungen (Seiten vollständig, `hasNextPage = false`).
2. **Test an einem Profil:** Zuerst nur das größte Profil (11×14, 450 Varianten). Es gab keinen Fehler. Danach habe ich das Profil komplett neu geladen und mit der Sicherung verglichen: Genau 12 Namen und 12 Beschreibungen in Zone Germany sind anders. Alle 720 Methoden-IDs, Preise, Gewichtswerte, aktiv-Status und die 59 anderen Zonen sind identisch. Eine Nebenwirkung: Shopify vergibt beim Speichern neue interne IDs für die Gewichtsbedingungen, deren Werte bleiben aber gleich.
3. **Die übrigen 4 Profile** einzeln geändert und jeweils genauso verglichen. Das Ergebnis ist bei allen gleich.
4. **Probeberechnungen** (`draftOrderCalculate`, Lieferadresse Esslingen, Lieferland DE, automatische Rabatte an). Dabei wird keine Bestellung gespeichert, die Liste der Entwürfe ist danach leer.

| Fall | Vorher | Nachher | Versand für Kunden | Gesamt |
|---|---|---|---|---|
| A: 1 Poster 28×36 cm | 2× „Standard Delivery“ (23,46 € / 46,92 €) | 2× „Standardversand (4–10 Werktage)“ (23,46 € / 46,92 €) | 23,46 € → **0,00 €** | 64,99 € (= Warenwert) |
| B: 46×61 cm + 61×91 cm | 4× „Standard Delivery“ (54,30 € bis 108,60 €) | 4× „Standardversand (4–10 Werktage)“ (gleiche Preise) | 54,30 € → **0,00 €** | 190,98 € (= Warenwert) |
| C: 41×51 cm + 51×76 cm | (nicht vorher gemessen) | 4× „Standardversand (4–10 Werktage)“ (49,23 € bis 98,47 €) | 49,23 € → **0,00 €** | 164,98 € (= Warenwert) |

Damit sind alle 5 Profile im Checkout abgedeckt. Rabatt war jedes Mal „Kostenloser Versand Deutschland“ (automatisch, Versandebene). Die Einzelwerte stehen in `probeberechnungen.json`.

## 4. Wichtig: Lieferzeit 4–10 oder 7–15 Werktage?

Printify hat in seinen Profilen für Deutschland (und alle EU-Länder) **„7-15 business days“** hinterlegt, für Länder außerhalb der EU „12-35 business days“. Der Shop verspricht an allen Stellen **4–10 Werktage**. Ich habe den Namen wie beauftragt an die Shop-Angabe angepasst. Welche Angabe stimmt, kann ich aber nicht prüfen.

Das solltest du klären, bevor die ersten Bestellungen kommen. Eine zu kurze Lieferzeitangabe kann als irreführend abgemahnt werden und führt zu Nachfragen und Stornos.
1. Lies in Printify bei deinem Druckpartner **Print Pigeons** (Profilname „Print Pigeons, 492, 493, Poster“) nach, welche Produktions- und Versandzeit für Deutschland angegeben ist.
2. Achte bei der Testbestellung auf das Datum der Bestellung und das Datum der Zustellung.
3. Falls 4–10 Werktage nicht haltbar sind, ändere zuerst die Texte: FAQ, AGB § 5, Versandrichtlinie, Produkttexte, Baustein Bestellbestätigung. Danach den Namen der Versandart mit dem Skript anpassen, z. B.:
   `python3 shop-checkliste/werkzeug/versand_deutsch_umbenennen.py --ziel-name "Standardversand (5–12 Werktage)" --alter-name "Standardversand (4–10 Werktage)"`

## 5. Hinweise

**Printify kann den Namen zurücksetzen.** Wenn du in Printify Produkte neu veröffentlichst oder synchronisierst, schreibt Printify seine Versandprofile neu. Das ist schon einmal passiert (17./21.09.: der 0-€-Tarif vom 03.09. war danach weg). Dann heißt die Versandart wieder „Standard Delivery“, und die Methoden bekommen neue IDs.
- **Prüfen:** Nach jedem Veröffentlichen in Printify unter Admin > Einstellungen > Versand und Zustellung ein Print-Pigeons-Profil öffnen und in der Zone Germany auf den Namen achten. Oder eine Probeberechnung machen.
- **Beheben:** Das Skript erneut ausführen. Es sucht die Methoden über den Namen und nicht über feste IDs (Anleitung in `shop-checkliste/werkzeug/versand_deutsch_umbenennen.graphql`).
- Der Gratisversand hängt davon nicht ab. Der automatische Rabatt greift unabhängig vom Namen.

**Weiterhin mehrere gleiche Optionen im Checkout.** Ein Poster wiegt genau 0,22 lb und passt damit in zwei Gewichtsstufen (0–0,22 und 0,22–0,44 lb). Kunden sehen deshalb bei 1 Poster 2 und bei 2 Postern verschiedener Größen 4 Optionen. Alle haben jetzt denselben deutschen Namen, alle kosten 0 €, nur der durchgestrichene Preis ist verschieden. Laut Auftrag sollten Preise und Bedingungen unverändert bleiben, deshalb habe ich das nicht geändert. Die Lösung steht im Checkout-Bericht (`arbeit-2026-10-02/checkout/bericht.md`, Punkt B). Am einfachsten ersetzt du in Zone Germany die Staffel durch **einen** 0-€-Tarif. Printify kann aber auch das wieder überschreiben.

**Übergabe an den Bereich, dem `obsidian/LimitlessPoster/vorlagen/` gehört** (dort habe ich nichts geändert):
- In `Order Printer Rechnung (§ 19).liquid` (Zeile 72) wird nur „Standard Delivery“ zu „Standardversand“ ersetzt. Der neue Name kommt unverändert durch, auf der Rechnung steht dann „Versand (Standardversand (4–10 Werktage))“, also mit doppelter Klammer. Vorschlag: `| split: " (" | first` anhängen, dann steht dort „Versand (Standardversand)“.
- In `Anleitung Benachrichtigungs-Mails (Deutsch + Branding).md` (Zeile 56) steht noch, die Versandart heiße englisch. Das ist jetzt erledigt.

**Rückgängig machen** (solange Printify die IDs nicht neu vergeben hat):
`python3 shop-checkliste/werkzeug/versand_deutsch_umbenennen.py --zuruecksetzen shop-checkliste/backup-2026-10-02/versand/deutschland-zonen-vorher.json`
Das ist zunächst nur ein Probelauf. Die Ausführung braucht `--anwenden` und einen Admin-API-Token in der eigenen Shell, niemals in einer Datei.

## 6. Dateien

| Datei | Inhalt |
|---|---|
| `shop-checkliste/backup-2026-10-02/versand/deliveryProfiles-vorher.json` | Vollständiger Vorher-Stand aller 7 Profile (alle Zonen, Länder, Provinzen, Methoden, Preise, Bedingungen) |
| `shop-checkliste/backup-2026-10-02/versand/deutschland-zonen-vorher.json` | Auszug: Zonen mit Deutschland, lesbar, Grundlage für das Zurücksetzen |
| `shop-checkliste/arbeit-2026-10-02/versand/deutschland-zonen-nachher.json` | Nachher-Stand der 5 geänderten Zonen |
| `shop-checkliste/arbeit-2026-10-02/versand/variablen/variablen-<Profil>.json` | Die exakt ausgeführten Mutations-Variablen (5 Profile) |
| `shop-checkliste/arbeit-2026-10-02/versand/probeberechnungen.json` | Ergebnisse der Probeberechnungen vorher/nachher |
| `shop-checkliste/werkzeug/versand_deutsch_umbenennen.py` | Wiederverwendbares Skript: Plan, Variablen, Ausführen mit Prüfung, Zurücksetzen |
| `shop-checkliste/werkzeug/versand_deutsch_umbenennen.graphql` | Mutation, Prüfabfrage und Probeberechnung mit Ablaufbeschreibung |
