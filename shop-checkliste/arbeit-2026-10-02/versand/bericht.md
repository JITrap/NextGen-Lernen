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

---

## Gegenprüfung (02.10.2026)

Ich habe gegen den **Live-Stand in Shopify** (Admin-API) geprüft, nicht nur gegen diesen Bericht. Der Bericht vor der Gegenprüfung liegt in `shop-checkliste/backup-2026-10-02/versand/gegenpruefung/bericht-vor-gegenpruefung.md`. An den Versandprofilen habe ich nichts geändert.

### Ergebnis in einem Satz

Die Umbenennung ist korrekt und vollständig, und es fehlt nichts. Kunden sehen in Deutschland nur noch „Standardversand (4–10 Werktage)“ für **0,00 €**. Behoben habe ich nur zwei kleine Schwächen im Skript (siehe unten).

### 1. Live-Stand gegen die Sicherung (Vergleich per Skript)

Alle 7 Profile habe ich vollständig neu geladen: alle Zonen, Länder, Provinzen, Methoden, Preise und Bedingungen, jeweils mit `hasNextPage = false`. Den Vergleich mit `deliveryProfiles-vorher.json` macht `gegenpruefung/vergleich_live_backup.py`, das Ergebnis steht in `gegenpruefung/vergleich-ergebnis.json`.

| Prüfpunkt | Ergebnis |
|---|---|
| Methoden in Zone Germany umbenannt | **60 von 60** (5 Profile × 12): vorher „Standard Delivery“, jetzt „Standardversand (4–10 Werktage)“ mit Halbgeviertstrich (U+2013) und leerer Beschreibung (`""`) |
| Stand ohne die 60 Namen und Beschreibungen | **identisch** in allen 7 Profilen (SHA-256 vorher = live, auf kanonischem JSON). Verglichen sind Zonen, Länder, 2.466 Provinzen, Preise samt Währung, Rate-IDs, Bedingungen, aktiv-Status und Zähler. |
| Gelöscht oder neu angelegt | nichts: 3.998 Methoden vorher und live mit denselben IDs, 335 Zonen und 361 Länderzuordnungen unverändert |
| Deaktiviert | nichts: alle 3.998 Methoden aktiv, `activeMethodDefinitionsCount` unverändert (720 / 720 / 720 / 720 / 720 / 397 / 1) |
| Versionen | 5 Printify-Profile genau +1 (347, 343, 346, 343, 346); Allgemeines Profil (10) und Profil 11″×8″ (15) unverändert |
| Neue Bedingungs-IDs | 120 = 60 Methoden × 2 Gewichtsgrenzen, **alle** in Zone Germany, keine anderswo. Die Werte (lb) sind gleich. |
| Standorte | Gruppen und Standorte unverändert (Printify bzw. Shop-Standort, aktiv) |
| Belege des Umsetzers | `deutschland-zonen-nachher.json` stimmt in allen 60 Methoden mit live überein. Das Skript erzeugt aus der Sicherung Byte für Byte dieselben 5 Variablen-Dateien wie in `variablen/`. Auf dem Live-Stand meldet es „Nichts zu tun“. |

Gegentest: Ich habe in einer Kopie einen Preis, einen aktiv-Status und eine Provinz geändert und eine Zone gelöscht. Das Vergleichsskript meldet alle vier Abweichungen (Exit-Code 1).

### 2. Probeberechnungen (eigene Fälle, andere Produkte als der Umsetzer)

`draftOrderCalculate`, Lieferadresse Esslingen, automatische Rabatte an. Die Liste der Entwurfsbestellungen war vorher und nachher leer. Einzelwerte: `gegenpruefung/probeberechnungen-gegenpruefung.json`.

| Fall | Angeboten | Gewählt | Versand für Kunden | Gesamt |
|---|---|---|---|---|
| 1 Poster 91×61 cm (Profil 24×36) | 2× „Standardversand (4–10 Werktage)“ (30,84 € / 61,68 €) | 30,84 € | **0,00 €** | 108,99 € = Warenwert |
| 2 Poster: 61×91 cm + 28×36 cm | 4× „Standardversand (4–10 Werktage)“ (54,30 € bis 108,60 €) | 54,30 € | **0,00 €** | 173,98 € = Warenwert |
| 2× dasselbe Poster 61×91 cm | 2× „Standardversand (4–10 Werktage)“ (61,68 € / 92,52 €) | teuerster Handle → Shopify nimmt 61,68 € | **0,00 €** | 217,98 € = Warenwert |

- Der Rabatt „Kostenloser Versand Deutschland“ ist live **aktiv**: nur DE, kein Enddatum, kein Mindestbestellwert, **keine Obergrenze** für den Versandpreis. Deshalb ist auch jede teurere Stufe kostenlos.
- Steuer jeweils 0,00 € (§ 19 UStG).
- Nur der Markt **Deutschland** ist aktiv („Europäische Union“ und „America“ sind Entwürfe). Die englischen Tarife der übrigen 59 Länderzonen sieht also kein Kunde.

### 3. Lieferzeit 4–10 Werktage: überall gleich?

Ja. Live nennen alle diese Stellen „ca. 4–10 Werktage“ (Produktion 2–5 + Versand 2–5):
- Checkout-Richtlinie „Versand“
- Checkout-Richtlinie „AGB“
- Seite `agb`
- Seite `hilfe-faq`
- alle **113** Produkttexte („in der Regel in 4–10 Werktagen“, nirgends „business days“ oder 7–15)

Damit passt der neue Name zu allen Shop-Texten. Offen bleibt nur die Frage aus Abschnitt 4, ob Printify diese Zeit auch schafft.

### 4. Weitere englische Texte im Checkout

Geprüft habe ich die Screenshots aus dem Checkout-Test, alle 2.639 Checkout-Texte des Live-Themes, die Produktoptionen aller 113 Produkte, die Rabatt- und Richtlinientitel und die Märkte.

| Text | Wo | Was tun |
|---|---|---|
| **„Express Checkout“** | Überschrift über Shop Pay / PayPal / Google Pay | **Julius im Admin** (optional, 2 Minuten): https://admin.shopify.com/store/gexdm4-2q/themes, beim Live-Theme auf „…“ > „Standardinhalte des Themes bearbeiten“ > Tab „Checkout und System“ > nach „Express Checkout“ suchen > `Express-Checkout` eintragen > Speichern. Dasselbe beim Theme „LimitlessPoster OFE v3“. (Steht auch im Checkout-Bericht, Gegenprüfung Punkt 5.) |
| „Standard Delivery / 7-15 business days“ | Versandart | **erledigt** (siehe oben) |
| „14″ x 11″ / Black“ | Variante im Screenshot des Checkout-Tests | **Live schon behoben.** Alle 113 Produkte haben die Optionen „Größe“ (cm) und „Rahmen“ (Schwarz/Weiß). Der Screenshot zeigt einen älteren Stand. |

Bewusst **nicht** als Fehler gezählt:
- „Checkout“ im Browser-Tab und in einigen Hinweisen: Das ist Shopifys eigene deutsche Übersetzung.
- Markennamen wie Shop Pay, PayPal, Google Pay und Klarna.
- Die teils englischen Motivnamen der Poster (z. B. „Become Unstoppable – Motivationsposter“): Das sind Produktnamen.
- Alle übrigen Checkout-Texte sind deutsche Shopify-Standardtexte, und die Richtlinientitel sind deutsch (Kontakt, Impressum, Datenschutzerklärung, Widerrufsrecht, Versand, AGB).

### 5. Was ich behoben habe

Im Skript `shop-checkliste/werkzeug/versand_deutsch_umbenennen.py` (Vorher-Stand: `backup-2026-10-02/versand/gegenpruefung/versand_deutsch_umbenennen.py.vorher`):
1. **Zurücksetzen prüfte nichts.** Mit `--zuruecksetzen … --anwenden` meldete das Skript immer „Preise/Bedingungen/andere Laender unveraendert: True“, ohne den Vorher-Stand geladen zu haben. Jetzt lädt es jedes Profil vor der Änderung und vergleicht danach wirklich.
2. **Abweichungen begannen mit „OK“.** Jetzt beginnt die Zeile mit „ABWEICHUNG“ (Exit-Code 1 wie bisher).
3. Der Vergleich berücksichtigt jetzt auch die **Länder der Zonen**.
4. Neu ist eine Schutzabfrage: Bei mehreren Standortgruppen mit mehr als 70 Zonen bricht das Skript ab, statt Zonen falsch zusammenzufügen. Printify-Profile haben nur eine Gruppe.

Getestet mit einer simulierten Admin-API auf Basis der echten Sicherung und des Live-Stands:
- Anwenden: 5 Mutationen, alles OK.
- Wiederholung: „Nichts zu tun“.
- Zurücksetzen: Die Namen sind wieder „Standard Delivery / 7-15 business days“, alles OK.
- Fehlerfall: Ein Server ändert fälschlich Preise. Das Skript meldet ABWEICHUNG und Exit-Code 1, beim Anwenden wie beim Zurücksetzen. Vorher blieb dieser Fehler beim Zurücksetzen unbemerkt.

Die Variablen sind unverändert, also weiter identisch mit den ausgeführten. Gegen die echte API ist das Skript wie beim Umsetzer nicht gelaufen, weil hier kein Token vorhanden ist.

### 6. Übergaben (nicht mein Bereich, nur geprüft)

- **Bereich zahlarten** (`obsidian/LimitlessPoster/vorlagen/`): Die Übergabe des Umsetzers stimmt. In `Order Printer Rechnung (§ 19).liquid` ersetzt Zeile 72 nur „Standard Delivery“, und Zeile 256 setzt den Namen in Klammern. Auf der Rechnung stünde also „Versand (Standardversand (4–10 Werktage))“. Vorschlag für Zeile 72: `| split: " (" | first` anhängen, dann steht dort „Versand (Standardversand)“. Außerdem ist in `Anleitung Benachrichtigungs-Mails (Deutsch + Branding).md` Zeile 56 der Hinweis „Versandart heißt noch englisch“ veraltet.
- **Bereich admin:** Im Admin-Bericht ist unter „Offene Punkte“ (Zeile 67) „Versandart heißt ‚Standard Delivery‘“ jetzt erledigt.
- **Bereich checkout:** Punkt B im Checkout-Bericht schlägt „Standardversand · 7–15 Werktage“ vor. Umgesetzt ist „Standardversand (4–10 Werktage)“, passend zu allen Shop-Texten. Die doppelten Optionen (Punkt B, Teil 2) bestehen weiter.
- **Bereich recht:** Die live verlinkte Checkout-Richtlinie „Versand“ (Stand 25.08.) nennt richtig 4–10 Werktage. Sie spricht aber noch von „Deutschland und der EU“. Die DE-only-Vorlage liegt schon bereit (Recht-Bericht).

### 7. Für Julius

Das kommt zu den Punkten im ursprünglichen Bericht hinzu („4. Wichtig: Lieferzeit“ und „5. Hinweise“ zum Printify-Sync):

1. **Optional:** „Express Checkout“ in „Express-Checkout“ ändern (Klickweg in der Tabelle unter Gegenprüfung Punkt 4).
2. **Bei der Testbestellung zusätzlich prüfen:**
   - In Printify unter Orders muss die importierte Bestellung als **Standard**-Versand erscheinen, nicht als Express oder Priority. Bei Printify-Anbindungen wird Express üblicherweise am Wort „Express“ im Namen der Versandart erkannt, so dokumentiert es z. B. Customily für Printify auf Shopify. Der neue Name enthält das Wort nicht. Die Printify-Hilfe selbst war von hier aus nicht abrufbar, deshalb bitte einmal nachsehen.
   - Auf der Rechnung aus Order Printer darf nicht „Versand (Standardversand (4–10 Werktage))“ stehen. Falls doch, gilt die Übergabe in Gegenprüfung Punkt 6.
3. **Nach jedem Veröffentlichen in Printify** prüfen, ob die Namen zurückgesetzt wurden (Abschnitt „5. Hinweise“ oben). Das geht auch maschinell: die Profile mit der Abfrage „ProfilVoll“ (steht im Kopf von `gegenpruefung/vergleich_live_backup.py`) laden und mit dem Skript gegen die Sicherung vergleichen.

### Dateien der Gegenprüfung

| Datei | Inhalt |
|---|---|
| `shop-checkliste/arbeit-2026-10-02/versand/gegenpruefung/vergleich_live_backup.py` | Vergleich Live-Stand gegen Sicherung (alles außer den 60 Namen/Beschreibungen, Versionen und Bedingungs-IDs) |
| `shop-checkliste/arbeit-2026-10-02/versand/gegenpruefung/vergleich-ergebnis.json` | Ergebnis: je Profil Hashes, Zähler, Fehler (0) |
| `shop-checkliste/arbeit-2026-10-02/versand/gegenpruefung/probeberechnungen-gegenpruefung.json` | Die drei Probeberechnungen und der Live-Stand des Rabatts |
| `shop-checkliste/backup-2026-10-02/versand/gegenpruefung/` | Vorher-Stand von Bericht und Skript |
